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

const TOOLS_LIST = [
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
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS_LIST };
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

    // Zero-Auth Auto-Approval OAuth endpoints for Claude.ai Custom Connectors
    const getBaseUrl = (req: express.Request) => {
      const host = req.get('host') || 'mcp.btw-one.com';
      const protocol = req.get('x-forwarded-proto') || 'https';
      return `${protocol}://${host}`;
    };

    app.get(['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration'], (req, res) => {
      const baseUrl = getBaseUrl(req);
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/authorize`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256', "plain"],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      });
    });

    // Dynamic Client Registration (RFC 7591)
    app.post('/register', (req, res) => {
      res.status(201).json({
        client_id: 'pure-auto-client-id',
        client_secret: 'pure-auto-client-secret',
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: 'Claude.ai Pure Connector',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        redirect_uris: req.body?.redirect_uris || [],
      });
    });

    // Auto-Approve Authorize Route (No login form needed)
    app.get('/authorize', (req, res) => {
      const redirectUri = req.query.redirect_uri as string;
      const state = req.query.state as string;
      if (redirectUri) {
        const separator = redirectUri.includes('?') ? '&' : '?';
        const targetUrl = `${redirectUri}${separator}code=pure_auto_approved_code&state=${encodeURIComponent(state || '')}`;
        return res.redirect(302, targetUrl);
      }
      return res.send('OAuth Auto-Approved');
    });

    // Auto-Approve Token Route
    app.post('/token', (req, res) => {
      res.json({
        access_token: 'pure_access_token_granted',
        token_type: 'Bearer',
        expires_in: 31536000,
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
          let resultData: any;
          if (name === 'get_academic_overview') {
            resultData = handleGetAcademicOverview();
          } else if (name === 'ingest_academic_enrollment') {
            resultData = handleIngestAcademicEnrollment(args?.raw_text);
          } else if (name === 'parse_and_ingest_syllabus') {
            resultData = handleParseAndIngestSyllabus(args?.subject_id, args?.raw_text);
          } else if (name === 'find_cross_subject_synergies') {
            resultData = handleFindCrossSubjectSynergies();
          } else {
            return res.json({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Tool not found: ${name}` },
            });
          }

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
            error: { code: -32603, message: err.message },
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
        console.log('Conexión MCP SSE recibida desde agente externo:', req.ip);
        const transport = new SSEServerTransport('/message', res);
        sseTransportsMap.set(transport.sessionId, transport);

        req.on('close', () => {
          console.log(`Sesión MCP SSE cerrada: ${transport.sessionId}`);
          sseTransportsMap.delete(transport.sessionId);
        });

        await server.connect(transport);
      } catch (err) {
        console.error('Error fatal al iniciar conexion SSE:', err);
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
