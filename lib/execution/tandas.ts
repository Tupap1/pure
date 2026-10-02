// Servicio de tandas (US1 — Tanda de 10 minutos en un toque). Handler único consumido por
// manage_tandas (MCP) y, a través suyo, por app/api/execution/route.ts (Principio I: una sola
// vía de datos). Toda hora sale de `now` (el reloj del servidor); ninguna función de este
// archivo acepta ni produce una hora aportada por el cliente.
//
// finalizeElapsed corre al principio de cada operación (FR-005): así una tanda cuyo tiempo ya
// se cumplió queda completada sola, aunque nadie la haya tocado y el teléfono esté bloqueado.
// Un cronómetro (004, FR-F06) no tiene tiempo que cumplir: finalizeElapsed lo ignora y solo se
// cierra al terminarlo (`finish`), interrumpirlo (`interrupt`) o, más adelante, corregirlo.
//
// FR-004 (como máximo una tanda en curso) se resuelve con `running_lock TEXT UNIQUE` (migración
// 008): `start` intenta un INSERT directo (nunca un SELECT previo que decida si insertar) y
// traduce la violación de esa restricción UNIQUE a TANDA_EN_CURSO. Es la propia base de datos
// la que arbitra atómicamente entre dos inicios simultáneos desde dispositivos distintos.

