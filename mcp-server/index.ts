import http from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  handleGetAcademicOverview,
  handleParseAndIngestSyllabus,
  handleFindCrossSubjectSynergies,
  handleIngestAcademicEnrollment,
} from './tools-handler';

const server = new Server(
  {
    name: 'pure-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_academic_overview',
        description: 'Retorna el resumen académico global, tiempo libre neto, promedios por carrera y alertas urgentes.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'ingest_academic_enrollment',
        description: 'Procesa e ingesta la matrícula real del estudiante (materias Nivel I, créditos, grupos y horarios con aulas asignadas).',
        inputSchema: {
          type: 'object',
          properties: {
            raw_text: { type: 'string', description: 'Texto de las materias y horarios matriculados' },
          },
        },
      },
      {
        name: 'parse_and_ingest_syllabus',
        description: 'Recibe un texto/PDF de temario y lo convierte en árbol jerárquico de ejes temáticos para la asignatura.',
        inputSchema: {
          type: 'object',
          properties: {
            subject_id: { type: 'string', description: 'ID de la asignatura' },
            raw_text: { type: 'string', description: 'Texto plano del temario o plan de estudios' },
          },
          required: ['subject_id', 'raw_text'],
        },
      },
      {
        name: 'find_cross_subject_synergies',
        description: 'Escanea temarios de Ingeniería Aeroespacial e Ingeniería de Software y devuelve coincidencias temáticas para fusionar estudio.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_academic_overview': {
      const overview = handleGetAcademicOverview();
      return {
        content: [{ type: 'text', text: JSON.stringify(overview, null, 2) }],
      };
    }

    case 'ingest_academic_enrollment': {
      const { raw_text } = (args || {}) as { raw_text?: string };
      const result = handleIngestAcademicEnrollment(raw_text);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    case 'parse_and_ingest_syllabus': {
      const { subject_id, raw_text } = args as { subject_id: string; raw_text: string };
      const result = handleParseAndIngestSyllabus(subject_id, raw_text);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    case 'find_cross_subject_synergies': {
      const synergies = handleFindCrossSubjectSynergies();
      return {
        content: [{ type: 'text', text: JSON.stringify(synergies, null, 2) }],
      };
    }

    default:
      throw new Error(`Herramienta MCP no reconocida: ${name}`);
  }
});

async function main() {
  const port = Number(process.env.MCP_PORT || 3001);
  const requiredToken = process.env.MCP_AUTH_TOKEN;

  // Session storage map for concurrent SSE client connections
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    // Set CORS Headers for Claude Web & external web agents
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = req.headers.host || `localhost:${port}`;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${hostHeader}`;
    const url = new URL(req.url || '/', baseUrl);

    // --- OAUTH 2.0 & RFC 7591 DYNAMIC CLIENT REGISTRATION ENDPOINTS ---

    // OAuth Authorization Server Metadata (RFC 8414 / OpenID Discovery)
    if (
      url.pathname === '/.well-known/oauth-authorization-server' ||
      url.pathname === '/.well-known/openid-configuration'
    ) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/oauth/authorize`,
          token_endpoint: `${baseUrl}/oauth/token`,
          registration_endpoint: `${baseUrl}/oauth/register`,
          scopes_supported: ['mcp'],
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          token_endpoint_auth_methods_supported: ['client_secret_post', 'none', 'client_secret_basic'],
        })
      );
      return;
    }

    // Dynamic Client Registration (RFC 7591 for Claude Custom Connectors)
    if ((url.pathname === '/oauth/register' || url.pathname === '/register') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const json = JSON.parse(body || '{}');
          const clientId = `pure_client_${Date.now()}`;
          const clientSecret = `pure_secret_${Math.random().toString(36).substring(2)}`;

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              client_name: json.client_name || 'Claude Custom Connector',
              redirect_uris: json.redirect_uris || ['https://claude.ai/oauth/callback'],
              grant_types: ['authorization_code'],
              response_types: ['code'],
            })
          );
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    // OAuth Authorization Endpoint
    if (url.pathname === '/oauth/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri') || 'https://claude.ai/oauth/callback';
      const state = url.searchParams.get('state') || '';
      const authCode = `pure_code_${Date.now()}`;

      const redirectTarget = `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}code=${authCode}&state=${encodeURIComponent(state)}`;
      res.writeHead(302, { Location: redirectTarget });
      res.end();
      return;
    }

    // OAuth Token Exchange Endpoint
    if (url.pathname === '/oauth/token' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          access_token: requiredToken || 'pure_access_token_2026',
          token_type: 'Bearer',
          expires_in: 315360000,
        })
      );
      return;
    }

    // Healthcheck endpoint (Unauthenticated)
    if (url.pathname === '/' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          server: 'pure-mcp-server',
          activeSessions: transports.size,
          endpoints: ['/sse', '/messages', '/api/mcp', '/oauth/register', '/.well-known/oauth-authorization-server'],
        })
      );
      return;
    }

    // Optional Bearer Token Authentication check (bypassed for OAuth endpoints & Health)
    if (requiredToken && requiredToken.trim() !== '') {
      const authHeader = req.headers.authorization;
      const expectedAuth = `Bearer ${requiredToken}`;

      if (!authHeader || authHeader !== expectedAuth) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid Bearer token' }));
        return;
      }
    }

    // SSE Connection Endpoint (Claude Web & MCP Clients)
    if (url.pathname === '/sse') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);

      transport.onclose = () => {
        transports.delete(transport.sessionId);
      };

      await server.connect(transport);
      return;
    }

    // JSON-RPC Message Handling Endpoint for SSE Sessions
    if (url.pathname === '/messages') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request: missing sessionId query parameter' }));
        return;
      }

      const transport = transports.get(sessionId);
      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Session not found: ${sessionId}` }));
        return;
      }

      await transport.handlePostMessage(req, res);
      return;
    }

    // REST Direct API Endpoint fallback
    if (url.pathname === '/api/mcp' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const json = JSON.parse(body || '{}');
          const toolName = json.tool || json.name;
          const toolArgs = json.args || json.arguments || {};

          let responseData: any;
          if (toolName === 'get_academic_overview') {
            responseData = handleGetAcademicOverview();
          } else if (toolName === 'ingest_academic_enrollment') {
            responseData = handleIngestAcademicEnrollment(toolArgs.raw_text);
          } else if (toolName === 'parse_and_ingest_syllabus') {
            responseData = handleParseAndIngestSyllabus(toolArgs.subject_id, toolArgs.raw_text);
          } else if (toolName === 'find_cross_subject_synergies') {
            responseData = handleFindCrossSubjectSynergies();
          } else {
            responseData = { error: `Herramienta MCP no reconocida: ${toolName}` };
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseData));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  });

  httpServer.listen(port, () => {
    console.error(`Servidor MCP HTTP/SSE listo para Claude Web y Agentes en http://0.0.0.0:${port}/sse`);
  });

  // Also support STDIO fallback if executed in CLI context
  if (process.env.MCP_STDIO === 'true') {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('Servidor MCP de Pure conectado vía stdio');
  }
}

main().catch((err) => {
  console.error('Error fatal en el Servidor MCP de Pure:', err);
  process.exit(1);
});
