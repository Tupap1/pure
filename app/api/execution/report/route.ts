import { NextResponse } from 'next/server';
import { handleManageWeeklyReport } from '@/lib/execution/handlers';
import { formatRiskLines } from '@/lib/execution/report';
import { fetchAccountabilityPartnersFromDb } from '@/lib/db/execution-pg';

// US6, FR-025: esta ruta NUNCA devuelve el correo del destinatario, solo su nombre
// (`partner_name`). contracts/web-api.md documenta exactamente esta forma; no hay autenticación
// propia (la tiene todo el sitio vía Cloudflare Access, Constitución VI).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await handleManageWeeklyReport('read');
    const reportsData = result && (result as any).status === 'success' ? (result as any).data : null;
    const list = Array.isArray(reportsData) ? reportsData : reportsData ? [reportsData] : [];

    if (list.length === 0) {
      // Normal entre semana, antes de cualquier congelamiento: no es un error, no hay nada que mostrar.
      return NextResponse.json({ status: 'success', data: null });
    }

    // El reporte de la semana en curso si ya se congeló, o el más reciente si no.
    const latest = [...list].sort(
      (a, b) => new Date(b.frozen_at).getTime() - new Date(a.frozen_at).getTime()
    )[0];

    let partnerName: string | null = null;
    if (latest.partner_id) {
      const partnerRaw = await fetchAccountabilityPartnersFromDb(latest.partner_id);
      const partner = Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw;
      partnerName = partner?.name ?? null;
    }

    const payload = latest.payload ?? {};
    const emptyRisk = { perdidas: [], necesita_refuerzo: [], abandonadas: [], ciegas_count: 0 };

    return NextResponse.json({
      status: 'success',
      data: {
        program_week_id: latest.program_week_id,
        week_number: payload.week_number ?? null,
        status: latest.status,
        verdict: latest.verdict,
        frozen_at: latest.frozen_at,
        note_deadline: latest.note_deadline,
        sent_at: latest.sent_at,
        user_note: latest.user_note,
        partner_name: partnerName, // NUNCA el correo del destinatario (FR-025)
        payload_resumen: {
          days_fulfilled: payload.days_fulfilled ?? null,
          habits: (payload.habits ?? []).map((h: { label: string; cumplidos: number; total: number }) => ({
            label: h.label,
            cumplidos: h.cumplidos,
            total: h.total,
          })),
          en_riesgo: formatRiskLines(payload.en_riesgo ?? emptyRisk),
          late_edits: payload.late_edits ?? 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Error en GET /api/execution/report:', error);
    return NextResponse.json({ status: 'error', message: 'Error interno del servidor' }, { status: 500 });
  }
}
