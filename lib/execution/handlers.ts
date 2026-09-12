// Handlers únicos del Módulo de Ejecución (Constitución, Principio I: una sola vía de datos).
// El servidor MCP los re-exporta tal cual desde mcp-server/tools-handler.ts y las rutas
// app/api/execution/* los llaman directamente: ninguno de los dos reimplementa las reglas.
//
// Contrato de respuesta (contracts/mcp-tools.md): { status: 'success', message?, data? } o
// { status: 'error', code, message }. La validación de forma vive en los esquemas Zod de
// lib/validations/schemas.ts; este archivo solo despacha por `action` y traduce ZodError con
// `zodErrorToExecutionResult`.

import {
  ExecutionProgramInitSchema,
  ExecutionProgramUpdateWeekSchema,
  HabitUpsertSchema,
  HabitRetireSchema,
  TandaStartSchema,
  TandaFinishSchema,
  TandaInterruptSchema,
  TandaReadSchema,
  TandaUpdateSchema,
  RoutineSlotSchema,
  RoutineSlotReadSchema,
  RoutineSlotDeleteSchema,
  RoutineSlotRespondSchema,
  RoutineSlotRehearseSchema,
  DailyCheckSetSchema,
  DailyChecksReadSchema,
  GradeProjectionReadSchema,
  AccountabilityPartnerSetSchema,
  WeeklyReportPreviewSchema,
  WeeklyReportNoteSchema,
  WeeklyReportSendSchema,
  WeeklyReportReadSchema,
  ComplianceReportReadSchema,
  ExecutionTaskSchema,
  ExecutionTaskUpdateSchema,
  ExecutionTaskReadSchema,
  ExecutionTaskDeleteSchema,
  IntentionsSetSchema,
  PlanWeekPreviewSchema,
  PlanWeekOpenViewSchema,
  zodErrorToExecutionResult,
  type ExecutionResult,
} from '../validations/schemas';
import { initProgram, readProgram, updateProgramWeek, upsertHabit, retireHabit } from './program';
import { startTanda, finishTanda, interruptTanda, currentTanda, readTandas, updateTanda } from './tandas';
import { getToday } from './today';
import {
  upsertRoutineSlot,
  readRoutineSlots,
  deleteRoutineSlot,
  respondToRoutineSlot,
  rehearseRoutineSlot,
} from './routine';
import { setDailyCheck, readDailyChecks } from './checks';
import { computeGradeProjections } from './grade-projection';
import { getCompliance } from './compliance';
import { buildReportPayload, deriveRiskSection, renderReportText, type BuildReportPayloadInput } from './report';
import { runExecutionTick, attemptSend } from './tick';
import { createZeptoMailer } from './mailer';
import { createWebPusher } from './push';
import { addDays, localParts } from './time';
import {
  createTask,
  readTasks,
  updateTask,
  deleteTask,
  getTodayTasks,
  setIntentions,
  previewPlanWeek,
  openPlanView,
  countGatedPlanOpenings,
} from './planning';
import {
  fetchProgramWeeksFromDb,
  fetchWeeklyReportsFromDb,
  setActivePartnerInDb,
  fetchActivePartnerFromDb,
  updateWeeklyReportNoteInDb,
  ProgramWeekRecord,
  WeeklyReportRecord,
} from '../db/execution-pg';

export type ManageProgramAction = 'init' | 'read' | 'update_week' | 'upsert_habit' | 'retire_habit';

/**
 * `manage_program`: crear/leer el programa de semanas y dar de alta/retirar hábitos. Es
 * fundacional porque el resto de historias (US1-US9) consultan la semana en curso y los
 * hábitos activos que este handler expone vía `read`.
 */
export async function handleManageProgram(
  action: ManageProgramAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'init': {
        const parsed = ExecutionProgramInitSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await initProgram(parsed.data);
      }
      case 'read': {
        return await readProgram(now);
      }
      case 'update_week': {
        const parsed = ExecutionProgramUpdateWeekSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await updateProgramWeek(parsed.data, now);
      }
      case 'upsert_habit': {
        const parsed = HabitUpsertSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await upsertHabit(parsed.data);
      }
      case 'retire_habit': {
        const parsed = HabitRetireSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await retireHabit(parsed.data);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_program: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_program',
    };
  }
}

