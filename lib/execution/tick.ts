// Tick idempotente del Módulo de Ejecución (US6, FR-039). Congela las semanas cuyo corte del
// domingo 19:00 ya pasó y no tienen reporte, y envía los reportes congelados cuya ventana de
// nota ya cerró — con un claim atómico para que, entre llamadas concurrentes o repetidas, cada
// reporte se envíe como mucho una vez. Se puede disparar desde el propio proceso
// (`setInterval` en mcp-server/index.ts, T055) o desde un programador externo
// (`manage_weekly_report:run_tick`): es la misma función en los dos casos.

import { finalizeElapsed } from './tandas';
import { addDays, localDateTimeToInstant, localParts } from './time';
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
  markWeeklyReportFreezeNotifiedInDb,
  markTandaEndNotifiedInDb,
  revertClaimForMissingPartnerInDb,
  revertStuckSendingToFrozenInDb,
  fetchActivePartnerFromDb,
  fetchAccountabilityPartnersFromDb,
  setWeeklyReportPartnerInDb,
  AccountabilityPartnerRecord,
  ProgramWeekRecord,
  WeeklyReportRecord,
  TandaRecord,
} from '../db/execution-pg';
import { fetchSubjectsFromDb } from '../db/repository-pg';
import { getCompliance } from './compliance';
import { computeGradeProjections } from './grade-projection';
import { computeVerdict } from '../domain/execution';
import { buildReportPayload, deriveRiskSection, renderReportSubject, renderReportText, BuildReportPayloadInput, ReportPayload } from './report';
import type { Mailer } from './mailer';
import { createWebPusher, type Pusher } from './push';

// Reexportado por compatibilidad: antes de T061, `Pusher` se declaraba en este archivo.
export type { Pusher };

export interface TickOptions {
  mailer: Mailer;
  /** US7: sin pasar un Pusher explícito (los tests de US6 no lo hacen), el tick usa el real
   * (createWebPusher), que a su vez es un no-op con un warn si VAPID no está configurado — nunca
   * lanza y nunca duplica un aviso porque cada uno se marca en la base la primera vez que sale. */
  pusher?: Pusher;
}

/** "10 minutos de {materia}" (con materia) o "10 minutos" (sin ella), como pide
 * contracts/notifications.md para el aviso de fin de tanda. */
async function tandaEndBody(tanda: TandaRecord): Promise<string> {
  if (!tanda.subject_id) return '10 minutos';
  const subjectRaw = await fetchSubjectsFromDb(tanda.subject_id);
  const subject = Array.isArray(subjectRaw) ? subjectRaw[0] : subjectRaw;
  return subject?.name ? `10 minutos de ${subject.name}` : '10 minutos';
}

function formatHHMM(minutesSinceMidnight: number): string {
  const h = Math.floor(minutesSinceMidnight / 60) % 24;
  const m = minutesSinceMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
 * Congela una semana ya vencida: junta cumplimiento (getCompliance), proyección de nota
 * (computeGradeProjections, ambos cortados al instante `cutoff`, nunca a `now`) y las aperturas
 * de la vista de semana que pasaron por la compuerta (countGatedPlanOpenings, US9), y guarda el
 * payload de una sola vez (`insertWeeklyReportIfAbsentInDb`, idempotente). `frozen_at` es
 * siempre el corte teórico, nunca el instante real del tick (US6-AS8): si Pure estuvo apagado,
 * el reporte se congela iguial "como si" hubiera corrido a las 19:00.
 */
async function freezeOneWeek(
  week: ProgramWeekRecord,
  allWeeks: ProgramWeekRecord[],
  cutoff: Date,
  now: Date,
  pusher: Pusher
): Promise<boolean> {
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
    aperturas_plan: { total: compliance.aperturas_plan.total, con_razon: compliance.aperturas_plan.con_razon, libres_usadas: compliance.aperturas_plan.libres_usadas },
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

  // US7 (FR-032): "reporte congelado" avisa con la hora límite de la nota. `inserted` solo es
  // no-null la ÚNICA vez que este insert idempotente realmente crea la fila (T054/FR-039), así
  // que este aviso sale exactamente una vez por semana — no hace falta una marca aparte para
  // decidir SI avisar, pero sí se guarda freeze_notified_at para que quede constancia.
  if (inserted) {
    const deadlineHHMM = formatHHMM(localParts(noteDeadline).minutes);
    await pusher.notify({
      title: 'Reporte de la semana congelado',
      body: `Tu nota hasta las ${deadlineHHMM}`,
      tag: 'reporte',
      url: '/',
    });
    await markWeeklyReportFreezeNotifiedInDb(inserted.id, now);
  }

  return inserted !== null;
}

async function freezeDueWeeks(now: Date, pusher: Pusher): Promise<number> {
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

    const didInsert = await freezeOneWeek(week, weeks, cutoff, now, pusher);
    if (didInsert) frozen++;
  }
  return frozen;
}

