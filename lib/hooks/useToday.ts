import { useCallback, useEffect, useRef, useState } from 'react';
import { clockOffset, secondsLeft, formatCountdown, resolveConnectionState } from '@/lib/execution/today-view';
import type { TodayPayload } from '@/lib/execution/today';

/**
 * Hook de datos de Hoy (US1). Trae get_today, mantiene el offset de reloj capturado en cada
 * respuesta (US1-AS8: el conteo sigue siendo correcto aunque el reloj del teléfono esté
 * desfasado) y expone las acciones de manage_tandas que la web tiene permitido disparar
 * (contracts/web-api.md). Toda la lógica de presentación pura vive en
 * lib/execution/today-view.ts; este hook solo la conecta con fetch/estado de React.
 */
export function useToday() {
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [connection, setConnection] = useState<'online' | 'offline'>('offline');
  const [isLoading, setIsLoading] = useState(true);
  const [, forceTick] = useState(0);
  const offsetRef = useRef(0);

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch('/api/execution/today');
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message || 'get_today falló');
      offsetRef.current = clockOffset(json.data.server_now, Date.now());
      setToday(json.data);
      setConnection(resolveConnectionState(json.data));
    } catch {
      setConnection('offline');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToday();
    const interval = setInterval(fetchToday, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchToday();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchToday]);

  // Cronómetro visual: re-renderiza una vez por segundo mientras haya una tanda en curso, para
  // que mm:ss avance sin esperar al siguiente fetch (cada 30s).
  useEffect(() => {
    if (!today?.running_tanda) return;
    const tick = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, [today?.running_tanda?.id]);

  const callAction = useCallback(
    async (tool: string, action: string, data?: unknown) => {
      const res = await fetch('/api/execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, action, data: data ?? {} }),
      });
      const json = await res.json();
      await fetchToday();
      return json;
    },
    [fetchToday]
  );

  const callTandas = useCallback(
    (action: 'start' | 'finish' | 'interrupt' | 'update', data?: unknown) => callAction('manage_tandas', action, data),
    [callAction]
  );

  const start = useCallback(
    (data?: { subject_id?: string; routine_slot_id?: string }) => callTandas('start', data),
    [callTandas]
  );
  const finish = useCallback((id: string) => callTandas('finish', { id }), [callTandas]);
  const interrupt = useCallback(
    (id: string, interrupt_reason: string) => callTandas('interrupt', { id, interrupt_reason }),
    [callTandas]
  );
  const tagSubject = useCallback((id: string, subject_id: string) => callTandas('update', { id, subject_id }), [callTandas]);

  // US2: responder un disparador (solo "no" desde la web — el "hecho" de un disparador de
  // estudio pasa siempre por start() arriba, que liga la tanda y hereda la materia).
  const respondTrigger = useCallback(
    (routine_slot_id: string, outcome: 'hecho' | 'no') =>
      callAction('manage_routine_slots', 'respond', { routine_slot_id, outcome }),
    [callAction]
  );

  const running = today?.running_tanda ?? null;
  const secLeft = running ? secondsLeft(running.ends_at, offsetRef.current, Date.now()) : null;

  return {
    today,
    isLoading,
    isOffline: connection === 'offline',
    secondsLeft: secLeft,
    countdown: secLeft != null ? formatCountdown(secLeft) : null,
    refresh: fetchToday,
    start,
    finish,
    interrupt,
    tagSubject,
    respondTrigger,
  };
}
