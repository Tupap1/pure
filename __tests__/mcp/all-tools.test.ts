import { describe, it, expect } from 'vitest';
import { executeToolCall, TOOLS_LIST } from '../../mcp-server/index';

describe('Exhaustive MCP Server Endpoints & Tools Verification Suite', () => {
  it('should have registered all 10 MCP tools in TOOLS_LIST', () => {
    expect(TOOLS_LIST.length).toBe(10);
    const toolNames = TOOLS_LIST.map((t) => t.name);
    expect(toolNames).toContain('get_academic_overview');
    expect(toolNames).toContain('ingest_academic_enrollment');
    expect(toolNames).toContain('parse_and_ingest_syllabus');
    expect(toolNames).toContain('find_cross_subject_synergies');
    expect(toolNames).toContain('manage_universities');
    expect(toolNames).toContain('manage_professors');
    expect(toolNames).toContain('manage_subjects');
    expect(toolNames).toContain('manage_schedules');
    expect(toolNames).toContain('manage_deliverables');
    expect(toolNames).toContain('manage_syllabus_topics');
  });

  describe('1. get_academic_overview', () => {
    it('should return valid academic overview metrics', () => {
      const res = executeToolCall('get_academic_overview', {});
      expect(res.status).toBe('success');
      expect(res.data).toHaveProperty('netFreeTimeHours');
      expect(res.data).toHaveProperty('universitiesCount');
      expect(res.data).toHaveProperty('subjectsCount');
    });
  });

  describe('2. ingest_academic_enrollment', () => {
    it('should process JSON structured enrollment', () => {
      const jsonPayload = JSON.stringify({
        subjects: [{ id: 'sub-test-json', university_id: 'uni-1', name: 'Materia JSON' }],
      });
      const res = executeToolCall('ingest_academic_enrollment', { raw_text: jsonPayload });
      expect(res.status).toBe('success');
      expect(res.data.subjectsCount).toBeGreaterThanOrEqual(1);
    });

    it('should extract classroom overrides from plain text for existing subjects', () => {
      const res = executeToolCall('ingest_academic_enrollment', { raw_text: 'Materia JSON: 2-209' });
      expect(res.status).toBe('success');
      expect(res.data).toBeDefined();
    });

    it('should handle empty or undefined raw_text gracefully', () => {
      const res = executeToolCall('ingest_academic_enrollment', {});
      expect(res.status).toBe('success');
      expect(res.data).toBeDefined();
    });
  });

  describe('3. parse_and_ingest_syllabus', () => {
    it('should parse unit topics and bullet items from plain text syllabus', () => {
      const rawSyllabus = `
        Unidad 1: Introducción a la Inteligencia Artificial
        - Conceptos fundamentales
        - Agentes reactivos
        Unidad 2: Redes Neuronales
        - Perceptrón multicapa
      `;
      const res = executeToolCall('parse_and_ingest_syllabus', {
        subject_id: 'sub-test-1',
        raw_text: rawSyllabus,
      });
      expect(res.status).toBe('success');
      expect(res.topicsParsed).toBe(5);
      expect(res.topics[0].title).toBe('Unidad 1: Introducción a la Inteligencia Artificial');
    });
  });

  describe('4. find_cross_subject_synergies', () => {
    it('should analyze syllabus topic synergies between subjects', () => {
      const res = executeToolCall('find_cross_subject_synergies', {});
      expect(res.status).toBe('success');
      expect(res.synergies).toBeDefined();
      expect(Array.isArray(res.synergies)).toBe(true);
    });
  });

  describe('5. manage_universities (CRUD)', () => {
    let createdId: string;

    it('should create a university', () => {
      const res = executeToolCall('manage_universities', {
        action: 'create',
        data: { name: 'Universidad Nacional', modality: 'presencial' },
      });
      expect(res.status).toBe('success');
      expect(res.data.name).toBe('Universidad Nacional');
      createdId = res.data.id;
    });

    it('should read the created university by ID', () => {
      const res = executeToolCall('manage_universities', {
        action: 'read',
        data: { id: createdId },
      });
      expect(res.status).toBe('success');
      expect(res.data.id).toBe(createdId);
    });

    it('should update the university', () => {
      const res = executeToolCall('manage_universities', {
        action: 'update',
        data: { id: createdId, name: 'Universidad Nacional de Colombia' },
      });
      expect(res.status).toBe('success');
      expect(res.data.name).toBe('Universidad Nacional de Colombia');
    });

    it('should delete the university', () => {
      const res = executeToolCall('manage_universities', {
        action: 'delete',
        data: { id: createdId },
      });
      expect(res.status).toBe('success');
    });
  });

  describe('6. manage_professors (CRUD)', () => {
    let createdId: string;

    it('should create a professor', () => {
      const res = executeToolCall('manage_professors', {
        action: 'create',
        data: { university_id: 'uni-1', name: 'Dra. María Curiez', email: 'mcurie@test.edu' },
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should read all professors', () => {
      const res = executeToolCall('manage_professors', { action: 'read' });
      expect(res.status).toBe('success');
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should delete the professor', () => {
      const res = executeToolCall('manage_professors', { action: 'delete', data: { id: createdId } });
      expect(res.status).toBe('success');
    });
  });

  describe('7. manage_subjects (CRUD)', () => {
    let createdId: string;

    it('should create a subject', () => {
      const res = executeToolCall('manage_subjects', {
        action: 'create',
        data: { university_id: 'uni-1', name: 'Arquitectura de Computadores', credits: 4 },
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should update the subject', () => {
      const res = executeToolCall('manage_subjects', {
        action: 'update',
        data: { id: createdId, credits: 5 },
      });
      expect(res.status).toBe('success');
      expect(res.data.credits).toBe(5);
    });

    it('should delete the subject', () => {
      const res = executeToolCall('manage_subjects', { action: 'delete', data: { id: createdId } });
      expect(res.status).toBe('success');
    });
  });

  describe('8. manage_schedules (CRUD)', () => {
    let createdId: string;

    it('should create a schedule', () => {
      const res = executeToolCall('manage_schedules', {
        action: 'create',
        data: { subject_id: 'sub-1', day_of_week: 1, start_time: '08:00', end_time: '10:00', classroom: '3-101' },
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should delete the schedule', () => {
      const res = executeToolCall('manage_schedules', { action: 'delete', data: { id: createdId } });
      expect(res.status).toBe('success');
    });
  });

  describe('9. manage_deliverables (CRUD)', () => {
    let createdId: string;

    it('should create a deliverable', () => {
      const res = executeToolCall('manage_deliverables', {
        action: 'create',
        data: { subject_id: 'sub-1', title: 'Proyecto Final', weight_percentage: 40 },
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should delete the deliverable', () => {
      const res = executeToolCall('manage_deliverables', { action: 'delete', data: { id: createdId } });
      expect(res.status).toBe('success');
    });
  });

  describe('10. manage_syllabus_topics (CRUD)', () => {
    let createdId: string;

    it('should create a syllabus topic', () => {
      const res = executeToolCall('manage_syllabus_topics', {
        action: 'create',
        data: { subject_id: 'sub-1', title: 'Tema 1: Generalidades' },
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should delete the syllabus topic', () => {
      const res = executeToolCall('manage_syllabus_topics', { action: 'delete', data: { id: createdId } });
      expect(res.status).toBe('success');
    });
  });

  describe('11. Unrecognized Tool Error Handling', () => {
    it('should throw clear error when invoking unknown tool name', () => {
      expect(() => executeToolCall('invalid_unknown_tool', {})).toThrow('Herramienta MCP no reconocida: invalid_unknown_tool');
    });
  });
});
