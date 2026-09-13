// Servicio de fricción del teléfono (US-B5). Acceso a base de datos a través de
// lib/db/execution-pg.ts. Patrones de error y transacción iguales al resto de servicios.

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
} from '../db/execution-pg';
import { localParts, findCurrentWeek } from './time';
import { FRICTION_SLOTS, FRICTION_IRRITATION_THRESHOLD } from './constants';
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

export interface FrictionReadOutput {
  activas: FrictionMeasureOutput[];
  total_activas: number;
  limite: number;
  irritacion_semana_actual: number | null;
}

export async function enableFriction(
  key: string,
  now: Date
): Promise<ExecutionResult<FrictionMeasureOutput>> {
  try {
    // Paso 1: asegurar la fila
    await ensureFrictionMeasureRowInDb(key);

    // Paso 2: si ya tiene enabled_slot, éxito con ya_habilitada: true
    const existing = await fetchFrictionMeasuresFromDb(key);
    if (existing && !Array.isArray(existing) && existing.enabled_slot) {
      return {
        status: 'success',
        data: {
          id: existing.id,
          started_on: existing.started_on,
          verified_at: existing.verified_at,
          confirmada: existing.verified_at != null && new Date(existing.verified_at).getTime() >= new Date(existing.enabled_at!).getTime(),
          enabled_at: existing.enabled_at,
          ya_habilitada: true,
        },
      };
    }

    const { dateKey } = localParts(now);

    // Pasos 3 y 4: reclamar un slot
    for (const slot of FRICTION_SLOTS) {
      const claimed = await claimFrictionSlotInDb(key, slot, dateKey, now);
      if (claimed) {
        return {
          status: 'success',
          data: {
            id: claimed.id,
            started_on: claimed.started_on,
            verified_at: claimed.verified_at,
            confirmada: claimed.verified_at != null && new Date(claimed.verified_at).getTime() >= new Date(claimed.enabled_at!).getTime(),
            enabled_at: claimed.enabled_at,
            ya_habilitada: false,
          },
        };
      }
    }

    // Si ningún slot quedó disponible
    return {
      status: 'error',
      code: 'LIMITE_FRICCION',
      message:
        'Ya hay 2 medidas de fricción habilitadas. El límite existe porque la restricción parcial aumenta el estrés reportado y una medida abandonada por irritación vale 0: dos sostenibles valen más que cinco abandonadas. Deshabilita una antes de agregar otra.',
    };
  } catch (error) {
    console.error('[friction.ts enableFriction]', error);
    return { status: 'error', code: 'DATOS_INVALIDOS', message: 'Error al habilitar medida' };
  }
}

export async function disableFriction(
  key: string,
  now: Date
): Promise<ExecutionResult<FrictionMeasureOutput>> {
  try {
    const measure = await fetchFrictionMeasuresFromDb(key);
    if (!measure || Array.isArray(measure)) {
      return {
        status: 'success',
        data: {
          id: key,
          confirmada: false,
          ya_deshabilitada: true,
        },
      };
    }

    if (!measure.enabled_slot) {
      return {
        status: 'success',
        data: {
          id: measure.id,
          confirmed: false,
          ya_deshabilitada: true,
        },
      };
    }

    const disabled = await disableFrictionMeasureInDb(key, 'manual', now);
    return {
      status: 'success',
      data: {
        id: disabled!.id,
        started_on: disabled!.started_on,
        verified_at: disabled!.verified_at,
        confirmada: disabled!.verified_at != null && new Date(disabled!.verified_at).getTime() >= new Date(disabled!.enabled_at!).getTime(),
        enabled_at: disabled!.enabled_at,
        disabled_at: disabled!.disabled_at,
        drop_reason: disabled!.drop_reason,
      },
    };
  } catch (error) {
    console.error('[friction.ts disableFriction]', error);
    return { status: 'error', code: 'DATOS_INVALIDOS', message: 'Error al deshabilitar medida' };
  }
}

export async function verifyFriction(
  key: string,
  now: Date
): Promise<ExecutionResult<FrictionMeasureOutput>> {
  try {
    const measure = await fetchFrictionMeasuresFromDb(key);
    if (!measure || Array.isArray(measure) || !measure.enabled_slot) {
      return { status: 'error', code: 'NO_ENCONTRADO', message: 'Medida no habilitada' };
    }

    const verified = await verifyFrictionMeasureInDb(key, now);
    return {
      status: 'success',
      data: {
        id: verified!.id,
        started_on: verified!.started_on,
        verified_at: verified!.verified_at,
        confirmada: verified!.verified_at != null && new Date(verified!.verified_at).getTime() >= new Date(verified!.enabled_at!).getTime(),
        enabled_at: verified!.enabled_at,
      },
    };
  } catch (error) {
    console.error('[friction.ts verifyFriction]', error);
    return { status: 'error', code: 'DATOS_INVALIDOS', message: 'Error al verificar medida' };
  }
}

export async function rateFriction(
  input: { score: number; program_week_id?: string },
  now: Date
): Promise<ExecutionResult<FrictionRatingRecord>> {
  try {
    const allWeeks = await fetchProgramWeeksFromDb();
    const weeks = Array.isArray(allWeeks) ? allWeeks : [];

    let targetWeek;
    if (input.program_week_id) {
      targetWeek = await fetchProgramWeeksFromDb(input.program_week_id);
      if (!targetWeek || Array.isArray(targetWeek)) {
        return { status: 'error', code: 'NO_ENCONTRADO', message: 'Semana no encontrada' };
      }
    } else {
      const { dateKey } = localParts(now);
      const current = findCurrentWeek(weeks, dateKey);
      if (!current) {
        return { status: 'error', code: 'NO_ENCONTRADO', message: 'No hay semana en curso' };
      }
      targetWeek = current;
    }

    const { dateKey } = localParts(now);
    if (targetWeek.starts_on > dateKey) {
      return { status: 'error', code: 'FECHA_FUTURA', message: 'La semana aún no ha empezado' };
    }

    const saved = await saveFrictionRatingToDb({
      program_week_id: targetWeek.id,
      score: input.score,
      rated_at: now,
    });

    return { status: 'success', data: saved };
  } catch (error) {
    console.error('[friction.ts rateFriction]', error);
    return { status: 'error', code: 'DATOS_INVALIDOS', message: 'Error al calificar irritación' };
  }
}

