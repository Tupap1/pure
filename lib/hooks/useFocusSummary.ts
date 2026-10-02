import { useCallback, useEffect, useRef, useState } from 'react';
import type { FocusByObjectiveRow, FocusSummary } from '@/lib/execution/focus';

// Resumen de foco (004, US-F3, FR-F15/FR-F19): lee `GET /api/execution/focus`. Es Postgres-solo,
// como el resto del Módulo de Ejecución (no pasa por Dexie): la semana de lunes a domingo y el
// reparto por medianoche dependen del reloj y de la zona horaria del servidor. Los tipos son los
// del servidor (`import type`: se borran al compilar y no arrastran `pg` al navegador).

export type { FocusByObjectiveRow, FocusSummary };

/** El filtro del resumen: por objetivo o por materia, nunca los dos a la vez (DATOS_INVALIDOS). */
export type FocusSummaryFilter = { objective_id: string } | { subject_id: string } | null;

function buildUrl(weeks: number, filter: FocusSummaryFilter): string {
  const params = new URLSearchParams({ weeks: String(weeks) });
  if (filter && 'objective_id' in filter) params.set('objective_id', filter.objective_id);
  if (filter && 'subject_id' in filter) params.set('subject_id', filter.subject_id);
  return `/api/execution/focus?${params.toString()}`;
}

/**
 * Hook del resumen de foco. Lee al montar, al cambiar `weeks` o el filtro y al volver a la
 * pestaña (para que una sesión terminada en otro lado aparezca sin recargar). Un error de red o
 * una respuesta que no sea `success` deja `isOffline` en true y conserva el último resumen leído:
 * nunca lanza una excepción hacia el componente. Una respuesta tardía de una consulta anterior
 * (el filtro cambió mientras volaba) se descarta.
 */
export function useFocusSummary(options: { weeks?: number; filter?: FocusSummaryFilter } = {}) {
  const weeks = options.weeks ?? 52;
  // El filtro llega como objeto nuevo en cada render; la consulta depende solo de sus valores.
  const filter = options.filter ?? null;
  const objectiveId = filter && 'objective_id' in filter ? filter.objective_id : null;
  const subjectId = filter && 'subject_id' in filter ? filter.subject_id : null;

  const [summary, setSummary] = useState<FocusSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    const query: FocusSummaryFilter = objectiveId ? { objective_id: objectiveId } : subjectId ? { subject_id: subjectId } : null;
    setIsLoading(true);
    try {
      const res = await fetch(buildUrl(weeks, query));
      const json = await res.json();
      if (!mountedRef.current || requestId !== requestRef.current) return;
      if (json?.status === 'success' && json.data && Array.isArray(json.data.dias)) {
        setSummary(json.data as FocusSummary);
        setIsOffline(false);
      } else {
        setIsOffline(true);
      }
    } catch {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setIsOffline(true);
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsLoading(false);
    }
  }, [weeks, objectiveId, subjectId]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { summary, isLoading, isOffline, refresh };
}
