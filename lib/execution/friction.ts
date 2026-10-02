// Servicio de fricción del teléfono (US-B5). Acceso a base de datos a través de
// lib/db/execution-pg.ts. Mismo patrón que el resto de servicios del módulo (planning.ts,
// tandas.ts): las reglas de negocio devuelven un ExecutionResult de error (nunca lanzan), y un
// error real de la base se propaga sin capturar — lo atrapa el try/catch de
// handleManageFriction (lib/execution/handlers.ts), la única función de este módulo que debe
// envolver todo en try/catch.

import {
  fetchFrictionMeasuresFromDb,
  ensureFrictionMeasureRowInDb,
  claimFrictionSlotInDb,
  disableFrictionMeasureInDb,
  verifyFrictionMeasureInDb,
  fetchFrictionRatingsFromDb,
  saveFrictionRatingToDb,
  claimIrritationDropInDb,
  withExecutionTransaction,
  fetchProgramWeeksFromDb,
  type FrictionMeasureRecord,
  type FrictionRatingRecord,
  type ProgramWeekRecord,
} from '../db/execution-pg';
import { localParts, addDays } from './time';
import { FRICTION_SLOTS, FRICTION_MAX_ENABLED, FRICTION_IRRITATION_THRESHOLD, FRICTION_LIMIT_MESSAGE } from './constants';
import type { ExecutionResult } from '../validations/schemas';

export interface FrictionMeasureOutput {
  id: string;
  started_on?: string | null;
  verified_at?: string | null;
  confirmada: boolean;
  enabled_at?: string | null;
  disabled_at?: string | null;
  drop_reason?: string | null;
  ya_habilitada?: boolean;
  ya_deshabilitada?: boolean;
}

export interface FrictionActiveMeasure {
  id: string;
  measure_key: string;
  started_on?: string | null;
  verified_at?: string | null;
  confirmada: boolean;
}

export interface FrictionReadOutput {
  activas: FrictionActiveMeasure[];
  total_activas: number;
  limite: number;
  irritacion_semana_actual: number | null;
}

/** FR-B18: confirmada = se verificó, y esa verificación es posterior a la última habilitación
 * (una verificación vieja, de antes de deshabilitar y volver a habilitar, no cuenta). */
function isConfirmed(measure: Pick<FrictionMeasureRecord, 'verified_at' | 'enabled_at'>): boolean {
  return (
    measure.verified_at != null &&
    measure.enabled_at != null &&
    new Date(measure.verified_at).getTime() >= new Date(measure.enabled_at).getTime()
  );
}

/** true si `error` es la violación de la restricción UNIQUE de `enabled_slot` (FR-B17): pg y
 * pg-mem reportan el código 23505; el nombre de la columna aparece en `message` o en `detail`
 * según el motor. R-B08: el reclamo condicionado (`claimFrictionSlotInDb`) ya descarta el caso
 * normal antes de llegar aquí, así que esto solo puede pasar con dos habilitaciones simultáneas
 * en Postgres real — se trata igual que "slot ocupado", nunca como un error inesperado. */
function isEnabledSlotViolation(error: unknown): boolean {
  const err = error as { code?: string; message?: string; detail?: string } | null;
  if (!err || err.code !== '23505') return false;
  return /enabled_slot/i.test(err.message || '') || /enabled_slot/i.test(err.detail || '');
}

/** Semana en curso: la del programa cuyo rango [starts_on, starts_on+6] contiene la fecha local
 * de `today`. Helper local (no vive en lib/execution/time.ts): mismo cálculo en línea que ya usan
 * previewWeeklyReport (handlers.ts) y resolveTargetAndPastWeek (planning.ts), sin un helper común
 * compartido para esto todavía. */
function findCurrentWeek(weeks: ProgramWeekRecord[], todayKey: string): ProgramWeekRecord | undefined {
  return weeks.find((w) => w.starts_on <= todayKey && todayKey <= addDays(w.starts_on, 6));
}

function toMeasureOutput(measure: FrictionMeasureRecord, extra: Partial<FrictionMeasureOutput> = {}): FrictionMeasureOutput {
  return {
    id: measure.id,
    started_on: measure.started_on,
    verified_at: measure.verified_at,
    confirmada: isConfirmed(measure),
    enabled_at: measure.enabled_at,
    disabled_at: measure.disabled_at,
    drop_reason: measure.drop_reason,
    ...extra,
  };
}

/**
 * FR-B16/FR-B17: habilita una medida. `ensureFrictionMeasureRowInDb` nunca toca `enabled_slot`
 * (R-B08), así que una medida ya habilitada se detecta ANTES de intentar ningún reclamo, y
 * responde sin cambiar nada (`ya_habilitada: true`, mismo `started_on`). Si no, reclama un slot
 * libre ('a' y después 'b'); si los dos están ocupados, `LIMITE_FRICCION`.
 */