export type ManageTandasAction = 'start' | 'finish' | 'interrupt' | 'current' | 'read' | 'update';

/**
 * `manage_tandas` (US1): la tanda de 10 minutos en un toque. `start`/`finish`/`interrupt`/
 * `update` validan su forma con los esquemas Zod estrictos de schemas.ts (que ya rechazan
 * `started_at`/`ended_at` del cliente por ser claves no reconocidas) y delegan las reglas de
 * negocio en lib/execution/tandas.ts. `current` no tiene esquema propio: no recibe `data`.
 */
export async function handleManageTandas(
  action: ManageTandasAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'start': {
        const parsed = TandaStartSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await startTanda(parsed.data, now);
      }
      case 'finish': {
        const parsed = TandaFinishSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await finishTanda(parsed.data.id, now);
      }
      case 'interrupt': {
        const parsed = TandaInterruptSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await interruptTanda(parsed.data, now);
      }
      case 'current': {
        return await currentTanda(now);
      }
      case 'read': {
        const parsed = TandaReadSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await readTandas(parsed.data, now);
      }
      case 'update': {
        const parsed = TandaUpdateSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await updateTanda(parsed.data, now);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_tandas: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_tandas',
    };
  }
}

/**
 * `get_today` (US1-US3): estado de la pantalla Hoy. Es de solo lectura; `data?.at` (ISO) es un
 * escape hatch para pruebas o consulta puntual (contracts/mcp-tools.md), nunca usado por la web.
 */
export async function handleGetToday(data?: unknown, now: Date = new Date()): Promise<ExecutionResult> {
  try {
    const at = (data as { at?: string } | undefined)?.at;
    const effectiveNow = at ? new Date(at) : now;
    return await getToday(effectiveNow);
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en get_today',
    };
  }
}

export type ManageRoutineSlotsAction = 'create' | 'update' | 'read' | 'delete' | 'respond' | 'rehearse';

/**
 * `manage_routine_slots` (US2): el disparador si-entonces. `create`/`update` usan el mismo
 * esquema estricto (una clave de duración, tandas o método de estudio cae en SOBRE_ESPECIFICACION,
 * no en el DATOS_INVALIDOS genérico: FR-009). `respond` y `rehearse` delegan sus reglas de
 * idempotencia en lib/execution/routine.ts.
 */
export async function handleManageRoutineSlots(
  action: ManageRoutineSlotsAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'create':
      case 'update': {
        const parsed = RoutineSlotSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error, { unrecognizedKeysCode: 'SOBRE_ESPECIFICACION' });
        return await upsertRoutineSlot(parsed.data);
      }
      case 'read': {
        const parsed = RoutineSlotReadSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await readRoutineSlots(parsed.data.id);
      }
      case 'delete': {
        const parsed = RoutineSlotDeleteSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await deleteRoutineSlot(parsed.data.id);
      }
      case 'respond': {
        const parsed = RoutineSlotRespondSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await respondToRoutineSlot(parsed.data, now);
      }
      case 'rehearse': {
        const parsed = RoutineSlotRehearseSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await rehearseRoutineSlot(parsed.data, now);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_routine_slots: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_routine_slots',
    };
  }
}

export type ManageDailyChecksAction = 'set' | 'read';

/**
 * `manage_daily_checks` (US3): registro diario de hábitos. `set` valida la forma con
 * DailyCheckSetSchema y delega en lib/execution/checks.ts las reglas que necesitan la base
 * (DIA_CERRADO, FECHA_FUTURA, HABITO_INACTIVO). `read` devuelve, por día, sus checks y la
 * evaluación de "día cumplido" (evaluateDay).
 */
export async function handleManageDailyChecks(
  action: ManageDailyChecksAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'set': {
        const parsed = DailyCheckSetSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await setDailyCheck(parsed.data, now);
      }
      case 'read': {
        const parsed = DailyChecksReadSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await readDailyChecks(parsed.data, now);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_daily_checks: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_daily_checks',
    };
  }
}

/**
 * `get_grade_projection` (US5): por materia, la proyección de nota (lib/domain/subject.ts) y las
 * alertas "ciega"/"abandonada" (lib/domain/execution.ts:computeAlerts). Es de solo lectura;
 * `data?.subject_id` filtra a una sola materia. El cálculo en sí vive en
 * lib/execution/grade-projection.ts, compartido con la sección "En riesgo" del reporte semanal
 * (US6), para no repetirlo (Principio I).
 */
