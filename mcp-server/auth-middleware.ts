import { IncomingMessage } from 'http';

export function validateMcpAuth(req: IncomingMessage, secretKey?: string): boolean {
  const targetKey = secretKey || process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN;

  // 1. Allow public health check GET /health
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return true;
  }

  // 2. Allow CORS preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return true;
  }

  // If no secret key is configured in env or passed as parameter, reject protected routes
  if (!targetKey || targetKey.trim() === '') {
    return false;
  }

  // 3. Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      if (parts[1] === targetKey) {
        return true;
      }
    }
  }

  // 4. Check x-api-key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && apiKeyHeader === targetKey) {
    return true;
  }

  // 5. Check ?apiKey= query parameter (for browser SSE eventsource connections)
  const paramKey = url.searchParams.get('apiKey') || url.searchParams.get('api_key') || url.searchParams.get('token');
  if (paramKey && paramKey === targetKey) {
    return true;
  }

  return false;
}
