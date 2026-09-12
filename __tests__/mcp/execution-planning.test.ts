import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import { handleManageProgram, handleManageRoutineSlots } from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects, handleManageDeliverables } from '../../mcp-server/tools-handler';
import type { ExecutionResult } from '../../lib/validations/schemas';

type ManageTasksAction = 'create' | 'read' | 'update' | 'delete' | 'today';
type PlanWeekAction = 'preview' | 'set_intentions' | 'open_view';
type HandleManageTasks = (action: ManageTasksAction, data?: unknown, now?: Date) => Promise<ExecutionResult>;
type HandlePlanWeek = (action: PlanWeekAction, data?: unknown, now?: Date) => Promise<ExecutionResult>;

// lib/execution/handlers.ts todavía no exporta handleManageTasks ni handlePlanWeek a la altura
// de este commit RED (T066 los agrega): se cargan con import() dinámico en el beforeAll, igual
// que __tests__/mcp/weekly-report.test.ts hizo con runExecutionTick en US6, para que cada
// prueba falle por su propia razón (TypeError al llamar una función que no existe) y no por un
// import roto que tumbe la recolección del archivo entero.
let handleManageTasks: HandleManageTasks;
let handlePlanWeek: HandlePlanWeek;

// US8 — Planeación del domingo y tareas (FR-034..FR-037). plan_week reutiliza
// computeAcademicLoad (norma de créditos, ya probado en __tests__/algorithms/academic-load.test.ts)
// para el reparto sugerido, y projectSubjectGrade/computeAlerts (US5, ya probados) para la
// proyección y las alertas: esta prueba no vuelve a probar esa aritmética, solo que plan_week la
// ensambla y aplica las reglas propias de US8 (intención < 6, tareas de 1-3 tandas, sin arrastre).
describe('[001] US8 — Planeación del domingo y tareas', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
    const modulePath = '../../lib/execution/handlers';
    ({ handleManageTasks, handlePlanWeek } = await import(/* @vite-ignore */ modulePath));
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // lunes 2026-09-14 = pw-01, lunes 2026-09-21 = pw-02.
  async function setupProgram(weekCount = 2) {
    return handleManageProgram('init', {
      starts_on: '2026-09-14',
      weeks: Array.from({ length: weekCount }, () => ({ min_tandas_dia: 1 })),
    });
  }

  it('US8-AS1 · una intención menor a 6 sin razón se rechaza; esa materia no recibe disparadores sugeridos', async () => {
    await setupProgram();
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA', scale_max: 5, passing_grade: 3.0 });
    await handleManageSubjects('create', { id: 'sub-baja', university_id: 'uni-1', name: 'Termodinámica', credits: 3 });
    await handleManageSubjects('create', { id: 'sub-normal', university_id: 'uni-1', name: 'Cálculo', credits: 3 });

    const sinRazon = await handlePlanWeek('set_intentions', {
      program_week_id: 'pw-02',
      items: [{ subject_id: 'sub-baja', strength: 3 }],
    });
    expect(sinRazon.status).toBe('error');
    if (sinRazon.status === 'error') expect(sinRazon.code).toBe('RAZON_REQUERIDA');

    const conRazon = await handlePlanWeek('set_intentions', {
      program_week_id: 'pw-02',
      items: [
        { subject_id: 'sub-baja', strength: 3, reason: 'ya la voy a perder, prioridad baja esta semana' },
        { subject_id: 'sub-normal', strength: 8 },
      ],
    });
    expect(conRazon.status).toBe('success');

    const preview = await handlePlanWeek('preview', { program_week_id: 'pw-02' });
    expect(preview.status).toBe('success');
    if (preview.status !== 'success') return;

    const reparto = (preview.data as any).reparto_sugerido as { subject_id: string }[];
    expect(reparto.find((r) => r.subject_id === 'sub-baja')).toBeUndefined();
    expect(reparto.find((r) => r.subject_id === 'sub-normal')).toBeDefined();
  });

  it('US8-AS2 · una tarea estimada en más de 3 tandas se rechaza pidiendo partirla', async () => {
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' });
    await handleManageSubjects('create', { id: 'sub-1', university_id: 'uni-1', name: 'Cálculo' });

    const rechazada = await handleManageTasks('create', {
      title: 'Proyecto final completo',
      subject_id: 'sub-1',
      estimated_tandas: 4,
    });
    expect(rechazada.status).toBe('error');
    if (rechazada.status === 'error') expect(rechazada.code).toBe('PARTIR_TAREA');

    const aceptada = await handleManageTasks('create', {
      title: 'Proyecto final, parte 1',
      subject_id: 'sub-1',
      estimated_tandas: 3,
    });
    expect(aceptada.status).toBe('success');
  });

  it('US8-AS3 · las tareas de ayer sin hacer no aparecen arrastradas como pendientes de hoy', async () => {
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' });
    await handleManageSubjects('create', { id: 'sub-1', university_id: 'uni-1', name: 'Cálculo' });

    await handleManageTasks('create', {
      id: 'task-ayer',
      title: 'Taller de ayer sin hacer',
      subject_id: 'sub-1',
      estimated_tandas: 1,
      scheduled_date: '2026-09-14',
      status: 'pendiente',
    });
    await handleManageTasks('create', {
      id: 'task-hoy',
      title: 'Taller de hoy',
      subject_id: 'sub-1',
      estimated_tandas: 1,
      scheduled_date: '2026-09-15',
    });

    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes 15 sep, 10:00 Bogotá

    const today = await handleManageTasks('today');
    expect(today.status).toBe('success');
    if (today.status !== 'success') return;

    const ids = (today.data as any[]).map((t) => t.id);
    expect(ids).toContain('task-hoy');
    expect(ids).not.toContain('task-ayer');
  });

  it('US8-AS4 · el reparto sugerido de tandas sale de las horas de trabajo independiente de la norma de créditos, con urgencia y proyección aparte', async () => {
    await setupProgram();
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA', scale_max: 5, passing_grade: 3.0 });
    // 3 créditos, sin horario registrado: toda la norma (3 * 48h / 16 semanas = 9h/sem) es
    // trabajo independiente (calculateCreditLoad, ya probado en __tests__/algorithms).
    await handleManageSubjects('create', { id: 'sub-1', university_id: 'uni-1', name: 'Cálculo', credits: 3 });

    const preview = await handlePlanWeek('preview', { program_week_id: 'pw-01' });
    expect(preview.status).toBe('success');
    if (preview.status !== 'success') return;

    const reparto = (preview.data as any).reparto_sugerido as Array<{
      subject_id: string;
      suggested_tandas: number;
      normative_hours: number;
      urgencia: number;
      proyeccion: unknown;
    }>;
    const row = reparto.find((r) => r.subject_id === 'sub-1');
    expect(row).toBeDefined();
    expect(row!.normative_hours).toBeCloseTo(9, 1);
    expect(row!.suggested_tandas).toBe(54); // 9h * 6 tandas/h (tandas de 10 min)
    // Urgencia y proyección son columnas aparte del número de horas (FR-036): nunca mezcladas.
    expect(row).toHaveProperty('urgencia');
    expect(row).toHaveProperty('proyeccion');
  });

  it('US8-AS5 · la planeación del domingo muestra la semana pasada, las entregas de 14 días, las intenciones, los disparadores y su ensayo', async () => {
    vi.setSystemTime(new Date('2026-09-21T01:00:00.000Z')); // domingo 20 sep, 20:00 Bogotá
    await setupProgram();
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA', scale_max: 5, passing_grade: 3.0 });
    await handleManageSubjects('create', { id: 'sub-1', university_id: 'uni-1', name: 'Cálculo', credits: 3 });
    await handleManageDeliverables('create', {
      id: 'ev-1',
      subject_id: 'sub-1',
      title: 'Quiz 3',
      weight_percentage: 20,
      status: 'pendiente',
      due_date: '2026-09-25T23:59:00.000Z', // dentro de los 14 días desde el domingo 20
    });
    const slot = await handleManageRoutineSlots('create', {
      days_of_week: [1],
      cue_kind: 'hora',
      cue_text: 'son las 6pm',
      action_text: 'estudio cálculo',
      anchor_time: '18:00',
      subject_id: 'sub-1',
    });
    expect(slot.status).toBe('success');
    if (slot.status !== 'success') return;
    const slotId = (slot.data as any).id as string;

    const preview = await handlePlanWeek('preview');
    expect(preview.status).toBe('success');
    if (preview.status !== 'success') return;

    const data = preview.data as any;
    expect(data.program_week_id).toBe('pw-02'); // domingo: planea la semana que viene
    expect(data.semana_pasada).toBeTruthy(); // la semana que termina hoy (pw-01)
    expect(data.entregas_14_dias.some((e: any) => e.id === 'ev-1')).toBe(true);
    expect(Array.isArray(data.intenciones)).toBe(true);

    const trigger = data.disparadores.find((d: any) => d.id === slotId);
    expect(trigger).toBeDefined();
    expect(trigger.ensayado).toBe(false);

    const rehearsed = await handleManageRoutineSlots('rehearse', { routine_slot_id: slotId, program_week_id: 'pw-02' });
    expect(rehearsed.status).toBe('success');

    const previewAfter = await handlePlanWeek('preview');
    if (previewAfter.status !== 'success') return;
    const triggerAfter = (previewAfter.data as any).disparadores.find((d: any) => d.id === slotId);
    expect(triggerAfter.ensayado).toBe(true);
  });
});
