import { NextResponse } from 'next/server';
import { handleGetToday } from '@/lib/execution/handlers';

// En Next 14 un GET sin `Request` puede quedar cacheado como estático; Hoy cambia cada segundo
// (la tanda en curso, los segundos restantes), así que esta ruta necesita forzarse a dinámica.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await handleGetToday();
    if (result && (result as any).status === 'error') {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en GET /api/execution/today:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}
