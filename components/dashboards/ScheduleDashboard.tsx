import React, { useState, useEffect } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MobileScheduleTimeline } from '@/components/dashboards/MobileScheduleTimeline';
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Grid,
  List
} from 'lucide-react';
import { detectScheduleConflicts } from '@/lib/algorithms/conflict-detector';
import { filterSchedulesByDay, sortSchedulesByTime } from '@/lib/algorithms/schedule-mobile-transformer';
import { ScheduleSchema, validateEntity } from '@/lib/validations/schemas';
import { pureDB, ScheduleEntity } from '@/lib/db/dexie-schema';

const getTodayDayOfWeek = (): number => {
  const d = new Date().getDay();
  return d === 0 ? 7 : d; // Convert Sunday (0) to 7
};

export const ScheduleDashboard: React.FC = () => {
  const { isLoaded, subjects, schedules, universities } = usePureData();

  // Today & Live Time State
  const todayNum = getTodayDayOfWeek();
  const [selectedMobileDay, setSelectedMobileDay] = useState<number>(todayNum);
  const [mobileViewMode, setMobileViewMode] = useState<'timeline' | 'grid' | 'list'>('timeline');
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(timer);
  }, []);

  const currentHourNum = now.getHours();
  const currentMinNum = now.getMinutes();
  const currentHourStr = String(currentHourNum).padStart(2, '0');
  const currentMinStr = String(currentMinNum).padStart(2, '0');
  const currentTimeFormatted = `${currentHourStr}:${currentMinStr}`;

  // Modal State for Schedule Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedId, setEditingSchedId] = useState<string | null>(null);
  const [schedSubjectId, setSchedSubjectId] = useState('');
  const [schedDay, setSchedDay] = useState<number>(todayNum);
  const [schedStart, setSchedStart] = useState('08:00');
  const [schedEnd, setSchedEnd] = useState('10:00');
  const [schedClassroom, setSchedClassroom] = useState('');
  const [schedErrors, setSchedErrors] = useState<Record<string, string>>({});

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

  const gridHours = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00'
  ];

  const selectedDaySchedules = sortSchedulesByTime(filterSchedulesByDay(schedules, selectedMobileDay));

  const handlePrevDay = () => {
    setSelectedMobileDay((prev) => (prev > 1 ? prev - 1 : 7));
  };

  const handleNextDay = () => {
    setSelectedMobileDay((prev) => (prev < 7 ? prev + 1 : 1));
  };

  const handleGoToday = () => {
    setSelectedMobileDay(todayNum);
  };

  const handleOpenAddSchedule = () => {
    setEditingSchedId(null);
    setSchedSubjectId(subjects[0]?.id || '');
    setSchedDay(selectedMobileDay);
    setSchedStart('08:00');
    setSchedEnd('10:00');
    setSchedClassroom('');
    setSchedErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditSchedule = (sched: ScheduleEntity) => {
    setEditingSchedId(sched.id!);
    setSchedSubjectId(sched.subject_id);
    setSchedDay(sched.day_of_week);
    setSchedStart(sched.start_time);
    setSchedEnd(sched.end_time);
    setSchedClassroom(sched.classroom || '');
    setSchedErrors({});
    setIsModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    const schedData = {
      subject_id: schedSubjectId,
      day_of_week: Number(schedDay),
      start_time: schedStart,
      end_time: schedEnd,
      classroom: schedClassroom || 'Aula por definir',
    };

    const validation = validateEntity(ScheduleSchema, schedData);
    if (!validation.success) {
      setSchedErrors(validation.errors);
      return;
    }

    setSchedErrors({});
    if (editingSchedId) {
      await pureDB.schedules.update(editingSchedId, validation.data);
    } else {
      await pureDB.schedules.add({
        ...validation.data,
        created_at: new Date().toISOString(),
      });
    }

    setIsModalOpen(false);
  };

  const handleDeleteSchedule = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await pureDB.schedules.delete(id);
  };

  const parseTimeToMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const gridStartMins = 6 * 60; // 06:00
  const hourRowHeight = 60; // 60px por hora

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-sky-500 transition-colors';

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 font-heading tracking-tight">
            <CalendarIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Master Schedule & Matriz de Traslapes
          </h2>
        </div>
        <Button variant="aeroespacial" onClick={handleOpenAddSchedule} className="shrink-0 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Asignar Horario
        </Button>
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
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto mb-4">
            Asigna días, horas inicio/fin y aulas a tus materias registradas.
          </p>
          <Button variant="aeroespacial" onClick={handleOpenAddSchedule} className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Asignar Primer Horario
          </Button>
        </Card>
      ) : (
        <>
          {/* MOBILE VIEW: Interactive Mobile Schedule Timeline (< 640px) */}
          <div className="block sm:hidden">
            <MobileScheduleTimeline />
          </div>

          {/* DESKTOP VIEW: Full 7-Day Matrix Table (visible on screens >= 640px) */}
          <div className="hidden sm:block bg-white dark:bg-slate-950 rounded-xl overflow-x-auto border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">

            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 font-mono">
                  <th className="p-3 text-center w-20 border-r border-slate-200 dark:border-slate-800">Hora</th>
                  {days.map((day, dIdx) => {
                    const dayNum = dIdx + 1;
                    const isToday = todayNum === dayNum;
                    return (
                      <th
                        key={day}
                        className={`p-3 text-center border-r border-slate-200 dark:border-slate-800/80 last:border-r-0 relative ${
                          isToday ? 'bg-sky-500/15 dark:bg-sky-500/20 font-bold text-sky-600 dark:text-sky-300' : ''
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{day}</span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500 text-white rounded-full shadow-sm animate-pulse">
                              HOY
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                {hours.map((hour) => {
                  const hourInt = parseInt(hour.split(':')[0], 10);
                  const isCurrentHourRow = currentHourNum === hourInt;

                  return (
                    <tr key={hour} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="p-2.5 font-mono text-center text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                        {hour}
                      </td>
                      {days.map((day, dIdx) => {
                        const dayNum = dIdx + 1; // 1 = Lunes
                        const isTodayColumn = todayNum === dayNum;
                        const showLiveTimeLine = isTodayColumn && isCurrentHourRow;
                        const topPercentage = (currentMinNum / 60) * 100;

                        const matchingSchedules = schedules.filter(
                          (s) => s.day_of_week === dayNum && s.start_time <= hour && s.end_time > hour
                        );

                        const hasConflict = matchingSchedules.length > 1;

                        return (
                          <td
                            key={dIdx}
                            className={`p-1 border-r border-slate-200 dark:border-slate-800/40 last:border-r-0 align-top h-16 relative ${
                              isTodayColumn ? 'bg-sky-500/[0.03] dark:bg-sky-500/[0.05]' : ''
                            }`}
                          >
                            {/* Live Current Time Line Indicator */}
                            {showLiveTimeLine && (
                              <div
                                className="absolute left-0 right-0 z-30 flex items-center pointer-events-none"
                                style={{ top: `${Math.min(Math.max(topPercentage, 5), 95)}%` }}
                              >
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-md shadow-rose-500/80 -ml-1 shrink-0 animate-ping" />
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-md shadow-rose-500/80 -ml-2.5 shrink-0" />
                                <div className="h-[2px] w-full bg-rose-500 shadow-sm shadow-rose-500/80" />
                                <span className="text-[9px] font-mono font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded ml-1 shadow-md shrink-0">
                                  {currentTimeFormatted}
                                </span>
                              </div>
                            )}

                            {hasConflict ? (
                              <div
                                onClick={() => handleOpenEditSchedule(matchingSchedules[0])}
                                className="p-1.5 rounded bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/80 text-rose-800 dark:text-rose-200 space-y-0.5 cursor-pointer hover:scale-[1.02] transition-transform"
                              >
                                <div className="font-bold text-[10px] flex items-center justify-between">
                                  <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> EMPALME</span>
                                  <Pencil className="w-3 h-3 text-rose-500" />
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
                                    onClick={() => handleOpenEditSchedule(sched)}
                                    className={`p-1.5 rounded text-xs space-y-0.5 border cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all group ${
                                      isPresencial
                                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-600/50 text-sky-900 dark:text-sky-200'
                                        : 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-600/50 text-indigo-900 dark:text-indigo-200'
                                    }`}
                                  >
                                    <div className="font-bold text-[11px] flex items-center justify-between">
                                      <span className="truncate">{sub?.name || 'Clase'}</span>
                                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 text-sky-400 transition-opacity shrink-0" />
                                    </div>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal Add / Edit Schedule */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSchedId ? 'Editar Horario de Clase' : 'Asignar Horario a Materia'}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Asignatura</label>
            <select
              value={schedSubjectId}
              onChange={(e) => setSchedSubjectId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona una asignatura</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            {schedErrors.subject_id && <p className="text-xs text-rose-500 font-medium mt-1">{schedErrors.subject_id}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Día</label>
              <select
                value={schedDay}
                onChange={(e) => setSchedDay(Number(e.target.value))}
                className={inputClass}
              >
                <option value={1}>Lunes</option>
                <option value={2}>Martes</option>
                <option value={3}>Miércoles</option>
                <option value={4}>Jueves</option>
                <option value={5}>Viernes</option>
                <option value={6}>Sábado</option>
                <option value={7}>Domingo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Hora Inicio</label>
              <input
                type="text"
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
                className={inputClass}
                placeholder="08:00"
              />
              {schedErrors.start_time && <p className="text-xs text-rose-500 font-medium mt-1">{schedErrors.start_time}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Hora Fin</label>
              <input
                type="text"
                value={schedEnd}
                onChange={(e) => setSchedEnd(e.target.value)}
                className={inputClass}
                placeholder="10:00"
              />
              {schedErrors.end_time && <p className="text-xs text-rose-500 font-medium mt-1">{schedErrors.end_time}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Aula / Salón / Enlace</label>
            <input
              type="text"
              value={schedClassroom}
              onChange={(e) => setSchedClassroom(e.target.value)}
              className={inputClass}
              placeholder="Ej: Salón 301 - Edificio Tecnológico"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="aeroespacial" onClick={handleSaveSchedule}>
              {editingSchedId ? 'Guardar Cambios' : 'Guardar Horario'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
