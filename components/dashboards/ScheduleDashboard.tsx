import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  Clock,
  MapPin
} from 'lucide-react';
import { detectScheduleConflicts } from '@/lib/algorithms/conflict-detector';
import { filterSchedulesByDay, sortSchedulesByTime } from '@/lib/algorithms/schedule-mobile-transformer';

export const ScheduleDashboard: React.FC = () => {
  const { isLoaded, subjects, schedules, universities } = usePureData();
  const [selectedMobileDay, setSelectedMobileDay] = useState<number>(1); // 1 = Lunes

  if (!isLoaded) {
    return <div className="p-8 text-center text-slate-400 font-mono">Cargando horario...</div>;
  }

  const mappedSlots = schedules.map((s) => {
    const sub = subjects.find((sb) => sb.id === s.subject_id);
    const uni = universities.find((u) => u.id === sub?.university_id);
    return {
      id: s.id!,
      subjectName: sub?.name || 'Materia',
      universityName: uni?.name || 'Universidad',
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    };
  });

  const conflicts = detectScheduleConflicts(mappedSlots);
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const shortDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  const selectedDaySchedules = sortSchedulesByTime(filterSchedulesByDay(schedules, selectedMobileDay));

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Master Schedule & Matriz de Traslapes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vista semanal unificada con detector automático de empalmes entre materias.
          </p>
        </div>
      </div>

      {/* Conflict Warning Banner */}
      {conflicts.length > 0 && (
        <Card className="p-4 border border-rose-400 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="danger">⚠️ Traslape Detectado</Badge>
                  <span className="text-xs font-mono text-rose-600 dark:text-rose-300 font-bold">
                    Empalme de {conflicts[0].overlapMinutes} mins
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                  Conflicto entre <span className="text-sky-600 dark:text-sky-300">{conflicts[0].slotA.subjectName}</span> y <span className="text-indigo-600 dark:text-indigo-300">{conflicts[0].slotB.subjectName}</span>
                </h4>
              </div>
            </div>
          </div>
        </Card>
      )}

      {schedules.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <CalendarIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No hay horarios registrados</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Ve a la pestaña <strong>Configuración & CRUD</strong> para asignar los horarios (días, hora inicio/fin y aula) a tus materias.
          </p>
        </Card>
      ) : (
        <>
          {/* MOBILE VIEW: Day Selector + Agenda List (visible on screens < 640px) */}
          <div className="block sm:hidden space-y-4">
            {/* Day Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {shortDays.map((dayName, idx) => {
                const dayNum = idx + 1;
                const isSelected = selectedMobileDay === dayNum;
                const count = filterSchedulesByDay(schedules, dayNum).length;
                return (
                  <button
                    key={dayName}
                    onClick={() => setSelectedMobileDay(dayNum)}
                    className={`min-h-[44px] min-w-[54px] flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-lg shadow-sky-500/20'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <span>{dayName}</span>
                    {count > 0 && (
                      <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-slate-950 text-sky-400 font-bold' : 'bg-slate-700 text-slate-300'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile Day Agenda Cards */}
            <div className="space-y-3">
              <div className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between px-1">
                <span>Agenda de {days[selectedMobileDay - 1]}</span>
                <span>{selectedDaySchedules.length} clases</span>
              </div>

              {selectedDaySchedules.length === 0 ? (
                <div className="p-6 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-500 text-xs">
                  Sin clases programadas para este día 🎉
                </div>
              ) : (
                selectedDaySchedules.map((sched) => {
                  const sub = subjects.find((s) => s.id === sched.subject_id);
                  const isPresencial = sub?.modality === 'presencial';
                  return (
                    <Card key={sched.id} className="p-3.5 border-l-4 border-l-sky-500 bg-slate-900/60 flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="text-xs font-mono text-sky-400 font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{sched.start_time} - {sched.end_time}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100 truncate">{sub?.name || 'Materia'}</h4>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{sched.classroom || (isPresencial ? 'Presencial' : 'Virtual')}</span>
                        </div>
                      </div>
                      <Badge variant={isPresencial ? 'aeroespacial' : 'software'} className="shrink-0">
                        {sub?.code || (isPresencial ? 'Presencial' : 'Virtual')}
                      </Badge>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* DESKTOP VIEW: Full 7-Day Matrix Table (visible on screens >= 640px) */}
          <div className="hidden sm:block bg-white dark:bg-slate-950 rounded-xl overflow-x-auto border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 font-mono">
                  <th className="p-3 text-center w-20 border-r border-slate-200 dark:border-slate-800">Hora</th>
                  {days.map((day) => (
                    <th key={day} className="p-3 text-center border-r border-slate-200 dark:border-slate-800/80 last:border-r-0">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                {hours.map((hour) => (
                  <tr key={hour} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                    <td className="p-2.5 font-mono text-center text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                      {hour}
                    </td>
                    {days.map((day, dIdx) => {
                      const dayNum = dIdx + 1; // 1 = Lunes
                      const matchingSchedules = schedules.filter(
                        (s) => s.day_of_week === dayNum && s.start_time <= hour && s.end_time > hour
                      );

                      const hasConflict = matchingSchedules.length > 1;

                      return (
                        <td key={dIdx} className="p-1 border-r border-slate-200 dark:border-slate-800/40 last:border-r-0 align-top h-14">
                          {hasConflict ? (
                            <div className="p-1.5 rounded bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/80 text-rose-800 dark:text-rose-200 space-y-0.5">
                              <div className="font-bold text-[10px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> EMPALME
                              </div>
                              <div className="text-[9px] truncate">{matchingSchedules[0]?.classroom || 'Conflicto'}</div>
                            </div>
                          ) : (
                            matchingSchedules.map((sched) => {
                              const sub = subjects.find((sb) => sb.id === sched.subject_id);
                              const isPresencial = sub?.modality === 'presencial';
                              return (
                                <div
                                  key={sched.id}
                                  className={`p-1.5 rounded text-xs space-y-0.5 border ${
                                    isPresencial
                                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-600/50 text-sky-900 dark:text-sky-200'
                                      : 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-600/50 text-indigo-900 dark:text-indigo-200'
                                  }`}
                                >
                                  <div className="font-bold text-[11px] truncate">{sub?.name || 'Clase'}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                                    {isPresencial ? <MapPin className="w-2.5 h-2.5 shrink-0" /> : <Clock className="w-2.5 h-2.5 shrink-0" />}
                                    <span className="truncate">{sched.classroom || (isPresencial ? 'Presencial' : 'Virtual')}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
