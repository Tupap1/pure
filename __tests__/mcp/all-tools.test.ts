import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { TOOLS_LIST } from '../../mcp-server/index';
import {
  handleGetAcademicOverview,
  handleIngestAcademicEnrollment,
  handleParseAndIngestSyllabus,
  handleFindCrossSubjectSynergies,
  handleManageUniversities,
  handleManageProfessors,
  handleManageSubjects,
  handleManageSchedules,
  handleManageDeliverables,
  handleManageSyllabusTopics,
} from '../../mcp-server/tools-handler';

describe('Exhaustive MCP Server Endpoints & Tools Verification Suite (con pg-mem)', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  it('should have registered all 20 MCP tools in TOOLS_LIST', () => {
    expect(TOOLS_LIST.length).toBe(20);
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
    expect(toolNames).toContain('manage_class_sessions');
    expect(toolNames).toContain('manage_syllabus_topics');
    expect(toolNames).toContain('get_class_context');
  });

  describe('1. get_academic_overview', () => {
    it('should return valid academic overview metrics', async () => {
      const res = await handleGetAcademicOverview();
      expect(res.status).toBe('success');
      expect(res.data).toHaveProperty('netFreeTimeHours');
      expect(res.data).toHaveProperty('universitiesCount');
      expect(res.data).toHaveProperty('subjectsCount');
    });
  });

  describe('2. ingest_academic_enrollment', () => {
    it('should process JSON structured enrollment', async () => {
      const jsonPayload = JSON.stringify({
        universities: [{ id: 'uni-1', name: 'Universidad 1' }],
        subjects: [{ id: 'sub-test-json', university_id: 'uni-1', name: 'Materia JSON' }],
      });
      const res = await handleIngestAcademicEnrollment(jsonPayload);
      expect(res.status).toBe('success');
      expect(res.data!.subjectsCount).toBeGreaterThanOrEqual(1);
    });

    it('should extract classroom overrides from plain text for existing subjects', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-materia-json', university_id: 'u-1', name: 'Materia JSON' });
      await handleManageSchedules('create', { id: 'sch-materia-json', subject_id: 'sub-materia-json', day_of_week: 1, start_time: '08:00', end_time: '10:00' });
      const res = await handleIngestAcademicEnrollment('Materia JSON: 2-209');
      expect(res.status).toBe('success');
      expect(res.data).toBeDefined();
    });

    it('should handle empty or undefined raw_text gracefully', async () => {
      const res = await handleIngestAcademicEnrollment();
      expect(res.status).toBe('error');
      expect(res.error).toBe('invalid_input');
    });
  });

  describe('3. parse_and_ingest_syllabus', () => {
    it('should parse unit topics and bullet items from plain text syllabus', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-test-1', university_id: 'u-1', name: 'IA' });

      const rawSyllabus = `
        Unidad 1: Introducción a la Inteligencia Artificial
        - Conceptos fundamentales
        - Agentes reactivos
        Unidad 2: Redes Neuronales
        - Perceptrón multicapa
      `;
      const res = await handleParseAndIngestSyllabus('sub-test-1', rawSyllabus);
      expect(res.status).toBe('success');
      expect(res.topicsParsed).toBe(5);
      expect(res.topics![0].title).toBe('Unidad 1: Introducción a la Inteligencia Artificial');
    });
  });

  describe('4. find_cross_subject_synergies', () => {
    it('should analyze syllabus topic synergies between subjects', async () => {
      const res = await handleFindCrossSubjectSynergies();
      expect(res.status).toBe('success');
      expect(res.synergies).toBeDefined();
      expect(Array.isArray(res.synergies)).toBe(true);
    });
  });

  describe('5. manage_universities (CRUD)', () => {
    let createdId: string;

    it('should create a university', async () => {
      const res = await handleManageUniversities('create', {
        name: 'Universidad Nacional',
        modality: 'presencial',
      });
      expect(res.status).toBe('success');
      expect(res.data.name).toBe('Universidad Nacional');
      createdId = res.data.id;
    });

    it('should read the created university by ID', async () => {
      const createRes = await handleManageUniversities('create', {
        id: 'uni-nac-1',
        name: 'Universidad Nacional',
        modality: 'presencial',
      });
      createdId = createRes.data.id;
      const res = await handleManageUniversities('read', { id: createdId });
      expect(res.status).toBe('success');
      expect(res.data.id).toBe(createdId);
    });

    it('should update the university', async () => {
      const createRes = await handleManageUniversities('create', {
        id: 'uni-nac-2',
        name: 'Universidad Nacional',
      });
      createdId = createRes.data.id;
      const res = await handleManageUniversities('create', {
        id: createdId,
        name: 'Universidad Nacional de Colombia',
      });
      expect(res.status).toBe('success');
      expect(res.data.name).toBe('Universidad Nacional de Colombia');
    });

    it('should delete the university', async () => {
      const createRes = await handleManageUniversities('create', {
        id: 'uni-nac-3',
        name: 'Universidad Nacional',
      });
      createdId = createRes.data.id;
      const res = await handleManageUniversities('delete', { id: createdId });
      expect(res.status).toBe('success');
    });
  });

  describe('6. manage_professors (CRUD)', () => {
    let createdId: string;

    it('should create a professor', async () => {
      await handleManageUniversities('create', { id: 'uni-1', name: 'U1' });
      const res = await handleManageProfessors('create', {
        university_id: 'uni-1',
        name: 'Dra. María Curie',
        email: 'mcurie@test.edu',
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should read all professors', async () => {
      const res = await handleManageProfessors('read');
      expect(res.status).toBe('success');
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should delete the professor', async () => {
      await handleManageUniversities('create', { id: 'uni-1', name: 'U1' });
      const createRes = await handleManageProfessors('create', {
        university_id: 'uni-1',
        name: 'Dra. María Curie',
      });
      createdId = createRes.data.id;
      const res = await handleManageProfessors('delete', { id: createdId });
      expect(res.status).toBe('success');
    });
  });

  describe('7. manage_subjects (CRUD)', () => {
    let createdId: string;

    it('should create a subject', async () => {
      await handleManageUniversities('create', { id: 'uni-1', name: 'U1' });
      const res = await handleManageSubjects('create', {
        university_id: 'uni-1',
        name: 'Arquitectura de Computadores',
        credits: 4,
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should update the subject', async () => {
      await handleManageUniversities('create', { id: 'uni-1', name: 'U1' });
      const createRes = await handleManageSubjects('create', {
        id: 'sub-arq-1',
        university_id: 'uni-1',
        name: 'Arquitectura de Computadores',
        credits: 4,
      });
      createdId = createRes.data.id;
      const res = await handleManageSubjects('create', { id: createdId, university_id: 'uni-1', name: 'Arquitectura de Computadores', credits: 5 });
      expect(res.status).toBe('success');
      expect(res.data.credits).toBe(5);
    });

    it('should delete the subject', async () => {
      await handleManageUniversities('create', { id: 'uni-1', name: 'U1' });
      const createRes = await handleManageSubjects('create', {
        id: 'sub-arq-2',
        university_id: 'uni-1',
        name: 'Arquitectura de Computadores',
      });
      createdId = createRes.data.id;
      const res = await handleManageSubjects('delete', { id: createdId });
      expect(res.status).toBe('success');
    });
  });

  describe('8. manage_schedules (CRUD)', () => {
    let createdId: string;

    it('should create a schedule', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-1', university_id: 'u-1', name: 'S1' });
      const res = await handleManageSchedules('create', {
        subject_id: 'sub-1',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '10:00',
        classroom: '3-101',
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should delete the schedule', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-1', university_id: 'u-1', name: 'S1' });
      const createRes = await handleManageSchedules('create', {
        subject_id: 'sub-1',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '10:00',
      });
      createdId = createRes.data.id;
      const res = await handleManageSchedules('delete', { id: createdId });
      expect(res.status).toBe('success');
    });
  });

  describe('9. manage_deliverables (CRUD)', () => {
    let createdId: string;

    it('should create a deliverable', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-1', university_id: 'u-1', name: 'S1' });
      const res = await handleManageDeliverables('create', {
        subject_id: 'sub-1',
        title: 'Proyecto Final',
        weight_percentage: 40,
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should delete the deliverable', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-1', university_id: 'u-1', name: 'S1' });
      const createRes = await handleManageDeliverables('create', {
        subject_id: 'sub-1',
        title: 'Proyecto Final',
      });
      createdId = createRes.data.id;
      const res = await handleManageDeliverables('delete', { id: createdId });
      expect(res.status).toBe('success');
    });
  });

  describe('10. manage_syllabus_topics (CRUD)', () => {
    let createdId: string;

    it('should create a syllabus topic', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-1', university_id: 'u-1', name: 'S1' });
      const res = await handleManageSyllabusTopics('create', {
        subject_id: 'sub-1',
        title: 'Tema 1: Generalidades',
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should delete the syllabus topic', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-1', university_id: 'u-1', name: 'S1' });
      const createRes = await handleManageSyllabusTopics('create', {
        subject_id: 'sub-1',
        title: 'Tema 1: Generalidades',
      });
      createdId = createRes.data.id;
      const res = await handleManageSyllabusTopics('delete', { id: createdId });
      expect(res.status).toBe('success');
    });
  });
});
