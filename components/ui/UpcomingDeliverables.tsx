import React from 'react';
import { DeliverableEntity, SubjectEntity } from '@/lib/db/dexie-schema';

interface UpcomingDeliverablesProps {
  deliverables: DeliverableEntity[];
  subjects: SubjectEntity[];
  onSelect?: (deliverable: DeliverableEntity) => void;
  limit?: number;
}

const MS_DAY = 1000 * 60 * 60 * 24;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysUntil = (due: string): number => {
  const now = startOfDay(new Date());
  const target = startOfDay(new Date(due));
  return Math.round((target.getTime() - now.getTime()) / MS_DAY);
};

const relativeLabel = (due: string, status: string): string => {
  const d = daysUntil(due);
  if (status === 'pendiente' && d < 0) return `Vencida hace ${Math.abs(d)}d`;
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d < 0) return `Hace ${Math.abs(d)}d`;
  return `En ${d} días`;
};

const shortDate = (due: string): { day: string; month: string } => {
  const dt = new Date(due);
  return {
    day: String(dt.getDate()).padStart(2, '0'),
    month: dt.toLocaleDateString('es', { month: 'short' }).replace('.', ''),
  };
};

// Punto de estado: color muy sobrio, solo señal funcional.
const statusDot = (deliv: DeliverableEntity): string => {
  const overdue = deliv.status === 'pendiente' && daysUntil(deliv.due_date) < 0;
  if (overdue) return 'bg-red-500';
  if (deliv.status === 'calificado') return 'bg-synergy';
  if (deliv.status === 'entregado') return 'bg-aeroespacial';
  return 'bg-amber-500';
};

export const UpcomingDeliverables: React.FC<UpcomingDeliverablesProps> = ({
  deliverables,
  subjects,
  onSelect,
  limit = 6,
}) => {
  // Solo lo que sigue pendiente, ordenado por cercanía del deadline.
  const pending = deliverables
    .filter((d) => d.status === 'pendiente')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, limit);

  if (pending.length === 0) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface p-5">
        <h3 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Próximas entregas
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No tienes entregas pendientes. Todo al día.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
          Próximas entregas
        </h3>
        <span className="text-[11px] font-mono text-slate-400">{pending.length} pendientes</span>
      </div>

      <ul className="divide-y divide-surface-border -mx-1">
        {pending.map((deliv) => {
          const subject = subjects.find((s) => s.id === deliv.subject_id);
          const { day, month } = shortDate(deliv.due_date);
          const overdue = daysUntil(deliv.due_date) < 0;
          const isGroupSoftware = subject?.modality === 'virtual';

          return (
            <li key={deliv.id}>
              <button
                type="button"
                onClick={() => onSelect?.(deliv)}
                className="w-full flex items-center gap-3 px-1 py-2.5 text-left rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
              >
                {/* Fecha */}
                <div className="w-10 shrink-0 text-center">
                  <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 leading-none">
                    {day}
                  </div>
                  <div className="text-[10px] uppercase text-slate-400 tracking-wide">{month}</div>
                </div>

                {/* Punto de estado */}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(deliv)}`} />

                {/* Materia + título */}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {deliv.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {subject && (
                      <span className={isGroupSoftware ? 'text-software' : 'text-aeroespacial'}>
                        {subject.name}
                      </span>
                    )}
                    {deliv.weight_percentage ? ` · ${deliv.weight_percentage}%` : ''}
                  </div>
                </div>

                {/* Urgencia */}
                <span
                  className={`shrink-0 text-[11px] font-medium ${
                    overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {relativeLabel(deliv.due_date, deliv.status)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
