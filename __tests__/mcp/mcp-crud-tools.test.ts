import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleGetAcademicOverview,
  handleManageUniversities,
  handleManageProfessors,
  handleManageSubjects,
  handleManageSchedules,
  handleManageDeliverables,
  handleManageSyllabusTopics,
  handleIngestAcademicEnrollment,
} from '../../mcp-server/tools-handler';
import { TOOLS_LIST } from '../../mcp-server/index';

// In-Memory DB Store for Vitest Execution
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

      if (lower.includes('count(*)::int')) {
        let tableName = 'universities';
        if (lower.includes('from professors')) tableName = 'professors';
        else if (lower.includes('from subjects')) tableName = 'subjects';
        else if (lower.includes('from schedules')) tableName = 'schedules';
        else if (lower.includes('from deliverables')) tableName = 'deliverables';
        else if (lower.includes('from syllabus_topics')) tableName = 'syllabus_topics';
        return { rows: [{ count: (dbStore[tableName] || []).length }] };
      }

      if (lower.startsWith('delete from')) {
        const match = lower.match(/delete from (\w+)/);
        if (match && match[1]) {
          const tableName = match[1];
          const id = params[0];
          dbStore[tableName] = (dbStore[tableName] || []).filter((r) => r.id !== id);
        }
        return { rows: [] };
      }

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

