// Handlers únicos del Módulo de Ejecución (Constitución, Principio I: una sola vía de datos).
// El servidor MCP los re-exporta tal cual desde mcp-server/tools-handler.ts y las rutas
// app/api/execution/* los llaman directamente: ninguno de los dos reimplementa las reglas.
//
// Contrato de respuesta (contracts/mcp-tools.md): { status: 'success', message?, data? } o
// { status: 'error', code, message }. La validación de forma vive en los esquemas Zod de
// lib/validations/schemas.ts; este archivo solo despacha por `action` y traduce ZodError con
// `zodErrorToExecutionResult`.

import {
  ExecutionProgramInitSchema,
  ExecutionProgramUpdateWeekSchema,
  HabitUpsertSchema,
  HabitRetireSchema,
  zodErrorToExecutionResult,
  type ExecutionResult,
} from '../validations/schemas';
import { initProgram, readProgram, updateProgramWeek, upsertHabit, retireHabit } from './program';

export type ManageProgramAction = 'init' | 'read' | 'update_week' | 'upsert_habit' | 'retire_habit';

/**
 * `manage_program`: crear/leer el programa de semanas y dar de alta/retirar hábitos. Es
 * fundacional porque el resto de historias (US1-US9) consultan la semana en curso y los
 * hábitos activos que este handler expone vía `read`.
 */
export async function handleManageProgram(
  action: ManageProgramAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'init': {
        const parsed = ExecutionProgramInitSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await initProgram(parsed.data);
      }
      case 'read': {
        return await readProgram(now);
      }
      case 'update_week': {
        const parsed = ExecutionProgramUpdateWeekSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await updateProgramWeek(parsed.data, now);
      }
      case 'upsert_habit': {
        const parsed = HabitUpsertSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await upsertHabit(parsed.data);
      }
      case 'retire_habit': {
        const parsed = HabitRetireSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await retireHabit(parsed.data);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_program: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_program',
    };
  }
}
