import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, TestDbHarness } from '../helpers/test-db';
import {
  handleManageProgram,
  handleManageTandas,
  handleManageRoutineSlots,
  handleManageWeeklyReport,
  handleGetGradeProjection,
} from '../../lib/execution/handlers';
import { handleManageUniversities, handleManageSubjects, handleManageDeliverables } from '../../mcp-server/tools-handler';
import { runExecutionTick } from '../../lib/execution/tick';
import type { ExecutionResult } from '../../lib/validations/schemas';

type PlanWeekAction = 'preview' | 'set_intentions' | 'open_view';
type HandlePlanWeek = (action: PlanWeekAction, data?: unknown, now?: Date) => Promise<ExecutionResult>;

// lib/execution/handlers.ts todavía no exporta handlePlanWeek a la altura de este commit RED
// (T066 lo agrega): se carga con import() dinámico, igual que execution-planning.test.ts (US8),
// para que cada prueba falle por su propia razón (TypeError) y no por un import roto.
let handlePlanWeek: HandlePlanWeek;

// US9 — Semana con compuerta y alertas en la agenda (FR-037, FR-028). La compuerta de
// plan_week:open_view y el conteo en el reporte son lo nuevo de esta historia; el cálculo de las
// alertas ciega/abandonada ya está probado en __tests__/mcp/grade-projection-tool.test.ts (US5) —
// US9-AS3 aquí solo confirma que quedan disponibles con la forma que la Agenda necesita.
describe('[001] US9 — Semana con compuerta y alertas en la agenda', () => {
  let harness: TestDbHarness;

  beforeAll(async () => {
    harness = await createTestDb();
    const modulePath = '../../lib/execution/handlers';
    ({ handlePlanWeek } = await import(/* @vite-ignore */ modulePath));
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setupProgram(weekCount = 1) {
    return handleManageProgram('init', {
      starts_on: '2026-09-14', // lunes
      weeks: Array.from({ length: weekCount }, () => ({ min_tandas_dia: 1 })),
    });
  }

  it('US9-AS1 · la tercera apertura de la vista de semana en la misma semana pide una razón, que queda registrada y contada', async () => {
    await setupProgram();
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes 15 sep, 10:00 Bogotá

    const first = await handlePlanWeek('open_view');
    expect(first.status).toBe('success');
    if (first.status === 'success') {
      expect((first.data as any).allowed).toBe(true);
      expect((first.data as any).needs_reason).toBe(false);
      expect((first.data as any).opens_this_week).toBe(1);
    }

    const second = await handlePlanWeek('open_view');
    expect(second.status).toBe('success');
    if (second.status === 'success') {
      expect((second.data as any).needs_reason).toBe(false);
      expect((second.data as any).opens_this_week).toBe(2);
    }

    const thirdSinRazon = await handlePlanWeek('open_view');
    expect(thirdSinRazon.status).toBe('error');
    if (thirdSinRazon.status === 'error') expect(thirdSinRazon.code).toBe('RAZON_REQUERIDA');

    const thirdConRazon = await handlePlanWeek('open_view', { reason: 'reviso si voy bien antes del parcial' });
    expect(thirdConRazon.status).toBe('success');
    if (thirdConRazon.status === 'success') {
      expect((thirdConRazon.data as any).needs_reason).toBe(true);
      expect((thirdConRazon.data as any).opens_this_week).toBe(3);
    }

    // Contada en el reporte semanal: se congela la semana (domingo 19:00 ya pasado) y se revisa
    // la línea "Aperturas del plan" del payload — solo la 3.ª apertura pasó por la compuerta.
    vi.setSystemTime(new Date('2026-09-21T00:05:00.000Z')); // domingo 19:05 Bogotá: corte ya pasado
    await runExecutionTick(new Date(), { mailer: { send: async () => {} } });

    const report = await handleManageWeeklyReport('read', { program_week_id: 'pw-01' });
    expect(report.status).toBe('success');
    if (report.status === 'success') {
      expect((report.data as any).payload.aperturas_plan).toEqual({ total: 3, con_razon: 1, libres_usadas: 2 });
    }
  });

  it('US9-AS2 · la vista de semana muestra cada disparador con su resultado y las tandas por día, sin gráficas', async () => {
    await setupProgram();
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA' });
    await handleManageSubjects('create', { id: 'sub-1', university_id: 'uni-1', name: 'Cálculo' });
    const slot = await handleManageRoutineSlots('create', {
      days_of_week: [2],
      cue_kind: 'hora',
      cue_text: 'son las 10am',
      action_text: 'estudio cálculo',
      anchor_time: '10:00',
      subject_id: 'sub-1',
    });
    expect(slot.status).toBe('success');
    if (slot.status !== 'success') return;
    const slotId = (slot.data as any).id as string;

    vi.setSystemTime(new Date('2026-09-15T15:05:00.000Z')); // martes 15 sep, 10:05 Bogotá: ya venció
    await handleManageRoutineSlots('respond', { routine_slot_id: slotId, outcome: 'hecho' });
    await handleManageTandas('start', { subject_id: 'sub-1' });

    const opened = await handlePlanWeek('open_view');
    expect(opened.status).toBe('success');
    if (opened.status !== 'success') return;

    const data = opened.data as any;
    // Rejilla plana (arrays/objetos con fechas y estados): nunca una serie pensada para
    // graficar (DESIGN.md prohíbe barras/líneas/anillos en esta vista).
    expect(Array.isArray(data.disparadores)).toBe(true);
    expect(Array.isArray(data.tandas_por_dia)).toBe(true);

    const row = data.disparadores.find((d: any) => d.id === slotId);
    expect(row).toBeDefined();
    expect(row.dias['2026-09-15']).toBe('hecho');

    const dayTandas = data.tandas_por_dia.find((d: any) => d.date === '2026-09-15');
    expect(dayTandas).toBeDefined();
  });

  it('US9-AS3 · la agenda muestra las alertas de materias abandonadas o sin evaluaciones (ciegas)', async () => {
    await handleManageUniversities('create', { id: 'uni-1', name: 'UdeA', scale_max: 5, passing_grade: 3.0 });
    await handleManageSubjects('create', { id: 'sub-ciega', university_id: 'uni-1', name: 'Termodinámica' });
    await handleManageSubjects('create', { id: 'sub-abandonada', university_id: 'uni-1', name: 'Química' });

    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z')); // martes 15 sep, 10:00 Bogotá
    await handleManageDeliverables('create', {
      id: 'ev-quimica',
      subject_id: 'sub-abandonada',
      title: 'Parcial 2',
      weight_percentage: 30,
      status: 'pendiente',
      due_date: '2026-09-18T23:59:00.000Z',
    });

    const res = await handleGetGradeProjection();
    expect(res.status).toBe('success');
    if (res.status !== 'success') return;

    const alertas = (res.data as any).alertas as { kind: string; subject_id: string; detalle: string }[];
    // Estos son exactamente los campos que components/dashboards/DeliverablesDashboard.tsx
    // (Agenda) consume vía GET /api/execution/grade-projection (T070); el cálculo en sí ya está
    // cubierto por __tests__/mcp/grade-projection-tool.test.ts (US5).
    expect(alertas.find((a) => a.kind === 'ciega' && a.subject_id === 'sub-ciega')).toBeTruthy();
    expect(alertas.find((a) => a.kind === 'abandonada' && a.subject_id === 'sub-abandonada')).toBeTruthy();
    for (const alerta of alertas) {
      expect(typeof alerta.detalle).toBe('string');
    }
  });
});
