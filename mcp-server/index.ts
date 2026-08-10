import 'dotenv/config';
import http, { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { validateMcpAuth } from './auth-middleware';
import { handleHealthCheck } from './health-handler';
import { OAuthStore, globalOAuthStore } from './oauth-store';
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createRequestHandler(opts?: { secretKey?: string; oauthStore?: OAuthStore }): (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> {
  const secretKey = opts?.secretKey || process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN;
  const oauthStore = opts?.oauthStore || globalOAuthStore;
  const activeTransports = new Map<string, SSEServerTransport>();

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // 1. Set CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${process.env.MCP_PORT || 3001}`;
    const protocol = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
    const baseUrl = `${protocol}://${hostHeader}`;

    const url = new URL(req.url || '/', baseUrl);
    const normalizedPath = url.pathname.replace(/\/$/, '') || '/';

    // 2. TAREA 3: Order of Routing - ALL .well-known routes FIRST (matching with startsWith)
    if (normalizedPath.startsWith('/.well-known/oauth-protected-resource')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          resource: baseUrl,
          authorization_servers: [baseUrl],
          scopes_supported: ['mcp'],
          bearer_methods_supported: ['header'],
        })
      );
      return;
    }

    if (
      normalizedPath.startsWith('/.well-known/oauth-authorization-server') ||
      normalizedPath.startsWith('/.well-known/openid-configuration')
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
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
        })
      );
      return;
    }

    // 3. Health check GET /health & Root Info GET /
    if (normalizedPath.endsWith('/health')) {
      return handleHealthCheck(req, res);
    }

    if (normalizedPath === '/' && req.method === 'GET') {
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

    // 4. OAuth 2.0 PKCE Endpoints
    if (normalizedPath === '/oauth/register' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        let payload: any = {};
        try {
          if (body) payload = JSON.parse(body);
        } catch (e) {}

        try {
          const client = await oauthStore.registerClient(payload);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              client_id: client.clientId,
              client_name: client.clientName,
              redirect_uris: client.redirectUris,
              token_endpoint_auth_method: client.tokenEndpointAuthMethod,
            })
          );
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'invalid_request',
              error_description: err.message || 'Invalid registration request',
            })
          );
        }
      });
      return;
    }

    if (normalizedPath === '/oauth/authorize' && req.method === 'GET') {
      const redirectUri = url.searchParams.get('redirect_uri');
      const state = url.searchParams.get('state') || '';
      const clientId = url.searchParams.get('client_id') || '';
      const codeChallenge = url.searchParams.get('code_challenge') || '';
      const codeChallengeMethod = url.searchParams.get('code_challenge_method') || 'S256';

      if (!redirectUri || !(await oauthStore.isValidRedirectUri(redirectUri, clientId))) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing or invalid redirect_uri' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pure Academic - Consentimiento OAuth</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 100%; max-width: 400px; border: 1px solid #334155; }
            h2 { margin-top: 0; color: #38bdf8; text-align: center; }
            p { font-size: 0.95rem; color: #94a3b8; line-height: 1.5; }
            input[type="password"] { width: 100%; padding: 0.75rem; margin: 1rem 0; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box; }
            button { width: 100%; padding: 0.75rem; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
            button:hover { background: #0369a1; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Pure Academic MCP</h2>
            <p>Conectar con el cliente OAuth (${escapeHtml(clientId || 'Claude Web')}). Ingrese su clave de API (MCP_API_KEY) para autorizar:</p>
            <form method="POST" action="${baseUrl}/oauth/authorize">
              <input type="hidden" name="client_id" value="${escapeHtml(clientId)}" />
              <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}" />
              <input type="hidden" name="state" value="${escapeHtml(state)}" />
              <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}" />
              <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}" />
              <input type="password" name="password" placeholder="MCP API Key" required autofocus />
              <button type="submit">Autorizar Conexión</button>
            </form>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (normalizedPath === '/oauth/authorize' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const params = new URLSearchParams(body);
        const password = params.get('password') || '';
        const clientId = params.get('client_id') || '';
        const redirectUri = params.get('redirect_uri') || '';
        const state = params.get('state') || '';
        const codeChallenge = params.get('code_challenge') || '';
        const codeChallengeMethod = params.get('code_challenge_method') || 'S256';

        const effectiveSecret = secretKey || process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN || '';
        const passHash = crypto.createHash('sha256').update(password.trim()).digest();
        const secretHash = crypto.createHash('sha256').update(effectiveSecret.trim()).digest();
        const isValid = crypto.timingSafeEqual(passHash, secretHash);

        if (!isValid) {
          res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Error de Autenticación</title></head>
            <body style="background:#0f172a;color:#ef4444;font-family:sans-serif;text-align:center;padding-top:50px;">
              <h2>❌ Clave MCP_API_KEY Incorrecta</h2>
              <p><a href="javascript:history.back()" style="color:#38bdf8;">Intentar nuevamente</a></p>
            </body>
            </html>
          `);
          return;
        }

        if (!redirectUri || !(await oauthStore.isValidRedirectUri(redirectUri, clientId))) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Invalid redirect_uri' }));
          return;
        }

        const code = await oauthStore.createAuthCode({
          clientId,
          redirectUri,
          codeChallenge,
          codeChallengeMethod,
        });

        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);

        res.writeHead(302, { Location: redirectUrl.toString() });
        res.end();
      });
      return;
    }

    if (normalizedPath === '/oauth/token' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        let grantType = '';
        let code = '';
        let clientId = '';
        let redirectUri = '';
        let codeVerifier = '';

        if (req.headers['content-type']?.includes('application/json')) {
          try {
            const json = JSON.parse(body);
            grantType = json.grant_type || '';
            code = json.code || '';
            clientId = json.client_id || '';
            redirectUri = json.redirect_uri || '';
            codeVerifier = json.code_verifier || '';
          } catch (e) {}
        } else {
          const params = new URLSearchParams(body);
          grantType = params.get('grant_type') || '';
          code = params.get('code') || '';
          clientId = params.get('client_id') || '';
          redirectUri = params.get('redirect_uri') || '';
          codeVerifier = params.get('code_verifier') || '';
        }

        if (grantType !== 'authorization_code') {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' }));
          return;
        }

        const result = await oauthStore.verifyAndConsumeAuthCode({
          code,
          clientId,
          redirectUri,
          codeVerifier,
        });

        if (!result.valid) {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: result.error || 'invalid_grant', error_description: result.errorDescription }));
          return;
        }

        const accessToken = await oauthStore.createAccessToken(clientId);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(
          JSON.stringify({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 86400,
          })
        );
      });
      return;
    }

    try {
      // 5. Authentication check for protected routes (/mcp, /sse, /messages)
      if (!(await validateMcpAuth(req, secretKey, oauthStore))) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Unauthorized: Missing or invalid Bearer token / API Key' },
            id: null,
          })
        );
        return;
      }

      // 6. Streamable HTTP on /mcp (Stateless Mode)
      if (normalizedPath === '/mcp' || normalizedPath.endsWith('/mcp')) {
        // DELETE /mcp -> 405 with JSON-RPC error
        if (req.method === 'DELETE') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32601, message: 'Method not allowed in stateless mode' },
              id: null,
            })
          );
          return;
        }

        // GET /mcp without Accept: text/event-stream -> Informational JSON
        if (req.method === 'GET' && !req.headers.accept?.includes('text/event-stream')) {
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

        // GET /mcp with Accept: text/event-stream -> Stream Transport
        if (req.method === 'GET' && req.headers.accept?.includes('text/event-stream')) {
          res.setHeader('X-Accel-Buffering', 'no');
          const pingInterval = setInterval(() => {
            if (!res.writableEnded) {
              res.write(': ping\n\n');
            }
          }, 25000);

          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          const mcpInstance = createMcpServerInstance();
          await mcpInstance.connect(transport);

          res.on('close', () => {
            clearInterval(pingInterval);
            transport.close().catch(() => {});
            mcpInstance.close().catch(() => {});
          });

          try {
            await transport.handleRequest(req, res);
          } catch (err: any) {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32603, message: err.message || 'Internal error' },
                  id: null,
                })
              );
            }
          }
          return;
        }

        // POST /mcp -> Streamable HTTP Stateless JSON-RPC
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', async () => {
            let parsedBody: any;
            try {
              parsedBody = body ? JSON.parse(body) : {};
            } catch (e: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  error: { code: -32700, message: 'Parse error: Invalid JSON' },
                  id: null,
                })
              );
              return;
            }

            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
            const mcpInstance = createMcpServerInstance();
            await mcpInstance.connect(transport);

            res.on('close', () => {
              transport.close().catch(() => {});
              mcpInstance.close().catch(() => {});
            });

            try {
              await transport.handleRequest(req, res, parsedBody);
            } catch (err: any) {
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: err.message || 'Internal error' },
                    id: parsedBody?.id ?? null,
                  })
                );
              }
            }
          });
          return;
        }
      }

      // 7. Handle SSE connections (stateful compatibility)
      if (normalizedPath.endsWith('/sse')) {
        res.setHeader('X-Accel-Buffering', 'no');
        const pingInterval = setInterval(() => {
          if (!res.writableEnded) {
            res.write(': ping\n\n');
          }
        }, 25000);

        const searchParams = url.search ? url.search : '';
        const basePath = url.pathname.replace(/\/sse$/, '');
        const messagesPath = `${basePath}/messages${searchParams}`;

        const transport = new SSEServerTransport(messagesPath, res);
        const mcpServer = createMcpServerInstance();
        await mcpServer.connect(transport);

        const sid = transport.sessionId;
        activeTransports.set(sid, transport);

        res.on('close', () => {
          clearInterval(pingInterval);
        });

        const originalOnClose = transport.onclose;
        transport.onclose = () => {
          originalOnClose?.();
          activeTransports.delete(sid);
        };

        return;
      }

      // 8. Handle messages
      if (normalizedPath.endsWith('/messages')) {
        const sessionId = url.searchParams.get('sessionId') || (req.headers['mcp-session-id'] as string);
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
    } catch (err) {
      console.error('Unhandled error in HTTP handler:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal Server Error' },
            id: null,
          })
        );
      }
    }
  };
}

async function main() {
  const port = Number(process.env.MCP_PORT || 3001);
  const rawKey = process.env.MCP_API_KEY || process.env.MCP_AUTH_TOKEN;
  const secretKey = rawKey ? rawKey.trim() : undefined;

  if (!secretKey) {
    console.error('❌ Error fatal: MCP_API_KEY / MCP_AUTH_TOKEN no está configurado en el entorno.');
    process.exit(1);
  }

  const handler = createRequestHandler({ secretKey });
  const httpServer = http.createServer(handler);

  httpServer.listen(port, '0.0.0.0', () => {
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
