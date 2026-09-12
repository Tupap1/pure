// Servicio de tandas (US1 — Tanda de 10 minutos en un toque). Handler único consumido por
// manage_tandas (MCP) y, a través suyo, por app/api/execution/route.ts (Principio I: una sola
// vía de datos). Toda hora sale de `now` (el reloj del servidor); ninguna función de este
// archivo acepta ni produce una hora aportada por el cliente.
//
// finalizeElapsed corre al principio de cada operación (FR-005): así una tanda cuyo tiempo ya
// se cumplió queda completada sola, aunque nadie la haya tocado y el teléfono esté bloqueado.
//
// FR-004 (como máximo una tanda en curso) se resuelve con `running_lock TEXT UNIQUE` (migración
// 008): `start` intenta un INSERT directo (nunca un SELECT previo que decida si insertar) y
// traduce la violación de esa restricción UNIQUE a TANDA_EN_CURSO. Es la propia base de datos
// la que arbitra atómicamente entre dos inicios simultáneos desde dispositivos distintos.

import crypto from 'crypto';
import { localParts, localDateTimeToInstant, addDays } from './time';
import { TANDA_MINUTES_DEFAULT, DAY_LOCK_TIME } from './constants';
import type { ExecutionResult } from '../validations/schemas';
import {
  fetchTandasFromDb,
  saveTandaToDb,
  TandaRecord,
  fetchRoutineSlotsFromDb,
  saveSlotOutcomeToDb,
  RoutineSlotRecord,
} from '../db/execution-pg';

/** true si `error` es la violación de la restricción UNIQUE de `running_lock` (pg y pg-mem
 * reportan el código 23505; pg-mem no rellena `error.constraint`, así que se confirma por texto
 * del mensaje, que sí incluye el nombre de la columna en ambos motores). */
function isRunningLockViolation(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return !!err && err.code === '23505' && /running_lock/i.test(err.message || '');
}

async function findRunningTanda(): Promise<TandaRecord | null> {
  const allRaw = await fetchTandasFromDb();
  const all = (Array.isArray(allRaw) ? allRaw : []) as TandaRecord[];
  return all.find((t) => t.running_lock === 'running') ?? null;
}

async function findTandaById(id: string): Promise<TandaRecord | null> {
  const raw = await fetchTandasFromDb(id);
  return (Array.isArray(raw) ? raw[0] : raw) as TandaRecord | null;
}

function endsAtMs(tanda: TandaRecord): number {
  return new Date(tanda.started_at).getTime() + tanda.planned_minutes * 60_000;
}

/**
 * Cierra por tiempo la tanda en curso, si la hay y si su tiempo ya se cumplió (FR-005). Se
 * llama al principio de toda operación del módulo, para que una tanda se complete sola aunque
 * la app esté cerrada o el teléfono bloqueado. Devuelve la tanda cerrada, o null si no había
 * ninguna que cerrar.
 */
export async function finalizeElapsed(now: Date = new Date()): Promise<TandaRecord | null> {
  const running = await findRunningTanda();
  if (!running) return null;
  if (now.getTime() < endsAtMs(running)) return null;

  return await saveTandaToDb({
    ...running,
    ended_at: new Date(endsAtMs(running)).toISOString(),
    actual_minutes: running.planned_minutes,
    status: 'completada',
    running_lock: null,
  });
}

export interface TandaStartInput {
  subject_id?: string;
  topic_id?: string;
  deliverable_id?: string;
  task_id?: string;
  routine_slot_id?: string;
  planned_minutes?: number;
}

/**
 * FR-001, FR-002, FR-004: empieza una tanda con la hora del servidor. US2-AS7/FR-012: si viene
 * de un disparador (`routine_slot_id`), hereda su materia cuando no se indicó una explícita y
 * dispara el mismo efecto que "responder hecho" (slot_outcomes de hoy) — el botón "Empezar
 * tanda" de un disparador de estudio en Hoy llama a esta misma acción, así que aquí es donde debe
 * quedar hecho, no en manage_routine_slots:respond (que no arranca tandas).
 */
