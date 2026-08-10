import crypto from 'crypto';

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

export class OAuthStore {
  private registeredClients = new Map<string, RegisteredClient>();
  private authCodes = new Map<string, AuthCodeRecord>();
  private accessTokens = new Map<string, AccessTokenRecord>();

  public registerClient(payload: { client_name?: string; redirect_uris?: string[] }): RegisteredClient {
    const clientId = `pure_client_${crypto.randomBytes(8).toString('hex')}`;
    const redirectUris = payload.redirect_uris && payload.redirect_uris.length > 0
      ? payload.redirect_uris
      : [...DEFAULT_ALLOWED_REDIRECT_URIS];

    const client: RegisteredClient = {
      clientId,
      clientName: payload.client_name || 'Claude Custom Connector',
      redirectUris,
      tokenEndpointAuthMethod: 'none',
    };

    this.registeredClients.set(clientId, client);
    return client;
  }

  public isValidRedirectUri(redirectUri: string): boolean {
    if (!redirectUri) return false;

    // Check defaults
    if (DEFAULT_ALLOWED_REDIRECT_URIS.includes(redirectUri)) return true;

    // Check localhost / 127.0.0.1
    try {
      const parsed = new URL(redirectUri);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      return false;
    }

    // Check dynamically registered clients
    for (const client of this.registeredClients.values()) {
      if (client.redirectUris.includes(redirectUri)) {
        return true;
      }
    }

    return false;
  }

  public createAuthCode(params: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: string;
  }): string {
    const code = crypto.randomBytes(32).toString('base64url');
    const record: AuthCodeRecord = {
      code,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod || 'S256',
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
      used: false,
    };
    this.authCodes.set(code, record);
    return code;
  }

  public verifyAndConsumeAuthCode(params: {
    code: string;
    redirectUri?: string;
    codeVerifier?: string;
  }): { valid: boolean; error?: string; errorDescription?: string } {
    const { code, redirectUri, codeVerifier } = params;
    const record = this.authCodes.get(code);

    if (!record) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Authorization code not found' };
    }

    // Atomic consumption check: mark as used immediately
    if (record.used) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Authorization code already used' };
    }
    record.used = true;

    // Expiry check
    if (Date.now() > record.expiresAt) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Authorization code expired' };
    }

    // Redirect URI check
    if (record.redirectUri && redirectUri && record.redirectUri !== redirectUri) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Redirect URI mismatch' };
    }

    // PKCE verification (S256)
    if (!codeVerifier) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Missing code_verifier' };
    }

    const calculatedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    if (calculatedChallenge !== record.codeChallenge) {
      return { valid: false, error: 'invalid_grant', errorDescription: 'Invalid code_verifier (PKCE validation failed)' };
    }

    return { valid: true };
  }

  public createAccessToken(): string {
    const token = crypto.randomBytes(32).toString('hex');
    const record: AccessTokenRecord = {
      token,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours TTL
    };
    this.accessTokens.set(token, record);
    return token;
  }

  public isValidAccessToken(token: string): boolean {
    if (!token) return false;
    const record = this.accessTokens.get(token);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.accessTokens.delete(token);
      return false;
    }
    return true;
  }

  public clear(): void {
    this.registeredClients.clear();
    this.authCodes.clear();
    this.accessTokens.clear();
  }
}

export const globalOAuthStore = new OAuthStore();
