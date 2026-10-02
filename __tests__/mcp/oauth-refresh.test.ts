import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import { AddressInfo } from 'net';
import { createRequestHandler } from '../../mcp-server/index';
import { OAuthStore } from '../../mcp-server/oauth-store';

// Sin refresh_token, Claude Web tiene que repetir el consentimiento cada vez que
// caduca el access token (24h): eso es el "toca reconectar el MCP" constante.
describe('MCP OAuth refresh_token (reconexión silenciosa)', () => {
  let server: http.Server;
  let baseUrl: string;
  const SECRET_KEY = 'test_secret_refresh_123';
  const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';

  beforeAll(async () => {
    const handler = createRequestHandler({ secretKey: SECRET_KEY, oauthStore: new OAuthStore() });
    server = http.createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function authorize(): Promise<{ clientId: string; tokens: any }> {
    const reg = await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Refresh Test', redirect_uris: [REDIRECT_URI] }),
    });
    const { client_id: clientId } = await reg.json();

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const consent = await fetch(`${baseUrl}/oauth/authorize`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        password: SECRET_KEY,
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString(),
    });
    expect(consent.status).toBe(302);
    const code = new URL(consent.headers.get('location')!).searchParams.get('code')!;

    const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }).toString(),
    });
    expect(tokenRes.status).toBe(200);
    return { clientId, tokens: await tokenRes.json() };
  }

  function refresh(refreshToken: string, clientId: string) {
    return fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }).toString(),
    });
  }

  function listTools(accessToken: string) {
    return fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
  }

  it('anuncia refresh_token en los metadatos del servidor de autorización', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    const metadata = await res.json();
    expect(metadata.grant_types_supported).toContain('refresh_token');
  });

  it('el intercambio del code devuelve también un refresh_token', async () => {
    const { tokens } = await authorize();
    expect(typeof tokens.refresh_token).toBe('string');
    expect(tokens.refresh_token.length).toBeGreaterThan(20);
  });

  it('refresh_token emite un access token nuevo que sirve en /mcp, y rota el refresh', async () => {
    const { clientId, tokens } = await authorize();

    const res = await refresh(tokens.refresh_token, clientId);
    expect(res.status).toBe(200);
    const next = await res.json();
    expect(next.token_type).toBe('Bearer');
    expect(next.access_token).not.toBe(tokens.access_token);
    expect(next.refresh_token).not.toBe(tokens.refresh_token);

    const mcp = await listTools(next.access_token);
    expect(mcp.status).toBe(200);
  });

  it('un refresh_token ya usado no se puede reutilizar', async () => {
    const { clientId, tokens } = await authorize();
    expect((await refresh(tokens.refresh_token, clientId)).status).toBe(200);

    const replay = await refresh(tokens.refresh_token, clientId);
    expect(replay.status).toBe(400);
    expect((await replay.json()).error).toBe('invalid_grant');
  });

  it('rechaza un refresh_token de otro client_id', async () => {
    const { tokens } = await authorize();
    const res = await refresh(tokens.refresh_token, 'pure_client_otro');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_grant');
  });

  it('rechaza un refresh_token desconocido', async () => {
    const res = await refresh('no-existe', 'pure_client_x');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_grant');
  });
});
