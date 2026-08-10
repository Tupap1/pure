import { describe, it, expect, vi } from 'vitest';
import {
  handleGetAcademicOverview,
  handleParseAndIngestSyllabus,
  handleFindCrossSubjectSynergies,
  handleIngestAcademicEnrollment,
} from '@/mcp-server/tools-handler';

vi.mock('@/lib/db/pg-client', () => ({
  pgPool: {
    query: vi.fn().mockImplementation(async (queryStr: string) => {
      const lower = queryStr.toLowerCase();
      if (lower.includes('count(*)::int')) return { rows: [{ count: 2 }] };
      if (lower.includes('select name, modality')) return { rows: [{ name: 'Uni 1', modality: 'presencial' }, { name: 'Uni 2', modality: 'virtual' }] };
      return { rows: [] };
    }),
  },
}));

describe('REQ-09: Servidor MCP Bidireccional para Antigravity AI Bridge', () => {
  it('debe generar el resumen académico global en formato JSON para la IA', async () => {
    const overview = await handleGetAcademicOverview();
    expect(overview.status).toBe('success');
    expect(overview.data!.netFreeTimeHours).toBeDefined();
    expect(overview.data!.universities.length).toBeGreaterThanOrEqual(1);
  });

  it('debe parsear e ingestar la matrícula académica del estudiante mediante el MCP', async () => {
    const enrollment = await handleIngestAcademicEnrollment();
    expect(enrollment.status).toBe('success');
    expect(enrollment.data).toBeDefined();
  });

  it('debe parsear un plan de estudios en texto plano y retornar una estructura en árbol jerárquico', async () => {
    const rawSyllabusText = `
    Unidad 1: Cálculo Diferencial
    - Tema 1.1: Límites y Continuidad
    - Tema 1.2: Derivadas de Funciones Trascendentes
    `;

    const result = await handleParseAndIngestSyllabus('subject-123', rawSyllabusText);
    expect(result.status).toBe('success');
    expect(result.topicsParsed).toBeGreaterThan(0);
    expect(result.topics![0].title).toContain('Cálculo Diferencial');
  });

  it('debe ejecutar el detector de sinergias temáticas entre ambas ingenierías para la IA', async () => {
    const synergies = await handleFindCrossSubjectSynergies();
    expect(synergies.status).toBe('success');
    expect(synergies.synergiesCount).toBeGreaterThanOrEqual(1);
  });
});
