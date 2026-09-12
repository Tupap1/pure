import { useCallback, useEffect, useState } from 'react';
import { callExecution } from './execution-client';
import type { GradeProjectionFlag } from '@/lib/domain/subject';

// plan_week (US8-US9): el asistente del domingo (preview/set_intentions) y la compuerta de la
// vista de semana (open_view). components/dashboards/SundayPlanning.tsx y
// components/dashboards/WeekView.tsx comparten este hook porque comparten la misma herramienta.

export interface PlanWeekTrigger {
  id: string;
  cue_text: string;
  action_text: string;
  cue_kind: string;
  kind: string;
  subject_id: string | null;
  days_of_week: number[];
  ensayado: boolean;
}

export interface PlanWeekDeliverable {
  id: string;
  title: string;
  subject_id: string;
  subject_name: string;
  due_date: string;
  weight_percentage: number;
  status: string;
  subject_flags: GradeProjectionFlag[];
}

export interface PlanWeekIntention {
  id: string;
  program_week_id: string;
  subject_id: string;
  strength: number;
  reason?: string | null;
}

export interface PlanWeekSuggestion {
  subject_id: string;
  name: string;
  normative_hours: number;
  suggested_tandas: number;
  urgencia: number;
  proyeccion: { neededToPass: number | null; neededForTarget: number | null } | null;
}

export interface PlanWeekPastWeek {
  days_fulfilled: number;
  dias_cumplidos_totales: number;
  horizonte: number;
  habitos: { id: string; label: string; cumplidos: number; total: number }[];
}

export interface PlanWeekPreview {
  program_week_id: string;
  week_number: number;
  starts_on: string;
  semana_pasada: PlanWeekPastWeek | null;
  entregas_14_dias: PlanWeekDeliverable[];
  flags_proyeccion: { kind: string; subject_id: string; detalle: string }[];
  intenciones: PlanWeekIntention[];
  disparadores: PlanWeekTrigger[];
  reparto_sugerido: PlanWeekSuggestion[];
}

export function usePlanWeekPreview(programWeekId?: string) {
  const [preview, setPreview] = useState<PlanWeekPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const res = await callExecution<PlanWeekPreview>('plan_week', 'preview', { program_week_id: programWeekId });
    if (res.status === 'success' && res.data) {
      setPreview(res.data);
      setError(null);
    } else {
      setPreview(null);
      setError(res.message ?? 'No se pudo cargar la planeación.');
    }
    setIsLoading(false);
  }, [programWeekId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setIntentions = useCallback(
    async (items: Array<{ subject_id: string; strength: number; reason?: string }>) => {
      if (!preview) return { status: 'error' as const, message: 'Todavía no hay semana para planear.' };
      const res = await callExecution('plan_week', 'set_intentions', {
        program_week_id: preview.program_week_id,
        items,
      });
      await refresh();
      return res;
    },
    [preview, refresh]
  );

  const rehearseTrigger = useCallback(
    async (routineSlotId: string) => {
      if (!preview) return { status: 'error' as const, message: 'Todavía no hay semana para planear.' };
      const res = await callExecution('manage_routine_slots', 'rehearse', {
        routine_slot_id: routineSlotId,
        program_week_id: preview.program_week_id,
      });
      await refresh();
      return res;
    },
    [preview, refresh]
  );

  return { preview, isLoading, error, refresh, setIntentions, rehearseTrigger };
}

export interface WeekGridTrigger {
  id: string;
  cue_text: string;
  action_text: string;
  dias: Record<string, 'hecho' | 'no' | 'sin_respuesta' | null>;
}

export interface WeekGridTandaDay {
  date: string;
  completadas: number;
  interrumpidas: number;
  minutos: number;
}

export interface WeekViewData {
  allowed: boolean;
  needs_reason: boolean;
  opens_this_week: number;
  disparadores: WeekGridTrigger[];
  tandas_por_dia: WeekGridTandaDay[];
}

/** FR-037: abre la vista de semana pasando por la compuerta. `open()` sin razón puede volver
 * `{ status: 'error', code: 'RAZON_REQUERIDA' }` desde la 3.ª apertura de la semana; el llamador
 * (WeekView.tsx) entonces pide la razón y vuelve a llamar `open(reason)`. */
export function useWeekView() {
  const [data, setData] = useState<WeekViewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsReason, setNeedsReason] = useState(false);

  const open = useCallback(async (reason?: string) => {
    setIsLoading(true);
    const res = await callExecution<WeekViewData>('plan_week', 'open_view', reason ? { reason } : {});
    setIsLoading(false);
    if (res.status === 'success' && res.data) {
      setData(res.data);
      setNeedsReason(false);
      return res;
    }
    if (res.code === 'RAZON_REQUERIDA') {
      setNeedsReason(true);
    }
    return res;
  }, []);

  useEffect(() => {
    open();
    // Solo al montar: cada apertura de la vista es un evento deliberado (FR-037), no algo que
    // se repita en un intervalo como get_today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, isLoading, needsReason, open };
}
