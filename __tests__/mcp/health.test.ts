import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';

describe('MCP Server Health Check Endpoint (GET /health)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Ephemeral HTTP server simulating mcp-server/index.ts health logic
    const { handleHealthCheck } = await import('../../mcp-server/health-handler');

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === '/health') {
        return handleHealthCheck(req, res);
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

  it('should return HTTP 200 OK with server status, version, uptime, and database details', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = await res.json();
    expect(['ok', 'degraded']).toContain(data.status);
    expect(data.server).toBe('pure-mcp-server');
    expect(data.version).toBe('1.0.0');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('uptimeSeconds');
    expect(data.database).toBeDefined();
    expect(data.endpoints).toEqual({
      health: '/health',
      sse: '/sse',
      mcp: '/mcp',
    });
  });
});
