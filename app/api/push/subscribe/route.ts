import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { PushSubscriptionSchema, PushUnsubscribeSchema, zodErrorToExecutionResult } from '@/lib/validations/schemas';
import { upsertPushSubscriptionToDb, deletePushSubscriptionFromDb } from '@/lib/db/execution-pg';

// US7 — contracts/web-api.md. Ruta delgada: valida con Zod y delega en el repositorio
// (lib/db/execution-pg.ts), igual que el resto de rutas del módulo. No hay un handler MCP para
// esto (US7 no agrega herramientas MCP: son rutas web), así que no hay un
// lib/execution/handlers.ts que reexportar aquí.
export const dynamic = 'force-dynamic';

/** `id = sha256(endpoint)` (data-model.md): un mismo dispositivo siempre upsertea la misma fila,
 * sin importar cuántas veces active los avisos. */
function subscriptionId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = PushSubscriptionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(zodErrorToExecutionResult(parsed.error), { status: 400 });
    }

    const { endpoint, keys } = parsed.data;
    const saved = await upsertPushSubscriptionToDb({
      id: subscriptionId(endpoint),
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ status: 'success', data: saved });
  } catch (error: any) {
    console.error('Error en POST /api/push/subscribe:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = PushUnsubscribeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(zodErrorToExecutionResult(parsed.error), { status: 400 });
    }

    await deletePushSubscriptionFromDb(subscriptionId(parsed.data.endpoint));
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Error en DELETE /api/push/subscribe:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}
