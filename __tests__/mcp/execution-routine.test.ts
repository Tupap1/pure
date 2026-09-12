import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageRoutineSlots, handleManageTandas, handleGetToday, handleManageProgram } from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects, handleManageSchedules } from '../../mcp-server/tools-handler';
import { fetchDailyChecksFromDb } from '../../lib/db/execution-pg';

// US2 — Un solo disparador vigente (FR-009..FR-013). manage_routine_slots es la herramienta MCP
// del disparador si-entonces: create/update son estrictos (una clave de duración, tandas o
// método de estudio es sobre-especificación, no un dato cualquiera), un tras_clase hereda día y
// alternancia de sábados del horario (nunca se declaran a mano), respond fija el check de un
// hábito y es idempotente por día, y rehearse es idempotente por semana del programa. FR-012:
// "hecho" en un disparador de estudio se resuelve iniciando la tanda (manage_tandas:start con
// routine_slot_id), que liga la tanda al disparador y hereda su materia.

describe('[001] US2 — Un solo disparador vigente', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('US2-AS6 · crear un disparador con duración, número de tandas o método de estudio se rechaza (SOBRE_ESPECIFICACION)', async () => {
    const res = await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'hora',
      cue_text: 'suena la alarma',
      action_text: 'me levanto',
      anchor_time: '06:00',
      default_tandas: 3, // clave no reconocida: ni duración, ni tandas ni método pertenecen a un disparador
    } as any);
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.code).toBe('SOBRE_ESPECIFICACION');
  });

  it('un disparador tras_clase copia days_of_week y periodicity del horario de la clase', async () => {
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' });
    await handleManageSubjects('create', { id: 'sub-quimica', university_id: 'uni-1', name: 'Química' });
    await handleManageSchedules('create', {
      id: 'sch-quimica',
      subject_id: 'sub-quimica',
      day_of_week: 3,
      start_time: '08:00',
      end_time: '10:00',
      periodicity: 'sabado_b', // deliberadamente distinto de 'semanal', para comprobar que sí se copia
    });

    const res = await handleManageRoutineSlots('create', {
      days_of_week: [1], // el llamador manda un día distinto: debe ser reemplazado por el del horario
      cue_kind: 'tras_clase',
      cue_text: 'salgo de Química',
      action_text: 'repaso 10 minutos',
      schedule_id: 'sch-quimica',
      subject_id: 'sub-quimica',
    });
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      const slot = res.data as any;
      expect(slot.days_of_week).toEqual([3]);
      expect(slot.periodicity).toBe('sabado_b');
    }
  });

  it('US2-AS7 · "Empezar tanda" (manage_tandas:start con routine_slot_id) liga la tanda al disparador, hereda la materia y lo deja hecho hoy', async () => {
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' });
    await handleManageSubjects('create', { id: 'sub-calculo', university_id: 'uni-1', name: 'Cálculo' });
    const slot = await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'hora',
      cue_text: 'son las 10:00',
      action_text: 'estudio Cálculo',
      anchor_time: '10:00',
      subject_id: 'sub-calculo',
      kind: 'estudio',
    });
    expect(slot.status).toBe('success');
    if (slot.status !== 'success') return;
    const slotId = (slot.data as any).id;

    vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z')); // 10:00 Bogotá, lunes: el disparador ya está vigente
    const started = await handleManageTandas('start', { routine_slot_id: slotId });
    expect(started.status).toBe('success');
    if (started.status === 'success') {
      const tanda = (started.data as any).tanda;
      expect(tanda.routine_slot_id).toBe(slotId);
      expect(tanda.subject_id).toBe('sub-calculo'); // heredada del disparador, no se pidió al usuario
    }

    const today = await handleGetToday({}, new Date('2026-09-14T15:01:00.000Z'));
    expect(today.status).toBe('success');
    if (today.status === 'success') {
      expect((today.data as any).trigger).toBeNull(); // ya quedó hecho hoy: no vuelve a aparecer
    }
  });

  it('US2-AS8 · responder "No" en un disparador de hábito deja ese hábito como fallado hoy', async () => {
    await handleManageProgram('upsert_habit', {
      id: 'levantada_0600',
      label: 'Levantarme a las 6:00',
      started_on: '2026-09-14',
    });
    const slot = await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'hora',
      cue_text: 'suena la alarma',
      action_text: 'me levanto',
      anchor_time: '06:00',
      kind: 'habito',
      habit_id: 'levantada_0600',
    });
    expect(slot.status).toBe('success');
    if (slot.status !== 'success') return;
    const slotId = (slot.data as any).id;

    vi.setSystemTime(new Date('2026-09-14T11:10:00.000Z')); // 06:10 Bogotá
    const responded = await handleManageRoutineSlots('respond', { routine_slot_id: slotId, outcome: 'no' });
    expect(responded.status).toBe('success');

    const checkRaw = await fetchDailyChecksFromDb('2026-09-14:levantada_0600');
    const check = Array.isArray(checkRaw) ? checkRaw[0] : checkRaw;
    expect(check?.status).toBe('fallado');
  });

  it('US2-AS9 · ensayar un disparador ya ensayado esta semana no registra un segundo ensayo', async () => {
    await handleManageProgram('init', { starts_on: '2026-09-14', weeks: [{ min_tandas_dia: 1, phase: 'arranque' }] });
    const slot = await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'hora',
      cue_text: 'suena la alarma',
      action_text: 'me levanto',
      anchor_time: '06:00',
    });
    if (slot.status !== 'success') return;
    const slotId = (slot.data as any).id;

    const first = await handleManageRoutineSlots('rehearse', { routine_slot_id: slotId, program_week_id: 'pw-01' });
    expect(first.status).toBe('success');
    if (first.status === 'success') expect((first.data as any).ya_ensayado).toBe(false);

    const second = await handleManageRoutineSlots('rehearse', { routine_slot_id: slotId, program_week_id: 'pw-01' });
    expect(second.status).toBe('success');
    if (second.status === 'success') expect((second.data as any).ya_ensayado).toBe(true);
  });

  it('read marca huerfano un disparador tras_clase cuyo horario ya fue borrado', async () => {
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' });
    await handleManageSubjects('create', { id: 'sub-fisica', university_id: 'uni-1', name: 'Física' });
    await handleManageSchedules('create', {
      id: 'sch-fisica',
      subject_id: 'sub-fisica',
      day_of_week: 2,
      start_time: '08:00',
      end_time: '10:00',
    });
    const slot = await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'tras_clase',
      cue_text: 'salgo de Física',
      action_text: 'repaso',
      schedule_id: 'sch-fisica',
      subject_id: 'sub-fisica',
    });
    expect(slot.status).toBe('success');
    if (slot.status !== 'success') return;
    const slotId = (slot.data as any).id;

    await handleManageSchedules('delete', { id: 'sch-fisica' });

    const read = await handleManageRoutineSlots('read', { id: slotId });
    expect(read.status).toBe('success');
    if (read.status === 'success') expect((read.data as any).huerfano).toBe(true);
  });

  it('get_today devuelve el disparador vigente y solo uno', async () => {
    await handleManageRoutineSlots('create', { days_of_week: [1], cue_kind: 'hora', cue_text: 'son las 07', action_text: 'desayuno', anchor_time: '07:00' });
    await handleManageRoutineSlots('create', { days_of_week: [1], cue_kind: 'hora', cue_text: 'son las 09:30', action_text: 'estudio 10 min', anchor_time: '09:30' });
    await handleManageRoutineSlots('create', { days_of_week: [1], cue_kind: 'hora', cue_text: 'son las 18', action_text: 'reviso el dia', anchor_time: '18:00' });

    const today = await handleGetToday({}, new Date('2026-09-14T15:00:00.000Z')); // 10:00 Bogotá
    expect(today.status).toBe('success');
    if (today.status === 'success') {
      const trigger = (today.data as any).trigger;
      expect(trigger).not.toBeNull();
      expect(trigger.action_text).toBe('estudio 10 min'); // 09:30 es el ancla más reciente ya pasada
    }
  });
});
