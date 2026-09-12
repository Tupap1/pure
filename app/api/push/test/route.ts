import { NextResponse } from 'next/server';
import { createWebPusher } from '@/lib/execution/push';

// US7 — contracts/web-api.md: "Envía un aviso de prueba a todas las suscripciones con el mismo
// Pusher que el tick." No es uno de los tres avisos automáticos de FR-032 (fin de tanda, reporte
// congelado, fallo de envío): es una acción diagnóstica que el propio usuario pide con un gesto
// desde Configuración, para confirmar que sus avisos quedaron activos (US7-AS1).
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const pusher = createWebPusher();
    const result = await pusher.notify({
      title: 'Pure',
      body: 'Los avisos están activos.',
      tag: 'prueba',
      url: '/',
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en POST /api/push/test:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}
