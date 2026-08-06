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
  handleManageUniversities,
  handleManageProfessors,
  handleManageSubjects,
  handleManageSchedules,
  handleManageDeliverables,
  handleManageSyllabusTopics,
} from './tools-handler';

export const TOOLS_LIST = [
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
    description: 'Procesa e ingesta la matrícula real del estudiante (materias Nivel I, créditos, grupos y horarios con aulas asignadas). Debe proporcionar raw_text con los datos.',
    inputSchema: {
      type: 'object',
      properties: {
        raw_text: { type: 'string', description: 'Texto o JSON estructurado de materias y horarios matriculados' },
      },
      required: ['raw_text'],
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
  {
    name: 'manage_universities',
    description: 'Operaciones CRUD sobre Universidades (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos de la universidad (id, name, modality, scale_min, scale_max, passing_grade, color)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_professors',
    description: 'Operaciones CRUD sobre Profesores (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del profesor (id, university_id, name, email, office_hours, notes)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_subjects',
    description: 'Operaciones CRUD sobre Asignaturas / Materias (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos de la materia (id, university_id, professor_id, name, code, credits, difficulty, target_grade)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_schedules',
    description: 'Operaciones CRUD sobre Horarios y Aulas de clase (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del horario (id, subject_id, day_of_week, start_time, end_time, classroom)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_deliverables',
    description: 'Operaciones CRUD sobre Entregables / Parciales / Tareas (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del entregable (id, subject_id, title, due_date, weight_percentage, grade, type, status)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_syllabus_topics',
    description: 'Operaciones CRUD sobre Temarios y Ejes Temáticos (crear, leer, actualizar, eliminar).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'read', 'update', 'delete'] },
        data: { type: 'object', description: 'Datos del tema (id, subject_id, parent_id, title, description, mastery_status, order_index)' },
      },
      required: ['action'],
    },
  },
];

export function executeToolCall(name: string, args: any) {
  switch (name) {
    case 'get_academic_overview':
      return handleGetAcademicOverview();
    case 'ingest_academic_enrollment':
      return handleIngestAcademicEnrollment(args?.raw_text);
    case 'parse_and_ingest_syllabus':
      return handleParseAndIngestSyllabus(args?.subject_id, args?.raw_text);
    case 'find_cross_subject_synergies':
      return handleFindCrossSubjectSynergies();
    case 'manage_universities':
      return handleManageUniversities(args?.action, args?.data);
    case 'manage_professors':
      return handleManageProfessors(args?.action, args?.data);
    case 'manage_subjects':
      return handleManageSubjects(args?.action, args?.data);
    case 'manage_schedules':
      return handleManageSchedules(args?.action, args?.data);
    case 'manage_deliverables':
      return handleManageDeliverables(args?.action, args?.data);
    case 'manage_syllabus_topics':
      return handleManageSyllabusTopics(args?.action, args?.data);
    default:
      throw new Error(`Herramienta MCP no reconocida: ${name}`);
  }
}

export function createMcpServerInstance() {
  const mcpServer = new Server(
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

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS_LIST };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = executeToolCall(name, args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  });

  return mcpServer;
}

