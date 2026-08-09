import { IncomingMessage, ServerResponse } from 'http';
import { pgPool } from '../lib/db/pg-client';

const startTime = Date.now();
const SERVER_VERSION = '1.0.0';

export async function handleHealthCheck(req: IncomingMessage, res: ServerResponse) {
  let isDbConnected = false;
  try {
    const dbRes = await pgPool.query('SELECT 1');
    if (dbRes.rowCount && dbRes.rowCount > 0) {
      isDbConnected = true;
    }
  } catch (err) {
    isDbConnected = false;
  }

  const payload = {
    status: isDbConnected ? 'ok' : 'degraded',
    server: 'pure-mcp-server',
    version: SERVER_VERSION,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    database: {
      connected: isDbConnected,
      provider: 'postgresql',
    },
    endpoints: {
      health: '/health',
      sse: '/sse',
      mcp: '/mcp',
    },
  };

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload, null, 2));
}
