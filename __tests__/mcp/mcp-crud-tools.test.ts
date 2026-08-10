import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
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

describe('MCP Server - Suite de Herramientas CRUD y Parsing Dinámico (con pg-mem)', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
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
      const updateRes = await handleManageUniversities('create', { id: 'uni-test-mit', name: 'MIT', passing_grade: 4.0 });
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
      await handleManageUniversities('create', { id: 'uni-udea', name: 'UdeA' });

      // Create
      const createRes = await handleManageProfessors('create', {
        id: 'prof-test-1',
        university_id: 'uni-udea',
        name: 'Dra. María Curie',
        email: 'mcurie@udea.edu.co',
      });
      expect(createRes?.status).toBe('success');
      expect(createRes?.data.name).toBe('Dra. María Curie');

      // Read
      const readRes = await handleManageProfessors('read', { id: 'prof-test-1' });
      expect(readRes?.data.email).toBe('mcurie@udea.edu.co');

      // Update
      const updateRes = await handleManageProfessors('create', { id: 'prof-test-1', university_id: 'uni-udea', name: 'Dra. María Curie', office_hours: 'Lunes 14:00-16:00' });
      expect(updateRes?.data.office_hours).toBe('Lunes 14:00-16:00');

      // Delete
      const deleteRes = await handleManageProfessors('delete', { id: 'prof-test-1' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Materias (manage_subjects)', () => {
    it('debe crear, leer, actualizar y eliminar una asignatura', async () => {
      await handleManageUniversities('create', { id: 'uni-udea', name: 'UdeA' });

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
      const updateRes = await handleManageSubjects('create', { id: 'sub-test-propulsion', university_id: 'uni-udea', name: 'Propulsión Aeroespacial', credits: 5 });
      expect(updateRes?.data.credits).toBe(5);

      // Delete
      const deleteRes = await handleManageSubjects('delete', { id: 'sub-test-propulsion' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Horarios y Aulas (manage_schedules)', () => {
    it('debe asignar y modificar aulas personalizadas', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-intro-aero', university_id: 'u-1', name: 'Intro Aero' });

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
      const updateRes = await handleManageSchedules('create', { id: 'sch-test-aero', subject_id: 'sub-intro-aero', day_of_week: 3, start_time: '15:00', end_time: '17:00', classroom: 'Aula 2-209' });
      expect(updateRes?.data.classroom).toBe('Aula 2-209');

      // Delete
      const deleteRes = await handleManageSchedules('delete', { id: 'sch-test-aero' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Entregables / Parciales (manage_deliverables)', () => {
    it('debe gestionar actividades y parciales', async () => {
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-calc', university_id: 'u-1', name: 'Cálculo' });

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
      const updateRes = await handleManageDeliverables('create', {
        id: 'deliv-parcial-2',
        subject_id: 'sub-calc',
        title: 'Segundo Parcial de Cálculo',
        due_date: '2026-09-10T10:00:00Z',
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
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
      await handleManageSubjects('create', { id: 'sub-geom', university_id: 'u-1', name: 'Geometría' });

      // Create
      const createRes = await handleManageSyllabusTopics('create', {
        id: 'topic-ejes-1',
        subject_id: 'sub-geom',
        title: 'Vectores y Geometría en R3',
        mastery_status: 'en_estudio',
      });
      expect(createRes?.status).toBe('success');

      // Update status
      const updateRes = await handleManageSyllabusTopics('create', {
        id: 'topic-ejes-1',
        subject_id: 'sub-geom',
        title: 'Vectores y Geometría en R3',
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
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
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
      await handleManageUniversities('create', { id: 'u-1', name: 'U1' });
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
