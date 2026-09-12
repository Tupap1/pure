'use client';

import React, { useState } from 'react';
import { useWeekView } from '@/lib/hooks/usePlanWeek';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CalendarRange } from 'lucide-react';

const WEEKDAY_SHORT_ES = ['', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']; // 1=lunes..7=domingo

function isoDayOfWeekForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const sundayIsZero = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sundayIsZero === 0 ? 7 : sundayIsZero;
}

function dayLabel(dateKey: string): string {
  const [, , day] = dateKey.split('-');
  return `${WEEKDAY_SHORT_ES[isoDayOfWeekForDateKey(dateKey)]} ${Number(day)}`;
}

const OUTCOME_LABEL: Record<string, string> = {
  hecho: 'Hecho',
  no: 'No',
  sin_respuesta: '—',
};

/**
 * Vista de semana (US9, FR-037): rejilla sin gráficas, detrás de la compuerta plan_week:open_view
 * (2 aperturas libres por semana; desde la 3.ª pide una razón). Muestra cada disparador con su
 * resultado por día y las tandas por día — nada de barras, líneas ni anillos de progreso
 * (DESIGN.md).
 */
export const WeekView: React.FC = () => {
  const { data, isLoading, needsReason, open } = useWeekView();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const handleSubmitReason = async () => {
    if (!reason.trim()) {
      setReasonError('Hace falta una razón para esta apertura.');
      return;
    }
    setSubmitting(true);
    const res = await open(reason.trim());
    setSubmitting(false);
    if ((res as any).status === 'error') {
      setReasonError((res as any).message || 'No se pudo abrir la vista de semana.');
      return;
    }
    setReasonError(null);
  };

  if (needsReason) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 space-y-4">
        <Card className="space-y-3 text-center">
          <CalendarRange className="w-8 h-8 mx-auto text-slate-400" />
          <h3 className="text-base font-heading font-bold text-slate-900 dark:text-slate-100">
            Ya consultaste la semana 2 veces
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Desde la 3.ª vez esta semana, hace falta decir por qué (FR-037). Queda registrado y se cuenta en el reporte.
          </p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="¿Por qué necesitas ver la semana otra vez?"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          {reasonError && <p className="text-xs text-red-600 dark:text-red-400">{reasonError}</p>}
          <Button size="sm" variant="synergy" onClick={handleSubmitReason} disabled={submitting} className="w-full">
            Continuar
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 animate-pulse space-y-4" role="status" aria-label="Cargando la semana">
        <div className="h-4 w-40 mx-auto rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-48 rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-surface-border" />
      </div>
    );
  }

  const days = Array.from(
    new Set(data.disparadores.flatMap((row) => Object.keys(row.dias)).concat(data.tandas_por_dia.map((d) => d.date)))
  ).sort();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 pb-24">
      <div>
        <h2 className="text-xl font-heading font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
          Semana
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Apertura {data.opens_this_week} de la semana{data.needs_reason ? ' (con razón)' : ''}.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <h3 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">Disparadores</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Hecho / No / sin respuesta, por día.</p>
        </div>
        {data.disparadores.length === 0 || days.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-slate-500 dark:text-slate-400">Sin disparadores registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-y border-surface-border text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium px-4 py-2">Disparador</th>
                  {days.map((day) => (
                    <th key={day} className="text-center font-medium px-2 py-2 tabular-nums">
                      {dayLabel(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {data.disparadores.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 max-w-[220px] truncate" title={`${row.cue_text} → ${row.action_text}`}>
                      {row.cue_text} → {row.action_text}
                    </td>
                    {days.map((day) => {
                      const outcome = row.dias[day];
                      const label = outcome == null ? '' : OUTCOME_LABEL[outcome] ?? outcome;
                      const tone =
                        outcome === 'hecho'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : outcome === 'no'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-slate-400 dark:text-slate-500';
                      return (
                        <td key={day} className={`px-2 py-2.5 text-center font-mono tabular-nums ${tone}`}>
                          {label}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <h3 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">Tandas por día</h3>
        </div>
        {data.tandas_por_dia.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-slate-500 dark:text-slate-400">Sin tandas registradas esta semana.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-y border-surface-border text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium px-4 py-2">Día</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Completadas</th>
                  <th className="text-right font-medium px-3 py-2 tabular-nums">Interrumpidas</th>
                  <th className="text-right font-medium px-4 py-2 tabular-nums">Minutos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {data.tandas_por_dia.map((day) => (
                  <tr key={day.date}>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{dayLabel(day.date)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {day.completadas}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {day.interrumpidas}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {day.minutos}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
