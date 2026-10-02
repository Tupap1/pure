import { NextResponse } from 'next/server';
import { handleGetFocusSummary } from '@/lib/execution/handlers';

// El resumen de foco depende del reloj del servidor y cambia con cada sesión que se cierra: sin
// esto Next 14 podría dejar este GET cacheado como estático.
export const dynamic = 'force-dynamic';

// Misma vía que la herramienta MCP `get_focus_summary` (FR-F19, US-F3-AS9): ambas delegan en
// `handleGetFocusSummary`. La web NO acepta instantes: `at` de la query se ignora y manda el reloj
// del servidor.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const data: Record<string, unknown> = {};

    // `weeks` llega como texto: se convierte a número y el esquema decide si es válido (un valor
    // no numérico o no entero da DATOS_INVALIDOS, no un 500).
    const weeks = params.get('weeks');
    if (weeks !== null && weeks !== '') data.weeks = Number(weeks);
    const objectiveId = params.get('objective_id');
    if (objectiveId) data.objective_id = objectiveId;
    const subjectId = params.get('subject_id');
    if (subjectId) data.subject_id = subjectId;

    const result = await handleGetFocusSummary(data);
    if (result && (result as any).status === 'error') {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en GET /api/execution/focus:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}
