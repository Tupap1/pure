import { useCallback, useEffect, useState } from 'react';

// Hook del reporte semanal congelado (US6). Trae GET /api/execution/report (nunca el correo del
// destinatario: FR-025) y expone `setNote`, la única escritura que la web tiene permitido
// disparar sobre el reporte (contracts/web-api.md) — congelar y enviar los hace el tick, no un
// gesto del usuario.

export interface WeeklyReportHabitFraction {
  label: string;
  cumplidos: number;
  total: number;
}

export interface WeeklyReportSummary {
  program_week_id: string;
  week_number: number | null;
  status: 'congelado' | 'enviando' | 'enviado' | 'fallido' | string;
  verdict: 'cumplida' | 'fallida' | 'parcial' | string;
  frozen_at: string;
  note_deadline: string;
  sent_at: string | null;
  user_note: string | null;
  partner_name: string | null;
  payload_resumen: {
    days_fulfilled: number | null;
    habits: WeeklyReportHabitFraction[];
    en_riesgo: string[];
    late_edits: number;
  };
}

export function useWeeklyReport() {
  const [report, setReport] = useState<WeeklyReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch('/api/execution/report');
      const json = await res.json();
      setReport(json.status === 'success' ? json.data : null);
    } catch {
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
    const interval = setInterval(fetchReport, 30_000);
    return () => clearInterval(interval);
  }, [fetchReport]);

  const setNote = useCallback(
    async (programWeekId: string, note: string) => {
      const res = await fetch('/api/execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'manage_weekly_report',
          action: 'set_note',
          data: { program_week_id: programWeekId, note },
        }),
      });
      const json = await res.json();
      await fetchReport();
      return json;
    },
    [fetchReport]
  );

  return { report, isLoading, refresh: fetchReport, setNote };
}
