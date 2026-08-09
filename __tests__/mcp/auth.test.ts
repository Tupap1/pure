import { describe, it, expect } from 'vitest';
import { validateMcpAuth } from '../../mcp-server/auth-middleware';

describe('MCP Authentication Middleware (validateMcpAuth)', () => {
  const SECRET_KEY = 'Stability8-Showcase4-Lavish9-Petition3';

  it('should allow public access to GET /health', () => {
    const mockReq: any = {
      method: 'GET',
      url: '/health',
      headers: {},
    };
    expect(validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should allow preflight OPTIONS requests for CORS', () => {
    const mockReq: any = {
      method: 'OPTIONS',
      url: '/mcp',
      headers: {},
    };
    expect(validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should reject requests without authorization token on protected routes', () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {},
    };
    expect(validateMcpAuth(mockReq, SECRET_KEY)).toBe(false);
  });

  it('should accept valid Authorization: Bearer token', () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${SECRET_KEY}`,
      },
    };
    expect(validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should accept valid x-api-key header', () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {
        'x-api-key': SECRET_KEY,
      },
    };
    expect(validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should accept valid ?apiKey= query parameter for SSE browser connections', () => {
    const mockReq: any = {
      method: 'GET',
      url: `/sse?apiKey=${SECRET_KEY}`,
      headers: {},
    };
    expect(validateMcpAuth(mockReq, SECRET_KEY)).toBe(true);
  });

  it('should reject invalid or mismatched tokens', () => {
    const mockReq: any = {
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: 'Bearer WRONG_TOKEN_123',
      },
    };
    expect(validateMcpAuth(mockReq, SECRET_KEY)).toBe(false);
  });
});
