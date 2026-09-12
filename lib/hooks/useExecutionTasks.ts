import { useCallback, useEffect, useState } from 'react';
import { callExecution } from './execution-client';

// Tareas de una materia (US8, manage_tasks). Es Postgres-solo (no pasa por Dexie/usePureData,
// como el resto del Módulo de Ejecución): components/ui/SubjectEvaluation.tsx lo usa para la
// sección "Tareas" del hub de asignatura.

export interface ExecutionTask {
  id: string;
  title: string;
  subject_id: string;
  deliverable_id?: string | null;
  topic_id?: string | null;
  estimated_tandas: number;
  status: 'pendiente' | 'hecha' | 'descartada' | string;
  scheduled_date?: string | null;
  completed_at?: string | null;
  source: string;
}

export interface ExecutionTaskInput {
  title: string;
  estimated_tandas: number;
  deliverable_id?: string;
  topic_id?: string;
  scheduled_date?: string;
}

export function useExecutionTasks(subjectId?: string) {
  const [tasks, setTasks] = useState<ExecutionTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!subjectId) {
      setTasks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const res = await callExecution<ExecutionTask[]>('manage_tasks', 'read', { subject_id: subjectId });
    setTasks(res.status === 'success' && Array.isArray(res.data) ? res.data : []);
    setIsLoading(false);
  }, [subjectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // FR-035: estimated_tandas > 3 vuelve con { status: 'error', code: 'PARTIR_TAREA' } — el
  // llamador decide cómo mostrarlo (SubjectEvaluation.tsx lo lee del resultado).
  const createTask = useCallback(
    async (input: ExecutionTaskInput) => {
      if (!subjectId) return { status: 'error' as const, message: 'Sin materia' };
      const res = await callExecution('manage_tasks', 'create', { ...input, subject_id: subjectId });
      await refresh();
      return res;
    },
    [subjectId, refresh]
  );

  const setTaskStatus = useCallback(
    async (id: string, status: 'pendiente' | 'hecha' | 'descartada') => {
      const res = await callExecution('manage_tasks', 'update', { id, status });
      await refresh();
      return res;
    },
    [refresh]
  );

  const removeTask = useCallback(
    async (id: string) => {
      const res = await callExecution('manage_tasks', 'delete', { id });
      await refresh();
      return res;
    },
    [refresh]
  );

  return { tasks, isLoading, refresh, createTask, setTaskStatus, removeTask };
}
