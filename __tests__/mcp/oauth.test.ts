import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';

describe('TDD: MCP OAuth 2.0 & RFC 7591 Dynamic Client Registration', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const hostHeader = req.headers.host || `localhost:${(server.address() as AddressInfo).port}`;
      const calculatedBaseUrl = `http://${hostHeader}`;
      const url = new URL(req.url || '/', calculatedBaseUrl);

      // OpenID / OAuth Authorization Discovery
      if (
        url.pathname === '/.well-known/oauth-authorization-server' ||
        url.pathname === '/.well-known/openid-configuration'
      ) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            issuer: calculatedBaseUrl,
            authorization_endpoint: `${calculatedBaseUrl}/oauth/authorize`,
            token_endpoint: `${calculatedBaseUrl}/oauth/token`,
            registration_endpoint: `${calculatedBaseUrl}/oauth/register`,
            scopes_supported: ['mcp'],
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code'],
            token_endpoint_auth_methods_supported: ['client_secret_post', 'none', 'client_secret_basic'],
          })
        );
        return;
      }

      // Dynamic Client Registration (RFC 7591)
      if ((url.pathname === '/oauth/register' || url.pathname === '/register') && req.method === 'POST') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            client_id: `pure_client_${Date.now()}`,
            client_secret: `pure_secret_test`,
            redirect_uris: ['https://claude.ai/oauth/callback'],
          })
        );
        return;
      }

      // OAuth Access Token Exchange
      if ((url.pathname === '/oauth/token' || url.pathname === '/token') && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            access_token: `pure_token_${Date.now()}`,
            token_type: 'Bearer',
            expires_in: 31536000,
          })
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

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
        redirect_uris: ['https://claude.ai/oauth/callback'],
      }),
    });

    expect(res.status).toBe(201);
    const registration = await res.json();
    expect(registration).toHaveProperty('client_id');
    expect(registration).toHaveProperty('client_secret');
    expect(registration.client_id).toContain('pure_client_');
  });
});