export async function handleGetGradeProjection(data?: unknown, now: Date = new Date()): Promise<ExecutionResult> {
  try {
    const parsed = GradeProjectionReadSchema.safeParse(data ?? {});
    if (!parsed.success) return zodErrorToExecutionResult(parsed.error);

    const { materias, alertas } = await computeGradeProjections(now, parsed.data.subject_id);
    return {
      status: 'success',
      data: {
        materias: materias.map(({ subject_id, name, projection, flags }) => ({ subject_id, name, projection, flags })),
        alertas,
      },
    };
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en get_grade_projection',
    };
  }
}

export type ManageWeeklyReportAction = 'set_partner' | 'read_partner' | 'preview' | 'set_note' | 'send' | 'read' | 'run_tick';

/** Junta cumplimiento + proyección de nota de una semana en el `BuildReportPayloadInput` que
 * espera buildReportPayload, cortando ambos al mismo instante `cutoff` (T053/T055: la misma
 * forma que usa el congelamiento real en lib/execution/tick.ts, reutilizada aquí para `preview`
 * y para armar la nota de "reporte anterior"). */
async function assembleReportInput(
  week: ProgramWeekRecord,
  weeks: ProgramWeekRecord[],
  cutoff: Date,
  extras: { late: boolean; userNote: string | null }
): Promise<BuildReportPayloadInput> {
  const from = week.starts_on;
  const to = addDays(week.starts_on, 6);

  const [compliance, projections, planOpenings] = await Promise.all([
    getCompliance({ from, to, cutoff }),
    computeGradeProjections(cutoff),
    countGatedPlanOpenings(week.id),
  ]);
  const enRiesgo = deriveRiskSection(projections.materias, projections.alertas);

  const prevWeek = weeks.find((w) => w.week_number === week.week_number - 1);
  let previousReportFailed = false;
  if (prevWeek) {
    const prevReport = (await fetchWeeklyReportsFromDb(prevWeek.id)) as WeeklyReportRecord | null;
    previousReportFailed = prevReport?.status === 'fallido';
  }

  return {
    program_week_id: week.id,
    week_number: week.week_number,
    starts_on: week.starts_on,
    days_fulfilled: compliance.days_fulfilled,
    habits: compliance.habitos,
    accumulated_fulfilled_days: compliance.dias_cumplidos_totales,
    horizon_days: compliance.horizonte,
    en_riesgo: enRiesgo,
    user_note: extras.userNote,
    late_edits: compliance.ediciones_tardias,
    late: extras.late,
    previous_report_failed: previousReportFailed,
    // Un preview no anticipa "segunda semana fallida seguida": ese veredicto todavía puede
    // cambiar mientras la semana en curso no se congele de verdad.
    second_consecutive_failure: false,
    // US9: aperturas de la vista de semana que pasaron por la compuerta esta semana. El
    // congelamiento real (lib/execution/tick.ts) no pasa por aquí y no conoce este campo; lo
    // completa por su cuenta lib/db/execution-pg.ts:insertWeeklyReportIfAbsentInDb.
    plan_openings: planOpenings,
  };
}

/** `preview` (contracts/mcp-tools.md): la misma forma del reporte, con los datos hasta AHORA
 * (nunca hasta el corte del domingo), y sin guardar nada. Sin `program_week_id`, usa la semana
 * en curso. */
async function previewWeeklyReport(programWeekId: string | undefined, now: Date): Promise<ExecutionResult> {
  const weeksRaw = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];

  const todayKey = localParts(now).dateKey;
  const week = programWeekId
    ? weeks.find((w) => w.id === programWeekId)
    : weeks.find((w) => w.starts_on <= todayKey && todayKey <= addDays(w.starts_on, 6));

  if (!week) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: 'No hay una semana del programa para previsualizar.' };
  }

  const input = await assembleReportInput(week, weeks, now, { late: false, userNote: null });
  const payload = buildReportPayload(input);
  return { status: 'success', data: { payload, verdict: payload.verdict, text: renderReportText(payload) } };
}

