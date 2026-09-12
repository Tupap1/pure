import React, { useEffect, useRef, useState } from 'react';
import { useToday } from '@/lib/hooks/useToday';
import { usePureData } from '@/lib/hooks/usePureData';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { TodayRunningTanda } from '@/lib/execution/today';

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
 * Pantalla Hoy (US1-US3, FR-041): primera pantalla de Pure. En esta fase (US1) solo cubre la
 * tanda de 10 minutos en un toque; el disparador vigente (US2) y los checks de hábitos (US3)
 * llegan en fases siguientes sin cambiar esta estructura (getToday ya expone `trigger` y
 * `pending_checks`, hoy siempre vacíos).
 */
export const TodayDashboard: React.FC = () => {
  const { today, isLoading, isOffline, secondsLeft, countdown, refresh, start, finish, interrupt, tagSubject } =
    useToday();
  const { subjects } = usePureData();

  const [isStarting, setIsStarting] = useState(false);
  const [interruptOpen, setInterruptOpen] = useState(false);
  const [interruptReason, setInterruptReason] = useState('');
  const [justFinished, setJustFinished] = useState<TodayRunningTanda | null>(null);
  const prevRunningRef = useRef<TodayRunningTanda | null>(null);

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

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await start();
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

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6 pb-24">
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {formatDayLine(today.date, today.week)}
      </p>

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
          <Button variant="primary" size="lg" onClick={handleStart} disabled={isStarting} className="min-h-[44px] px-10">
            Empezar tanda
          </Button>
        )}
      </Card>

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

      {(today.tandas_today > 0 || today.day_fulfilled) && (
        <p className="text-center text-xs font-mono text-slate-500 dark:text-slate-400">
          {today.tandas_today > 0 && `${today.tandas_today} tanda${today.tandas_today === 1 ? '' : 's'} hoy`}
          {today.tandas_today > 0 && today.day_fulfilled ? ' · ' : ''}
          {today.day_fulfilled ? 'Día cumplido' : ''}
        </p>
      )}
    </div>
  );
};
