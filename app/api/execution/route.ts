import { NextResponse } from 'next/server';
import {
  handleManageTandas,
  type ManageTandasAction,
  handleManageRoutineSlots,
  type ManageRoutineSlotsAction,
  handleManageDailyChecks,
  type ManageDailyChecksAction,
  handleManageWeeklyReport,
  type ManageWeeklyReportAction,
  handleManageTasks,
  type ManageTasksAction,
  handlePlanWeek,
  type ManagePlanWeekAction,
} from '@/lib/execution/handlers';

// Ruta delgada del Módulo de Ejecución (contracts/web-api.md): valida contra una lista blanca y
// delega en los mismos handlers que el servidor MCP (lib/execution/handlers.ts), igual que
// app/api/sync/route.ts hace con lib/db/repository-pg.ts. Sin autenticación propia (la tiene
// todo el sitio vía Cloudflare Access, Constitución VI): la lista blanca es la única barrera
// contra una acción que la web no debería poder disparar por sí sola — por ejemplo,
// manage_program:init, reservado al asistente de IA conectado (FR-040).
//
// Cada historia agrega aquí solo su propia entrada cuando su handler exista: una combinación
// que no está en este mapa se rechaza sin necesidad de que su handler exista todavía.
const ALLOWED_ACTIONS: Record<string, readonly string[]> = {
  manage_tandas: ['start', 'finish', 'interrupt', 'current', 'update'],
  // 'rehearse' se agrega para el asistente del domingo (SundayPlanning.tsx, US8): ensayar un
  // disparador es un gesto del usuario en la web, igual que respond.
  manage_routine_slots: ['respond', 'rehearse'],
  manage_daily_checks: ['set'],
  // Solo set_note: cambiar el destinatario (set_partner) no se hace desde la web (FR-025 /
  // Constitución VI); congelar y enviar los hace el tick, no una acción de la web.
  manage_weekly_report: ['set_note'],
  // US8: las tareas se crean/editan desde el hub de asignatura y desde el asistente del domingo.
  manage_tasks: ['create', 'read', 'update', 'delete', 'today'],
  // US8-US9: el asistente del domingo (preview/set_intentions) y la compuerta de la vista de
  // semana (open_view, FR-037).
  plan_week: ['preview', 'set_intentions', 'open_view'],
};

async function dispatch(tool: string, action: string, data: unknown) {
  switch (tool) {
    case 'manage_tandas':
      return handleManageTandas(action as ManageTandasAction, data);
    case 'manage_routine_slots':
      return handleManageRoutineSlots(action as ManageRoutineSlotsAction, data);
    case 'manage_daily_checks':
      return handleManageDailyChecks(action as ManageDailyChecksAction, data);
    case 'manage_weekly_report':
      return handleManageWeeklyReport(action as ManageWeeklyReportAction, data);
    case 'manage_tasks':
      return handleManageTasks(action as ManageTasksAction, data);
    case 'plan_week':
      return handlePlanWeek(action as ManagePlanWeekAction, data);
    default:
      // No debería alcanzarse: `tool` ya pasó el filtro de ALLOWED_ACTIONS.
      throw new Error(`Herramienta no soportada: ${tool}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const tool = body?.tool;
    const action = body?.action;
    const data = body?.data;

    const allowedActions = typeof tool === 'string' ? ALLOWED_ACTIONS[tool] : undefined;
    if (!allowedActions || typeof action !== 'string' || !allowedActions.includes(action)) {
      return NextResponse.json(
        {
          status: 'error',
          code: 'DATOS_INVALIDOS',
          message: `Combinación no permitida desde la web: ${String(tool)}:${String(action)}`,
        },
        { status: 400 }
      );
    }

    const result = await dispatch(tool, action, data);

    if (result && (result as any).status === 'error') {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en POST /api/execution:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}
