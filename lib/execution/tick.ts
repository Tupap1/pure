// Tick idempotente del Módulo de Ejecución (US6, FR-039). Congela las semanas cuyo corte del
// domingo 19:00 ya pasó y no tienen reporte, y envía los reportes congelados cuya ventana de
// nota ya cerró — con un claim atómico para que, entre llamadas concurrentes o repetidas, cada
// reporte se envíe como mucho una vez. Se puede disparar desde el propio proceso
// (`setInterval` en mcp-server/index.ts, T055) o desde un programador externo
// (`manage_weekly_report:run_tick`): es la misma función en los dos casos.

import { finalizeElapsed } from './tandas';
import { addDays, localDateTimeToInstant } from './time';
import {
  REPORT_FREEZE_TIME,
  REPORT_NOTE_MINUTES,
  REPORT_MAX_ATTEMPTS,
  REPORT_RETRY_BACKOFF_MINUTES,
  REPORT_STUCK_SENDING_MINUTES,
  FREEZE_LATE_THRESHOLD_MINUTES,
} from './constants';
import {
  fetchProgramWeeksFromDb,
  fetchWeeklyReportsFromDb,
  insertWeeklyReportIfAbsentInDb,
  claimWeeklyReportForSendingInDb,
  markWeeklyReportSentInDb,
  markWeeklyReportFailedAttemptInDb,
  revertStuckSendingToFrozenInDb,
  fetchActivePartnerFromDb,
  fetchAccountabilityPartnersFromDb,
  ProgramWeekRecord,
  WeeklyReportRecord,
} from '../db/execution-pg';
import { getCompliance } from './compliance';
import { computeGradeProjections } from './grade-projection';
import { computeVerdict } from '../domain/execution';
import { buildReportPayload, deriveRiskSection, renderReportSubject, renderReportText, BuildReportPayloadInput, ReportPayload } from './report';
import type { Mailer } from './mailer';

/** Interfaz mínima de avisos push (US7). Ningún tipo de aviso se envía todavía desde aquí: T060-
 * T062 conectan `pusher` cuando US7 se construya. Se declara ya (en vez de agregarla después)
 * porque el contrato de `run_tick` y la firma de runExecutionTick ya la incluyen. */
export interface Pusher {
  notify(payload: { title: string; body: string; url: string; tag: string }): Promise<void>;
}

export interface TickOptions {
  mailer: Mailer;
  pusher?: Pusher;
}

export interface TickResult {
  frozen: number;
  sent: number;
  failed: number;
  notified: number;
}

/** Corte del domingo 19:00 local de la semana que empieza en `startsOn`. */
function weekCutoff(startsOn: string): Date {
  return localDateTimeToInstant(addDays(startsOn, 6), REPORT_FREEZE_TIME);
}

/**
 * Congela una semana ya vencida: junta cumplimiento (getCompliance) y proyección de nota
 * (computeGradeProjections, ambos cortados al instante `cutoff`, nunca a `now`) y guarda el
 * payload de una sola vez (`insertWeeklyReportIfAbsentInDb`, idempotente). `frozen_at` es
 * siempre el corte teórico, nunca el instante real del tick (US6-AS8): si Pure estuvo apagado,
 * el reporte se congela iguial "como si" hubiera corrido a las 19:00.
 */
async function freezeOneWeek(week: ProgramWeekRecord, allWeeks: ProgramWeekRecord[], cutoff: Date, now: Date): Promise<boolean> {
  const from = week.starts_on;
  const to = addDays(week.starts_on, 6);

  const [compliance, projections, activePartner] = await Promise.all([
    getCompliance({ from, to, cutoff }),
    computeGradeProjections(cutoff),
    fetchActivePartnerFromDb(),
  ]);

  const enRiesgo = deriveRiskSection(projections.materias, projections.alertas);
  const verdict = computeVerdict(compliance.days_fulfilled);

  const prevWeek = allWeeks.find((w) => w.week_number === week.week_number - 1);
  let previousReportFailed = false;
  let secondConsecutiveFailure = false;
  if (prevWeek) {
    const prevReport = (await fetchWeeklyReportsFromDb(prevWeek.id)) as WeeklyReportRecord | null;
    if (prevReport) {
      previousReportFailed = prevReport.status === 'fallido';
      secondConsecutiveFailure = prevReport.verdict === 'fallida' && verdict === 'fallida';
    }
  }

  const late = now.getTime() - cutoff.getTime() > FREEZE_LATE_THRESHOLD_MINUTES * 60_000;
  const noteDeadline = new Date(Math.max(cutoff.getTime(), now.getTime()) + REPORT_NOTE_MINUTES * 60_000);

  const input: BuildReportPayloadInput = {
    program_week_id: week.id,
    week_number: week.week_number,
    starts_on: week.starts_on,
    days_fulfilled: compliance.days_fulfilled,
    habits: compliance.habitos,
    accumulated_fulfilled_days: compliance.dias_cumplidos_totales,
    horizon_days: compliance.horizonte,
    en_riesgo: enRiesgo,
    user_note: null,
    late_edits: compliance.ediciones_tardias,
    late,
    previous_report_failed: previousReportFailed,
    second_consecutive_failure: secondConsecutiveFailure,
  };
  const payload = buildReportPayload(input);

  const inserted = await insertWeeklyReportIfAbsentInDb({
    id: week.id,
    program_week_id: week.id,
    partner_id: activePartner?.id ?? null,
    payload,
    verdict: payload.verdict,
    frozen_at: cutoff.toISOString(),
    note_deadline: noteDeadline.toISOString(),
  });

  return inserted !== null;
}

