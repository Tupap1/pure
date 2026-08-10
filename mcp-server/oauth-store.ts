import crypto from 'crypto';
import { pgPool } from '../lib/db/pg-client';

export interface RegisteredClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
}

export interface AuthCodeRecord {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
  used: boolean;
}

export interface AccessTokenRecord {
  token: string;
  expiresAt: number;
}

const DEFAULT_ALLOWED_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
  'https://claude.ai/oauth/callback',
];

export function isHostAllowed(redirectUri: string): boolean {
  if (!redirectUri) return false;
  try {
    const parsed = new URL(redirectUri);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'claude.ai' ||
      host === 'claude.com' ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

export class OAuthStore {
  private registeredClients = new Map<string, RegisteredClient>();
  private authCodes = new Map<string, AuthCodeRecord>();
  private accessTokens = new Map<string, AccessTokenRecord>();

  constructor() {
    // TAREA 4: Periodic cleanup every 10 minutes with unref()
    const timer = setInterval(() => {
      this.cleanupExpired().catch(() => {});
    }, 10 * 60 * 1000);
    if (timer.unref) {
      timer.unref();
    }
  }

  public async registerClient(payload: { client_name?: string; redirect_uris?: string[] }): Promise<RegisteredClient> {
    const clientId = `pure_client_${crypto.randomBytes(8).toString('hex')}`;
    const redirectUris = payload.redirect_uris && payload.redirect_uris.length > 0
      ? payload.redirect_uris
      : [...DEFAULT_ALLOWED_REDIRECT_URIS];

    // Validate all redirect URIs against host whitelist
    for (const uri of redirectUris) {
      if (!isHostAllowed(uri)) {
        throw new Error(`Invalid redirect_uri host: ${uri}. Allowed hosts: claude.ai, claude.com, localhost, 127.0.0.1`);
      }
    }

    const client: RegisteredClient = {
      clientId,
      clientName: payload.client_name || 'Claude Custom Connector',
      redirectUris,
      tokenEndpointAuthMethod: 'none',
    };

    // Store in Postgres
    try {
      await pgPool.query(
        `INSERT INTO oauth_clients (client_id, client_name, redirect_uris, token_endpoint_auth_method)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (client_id) DO UPDATE SET
           client_name = EXCLUDED.client_name,
           redirect_uris = EXCLUDED.redirect_uris`,
        [client.clientId, client.clientName, client.redirectUris, client.tokenEndpointAuthMethod]
      );
    } catch (err) {
      // Memory fallback if DB unavailable
    }

    this.registeredClients.set(clientId, client);
    return client;
  }

  public async isValidRedirectUri(redirectUri: string, clientId?: string): Promise<boolean> {
    if (!redirectUri || !isHostAllowed(redirectUri)) return false;

    // Default whitelist URIs are always accepted
    if (DEFAULT_ALLOWED_REDIRECT_URIS.includes(redirectUri)) return true;

    // Check specific client if clientId provided
    if (clientId) {
      try {
        const res = await pgPool.query('SELECT redirect_uris FROM oauth_clients WHERE client_id = $1', [clientId]);
        if (res.rows.length > 0 && Array.isArray(res.rows[0].redirect_uris)) {
          return res.rows[0].redirect_uris.includes(redirectUri);
        }
      } catch (err) {
        // Fallback to memory
      }

      const client = this.registeredClients.get(clientId);
      if (client) {
        return client.redirectUris.includes(redirectUri);
      }
    }

    // Check across all registered clients
    try {
      const res = await pgPool.query('SELECT redirect_uris FROM oauth_clients');
      for (const row of res.rows) {
        if (Array.isArray(row.redirect_uris) && row.redirect_uris.includes(redirectUri)) {
          return true;
        }
      }
    } catch (err) {
      // Fallback
    }

    for (const client of this.registeredClients.values()) {
      if (client.redirectUris.includes(redirectUri)) {
        return true;
      }
    }

    return false;
  }

  public async createAuthCode(params: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: string;
  }): Promise<string> {
    const code = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins TTL

    const record: AuthCodeRecord = {
      code,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod || 'S256',
      expiresAt: expiresAt.getTime(),
      used: false,
    };

    // Save in DB
    try {
      // If client_id doesn't exist in oauth_clients yet (e.g. static pure_client_test), insert dummy client first
      if (params.clientId) {
        await pgPool.query(
          `INSERT INTO oauth_clients (client_id, client_name, redirect_uris)
           VALUES ($1, $2, $3)
           ON CONFLICT (client_id) DO NOTHING`,
          [params.clientId, 'Default Client', [params.redirectUri]]
        );
      }

      await pgPool.query(
        `INSERT INTO oauth_auth_codes (code, client_id, redirect_uri, code_challenge, code_challenge_method, expires_at, used)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
        [code, params.clientId || null, params.redirectUri, params.codeChallenge, record.codeChallengeMethod, expiresAt]
      );
    } catch (err) {
      // Memory fallback
    }

    this.authCodes.set(code, record);
    return code;
  }

  public async verifyAndConsumeAuthCode(params: {
    code: string;
    clientId?: string;
    redirectUri?: string;
    codeVerifier?: string;
  }): Promise<{ valid: boolean; error?: string; errorDescription?: string }> {
    const { code, clientId, redirectUri, codeVerifier } = params;

    // TAREA 2: Atomic consumption in a single SQL query
    try {
      const res = await pgPool.query(
        `UPDATE oauth_auth_codes
         SET used = TRUE
         WHERE code = $1 AND used = FALSE AND expires_at > NOW()
         RETURNING client_id, redirect_uri, code_challenge, code_challenge_method`,
        [code]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];

        // Also mark in memory fallback if present
        const memRecord = this.authCodes.get(code);
        if (memRecord) memRecord.used = true;

        // Check clientId matching
        if (clientId && row.client_id && row.client_id !== clientId) {
          return { valid: false, error: 'invalid_grant', errorDescription: 'Client ID mismatch' };
        }

        // Check redirectUri matching
        if (row.redirect_uri && redirectUri && row.redirect_uri !== redirectUri) {
          return { valid: false, error: 'invalid_grant', errorDescription: 'Redirect URI mismatch' };
        }

        // Check PKCE verification (S256)
        if (!codeVerifier) {
          return { valid: false, error: 'invalid_grant', errorDescription: 'Missing code_verifier' };
        }

        const calculatedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
        if (calculatedChallenge !== row.code_challenge) {
          return { valid: false, error: 'invalid_grant', errorDescription: 'Invalid code_verifier (PKCE validation failed)' };
        }

        return { valid: true };
      }
    } catch (err) {
      // DB failed or not initialized; fall through to memory check
    }

    // Memory fallback check
    const record = this.authCodes.get(code);

    if (!record) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Authorization code not found' };
    }

    if (record.used) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Authorization code already used' };
    }
    record.used = true;

    if (Date.now() > record.expiresAt) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Authorization code expired' };
    }

    if (clientId && record.clientId && record.clientId !== clientId) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Client ID mismatch' };
    }

    if (record.redirectUri && redirectUri && record.redirectUri !== redirectUri) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Redirect URI mismatch' };
    }

    if (!codeVerifier) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Missing code_verifier' };
    }

    const calculatedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    if (calculatedChallenge !== record.codeChallenge) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Invalid code_verifier (PKCE validation failed)' };
    }

    return { valid: true };
  }

  public async createAccessToken(clientId?: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL

    const record: AccessTokenRecord = {
      token,
      expiresAt: expiresAt.getTime(),
    };

    // Save in DB
    try {
      await pgPool.query(
        `INSERT INTO oauth_access_tokens (token, client_id, expires_at)
         VALUES ($1, $2, $3)`,
        [token, clientId || null, expiresAt]
      );
    } catch (err) {
      // Memory fallback
    }

    this.accessTokens.set(token, record);
    return token;
  }

  public async isValidAccessToken(token: string): Promise<boolean> {
    if (!token) return false;

    // Check DB
    try {
      const res = await pgPool.query(
        `SELECT expires_at FROM oauth_access_tokens WHERE token = $1 AND expires_at > NOW()`,
        [token]
      );
      if (res.rows.length > 0) {
        return true;
      }
    } catch (err) {
      // Memory fallback
    }

    // Check memory fallback
    const record = this.accessTokens.get(token);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.accessTokens.delete(token);
      return false;
    }
    return true;
  }

  public async cleanupExpired(): Promise<void> {
    try {
      await pgPool.query(`DELETE FROM oauth_auth_codes WHERE expires_at < NOW() OR (used = TRUE AND created_at < NOW() - INTERVAL '1 hour')`);
      await pgPool.query(`DELETE FROM oauth_access_tokens WHERE expires_at < NOW()`);
    } catch (err) {
      // Ignore cleanup DB errors
    }

    const now = Date.now();
    for (const [code, rec] of this.authCodes.entries()) {
      if (rec.expiresAt < now || rec.used) {
        this.authCodes.delete(code);
      }
    }

    for (const [token, rec] of this.accessTokens.entries()) {
      if (rec.expiresAt < now) {
        this.accessTokens.delete(token);
      }
    }
  }

  public clear(): void {
    this.registeredClients.clear();
    this.authCodes.clear();
    this.accessTokens.clear();
  }
}

export const globalOAuthStore = new OAuthStore();
