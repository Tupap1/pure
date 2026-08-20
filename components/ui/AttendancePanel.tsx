import React from 'react';
import {
  AttendanceRecordEntity,
  SubjectEntity,
  ScheduleEntity,
  UniversityEntity,
} from '@/lib/db/dexie-schema';
import { saveAttendanceRecord, deleteAttendanceRecord } from '@/lib/db/repository';
import { getSabadoTypeForDate, occursOnSabadoVariant } from '@/lib/algorithms/conflict-detector';
import { Check, X, Clock3, RotateCcw } from 'lucide-react';

interface AttendancePanelProps {
  subjects: SubjectEntity[];
  schedules: ScheduleEntity[];
  universities: UniversityEntity[];
  attendanceRecords: AttendanceRecordEntity[];
}

const pad = (n: number) => String(n).padStart(2, '0');
// Fecha local (no UTC) para que "hoy" coincida con el día del usuario, no del servidor.
const localDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const STATUS_LABEL: Record<AttendanceRecordEntity['status'], string> = {
  presente: 'asististe',
  ausente: 'faltaste',
  tarde: 'llegaste tarde',
  justificada: 'justificada',
};

export const AttendancePanel: React.FC<AttendancePanelProps> = ({
  subjects,
  schedules,
  universities,
  attendanceRecords,
}) => {
  const now = new Date();
  const todayStr = localDateStr(now);
  const isoWeekday = now.getDay() === 0 ? 7 : now.getDay();

  const log = async (subjectId: string, status: AttendanceRecordEntity['status']) => {
    await saveAttendanceRecord({ subject_id: subjectId, date: todayStr, status });
  };

  // Clases que realmente tocan hoy, según el horario (respetando sábados A/B).
  const todayClassesMap = new Map<string, { subject: SubjectEntity; start_time: string }>();
  for (const sch of schedules) {
    if (sch.day_of_week !== isoWeekday) continue;
    const subject = subjects.find((s) => s.id === sch.subject_id);
    if (!subject) continue;
    if (isoWeekday === 6) {
      const uni = universities.find((u) => u.id === subject.university_id);
      if (uni?.has_alternating_saturdays) {
        const variant = getSabadoTypeForDate(now, uni.first_sabado_a_date || '2026-08-01');
        if (!occursOnSabadoVariant({ periodicity: sch.periodicity }, variant)) continue;
      }
    }
    const existing = todayClassesMap.get(subject.id!);
    if (!existing || sch.start_time < existing.start_time) {
      todayClassesMap.set(subject.id!, { subject, start_time: sch.start_time });
    }
  }
  const todayClasses = Array.from(todayClassesMap.values()).sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  const absencesOf = (subjectId: string) =>
    attendanceRecords.filter((r) => r.subject_id === subjectId && r.status === 'ausente').length;

  const dayLabel = now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="rounded-xl border border-surface-border bg-surface overflow-hidden">
      {/* Clases de hoy — registro de un toque */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-heading font-semibold text-slate-900 dark:text-slate-100">
            Asistencia de hoy
          </h3>
          <span className="text-[11px] text-slate-400 capitalize">{dayLabel}</span>
        </div>
      </div>

      {todayClasses.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-slate-500 dark:text-slate-400">
          No tienes clases hoy.
        </p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {todayClasses.map(({ subject, start_time }) => {
            const absences = absencesOf(subject.id!);
            const max = subject.max_absences ?? 0;
            const atLimit = max > 0 && absences >= max;
            const loggedToday = attendanceRecords.find(
              (r) => r.subject_id === subject.id && r.date === todayStr
            );

            return (
              <li key={subject.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">{start_time}</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {subject.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Faltas acumuladas:{' '}
                    <span className={`font-mono tabular-nums ${atLimit ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                      {absences}{max > 0 ? `/${max}` : ''}
                    </span>
                    {atLimit && ' · en el tope'}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {loggedToday ? (
                    <button
                      type="button"
                      onClick={() => deleteAttendanceRecord(loggedToday.id!)}
                      className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-2 py-1.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                      title="Deshacer el registro de hoy"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Hoy {STATUS_LABEL[loggedToday.status]}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => log(subject.id!, 'presente')}
                        className="flex items-center gap-1 text-[11px] font-medium text-synergy px-2 py-1.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                        title="Asistí"
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
                        title="Falté"
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
      )}

      {/* Resumen de faltas — todas las materias, solo lectura */}
      {subjects.length > 0 && (
        <div className="border-t border-surface-border px-4 py-3 bg-black/[0.015] dark:bg-white/[0.02]">
          <h4 className="text-[11px] uppercase tracking-wide font-medium text-slate-500 dark:text-slate-400 mb-2">
            Faltas por materia
          </h4>
          <ul className="space-y-2">
            {subjects.map((subject) => {
              const absences = absencesOf(subject.id!);
              const max = subject.max_absences ?? 0;
              const ratio = max > 0 ? absences / max : 0;
              const barColor =
                max > 0 && ratio >= 1 ? 'bg-red-500' : ratio >= 0.6 ? 'bg-amber-500' : 'bg-synergy';
              return (
                <li key={subject.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1 min-w-0">
                    {subject.name}
                  </span>
                  {max > 0 && (
                    <div className="h-1 w-20 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden shrink-0">
                      <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                    </div>
                  )}
                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0 w-12 text-right">
                    {absences}{max > 0 ? `/${max}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
