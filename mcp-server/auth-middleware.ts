import { IncomingMessage } from 'http';
import { globalOAuthStore, OAuthStore } from './oauth-store';

export function validateMcpAuth(
  req: IncomingMessage,
  secretKey?: string,
  oauthStore: OAuthStore = globalOAuthStore
): boolean {
  const rawKey = secretKey || process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN;
  const targetKey = rawKey ? rawKey.trim() : undefined;

  // 1. Allow public health check GET /health ONLY
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return true;
  }

  // 2. Allow CORS preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return true;
  }

  // Extract token candidate
  let tokenCandidate: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      tokenCandidate = parts[1].trim();
    }
  }

  if (!tokenCandidate) {
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      tokenCandidate = apiKeyHeader.trim();
    }
  }

  if (!tokenCandidate) {
    const paramKey = url.searchParams.get('apiKey') || url.searchParams.get('api_key') || url.searchParams.get('token');
    if (paramKey) {
      tokenCandidate = paramKey.trim();
    }
  }

  if (!tokenCandidate) {
    return false;
  }

  // 3. Match against direct master secret key
  if (targetKey && tokenCandidate === targetKey) {
    return true;
  }

  // 4. Match against issued OAuth access tokens
  if (oauthStore.isValidAccessToken(tokenCandidate)) {
    return true;
  }

  return false;
}