export async function enableFriction(key: string, now: Date): Promise<ExecutionResult<FrictionMeasureOutput>> {
  await ensureFrictionMeasureRowInDb(key);

  const existingRaw = await fetchFrictionMeasuresFromDb(key);
  const existing = (Array.isArray(existingRaw) ? existingRaw[0] : existingRaw) as FrictionMeasureRecord | null;
  if (existing?.enabled_slot) {
    return { status: 'success', data: toMeasureOutput(existing, { ya_habilitada: true }) };
  }

  const { dateKey } = localParts(now);

  for (const slot of FRICTION_SLOTS) {
    let claimed: FrictionMeasureRecord | null;
    try {
      claimed = await claimFrictionSlotInDb(key, slot, dateKey, now);
    } catch (error) {
      // Dos habilitaciones simultáneas en Postgres real pueden chocar aquí en vez de en el
      // WHERE (R-B08): se trata como slot ocupado y se prueba el siguiente; cualquier otro
      // error (una caída de la base, por ejemplo) se relanza y lo atrapa el handler.
      if (isEnabledSlotViolation(error)) continue;
      throw error;
    }
    if (claimed) {
      return { status: 'success', data: toMeasureOutput(claimed, { ya_habilitada: false }) };
    }
  }

  return { status: 'error', code: 'LIMITE_FRICCION', message: FRICTION_LIMIT_MESSAGE };
}

/** FR-B17: deshabilita una medida habilitada (motivo 'manual'). Una medida ya deshabilitada, o
 * que nunca se creó, no cambia nada (`ya_deshabilitada: true`, con el `disabled_at` que ya
 * tuviera — o ninguno, si nunca se llegó a habilitar). */
export async function disableFriction(key: string, now: Date): Promise<ExecutionResult<FrictionMeasureOutput>> {
  const existingRaw = await fetchFrictionMeasuresFromDb(key);
  const existing = (Array.isArray(existingRaw) ? existingRaw[0] : existingRaw) as FrictionMeasureRecord | null;

  if (!existing || !existing.enabled_slot) {
    return {
      status: 'success',
      data: existing
        ? toMeasureOutput(existing, { confirmada: false, ya_deshabilitada: true })
        : { id: key, confirmada: false, ya_deshabilitada: true },
    };
  }

  const disabled = await disableFrictionMeasureInDb(key, 'manual', now);
  return { status: 'success', data: toMeasureOutput(disabled!, { confirmada: false, ya_deshabilitada: false }) };
}

/** FR-B18: marca como verificada una medida habilitada. Verificar una que no está habilitada
 * (nunca existió, o está deshabilitada) se rechaza: no hay nada que confirmar. */
export async function verifyFriction(key: string, now: Date): Promise<ExecutionResult<FrictionMeasureOutput>> {
  const existingRaw = await fetchFrictionMeasuresFromDb(key);
  const existing = (Array.isArray(existingRaw) ? existingRaw[0] : existingRaw) as FrictionMeasureRecord | null;
  if (!existing || !existing.enabled_slot) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `La medida ${key} no está habilitada.` };
  }

  const verified = await verifyFrictionMeasureInDb(key, now);
  return { status: 'success', data: toMeasureOutput(verified!) };
}

/** FR-B19: registra la irritación de una semana (0-10), reemplazando la calificación anterior de
 * esa misma semana. Sin `program_week_id`, usa la semana en curso; con uno explícito que no
 * exista, `NO_ENCONTRADO`. Calificar una semana que todavía no empezó, `FECHA_FUTURA`. */