describe('MCP Server - Suite de Herramientas CRUD y Parsing Dinámico', () => {
  beforeEach(() => {
    Object.keys(dbStore).forEach((key) => {
      dbStore[key] = [];
    });
  });

  it('debe listar las 10 herramientas registradas en el catálogo de herramientas', () => {
    expect(TOOLS_LIST.length).toBe(10);
    const names = TOOLS_LIST.map((t) => t.name);
    expect(names).toContain('manage_universities');
    expect(names).toContain('manage_professors');
    expect(names).toContain('manage_subjects');
    expect(names).toContain('manage_schedules');
    expect(names).toContain('manage_deliverables');
    expect(names).toContain('manage_syllabus_topics');
    expect(names).toContain('ingest_academic_enrollment');
  });

  describe('CRUD de Universidades (manage_universities)', () => {
    it('debe crear, leer, actualizar y eliminar una universidad', async () => {
      // 1. Create
      const createRes = await handleManageUniversities('create', {
        id: 'uni-test-mit',
        name: 'MIT - Instituto Tecnológico de Massachusetts',
        modality: 'presencial',
        scale_min: 0,
        scale_max: 5,
        passing_grade: 3.5,
        color: '#ff0000',
      });
      expect(createRes?.status).toBe('success');
      expect(createRes?.data.id).toBe('uni-test-mit');

      // 2. Read
      const readRes = await handleManageUniversities('read', { id: 'uni-test-mit' });
      expect(readRes?.status).toBe('success');
      expect(readRes?.data.name).toContain('MIT');

      // 3. Update
      const updateRes = await handleManageUniversities('update', { id: 'uni-test-mit', passing_grade: 4.0 });
      expect(updateRes?.status).toBe('success');
      expect(updateRes?.data.passing_grade).toBe(4.0);

      // 4. Delete
      const deleteRes = await handleManageUniversities('delete', { id: 'uni-test-mit' });
      expect(deleteRes?.status).toBe('success');

      // Verify deletion
      const verifyRead = await handleManageUniversities('read', { id: 'uni-test-mit' });
      expect(verifyRead?.data).toBeNull();
    });
  });

  describe('CRUD de Profesores (manage_professors)', () => {
    it('debe crear, leer, actualizar y eliminar un profesor', async () => {
      // Create
      const createRes = await handleManageProfessors('create', {
        id: 'prof-test-1',
        university_id: 'uni-udea',
        name: 'Dra. María Curiez',
        email: 'mcurie@udea.edu.co',
      });
      expect(createRes?.status).toBe('success');
      expect(createRes?.data.name).toBe('Dra. María Curiez');

      // Read
      const readRes = await handleManageProfessors('read', { id: 'prof-test-1' });
      expect(readRes?.data.email).toBe('mcurie@udea.edu.co');

      // Update
      const updateRes = await handleManageProfessors('update', { id: 'prof-test-1', office_hours: 'Lunes 14:00-16:00' });
      expect(updateRes?.data.office_hours).toBe('Lunes 14:00-16:00');

      // Delete
      const deleteRes = await handleManageProfessors('delete', { id: 'prof-test-1' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Materias (manage_subjects)', () => {
    it('debe crear, leer, actualizar y eliminar una asignatura', async () => {
      // Create
      const createRes = await handleManageSubjects('create', {
        id: 'sub-test-propulsion',
        university_id: 'uni-udea',
        name: 'Propulsión Aeroespacial',
        code: '2591200',
        credits: 4,
        difficulty: 5,
        target_grade: 4.8,
      });
      expect(createRes?.status).toBe('success');
      expect(createRes?.data.difficulty).toBe(5);

      // Read
      const readRes = await handleManageSubjects('read', { id: 'sub-test-propulsion' });
      expect(readRes?.data.name).toBe('Propulsión Aeroespacial');

      // Update
      const updateRes = await handleManageSubjects('update', { id: 'sub-test-propulsion', credits: 5 });
      expect(updateRes?.data.credits).toBe(5);

      // Delete
      const deleteRes = await handleManageSubjects('delete', { id: 'sub-test-propulsion' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Horarios y Aulas (manage_schedules)', () => {
    it('debe asignar y modificar aulas personalizadas', async () => {
      // Create
      const createRes = await handleManageSchedules('create', {
        id: 'sch-test-aero',
        subject_id: 'sub-intro-aero',
        day_of_week: 3,
        start_time: '15:00',
        end_time: '17:00',
        classroom: 'Aula 2-212',
      });
      expect(createRes?.status).toBe('success');
      expect(createRes?.data.classroom).toBe('Aula 2-212');

      // Update Classroom
      const updateRes = await handleManageSchedules('update', { id: 'sch-test-aero', classroom: 'Aula 2-209' });
      expect(updateRes?.data.classroom).toBe('Aula 2-209');

      // Delete
      const deleteRes = await handleManageSchedules('delete', { id: 'sch-test-aero' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Entregables / Parciales (manage_deliverables)', () => {
    it('debe gestionar actividades y parciales', async () => {
      // Create
      const createRes = await handleManageDeliverables('create', {
        id: 'deliv-parcial-2',
        subject_id: 'sub-calc',
        title: 'Segundo Parcial de Cálculo',
        due_date: '2026-09-10T10:00:00Z',
        weight_percentage: 25,
        type: 'Parcial',
      });
      expect(createRes?.status).toBe('success');
      expect(createRes?.data.title).toBe('Segundo Parcial de Cálculo');

      // Update grade and status
      const updateRes = await handleManageDeliverables('update', {
        id: 'deliv-parcial-2',
        grade: 4.8,
        status: 'completado',
      });
      expect(updateRes?.data.grade).toBe(4.8);
      expect(updateRes?.data.status).toBe('completado');

      // Delete
      const deleteRes = await handleManageDeliverables('delete', { id: 'deliv-parcial-2' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Temarios (manage_syllabus_topics)', () => {
    it('debe gestionar unidades y temas del syllabus', async () => {
      // Create
      const createRes = await handleManageSyllabusTopics('create', {
        id: 'topic-ejes-1',
        subject_id: 'sub-geom',
        title: 'Vectores y Geometría en R3',
        mastery_status: 'en_estudio',
      });
      expect(createRes?.status).toBe('success');

      // Update status
      const updateRes = await handleManageSyllabusTopics('update', {
        id: 'topic-ejes-1',
        mastery_status: 'dominado',
      });
      expect(updateRes?.data.mastery_status).toBe('dominado');

      // Delete
      const deleteRes = await handleManageSyllabusTopics('delete', { id: 'topic-ejes-1' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('Ingesta Dinámica de Aulas Real (ingest_academic_enrollment)', () => {
    it('debe actualizar las aulas con los valores exactos confirmados por el usuario mediante JSON', async () => {
      await handleManageSubjects('create', { id: 'sub-vivamos', university_id: 'u-1', name: 'Vivamos la Universidad' });
      await handleManageSchedules('create', { id: 's-viv', subject_id: 'sub-vivamos', day_of_week: 1, start_time: '08:00', end_time: '10:00' });

      const overridesPayload = JSON.stringify({
        classroomOverrides: {
          'sub-vivamos': '2-212',
        },
      });

      const res = await handleIngestAcademicEnrollment(overridesPayload);
      expect(res.status).toBe('success');

      const schedules = res.data!.schedules;
      const vivamosSch = schedules.find((s: any) => s.subject_id === 'sub-vivamos');
      expect(vivamosSch.classroom).toBe('2-212');
    });

    it('debe actualizar aulas desde texto plano con pares clave:valor', async () => {
      await handleManageSubjects('create', { id: 'sub-geom', university_id: 'u-1', name: 'Geometría Vectorial' });
      await handleManageSchedules('create', { id: 's-geom', subject_id: 'sub-geom', day_of_week: 2, start_time: '09:00', end_time: '11:00' });

      const plainTextPayload = `
        Geometría Vectorial: 2-209
      `;

      const res = await handleIngestAcademicEnrollment(plainTextPayload);
      expect(res.status).toBe('success');

      const schedules = res.data!.schedules;
      const geomSch = schedules.find((s: any) => s.subject_id === 'sub-geom');
      expect(geomSch.classroom).toBe('2-209');
    });
  });
});
