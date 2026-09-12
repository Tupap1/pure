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
  TandaStartSchema,
  TandaFinishSchema,
  TandaInterruptSchema,
  TandaReadSchema,
  TandaUpdateSchema,
  RoutineSlotSchema,
  RoutineSlotReadSchema,
  RoutineSlotDeleteSchema,
  RoutineSlotRespondSchema,
  RoutineSlotRehearseSchema,
  zodErrorToExecutionResult,
  type ExecutionResult,
} from '../validations/schemas';
import { initProgram, readProgram, updateProgramWeek, upsertHabit, retireHabit } from './program';
import { startTanda, finishTanda, interruptTanda, currentTanda, readTandas, updateTanda } from './tandas';
import { getToday } from './today';
import {
  upsertRoutineSlot,
  readRoutineSlots,
  deleteRoutineSlot,
  respondToRoutineSlot,
  rehearseRoutineSlot,
} from './routine';

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

export type ManageTandasAction = 'start' | 'finish' | 'interrupt' | 'current' | 'read' | 'update';

/**
 * `manage_tandas` (US1): la tanda de 10 minutos en un toque. `start`/`finish`/`interrupt`/
 * `update` validan su forma con los esquemas Zod estrictos de schemas.ts (que ya rechazan
 * `started_at`/`ended_at` del cliente por ser claves no reconocidas) y delegan las reglas de
 * negocio en lib/execution/tandas.ts. `current` no tiene esquema propio: no recibe `data`.
 */
export async function handleManageTandas(
  action: ManageTandasAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'start': {
        const parsed = TandaStartSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await startTanda(parsed.data, now);
      }
      case 'finish': {
        const parsed = TandaFinishSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await finishTanda(parsed.data.id, now);
      }
      case 'interrupt': {
        const parsed = TandaInterruptSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await interruptTanda(parsed.data, now);
      }
      case 'current': {
        return await currentTanda(now);
      }
      case 'read': {
        const parsed = TandaReadSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await readTandas(parsed.data, now);
      }
      case 'update': {
        const parsed = TandaUpdateSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await updateTanda(parsed.data, now);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_tandas: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_tandas',
    };
  }
}

/**
 * `get_today` (US1-US3): estado de la pantalla Hoy. Es de solo lectura; `data?.at` (ISO) es un
 * escape hatch para pruebas o consulta puntual (contracts/mcp-tools.md), nunca usado por la web.
 */
export async function handleGetToday(data?: unknown, now: Date = new Date()): Promise<ExecutionResult> {
  try {
    const at = (data as { at?: string } | undefined)?.at;
    const effectiveNow = at ? new Date(at) : now;
    return await getToday(effectiveNow);
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en get_today',
    };
  }
}

export type ManageRoutineSlotsAction = 'create' | 'update' | 'read' | 'delete' | 'respond' | 'rehearse';

/**
 * `manage_routine_slots` (US2): el disparador si-entonces. `create`/`update` usan el mismo
 * esquema estricto (una clave de duración, tandas o método de estudio cae en SOBRE_ESPECIFICACION,
 * no en el DATOS_INVALIDOS genérico: FR-009). `respond` y `rehearse` delegan sus reglas de
 * idempotencia en lib/execution/routine.ts.
 */
export async function handleManageRoutineSlots(
  action: ManageRoutineSlotsAction,
  data?: unknown,
  now: Date = new Date()
): Promise<ExecutionResult> {
  try {
    switch (action) {
      case 'create':
      case 'update': {
        const parsed = RoutineSlotSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error, { unrecognizedKeysCode: 'SOBRE_ESPECIFICACION' });
        return await upsertRoutineSlot(parsed.data);
      }
      case 'read': {
        const parsed = RoutineSlotReadSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await readRoutineSlots(parsed.data.id);
      }
      case 'delete': {
        const parsed = RoutineSlotDeleteSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await deleteRoutineSlot(parsed.data.id);
      }
      case 'respond': {
        const parsed = RoutineSlotRespondSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await respondToRoutineSlot(parsed.data, now);
      }
      case 'rehearse': {
        const parsed = RoutineSlotRehearseSchema.safeParse(data ?? {});
        if (!parsed.success) return zodErrorToExecutionResult(parsed.error);
        return await rehearseRoutineSlot(parsed.data, now);
      }
      default:
        return {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Acción no válida para manage_routine_slots: ${String(action)}`,
        };
    }
  } catch (error: any) {
    return {
      status: 'error',
      code: 'DATOS_INVALIDOS',
      message: error?.message || 'Error inesperado en manage_routine_slots',
    };
  }
}
