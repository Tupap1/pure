// Servicio de objetivos (US-F2). Un objetivo es una etiqueta propia (LeetCode, Inglés, Proyecto
// personal) con materia y meta semanal opcionales a la que se ligan las sesiones de foco. Handler
// único consumido por manage_objectives (MCP) y, a través suyo, por app/api/execution/route.ts
// (Principio I). No se borran: se archivan, y sus sesiones históricas siguen sumando.
//
// Unicidad del nombre entre activos (research R3): `active_name_key = lower(trim(name))` mientras
// está activo y NULL al archivarlo, con UNIQUE sobre la columna. El servicio comprueba antes en
// TypeScript y responde OBJETIVO_DUPLICADO; la restricción de la base es la red de seguridad contra
// dos altas simultáneas (web y MCP a la vez). pg-mem reporta mal el nombre de la restricción
// (`objetivos_pkey`), así que cualquier 23505 al insertar o actualizar un objetivo se traduce a
// OBJETIVO_DUPLICADO: el id es un UUID del servidor y no puede ser la causa.
//
// Invariante: `archived = FALSE ⇔ active_name_key IS NOT NULL`. Solo este archivo escribe
// objetivos y lo mantiene en cada escritura.

import crypto from 'crypto';
import {
  fetchObjectivesFromDb,
  insertObjectiveToDb,
  updateObjectiveInDb,
  ObjectiveRecord,
} from '../db/execution-pg';
import { fetchSubjectsFromDb } from '../db/repository-pg';
import type { ExecutionResult, ExecutionErrorResult } from '../validations/schemas';

export interface ObjectiveCreateInput {
  name: string;
  subject_id?: string;
  weekly_target_minutes?: number;
}

export interface ObjectiveUpdateInput {
  id: string;
  name?: string;
  /** `null` quita la materia; ausente la conserva. */
  subject_id?: string | null;
  /** `null` quita la meta; ausente la conserva. */
  weekly_target_minutes?: number | null;
}

export interface ObjectiveArchiveInput {
  id: string;
}

export interface ObjectiveReadInput {
  include_archived?: boolean;
}

/** Clave de unicidad de un nombre: sin espacios en los extremos y sin distinguir mayúsculas. */
function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

function duplicateError(name: string): ExecutionErrorResult {
  return {
    status: 'error',
    code: 'OBJETIVO_DUPLICADO',
    message: `Ya hay un objetivo activo llamado "${name}" (el nombre no distingue mayúsculas ni espacios en los extremos).`,
  };
}

function notFoundError(id: string): ExecutionErrorResult {
  return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe el objetivo ${id}.` };
}

function missingSubjectError(subjectId: string): ExecutionErrorResult {
  return { status: 'error', code: 'NO_ENCONTRADO', message: `No existe la materia ${subjectId}.` };
}

async function findObjective(id: string): Promise<ObjectiveRecord | null> {
  const raw = await fetchObjectivesFromDb(id);
  return ((Array.isArray(raw) ? raw[0] : raw) ?? null) as ObjectiveRecord | null;
}

async function listObjectives(): Promise<ObjectiveRecord[]> {
  const raw = await fetchObjectivesFromDb();
  return (Array.isArray(raw) ? raw : []) as ObjectiveRecord[];
}

/** true si algún OTRO objetivo activo (`exceptId`, el propio en un update) ya usa esa clave. */
function isNameTaken(objectives: ObjectiveRecord[], key: string, exceptId?: string): boolean {
  return objectives.some((o) => !o.archived && o.active_name_key === key && o.id !== exceptId);
}

async function subjectExists(subjectId: string): Promise<boolean> {
  return (await fetchSubjectsFromDb(subjectId)) !== null;
}

/** FR-F10/FR-F11: crea un objetivo activo. DUPLICADO (nombre repetido entre activos), NO_ENCONTRADO
 * (materia inexistente); la forma (1-60 caracteres, meta entera 1..10080) la valida el esquema. */
export async function createObjective(input: ObjectiveCreateInput): Promise<ExecutionResult<ObjectiveRecord>> {
  const name = input.name.trim();
  const key = nameKey(name);

  if (isNameTaken(await listObjectives(), key)) return duplicateError(name);
  if (input.subject_id && !(await subjectExists(input.subject_id))) {
    return missingSubjectError(input.subject_id);
  }

  try {
    const created = await insertObjectiveToDb({
      id: `objetivo-${crypto.randomUUID()}`,
      name,
      active_name_key: key,
      subject_id: input.subject_id ?? null,
      weekly_target_minutes: input.weekly_target_minutes ?? null,
      archived: false,
      archived_at: null,
    });
    return { status: 'success', data: created };
  } catch (error) {
    if (isUniqueViolation(error)) return duplicateError(name);
    throw error;
  }
}

/** `{ objetivos[] }` ordenados por nombre (sin distinguir mayúsculas ni tildes). Los archivados
 * solo salen con `include_archived`. */
export async function readObjectives(
  input: ObjectiveReadInput = {}
): Promise<ExecutionResult<{ objetivos: ObjectiveRecord[] }>> {
  const objetivos = (await listObjectives())
    .filter((o) => input.include_archived || !o.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
  return { status: 'success', data: { objetivos } };
}

/** FR-F10: actualiza nombre, materia y meta de un objetivo ACTIVO, con las mismas validaciones que
 * `create`. Lo no enviado no se toca; `null` quita la materia o la meta. Un archivado no se puede
 * editar (OBJETIVO_ARCHIVADO). */
export async function updateObjective(input: ObjectiveUpdateInput): Promise<ExecutionResult<ObjectiveRecord>> {
  const existing = await findObjective(input.id);
  if (!existing) return notFoundError(input.id);
  if (existing.archived) {
    return {
      status: 'error',
      code: 'OBJETIVO_ARCHIVADO',
      message: `El objetivo ${existing.name} está archivado: no se puede editar.`,
    };
  }

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const key = nameKey(name);
  if (input.name !== undefined && isNameTaken(await listObjectives(), key, existing.id)) {
    return duplicateError(name);
  }

  const subjectId = input.subject_id !== undefined ? input.subject_id : (existing.subject_id ?? null);
  if (input.subject_id && !(await subjectExists(input.subject_id))) {
    return missingSubjectError(input.subject_id);
  }
  const weeklyTarget =
    input.weekly_target_minutes !== undefined ? input.weekly_target_minutes : (existing.weekly_target_minutes ?? null);

  try {
    const updated = await updateObjectiveInDb({
      id: existing.id,
      name,
      active_name_key: key,
      subject_id: subjectId,
      weekly_target_minutes: weeklyTarget,
      archived: false,
      archived_at: null,
    });
    return { status: 'success', data: updated };
  } catch (error) {
    if (isUniqueViolation(error)) return duplicateError(name);
    throw error;
  }
}

/** FR-F10: archiva un objetivo (deja de ofrecerse para empezar sesiones; sus sesiones siguen
 * sumando) con la hora del servidor, y libera su nombre (`active_name_key = NULL`). Idempotente:
 * archivar uno ya archivado devuelve el objetivo sin mover `archived_at`. */
export async function archiveObjective(
  input: ObjectiveArchiveInput,
  now: Date = new Date()
): Promise<ExecutionResult<ObjectiveRecord>> {
  const existing = await findObjective(input.id);
  if (!existing) return notFoundError(input.id);
  if (existing.archived) return { status: 'success', data: existing };

  const archived = await updateObjectiveInDb({
    ...existing,
    active_name_key: null,
    archived: true,
    archived_at: now.toISOString(),
  });
  return { status: 'success', data: archived };
}
