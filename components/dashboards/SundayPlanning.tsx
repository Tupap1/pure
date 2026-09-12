'use client';

import React, { useEffect, useState } from 'react';
import { usePlanWeekPreview } from '@/lib/hooks/usePlanWeek';
import { usePureData } from '@/lib/hooks/usePureData';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { GradeProjectionFlag } from '@/lib/domain/subject';
import { formatDeliverableDate } from '@/lib/domain/deliverable';

interface SundayPlanningProps {
  onClose: () => void;
}

const STEP_LABELS = ['Semana pasada', 'Entregas de 14 días', 'Intención por materia', 'Disparadores y reparto'] as const;

const FLAG_LABELS: Record<GradeProjectionFlag, string> = {
  ciega: 'sin evaluaciones',
  pesos_inconsistentes: 'pesos no suman 100%',
  entregado_sin_nota: 'entrega sin nota',
  vencido_sin_registrar: 'vencida sin registrar',
  meta_inalcanzable: 'meta inalcanzable',
  materia_perdida: 'materia perdida',
};

interface IntentionDraft {
  strength: number;
  reason: string;
}

/**
 * Asistente del domingo (US8, 4 pasos): la semana que pasó, las entregas de los próximos 14
 * días, la intención por materia y los disparadores de la semana que viene con su ensayo y el
 * reparto sugerido. Se entra desde Hoy los domingos (TodayDashboard.tsx enlaza este componente;
 * ver el reporte final de T067 para la línea exacta que hace falta agregar ahí).
 */
