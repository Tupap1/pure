import React, { useEffect, useRef, useState } from 'react';
import { useToday } from '@/lib/hooks/useToday';
import { usePureData } from '@/lib/hooks/usePureData';
import { useWeeklyReport } from '@/lib/hooks/useWeeklyReport';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { TodayRunningTanda } from '@/lib/execution/today';
import { buildTodayFooterView } from '@/lib/execution/today-view';
import { SundayPlanning } from '@/components/dashboards/SundayPlanning';
import { isoDayOfWeekForDateKey } from '@/lib/domain/execution';

/** "Lunes 14 sep · Semana 1 de 10" (o sin el segmento de semana si el programa no está creado). */
function formatDayLine(dateKey: string, week: { number: number; total: number } | null): string {
  const date = new Date(`${dateKey}T12:00:00`); // mediodía local: nunca cruza a otro día por redondeo
  const label = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }).format(date);
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return week ? `${capitalized} · Semana ${week.number} de ${week.total}` : capitalized;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Pantalla Hoy (US1-US3, FR-041): primera pantalla de Pure. Cubre la tanda de 10 minutos en un
 * toque (US1), el único disparador si-entonces vigente (US2) y los checks de hábitos del día con
 * el pie "N tandas hoy · Día cumplido" (US3).
 */
