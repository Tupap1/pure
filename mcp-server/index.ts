import 'dotenv/config';
import http from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { validateMcpAuth } from './auth-middleware';
import { handleHealthCheck } from './health-handler';
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

export function createMcpServerInstance() {
  const mcpServer = new McpServer(
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

  // Register all 10 tools using modern McpServer tool() API
  mcpServer.tool('get_academic_overview', 'Retorna el resumen académico global, tiempo libre neto y promedios por carrera.', {}, async () => {
    const res = await handleGetAcademicOverview();
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('ingest_academic_enrollment', 'Procesa e ingesta la matrícula real del estudiante.', { raw_text: z.string() }, async ({ raw_text }) => {
    const res = await handleIngestAcademicEnrollment(raw_text);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('parse_and_ingest_syllabus', 'Recibe un texto de temario y lo convierte en árbol de ejes temáticos.', { subject_id: z.string(), raw_text: z.string() }, async ({ subject_id, raw_text }) => {
    const res = await handleParseAndIngestSyllabus(subject_id, raw_text);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('find_cross_subject_synergies', 'Escanea temarios de Ingeniería Aeroespacial e Ingeniería de Software.', {}, async () => {
    const res = await handleFindCrossSubjectSynergies();
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_universities', 'Operaciones CRUD sobre Universidades.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageUniversities(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_professors', 'Operaciones CRUD sobre Profesores.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageProfessors(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_subjects', 'Operaciones CRUD sobre Asignaturas.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageSubjects(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_schedules', 'Operaciones CRUD sobre Horarios y Aulas de clase.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageSchedules(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_deliverables', 'Operaciones CRUD sobre Entregables / Parciales.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageDeliverables(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_syllabus_topics', 'Operaciones CRUD sobre Ejes Temáticos.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = await handleManageSyllabusTopics(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  return mcpServer;
}

async function main() {
  const port = Number(process.env.MCP_PORT || 3001);
  const secretKey = process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN;

  if (!secretKey) {
    console.warn('⚠️ ADVERTENCIA: MCP_API_KEY / MCP_AUTH_TOKEN no está configurado en el entorno.');
  }

  // We will maintain a map of active SSE transports
  const activeTransports = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    // 1. Set CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${port}`;
    const protocol = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
    const baseUrl = process.env.PUBLIC_MCP_URL ? process.env.PUBLIC_MCP_URL.replace(/\/$/, '') : `${protocol}://${hostHeader}`;

    const url = new URL(req.url || '/', baseUrl);
    const normalizedPath = url.pathname.replace(/\/$/, '') || '/';

    // 2. Health check GET /health
    if (normalizedPath.endsWith('/health')) {
      return handleHealthCheck(req, res);
    }

    // 3. Mock OAuth 2.0 Endpoints for Claude Web Custom Connectors
    // Claude Web enforces OAuth 2.0. We use a mock flow that securely validates the API Key as the client_secret.
    if (
      normalizedPath.endsWith('/.well-known/oauth-authorization-server') ||
      normalizedPath.endsWith('/.well-known/openid-configuration')
    ) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256', 'plain']
      }));
      return;
    }

    if (normalizedPath.endsWith('/oauth/authorize')) {
      const redirectUri = url.searchParams.get('redirect_uri');
      const state = url.searchParams.get('state') || '';
      if (!redirectUri) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing redirect_uri' }));
        return;
      }
      // Auto-approve and redirect back with a fake code
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('code', 'mock_auth_code_123');
      redirectUrl.searchParams.set('state', state);
      res.writeHead(302, { Location: redirectUrl.toString() });
      res.end();
      return;
    }

    if (normalizedPath.endsWith('/oauth/token')) {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        let clientSecret = '';
        
        // Extract client_secret depending on content type
        if (req.headers['content-type']?.includes('application/json')) {
          try {
            const json = JSON.parse(body);
            clientSecret = json.client_secret || '';
          } catch (e) {}
        } else {
          // urlencoded
          const params = new URLSearchParams(body);
          clientSecret = params.get('client_secret') || '';
        }
        
        // Basic Auth fallback (Claude might send Basic auth header instead of client_secret in body)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
          const b64 = authHeader.split(' ')[1];
          const decoded = Buffer.from(b64, 'base64').toString();
          const [id, secret] = decoded.split(':');
          if (secret) clientSecret = secret;
        }

        // Securely validate the provided secret against our MCP_API_KEY
        if (secretKey && clientSecret !== secretKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_client', error_description: 'Client secret does not match MCP_API_KEY' }));
          return;
        }

        // Success! Return the API Key as the access token so Claude uses it via Bearer Auth
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          access_token: secretKey || 'public_token',
          token_type: 'Bearer',
          expires_in: 31536000 // 1 year
        }));
      });
      return;
    }

    // 4. Root information GET /
    if ((normalizedPath === '/' || normalizedPath.endsWith('/mcp')) && req.method === 'GET' && !req.headers.accept?.includes('text/event-stream')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          server: 'pure-mcp-server',
          version: '1.0.0',
          message: 'Servidor MCP de Pure Academic activo.',
          endpoints: {
            health: `${baseUrl}/health`,
            sse: `${baseUrl}/sse`,
            mcp: `${baseUrl}/mcp`,
          },
        })
      );
      return;
    }

    // 5. Authentication check for protected routes (/sse, /mcp, /messages)
    if (!validateMcpAuth(req, secretKey)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Missing or invalid Bearer token / API Key' }));
      return;
    }

    // 6. Handle SSE connections
    if (normalizedPath.endsWith('/sse')) {
      const searchParams = url.search ? url.search : '';
      // Resolve the /messages endpoint relative to the incoming request path
      // This ensures that whatever prefix Cloudflare used (e.g. /mcp/sse) is preserved as /mcp/messages
      const basePath = url.pathname.replace(/\/sse$/, '');
      const messagesPath = `${basePath}/messages${searchParams}`;
      
      const transport = new SSEServerTransport(messagesPath, res);
      
      // CREATE A NEW MCP SERVER INSTANCE PER CONNECTION
      const mcpServer = createMcpServerInstance();
      await mcpServer.connect(transport);
      
      const sid = transport.sessionId;
      activeTransports.set(sid, transport);
      transport.onclose = () => activeTransports.delete(sid);
      transport.onerror = () => activeTransports.delete(sid);
      
      return;
    }

    // 7. Handle messages
    if (normalizedPath.endsWith('/messages')) {
      const sessionId = url.searchParams.get('sessionId') || req.headers['mcp-session-id'];
      if (!sessionId || typeof sessionId !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing sessionId parameter' }));
        return;
      }
      
      const transport = activeTransports.get(sessionId);
      if (!transport) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }
      
      await transport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  });

  httpServer.listen(port, () => {
    console.error(`====================================================`);
    console.error(`🚀 Servidor MCP de Pure listo en http://0.0.0.0:${port}`);
    console.error(`🔑 Autenticación API Key activada: ${secretKey ? secretKey.substring(0, 10) + '...' : 'SIN CLAVE CONFIGURADA'}`);
    console.error(`🏥 Endpoint de Salud: http://0.0.0.0:${port}/health`);
    console.error(`====================================================`);
  });

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