export async function rateFriction(
  input: { score: number; program_week_id?: string },
  now: Date
): Promise<ExecutionResult<FrictionRatingRecord>> {
  const { dateKey } = localParts(now);

  let targetWeek: ProgramWeekRecord | null;
  if (input.program_week_id) {
    const found = await fetchProgramWeeksFromDb(input.program_week_id);
    targetWeek = (Array.isArray(found) ? found[0] : found) as ProgramWeekRecord | null;
    if (!targetWeek) {
      return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la semana ${input.program_week_id}.` };
    }
  } else {
    const allWeeks = await fetchProgramWeeksFromDb();
    const weeks = (Array.isArray(allWeeks) ? allWeeks : []) as ProgramWeekRecord[];
    const current = findCurrentWeek(weeks, dateKey);
    if (!current) {
      return { status: 'error', code: 'NO_ENCONTRADO', message: 'No hay una semana en curso para calificar.' };
    }
    targetWeek = current;
  }

  if (targetWeek.starts_on > dateKey) {
    return { status: 'error', code: 'FECHA_FUTURA', message: 'Esa semana todavía no empieza.' };
  }

  const saved = await saveFrictionRatingToDb({ program_week_id: targetWeek.id, score: input.score, rated_at: now });
  return { status: 'success', data: saved };
}

/** FR-B22: medidas habilitadas (con su confirmación), cuántas hay, y la irritación de la semana
 * en curso (o null si no se ha calificado o no hay programa). */
export async function readFriction(now: Date): Promise<ExecutionResult<FrictionReadOutput>> {
  const allMeasures = await fetchFrictionMeasuresFromDb();
  const measures = (Array.isArray(allMeasures) ? allMeasures : []) as FrictionMeasureRecord[];

  const activas: FrictionActiveMeasure[] = measures
    .filter((m) => m.enabled_slot)
    .map((m) => ({
      id: m.id,
      measure_key: m.id,
      started_on: m.started_on,
      verified_at: m.verified_at,
      confirmada: isConfirmed(m),
    }));

  const allWeeks = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(allWeeks) ? allWeeks : []) as ProgramWeekRecord[];
  const currentWeek = findCurrentWeek(weeks, localParts(now).dateKey);

  let irritacion: number | null = null;
  if (currentWeek) {
    const ratingRaw = await fetchFrictionRatingsFromDb(currentWeek.id);
    const rating = (Array.isArray(ratingRaw) ? ratingRaw[0] : ratingRaw) as FrictionRatingRecord | null;
    if (rating) irritacion = rating.score;
  }

  return {
    status: 'success',
    data: { activas, total_activas: activas.length, limite: FRICTION_MAX_ENABLED, irritacion_semana_actual: irritacion },
  };
}

/**
 * FR-B20/R-B09: retiro automático por irritación sostenida. Recorre los pares de semanas
 * consecutivas del programa (por `week_number`, en orden); cuando las dos calificaciones son
 * >= FRICTION_IRRITATION_THRESHOLD y la posterior todavía no tiene `drop_applied_at`, reclama el
 * par y decide (y aplica) la medida a retirar dentro de UNA sola transacción por par — así, si la
 * misma corrida atiende dos pares (tres semanas seguidas altas), el segundo par ve ya reflejado
 * el retiro del primero en vez de trabajar con la lista de medidas leída al principio. El claim
 * de `drop_applied_at` es idempotente (`WHERE drop_applied_at IS NULL`): correr el tick otra vez
 * no repite el retiro. Nunca envía avisos al teléfono (FR-B20). Devuelve cuántas medidas retiró.
 */
export async function applyIrritationDrops(now: Date): Promise<number> {
  const allRatings = await fetchFrictionRatingsFromDb();
  const ratings = (Array.isArray(allRatings) ? allRatings : []) as FrictionRatingRecord[];

  const allWeeks = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(allWeeks) ? allWeeks : []) as ProgramWeekRecord[];

  const ratingByWeekNumber = new Map<number, FrictionRatingRecord>();
  for (const rating of ratings) {
    const week = weeks.find((w) => w.id === rating.program_week_id);
    if (week) ratingByWeekNumber.set(week.week_number, rating);
  }

  let dropsCount = 0;
  const weekNumbers = Array.from(ratingByWeekNumber.keys()).sort((a, b) => a - b);

  for (const weekNumber of weekNumbers) {
    const prevRating = ratingByWeekNumber.get(weekNumber - 1);
    if (!prevRating) continue;
    const currRating = ratingByWeekNumber.get(weekNumber)!;

    const bothHigh = prevRating.score >= FRICTION_IRRITATION_THRESHOLD && currRating.score >= FRICTION_IRRITATION_THRESHOLD;
    if (!bothHigh || currRating.drop_applied_at) continue;

    await withExecutionTransaction(async (client) => {
      // Se lee DENTRO de la transacción, y no con la lista de antes del bucle: si un par
      // anterior de esta misma corrida ya retiró una medida, este par tiene que verlo.
      const measuresRaw = await fetchFrictionMeasuresFromDb(undefined, client);
      const measures = (Array.isArray(measuresRaw) ? measuresRaw : []) as FrictionMeasureRecord[];
      const enabled = measures.filter((m) => m.enabled_slot);
      const mostRecent = enabled.length
        ? enabled.reduce((prev, curr) => (new Date(curr.enabled_at!).getTime() > new Date(prev.enabled_at!).getTime() ? curr : prev))
        : null;

      const claimed = await claimIrritationDropInDb(currRating.id, mostRecent?.id ?? null, now, client);
      if (claimed && mostRecent) {
        await disableFrictionMeasureInDb(mostRecent.id, 'irritacion', now, client);
        console.error(`[execution-tick] fricción retirada por irritación: ${mostRecent.id}`);
        dropsCount++;
      }
    });
  }

  return dropsCount;
}

/** FR-B21/R-B10: medidas retiradas por irritación cuyo retiro (día local de `disabled_at`) cae
 * dentro de [from, to] y ocurrió antes de `cutoff` — la misma función para el congelamiento
 * (freezeOneWeek) y para la vista previa (assembleReportInput), Principio I. */
export async function listIrritationDropsInRange(
  from: string,
  to: string,
  cutoff: Date
): Promise<Array<{ measure_key: string; fecha: string }>> {
  const allMeasures = await fetchFrictionMeasuresFromDb();
  const measures = (Array.isArray(allMeasures) ? allMeasures : []) as FrictionMeasureRecord[];

  const result: Array<{ measure_key: string; fecha: string }> = [];
  for (const measure of measures) {
    if (measure.drop_reason !== 'irritacion' || !measure.disabled_at) continue;
    if (new Date(measure.disabled_at).getTime() > cutoff.getTime()) continue;

    const { dateKey } = localParts(measure.disabled_at);
    if (dateKey >= from && dateKey <= to) {
      result.push({ measure_key: measure.id, fecha: dateKey });
    }
  }
  return result;
}