export async function startTanda(
  input: TandaStartInput,
  now: Date = new Date()
): Promise<ExecutionResult<{ tanda: TandaRecord; ends_at: string }>> {
  await finalizeElapsed(now);

  let subjectId = input.subject_id;
  if (input.routine_slot_id && !subjectId) {
    const slot = (await fetchRoutineSlotsFromDb(input.routine_slot_id)) as RoutineSlotRecord | null;
    if (slot?.subject_id) subjectId = slot.subject_id;
  }

  const plannedMinutes = input.planned_minutes ?? TANDA_MINUTES_DEFAULT;
  const local = localParts(now);
  const lockedAt = localDateTimeToInstant(addDays(local.dateKey, 1), DAY_LOCK_TIME);
  const endsAt = new Date(now.getTime() + plannedMinutes * 60_000);

  try {
    const tanda = await saveTandaToDb({
      id: `tanda-${crypto.randomUUID()}`,
      subject_id: subjectId,
      topic_id: input.topic_id,
      deliverable_id: input.deliverable_id,
      task_id: input.task_id,
      routine_slot_id: input.routine_slot_id,
      local_date: local.dateKey,
      started_at: now.toISOString(),
      planned_minutes: plannedMinutes,
      status: 'en_curso',
      running_lock: 'running',
      locked_at: lockedAt.toISOString(),
    });

    if (input.routine_slot_id) {
      // Idempotente por diseño (mismo id que manage_routine_slots:respond usaría hoy): si ya
      // había una respuesta, esto simplemente la deja en 'hecho' sin duplicar filas.
      await saveSlotOutcomeToDb({
        id: `${local.dateKey}:${input.routine_slot_id}`,
        date: local.dateKey,
        routine_slot_id: input.routine_slot_id,
        outcome: 'hecho',
      });
    }

    return { status: 'success', data: { tanda, ends_at: endsAt.toISOString() } };
  } catch (error) {
    if (isRunningLockViolation(error)) {
      return {
        status: 'error',
        code: 'TANDA_EN_CURSO',
        message: 'Ya hay una tanda en curso: termínala o interrúmpela antes de empezar otra.',
      };
    }
    throw error;
  }
}

/** FR-003: finish exige que el tiempo planeado ya se haya cumplido (con 30s de margen); antes
 * de eso, la única salida es interrupt. Idempotente sobre una tanda ya cerrada. */
export async function finishTanda(id: string, now: Date = new Date()): Promise<ExecutionResult<TandaRecord>> {
  await finalizeElapsed(now);

  const existing = await findTandaById(id);
  if (!existing) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la tanda ${id}.` };
  }

  if (existing.status !== 'en_curso') {
    return { status: 'success', data: existing };
  }

  const elapsedMs = now.getTime() - new Date(existing.started_at).getTime();
  const requiredMs = existing.planned_minutes * 60_000 - 30_000;
  if (elapsedMs < requiredMs) {
    return {
      status: 'error',
      code: 'TANDA_NO_TERMINADA',
      message: 'Todavía no se cumple el tiempo planeado: usa interrupt si necesitas cortarla antes.',
    };
  }

  const updated = await saveTandaToDb({
    ...existing,
    ended_at: now.toISOString(),
    actual_minutes: Math.floor(elapsedMs / 60_000),
    status: 'completada',
    running_lock: null,
  });
  return { status: 'success', data: updated };
}

export interface TandaInterruptInput {
  id: string;
  interrupt_reason: string;
}

/** FR-003: única forma de cortar una tanda antes de tiempo; exige una razón (1-140 caracteres,
 * validada en el esquema Zod). Si la tanda ya se había cerrado por tiempo, se devuelve sin
 * cambios (finalizeElapsed ya la cerró arriba). */
export async function interruptTanda(
  input: TandaInterruptInput,
  now: Date = new Date()
): Promise<ExecutionResult<TandaRecord>> {
  await finalizeElapsed(now);

  const existing = await findTandaById(input.id);
  if (!existing) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la tanda ${input.id}.` };
  }

  if (existing.status !== 'en_curso') {
    return { status: 'success', data: existing };
  }

  const elapsedMs = now.getTime() - new Date(existing.started_at).getTime();
  const updated = await saveTandaToDb({
    ...existing,
    ended_at: now.toISOString(),
    actual_minutes: Math.max(0, Math.floor(elapsedMs / 60_000)),
    status: 'interrumpida',
    running_lock: null,
    interrupt_reason: input.interrupt_reason,
  });
  return { status: 'success', data: updated };
}

