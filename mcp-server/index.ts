import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Servidor MCP de Pure conectado exitosamente vía stdio');
}

main().catch((err) => {
  console.error('Error fatal en el Servidor MCP de Pure:', err);
  process.exit(1);
});