import crypto from 'crypto';
import { localParts, localDateTimeToInstant, addDays, splitByLocalDay } from './time';
import {
  TANDA_MINUTES_DEFAULT,
  DAY_LOCK_TIME,
  CRONOMETRO_MIN_FINISH_SECONDS,
  LATE_LOG_MAX_HOURS_BACK,
  LATE_LOG_MAX_PER_DAY,
  LATE_LOG_MIN_MINUTES,
  LATE_LOG_MAX_MINUTES,
} from './constants';
import { sessionShares, tallyDay, type SplitByLocalDay } from '../domain/focus';
import type { ExecutionResult, ExecutionErrorResult } from '../validations/schemas';
import {
  fetchTandasFromDb,
  saveTandaToDb,
  TandaRecord,
  fetchRoutineSlotsFromDb,
  saveSlotOutcomeToDb,
  RoutineSlotRecord,
  fetchObjectivesFromDb,
  ObjectiveRecord,
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

async function findObjectiveById(id: string): Promise<ObjectiveRecord | null> {
  const raw = await fetchObjectivesFromDb(id);
  return ((Array.isArray(raw) ? raw[0] : raw) ?? null) as ObjectiveRecord | null;
}

/**
 * Todos los objetivos por id, para `tallyDay` (FR-F13: decide con `objetivo.subject_id` si una
 * sesión cuenta para el mínimo). Incluye los archivados, porque sus sesiones viejas siguen contando
 * igual que antes de archivarlos. Una sola lectura por llamada de lectura (readTandas, getToday,
 * getCompliance): son pocas filas y se reutiliza el mapa para todos los días evaluados.
 */
export async function loadObjectivesById(): Promise<Map<string, ObjectiveRecord>> {
  const raw = await fetchObjectivesFromDb();
  const list = (Array.isArray(raw) ? raw : []) as ObjectiveRecord[];
  return new Map(list.map((objective) => [objective.id, objective]));
}

/** NO_ENCONTRADO si el objetivo no existe; con `rejectArchived`, OBJETIVO_ARCHIVADO si está archivado.
 * `null` si es válido (US-F2-AS3). */
async function checkObjective(
  objectiveId: string,
  opts: { rejectArchived: boolean }
): Promise<ExecutionErrorResult | null> {
  const objective = await findObjectiveById(objectiveId);
  if (!objective) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe el objetivo ${objectiveId}.` };
  }
  if (opts.rejectArchived && objective.archived) {
    return {
      status: 'error',
      code: 'OBJETIVO_ARCHIVADO',
      message: `El objetivo ${objective.name} está archivado: elige uno activo para empezar la sesión.`,
    };
  }
  return null;
}

/** Instante previsto de fin (ms), o null en un cronómetro, que no tiene fin previsto (FR-F01). */
function endsAtMs(tanda: TandaRecord): number | null {
  if (tanda.kind === 'cronometro' || !tanda.planned_minutes) return null;
  return new Date(tanda.started_at).getTime() + (tanda.planned_minutes as number) * 60_000;
}

/**
 * `splitByLocalDay` con caché por (inicio, fin). `tallyDay` reparte cada cronómetro una vez por
 * día evaluado; con un año de días y varias sesiones eso repetiría miles de veces el mismo reparto
 * (y cada uno construye `Intl.DateTimeFormat`). La caché vive lo que dura una llamada de lectura:
 * crea una por llamada, no una global.
 */
export function cachedSplitByLocalDay(): SplitByLocalDay {
  const cache = new Map<string, ReturnType<SplitByLocalDay>>();
  return (startIso, endIso) => {
    const key = `${new Date(startIso).getTime()}|${new Date(endIso).getTime()}`;
    let shares = cache.get(key);
    if (!shares) {
      shares = splitByLocalDay(startIso, endIso);
      cache.set(key, shares);
    }
    return shares;
  };
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
  // R8: el cronómetro no se cierra por tiempo (ni dispara el aviso de fin del tick: tick.ts solo
  // avisa cuando esta función devuelve una tanda cerrada).
  if (running.kind === 'cronometro') return null;
  const ends = endsAtMs(running);
  if (ends === null || now.getTime() < ends) return null;

  return await saveTandaToDb({
    ...running,
    ended_at: new Date(ends).toISOString(),
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
  /** 004: 'temporizador' por defecto; 'cronometro' no tiene duración planeada. */
  kind?: 'temporizador' | 'cronometro';
  /** 004 (US-F2-AS3): objetivo al que se liga la sesión; debe existir y no estar archivado. */
  objective_id?: string;
  planned_minutes?: number;
}

/**
 * FR-001, FR-002, FR-004: empieza una tanda con la hora del servidor. 004 (FR-F01): `kind` elige
 * entre temporizador (10-180 min, `ends_at` previsto) y cronómetro (`planned_minutes` y `ends_at`
 * nulos; solo se cierra al terminarlo o interrumpirlo). US2-AS7/FR-012: si viene
 * de un disparador (`routine_slot_id`), hereda su materia cuando no se indicó una explícita y
 * dispara el mismo efecto que "responder hecho" (slot_outcomes de hoy) — el botón "Empezar
 * tanda" de un disparador de estudio en Hoy llama a esta misma acción, así que aquí es donde debe
 * quedar hecho, no en manage_routine_slots:respond (que no arranca tandas).
 */
export async function startTanda(
  input: TandaStartInput,
  now: Date = new Date()
): Promise<ExecutionResult<{ tanda: TandaRecord; ends_at: string | null }>> {
  await finalizeElapsed(now);

  // US-F2-AS3: el objetivo se valida antes de tocar nada, para que un rechazo no cree filas.
  if (input.objective_id) {
    const rejected = await checkObjective(input.objective_id, { rejectArchived: true });
    if (rejected) return rejected;
  }

  let subjectId = input.subject_id;
  if (input.routine_slot_id && !subjectId) {
    const slot = (await fetchRoutineSlotsFromDb(input.routine_slot_id)) as RoutineSlotRecord | null;
    if (slot?.subject_id) subjectId = slot.subject_id;
  }

  const kind = input.kind ?? 'temporizador';
  const plannedMinutes = kind === 'cronometro' ? null : (input.planned_minutes ?? TANDA_MINUTES_DEFAULT);
  const local = localParts(now);
  const lockedAt = localDateTimeToInstant(addDays(local.dateKey, 1), DAY_LOCK_TIME);
  const endsAt = plannedMinutes === null ? null : new Date(now.getTime() + plannedMinutes * 60_000);

  try {
    const tanda = await saveTandaToDb({
      id: `tanda-${crypto.randomUUID()}`,
      subject_id: subjectId,
      topic_id: input.topic_id,
      deliverable_id: input.deliverable_id,
      task_id: input.task_id,
      routine_slot_id: input.routine_slot_id,
      objective_id: input.objective_id,
      local_date: local.dateKey,
      started_at: now.toISOString(),
      kind,
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

    return { status: 'success', data: { tanda, ends_at: endsAt ? endsAt.toISOString() : null } };
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

/** `edited_after_lock` de un cierre hecho por el servicio: solo el cronómetro se marca al cerrarse
 * después de `locked_at` (FR-F14a, US-F1-AS11), porque puede empezar un día y cerrarse en otro; el
 * temporizador conserva el comportamiento de la 001/003. Nunca desmarca una edición previa. */
function lockedEditFlag(tanda: TandaRecord, now: Date): boolean {
  if (tanda.edited_after_lock) return true;
  return tanda.kind === 'cronometro' && now.getTime() > new Date(tanda.locked_at).getTime();
}

/** FR-003: finish exige que el tiempo planeado ya se haya cumplido (con 30s de margen); antes
 * de eso, la única salida es interrupt. Idempotente sobre una tanda ya cerrada. FR-F07: un
 * cronómetro se puede terminar a partir de CRONOMETRO_MIN_FINISH_SECONDS (1 min); antes,
 * CRONOMETRO_MUY_CORTO y sigue en curso. */
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
  if (existing.kind === 'cronometro') {
    if (elapsedMs < CRONOMETRO_MIN_FINISH_SECONDS * 1_000) {
      return {
        status: 'error',
        code: 'CRONOMETRO_MUY_CORTO',
        message: 'El cronómetro lleva menos de 1 minuto: déjalo correr o interrúmpelo con una razón.',
      };
    }
  } else {
    const requiredMs = (existing.planned_minutes as number) * 60_000 - 30_000;
    if (elapsedMs < requiredMs) {
      return {
        status: 'error',
        code: 'TANDA_NO_TERMINADA',
        message: 'Todavía no se cumple el tiempo planeado: usa interrupt si necesitas cortarla antes.',
      };
    }
  }

  const updated = await saveTandaToDb({
    ...existing,
    ended_at: now.toISOString(),
    actual_minutes: Math.floor(elapsedMs / 60_000),
    status: 'completada',
    running_lock: null,
    edited_after_lock: lockedEditFlag(existing, now),
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
    edited_after_lock: lockedEditFlag(existing, now),
  });
  return { status: 'success', data: updated };
}

export interface CurrentTandaPayload {
  tanda: TandaRecord | null;
  /** Temporizador: segundos que faltan. Cronómetro (sin fin previsto) y sin tanda: null. */
  seconds_left: number | null;
  /** Cronómetro: segundos transcurridos desde el inicio del servidor. Temporizador y sin tanda: null. */
  elapsed_seconds: number | null;
  server_now: string;
}

/** `{ tanda | null, seconds_left | null, elapsed_seconds | null, server_now }`
 * (contracts/mcp-tools.md). */
export async function currentTanda(now: Date = new Date()): Promise<ExecutionResult<CurrentTandaPayload>> {
  await finalizeElapsed(now);

  const running = await findRunningTanda();
  if (!running) {
    return {
      status: 'success',
      data: { tanda: null, seconds_left: null, elapsed_seconds: null, server_now: now.toISOString() },
    };
  }

  const ends = endsAtMs(running);
  const secondsLeft = ends === null ? null : Math.max(0, Math.round((ends - now.getTime()) / 1000));
  const elapsedSeconds =
    running.kind === 'cronometro'
      ? Math.max(0, Math.floor((now.getTime() - new Date(running.started_at).getTime()) / 1000))
      : null;
  return {
    status: 'success',
    data: { tanda: running, seconds_left: secondsLeft, elapsed_seconds: elapsedSeconds, server_now: now.toISOString() },
  };
}

export interface TandaReadInput {
  from?: string;
  to?: string;
  subject_id?: string;
  /** 004 (US-F2): solo las sesiones ligadas a este objetivo. */
  objective_id?: string;
}

export interface TandaDayResumen {
  date: string;
  completadas: number;
  unidades: number;
  interrumpidas: number;
  minutos: number;
}

/** `{ tandas[], por_dia[] }` (contracts/mcp-tools.md). El filtrado y el agregado por día son
 * aritmética pura en TypeScript (Constitución, Principio III), no SQL.
 *
 * 004 (FR-F14a): una tanda entra si ALGUNO de sus tramos cae en [from, to]; un cronómetro que
 * empezó antes de `from` y cuyo tramo cae dentro entra aunque su `local_date` sea anterior. El
 * agregado de cada día sale de `tallyDay` (la única regla de unidades y de minutos por día): sus
 * `unidades` y `completadas` solo cuentan lo que cumple el mínimo y `minutos` es el foco total del
 * día (completadas + interrumpidas). Los objetivos se leen una vez por llamada (FR-F13): una sesión
 * de un objetivo sin materia suma minutos pero no unidades. `objective_id` filtra por objetivo y,
 * como `subject_id`, el agregado por día se calcula solo con las tandas filtradas. */
export async function readTandas(
  input: TandaReadInput = {},
  now: Date = new Date()
): Promise<ExecutionResult<{ tandas: TandaRecord[]; por_dia: TandaDayResumen[] }>> {
  await finalizeElapsed(now);

  const allRaw = await fetchTandasFromDb();
  const all = (Array.isArray(allRaw) ? allRaw : []) as TandaRecord[];

  const objetivosById = await loadObjectivesById();
  const split = cachedSplitByLocalDay();
  const inRange = (date: string) => !((input.from && date < input.from) || (input.to && date > input.to));

  const filtered: TandaRecord[] = [];
  const daysWithSessions = new Set<string>();
  for (const t of all) {
    if (input.subject_id && t.subject_id !== input.subject_id) continue;
    if (input.objective_id && t.objective_id !== input.objective_id) continue;
    const datesInRange = sessionShares(t, split)
      .map((share) => share.date)
      .filter(inRange);
    if (datesInRange.length === 0) continue;
    filtered.push(t);
    for (const date of datesInRange) daysWithSessions.add(date);
  }

  const por_dia: TandaDayResumen[] = Array.from(daysWithSessions)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const tally = tallyDay(date, filtered, objetivosById, split);
      return {
        date,
        completadas: tally.completadas,
        unidades: tally.unidades,
        interrumpidas: tally.interrumpidas,
        minutos: tally.minutos_foco,
      };
    });

  return { status: 'success', data: { tandas: filtered, por_dia } };
}

export interface TandaUpdateInput {
  id: string;
  subject_id?: string;
  topic_id?: string;
  deliverable_id?: string;
  task_id?: string;
  /** 004 (US-F2-AS10): debe existir, pero puede estar archivado (reclasificar una sesión vieja
   * hacia un objetivo archivado es legítimo). */
  objective_id?: string;
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

  if (input.objective_id) {
    const rejected = await checkObjective(input.objective_id, { rejectArchived: false });
    if (rejected) return rejected;
  }

  const editedAfterLock = existing.edited_after_lock || now.getTime() > new Date(existing.locked_at).getTime();

  const updated = await saveTandaToDb({
    ...existing,
    subject_id: input.subject_id ?? existing.subject_id,
    objective_id: input.objective_id ?? existing.objective_id,
    topic_id: input.topic_id ?? existing.topic_id,
    deliverable_id: input.deliverable_id ?? existing.deliverable_id,
    task_id: input.task_id ?? existing.task_id,
    mode: input.mode ?? existing.mode,
    interrupt_reason: input.interrupt_reason ?? existing.interrupt_reason,
    edited_after_lock: editedAfterLock,
  });
  return { status: 'success', data: updated };
}

export interface TandaLogLateInput {
  subject_id: string;
  /** ISO 8601, hora local del cliente. Única excepción del módulo (ver el comentario de
   * logLateTanda más abajo). */
  started_at: string;
  ended_at: string;
  topic_id?: string;
  task_id?: string;
}

/**
 * US-T2/FR-T10..FR-T15: `log_late` es la ÚNICA entrada del módulo que acepta instantes del
 * cliente (`started_at`/`ended_at`) -- una excepción deliberada y acotada al Principio III de la
 * Constitución ("todo instante registrado DEBE salir del reloj del servidor"), documentada en
 * specs/003-tandas-variables/plan.md. La regla "sin tandas retroactivas" existe para que el
 * reporte no se pueda maquillar; esto no la quita, la acota: registra una sesión que se estudió
 * sin darle iniciar en la app, dentro de cotas estrechas y siempre visible (`late_logged: true`,
 * contada aparte en el reporte semanal). Cada cota tiene su propia prueba porque si alguna se
 * relaja, la excepción deja de estar acotada y la regla entera pierde sentido.
 *
 * Las validaciones corren en este orden exacto (deliberado, reflejado en los tests):
 * 1) finalizeElapsed (misma razón que el resto del módulo: una tanda vencida sin cerrar debe
 *    quedar cerrada antes de comparar solapamientos). 2) fechas parseables. 3) mismo día local
 * que `now`. 4) ended_at <= now y ended_at > started_at. 5) started_at no más de
 * LATE_LOG_MAX_HOURS_BACK horas atrás. 6) duración (redondeada hacia abajo a minutos) entre
 * TANDA_MINUTES_MIN y TANDA_MINUTES_MAX. 7) límite de LATE_LOG_MAX_PER_DAY registros tardíos por
 * día local. 8) solapamiento con cualquier otra sesión, de cualquier día (una en curso ocupa desde
 * su inicio hasta ahora; un cronómetro iniciado ayer cuenta si su tramo llega a hoy).
 */
export async function logLateTanda(
  input: TandaLogLateInput,
  now: Date = new Date()
): Promise<ExecutionResult<TandaRecord>> {
  await finalizeElapsed(now);

  const startedAtDate = new Date(input.started_at);
  const endedAtDate = new Date(input.ended_at);
  if (Number.isNaN(startedAtDate.getTime()) || Number.isNaN(endedAtDate.getTime())) {
    return {
      status: 'error',
      code: 'REGISTRO_TARDIO_INVALIDO',
      message: 'started_at y ended_at deben ser fechas ISO 8601 válidas.',
    };
  }

  const nowLocal = localParts(now);
  const startedLocal = localParts(startedAtDate);
  const endedLocal = localParts(endedAtDate);
  if (startedLocal.dateKey !== nowLocal.dateKey || endedLocal.dateKey !== nowLocal.dateKey) {
    return {
      status: 'error',
      code: 'REGISTRO_TARDIO_INVALIDO',
      message: 'El registro tardío solo acepta sesiones de hoy (día local): el camino normal es darle iniciar.',
    };
  }

  if (endedAtDate.getTime() > now.getTime() || endedAtDate.getTime() <= startedAtDate.getTime()) {
    return {
      status: 'error',
      code: 'REGISTRO_TARDIO_INVALIDO',
      message: 'ended_at debe ser posterior a started_at y no puede caer en el futuro.',
    };
  }

  const maxBackMs = LATE_LOG_MAX_HOURS_BACK * 60 * 60_000;
  if (startedAtDate.getTime() < now.getTime() - maxBackMs) {
    return {
      status: 'error',
      code: 'REGISTRO_TARDIO_INVALIDO',
      message: `started_at no puede ser de hace más de ${LATE_LOG_MAX_HOURS_BACK} horas: el camino normal es darle iniciar.`,
    };
  }

  const durationMinutes = Math.floor((endedAtDate.getTime() - startedAtDate.getTime()) / 60_000);
  if (durationMinutes < LATE_LOG_MIN_MINUTES || durationMinutes > LATE_LOG_MAX_MINUTES) {
    return {
      status: 'error',
      code: 'REGISTRO_TARDIO_INVALIDO',
      message: `La duración debe quedar entre ${LATE_LOG_MIN_MINUTES} y ${LATE_LOG_MAX_MINUTES} minutos.`,
    };
  }

  const allRaw = await fetchTandasFromDb();
  const all = (Array.isArray(allRaw) ? allRaw : []) as TandaRecord[];
  const sameDay = all.filter((t) => t.local_date === nowLocal.dateKey);

  const lateCountToday = sameDay.filter((t) => t.late_logged).length;
  if (lateCountToday >= LATE_LOG_MAX_PER_DAY) {
    return {
      status: 'error',
      code: 'LIMITE_REGISTRO_TARDIO',
      message: `Ya hay ${LATE_LOG_MAX_PER_DAY} registros tardíos hoy: el límite existe para que esto no reemplace el hábito de darle iniciar.`,
    };
  }

  const newStartMs = startedAtDate.getTime();
  const newEndMs = endedAtDate.getTime();
  // 004 (FR-F14a / FR-T11): el solapamiento mira TODAS las tandas, no solo las de hoy. Un cronómetro
  // iniciado ayer que sigue en curso (ocupa hasta ahora) o que cruzó la medianoche ocupa tiempo de
  // hoy aunque su `local_date` sea el día de inicio. El tope de registros tardíos de arriba sigue
  // contando solo las `late_logged` de hoy.
  const overlaps = all.some((t) => {
    const existingStartMs = new Date(t.started_at).getTime();
    const existingEndMs = t.status === 'en_curso' ? now.getTime() : new Date(t.ended_at ?? t.started_at).getTime();
    // Se cruzan si ambos intervalos comparten algún instante; tocarse en el borde no cuenta.
    return newStartMs < existingEndMs && existingStartMs < newEndMs;
  });
  if (overlaps) {
    return {
      status: 'error',
      code: 'REGISTRO_TARDIO_INVALIDO',
      message: 'Ese tramo se solapa con otra sesión: revisa la hora de inicio y fin.',
    };
  }

  const lockedAt = localDateTimeToInstant(addDays(nowLocal.dateKey, 1), DAY_LOCK_TIME);
  const tanda = await saveTandaToDb({
    id: `tanda-${crypto.randomUUID()}`,
    subject_id: input.subject_id,
    topic_id: input.topic_id,
    task_id: input.task_id,
    local_date: nowLocal.dateKey,
    started_at: startedAtDate.toISOString(),
    ended_at: endedAtDate.toISOString(),
    // planned_minutes = actual_minutes a propósito: en un registro tardío no hubo plan, hubo una
    // sesión ya ocurrida medida una sola vez. La columna es NOT NULL (migración 008), así que no
    // puede quedar null; y dejarla en el default (10) afirmaría un plan de 10 minutos que nunca
    // existió. Igualarla a la duración real ya validada (10-60) también satisface el CHECK de la 013.
    planned_minutes: durationMinutes,
    actual_minutes: durationMinutes,
    status: 'completada',
    running_lock: null,
    locked_at: lockedAt.toISOString(),
    late_logged: true,
  });

  return { status: 'success', data: tanda };
}

export interface TandaCorrectInput {
  id: string;
  /** ISO 8601. Segunda excepción acotada del módulo: un instante aportado por el cliente (ver el
   * comentario de correctTanda más abajo). */
  ended_at: string;
  /** 1-140 caracteres, ya recortada por el esquema Zod. */
  reason: string;
}

/**
 * US-F4/FR-F20..FR-F24: `correct` es la SEGUNDA entrada del módulo (después de `log_late`) que
 * acepta un instante del cliente (`ended_at`) -- una excepción deliberada y acotada al Principio III
 * de la Constitución ("todo instante registrado DEBE salir del reloj del servidor"), documentada en
 * specs/004-foco-cronometro/plan.md § Complexity Tracking. El cronómetro no tiene tope por decisión
 * de Andres; sin una forma de corregirlo, un olvido de 8 horas quedaría como 8 horas de estudio para
 * siempre. La corrección es la red que hace aceptable esa decisión, y por eso solo puede REDUCIR
 * datos: nunca alarga una sesión ni crea una (FR-T15 sigue vigente).
 *
 * Cotas (cada una tiene su propia prueba; si alguna se relaja, la excepción deja de estar acotada):
 * - sesión cerrada (completada o interrumpida): `inicio + 60 s <= ended_at < ended_at registrado`;
 *   conserva su estado y recalcula `actual_minutes = floor((ended_at - inicio) / 60 s)`;
 * - cronómetro en curso: `inicio + 60 s <= ended_at <= now`; queda `completada` y libera el
 *   `running_lock` (marca `edited_after_lock` si `now` pasa de `locked_at`, igual que `finish`);
 * - temporizador en curso: CORRECCION_INVALIDA (para cortarlo existe `interrupt`).
 * Fuera de cota: CORRECCION_INVALIDA y no se escribe nada.
 *
 * Deja constancia: `corrected = true`, `corrected_at = now` (hora del servidor, de la ÚLTIMA
 * corrección; el reporte cuenta por ella) y `correction_reason`. `original_ended_at` y
 * `original_minutes` se escriben solo si estaban nulos, así una segunda corrección conserva lo de
 * antes de la primera; en un cronómetro en curso el original es `now` y los minutos hasta `now`.
 * Está disponible siempre, sin mirar `locked_at` (US-F4-AS5), y sobre una sesión cerrada no toca
 * `edited_after_lock`. Es solo MCP: no está en la lista blanca de app/api/execution/route.ts.
 */
export async function correctTanda(
  input: TandaCorrectInput,
  now: Date = new Date()
): Promise<ExecutionResult<TandaRecord>> {
  await finalizeElapsed(now);

  const existing = await findTandaById(input.id);
  if (!existing) {
    return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la sesión ${input.id}.` };
  }

  const running = existing.status === 'en_curso';
  if (running && existing.kind !== 'cronometro') {
    return {
      status: 'error',
      code: 'CORRECCION_INVALIDA',
      message: 'Un temporizador en curso no se corrige: para cortarlo usa interrupt.',
    };
  }

  const newEndMs = new Date(input.ended_at).getTime();
  if (Number.isNaN(newEndMs)) {
    return { status: 'error', code: 'CORRECCION_INVALIDA', message: 'ended_at debe ser una fecha ISO 8601 válida.' };
  }

  const startMs = new Date(existing.started_at).getTime();
  if (newEndMs < startMs + CRONOMETRO_MIN_FINISH_SECONDS * 1_000) {
    return {
      status: 'error',
      code: 'CORRECCION_INVALIDA',
      message: 'El fin corregido debe quedar al menos 1 minuto después del inicio de la sesión.',
    };
  }

  // `registeredEndMs` es el fin vigente que la corrección no puede alargar: el registrado en una
  // sesión cerrada, o `now` en un cronómetro en curso (todavía no tiene fin).
  const registeredEndMs = running ? now.getTime() : existing.ended_at ? new Date(existing.ended_at).getTime() : null;
  if (registeredEndMs === null) {
    return {
      status: 'error',
      code: 'CORRECCION_INVALIDA',
      message: 'La sesión cerrada no tiene un fin registrado que acortar.',
    };
  }
  // Cerrada: estrictamente antes del fin registrado (igual no acorta nada). En curso: hasta `now`
  // inclusive, que es cerrar el cronómetro en este instante dejando constancia.
  if (running ? newEndMs > registeredEndMs : newEndMs >= registeredEndMs) {
    return {
      status: 'error',
      code: 'CORRECCION_INVALIDA',
      message: running
        ? 'El fin corregido no puede quedar en el futuro: una corrección solo acorta.'
        : 'El fin corregido debe ser anterior al fin registrado: una corrección solo acorta.',
    };
  }

  const newEnd = new Date(newEndMs);
  const originalEndedAt = existing.original_ended_at ?? new Date(registeredEndMs).toISOString();
  const originalMinutes =
    existing.original_minutes ??
    existing.actual_minutes ??
    Math.max(0, Math.floor((registeredEndMs - startMs) / 60_000));

  const updated = await saveTandaToDb({
    ...existing,
    ended_at: newEnd.toISOString(),
    actual_minutes: Math.floor((newEndMs - startMs) / 60_000),
    status: running ? 'completada' : existing.status,
    running_lock: null,
    edited_after_lock: running ? lockedEditFlag(existing, now) : existing.edited_after_lock,
    corrected: true,
    corrected_at: now.toISOString(),
    original_ended_at: originalEndedAt,
    original_minutes: originalMinutes,
    correction_reason: input.reason,
  });
  return { status: 'success', data: updated };
}