async function freezeDueWeeks(now: Date): Promise<number> {
  const weeksRaw = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(weeksRaw) ? weeksRaw : []) as ProgramWeekRecord[];

  const existingRaw = await fetchWeeklyReportsFromDb();
  const existingIds = new Set(((Array.isArray(existingRaw) ? existingRaw : []) as WeeklyReportRecord[]).map((r) => r.id));

  let frozen = 0;
  // Secuencial (no Promise.all): freezeOneWeek de la semana N necesita que la N-1 ya haya
  // quedado insertada, para decidir previous_report_failed / second_consecutive_failure.
  for (const week of weeks) {
    if (existingIds.has(week.id)) continue;
    const cutoff = weekCutoff(week.starts_on);
    if (cutoff.getTime() > now.getTime()) continue; // el corte de esta semana todavía no llega

    const didInsert = await freezeOneWeek(week, weeks, cutoff, now);
    if (didInsert) frozen++;
  }
  return frozen;
}

/**
 * Envía un reporte ya claimado. Cualquier fallo (de red, o la ausencia de destinatario) se trata
 * igual: cuenta como intento fallido y aplica el mismo backoff/máximo de 3 intentos. Exportada
 * porque `manage_weekly_report:send` (el envío manual) reusa exactamente esta función — el claim
 * atómico es el mismo tanto si lo dispara el tick como si lo dispara Andrés a mano.
 */
export async function attemptSend(report: WeeklyReportRecord, now: Date, mailer: Mailer): Promise<'sent' | 'failed' | 'skipped'> {
  const claimed = await claimWeeklyReportForSendingInDb(report.id, now);
  if (!claimed) return 'skipped'; // ya no estaba 'congelado': otro proceso lo tomó, o ya se resolvió

  try {
    const partnerRaw = claimed.partner_id ? await fetchAccountabilityPartnersFromDb(claimed.partner_id) : null;
    const partner = Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw;
    if (!partner) {
      throw new Error('SIN_PARTNER: no hay un destinatario vigente para este reporte.');
    }

    const payload = claimed.payload as ReportPayload;
    await mailer.send({
      to: partner.email,
      toName: partner.name,
      subject: renderReportSubject(payload),
      text: renderReportText(payload),
    });

    await markWeeklyReportSentInDb(report.id, now);
    return 'sent';
  } catch (error: any) {
    const message = String(error?.message ?? error).slice(0, 500);
    const exhausted = claimed.attempts >= REPORT_MAX_ATTEMPTS;
    await markWeeklyReportFailedAttemptInDb(report.id, message, exhausted);
    return 'failed';
  }
}

async function sendDueReports(now: Date, mailer: Mailer): Promise<{ sent: number; failed: number }> {
  const allRaw = await fetchWeeklyReportsFromDb();
  const all = (Array.isArray(allRaw) ? allRaw : []) as WeeklyReportRecord[];

  let sent = 0;
  let failed = 0;

  for (const report of all) {
    if (report.status !== 'congelado') continue;
    if (new Date(report.note_deadline).getTime() > now.getTime()) continue; // la ventana de nota sigue abierta

    if (report.last_attempt_at) {
      const sinceLastAttemptMs = now.getTime() - new Date(report.last_attempt_at).getTime();
      if (sinceLastAttemptMs < REPORT_RETRY_BACKOFF_MINUTES * 60_000) continue; // dentro del backoff
    }

    const outcome = await attemptSend(report, now, mailer);
    if (outcome === 'sent') sent++;
    if (outcome === 'failed') failed++;
  }

  return { sent, failed };
}

/**
 * runExecutionTick: 1) cierra por tiempo la tanda en curso si aplica; 2) recupera los reportes
 * colgados en 'enviando' hace más de REPORT_STUCK_SENDING_MINUTES; 3) congela las semanas
 * vencidas; 4) intenta enviar los reportes cuya ventana de nota ya cerró. Repetirla no duplica
 * congelamientos (insert idempotente) ni envíos (claim atómico) — FR-039.
 */
export async function runExecutionTick(now: Date, options: TickOptions): Promise<TickResult> {
  await finalizeElapsed(now);
  await revertStuckSendingToFrozenInDb(now, REPORT_STUCK_SENDING_MINUTES);

  const frozen = await freezeDueWeeks(now);
  const { sent, failed } = await sendDueReports(now, options.mailer);

  // US7 (push) todavía no está construido (T060-T062): `pusher`, si llega, queda reservado para
  // entonces. `notified` se reporta en 0 en vez de inventar un número.
  void options.pusher;

  return { frozen, sent, failed, notified: 0 };
}
