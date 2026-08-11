/**
 * Reconciliación del caché local (Dexie) contra el estado remoto (Postgres).
 *
 * `bulkPut` solo hace upsert por `id`: nunca borra. Si una entidad se re-ingesta en el
 * servidor con un `id` nuevo, la fila vieja se queda para siempre en IndexedDB y la UI
 * termina mostrando la misma materia varias veces.
 *
 * Aquí no se borra "todo lo que no está en el servidor" (eso destruiría registros
 * creados localmente y aún no sincronizados). Se borra únicamente lo que quedó
 * *ensombrecido*: una fila local cuya identidad lógica ya existe en el remoto bajo otro
 * `id`, y los hijos huérfanos que colgaban de ella.
 */

import type { WithId } from '../domain/entity-identity';

type EntityId = string | number;

const asKey = (id: unknown): string => String(id ?? '');

/**
 * Ids locales que representan la misma entidad lógica que una fila remota, pero con un
 * `id` distinto (es decir, versiones obsoletas de algo que el servidor ya tiene).
 */
export function findShadowedIds<T extends WithId>(
  local: T[],
  remote: T[],
  identityOf: (row: T) => string
): EntityId[] {
  const remoteIds = new Set(remote.map((row) => asKey(row.id)));
  const remoteIdentities = new Set(remote.map(identityOf));

  return local
    .filter(
      (row) =>
        row.id !== undefined &&
        !remoteIds.has(asKey(row.id)) &&
        remoteIdentities.has(identityOf(row))
    )
    .map((row) => row.id as EntityId);
}

/**
 * Ids locales que apuntan (por clave foránea) a un padre que acaba de eliminarse y que
 * el remoto tampoco conoce: hijos huérfanos de una versión obsoleta de la entidad padre.
 */
export function findOrphanIds<T extends WithId>(
  local: T[],
  remote: T[],
  removedParentIds: Set<string>,
  parentIdOf: (row: T) => unknown
): EntityId[] {
  if (removedParentIds.size === 0) return [];
  const remoteIds = new Set(remote.map((row) => asKey(row.id)));

  return local
    .filter(
      (row) =>
        row.id !== undefined &&
        !remoteIds.has(asKey(row.id)) &&
        removedParentIds.has(asKey(parentIdOf(row)))
    )
    .map((row) => row.id as EntityId);
}
