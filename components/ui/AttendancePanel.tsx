import React from 'react';
import { AttendanceRecordEntity, SubjectEntity } from '@/lib/db/dexie-schema';
import { saveAttendanceRecord, deleteAttendanceRecord } from '@/lib/db/repository';
import { Check, X, Clock3, RotateCcw } from 'lucide-react';

interface AttendancePanelProps {
  subjects: SubjectEntity[];
  attendanceRecords: AttendanceRecordEntity[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export const AttendancePanel: React.FC<AttendancePanelProps> = ({ subjects, attendanceRecords }) => {
  const log = async (subjectId: string, status: AttendanceRecordEntity['status']) => {
    await saveAttendanceRecord({ subject_id: subjectId, date: todayISO(), status });
  };

  if (subjects.length === 0) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface p-5">
        <h3 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100 mb-1">Asistencia</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Registra materias para llevar el control de faltas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">Asistencia por materia</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Faltas contra el tope permitido. Registra la clase de hoy con un toque.
        </p>
      </div>

      <ul className="divide-y divide-surface-border">
        {subjects.map((subject) => {
          const records = attendanceRecords.filter((r) => r.subject_id === subject.id);
          const absences = records.filter((r) => r.status === 'ausente').length;
          const late = records.filter((r) => r.status === 'tarde').length;
          const max = subject.max_absences ?? 0;
          const ratio = max > 0 ? absences / max : 0;

          // Señal funcional: verde tranquilo -> ámbar cerca del tope -> rojo al alcanzarlo.
          const barColor =
            max > 0 && ratio >= 1
              ? 'bg-red-500'
              : ratio >= 0.6
                ? 'bg-amber-500'
                : 'bg-synergy';
          const countColor =
            max > 0 && ratio >= 1
              ? 'text-red-600 dark:text-red-400'
              : ratio >= 0.6
                ? 'text-amber-600 dark:text-amber-500'
                : 'text-slate-700 dark:text-slate-300';

          const loggedToday = records.find((r) => r.date === todayISO());

          return (
            <li key={subject.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{subject.name}</span>
                  <span className={`text-xs font-mono tabular-nums font-semibold ${countColor}`}>
                    {absences}{max > 0 ? `/${max}` : ''}
                    <span className="text-slate-400 font-normal"> faltas</span>
                  </span>
                  {late > 0 && (
                    <span className="text-[11px] font-mono text-slate-400">· {late} tarde</span>
                  )}
                </div>
                {max > 0 && (
                  <div className="mt-1.5 h-1 w-full max-w-xs rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                  </div>
                )}
                {max > 0 && ratio >= 1 && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">Alcanzaste el tope de faltas de esta materia.</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {loggedToday ? (
                  <button
                    type="button"
                    onClick={() => deleteAttendanceRecord(loggedToday.id!)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-2 py-1.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                    title="Deshacer el registro de hoy"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Hoy: {loggedToday.status}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => log(subject.id!, 'presente')}
                      className="flex items-center gap-1 text-[11px] font-medium text-synergy px-2 py-1.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                      title="Asistí hoy"
                    >
                      <Check className="w-3.5 h-3.5" /> Asistí
                    </button>
                    <button
                      type="button"
                      onClick={() => log(subject.id!, 'tarde')}
                      className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-500 px-2 py-1.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                      title="Llegué tarde"
                    >
                      <Clock3 className="w-3.5 h-3.5" /> Tarde
                    </button>
                    <button
                      type="button"
                      onClick={() => log(subject.id!, 'ausente')}
                      className="flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400 px-2 py-1.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                      title="Falté hoy"
                    >
                      <X className="w-3.5 h-3.5" /> Falté
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
