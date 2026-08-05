import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
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
    description: 'Procesa e ingesta la matrícula real del estudiante (materias Nivel I, créditos, grupos y horarios con aulas asignadas).',
    inputSchema: {
      type: 'object',
      properties: {
        raw_text: { type: 'string', description: 'Texto o JSON estructurado de materias, horarios y aulas' },
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS_LIST };
});

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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = executeToolCall(name, args);
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

async function main() {
  const isHttpMode = process.argv.includes('--http') || Boolean(process.env.MCP_PORT);

  if (isHttpMode) {
    const app = express();
    app.use(cors({ origin: '*' }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Status endpoint
    app.get('/', (req, res) => {
      res.json({
        status: 'active',
        name: 'pure-mcp-server',
        version: '1.0.0',
        sse_endpoint: '/sse',
        message_endpoint: '/message',
        streamable_http_endpoint: '/mcp',
        auth_required: false,
      });
    });

    // Zero-Auth Auto-Approval OAuth endpoints for Claude.ai Custom Connectors (RFC 7591 / RFC 8414)
    const getBaseUrl = (req: express.Request) => {
      const host = req.get('host') || 'mcp.btw-one.com';
      const protocol = req.get('x-forwarded-proto') || 'https';
      return `${protocol}://${host}`;
    };

    // Metadata Discovery (RFC 8414 & OpenID Connect)
    app.get(
      [
        '/.well-known/oauth-authorization-server',
        '/.well-known/oauth-authorization-server/',
        '/.well-known/openid-configuration',
        '/.well-known/openid-configuration/',
      ],
      (req, res) => {
        const baseUrl = getBaseUrl(req);
        res.json({
          issuer: baseUrl,
          authorization_endpoint: `${baseUrl}/authorize`,
          token_endpoint: `${baseUrl}/token`,
          registration_endpoint: `${baseUrl}/register`,
          scopes_supported: ['mcp:full_access', 'read', 'write', 'openid'],
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256', 'plain'],
          token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
        });
      }
    );

    // RFC 7591 Dynamic Client Registration
    app.all('/register', (req, res) => {
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }

      const redirectUris = req.body?.redirect_uris || req.query?.redirect_uris || [];
      const clientName = req.body?.client_name || 'Claude.ai Pure Connector';
      const clientId = `pure-client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const clientSecret = `pure-secret-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      return res.status(201).json({
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0,
        client_name: clientName,
        redirect_uris: Array.isArray(redirectUris) ? redirectUris : [redirectUris],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      });
    });

    // Auto-Approval Authorization Endpoint
    app.all('/authorize', (req, res) => {
      const redirectUri = (req.query.redirect_uri || req.body?.redirect_uri) as string;
      const state = (req.query.state || req.body?.state || '') as string;
      const code = `pure_auto_code_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      if (redirectUri) {
        const separator = redirectUri.includes('?') ? '&' : '?';
        const targetUrl = `${redirectUri}${separator}code=${code}&state=${encodeURIComponent(state)}`;
        return res.redirect(302, targetUrl);
      }

      return res.send('OAuth Auto-Approved');
    });

    // Token Exchange Endpoint
    app.all(['/token', '/oauth/token'], (req, res) => {
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }

      return res.json({
        access_token: `pure_access_token_${Date.now()}`,
        token_type: 'Bearer',
        expires_in: 31536000,
        refresh_token: `pure_refresh_token_${Date.now()}`,
        scope: 'mcp:full_access',
      });
    });

    // 1. Streamable HTTP Transport (JSON-RPC 2.0)
    app.post(['/', '/mcp'], async (req, res) => {
      const { jsonrpc, id, method, params } = req.body || {};

      if (jsonrpc !== '2.0') {
        return res.status(400).json({ jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request' } });
      }

      if (method === 'initialize') {
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: params?.protocolVersion || '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'pure-mcp-server', version: '1.0.0' },
          },
        });
      }

      if (method === 'notifications/initialized') {
        return res.status(200).send();
      }

      if (method === 'tools/list') {
        return res.json({
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS_LIST },
        });
      }

      if (method === 'tools/call') {
        const { name, arguments: args } = params || {};
        try {
          const resultData = executeToolCall(name, args);
          return res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(resultData, null, 2) }],
            },
          });
        } catch (err: any) {
          return res.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: err.message },
          });
        }
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    });

    // 2. Legacy SSE Transport (Server-Sent Events)
    const sseTransportsMap = new Map<string, SSEServerTransport>();

    app.get('/sse', async (req, res) => {
      try {
        const transport = new SSEServerTransport('/message', res);
        sseTransportsMap.set(transport.sessionId, transport);

        req.on('close', () => {
          sseTransportsMap.delete(transport.sessionId);
        });

        await server.connect(transport);
      } catch (err) {
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error al iniciar SSE' });
        }
      }
    });

    app.post('/message', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = sessionId ? sseTransportsMap.get(sessionId) : Array.from(sseTransportsMap.values())[0];

      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(400).json({ error: 'No hay conexión SSE activa para el sessionId indicado' });
      }
    });

    const PORT = process.env.MCP_PORT || 3001;
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Servidor MCP HTTP/SSE escuchando en http://0.0.0.0:${PORT}/sse y http://0.0.0.0:${PORT}/mcp`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Servidor MCP de Pure conectado exitosamente vía stdio');
  }
}

main().catch((err) => {
  console.error('Error fatal en el Servidor MCP de Pure:', err);
  process.exit(1);
});
