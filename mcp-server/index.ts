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

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Healthcheck endpoint (Unauthenticated)
    if (url.pathname === '/' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          server: 'pure-mcp-server',
          activeSessions: transports.size,
          endpoints: ['/sse', '/messages', '/api/mcp'],
        })
      );
      return;
    }

    // Optional Bearer Token Authentication check
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
