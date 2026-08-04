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

const getTodayDayOfWeek = (): number => {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
};

export const MobileScheduleTimeline: React.FC = () => {
  const { isLoaded, subjects, schedules } = usePureData();
  const todayNum = getTodayDayOfWeek();

  const [selectedDay, setSelectedDay] = useState<number>(todayNum);
  const [activeTab, setActiveTab] = useState<'timeline' | 'attendance'>('timeline');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const [absenceRecords, setAbsenceRecords] = useState<Record<string, string[]>>({});

  if (!isLoaded) {
    return <div className="p-4 text-center text-xs font-mono text-slate-400">Cargando timeline...</div>;
  }

  const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fullDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const dayNumbers = [18, 19, 20, 21, 22, 23, 24]; // Day dates matching inspo style

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
      {/* Header (Inspo Image 3: SCHEDULE / MONTH) */}
      <div className="text-center space-y-0.5 py-1">
        <h3 className="text-lg font-extrabold font-heading tracking-wider uppercase text-slate-900 dark:text-slate-100">
          SCHEDULE
        </h3>
        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-medium uppercase tracking-widest">
          AGOSTO 2026
        </p>
      </div>

      {/* Purple Gradient Day Selector Strip (Inspo Image 3) */}
      <div className="p-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 shadow-lg">
        <div className="flex items-center justify-between gap-1">
          {shortDays.map((dayName, idx) => {
            const dayNum = idx + 1;
            const isSelected = selectedDay === dayNum;
            const dayDate = dayNumbers[idx];

            return (
              <button
                key={dayName}
                onClick={() => setSelectedDay(dayNum)}
                className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-white text-indigo-950 font-bold shadow-md scale-105'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="text-[10px] uppercase font-mono font-medium leading-none">{dayName}</span>
                <span className="text-sm font-bold font-mono leading-tight mt-0.5">{dayDate}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-Tab View Switcher */}
      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-1.5 font-bold rounded-lg transition-all ${
            activeTab === 'timeline'
              ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Agenda por Horas
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-1.5 font-bold rounded-lg transition-all ${
            activeTab === 'attendance'
              ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Control Inasistencias
        </button>
      </div>

      {activeTab === 'timeline' ? (
        /* TIMELINE AGENDA CARDS (Exact match to Inspo Image 3) */
        <div className="space-y-3 pt-1">
          {daySchedules.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <CalendarIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Día libre de clases</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No hay clases agendadas para este día.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {daySchedules.map((sched) => {
                const sub = subjects.find((s) => s.id === sched.subject_id);
                const isPresencial = sub?.modality === 'presencial';
                const absences = absenceRecords[sched.subject_id] || [];

                return (
                  <div
                    key={sched.id}
                    className="p-4 rounded-xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm hover:border-cyan-500/40 transition-all"
                  >
                    {/* Left: Time Slots (Inspo Image 3) */}
                    <div className="text-center font-mono shrink-0 pr-3 border-r border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {sched.start_time}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {sched.end_time}
                      </div>
                    </div>

                    {/* Center: Course Code & Name & Room Badge (Inspo Image 3) */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        {sub?.code || 'ED5017'}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate font-heading">
                        {sub?.name || 'Materia'}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                          {sched.classroom || (isPresencial ? 'AULA 101' : 'VIRTUAL')}
                        </span>
                        <span>•</span>
                        <span>{isPresencial ? 'TEORÍA' : 'LAB'}</span>
                      </div>
                    </div>

                    {/* Right: Absences Counter (Inspo Image 3) */}
                    <div className="text-right shrink-0 font-mono space-y-0.5 pl-2">
                      <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                        0{absences.length}
                      </div>
                      <div className="text-[9px] text-slate-400 leading-tight">Fallas</div>
                      <div className="text-[9px] text-cyan-600 dark:text-cyan-400 font-bold cursor-pointer hover:underline pt-0.5">
                        DETALLES
                      </div>
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                      : 'bg-white dark:bg-[#0d1322] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {sub.code || sub.name}
                </button>
              );
            })}
          </div>

          {activeSubject && (() => {
            const absences = absenceRecords[activeSubject.id!] || [];
            const allowedAbsences = 4;
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
                          className={`h-8 rounded-lg text-xs font-mono transition-all flex items-center justify-center border ${
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
