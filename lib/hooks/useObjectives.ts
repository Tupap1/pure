import { useCallback, useEffect, useRef, useState } from 'react';

// Objetivos de estudio (US-F2, manage_objectives). Es Postgres-solo, como el resto del Módulo de
// Ejecución: no pasa por Dexie. La web tiene permitidas las cuatro acciones
// (contracts/web-api.md): read, create, update y archive. Hoy lo usa para el selector de objetivo
// (US-F2-AS9); Command Center lo usará para gestionarlos (US-F2-AS8).

/** Un objetivo tal como lo devuelve `manage_objectives read` (contracts/mcp-tools.md). */
export interface Objective {
  id: string;
  name: string;
  subject_id: string | null;
  weekly_target_minutes: number | null;
  archived: boolean;
  archived_at?: string | null;
  created_at?: string;
}

/** Datos de `create` (nombre 1..60; materia y meta semanal opcionales, 1..10080 minutos). */
export interface ObjectiveCreateInput {
  name: string;
  subject_id?: string;
  weekly_target_minutes?: number;
}

/** Datos de `update`: `null` en `subject_id` o `weekly_target_minutes` los quita. */
export interface ObjectiveUpdateInput {
  id: string;
  name?: string;
  subject_id?: string | null;
  weekly_target_minutes?: number | null;
}

/** Forma de respuesta de `/api/execution`; los errores llevan `code` (OBJETIVO_DUPLICADO, SIN_CONEXION, …). */
export interface ObjectivesCallResult<T = unknown> {
  status: 'success' | 'error';
  code?: string;
  message?: string;
  data?: T;
}

async function callObjectives<T = unknown>(action: string, data?: unknown): Promise<ObjectivesCallResult<T>> {
  try {
    const res = await fetch('/api/execution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'manage_objectives', action, data: data ?? {} }),
    });
    return await res.json();
  } catch {
    // Error de red: igual que useToday.callAction, se devuelve SIN_CONEXION en vez de rechazar.
    return { status: 'error', code: 'SIN_CONEXION', message: 'Sin conexión con Pure.' };
  }
}

/**
 * Hook de objetivos. Lee la lista al montar (y al volver a la pestaña, para que un objetivo creado
 * o archivado desde otro lado aparezca sin recargar) y expone `create`, `update` y `archive`, que
 * devuelven la respuesta del servidor y vuelven a leer la lista. Si la lectura falla (sin conexión)
 * la lista queda como estaba y `isOffline` se activa: quien lo use debe seguir funcionando sin ella.
 */
export function useObjectives(options: { includeArchived?: boolean } = {}) {
  const includeArchived = options.includeArchived ?? false;
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const res = await callObjectives<{ objetivos?: Objective[] }>('read', { include_archived: includeArchived });
    if (!mountedRef.current) return res;
    if (res.status === 'success' && Array.isArray(res.data?.objetivos)) {
      setObjectives(res.data.objetivos);
      setIsOffline(false);
    } else {
      setIsOffline(true);
    }
    setIsLoading(false);
    return res;
  }, [includeArchived]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const create = useCallback(
    async (input: ObjectiveCreateInput) => {
      const res = await callObjectives<Objective>('create', input);
      await refresh();
      return res;
    },
    [refresh]
  );

  const update = useCallback(
    async (input: ObjectiveUpdateInput) => {
      const res = await callObjectives<Objective>('update', input);
      await refresh();
      return res;
    },
    [refresh]
  );

  const archive = useCallback(
    async (id: string) => {
      const res = await callObjectives<Objective>('archive', { id });
      await refresh();
      return res;
    },
    [refresh]
  );

  return { objectives, isLoading, isOffline, refresh, create, update, archive };
}