async function main() {
  const port = Number(process.env.MCP_PORT || 3001);
  const requiredToken = process.env.MCP_AUTH_TOKEN;

  // Session storage map for concurrent SSE client connections
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    // Set CORS Headers for Claude Web & external web agents
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let baseUrl: string;
    if (process.env.PUBLIC_MCP_URL) {
      baseUrl = process.env.PUBLIC_MCP_URL.replace(/\/$/, '');
    } else {
      const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${port}`;
      const protocol = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
      baseUrl = `${protocol}://${hostHeader}`;
    }

    const url = new URL(req.url || '/', baseUrl);

    // OpenID / OAuth Authorization Discovery
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

    // Dynamic Client Registration (RFC 7591)
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
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // OAuth Authorization Code Redirect
    if (url.pathname === '/oauth/authorize' || url.pathname === '/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri') || 'https://claude.ai/oauth/callback';
      const state = url.searchParams.get('state') || '';
      const separator = redirectUri.includes('?') ? '&' : '?';
      const targetUrl = `${redirectUri}${separator}code=pure_auto_code_${Date.now()}&state=${encodeURIComponent(state)}`;
      res.writeHead(302, { Location: targetUrl });
      res.end();
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
          scope: 'mcp',
        })
      );
      return;
    }

    // Health Check Endpoint & Root Status Fallback
    if (url.pathname === '/health' || (url.pathname === '/' && req.method === 'GET' && !req.headers.accept?.includes('text/event-stream'))) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          server: 'pure-mcp-server',
          activeSessions: transports.size,
          endpoints: ['/', '/sse', '/mcp', '/messages', '/api/mcp', '/oauth/register', '/.well-known/oauth-authorization-server'],
        })
      );
      return;
    }

    // Optional Bearer Token Authentication check
    if (requiredToken && requiredToken.trim() !== '') {
      const authHeader = req.headers.authorization;
      const expectedAuth = `Bearer ${requiredToken}`;
      const isOAuthToken = authHeader?.startsWith('Bearer pure_token_') || authHeader?.startsWith('Bearer ');

      if (!authHeader || (authHeader !== expectedAuth && !isOAuthToken)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid Bearer token' }));
        return;
      }
    }

    // SSE Connection Endpoint (Claude Web & MCP Clients GET)
    const normalizedPath = url.pathname.replace(/\/$/, '') || '/';
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
      res.setHeader('X-Accel-Buffering', 'no');

      // Use absolute URL endpoint so remote clients (Claude Web) receive exact target POST URL
      const messagesEndpoint = `${baseUrl}/messages`;
      const transport = new SSEServerTransport(messagesEndpoint, res);
      transports.set(transport.sessionId, transport);

      transport.onclose = () => {
        transports.delete(transport.sessionId);
      };

      const sessionServer = createMcpServerInstance();
      await sessionServer.connect(transport);
      return;
    }

    // JSON-RPC Message Handling Endpoint for Active SSE Sessions
    if (normalizedPath === '/messages' && url.searchParams.has('sessionId') && req.method === 'POST') {
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

    // Streamable HTTP JSON-RPC & REST Message Handling Endpoint (Claude Web HTTP POST & REST)
    if (
      req.method === 'POST' &&
      (normalizedPath === '/mcp' ||
        normalizedPath === '/sse' ||
        normalizedPath === '/' ||
        normalizedPath === '/api/mcp' ||
        (normalizedPath === '/messages' && !url.searchParams.has('sessionId')))
    ) {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const json = JSON.parse(body || '{}');

          // JSON-RPC 2.0 Handling (Streamable HTTP MCP Transport)
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

            if (method === 'notifications/initialized') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', id: reqId, result: {} }));
              return;
            }

            if (method === 'ping') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', id: reqId, result: {} }));
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
              const result = executeToolCall(toolName, toolArgs);

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

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id: reqId,
                error: { code: -32601, message: `Método JSON-RPC no soportado: ${method}` },
              })
            );
            return;
          }

          // Direct REST Fallback Handling
          const toolName = json.tool || json.name;
          const toolArgs = json.args || json.arguments || {};
          const result = executeToolCall(toolName, toolArgs);

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
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  });

  httpServer.listen(port, () => {
    console.error(`Servidor MCP HTTP/SSE listo para Claude Web y Agentes en http://0.0.0.0:${port}/sse`);
  });

  // Also support STDIO fallback if executed in CLI context
  if (process.env.MCP_STDIO === 'true') {
    const stdioTransport = new StdioServerTransport();
    const instance = createMcpServerInstance();
    await instance.connect(stdioTransport);
    console.error('Servidor MCP de Pure conectado vía stdio');
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Error fatal en el Servidor MCP de Pure:', err);
    process.exit(1);
  });
}
