import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleManageUniversities,
  handleManageProfessors,
  handleManageSubjects,
  handleManageSchedules,
  handleManageDeliverables,
  handleManageSyllabusTopics,
  handleGetAcademicOverview,
} from '../../mcp-server/tools-handler';

// In-Memory Database representing Postgres state across restarts
const postgresMockDb: Record<string, any[]> = {
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
        return { rows: [{ count: (postgresMockDb[tableName] || []).length }] };
      }

      // 2. DELETE queries
      if (lower.startsWith('delete from')) {
        const match = lower.match(/delete from (\w+)/);
        if (match && match[1]) {
          const tableName = match[1];
          const id = params[0];
          postgresMockDb[tableName] = (postgresMockDb[tableName] || []).filter((r) => r.id !== id);
        }
        return { rows: [] };
      }

      // 3. INSERT / UPSERT queries
      if (lower.startsWith('insert into')) {
        const match = lower.match(/insert into (\w+)/);
        if (match && match[1]) {
          const tableName = match[1];
          const id = params[0];
          postgresMockDb[tableName] = postgresMockDb[tableName] || [];
          const idx = postgresMockDb[tableName].findIndex((r) => r.id === id);

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
            postgresMockDb[tableName][idx] = { ...postgresMockDb[tableName][idx], ...record };
          } else {
            postgresMockDb[tableName].push(record);
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

        const tableData = postgresMockDb[tableName] || [];
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

describe('MCP Server PostgreSQL Direct Persistence & Survival Across Restarts', () => {
  beforeEach(() => {
    Object.keys(postgresMockDb).forEach((key) => {
      postgresMockDb[key] = [];
    });
  });

  it('should persist a university created via MCP tool directly to PostgreSQL and survive a simulated store restart', async () => {
    const uniPayload = {
      id: 'uni-persistence-test',
      name: 'Universidad del Valle',
      modality: 'presencial',
      scale_min: 0,
      scale_max: 5,
      passing_grade: 3.0,
      color: '#10b981',
    };

    // 1. Create via MCP tool handler (must be awaited)
    const createResult = await handleManageUniversities('create', uniPayload);
    expect(createResult.status).toBe('success');
    expect(createResult.data.id).toBe('uni-persistence-test');

    // Verify row was inserted into Postgres table
    expect(postgresMockDb.universities).toHaveLength(1);
    expect(postgresMockDb.universities[0].name).toBe('Universidad del Valle');

    // 2. Simulate process/store restart (in-memory tool handlers have zero internal state cache)
    // Querying overview or reading university after "restart" fetches directly from Postgres pool
    const readResult = await handleManageUniversities('read', { id: 'uni-persistence-test' });
    expect(readResult.status).toBe('success');
    expect(readResult.data).toBeDefined();
    expect(readResult.data.name).toBe('Universidad del Valle');

    const overviewResult = await handleGetAcademicOverview();
    expect(overviewResult.status).toBe('success');
    expect(overviewResult.data!.universitiesCount).toBe(1);
  });

  it('should persist professors and syllabus_topics created via MCP tools and support deletion from Postgres', async () => {
    // 1. Create Professor via MCP tool
    const profRes = await handleManageProfessors('create', {
      id: 'prof-persisted-1',
      university_id: 'uni-persistence-test',
      name: 'Dr. Alan Turing',
      email: 'turing@valle.edu.co',
    });
    expect(profRes.status).toBe('success');
    expect(postgresMockDb.professors).toHaveLength(1);

    // 2. Create Syllabus Topic via MCP tool
    const topicRes = await handleManageSyllabusTopics('create', {
      id: 'topic-persisted-1',
      subject_id: 'sub-comp-1',
      title: 'Máquinas de Turing y Computabilidad',
      mastery_status: 'dominado',
    });
    expect(topicRes.status).toBe('success');
    expect(postgresMockDb.syllabus_topics).toHaveLength(1);

    // 3. Delete Professor via MCP tool and confirm deletion in Postgres
    const deleteProfRes = await handleManageProfessors('delete', { id: 'prof-persisted-1' });
    expect(deleteProfRes.status).toBe('success');
    expect(postgresMockDb.professors).toHaveLength(0);

    // 4. Delete Syllabus Topic via MCP tool and confirm deletion in Postgres
    const deleteTopicRes = await handleManageSyllabusTopics('delete', { id: 'topic-persisted-1' });
    expect(deleteTopicRes.status).toBe('success');
    expect(postgresMockDb.syllabus_topics).toHaveLength(0);
  });
});