export const SundayPlanning: React.FC<SundayPlanningProps> = ({ onClose }) => {
  const { preview, isLoading, error, setIntentions, rehearseTrigger } = usePlanWeekPreview();
  const { subjects } = usePureData();
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, IntentionDraft>>({});
  const [intentionError, setIntentionError] = useState<string | null>(null);
  const [savingIntentions, setSavingIntentions] = useState(false);
  const [rehearsing, setRehearsing] = useState<string | null>(null);

  // Cuando llega el preview, siembra los drafts con la intención ya guardada (si la hay) o 8
  // por defecto (prioridad normal) — nunca pisa lo que el usuario ya esté editando en pantalla.
  useEffect(() => {
    if (!preview) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const subject of subjects) {
        if (!subject.id || next[subject.id]) continue;
        const existing = preview.intenciones.find((i) => i.subject_id === subject.id);
        next[subject.id] = { strength: existing?.strength ?? 8, reason: existing?.reason ?? '' };
      }
      return next;
    });
  }, [preview, subjects]);

  const handleSaveIntentions = async () => {
    setSavingIntentions(true);
    const items = Object.entries(drafts).map(([subject_id, draft]) => ({
      subject_id,
      strength: draft.strength,
      reason: draft.reason.trim() || undefined,
    }));
    const res = await setIntentions(items);
    setSavingIntentions(false);
    if ((res as any).status === 'error') {
      setIntentionError((res as any).message || 'No se pudieron guardar las intenciones.');
      return;
    }
    setIntentionError(null);
    setStep(3);
  };

  const handleRehearse = async (slotId: string) => {
    setRehearsing(slotId);
    await rehearseTrigger(slotId);
    setRehearsing(null);
  };

  return (
    <Modal isOpen onClose={onClose} title="Planeación del domingo">
      {isLoading && <p className="text-xs text-slate-500 dark:text-slate-400">Cargando…</p>}
      {error && !isLoading && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {preview && (
        <div className="space-y-4">
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Paso {step + 1} de 4 · {STEP_LABELS[step]}
          </p>

          {step === 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
                Lo que pasó la semana pasada
              </h4>
              {preview.semana_pasada ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Días cumplidos</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {preview.semana_pasada.days_fulfilled} de 7
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Desde el inicio</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {preview.semana_pasada.dias_cumplidos_totales} de {preview.semana_pasada.horizonte}
                    </span>
                  </div>
                  {preview.semana_pasada.habitos.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400">{h.label}</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">
                        {h.cumplidos}/{h.total}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">Todavía no hay una semana anterior que revisar.</p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
                Entregas de los próximos 14 días
              </h4>
              {preview.entregas_14_dias.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Sin entregas en los próximos 14 días.</p>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                  {preview.entregas_14_dias.map((entrega) => (
                    <div key={entrega.id} className="flex items-center justify-between px-3 py-2 text-xs gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{entrega.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {entrega.subject_name}
                          {entrega.subject_flags.length > 0 &&
                            ` · ${entrega.subject_flags.map((f) => FLAG_LABELS[f]).join(', ')}`}
                        </p>
                      </div>
                      <span className="font-mono text-slate-600 dark:text-slate-300 shrink-0">
                        {formatDeliverableDate(entrega.due_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
                Intención por materia esta semana
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Menor a 6: esa materia deja de recibir disparadores sugeridos, y hace falta decir por qué.
              </p>
              {subjects.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Registra materias para poder declarar intención.</p>
              ) : (
                <div className="space-y-3">
                  {subjects.map((subject) => {
                    if (!subject.id) return null;
                    const draft = drafts[subject.id] ?? { strength: 8, reason: '' };
                    const needsReason = draft.strength < 6;
                    return (
                      <div key={subject.id} className="space-y-1.5 pb-2.5 border-b border-slate-200 dark:border-slate-800 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 flex-1 truncate">
                            {subject.name}
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={10}
                            value={draft.strength}
                            aria-label={`Intención para ${subject.name}`}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [subject.id!]: { ...draft, strength: Number(e.target.value) },
                              }))
                            }
                            className="w-28"
                          />
                          <span className="font-mono text-xs font-semibold w-6 text-right text-slate-900 dark:text-slate-100">
                            {draft.strength}
                          </span>
                        </div>
                        {needsReason && (
                          <input
                            type="text"
                            value={draft.reason}
                            placeholder="¿Por qué queda en prioridad baja esta semana?"
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [subject.id!]: { ...draft, reason: e.target.value } }))
                            }
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {intentionError && <p className="text-xs text-red-600 dark:text-red-400">{intentionError}</p>}
              <Button size="sm" variant="synergy" onClick={handleSaveIntentions} disabled={savingIntentions || subjects.length === 0}>
                Guardar intenciones
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
                  Disparadores de la semana
                </h4>
                {preview.disparadores.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sin disparadores registrados todavía.</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                    {preview.disparadores.map((slot) => (
                      <div key={slot.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                        <span className="text-slate-700 dark:text-slate-300 truncate">
                          {slot.cue_text} → {slot.action_text}
                        </span>
                        {slot.ensayado ? (
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 shrink-0">Ensayado</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0"
                            disabled={rehearsing === slot.id}
                            onClick={() => handleRehearse(slot.id)}
                          >
                            Ensayar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
                  Reparto sugerido (norma de créditos)
                </h4>
                {preview.reparto_sugerido.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sin materias con reparto sugerido (revisa las intenciones del paso anterior).
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-surface-border text-slate-500 dark:text-slate-400">
                          <th className="text-left font-medium px-3 py-2">Materia</th>
                          <th className="text-right font-medium px-3 py-2 tabular-nums">Tandas</th>
                          <th className="text-right font-medium px-3 py-2 tabular-nums">Norma</th>
                          <th className="text-right font-medium px-3 py-2 tabular-nums">Urgencia</th>
                          <th className="text-right font-medium px-3 py-2 tabular-nums">Proyección</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {preview.reparto_sugerido.map((row) => (
                          <tr key={row.subject_id}>
                            <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{row.name}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                              {row.suggested_tandas}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {row.normative_hours.toFixed(1)}h
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {row.urgencia}%
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {row.proyeccion?.neededToPass != null ? row.proyeccion.neededToPass.toFixed(2) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button size="sm" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Atrás
            </Button>
            {step < 3 ? (
              <Button size="sm" onClick={() => setStep((s) => Math.min(3, s + 1))}>
                Siguiente
              </Button>
            ) : (
              <Button size="sm" variant="synergy" onClick={onClose}>
                Terminar
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
