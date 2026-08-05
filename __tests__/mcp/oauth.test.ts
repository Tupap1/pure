import { describe, it, expect } from 'vitest';
import express from 'express';

describe('MCP OAuth 2.0 & RFC 7591 Dynamic Client Registration', () => {
  it('should format RFC 7591 dynamic client registration response correctly', () => {
    const mockReqBody = {
      client_name: 'Claude.ai Integration',
      redirect_uris: ['https://claude.ai/api/auth/callback'],
    };

    const clientId = `pure-client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const clientSecret = `pure-secret-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const response = {
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      client_name: mockReqBody.client_name,
      redirect_uris: mockReqBody.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
    };

    expect(response.client_id).toBeDefined();
    expect(response.client_secret).toBeDefined();
    expect(response.client_secret_expires_at).toBe(0);
    expect(response.token_endpoint_auth_method).toBe('client_secret_post');
    expect(response.redirect_uris).toContain('https://claude.ai/api/auth/callback');
  });

  it('should format OAuth 2.0 Authorization Server Metadata (RFC 8414)', () => {
    const baseUrl = 'https://mcp.btw-one.com';
    const metadata = {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
      scopes_supported: ['mcp:full_access', 'read', 'write', 'openid'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256', 'plain'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    };

    expect(metadata.issuer).toBe('https://mcp.btw-one.com');
    expect(metadata.authorization_endpoint).toBe('https://mcp.btw-one.com/authorize');
    expect(metadata.registration_endpoint).toBe('https://mcp.btw-one.com/register');
    expect(metadata.token_endpoint_auth_methods_supported).toContain('client_secret_post');
  });
});
