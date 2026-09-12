// Ensamblado y texto del reporte semanal (US6, FR-021/FR-022). buildReportPayload y
// renderReportText son deliberadamente puros (sin fetch ni reloj propio): reciben ya resueltos
// los números de la semana — lib/execution/tick.ts es quien los junta desde getCompliance y
// computeGradeProjections antes de llamarlos — para que sean triviales de probar con datos
// fabricados (__tests__/domain/weekly-report.test.ts) y para que el texto que se envía sea
// exactamente una función del `payload` ya congelado (FR-019: nunca se recalcula al enviar).

import { computeVerdict, WeeklyVerdict, isoDayOfWeekForDateKey } from '../domain/execution';
import { addDays, localParts } from './time';
import type { GradeAlert } from '../domain/execution';
import type { SubjectProjectionEntry } from './grade-projection';
import { RISK_NEEDED_TO_PASS_THRESHOLD } from './constants';

export interface ReportRiskItem {
  subject_id: string;
  name: string;
  neededToPass: number;
  nextEvaluation: { title: string; due_date: string } | null;
}

export interface ReportRisk {
  perdidas: string[];
  necesita_refuerzo: ReportRiskItem[];
  abandonadas: string[];
  ciegas_count: number;
}

export interface ReportHabitFraction {
  id: string;
  label: string;
  cumplidos: number;
  total: number;
}

export interface BuildReportPayloadInput {
  program_week_id: string;
  week_number: number;
  /** Lunes de la semana (YYYY-MM-DD). */
  starts_on: string;
  days_fulfilled: number;
  habits: ReportHabitFraction[];
  accumulated_fulfilled_days: number;
  horizon_days: number;
  en_riesgo: ReportRisk;
  user_note: string | null;
  late_edits: number;
  /** Pure estuvo apagado al momento del corte y se puso al día después (US6-AS8). */
  late: boolean;
  /** El reporte de la semana anterior no se pudo entregar (US6-AS6). */
  previous_report_failed: boolean;
  /** Esta semana y la anterior tienen veredicto 'fallida' (US6-AS7). */
  second_consecutive_failure: boolean;
  /** US9: aperturas de la vista de la semana que pasaron por la compuerta. Opcional porque US9
   * todavía no existe; cuando no se provee, el reporte simplemente no menciona la línea. */
  plan_openings?: number;
}

export interface ReportPayload extends BuildReportPayloadInput {
  /** Domingo de la semana (YYYY-MM-DD), derivado de starts_on. */
  ends_on: string;
  verdict: WeeklyVerdict;
}

/** FR-022/US6-AS10: arma el payload congelado a partir de los números ya calculados. Pura: no
 * lee la base ni el reloj — todo lo que necesita llega en `input`. */
export function buildReportPayload(input: BuildReportPayloadInput): ReportPayload {
  const verdict = computeVerdict(input.days_fulfilled);
  const ends_on = addDays(input.starts_on, 6);
  return { ...input, ends_on, verdict };
}

/**
 * Deriva la sección "En riesgo" del reporte (FR-022) a partir de lo que ya calculó
 * computeGradeProjections (US5): materias perdidas, las que necesitan
 * RISK_NEEDED_TO_PASS_THRESHOLD o más para aprobar (con la cifra y la próxima evaluación),
 * abandonadas y, en una sola línea, cuántas son ciegas. Una materia perdida no se repite también
 * en "necesita refuerzo": FR-022 las lista como categorías separadas.
 */
