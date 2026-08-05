import { describe, it, expect } from 'vitest';
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
import { executeToolCall, TOOLS_LIST } from '../../mcp-server/index';

describe('MCP Server - Suite de Herramientas CRUD y Parsing Dinámico', () => {
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
    it('debe crear, leer, actualizar y eliminar una universidad', () => {
      // 1. Create
      const createRes = handleManageUniversities('create', {
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
      const readRes = handleManageUniversities('read', { id: 'uni-test-mit' });
      expect(readRes?.status).toBe('success');
      expect(readRes?.data.name).toContain('MIT');

      // 3. Update
      const updateRes = handleManageUniversities('update', { id: 'uni-test-mit', passing_grade: 4.0 });
      expect(updateRes?.status).toBe('success');
      expect(updateRes?.data.passing_grade).toBe(4.0);

      // 4. Delete
      const deleteRes = handleManageUniversities('delete', { id: 'uni-test-mit' });
      expect(deleteRes?.status).toBe('success');

      // Verify deletion
      const verifyRead = handleManageUniversities('read', { id: 'uni-test-mit' });
      expect(verifyRead?.data).toBeNull();
    });
  });

  describe('CRUD de Profesores (manage_professors)', () => {
    it('debe crear, leer, actualizar y eliminar un profesor', () => {
      // Create
      const createRes = handleManageProfessors('create', {
        id: 'prof-test-1',
        university_id: 'uni-udea',
        name: 'Dra. María Curiez',
        email: 'mcurie@udea.edu.co',
      });
      expect(createRes?.status).toBe('success');
      expect(createRes?.data.name).toBe('Dra. María Curiez');

      // Read
      const readRes = handleManageProfessors('read', { id: 'prof-test-1' });
      expect(readRes?.data.email).toBe('mcurie@udea.edu.co');

      // Update
      const updateRes = handleManageProfessors('update', { id: 'prof-test-1', office_hours: 'Lunes 14:00-16:00' });
      expect(updateRes?.data.office_hours).toBe('Lunes 14:00-16:00');

      // Delete
      const deleteRes = handleManageProfessors('delete', { id: 'prof-test-1' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Materias (manage_subjects)', () => {
    it('debe crear, leer, actualizar y eliminar una asignatura', () => {
      // Create
      const createRes = handleManageSubjects('create', {
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
      const readRes = handleManageSubjects('read', { id: 'sub-test-propulsion' });
      expect(readRes?.data.name).toBe('Propulsión Aeroespacial');

      // Update
      const updateRes = handleManageSubjects('update', { id: 'sub-test-propulsion', credits: 5 });
      expect(updateRes?.data.credits).toBe(5);

      // Delete
      const deleteRes = handleManageSubjects('delete', { id: 'sub-test-propulsion' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Horarios y Aulas (manage_schedules)', () => {
    it('debe asignar y modificar aulas personalizadas', () => {
      // Create
      const createRes = handleManageSchedules('create', {
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
      const updateRes = handleManageSchedules('update', { id: 'sch-test-aero', classroom: 'Aula 2-209' });
      expect(updateRes?.data.classroom).toBe('Aula 2-209');

      // Delete
      const deleteRes = handleManageSchedules('delete', { id: 'sch-test-aero' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Entregables / Parciales (manage_deliverables)', () => {
    it('debe gestionar actividades y parciales', () => {
      // Create
      const createRes = handleManageDeliverables('create', {
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
      const updateRes = handleManageDeliverables('update', {
        id: 'deliv-parcial-2',
        grade: 4.8,
        status: 'completado',
      });
      expect(updateRes?.data.grade).toBe(4.8);
      expect(updateRes?.data.status).toBe('completado');

      // Delete
      const deleteRes = handleManageDeliverables('delete', { id: 'deliv-parcial-2' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('CRUD de Temarios (manage_syllabus_topics)', () => {
    it('debe gestionar unidades y temas del syllabus', () => {
      // Create
      const createRes = handleManageSyllabusTopics('create', {
        id: 'topic-ejes-1',
        subject_id: 'sub-geom',
        title: 'Vectores y Geometría en R3',
        mastery_status: 'en_estudio',
      });
      expect(createRes?.status).toBe('success');

      // Update status
      const updateRes = handleManageSyllabusTopics('update', {
        id: 'topic-ejes-1',
        mastery_status: 'dominado',
      });
      expect(updateRes?.data.mastery_status).toBe('dominado');

      // Delete
      const deleteRes = handleManageSyllabusTopics('delete', { id: 'topic-ejes-1' });
      expect(deleteRes?.status).toBe('success');
    });
  });

  describe('Ingesta Dinámica de Aulas Real (ingest_academic_enrollment)', () => {
    it('debe actualizar las aulas con los valores exactos confirmados por el usuario mediante JSON', () => {
      const overridesPayload = JSON.stringify({
        classroomOverrides: {
          'sub-vivamos': '2-212',
          'sub-geom': '2-209',
          'sub-calc': '2-209',
          'sub-quim': '2-306',
        },
      });

      const res = handleIngestAcademicEnrollment(overridesPayload);
      expect(res.status).toBe('success');

      const schedules = res.data.schedules;
      const vivamosSch = schedules.find((s: any) => s.subject_id === 'sub-vivamos');
      const geomSch = schedules.find((s: any) => s.subject_id === 'sub-geom');
      const calcSch = schedules.find((s: any) => s.subject_id === 'sub-calc');

      expect(vivamosSch.classroom).toBe('2-212');
      expect(geomSch.classroom).toBe('2-209');
      expect(calcSch.classroom).toBe('2-209');
    });

    it('debe actualizar aulas desde texto plano con pares clave:valor', () => {
      const plainTextPayload = `
        Vivamos la Universidad: 2-212
        Geometría Vectorial: 2-209
        Cálculo Diferencial: 2-209
        Química General: 2-306
      `;

      const res = handleIngestAcademicEnrollment(plainTextPayload);
      expect(res.status).toBe('success');

      const schedules = res.data.schedules;
      const geomSch = schedules.find((s: any) => s.subject_id === 'sub-geom');
      expect(geomSch.classroom).toBe('2-209');
    });
  });

  describe('Despachador Central (executeToolCall)', () => {
    it('debe despachar correctamente todas las herramientas por nombre', () => {
      const overview = executeToolCall('get_academic_overview', {});
      expect(overview.status).toBe('success');

      const uniCreate = executeToolCall('manage_universities', {
        action: 'create',
        data: { name: 'Universidad de Prueba', scale_min: 0, scale_max: 5, passing_grade: 3 },
      });
      expect(uniCreate.status).toBe('success');

      const uniRead = executeToolCall('manage_universities', { action: 'read' });
      expect(uniRead.data.length).toBeGreaterThan(0);
    });
  });
});