function normalizePartner(
  raw: AccountabilityPartnerRecord | AccountabilityPartnerRecord[] | null
): AccountabilityPartnerRecord | null {
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

/**
 * Envía un reporte ya claimado. Exportada porque `manage_weekly_report:send` (el envío manual)
 * reusa exactamente esta función — el claim atómico es el mismo tanto si lo dispara el tick como
 * si lo dispara Andrés a mano.
 *
 * Auditoría US6: falta de destinatario NO es un fallo de entrega (FR-023 es para eso: que la API
 * de correo responda mal o no responda), es una configuración incompleta. Por eso la resolución
 * del destinatario ocurre ANTES del try/catch, que a partir de ahí solo cubre el envío real:
 * - si el reporte ya tiene un `partner_id` guardado (se congeló con alguien vigente), se usa ese
 *   y nunca se vuelve a consultar quién está activo ahora — "el vigente al congelar" (caso
 *   borde de spec.md) se conserva exactamente.
 * - si no tiene ninguno guardado (se congeló sin destinatario), se resuelve el vigente EN ESTE
 *   INSTANTE; si hay uno, se deja constancia guardando su id en el reporte.
 * - si sigue sin haber ninguno, el claim se deshace por completo (revertClaimForMissingPartnerInDb):
 *   el intento no cuenta, el reporte vuelve a 'congelado' tal como estaba, listo para que un
 *   tick futuro — apenas exista un destinatario — lo intente de nuevo sin haber gastado nada.
 */
export async function attemptSend(
  report: WeeklyReportRecord,
  now: Date,
  mailer: Mailer,
  pusher?: Pusher
): Promise<'sent' | 'sin_partner' | 'failed' | 'skipped'> {
  const claimed = await claimWeeklyReportForSendingInDb(report.id, now);
  if (!claimed) return 'skipped'; // ya no estaba 'congelado': otro proceso lo tomó, o ya se resolvió

  let partner = normalizePartner(
    claimed.partner_id ? await fetchAccountabilityPartnersFromDb(claimed.partner_id) : null
  );

  if (!partner) {
    const active = await fetchActivePartnerFromDb();
    if (active) {
      await setWeeklyReportPartnerInDb(report.id, active.id);
      partner = active;
    }
  }

  if (!partner) {
    await revertClaimForMissingPartnerInDb(report.id, report.last_attempt_at);
    return 'sin_partner';
  }

  try {
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

    // US7/FR-032: "fallo de envío" avisa solo cuando el reporte de verdad se agota y pasa a
    // 'fallido' — ese tránsito 'congelado' -> 'fallido' ocurre como mucho una vez en la vida de
    // un reporte (una vez 'fallido', ningún tick vuelve a intentarlo), así que este único punto
    // ya garantiza el aviso exactamente una vez, sin necesitar una marca aparte en la base.
    if (exhausted && pusher) {
      await pusher.notify({
        title: 'No se pudo enviar el reporte',
        body: 'Revisa Configuración → Notificaciones',
        tag: 'reporte-fallo',
        url: '/',
      });
    }
    return 'failed';
  }
}

async function sendDueReports(
  now: Date,
  mailer: Mailer,
  pusher: Pusher
): Promise<{ sent: number; failed: number; notified: number }> {
  const allRaw = await fetchWeeklyReportsFromDb();
  const all = (Array.isArray(allRaw) ? allRaw : []) as WeeklyReportRecord[];

  let sent = 0;
  let failed = 0;
  let notified = 0;

  for (const report of all) {
    if (report.status !== 'congelado') continue;
    if (new Date(report.note_deadline).getTime() > now.getTime()) continue; // la ventana de nota sigue abierta

    if (report.last_attempt_at) {
      const sinceLastAttemptMs = now.getTime() - new Date(report.last_attempt_at).getTime();
      if (sinceLastAttemptMs < REPORT_RETRY_BACKOFF_MINUTES * 60_000) continue; // dentro del backoff
    }

    // Mismo cálculo que attemptSend usa por dentro (`claimed.attempts >= REPORT_MAX_ATTEMPTS`,
    // con `claimed.attempts = report.attempts + 1`) para saber si ESTE intento, de fallar, es el
    // que agota los reintentos y dispara el aviso de fallo — se duplica aquí solo para poder
    // contarlo en `notified` sin cambiar la forma en que attemptSend responde a sus otros
    // callers (lib/execution/handlers.ts hace un envío manual con ese mismo string).
    const willExhaustOnFailure = report.attempts + 1 >= REPORT_MAX_ATTEMPTS;

    const outcome = await attemptSend(report, now, mailer, pusher);
    if (outcome === 'sent') sent++;
    if (outcome === 'failed') {
      failed++;
      if (willExhaustOnFailure) notified++;
    }
    // 'sin_partner' y 'skipped' no cuentan como envío ni como fallo de entrega: el primero
    // vuelve a 'congelado' sin haber gastado nada (auditoría US6), y el segundo significa que
    // otro proceso ya resolvió este reporte entre el fetch de arriba y este intento.
  }

  return { sent, failed, notified };
}

/**
 * runExecutionTick: 1) cierra por tiempo la tanda en curso si aplica; 2) recupera los reportes
 * colgados en 'enviando' hace más de REPORT_STUCK_SENDING_MINUTES; 3) congela las semanas
 * vencidas; 4) intenta enviar los reportes cuya ventana de nota ya cerró. Repetirla no duplica
 * congelamientos (insert idempotente) ni envíos (claim atómico) — FR-039.
 */
export async function runExecutionTick(now: Date, options: TickOptions): Promise<TickResult> {
  // Sin un Pusher explícito, se usa el real: es un no-op con un warn si VAPID no está
  // configurado (nunca lanza), así que dejarlo por defecto aquí no cambia el comportamiento de
  // los callers que todavía no pasan `pusher` (mcp-server/index.ts y manage_weekly_report:run_tick
  // en lib/execution/handlers.ts) — en cuanto Andrés configure VAPID (T063), esos dos sitios
  // empiezan a mandar avisos reales sin que nadie tenga que tocarlos.
  const pusher = options.pusher ?? createWebPusher();
  let notified = 0;

  // FR-032 "fin de tanda": finalizeElapsed solo devuelve una tanda no-null la única vez que ESTA
  // llamada es la que la cierra por tiempo cumplido (US1-AS3); una tanda ya cerrada, o ninguna en
  // curso, devuelve null. Eso ya garantiza como mucho un aviso por tanda sin necesitar la marca
  // end_notified_at para decidir SI avisar — pero igual se guarda, como constancia y por si un
  // día se necesita volver a consultar si una tanda concreta ya avisó.
  const finalizedTanda = await finalizeElapsed(now);
  if (finalizedTanda) {
    await pusher.notify({
      title: 'Terminó la tanda',
      body: await tandaEndBody(finalizedTanda),
      tag: 'tanda',
      url: '/',
    });
    await markTandaEndNotifiedInDb(finalizedTanda.id, now);
    notified++;
  }

  await revertStuckSendingToFrozenInDb(now, REPORT_STUCK_SENDING_MINUTES);

  // Cada semana recién congelada disparó exactamente un aviso (arriba, dentro de freezeOneWeek).
  const frozen = await freezeDueWeeks(now, pusher);
  notified += frozen;

  const { sent, failed, notified: failureNotified } = await sendDueReports(now, options.mailer, pusher);
  notified += failureNotified;

  return { frozen, sent, failed, notified };
}
