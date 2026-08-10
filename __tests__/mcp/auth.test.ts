import { describe, it, expect } from 'vitest';
import { validateMcpAuth } from '../../mcp-server/auth-middleware';

describe('MCP Authentication Middleware (validateMcpAuth)', () => {
  const SECRET_KEY = 'SecretKeyForTesting123';

  it('should allow public access to GET /health', async () => {
    const mockReq: any = {
      method: 'GET',
      url: '/health',
      headers: {},
    };
    expect(await validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should allow preflight OPTIONS requests for CORS', async () => {
    const mockReq: any = {
      method: 'OPTIONS',
      url: '/mcp',
      headers: {},
    };
    expect(await validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should reject requests without authorization token on protected routes', async () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {},
    };
    expect(await validateMcpAuth(mockReq, SECRET_KEY)).toBe(false);
  });

  it('should accept valid Authorization: Bearer token matching secret key', async () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${SECRET_KEY}`,
      },
    };
    expect(await validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should accept valid x-api-key header matching secret key', async () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {
        'x-api-key': SECRET_KEY,
      },
    };
    expect(await validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should accept valid ?apiKey= query parameter matching secret key', async () => {
    const mockReq: any = {
      method: 'GET',
      url: `/sse?apiKey=${SECRET_KEY}`,
      headers: {},
    };
    expect(await validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should REJECT tokens starting with pure_token_ if they do not match target key', async () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: 'Bearer pure_token_unauthorized_token_123',
      },
    };
    expect(await validateMcpAuth(mockReq, SECRET_KEY)).toBe(false);
  });

  it('should reject invalid or mismatched tokens', async () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: 'Bearer WRONG_TOKEN_123',
      },
    };
    expect(await validateMcpAuth(mockReq, SECRET_KEY)).toBe(false);
  });

  it('should reject access if no secret key is passed and env vars are not set', async () => {
    const originalApiKey = process.env.MCP_API_KEY;
    const originalAuthToken = process.env.MCP_AUTH_TOKEN;
    delete process.env.MCP_API_KEY;
    delete process.env.MCP_AUTH_TOKEN;

    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: 'Bearer some_token',
      },
    };
    expect(await validateMcpAuth(mockReq)).toBe(false);

    if (originalApiKey) process.env.MCP_API_KEY = originalApiKey;
    if (originalAuthToken) process.env.MCP_AUTH_TOKEN = originalAuthToken;
  });
});