export async function readFriction(now: Date): Promise<ExecutionResult<FrictionReadOutput>> {
  try {
    const allMeasures = await fetchFrictionMeasuresFromDb();
    const measures = Array.isArray(allMeasures) ? allMeasures : [];

    const allWeeks = await fetchProgramWeeksFromDb();
    const weeks = Array.isArray(allWeeks) ? allWeeks : [];
    const { dateKey } = localParts(now);
    const currentWeek = findCurrentWeek(weeks, dateKey);

    const activas = measures
      .filter((m) => m.enabled_slot)
      .map((m) => ({
        id: m.id,
        measure_key: m.id,
        started_on: m.started_on,
        verified_at: m.verified_at,
        confirmada: m.verified_at != null && new Date(m.verified_at).getTime() >= new Date(m.enabled_at!).getTime(),
      }));

    let irritacion = null;
    if (currentWeek) {
      const rating = await fetchFrictionRatingsFromDb(currentWeek.id);
      if (rating && !Array.isArray(rating)) {
        irritacion = rating.score;
      }
    }

    return {
      status: 'success',
      data: {
        activas: activas as any,
        total_activas: activas.length,
        limite: 2,
        irritacion_semana_actual: irritacion,
      },
    };
  } catch (error) {
    console.error('[friction.ts readFriction]', error);
    return { status: 'error', code: 'DATOS_INVALIDOS', message: 'Error al leer fricción' };
  }
}

export async function applyIrritationDrops(now: Date): Promise<number> {
  const allRatings = await fetchFrictionRatingsFromDb();
  const ratings = (Array.isArray(allRatings) ? allRatings : []) as FrictionRatingRecord[];

  const allWeeks = await fetchProgramWeeksFromDb();
  const weeks = (Array.isArray(allWeeks) ? allWeeks : []) as any[];

  const allMeasures = await fetchFrictionMeasuresFromDb();
  const measures = (Array.isArray(allMeasures) ? allMeasures : []) as FrictionMeasureRecord[];

  let dropsCount = 0;

  // Agrupar ratings por número de semana
  const ratingsByWeek = new Map<number, FrictionRatingRecord>();
  for (const rating of ratings) {
    const week = weeks.find((w) => w.id === rating.program_week_id);
    if (week) {
      ratingsByWeek.set(week.week_number, rating);
    }
  }

  // Recorrer pares consecutivos
  for (const weekNum of ratingsByWeek.keys()) {
    const prevWeekNum = weekNum - 1;
    if (!ratingsByWeek.has(prevWeekNum)) continue;

    const prevRating = ratingsByWeek.get(prevWeekNum)!;
    const currRating = ratingsByWeek.get(weekNum)!;

    if (
      prevRating.score >= FRICTION_IRRITATION_THRESHOLD &&
      currRating.score >= FRICTION_IRRITATION_THRESHOLD &&
      !currRating.drop_applied_at
    ) {
      // Aplicar el retiro dentro de una transacción
      await withExecutionTransaction(async (client) => {
        // Marcar el par como atendido
        const claimedRating = await claimIrritationDropInDb(currRating.id, null, now, client);
        if (!claimedRating) return;

        // Encontrar la medida habilitada con enabled_at más reciente
        const enabledMeasures = measures.filter((m) => m.enabled_slot);
        if (enabledMeasures.length === 0) {
          // Actualizar sin medir
          await claimIrritationDropInDb(currRating.id, null, now, client);
          return;
        }

        const mostRecent = enabledMeasures.reduce((prev, curr) => {
          const prevTime = new Date(prev.enabled_at!).getTime();
          const currTime = new Date(curr.enabled_at!).getTime();
          return currTime > prevTime ? curr : prev;
        });

        // Deshabilitar la medida más reciente
        await disableFrictionMeasureInDb(mostRecent.id, 'irritacion', now, client);
        await claimIrritationDropInDb(currRating.id, mostRecent.id, now, client);

        console.log(`[execution-tick] fricción retirada por irritación: ${mostRecent.id}`);
        dropsCount++;
      });
    }
  }

  return dropsCount;
}

export async function listIrritationDropsInRange(
  from: string,
  to: string,
  cutoff: Date
): Promise<Array<{ measure_key: string; fecha: string }>> {
  const allMeasures = await fetchFrictionMeasuresFromDb();
  const measures = Array.isArray(allMeasures) ? allMeasures : [];

  const result: Array<{ measure_key: string; fecha: string }> = [];

  for (const measure of measures) {
    if (measure.drop_reason !== 'irritacion' || !measure.disabled_at) continue;

    const disabledTime = new Date(measure.disabled_at).getTime();
    const cutoffTime = cutoff.getTime();
    if (disabledTime > cutoffTime) continue;

    const { dateKey } = localParts(measure.disabled_at);
    if (dateKey >= from && dateKey <= to) {
      result.push({ measure_key: measure.id, fecha: dateKey });
    }
  }

  return result;
}
