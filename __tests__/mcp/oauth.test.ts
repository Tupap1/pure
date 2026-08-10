import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { createRequestHandler } from '../../mcp-server/index';

describe('MCP OAuth 2.0 & RFC 7591 Dynamic Client Registration', () => {
  let server: http.Server;
  let baseUrl: string;
  const SECRET_KEY = 'test_secret_oauth_123';

  beforeAll(async () => {
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

  it('should return OAuth 2.0 authorization server metadata (RFC 8414)', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    expect(res.status).toBe(200);
    const metadata = await res.json();
    expect(metadata).toHaveProperty('issuer', baseUrl);
    expect(metadata).toHaveProperty('authorization_endpoint', `${baseUrl}/oauth/authorize`);
    expect(metadata).toHaveProperty('token_endpoint', `${baseUrl}/oauth/token`);
    expect(metadata).toHaveProperty('registration_endpoint', `${baseUrl}/oauth/register`);
  });

  it('should support RFC 7591 dynamic client registration', async () => {
    const res = await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Claude Custom Connector Test',
        redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      }),
    });

    expect(res.status).toBe(201);
    const registration = await res.json();
    expect(registration).toHaveProperty('client_id');
    expect(registration.client_id).toContain('pure_client_');
    expect(registration.token_endpoint_auth_method).toBe('none');
  });
});
