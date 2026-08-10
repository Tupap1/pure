import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import crypto from 'crypto';
import { createRequestHandler } from '../../mcp-server/index';
import { createTestDb, TestDbHarness } from '../helpers/test-db';

async function parseStreamableResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (text.includes('data: ')) {
    const dataLine = text
      .split('\n')
      .find((line) => line.startsWith('data: '))
      ?.replace('data: ', '')
      .trim();
    if (dataLine) return JSON.parse(dataLine);
  }
  return JSON.parse(text);
}

describe('Claude Web Remote MCP Endpoint & Real HTTP Server Integration Tests (con pg-mem)', () => {
  let server: http.Server;
  let baseUrl: string;
  let harness: TestDbHarness;
  const SECRET_KEY = 'test_secret_key_pure_mcp_123';

  beforeAll(async () => {
    harness = await createTestDb();
    const handler = createRequestHandler({ secretKey: SECRET_KEY });
    server = http.createServer(handler);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. POST /mcp initialize -> 200, con serverInfo y protocolVersion en la respuesta', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${SECRET_KEY}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 101,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0' },
        },
      }),
    });

    expect(res.status).toBe(200);
    const data = await parseStreamableResponse(res);
    expect(data.jsonrpc).toBe('2.0');
    expect(data.id).toBe(101);
    expect(data.result).toBeDefined();
    expect(data.result.serverInfo.name).toBe('pure-mcp-server');
    expect(data.result.protocolVersion).toBeDefined();
  });

  it('2. POST /mcp tools/list -> devuelve las 10 tools', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${SECRET_KEY}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/list',
      }),
    });

    expect(res.status).toBe(200);
    const data = await parseStreamableResponse(res);
    expect(data.jsonrpc).toBe('2.0');
    expect(data.result.tools).toBeDefined();
    expect(data.result.tools.length).toBeGreaterThanOrEqual(10);
  });

  it('3. POST /mcp tools/call get_academic_overview -> resultado con content', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${SECRET_KEY}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 103,
        method: 'tools/call',
        params: {
          name: 'get_academic_overview',
          arguments: {},
        },
      }),
    });

    expect(res.status).toBe(200);
    const data = await parseStreamableResponse(res);
    expect(data.jsonrpc).toBe('2.0');
    expect(data.result.content).toBeDefined();
    expect(data.result.content[0].type).toBe('text');
    const parsedText = JSON.parse(data.result.content[0].text);
    expect(parsedText.status).toBe('success');
  });

  it('4. GET /.well-known/oauth-protected-resource -> 200 con authorization_servers', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resource).toBe(baseUrl);
    expect(data.authorization_servers).toContain(baseUrl);
    expect(data.scopes_supported).toContain('mcp');
    expect(data.bearer_methods_supported).toContain('header');
  });

  it('5. GET /.well-known/oauth-authorization-server/mcp -> 200 con OAuth metadata REAL', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server/mcp`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.issuer).toBe(baseUrl);
    expect(data.authorization_endpoint).toBe(`${baseUrl}/oauth/authorize`);
    expect(data.token_endpoint).toBe(`${baseUrl}/oauth/token`);
    expect(data.registration_endpoint).toBe(`${baseUrl}/oauth/register`);
    expect(data.scopes_supported).toContain('mcp');
    expect(data.code_challenge_methods_supported).toContain('S256');
    expect(data.code_challenge_methods_supported).not.toContain('plain');
  });

  it('6. Flujo PKCE completo: register -> authorize+consent -> token -> usar el token en POST /mcp', async () => {
    // Step A: Register
    const regRes = await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Claude Custom Connector PKCE',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      }),
    });
    expect(regRes.status).toBe(201);
    const regData = await regRes.json();
    expect(regData.client_id).toBeDefined();
    expect(regData.token_endpoint_auth_method).toBe('none');

    // Step B: Authorize + Consent POST with PKCE challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const authRes = await fetch(`${baseUrl}/oauth/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({
        client_id: regData.client_id,
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        state: 'pkce_state_test',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        password: SECRET_KEY,
      }).toString(),
    });

    expect(authRes.status).toBe(302);
    const redirectLocation = authRes.headers.get('location');
    expect(redirectLocation).toBeDefined();

    const redirectUrl = new URL(redirectLocation!);
    const code = redirectUrl.searchParams.get('code');
    expect(code).toBeDefined();
    expect(redirectUrl.searchParams.get('state')).toBe('pkce_state_test');

    // Step C: Token Exchange
    const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code!,
        client_id: regData.client_id,
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        code_verifier: codeVerifier,
      }).toString(),
    });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.headers.get('cache-control')).toBe('no-store');
    const tokenData = await tokenRes.json();
    expect(tokenData.access_token).toBeDefined();
    expect(tokenData.token_type).toBe('Bearer');
    const oauthAccessToken = tokenData.access_token;

    // Step D: Use issued OAuth token on POST /mcp
    const mcpRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${oauthAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 200,
        method: 'tools/list',
      }),
    });

    expect(mcpRes.status).toBe(200);
    const mcpData = await parseStreamableResponse(mcpRes);
    expect(mcpData.result.tools.length).toBeGreaterThanOrEqual(10);
  });

  it('7. Reusar el mismo authorization code una segunda vez -> 401 invalid_grant', async () => {
    // Generate auth code
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const authRes = await fetch(`${baseUrl}/oauth/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({
        client_id: 'pure_client_test',
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        password: SECRET_KEY,
      }).toString(),
    });

    const redirectUrl = new URL(authRes.headers.get('location')!);
    const code = redirectUrl.searchParams.get('code')!;

    // First use: Success
    const tokenRes1 = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        code_verifier: codeVerifier,
      }).toString(),
    });
    expect(tokenRes1.status).toBe(200);

    // Second use: Failure (Replay protection)
    const tokenRes2 = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        code_verifier: codeVerifier,
      }).toString(),
    });

    expect(tokenRes2.status).toBe(401);
    const errData = await tokenRes2.json();
    expect(errData.error).toBe('invalid_grant');
    expect(errData.error_description).toContain('already used');
  });

  it('8. code_verifier incorrecto -> 401 invalid_grant', async () => {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const authRes = await fetch(`${baseUrl}/oauth/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
      body: new URLSearchParams({
        client_id: 'pure_client_test',
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        password: SECRET_KEY,
      }).toString(),
    });

    const redirectUrl = new URL(authRes.headers.get('location')!);
    const code = redirectUrl.searchParams.get('code')!;

    // Exchange with WRONG verifier
    const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
        code_verifier: 'wrong_code_verifier_9999999999999999999999999',
      }).toString(),
    });

    expect(tokenRes.status).toBe(401);
    const errData = await tokenRes.json();
    expect(errData.error).toBe('invalid_grant');
    expect(errData.error_description).toContain('Invalid code_verifier');
  });

  it('9. POST /mcp sin token -> 401 CON header WWW-Authenticate', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 301,
        method: 'initialize',
      }),
    });

    expect(res.status).toBe(401);
    const wwwAuthHeader = res.headers.get('www-authenticate');
    expect(wwwAuthHeader).toBeDefined();
    expect(wwwAuthHeader).toContain(`Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);
  });

  it('10. GET /sse sin token -> 401 (regresión del bypass)', async () => {
    const res = await fetch(`${baseUrl}/sse`);
    expect(res.status).toBe(401);
    const wwwAuthHeader = res.headers.get('www-authenticate');
    expect(wwwAuthHeader).toBeDefined();
    expect(wwwAuthHeader).toContain('Bearer resource_metadata=');
  });

  it('11. GET / público debe retornar status 200 OK con info del servidor', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.server).toBe('pure-mcp-server');
  });

  it('12. POST /oauth/register con host no permitido debe retornar 400 invalid_request', async () => {
    const res = await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Evil App',
        redirect_uris: ['https://evil.com/callback'],
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_request');
    expect(data.error_description).toContain('Allowed hosts');
  });
});
