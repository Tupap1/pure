import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleIngestAcademicEnrollment,
  handleManageUniversities,
  handleManageSubjects,
  handleManageSchedules,
} from '../../mcp-server/tools-handler';
import { pgPool } from '../../lib/db/pg-client';

describe('MCP Tool: ingest_academic_enrollment (Manejo de entrada y errores sin fallbacks falsos)', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  it('1. JSON válido con las 4 entidades -> persisten en BD y los conteos de la respuesta coinciden', async () => {
    const jsonPayload = JSON.stringify({
      universities: [{ id: 'u-eafit', name: 'Universidad EAFIT' }],
      professors: [{ id: 'p-euler', university_id: 'u-eafit', name: 'Leonhard Euler' }],
      subjects: [{ id: 's-analisis', university_id: 'u-eafit', professor_id: 'p-euler', name: 'Análisis Numérico', credits: 3 }],
      schedules: [{ id: 'sch-an-1', subject_id: 's-analisis', day_of_week: 1, start_time: '07:00', end_time: '09:00', classroom: 'Ingeniería 301' }],
    });

    const res = await handleIngestAcademicEnrollment(jsonPayload);

    expect(res.status).toBe('success');
    expect(res.data).toBeDefined();
    expect(res.data!.universitiesCount).toBe(1);
    expect(res.data!.professorsCount).toBe(1);
    expect(res.data!.subjectsCount).toBe(1);
    expect(res.data!.schedulesCount).toBe(1);

    // Verificar en la BD pg-mem real
    const uniCheck = await pgPool.query('SELECT name FROM universities WHERE id = $1', ['u-eafit']);
    expect(uniCheck.rows[0].name).toBe('Universidad EAFIT');

    const schCheck = await pgPool.query('SELECT classroom FROM schedules WHERE id = $1', ['sch-an-1']);
    expect(schCheck.rows[0].classroom).toBe('Ingeniería 301');
  });

  it('2. Texto plano con base vacía -> retorna status "error" con error "invalid_input", NO "success"', async () => {
    const invalidText = 'Esta es una cadena de texto sin formato válido ni materias en BD';

    const res = await handleIngestAcademicEnrollment(invalidText);

    expect(res.status).toBe('error');
    expect(res.error).toBe('invalid_input');
    expect(res.message).toContain('El texto de entrada no es un JSON válido');
  });

  it('3. Excepción en save*ToDb (error de BD/FK) -> retorna status "error", NO cae a la rama de texto plano', async () => {
    // Intentar guardar un subject con un university_id inexistente provoca una violación de Foreign Key en Postgres
    const invalidFkJson = JSON.stringify({
      subjects: [{ id: 's-broken', university_id: 'uni-inexistente-12345', name: 'Materia Rota' }],
    });

    const res = await handleIngestAcademicEnrollment(invalidFkJson);

    expect(res.status).toBe('error');
    expect(res.message).toBeDefined();
    // Debe reportar error de BD, NO el mensaje de la rama de texto plano ("El texto de entrada no es un JSON válido...")
    expect(res.error).toBeUndefined();
    expect(res.message).not.toContain('El texto de entrada no es un JSON válido');
  });

  it('4. Texto plano con materias y horarios existentes -> sigue renombrando aulas correctamente', async () => {
    // Preparar base de datos previa con materia y horario
    await handleManageUniversities('create', { id: 'u-udea', name: 'Universidad de Antioquia' });
    await handleManageSubjects('create', { id: 'sub-fisica', university_id: 'u-udea', name: 'Física de Campos' });
    await handleManageSchedules('create', { id: 'sch-fis', subject_id: 'sub-fisica', day_of_week: 2, start_time: '10:00', end_time: '12:00', classroom: 'Por Asignar' });

    const plainTextPayload = 'Física de Campos: Bloque 21-302';

    const res = await handleIngestAcademicEnrollment(plainTextPayload);

    expect(res.status).toBe('success');
    expect(res.data!.classroomsUpdated).toBe(1);

    // Verificar en la BD real pg-mem que el aula cambió a "Bloque 21-302"
    const schCheck = await pgPool.query('SELECT classroom FROM schedules WHERE id = $1', ['sch-fis']);
    expect(schCheck.rows[0].classroom).toBe('Bloque 21-302');
  });

  it('5. JSON con schedules con periodicity -> persiste el valor de periodicity en BD', async () => {
    const jsonPayload = JSON.stringify({
      universities: [{ id: 'u-udec', name: 'Universidad del Cauca' }],
      subjects: [{ id: 's-tutoría', university_id: 'u-udec', name: 'Tutoría Proyecto' }],
      schedules: [
        { id: 'sch-tut-a', subject_id: 's-tutoría', day_of_week: 6, start_time: '08:00', end_time: '12:00', classroom: 'Aula 101', periodicity: 'sabado_a' },
        { id: 'sch-tut-b', subject_id: 's-tutoría', day_of_week: 6, start_time: '13:00', end_time: '17:00', classroom: 'Aula 102', periodicity: 'sabado_b' },
      ],
    });

    const res = await handleIngestAcademicEnrollment(jsonPayload);
    expect(res.status).toBe('success');
    expect(res.data!.schedulesCount).toBe(2);

    const checkA = await pgPool.query('SELECT periodicity FROM schedules WHERE id = $1', ['sch-tut-a']);
    expect(checkA.rows[0].periodicity).toBe('sabado_a');

    const checkB = await pgPool.query('SELECT periodicity FROM schedules WHERE id = $1', ['sch-tut-b']);
    expect(checkB.rows[0].periodicity).toBe('sabado_b');
  });
});