async function setWeeklyReportNote(input: { program_week_id: string; note: string }, now: Date): Promise<ExecutionResult> {
  const reportRaw = await fetchWeeklyReportsFromDb(input.program_week_id);
  const report = reportRaw as WeeklyReportRecord | null;
  if (!report) {
    return {
      status: 'error',
      code: 'REPORTE_NO_CONGELADO',
      message: `La semana ${input.program_week_id} todavía no tiene un reporte congelado.`,
    };
  }
  if (now.getTime() > new Date(report.note_deadline).getTime()) {
    return {
      status: 'error',
      code: 'VENTANA_CERRADA',
      message: 'La ventana de 60 minutos para escribir la nota ya cerró.',
    };
  }

  const updated = await updateWeeklyReportNoteInDb(input.program_week_id, input.note);
  return { status: 'success', data: updated };
}

/** `send` (envío manual, contracts/mcp-tools.md): reusa el mismo claim atómico que el tick
 * (lib/execution/tick.ts:attemptSend) — Andrés forzando el envío a mano no es una vía distinta. */
async function sendWeeklyReportManually(programWeekId: string, now: Date): Promise<ExecutionResult> {
  const reportRaw = await fetchWeeklyReportsFromDb(programWeekId);
  const report = reportRaw as WeeklyReportRecord | null;
  if (!report) {
    return {
      status: 'error',
      code: 'REPORTE_NO_CONGELADO',
      message: `La semana ${programWeekId} todavía no tiene un reporte congelado.`,
    };
  }
  if (report.status === 'enviado') {
    return { status: 'error', code: 'YA_ENVIADO', message: 'Este reporte ya se envió.' };
  }

  // El mismo Pusher real que usa el tick (lib/execution/tick.ts:runExecutionTick): un envío
  // forzado a mano que agota los 3 intentos también es "un reporte que pasa a fallido"
  // (contracts/notifications.md), y debe avisar igual que si lo hubiera agotado el tick.
  const outcome = await attemptSend(report, now, createZeptoMailer(), createWebPusher());
  if (outcome === 'skipped') {
    return {
      status: 'error',
      code: 'REPORTE_NO_CONGELADO',
      message: 'El reporte no está en estado congelado ahora mismo (puede estar enviándose o haber fallado ya).',
    };
  }
  if (outcome === 'sin_partner') {
    // US6-AS9: quien pide el envío a mano sigue recibiendo SIN_PARTNER. Por dentro, esta causa
    // concreta no consumió un intento ni movió el reporte de 'congelado' (auditoría US6): no es
    // un fallo de entrega, es una configuración incompleta que se resuelve sola en cuanto exista
    // un destinatario, sin que este intento manual la haya empeorado.
    return {
      status: 'error',
      code: 'SIN_PARTNER',
      message: 'No hay un destinatario vigente para enviar este reporte.',
    };
  }

  const updated = await fetchWeeklyReportsFromDb(programWeekId);
  return { status: 'success', data: updated };
}

async function readWeeklyReport(programWeekId?: string): Promise<ExecutionResult> {
  if (programWeekId) {
    const reportRaw = await fetchWeeklyReportsFromDb(programWeekId);
    if (!reportRaw) {
      return {
        status: 'error',
        code: 'REPORTE_NO_CONGELADO',
        message: `La semana ${programWeekId} todavía no tiene un reporte congelado.`,
      };
    }
    return { status: 'success', data: reportRaw };
  }
  const all = await fetchWeeklyReportsFromDb();
  return { status: 'success', data: all };
}

/**
 * `manage_weekly_report` (US6): destinatario del reporte y su ciclo de vida (congelar es
 * automático, vía el tick; esta herramienta cubre lo que sí pide un humano o un disparador
 * externo). `run_tick` ejecuta `runExecutionTick` una vez con el mailer real — es lo que
 * contracts/mcp-tools.md documenta como el disparador externo que exige FR-039, y lo que usa el
 * quickstart para forzar el congelamiento sin esperar al reloj.
 */