/** `{ tanda | null, seconds_left | null, server_now }` (contracts/mcp-tools.md). */
export async function currentTanda(
  now: Date = new Date()
): Promise<ExecutionResult<{ tanda: TandaRecord | null; seconds_left: number | null; server_now: string }>> {
  await finalizeElapsed(now);

  const running = await findRunningTanda();
  if (!running) {
    return { status: 'success', data: { tanda: null, seconds_left: null, server_now: now.toISOString() } };
  }

  const secondsLeft = Math.max(0, Math.round((endsAtMs(running) - now.getTime()) / 1000));
  return { status: 'success', data: { tanda: running, seconds_left: secondsLeft, server_now: now.toISOString() } };
}

export interface TandaReadInput {
  from?: string;
  to?: string;
  subject_id?: string;
}

export interface TandaDayResumen {
  date: string;
  completadas: number;
  interrumpidas: number;
  minutos: number;
}

/** `{ tandas[], por_dia[] }` (contracts/mcp-tools.md). El filtrado y el agregado por día son
 * aritmética pura en TypeScript (Constitución, Principio III), no SQL. */
export async function readTandas(
  input: TandaReadInput = {},
  now: Date = new Date()
): Promise<ExecutionResult<{ tandas: TandaRecord[]; por_dia: TandaDayResumen[] }>> {
  await finalizeElapsed(now);

  const allRaw = await fetchTandasFromDb();
  const all = (Array.isArray(allRaw) ? allRaw : []) as TandaRecord[];

  const filtered = all.filter((t) => {
    if (input.from && t.local_date < input.from) return false;
    if (input.to && t.local_date > input.to) return false;
    if (input.subject_id && t.subject_id !== input.subject_id) return false;
    return true;
  });

  const byDay = new Map<string, TandaDayResumen>();
  for (const t of filtered) {
    const bucket = byDay.get(t.local_date) ?? { date: t.local_date, completadas: 0, interrumpidas: 0, minutos: 0 };
    if (t.status === 'completada') bucket.completadas += 1;
    if (t.status === 'interrumpida') bucket.interrumpidas += 1;
    bucket.minutos += t.actual_minutes ?? 0;
    byDay.set(t.local_date, bucket);
  }

  const por_dia = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  return { status: 'success', data: { tandas: filtered, por_dia } };
}

export interface TandaUpdateInput {
  id: string;
  subject_id?: string;
  topic_id?: string;
  deliverable_id?: string;
  task_id?: string;
  mode?: string;
  interrupt_reason?: string;
}

/** FR-007/FR-008: solo reclasifica una tanda ya cerrada (nunca tiempos). Si `now` cae después
 * de `locked_at`, marca `edited_after_lock` (US1-AS6). */
export async function updateTanda(
  input: TandaUpdateInput,
  now: Date = new Date()
): Promise<ExecutionResult<TandaRecord>> {
  await finalizeElapsed(now);

  const existing = await findTandaById(input.id);
  if (!existing) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la tanda ${input.id}.` };
  }

  if (existing.status === 'en_curso') {
    return {
      status: 'error',
      code: 'TANDA_EN_CURSO',
      message: 'No se puede editar una tanda en curso: espera a que termine o interrúmpela.',
    };
  }

  const editedAfterLock = existing.edited_after_lock || now.getTime() > new Date(existing.locked_at).getTime();

  const updated = await saveTandaToDb({
    ...existing,
    subject_id: input.subject_id ?? existing.subject_id,
    topic_id: input.topic_id ?? existing.topic_id,
    deliverable_id: input.deliverable_id ?? existing.deliverable_id,
    task_id: input.task_id ?? existing.task_id,
    mode: input.mode ?? existing.mode,
    interrupt_reason: input.interrupt_reason ?? existing.interrupt_reason,
    edited_after_lock: editedAfterLock,
  });
  return { status: 'success', data: updated };
}
