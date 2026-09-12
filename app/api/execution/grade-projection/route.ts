import { NextResponse } from 'next/server';
import { handleGetGradeProjection } from '@/lib/execution/handlers';

// GET de solo lectura (mismo patrón que app/api/execution/today/route.ts y
// app/api/execution/report/route.ts): get_grade_projection no tiene `action`, así que no pasa
// por la lista blanca de app/api/execution/route.ts. US9 (FR-028): components/dashboards/
// DeliverablesDashboard.tsx (Agenda) consume `alertas` de aquí para las materias abandonadas o
// sin evaluaciones (ciegas); `materias` va completo por si en el futuro la Agenda necesita más
// que solo las alertas, sin tener que cambiar esta ruta.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await handleGetGradeProjection();
    if (result && (result as any).status === 'error') {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en GET /api/execution/grade-projection:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}
