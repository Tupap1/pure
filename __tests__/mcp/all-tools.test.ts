import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// In-Memory Database for pgPool unit test mocking
const dbStore: Record<string, any[]> = {
  universities: [],
  professors: [],
  subjects: [],
  schedules: [],
  deliverables: [],
  syllabus_topics: [],
};

vi.mock('../../lib/db/pg-client', () => ({
  pgPool: {
    query: vi.fn().mockImplementation(async (queryStr: string, params: any[] = []) => {
      const lower = queryStr.toLowerCase();

      // 1. COUNT queries
      if (lower.includes('count(*)::int')) {
        let tableName = 'universities';
        if (lower.includes('from professors')) tableName = 'professors';
        else if (lower.includes('from subjects')) tableName = 'subjects';
        else if (lower.includes('from schedules')) tableName = 'schedules';
        else if (lower.includes('from deliverables')) tableName = 'deliverables';
        else if (lower.includes('from syllabus_topics')) tableName = 'syllabus_topics';
        return { rows: [{ count: (dbStore[tableName] || []).length }] };
      }

      // 2. DELETE queries
      if (lower.startsWith('delete from')) {
        const match = lower.match(/delete from (\w+)/);
        if (match && match[1]) {
          const tableName = match[1];
          const id = params[0];
          dbStore[tableName] = (dbStore[tableName] || []).filter((r) => r.id !== id);
        }
        return { rows: [] };
      }

      // 3. INSERT / UPSERT queries
      if (lower.startsWith('insert into')) {
        const match = lower.match(/insert into (\w+)/);
        if (match && match[1]) {
          const tableName = match[1];
          const id = params[0];
          dbStore[tableName] = dbStore[tableName] || [];
          const idx = dbStore[tableName].findIndex((r) => r.id === id);

          let record: any = { id };
          if (tableName === 'universities') {
            record = { id, name: params[1], modality: params[2], scale_min: params[3], scale_max: params[4], passing_grade: params[5], color: params[6], has_alternating_saturdays: params[7], first_sabado_a_date: params[8] };
          } else if (tableName === 'professors') {
            record = { id, university_id: params[1], name: params[2], email: params[3], office_hours: params[4], notes: params[5] };
          } else if (tableName === 'subjects') {
            record = { id, university_id: params[1], professor_id: params[2], name: params[3], code: params[4], credits: params[5], difficulty: params[6], modality: params[7], target_grade: params[8], current_grade: params[9], max_absences: params[10] };
          } else if (tableName === 'schedules') {
            record = { id, subject_id: params[1], day_of_week: params[2], start_time: params[3], end_time: params[4], classroom: params[5], periodicity: params[6] };
          } else if (tableName === 'deliverables') {
            record = { id, subject_id: params[1], topic_id: params[2], title: params[3], description: params[4], due_date: params[5], weight_percentage: params[6], grade: params[7], type: params[8], location_modality: params[9], is_group: params[10], complexity: params[11], status: params[12] };
          } else if (tableName === 'syllabus_topics') {
            record = { id, subject_id: params[1], parent_id: params[2], title: params[3], description: params[4], mastery_status: params[5], order_index: params[6] };
          }

          if (idx >= 0) {
            dbStore[tableName][idx] = { ...dbStore[tableName][idx], ...record };
          } else {
            dbStore[tableName].push(record);
          }
        }
        return { rows: [] };
      }

      // 4. SELECT queries
      if (lower.startsWith('select')) {
        let tableName = 'universities';
        if (lower.includes('from professors')) tableName = 'professors';
        else if (lower.includes('from subjects')) tableName = 'subjects';
        else if (lower.includes('from schedules')) tableName = 'schedules';
        else if (lower.includes('from deliverables')) tableName = 'deliverables';
        else if (lower.includes('from syllabus_topics')) tableName = 'syllabus_topics';

        const tableData = dbStore[tableName] || [];
        if (lower.includes('where id =')) {
          const id = params[0];
          const found = tableData.find((r) => r.id === id);
          return { rows: found ? [found] : [] };
        }
        return { rows: [...tableData] };
      }

      return { rows: [] };
    }),
  },
}));

describe('Exhaustive MCP Server Endpoints & Tools Verification Suite', () => {
  beforeEach(() => {
    Object.keys(dbStore).forEach((key) => {
      dbStore[key] = [];
    });
  });

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
        subjects: [{ id: 'sub-test-json', university_id: 'uni-1', name: 'Materia JSON' }],
      });
      const res = await handleIngestAcademicEnrollment(jsonPayload);
      expect(res.status).toBe('success');
      expect(res.data.subjectsCount).toBeGreaterThanOrEqual(1);
    });

    it('should extract classroom overrides from plain text for existing subjects', async () => {
      await handleManageSubjects('create', { id: 'sub-materia-json', university_id: 'uni-1', name: 'Materia JSON' });
      await handleManageSchedules('create', { id: 'sch-materia-json', subject_id: 'sub-materia-json', day_of_week: 1, start_time: '08:00', end_time: '10:00' });
      const res = await handleIngestAcademicEnrollment('Materia JSON: 2-209');
      expect(res.status).toBe('success');
      expect(res.data).toBeDefined();
    });

    it('should handle empty or undefined raw_text gracefully', async () => {
      const res = await handleIngestAcademicEnrollment();
      expect(res.status).toBe('success');
      expect(res.data).toBeDefined();
    });
  });

  describe('3. parse_and_ingest_syllabus', () => {
    it('should parse unit topics and bullet items from plain text syllabus', async () => {
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
      expect(res.topics[0].title).toBe('Unidad 1: Introducción a la Inteligencia Artificial');
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
      const res = await handleManageUniversities('update', {
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
      const res = await handleManageProfessors('create', {
        university_id: 'uni-1',
        name: 'Dra. María Curiez',
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
      const createRes = await handleManageProfessors('create', {
        university_id: 'uni-1',
        name: 'Dra. María Curiez',
      });
      createdId = createRes.data.id;
      const res = await handleManageProfessors('delete', { id: createdId });
      expect(res.status).toBe('success');
    });
  });

  describe('7. manage_subjects (CRUD)', () => {
    let createdId: string;

    it('should create a subject', async () => {
      const res = await handleManageSubjects('create', {
        university_id: 'uni-1',
        name: 'Arquitectura de Computadores',
        credits: 4,
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should update the subject', async () => {
      const createRes = await handleManageSubjects('create', {
        id: 'sub-arq-1',
        university_id: 'uni-1',
        name: 'Arquitectura de Computadores',
        credits: 4,
      });
      createdId = createRes.data.id;
      const res = await handleManageSubjects('update', { id: createdId, credits: 5 });
      expect(res.status).toBe('success');
      expect(res.data.credits).toBe(5);
    });

    it('should delete the subject', async () => {
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
      const res = await handleManageDeliverables('create', {
        subject_id: 'sub-1',
        title: 'Proyecto Final',
        weight_percentage: 40,
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should delete the deliverable', async () => {
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
      const res = await handleManageSyllabusTopics('create', {
        subject_id: 'sub-1',
        title: 'Tema 1: Generalidades',
      });
      expect(res.status).toBe('success');
      createdId = res.data.id;
    });

    it('should delete the syllabus topic', async () => {
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
