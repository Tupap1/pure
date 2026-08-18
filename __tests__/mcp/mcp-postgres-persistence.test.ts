import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageUniversities,
  handleManageProfessors,
  handleManageSubjects,
  handleManageSchedules,
  handleManageDeliverables,
  handleManageSyllabusTopics,
  handleGetAcademicOverview,
  handleIngestAcademicEnrollment,
  handleParseAndIngestSyllabus,
} from '../../mcp-server/tools-handler';
import { globalOAuthStore } from '../../mcp-server/oauth-store';

describe('MCP Server PostgreSQL Real Database Persistence with pg-mem', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  it('1. should persist universities, professors, subjects and handle full CRUD', async () => {
    // CREATE University
    const uniRes = await handleManageUniversities('create', {
      id: 'uni-valle',
      name: 'Universidad del Valle',
      modality: 'presencial',
    });
    expect(uniRes.status).toBe('success');
    expect(uniRes.data.id).toBe('uni-valle');

    // READ University
    const readUni = await handleManageUniversities('read', { id: 'uni-valle' });
    expect(readUni.status).toBe('success');
    expect(readUni.data.name).toBe('Universidad del Valle');

    // CREATE Professor
    const profRes = await handleManageProfessors('create', {
      id: 'prof-turing',
      university_id: 'uni-valle',
      name: 'Alan Turing',
      email: 'turing@valle.edu.co',
    });
    expect(profRes.status).toBe('success');

    // CREATE Subject
    const subRes = await handleManageSubjects('create', {
      id: 'sub-algo',
      university_id: 'uni-valle',
      professor_id: 'prof-turing',
      name: 'Algoritmos y Estructuras de Datos',
      credits: 4,
    });
    expect(subRes.status).toBe('success');

    // CREATE Schedule
    const schedRes = await handleManageSchedules('create', {
      id: 'sch-algo-1',
      subject_id: 'sub-algo',
      day_of_week: 1,
      start_time: '08:00',
      end_time: '10:00',
      classroom: 'Aula 101',
    });
    expect(schedRes.status).toBe('success');

    // CREATE Deliverable
    const delivRes = await handleManageDeliverables('create', {
      id: 'deliv-parcial-1',
      subject_id: 'sub-algo',
      title: 'Parcial 1 Algoritmos',
      due_date: '2026-09-15T10:00:00Z',
      weight_percentage: 25,
    });
    expect(delivRes.status).toBe('success');

    // CREATE Syllabus Topic
    const topicRes = await handleManageSyllabusTopics('create', {
      id: 'topic-trees',
      subject_id: 'sub-algo',
      title: 'Árboles B y Grafos',
      mastery_status: 'en_progreso',
    });
    expect(topicRes.status).toBe('success');

    // OVERVIEW
    const overview = await handleGetAcademicOverview();
    expect(overview.status).toBe('success');
    expect(overview.data!.universitiesCount).toBe(1);
    expect(overview.data!.professorsCount).toBe(1);
    expect(overview.data!.subjectsCount).toBe(1);
  });

  it('2. should ingest academic enrollment and return valid academic overview from real DB', async () => {
    const jsonPayload = JSON.stringify({
      universities: [{ id: 'uni-valle', name: 'Universidad del Valle' }],
      professors: [{ id: 'prof-gauss', university_id: 'uni-valle', name: 'Carl Gauss' }],
      subjects: [{ id: 'sub-calc', university_id: 'uni-valle', professor_id: 'prof-gauss', name: 'Cálculo Multivariable', credits: 4 }],
      schedules: [{ id: 'sch-calc-1', subject_id: 'sub-calc', day_of_week: 1, start_time: '08:00', end_time: '10:00', classroom: 'Salón 204' }],
    });

    const ingestRes = await handleIngestAcademicEnrollment(jsonPayload);
    expect(ingestRes.status).toBe('success');

    const overview = await handleGetAcademicOverview();
    expect(overview.status).toBe('success');
    expect(overview.data!.subjectsCount).toBeGreaterThan(0);
  });

  it('3. should enforce ON CONFLICT DO UPDATE on 6 upserts without duplicating rows', async () => {
    // Insert university twice with updated passing_grade
    await handleManageUniversities('create', { id: 'uni-upsert', name: 'Uni Initial', passing_grade: 3.0 });
    await handleManageUniversities('create', { id: 'uni-upsert', name: 'Uni Updated', passing_grade: 3.5 });

    const uniList = await handleManageUniversities('read', {});
    expect(uniList.data.filter((u: any) => u.id === 'uni-upsert')).toHaveLength(1);
    expect(uniList.data.find((u: any) => u.id === 'uni-upsert').passing_grade).toBe(3.5);

    // Upsert professor
    await handleManageProfessors('create', { id: 'prof-upsert', university_id: 'uni-upsert', name: 'Prof Initial' });
    await handleManageProfessors('create', { id: 'prof-upsert', university_id: 'uni-upsert', name: 'Prof Updated' });
    const profList = await handleManageProfessors('read', {});
    expect(profList.data.filter((p: any) => p.id === 'prof-upsert')).toHaveLength(1);

    // Upsert subject
    await handleManageSubjects('create', { id: 'sub-upsert', university_id: 'uni-upsert', name: 'Sub Initial' });
    await handleManageSubjects('create', { id: 'sub-upsert', university_id: 'uni-upsert', name: 'Sub Updated' });
    const subList = await handleManageSubjects('read', {});
    expect(subList.data.filter((s: any) => s.id === 'sub-upsert')).toHaveLength(1);

    // Upsert schedule
    await handleManageSchedules('create', { id: 'sch-upsert', subject_id: 'sub-upsert', day_of_week: 1, start_time: '08:00', end_time: '10:00' });
    await handleManageSchedules('create', { id: 'sch-upsert', subject_id: 'sub-upsert', day_of_week: 1, start_time: '09:00', end_time: '11:00' });
    const schList = await handleManageSchedules('read', {});
    expect(schList.data.filter((s: any) => s.id === 'sch-upsert')).toHaveLength(1);

    // Upsert deliverable
    await handleManageDeliverables('create', { id: 'deliv-upsert', subject_id: 'sub-upsert', title: 'T1 Initial', due_date: '2026-10-01T00:00:00Z' });
    await handleManageDeliverables('create', { id: 'deliv-upsert', subject_id: 'sub-upsert', title: 'T1 Updated', due_date: '2026-10-01T00:00:00Z' });
    const delivList = await handleManageDeliverables('read', {});
    expect(delivList.data.filter((d: any) => d.id === 'deliv-upsert')).toHaveLength(1);

    // Upsert syllabus topic
    await handleManageSyllabusTopics('create', { id: 'topic-upsert', subject_id: 'sub-upsert', title: 'Topic Initial' });
    await handleManageSyllabusTopics('create', { id: 'topic-upsert', subject_id: 'sub-upsert', title: 'Topic Updated' });
    const topicList = await handleManageSyllabusTopics('read', {});
    expect(topicList.data.filter((t: any) => t.id === 'topic-upsert')).toHaveLength(1);
  });

  it('4. should enforce ON DELETE CASCADE when deleting a university', async () => {
    await handleManageUniversities('create', { id: 'uni-cascade', name: 'Uni Cascade' });
    await handleManageProfessors('create', { id: 'prof-cascade', university_id: 'uni-cascade', name: 'Prof' });
    await handleManageSubjects('create', { id: 'sub-cascade', university_id: 'uni-cascade', name: 'Subject' });
    await handleManageSchedules('create', { id: 'sch-cascade', subject_id: 'sub-cascade', day_of_week: 2, start_time: '10:00', end_time: '12:00' });

    // Delete university
    await handleManageUniversities('delete', { id: 'uni-cascade' });

    const profs = await handleManageProfessors('read', {});
    const subs = await handleManageSubjects('read', {});
    const scheds = await handleManageSchedules('read', {});

    expect(profs.data.filter((p: any) => p.id === 'prof-cascade')).toHaveLength(0);
    expect(subs.data.filter((s: any) => s.id === 'sub-cascade')).toHaveLength(0);
    expect(scheds.data.filter((sc: any) => sc.id === 'sch-cascade')).toHaveLength(0);
  });

  it('5. should reject OAuth code reuse at PostgreSQL database level', async () => {
    await globalOAuthStore.registerClient({ client_name: 'DB Test Client' });
    const code = await globalOAuthStore.createAuthCode({
      clientId: 'pure_client_db_test',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      codeChallenge: 'test_challenge_hash',
      codeChallengeMethod: 'S256',
    });

    // First redemption: success
    const res1 = await globalOAuthStore.verifyAndConsumeAuthCode({
      code,
      clientId: 'pure_client_db_test',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      codeVerifier: 'test_verifier',
    });
    // (Notice codeVerifier mismatch check will run, but at DB level row used is updated)

    // Second redemption: fails atomically at DB level
    const res2 = await globalOAuthStore.verifyAndConsumeAuthCode({
      code,
      clientId: 'pure_client_db_test',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      codeVerifier: 'test_verifier',
    });

    expect(res2.valid).toBe(false);
    expect(res2.error).toBe('invalid_grant');
    expect(res2.errorDescription).toContain('already used');
  });

  it('6. should not lose or overwrite syllabus topics of another subject when ingesting a new syllabus', async () => {
    await handleManageUniversities('create', { id: 'uni-syllabus', name: 'Uni Syllabus' });
    await handleManageSubjects('create', { id: 'sub-quimica', university_id: 'uni-syllabus', name: 'Quimica General' });
    await handleManageSubjects('create', { id: 'sub-geometria', university_id: 'uni-syllabus', name: 'Geometria Vectorial' });

    const textoQuimica = `
      Unidad 1: Estequiometria
      - Tema 1.1: Balanceo de ecuaciones
      - Tema 1.2: Moles y masa molar
      Unidad 2: Termoquimica
      - Tema 2.1: Entalpia
    `;
    const textoGeometria = `
      Unidad 1: Vectores en el plano
      - Tema 1.1: Producto punto
    `;

    const ingestaQuimica = await handleParseAndIngestSyllabus('sub-quimica', textoQuimica);
    expect(ingestaQuimica.status).toBe('success');
    const ingestaGeometria = await handleParseAndIngestSyllabus('sub-geometria', textoGeometria);
    expect(ingestaGeometria.status).toBe('success');

    const cantidadQuimica = ingestaQuimica.topics!.length;
    const cantidadGeometria = ingestaGeometria.topics!.length;

    const allTopics = await handleManageSyllabusTopics('read', {});
    const topicosQuimica = allTopics.data.filter((t: any) => t.subject_id === 'sub-quimica');
    const topicosGeometria = allTopics.data.filter((t: any) => t.subject_id === 'sub-geometria');

    expect(topicosQuimica).toHaveLength(cantidadQuimica);
    expect(topicosGeometria).toHaveLength(cantidadGeometria);
    expect(allTopics.data.filter((t: any) => t.subject_id === 'sub-quimica' || t.subject_id === 'sub-geometria'))
      .toHaveLength(cantidadQuimica + cantidadGeometria);
  });

  it('7. should replace previous syllabus topics of the same subject on re-ingestion instead of leaving orphans', async () => {
    await handleManageUniversities('create', { id: 'uni-reingest', name: 'Uni Reingest' });
    await handleManageSubjects('create', { id: 'sub-calculo', university_id: 'uni-reingest', name: 'Calculo Diferencial' });

    const textoLargo = `
      Unidad 1: Limites
      - Tema 1.1: Limites laterales
      - Tema 1.2: Continuidad
      Unidad 2: Derivadas
      - Tema 2.1: Regla de la cadena
    `;
    const textoCorto = `
      Unidad 1: Limites
      - Tema 1.1: Limites laterales
    `;

    const primeraIngesta = await handleParseAndIngestSyllabus('sub-calculo', textoLargo);
    expect(primeraIngesta.status).toBe('success');

    const segundaIngesta = await handleParseAndIngestSyllabus('sub-calculo', textoCorto);
    expect(segundaIngesta.status).toBe('success');

    const allTopics = await handleManageSyllabusTopics('read', {});
    const topicosCalculo = allTopics.data.filter((t: any) => t.subject_id === 'sub-calculo');

    expect(topicosCalculo).toHaveLength(segundaIngesta.topics!.length);
  });
});
