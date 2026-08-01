import { describe, it, expect } from 'vitest';
import {
  handleGetAcademicOverview,
  handleParseAndIngestSyllabus,
  handleFindCrossSubjectSynergies
} from '@/mcp-server/tools-handler';

describe('REQ-09: Servidor MCP Bidireccional para Antigravity AI Bridge', () => {
  it('debe generar el resumen académico global en formato JSON para la IA', () => {
    const overview = handleGetAcademicOverview();
    expect(overview.status).toBe('success');
    expect(overview.data.netFreeTimeHours).toBeDefined();
    expect(overview.data.universities).toHaveLength(2);
  });

  it('debe parsear un plan de estudios en texto plano y retornar una estructura en árbol jerárquico', () => {
    const rawSyllabusText = `
    Unidad 1: Cálculo Diferencial
    - Tema 1.1: Límites y Continuidad
    - Tema 1.2: Derivadas de Funciones Trascendentes
    `;

    const result = handleParseAndIngestSyllabus('subject-123', rawSyllabusText);
    expect(result.status).toBe('success');
    expect(result.topicsParsed).toBeGreaterThan(0);
    expect(result.topics[0].title).toContain('Cálculo Diferencial');
  });

  it('debe ejecutar el detector de sinergias temáticas entre ambas ingenierías para la IA', () => {
    const synergies = handleFindCrossSubjectSynergies();
    expect(synergies.status).toBe('success');
    expect(synergies.synergiesCount).toBeGreaterThanOrEqual(1);
  });
});