export function deriveRiskSection(materias: SubjectProjectionEntry[], alertas: GradeAlert[]): ReportRisk {
  const perdidas = materias.filter((m) => m.flags.includes('materia_perdida')).map((m) => m.name);

  const necesita_refuerzo: ReportRiskItem[] = materias
    .filter(
      (m) =>
        !m.flags.includes('materia_perdida') &&
        m.projection.neededToPass != null &&
        m.projection.neededToPass >= RISK_NEEDED_TO_PASS_THRESHOLD
    )
    .map((m) => ({
      subject_id: m.subject_id,
      name: m.name,
      neededToPass: m.projection.neededToPass as number,
      nextEvaluation: m.nextPending,
    }));

  const abandonadas = alertas
    .filter((a) => a.kind === 'abandonada')
    .map((a) => materias.find((m) => m.subject_id === a.subject_id)?.name ?? a.subject_id);

  const ciegas_count = alertas.filter((a) => a.kind === 'ciega').length;

  return { perdidas, necesita_refuerzo, abandonadas, ciegas_count };
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS_ES = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']; // 1=lunes..7=domingo

function dayOfMonth(dateKey: string): number {
  return Number(dateKey.split('-')[2]);
}

/** "14–20 sep" (el mes se toma del fin de semana: cubre el caso normal en que ambos días caen en
 * el mismo mes calendario). */
function formatWeekRangeEs(startsOn: string, endsOn: string): string {
  const monthIndex = Number(endsOn.split('-')[1]) - 1;
  return `${dayOfMonth(startsOn)}–${dayOfMonth(endsOn)} ${MONTHS_ES[monthIndex]}`;
}

/** "jueves 24", en la zona PURE_TZ (una evaluación trae su `due_date` como instante ISO). */
function formatWeekdayDayEs(dueDateIso: string): string {
  const dateKey = localParts(dueDateIso).dateKey;
  const isoDay = isoDayOfWeekForDateKey(dateKey);
  return `${WEEKDAYS_ES[isoDay]} ${dayOfMonth(dateKey)}`;
}

function buildRiesgoLines(risk: ReportRisk): string[] {
  const lines: string[] = [];
  for (const name of risk.perdidas) lines.push(`${name}: materia perdida.`);
  for (const item of risk.necesita_refuerzo) {
    const proxima = item.nextEvaluation
      ? ` Próxima: ${item.nextEvaluation.title}, ${formatWeekdayDayEs(item.nextEvaluation.due_date)}.`
      : '';
    lines.push(`${item.name}: necesita ${item.neededToPass} en lo que queda para aprobar.${proxima}`);
  }
  for (const name of risk.abandonadas) lines.push(`${name}: evaluación próxima sin tandas recientes.`);
  if (risk.ciegas_count > 0) {
    lines.push(`${risk.ciegas_count} materia${risk.ciegas_count === 1 ? '' : 's'} sin evaluaciones registradas.`);
  }
  return lines;
}

/**
 * Texto plano del correo (contracts/notifications.md), reconstruido exactamente del `payload`
 * congelado: nunca recalcula nada (FR-019). El nombre del destinatario del reporte (Andrés) sale
 * de `REPORT_OWNER_NAME`, leído en el momento de renderizar — igual que mailer.ts lee sus propias
 * variables al enviar, no al crear el mailer.
 */
export function renderReportText(payload: ReportPayload): string {
  const ownerName = process.env.REPORT_OWNER_NAME?.trim() || 'Andrés';
  const lines: string[] = [];

  lines.push(`${ownerName} — semana ${payload.week_number} (${formatWeekRangeEs(payload.starts_on, payload.ends_on)})`);
  lines.push('');
  lines.push(`Días cumplidos: ${payload.days_fulfilled} de 7 (domingo hasta las 19:00)`);
  lines.push(`Desde el inicio: ${payload.accumulated_fulfilled_days} de ${payload.horizon_days}`);
  for (const habit of payload.habits) {
    lines.push(`${habit.label}: ${habit.cumplidos}/${habit.total}`);
  }
  lines.push(`Veredicto: ${payload.verdict}`);

  const riesgoLines = buildRiesgoLines(payload.en_riesgo);
  if (riesgoLines.length > 0) {
    lines.push('');
    lines.push('En riesgo:');
    for (const line of riesgoLines) lines.push(`· ${line}`);
  }

  lines.push('');
  if (payload.user_note && payload.user_note.trim()) {
    lines.push(`${ownerName} dice: "${payload.user_note.trim()}"`);
  } else {
    lines.push(`${ownerName} no dio explicación.`);
  }

  if (payload.late) {
    lines.push('');
    lines.push('Pure estuvo apagado: este reporte se congeló con el corte del domingo 19:00 y se envía con retraso.');
  }
  if (payload.previous_report_failed) {
    lines.push('');
    lines.push('La semana pasada el reporte no se pudo entregar.');
  }
  if (payload.second_consecutive_failure) {
    lines.push('');
    lines.push('Segunda semana fallida. Si puedes, llámalo.');
  }

  lines.push('');
  lines.push(`Ediciones después del cierre: ${payload.late_edits}`);
  if (payload.plan_openings != null) {
    lines.push(`Aperturas del plan: ${payload.plan_openings}`);
  }

  return lines.join('\n');
}

/** Asunto del correo (contracts/notifications.md): "Pure — semana {N} ({dd}–{dd} {mes}): {veredicto}". */
export function renderReportSubject(payload: ReportPayload): string {
  return `Pure — semana ${payload.week_number} (${formatWeekRangeEs(payload.starts_on, payload.ends_on)}): ${payload.verdict}`;
}

/** Líneas de "En riesgo" para el resumen web (GET /api/execution/report): mismo contenido que el
 * correo, sin el correo del destinatario ni ningún otro dato que no deba salir por la web. */
export function formatRiskLines(risk: ReportRisk): string[] {
  return buildRiesgoLines(risk);
}
