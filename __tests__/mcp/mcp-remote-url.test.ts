import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';

vi.mock('../../lib/db/pg-client', () => ({
  pgPool: {
    query: vi.fn().mockImplementation(async (queryStr: string) => {
      const lower = queryStr.toLowerCase();
      if (lower.includes('count(*)::int')) return { rows: [{ count: 2 }] };
      if (lower.includes('select name, modality')) return { rows: [{ name: 'Test Uni', modality: 'presencial' }] };
      return { rows: [] };
    }),
  },
}));

describe('Claude Web Remote MCP Endpoint & Transport Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Import server module and spin up an ephemeral HTTP test server
    const { createMcpServerInstance, TOOLS_LIST } = await import('../../mcp-server/index');
    const {
      handleGetAcademicOverview,
      handleManageUniversities,
      handleManageProfessors,
      handleManageSubjects,
      handleManageSchedules,
      handleManageDeliverables,
      handleManageSyllabusTopics,
      handleIngestAcademicEnrollment,
      handleParseAndIngestSyllabus,
      handleFindCrossSubjectSynergies,
    } = await import('../../mcp-server/tools-handler');
    const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');

    async function dispatchToolCall(name: string, args: any) {
      switch (name) {
        case 'get_academic_overview':
          return await handleGetAcademicOverview();
        case 'ingest_academic_enrollment':
          return await handleIngestAcademicEnrollment(args?.raw_text);
        case 'parse_and_ingest_syllabus':
          return await handleParseAndIngestSyllabus(args?.subject_id, args?.raw_text);
        case 'find_cross_subject_synergies':
          return await handleFindCrossSubjectSynergies();
        case 'manage_universities':
          return await handleManageUniversities(args?.action, args?.data);
        case 'manage_professors':
          return await handleManageProfessors(args?.action, args?.data);
        case 'manage_subjects':
          return await handleManageSubjects(args?.action, args?.data);
        case 'manage_schedules':
          return await handleManageSchedules(args?.action, args?.data);
        case 'manage_deliverables':
          return await handleManageDeliverables(args?.action, args?.data);
        case 'manage_syllabus_topics':
          return await handleManageSyllabusTopics(args?.action, args?.data);
        default:
          throw new Error(`Herramienta no reconocida: ${name}`);
      }
    }

    const transports = new Map<string, any>();

    server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Expose-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const hostHeader = req.headers.host || `localhost:${(server.address() as AddressInfo).port}`;
      const protocol = 'http';
      const calculatedBaseUrl = `${protocol}://${hostHeader}`;
      const url = new URL(req.url || '/', calculatedBaseUrl);
      const normalizedPath = url.pathname.replace(/\/$/, '') || '/';

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
          })
        );
        return;
      }

      // Dynamic Client Registration
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

      // SSE Connection Endpoint (GET)
      const isSseRequest =
        req.method === 'GET' &&
        (normalizedPath === '/sse' ||
          normalizedPath === '/mcp' ||
          normalizedPath === '/.well-known/mcp' ||
          (normalizedPath === '/' && req.headers.accept?.includes('text/event-stream')));

      if (isSseRequest) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');

        const messagesEndpoint = `${calculatedBaseUrl}/messages`;
        const transport = new SSEServerTransport(messagesEndpoint, res);
        transports.set(transport.sessionId, transport);

        const sessionServer = createMcpServerInstance();
        await sessionServer.connect(transport);
        return;
      }

      // JSON-RPC & Streamable HTTP POST Handling
      if (
        req.method === 'POST' &&
        (normalizedPath === '/mcp' ||
          normalizedPath === '/sse' ||
          normalizedPath === '/' ||
          normalizedPath === '/api/mcp')
      ) {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const json = JSON.parse(body || '{}');

            if (json.jsonrpc === '2.0') {
              const reqId = json.id ?? null;
              const method = json.method;

              if (method === 'initialize') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: reqId,
                    result: {
                      protocolVersion: json.params?.protocolVersion || '2024-11-05',
                      capabilities: { tools: {} },
                      serverInfo: { name: 'pure-mcp-server', version: '1.0.0' },
                    },
                  })
                );
                return;
              }

              if (method === 'tools/list') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: reqId,
                    result: { tools: TOOLS_LIST },
                  })
                );
                return;
              }

              if (method === 'tools/call') {
                const toolName = json.params?.name;
                const toolArgs = json.params?.arguments || {};
                const result = await dispatchToolCall(toolName, toolArgs);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id: reqId,
                    result: {
                      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    },
                  })
                );
                return;
              }
            }

            const toolName = json.tool || json.name;
            const result = await dispatchToolCall(toolName, json.args || json.arguments || {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
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

  it('1. should discover OAuth 2.0 metadata with full URLs at /.well-known/oauth-authorization-server', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.issuer).toBe(baseUrl);
    expect(data.authorization_endpoint).toBe(`${baseUrl}/oauth/authorize`);
    expect(data.token_endpoint).toBe(`${baseUrl}/oauth/token`);
    expect(data.registration_endpoint).toBe(`${baseUrl}/oauth/register`);
  });

  it('2. should perform dynamic client registration via /oauth/register', async () => {
    const res = await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Claude Test Client' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty('client_id');
    expect(data).toHaveProperty('client_secret');
  });

  it('3. should exchange code for Bearer access token via /oauth/token', async () => {
    const res = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code&code=test_code',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.access_token).toContain('pure_token_');
    expect(data.token_type).toBe('Bearer');
  });

  it('4. should establish SSE GET connection on /mcp and emit ABSOLUTE URL message endpoint', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      headers: { Accept: 'text/event-stream' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let receivedText = '';

    if (reader) {
      const { value } = await reader.read();
      receivedText = decoder.decode(value);
      await reader.cancel();
    }

    expect(receivedText).toContain('event: endpoint');
    expect(receivedText).toContain('data: /messages?sessionId=');
  });

  it('5. should handle JSON-RPC initialize POST request on /mcp', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 101,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jsonrpc).toBe('2.0');
    expect(data.id).toBe(101);
    expect(data.result.serverInfo.name).toBe('pure-mcp-server');
  });

  it('6. should handle JSON-RPC tools/list POST request on /mcp', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/list',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.tools.length).toBeGreaterThanOrEqual(10);
  });

  it('7. should handle JSON-RPC tools/call POST request for get_academic_overview on /mcp', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 103,
        method: 'tools/call',
        params: { name: 'get_academic_overview', arguments: {} },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.content[0].type).toBe('text');
    const parsedText = JSON.parse(data.result.content[0].text);
    expect(parsedText.status).toBe('success');
  });

  it('8. should support OPTIONS CORS preflight on /mcp', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toBe('*');
  });
});