export async function handleManageWeeklyReport(
  action: ManageWeeklyReportAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'set_partner': {
        const parsed = AccountabilityPartnerSetSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        // El superRefine del esquema ya rechazó (CONSENTIMIENTO_REQUERIDO) un consented_at
        // ausente o vacío antes de llegar aquí: en este punto siempre es un string real.
        const partner = await setActivePartnerInDb({ ...parsed.data, consented_at: parsed.data.consented_at! });
        return { status: 'success', data: partner };
      }
      case 'read_partner': {
        const partner = await fetchActivePartnerFromDb();
        return { status: 'success', data: partner };
      }
      case 'preview': {
        const parsed = WeeklyReportPreviewSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await previewWeeklyReport(parsed.data.program_week_id, now);
      }
      case 'set_note': {
        const parsed = WeeklyReportNoteSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await setWeeklyReportNote(parsed.data, now);
      }
      case 'send': {
        const parsed = WeeklyReportSendSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await sendWeeklyReportManually(parsed.data.program_week_id, now);
      }
      case 'read': {
        const parsed = WeeklyReportReadSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await readWeeklyReport(parsed.data.program_week_id);
      }
      case 'run_tick': {
        const result = await runExecutionTick(now, { mailer: createZeptoMailer() });
        return { status: 'success', data: result };
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_weekly_report: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_weekly_report',
    };
  }
}

export type GetComplianceReportInput = { from?: string; to?: string; program_week_id?: string };

/**
 * `get_compliance_report` (US6): vista de salud del hábito para cualquier rango, o para una
 * semana del programa entera si se da `program_week_id`. Sin ninguno de los dos, cubre solo hoy.
 */
export async function handleGetComplianceReport(data?: unknown, now: Date = new Date()): Promise<ExecutionResult> {
  try {
    const parsed = ComplianceReportReadSchema.safeParse(data ?? {});
    if (!parsed.success) return zodErrorToExecutionResult(parsed.error);

    let from = parsed.data.from;
    let to = parsed.data.to;

    if (parsed.data.program_week_id) {
      const weekRaw = await fetchProgramWeeksFromDb(parsed.data.program_week_id);
      const week = weekRaw as ProgramWeekRecord | null;
      if (!week) {
        return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la semana ${parsed.data.program_week_id}.` };
      }
      from = week.starts_on;
      to = addDays(week.starts_on, 6);
    }

    const todayKey = localParts(now).dateKey;
    from = from ?? todayKey;
    to = to ?? todayKey;

    const compliance = await getCompliance({ from, to, cutoff: now });
    return { status: 'success', data: compliance };
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en get_compliance_report',
    };
  }
}

export type ManageTasksAction = 'create' | 'read' | 'update' | 'delete' | 'today';

/**
 * `manage_tasks` (US8): unidad de trabajo de 1 a 3 tandas. `create`/`update` rechazan más de 3
 * tandas con PARTIR_TAREA (ExecutionTaskSchema/ExecutionTaskUpdateSchema). `today` no arrastra
 * deuda: solo lo programado exactamente para hoy y todavía pendiente (FR-035).
 */
export async function handleManageTasks(
  action: ManageTasksAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'create': {
        const parsed = ExecutionTaskSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await createTask(parsed.data);
      }
      case 'read': {
        const parsed = ExecutionTaskReadSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await readTasks(parsed.data);
      }
      case 'update': {
        const parsed = ExecutionTaskUpdateSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await updateTask(parsed.data);
      }
      case 'delete': {
        const parsed = ExecutionTaskDeleteSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await deleteTask(parsed.data.id);
      }
      case 'today': {
        return await getTodayTasks(now);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_tasks: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_tasks',
    };
  }
}

export type ManagePlanWeekAction = 'preview' | 'set_intentions' | 'open_view';

/**
 * `plan_week` (US8-US9): el asistente del domingo (`preview`, `set_intentions`) y la compuerta de
 * la vista de semana (`open_view`, FR-037). `preview` sin `program_week_id` resuelve la semana en
 * curso, o la siguiente si hoy es domingo (mismo criterio que `manage_routine_slots:rehearse`,
 * lib/execution/routine.ts:resolveRehearsalWeekId); `open_view` siempre mira la semana en curso,
 * nunca la que se está planeando.
 */
export async function handlePlanWeek(
  action: ManagePlanWeekAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'preview': {
        const parsed = PlanWeekPreviewSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await previewPlanWeek(parsed.data, now);
      }
      case 'set_intentions': {
        const parsed = IntentionsSetSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await setIntentions(parsed.data);
      }
      case 'open_view': {
        const parsed = PlanWeekOpenViewSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await openPlanView(parsed.data, now);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para plan_week: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en plan_week',
    };
  }
}
