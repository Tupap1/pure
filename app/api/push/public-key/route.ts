import { NextResponse } from 'next/server';

// US7 — contracts/web-api.md: la clave pública VAPID se entrega en tiempo de ejecución (nunca
// horneada en el build), para no atar el cliente a un valor congelado si algún día cambian las
// llaves. `force-dynamic` evita que Next 14 la sirva como estática (igual razón que
// app/api/execution/today/route.ts).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ key: process.env.VAPID_PUBLIC_KEY || null });
  } catch (error: any) {
    console.error('Error en GET /api/push/public-key:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}
