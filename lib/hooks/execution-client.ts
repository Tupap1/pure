// Llamada compartida a POST /api/execution (contracts/web-api.md), usada por los hooks del
// Módulo de Ejecución que necesitan más de una herramienta de la lista blanca (useExecutionTasks,
// usePlanWeek, useGradeAlerts). useToday.ts y useWeeklyReport.ts tienen su propia copia de este
// mismo fetch porque solo llaman una herramienta cada uno; a partir de la tercera repetición
// (US8-US9) vale la pena compartirla en vez de volver a copiarla.

export interface ExecutionCallResult<T = unknown> {
  status: 'success' | 'error';
  message?: string;
  code?: string;
  data?: T;
}

export async function callExecution<T = unknown>(
  tool: string,
  action: string,
  data?: unknown
): Promise<ExecutionCallResult<T>> {
  try {
    const res = await fetch('/api/execution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, action, data: data ?? {} }),
    });
    return await res.json();
  } catch {
    return { status: 'error', message: 'No hay conexión con Pure' };
  }
}
