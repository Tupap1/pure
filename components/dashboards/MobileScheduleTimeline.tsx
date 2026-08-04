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
  const { isLoaded, subjects, schedules, universities } = usePureData();
  const todayNum = getTodayDayOfWeek();

  const [selectedDay, setSelectedDay] = useState<number>(todayNum);
  const [activeTab, setActiveTab] = useState<'timeline' | 'attendance'>('timeline');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Mock / State for Absences tracked per subject
  const [absenceRecords, setAbsenceRecords] = useState<Record<string, string[]>>({
    // subjectId -> array of YYYY-MM-DD
  });

  if (!isLoaded) {
    return <div className="p-4 text-center text-xs font-mono text-slate-400">Cargando timeline...</div>;
  }

  const shortDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const fullDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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

  // Calendar dates generation for Current Month (e.g. August 2026)
  const currentMonthDays = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    return `2026-08-${dayStr}`;
  });

  return (
    <div className="space-y-4">
      {/* Sub-Tab Navigation Bar (Inspo Image 1 & 3) */}
      <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'timeline'
              ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Agenda por Horas
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'attendance'
              ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Control de Inasistencias
        </button>
      </div>

      {/* Horizontal Day Selector Strip (Inspo Image 3) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {shortDays.map((dayName, idx) => {
          const dayNum = idx + 1;
          const isSelected = selectedDay === dayNum;
          const isToday = todayNum === dayNum;
          const count = filterSchedulesByDay(schedules, dayNum).length;

          return (
            <button
              key={dayName}
              onClick={() => setSelectedDay(dayNum)}
              className={`min-h-[48px] min-w-[58px] flex flex-col items-center justify-center px-2 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 relative ${
                isSelected
                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-md shadow-sky-500/20'
                  : isToday
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-1">
                <span>{dayName}</span>
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
              </div>
              <div className="text-[10px] font-mono opacity-80 mt-0.5">
                {count > 0 ? `${count} cl` : 'Libre'}
              </div>
            </button>
          );
        })}
      </div>

      {activeTab === 'timeline' ? (
        /* TIMELINE AGENDA VIEW (Inspo Image 3) */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 px-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              📅 {fullDays[selectedDay - 1]}
            </span>
            <span>{daySchedules.length} clases programadas</span>
          </div>

          {daySchedules.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <CalendarIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Día libre de clases</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Aprovecha este tiempo para avanzar en tus entregas o estudio DME.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {daySchedules.map((sched) => {
                const sub = subjects.find((s) => s.id === sched.subject_id);
                const isPresencial = sub?.modality === 'presencial';
                const absences = absenceRecords[sched.subject_id] || [];

                return (
                  <Card
                    key={sched.id}
                    className="p-4 border-l-4 border-l-sky-500 hover:border-sky-400 transition-all flex items-start justify-between gap-3"
                  >
                    {/* Left Column: Time & Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {sched.start_time} - {sched.end_time}
                        </span>
                        <Badge variant={isPresencial ? 'aeroespacial' : 'software'}>
                          {isPresencial ? 'Presencial' : 'Virtual'}
                        </Badge>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {sub?.name || 'Asignatura'}
                      </h4>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {sched.classroom || 'Aula por definir'}
                        </span>
                        <span>•</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {sub?.code || 'Cod'}
                        </span>
                      </div>
                    </div>

                    {/* Right Metric Pill: Leaves/Absences count (Inspo Image 3) */}
                    <div className="text-right shrink-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-lg space-y-0.5">
                      <div className="text-[9px] font-mono uppercase text-slate-400">Fallas</div>
                      <div className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                        {absences.length} / 4 máx
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ATTENDANCE & ABSENCE TRACKER VIEW (Inspo Image 1 & 3) */
        <div className="space-y-4">
          {/* Subject Selector Pills */}
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
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {sub.code || sub.name}
                </button>
              );
            })}
          </div>

          {activeSubject && (() => {
            const absences = absenceRecords[activeSubject.id!] || [];
            const allowedAbsences = 4; // Standard policy max absences
            const remainingAbsences = Math.max(0, allowedAbsences - absences.length);

            return (
              <div className="space-y-4">
                {/* 3 Metric Summary Cards (Inspo Image 3) */}
                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-3 text-center space-y-0.5">
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Permitidas</div>
                    <div className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                      0{allowedAbsences}
                    </div>
                  </Card>
                  <Card className="p-3 text-center space-y-0.5 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40">
                    <div className="text-[10px] font-mono text-rose-600 dark:text-rose-400">Fallas Hoy</div>
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

                {/* Interactive Attendance Month Calendar Grid (Inspo Image 1 & 3) */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading">
                      Registro de Asistencia — Agosto 2026
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400 italic">
                      Toca un día para marcar/desmarcar falla
                    </span>
                  </div>

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                  </div>

                  {/* Month Days Grid */}
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
                              : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
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
