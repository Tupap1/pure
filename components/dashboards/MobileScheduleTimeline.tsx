import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { filterSchedulesByDay, sortSchedulesByTime } from '@/lib/algorithms/schedule-mobile-transformer';
import { getSabadoTypeForDate, getSlotPeriodicity } from '@/lib/algorithms/conflict-detector';

const getTodayDayOfWeek = (): number => {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
};

export const MobileScheduleTimeline: React.FC = () => {
  const { isLoaded, universities, subjects, schedules } = usePureData();
  const todayNum = getTodayDayOfWeek();

  const [selectedDay, setSelectedDay] = useState<number>(todayNum);
  const [activeTab, setActiveTab] = useState<'timeline' | 'attendance'>('timeline');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const [absenceRecords, setAbsenceRecords] = useState<Record<string, string[]>>({});

  if (!isLoaded) {
    return (
      <div className="space-y-4 max-w-md mx-auto animate-pulse" role="status" aria-label="Cargando timeline">
        <div className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="h-10 rounded-xl bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  const shortDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const fullDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const dayNumbers = [18, 19, 20, 21, 22, 23, 24];

  const daySchedules = sortSchedulesByTime(filterSchedulesByDay(schedules, selectedDay));

  const toggleAbsenceDate = (subjectId: string, dateStr: string) => {
    setAbsenceRecords((prev) => {
      const current = prev[subjectId] || [];
      const exists = current.includes(dateStr);
      const updated = exists ? current.filter((d) => d !== dateStr) : [...current, dateStr];
      return { ...prev, [subjectId]: updated };
    });
  };

  const activeSubject = subjects.find((s) => s.id === (selectedSubjectId || subjects[0]?.id));

  const currentMonthDays = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    return `2026-08-${dayStr}`;
  });

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* Header — PURE OS Titanium Cybernetic Styling */}
      <div className="text-center space-y-0.5 py-1">
        <h3 className="text-base font-extrabold font-heading tracking-wider uppercase text-slate-900 dark:text-slate-100">
          SCHEDULE
        </h3>
        <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-widest">
          AGOSTO 2026
        </p>
      </div>

      <div className="flex items-center justify-between gap-1 bg-white dark:bg-[#0d1322] p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {shortDays.map((day, idx) => {
          const dayNum = idx + 1;
          const isSelected = selectedDay === dayNum;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(dayNum)}
              className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all ${
                isSelected
                  ? 'bg-cyan-500 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-[9px] font-bold uppercase">{day}</span>
              <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-200'}`}>
                {dayNumbers[idx]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'timeline'}
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 min-h-[44px] font-bold rounded-lg transition-all ${
            activeTab === 'timeline'
              ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Agenda por Horas
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'attendance'}
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 min-h-[44px] font-bold rounded-lg transition-all ${
            activeTab === 'attendance'
              ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Control Inasistencias
        </button>
      </div>

      {activeTab === 'timeline' ? (
        /* TIMELINE AGENDA CARDS */
        <div className="space-y-3 pt-1">
          {daySchedules.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <CalendarIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-heading">Día libre de clases</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No hay clases agendadas para este día.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {daySchedules.map((sched) => {
                const sub = subjects.find((s) => s.id === sched.subject_id);
                const uni = universities.find((u) => u.id === sub?.university_id);
                const isPresencial = sub?.modality === 'presencial';
                const absences = absenceRecords[sched.subject_id] || [];

                let isAttenuated = false;
                let periodicityBadgeText = '';

                if (selectedDay === 6 && (uni?.has_alternating_saturdays ?? true)) {
                  const currentSabadoType = getSabadoTypeForDate(new Date(), uni?.first_sabado_a_date || '2026-08-01');
                  const schedPeriodicity = getSlotPeriodicity({
                    classroom: sched.classroom,
                    periodicity: sched.periodicity,
                    has_alternating_saturdays: uni?.has_alternating_saturdays,
                  });
                  if (schedPeriodicity !== 'semanal' && schedPeriodicity !== currentSabadoType) {
                    isAttenuated = true;
                    periodicityBadgeText = schedPeriodicity === 'sabado_a' ? 'Sábado A • No dicta hoy' : 'Sábado B • No dicta hoy';
                  }
                }

                return (
                  <div
                    key={sched.id}
                    className={`p-4 rounded-xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/90 flex items-center justify-between gap-3 shadow-sm hover:border-cyan-500/40 transition-all ${
                      isAttenuated ? 'opacity-40 grayscale-[30%]' : ''
                    }`}
                  >
                    {/* Left: Time Slots */}
                    <div className="text-center font-mono shrink-0 pr-3 border-r border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {sched.start_time}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {sched.end_time}
                      </div>
                    </div>

                    {/* Center: Course Code & Name & Room Badge */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                          {sub?.code || 'ASIGNATURA'}
                        </span>
                        {isAttenuated && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/30">
                            {periodicityBadgeText}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate font-heading">
                        {sub?.name || 'Materia'}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          {sched.classroom || (isPresencial ? 'AULA 101' : 'VIRTUAL')}
                        </span>
                        <span>•</span>
                        <span>{isPresencial ? 'PRESENCIAL' : 'VIRTUAL'}</span>
                      </div>
                    </div>

                    {/* Right: Absences Counter */}
                    <div className="text-right shrink-0 font-mono space-y-0.5 pl-2">
                      <div className="text-base font-bold text-cyan-600 dark:text-cyan-400 leading-none">
                        0{absences.length}
                      </div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">Fallas</div>
                      <button
                        onClick={() => {
                          setSelectedSubjectId(sched.subject_id);
                          setActiveTab('attendance');
                        }}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-end -mr-2 -mb-2 text-[9px] text-purple-600 dark:text-purple-400 font-bold hover:underline"
                      >
                        DETALLES
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ATTENDANCE CONTROL VIEW */
        <div className="space-y-4 pt-1">
          {/* Subject Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {subjects.map((sub) => {
              const isSelected = activeSubject?.id === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubjectId(sub.id!)}
                  className={`px-3 min-h-[44px] rounded-lg text-xs font-heading font-bold transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/40 glow-aeroespacial'
                      : 'bg-white dark:bg-[#0d1322] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>

          {activeSubject && (() => {
            const absences = absenceRecords[activeSubject.id!] || [];
            const allowedAbsences = activeSubject.max_absences !== undefined ? activeSubject.max_absences : 4;
            const remainingAbsences = Math.max(0, allowedAbsences - absences.length);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-3 text-center space-y-0.5">
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Permitidas</div>
                    <div className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                      0{allowedAbsences}
                    </div>
                  </Card>
                  <Card className="p-3 text-center space-y-0.5 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40">
                    <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400">Fallas</div>
                    <div className="text-lg font-mono font-bold text-rose-600 dark:text-rose-400">
                      0{absences.length}
                    </div>
                  </Card>
                  <Card className="p-3 text-center space-y-0.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40">
                    <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Restantes</div>
                    <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      0{remainingAbsences}
                    </div>
                  </Card>
                </div>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading">
                      Registro de Asistencia — Agosto 2026
                    </h4>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {currentMonthDays.map((dateStr, idx) => {
                      const dayNum = idx + 1;
                      const isAbsent = absences.includes(dateStr);
                      return (
                        <button
                          key={dateStr}
                          onClick={() => toggleAbsenceDate(activeSubject.id!, dateStr)}
                          aria-label={`Marcar falla el día ${dayNum}`}
                          aria-pressed={isAbsent}
                          className={`h-11 rounded-lg text-xs font-mono transition-all flex items-center justify-center border ${
                            isAbsent
                              ? 'bg-rose-500 text-white font-bold border-rose-400 shadow-sm animate-pulse'
                              : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