export const TodayDashboard: React.FC = () => {
  const {
    today,
    isLoading,
    isOffline,
    secondsLeft,
    countdown,
    refresh,
    start,
    interrupt,
    tagSubject,
    respondTrigger,
    setCheck,
  } = useToday();
  const { subjects } = usePureData();
  const { report, setNote } = useWeeklyReport();
  const { state: pushState, subscribe: subscribeToPush } = usePushNotifications();

  const [isStarting, setIsStarting] = useState(false);
  const [interruptOpen, setInterruptOpen] = useState(false);
  const [interruptReason, setInterruptReason] = useState('');
  const [justFinished, setJustFinished] = useState<TodayRunningTanda | null>(null);
  const prevRunningRef = useRef<TodayRunningTanda | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteJustSaved, setNoteJustSaved] = useState(false);
  const [showSundayPlanning, setShowSundayPlanning] = useState(false);

  // FR-008: la materia se puede asignar al terminar. Cuando la tanda en curso desaparece del
  // payload (se completó o se interrumpió) y no tenía materia, se ofrece etiquetarla.
  useEffect(() => {
    if (!today) return;
    const prev = prevRunningRef.current;
    if (prev && !today.running_tanda && !prev.subject_id) {
      setJustFinished(prev);
    }
    prevRunningRef.current = today.running_tanda;
  }, [today]);

  if (isOffline) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
        <p className="text-slate-500 dark:text-slate-400">No hay conexión con Pure</p>
        <Button variant="ghost" onClick={() => refresh()} className="min-h-[44px]">
          Reintentar
        </Button>
      </div>
    );
  }

  if (isLoading || !today) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 space-y-4 animate-pulse" role="status" aria-label="Cargando Hoy">
        <div className="h-4 w-48 mx-auto rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-52 rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-surface-border" />
      </div>
    );
  }

  const running = today.running_tanda;
  const minutesLeft = running && secondsLeft != null ? Math.ceil(secondsLeft / 60) : null;
  const footer = buildTodayFooterView(today);
  // US8 (T067): el asistente del domingo (SundayPlanning.tsx) solo se ofrece ese día de la semana.
  const isSunday = isoDayOfWeekForDateKey(today.date) === 7;

  const handleStart = async (routine_slot_id?: string) => {
    setIsStarting(true);
    try {
      await start(routine_slot_id ? { routine_slot_id } : undefined);
    } finally {
      setIsStarting(false);
    }
  };

  const handleInterruptSubmit = async () => {
    const reason = interruptReason.trim();
    if (!running || !reason) return;
    await interrupt(running.id, reason);
    setInterruptOpen(false);
    setInterruptReason('');
  };

  const handleSaveNote = async () => {
    if (!report) return;
    const result = await setNote(report.program_week_id, noteDraft.trim());
    if (result?.status === 'success') setNoteJustSaved(true);
  };

  // US6: el domingo, entre el congelamiento y el envío, hay una hora para escribir la nota
  // (note_deadline). server_now (si ya cargó Hoy) es más fiable que el reloj del cliente; sin él,
  // Date.now() basta para esto — el servidor es quien de verdad hace cumplir VENTANA_CERRADA.
  const referenceNowMs = today ? new Date(today.server_now).getTime() : Date.now();
  const noteWindowOpen = !!report && new Date(report.note_deadline).getTime() > referenceNowMs;

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6 pb-24">
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {formatDayLine(today.date, today.week)}
      </p>

      {isSunday && (
        <div className="text-center">
          <button
            onClick={() => setShowSundayPlanning(true)}
            className="min-h-[44px] px-2 text-sm text-slate-600 dark:text-slate-300 underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100"
          >
            Planear la semana →
          </button>
        </div>
      )}

      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        {running ? (
          <>
            <div className="text-5xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {countdown ?? '00:00'}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              hasta las <span className="font-mono">{formatClock(running.ends_at)}</span>
            </p>
            {/* Anuncio para lectores de pantalla: solo cambia de texto una vez por minuto
                (minutesLeft es un entero de minutos), así aria-live no interrumpe cada segundo. */}
            <span className="sr-only" aria-live="polite">
              {minutesLeft != null ? `Quedan ${minutesLeft} minuto${minutesLeft === 1 ? '' : 's'} de la tanda.` : ''}
            </span>

            {pushState === 'activable' && (
              <button
                onClick={() => subscribeToPush()}
                className="text-xs text-slate-500 dark:text-slate-400 underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200 min-h-[44px]"
              >
                Avísame al terminar
              </button>
            )}

            {!interruptOpen ? (
              <Button variant="ghost" size="sm" onClick={() => setInterruptOpen(true)} className="min-h-[44px]">
                Interrumpir
              </Button>
            ) : (
              <div className="w-full max-w-xs space-y-2">
                <input
                  type="text"
                  value={interruptReason}
                  onChange={(e) => setInterruptReason(e.target.value.slice(0, 140))}
                  placeholder="¿Por qué la cortas?"
                  maxLength={140}
                  autoFocus
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-surface-border bg-surface text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleInterruptSubmit}
                    disabled={!interruptReason.trim()}
                    className="min-h-[44px]"
                  >
                    Confirmar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInterruptOpen(false);
                      setInterruptReason('');
                    }}
                    className="min-h-[44px]"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Button variant="primary" size="lg" onClick={() => handleStart()} disabled={isStarting} className="min-h-[44px] px-10">
            Empezar tanda
          </Button>
        )}
      </Card>

      {today.trigger && (
        <Card className="space-y-4 text-center">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="block">Si {today.trigger.cue_text},</span>
            <span className="block">entonces {today.trigger.action_text}.</span>
          </p>
          <div className="flex gap-2 justify-center">
            {today.trigger.kind === 'estudio' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStart(today.trigger!.id)}
                disabled={isStarting}
                className="min-h-[44px]"
              >
                Empezar tanda
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => respondTrigger(today.trigger!.id, 'hecho')}
                className="min-h-[44px]"
              >
                Hecho
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => respondTrigger(today.trigger!.id, 'no')}
              className="min-h-[44px]"
            >
              No
            </Button>
          </div>
        </Card>
      )}

      {footer.checks.length > 0 && (
        <Card className="space-y-3">
          {footer.checks.map((check) => (
            <div key={check.habit_id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700 dark:text-slate-300">{check.label}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCheck(check.habit_id, 'cumplido')}
                  className="min-h-[44px]"
                >
                  Sí
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCheck(check.habit_id, 'fallado')}
                  className="min-h-[44px]"
                >
                  No
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {justFinished && (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">¿De qué materia fue esa tanda?</p>
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                onClick={async () => {
                  if (!subject.id) return;
                  await tagSubject(justFinished.id, subject.id);
                  setJustFinished(null);
                }}
                className={cn(
                  'min-h-[44px] px-3 rounded-md border text-sm font-medium transition-colors',
                  'bg-black/[0.03] dark:bg-white/[0.05] border-black/[0.06] dark:border-white/[0.08]',
                  'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]',
                  subject.modality === 'presencial' ? 'text-aeroespacial' : 'text-software'
                )}
              >
                {subject.name}
              </button>
            ))}
            <button
              onClick={() => setJustFinished(null)}
              className="min-h-[44px] px-3 rounded-md text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Omitir
            </button>
          </div>
        </Card>
      )}

      {(footer.tandasLine || footer.dayFulfilledLine) && (
        <p className="text-center text-xs font-mono text-slate-500 dark:text-slate-400">
          {footer.tandasLine}
          {footer.tandasLine && footer.dayFulfilledLine ? ' · ' : ''}
          {footer.dayFulfilledLine}
        </p>
      )}

      {report && (
        <Card className="space-y-3">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Semana {report.week_number} · {report.payload_resumen.days_fulfilled} de 7 días cumplidos · {report.verdict}
          </p>

          {report.payload_resumen.habits.map((habit) => (
            <p key={habit.label} className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {habit.label}: {habit.cumplidos}/{habit.total}
            </p>
          ))}

          {report.payload_resumen.en_riesgo.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">En riesgo</p>
              {report.payload_resumen.en_riesgo.map((line, index) => (
                <p key={index} className="text-xs text-slate-500 dark:text-slate-400">
                  · {line}
                </p>
              ))}
            </div>
          )}

          {report.status === 'congelado' && noteWindowOpen && !noteJustSaved && (
            <div className="space-y-2">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 400))}
                maxLength={400}
                placeholder="Tu nota para el reporte (opcional)"
                className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-surface-border bg-surface text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              {report.verdict === 'fallida' && !noteDraft.trim() && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Si no escribes nada, el reporte dirá que no diste explicación.
                </p>
              )}
              <Button variant="primary" size="sm" onClick={handleSaveNote} className="min-h-[44px]">
                Guardar nota
              </Button>
            </div>
          )}

          {report.status === 'congelado' && noteWindowOpen && noteJustSaved && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Nota guardada.</p>
          )}

          {report.status === 'congelado' && !noteWindowOpen && (
            <p className="text-xs text-slate-500 dark:text-slate-400">La ventana de nota cerró: se envía en breve.</p>
          )}
          {report.status === 'enviando' && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Enviando…</p>
          )}
          {report.status === 'enviado' && (
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Enviado{report.sent_at ? ` ${formatClock(report.sent_at)}` : ''}
            </p>
          )}
          {report.status === 'fallido' && (
            <p className="text-xs text-red-600 dark:text-red-400">No se pudo enviar</p>
          )}
        </Card>
      )}

      {showSundayPlanning && <SundayPlanning onClose={() => setShowSundayPlanning(false)} />}
    </div>
  );
};
