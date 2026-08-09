import http from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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
import {
  saveUniversityToDb,
  saveSubjectToDb,
  saveScheduleToDb,
  saveDeliverableToDb,
} from './db-repository';

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
  let result: any;
  switch (name) {
    case 'get_academic_overview':
      result = handleGetAcademicOverview();
      break;
    case 'ingest_academic_enrollment':
      result = handleIngestAcademicEnrollment(args?.raw_text);
      break;
    case 'parse_and_ingest_syllabus':
      result = handleParseAndIngestSyllabus(args?.subject_id, args?.raw_text);
      break;
    case 'find_cross_subject_synergies':
      result = handleFindCrossSubjectSynergies();
      break;
    case 'manage_universities':
      result = handleManageUniversities(args?.action, args?.data);
      if (args?.action === 'create' || args?.action === 'update') {
        saveUniversityToDb(args.data);
      }
      break;
    case 'manage_professors':
      result = handleManageProfessors(args?.action, args?.data);
      break;
    case 'manage_subjects':
      result = handleManageSubjects(args?.action, args?.data);
      if (args?.action === 'create' || args?.action === 'update') {
        saveSubjectToDb(args.data);
      }
      break;
    case 'manage_schedules':
      result = handleManageSchedules(args?.action, args?.data);
      if (args?.action === 'create' || args?.action === 'update') {
        saveScheduleToDb(args.data);
      }
      break;
    case 'manage_deliverables':
      result = handleManageDeliverables(args?.action, args?.data);
      if (args?.action === 'create' || args?.action === 'update') {
        saveDeliverableToDb(args.data);
      }
      break;
    case 'manage_syllabus_topics':
      result = handleManageSyllabusTopics(args?.action, args?.data);
      break;
    default:
      throw new Error(`Herramienta MCP no reconocida: ${name}`);
  }
  return result;
}

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
    const res = handleGetAcademicOverview();
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('ingest_academic_enrollment', 'Procesa e ingesta la matrícula real del estudiante.', { raw_text: z.string() }, async ({ raw_text }) => {
    const res = handleIngestAcademicEnrollment(raw_text);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('parse_and_ingest_syllabus', 'Recibe un texto de temario y lo convierte en árbol de ejes temáticos.', { subject_id: z.string(), raw_text: z.string() }, async ({ subject_id, raw_text }) => {
    const res = handleParseAndIngestSyllabus(subject_id, raw_text);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('find_cross_subject_synergies', 'Escanea temarios de Ingeniería Aeroespacial e Ingeniería de Software.', {}, async () => {
    const res = handleFindCrossSubjectSynergies();
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_universities', 'Operaciones CRUD sobre Universidades.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = handleManageUniversities(action, data);
    if (data && (action === 'create' || action === 'update')) saveUniversityToDb(data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_professors', 'Operaciones CRUD sobre Profesores.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = handleManageProfessors(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_subjects', 'Operaciones CRUD sobre Asignaturas.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = handleManageSubjects(action, data);
    if (data && (action === 'create' || action === 'update')) saveSubjectToDb(data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_schedules', 'Operaciones CRUD sobre Horarios y Aulas de clase.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = handleManageSchedules(action, data);
    if (data && (action === 'create' || action === 'update')) saveScheduleToDb(data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_deliverables', 'Operaciones CRUD sobre Entregables / Parciales.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = handleManageDeliverables(action, data);
    if (data && (action === 'create' || action === 'update')) saveDeliverableToDb(data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  mcpServer.tool('manage_syllabus_topics', 'Operaciones CRUD sobre Ejes Temáticos.', { action: z.enum(['create', 'read', 'update', 'delete']), data: z.any().optional() }, async ({ action, data }) => {
    const res = handleManageSyllabusTopics(action, data);
    return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
  });

  return mcpServer;
}

async function main() {
  const port = Number(process.env.MCP_PORT || 3001);
  const secretKey = process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN || 'Stability8-Showcase4-Lavish9-Petition3';

  // Instantiate unified StreamableHTTPServerTransport
  const streamableTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => `pure_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  });

  const mcpServer = createMcpServerInstance();
  await mcpServer.connect(streamableTransport);

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
    if (normalizedPath === '/health') {
      return handleHealthCheck(req, res);
    }

    // 3. OAuth 2.0 Discovery
    if (
      normalizedPath === '/.well-known/oauth-authorization-server' ||
      normalizedPath === '/.well-known/openid-configuration'
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

    // 4. Root information GET /
    if (normalizedPath === '/' && req.method === 'GET' && !req.headers.accept?.includes('text/event-stream')) {
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

    // 6. Handle Streamable HTTP and SSE requests via StreamableHTTPServerTransport
    if (
      normalizedPath === '/sse' ||
      normalizedPath === '/mcp' ||
      normalizedPath === '/messages' ||
      normalizedPath === '/.well-known/mcp' ||
      normalizedPath === '/'
    ) {
      await streamableTransport.handleRequest(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
  });

  httpServer.listen(port, () => {
    console.error(`====================================================`);
    console.error(`🚀 Servidor MCP de Pure listo en http://0.0.0.0:${port}`);
    console.error(`🔑 Autenticación API Key activada: ${secretKey.substring(0, 10)}...`);
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
