import React, { useState } from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { UpcomingDeliverables } from '@/components/ui/UpcomingDeliverables';
import { useCalendarState } from '@/lib/hooks/useCalendarState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SubjectDetailsModal } from '@/components/ui/SubjectDetailsModal';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  AlertTriangle,
  Pencil,
  Plus,
  Info,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import {
  detectScheduleConflicts,
  getSabadoTypeForDate,
  occursOnSabadoVariant,
  ScheduleSlot,
} from '@/lib/algorithms/conflict-detector';
import { ScheduleSchema, validateEntity } from '@/lib/validations/schemas';
import { ScheduleEntity, DeliverableEntity } from '@/lib/db/dexie-schema';
import { saveSchedule, deleteSchedule } from '@/lib/db/repository';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

const SHORT_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

const formatTimeRange = (start: string, end: string): string => {
  return `${start} - ${end}`;
};

const getDeliverablesForDate = (deliverables: DeliverableEntity[], date: Date): DeliverableEntity[] => {
  return deliverables.filter(d => {
    const dDate = new Date(d.due_date);
    return dDate.getFullYear() === date.getFullYear() &&
           dDate.getMonth() === date.getMonth() &&
           dDate.getDate() === date.getDate();
  });
};

const isDeliverableOverdue = (deliverable: DeliverableEntity): boolean => {
  if (deliverable.status !== 'pendiente') return false;
  const dDate = new Date(deliverable.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dDate.setHours(0, 0, 0, 0);
  return dDate < today;
};

export const CalendarView: React.FC = () => {
  const { isLoaded, universities, subjects, schedules, professors, classSessions, deliverables } = usePureData();
  const calendarState = useCalendarState(new Date(), 'week');
  const { viewMode, displayDate, setViewMode, setDisplayDate, goNext, goPrev, goToday } = calendarState;

  // Selected schedule for details/editing modal
  const [selectedSched, setSelectedSched] = useState<ScheduleEntity | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // Tocar un bloque abre primero la ficha de la clase; editar es una acción explícita.
  const [detailsSched, setDetailsSched] = useState<ScheduleEntity | null>(null);

  // Form state for add/edit schedule modal
  const [schedSubjectId, setSchedSubjectId] = useState('');
  const [schedDay, setSchedDay] = useState<number>(1);
  const [schedStart, setSchedStart] = useState('08:00');
  const [schedEnd, setSchedEnd] = useState('10:00');
  const [schedClassroom, setSchedClassroom] = useState('');
  const [schedPeriodicity, setSchedPeriodicity] = useState<'semanal' | 'sabado_a' | 'sabado_b'>('semanal');
  const [schedErrors, setSchedErrors] = useState<Record<string, string>>({});

  // Tooltip hover state for month view
  const [hoveredSlot, setHoveredSlot] = useState<{
    slot: ScheduleSlot;
    x: number;
    y: number;
  } | null>(null);

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse pb-4" role="status" aria-label="Cargando calendario">
        <div className="h-14 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="h-96 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  // Mapped slots for conflict detection & Sábado variants
  const mappedSlots: ScheduleSlot[] = schedules.map((s) => {
    const sub = subjects.find((sb) => sb.id === s.subject_id);
    const uni = universities.find((u) => u.id === sub?.university_id);
    return {
      id: s.id!,
      subjectName: sub?.name || 'Materia',
      universityName: uni?.name || 'Universidad',
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      classroom: s.classroom,
      periodicity: s.periodicity,
      has_alternating_saturdays: uni?.has_alternating_saturdays,
    };
  });

  const conflicts = detectScheduleConflicts(mappedSlots);
  const mainUni = universities.find((u) => u.has_alternating_saturdays) || universities[0];
  const anchorDateStr = mainUni?.first_sabado_a_date || '2026-08-01';

  // Format header label based on active view mode
  const getHeaderDateLabel = () => {
    const y = displayDate.getFullYear();
    const m = displayDate.getMonth();
    const d = displayDate.getDate();

    if (viewMode === 'day') {
      const dayName = DAY_NAMES[displayDate.getDay()];
      return `${dayName}, ${d} de ${MONTH_NAMES[m]} de ${y}`;
    }

    if (viewMode === 'week') {
      const dayOfWeek = displayDate.getDay();
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      const monday = new Date(displayDate);
      monday.setDate(d - (isoDay - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const monMonth = monday.getMonth();
      const sunMonth = sunday.getMonth();

      if (monMonth === sunMonth) {
        return `${monday.getDate()} - ${sunday.getDate()} de ${MONTH_NAMES[monMonth]} de ${y}`;
      }
      return `${monday.getDate()} ${MONTH_NAMES[monMonth]} - ${sunday.getDate()} ${MONTH_NAMES[sunMonth]} de ${y}`;
    }

    // Month view
    return `${MONTH_NAMES[m]} ${y}`;
  };

  // Helper to open Add modal
  const handleOpenAdd = (defaultDay = 1) => {
    setSelectedSched(null);
    setSchedSubjectId(subjects[0]?.id || '');
    setSchedDay(defaultDay);
    setSchedStart('08:00');
    setSchedEnd('10:00');
    setSchedClassroom('');
    setSchedPeriodicity('semanal');
    setSchedErrors({});
    setIsAddModalOpen(true);
  };

  // Ficha de la clase: qué materia es, con quién, dónde y cuándo. Desde ahí se edita.
  const handleOpenDetails = (sched: ScheduleEntity) => {
    setDetailsSched(sched);
  };

  // Helper to open Edit modal
  const handleOpenEdit = (sched: ScheduleEntity) => {
    setSelectedSched(sched);
    setSchedSubjectId(sched.subject_id);
    setSchedDay(sched.day_of_week);
    setSchedStart(sched.start_time);
    setSchedEnd(sched.end_time);
    setSchedClassroom(sched.classroom || '');
    setSchedPeriodicity(sched.periodicity || 'semanal');
    setSchedErrors({});
    setIsEditModalOpen(true);
  };

  // Save schedule logic
  const handleSaveSchedule = async () => {
    const schedData = {
      subject_id: schedSubjectId,
      day_of_week: Number(schedDay),
      start_time: schedStart,
      end_time: schedEnd,
      classroom: schedClassroom || 'Aula por definir',
      periodicity: Number(schedDay) === 6 ? schedPeriodicity : 'semanal',
    };

    const validation = validateEntity(ScheduleSchema, schedData);
    if (!validation.success) {
      setSchedErrors(validation.errors);
      return;
    }

    setSchedErrors({});
    if (selectedSched && selectedSched.id) {
      await saveSchedule({
        ...validation.data,
        id: selectedSched.id,
      });
    } else {
      await saveSchedule(validation.data);
    }

    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedSched(null);
  };

  const handleDeleteSchedule = async (id: string) => {
    await deleteSchedule(id);
    setIsEditModalOpen(false);
    setSelectedSched(null);
  };

  // Hours array 06:00 to 22:00
  const gridHours = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00'
  ];

  // University helper
  const getSubject = (subjectId: string) => subjects.find((sb) => sb.id === subjectId);
  const getUniversityBySubjectId = (subjectId: string) => {
    const sub = getSubject(subjectId);
    return universities.find((u) => u.id === sub?.university_id);
  };
  const getProfessorBySubjectId = (subjectId: string) => {
    const sub = getSubject(subjectId);
    return professors.find((p) => p.id === sub?.professor_id);
  };

  const inputClass =
    'w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 transition-colors';

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* 1. Control Superior (Top Bar Controls) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Left: View Mode Switcher */}
        <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'day'
                ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'week'
                ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'month'
                ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Mes
          </button>
        </div>

        {/* Center: Navigation Controls & Current Date Label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goPrev} aria-label="Anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goNext} aria-label="Siguiente">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={goToday} className="text-xs border border-slate-300 dark:border-slate-700">
            Hoy
          </Button>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-heading tracking-tight capitalize ml-2">
            {getHeaderDateLabel()}
          </h2>
        </div>

        {/* Right: Add Schedule Button */}
        <Button variant="aeroespacial" onClick={() => handleOpenAdd(1)} className="flex items-center gap-1.5 text-xs shrink-0">
          <Plus className="w-4 h-4" /> Asignar Horario
        </Button>
      </div>

      {/* Próximas entregas — lo primero: qué hay que entregar antes que qué clase toca */}
      <UpcomingDeliverables
        deliverables={deliverables}
        subjects={subjects}
        onSelect={(d) => {
          setDisplayDate(new Date(d.due_date));
          setViewMode('day');
        }}
      />

      {/* Conflict Warning Banner */}
      {conflicts.length > 0 && (
        <Card className="p-4 border border-rose-400 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="danger">Traslape Detectado</Badge>
                <span className="text-xs font-mono text-rose-600 dark:text-rose-300 font-bold">
                  Empalme de {conflicts[0].overlapMinutes} mins
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                Conflicto entre <span className="text-aeroespacial">{conflicts[0].slotA.subjectName}</span> y <span className="text-software">{conflicts[0].slotB.subjectName}</span>
              </h4>
            </div>
          </div>
        </Card>
      )}

      {/* 2. Vista "Día" (Day View) */}
      {viewMode === 'day' && (
        <div className="bg-surface rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
          {(() => {
            const rawDay = displayDate.getDay();
            const dayNum = rawDay === 0 ? 7 : rawDay;
            const sabadoType = getSabadoTypeForDate(displayDate, anchorDateStr);
            const isSabado = dayNum === 6;

            // Filter schedules active on this specific date
            const daySchedules = schedules.filter((s) => {
              if (s.day_of_week !== dayNum) return false;
              if (isSabado) {
                const sub = getSubject(s.subject_id);
                const uni = universities.find((u) => u.id === sub?.university_id);
                return occursOnSabadoVariant(
                  { classroom: s.classroom, periodicity: s.periodicity, has_alternating_saturdays: uni?.has_alternating_saturdays },
                  sabadoType
                );
              }
              return true;
            });

            const hourRowHeight = 50; // px height per hour row

            return (
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {DAY_NAMES[displayDate.getDay()]} ({daySchedules.length} {daySchedules.length === 1 ? 'clase' : 'clases'})
                    </span>
                    {isSabado && (
                      <Badge variant="aeroespacial" className="uppercase text-[10px]">
                        {sabadoType === 'sabado_a' ? 'Sábado A' : 'Sábado B'}
                      </Badge>
                    )}
                  </div>
                  {displayDate.toDateString() === new Date().toDateString() && (
                    <Badge variant="synergy" className="animate-pulse text-[10px]">
                      HOY
                    </Badge>
                  )}
                </div>

                {/* Deliverables Section */}
                {(() => {
                  const dayDeliverables = getDeliverablesForDate(deliverables, displayDate);
                  if (dayDeliverables.length === 0) return null;

                  return (
                    <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Entregas Pendientes ({dayDeliverables.length})
                      </h3>
                      <div className="space-y-2">
                        {dayDeliverables.map((d) => {
                          const subject = getSubject(d.subject_id);
                          const isOverdue = isDeliverableOverdue(d);

                          let statusBg = '';
                          let statusText = '';

                          if (isOverdue) {
                            statusBg = 'bg-red-100 dark:bg-red-900/30';
                            statusText = 'text-red-700 dark:text-red-300';
                          } else if (d.status === 'pendiente') {
                            statusBg = 'bg-amber-100 dark:bg-amber-900/30';
                            statusText = 'text-amber-700 dark:text-amber-300';
                          } else if (d.status === 'entregado') {
                            statusBg = 'bg-cyan-100 dark:bg-cyan-900/30';
                            statusText = 'text-cyan-700 dark:text-cyan-300';
                          } else if (d.status === 'calificado') {
                            statusBg = 'bg-emerald-100 dark:bg-emerald-900/30';
                            statusText = 'text-emerald-700 dark:text-emerald-300';
                          }

                          return (
                            <div
                              key={d.id}
                              className={`p-2 rounded border ${statusBg} border-current/20`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex-1">
                                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {d.title}
                                  </div>
                                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                    {subject?.name || 'Materia'}
                                  </div>
                                </div>
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${statusText}`}>
                                  {d.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-600 dark:text-slate-400">
                                {d.type && (
                                  <span className="capitalize">{d.type}</span>
                                )}
                                {d.weight_percentage && (
                                  <span>{d.weight_percentage}%</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Timeline Container */}
                <div className="relative border-l border-slate-200 dark:border-slate-800 ml-16 min-h-[850px]">
                  {gridHours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-b border-slate-100 dark:border-slate-900 flex items-center"
                      style={{ top: `${i * hourRowHeight}px`, height: `${hourRowHeight}px` }}
                    >
                      <span className="absolute -left-14 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {h}
                      </span>
                    </div>
                  ))}

                  {/* Render Day Class Blocks */}
                  {daySchedules.map((s) => {
                    const sub = getSubject(s.subject_id);
                    const isPresencial = sub?.modality === 'presencial';
                    const startMins = timeToMinutes(s.start_time) - 6 * 60;
                    const endMins = timeToMinutes(s.end_time) - 6 * 60;
                    const topPx = (startMins / 60) * hourRowHeight;
                    const heightPx = Math.max(((endMins - startMins) / 60) * hourRowHeight, 36);

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleOpenDetails(s)}
                        style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                        className={`absolute left-2 right-2 rounded-lg p-2.5 border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg z-10 flex flex-col justify-between group ${
                          isPresencial
                            ? 'bg-sky-50/90 dark:bg-sky-950/70 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-100'
                            : 'bg-indigo-50/90 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-100'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold font-heading block truncate">
                              {sub?.name || 'Clase'}
                            </span>
                            <span className="text-[11px] opacity-80 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 shrink-0" />
                              {formatTimeRange(s.start_time, s.end_time)}
                            </span>
                          </div>
                          <Info className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-sky-500 shrink-0" />
                        </div>
                        <div className="text-[10px] opacity-75 flex items-center gap-1 truncate mt-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{s.classroom || 'Sin aula definida'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 3. Vista "Semana" (Week View - Default) */}
      {viewMode === 'week' && (
        <div className="bg-surface rounded-xl overflow-x-auto border border-slate-200 dark:border-slate-800 shadow-sm">
          {(() => {
            const dayOfWeek = displayDate.getDay();
            const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
            const monday = new Date(displayDate);
            monday.setDate(displayDate.getDate() - (isoDay - 1));

            // Generate 7 days of week
            const weekDays = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + i);
              return d;
            });

            const hasAlternatingSaturdays = universities.some((u) => u.has_alternating_saturdays);

            return (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 font-mono">
                    <th className="p-3 text-center w-20 border-r border-slate-200 dark:border-slate-800">Hora</th>
                    {weekDays.map((date, index) => {
                      const dayNum = index + 1;
                      const isToday = date.toDateString() === new Date().toDateString();
                      const sabadoType = getSabadoTypeForDate(date, anchorDateStr);
                      const isSabado = dayNum === 6;

                      return (
                        <th
                          key={date.toISOString()}
                          className={`p-3 text-center border-r border-slate-200 dark:border-slate-800/80 last:border-r-0 relative ${
                            isToday ? 'bg-sky-500/15 dark:bg-sky-500/20 font-bold text-aeroespacial' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              {SHORT_DAYS[index]}
                            </span>
                            <span className="text-sm font-bold">{date.getDate()}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500 text-white rounded-full shadow-sm animate-pulse mt-0.5">
                                HOY
                              </span>
                            )}
                            {isSabado && hasAlternatingSaturdays && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-sky-100 dark:bg-sky-900/60 text-aeroespacial rounded mt-0.5">
                                {sabadoType === 'sabado_a' ? 'SÁBADO A' : 'SÁBADO B'}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>

                  {/* Deliverables Banner Row */}
                  <tr className="border-b border-slate-200/30 dark:border-slate-800/20 bg-slate-50/30 dark:bg-slate-900/15">
                    <td className="p-2.5 border-r border-slate-200/30 dark:border-slate-800/20" />
                    {weekDays.map((date) => {
                      const dayDeliverables = getDeliverablesForDate(deliverables, date);
                      const visibleCount = Math.min(dayDeliverables.length, 2);
                      const moreCount = dayDeliverables.length - visibleCount;

                      return (
                        <td
                          key={`deliverables-${date.toISOString()}`}
                          className="p-2 border-r border-slate-200/30 dark:border-slate-800/20 last:border-r-0"
                        >
                          {dayDeliverables.length > 0 ? (
                            <div className="space-y-0.5">
                              {dayDeliverables.slice(0, visibleCount).map((d) => {
                                const isOverdue = isDeliverableOverdue(d);
                                let dotColor = 'bg-amber-400';

                                if (isOverdue) {
                                  dotColor = 'bg-red-500';
                                } else if (d.status === 'entregado') {
                                  dotColor = 'bg-cyan-400';
                                } else if (d.status === 'calificado') {
                                  dotColor = 'bg-emerald-500';
                                }

                                return (
                                  <div key={d.id} className="flex items-center gap-1 text-[9px]">
                                    <div className={`w-1 h-1 rounded-full ${dotColor} shrink-0`} />
                                    <span className="text-slate-600 dark:text-slate-400 truncate flex-1">
                                      {d.title}
                                    </span>
                                  </div>
                                );
                              })}
                              {moreCount > 0 && (
                                <div className="text-[8px] text-slate-500 dark:text-slate-500 px-0.5">
                                  +{moreCount}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800/20 text-xs">
                  {gridHours.map((hour) => {
                    return (
                      <tr key={hour} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="p-2.5 font-mono text-center text-slate-500 dark:text-slate-400 border-r border-slate-200/30 dark:border-slate-800/20 bg-slate-50/30 dark:bg-slate-900/20">
                          {hour}
                        </td>
                        {weekDays.map((date, index) => {
                          const dayNum = index + 1;
                          const isToday = date.toDateString() === new Date().toDateString();
                          const sabadoType = getSabadoTypeForDate(date, anchorDateStr);

                          const matchingSchedules = schedules.filter((s) => {
                            if (s.day_of_week !== dayNum) return false;
                            if (!(s.start_time <= hour && s.end_time > hour)) return false;
                            if (dayNum === 6) {
                              const sub = getSubject(s.subject_id);
                              const uni = universities.find((u) => u.id === sub?.university_id);
                              return occursOnSabadoVariant(
                                { classroom: s.classroom, periodicity: s.periodicity, has_alternating_saturdays: uni?.has_alternating_saturdays },
                                sabadoType
                              );
                            }
                            return true;
                          });

                          const hasConflict = matchingSchedules.length > 1;

                          return (
                            <td
                              key={date.toISOString()}
                              className={`p-1 border-r border-slate-200/30 dark:border-slate-800/20 last:border-r-0 align-top h-16 relative ${
                                isToday ? 'bg-sky-500/[0.03] dark:bg-sky-500/[0.05]' : ''
                              }`}
                            >
                              {hasConflict ? (
                                <div
                                  onClick={() => handleOpenDetails(matchingSchedules[0])}
                                  className="p-1.5 rounded bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/80 text-rose-800 dark:text-rose-200 space-y-0.5 cursor-pointer hover:scale-[1.02] transition-transform"
                                >
                                  <div className="font-bold text-[10px] flex items-center justify-between">
                                    <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> EMPALME</span>
                                    <Pencil className="w-3 h-3 text-rose-500" />
                                  </div>
                                  <div className="text-[9px] leading-snug">
                                    {matchingSchedules
                                      .map((s) => getSubject(s.subject_id)?.name || 'Clase')
                                      .join(' / ')}
                                  </div>
                                </div>
                              ) : (
                                matchingSchedules.map((sched) => {
                                  const sub = getSubject(sched.subject_id);
                                  const isPresencial = sub?.modality === 'presencial';
                                  return (
                                    <div
                                      key={sched.id}
                                      onClick={() => handleOpenDetails(sched)}
                                      className={`p-1.5 rounded text-xs space-y-0.5 border cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all group ${
                                        isPresencial
                                          ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-200/50 dark:border-sky-600/30 text-sky-900 dark:text-sky-200'
                                          : 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200/50 dark:border-indigo-600/30 text-indigo-900 dark:text-indigo-200'
                                      }`}
                                    >
                                      <div className="font-bold text-[11px] flex items-center justify-between">
                                        <span className="truncate">{sub?.name || 'Clase'}</span>
                                        <Info className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity shrink-0" />
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
            );
          })()}
        </div>
      )}

      {/* 4. Vista "Mes" (Month View) */}
      {viewMode === 'month' && (
        <div className="bg-surface rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {(() => {
            const year = displayDate.getFullYear();
            const month = displayDate.getMonth();

            // First day of target month
            const firstDayOfMonth = new Date(year, month, 1);
            const startDayRaw = firstDayOfMonth.getDay();
            const startIsoDay = startDayRaw === 0 ? 7 : startDayRaw;

            // Grid start date (Monday preceding or on the 1st)
            const gridStart = new Date(year, month, 1 - (startIsoDay - 1));

            // Generate 35 or 42 grid cells
            const gridDays: Date[] = [];
            for (let i = 0; i < 35; i++) {
              const d = new Date(gridStart);
              d.setDate(gridStart.getDate() + i);
              gridDays.push(d);
            }

            // If the 35th day is still within the target month, expand to 42 cells (6 weeks)
            if (gridDays[34].getMonth() === month && gridDays[34].getDate() < new Date(year, month + 1, 0).getDate()) {
              for (let i = 35; i < 42; i++) {
                const d = new Date(gridStart);
                d.setDate(gridStart.getDate() + i);
                gridDays.push(d);
              }
            }

            return (
              <div>
                {/* Headers (Lun-Dom) */}
                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 text-xs font-mono text-slate-700 dark:text-slate-300 font-bold text-center py-2.5">
                  {SHORT_DAYS.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                {/* Month Grid Cells */}
                <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800/80">
                  {gridDays.map((cellDate) => {
                    const isCurrentMonth = cellDate.getMonth() === month;
                    const isToday = cellDate.toDateString() === new Date().toDateString();
                    const rawCellDay = cellDate.getDay();
                    const cellIsoDay = rawCellDay === 0 ? 7 : rawCellDay;
                    const sabadoType = getSabadoTypeForDate(cellDate, anchorDateStr);

                    // Filter schedules occurring on this date
                    const cellSchedules = schedules.filter((s) => {
                      if (s.day_of_week !== cellIsoDay) return false;
                      if (cellIsoDay === 6) {
                        const sub = getSubject(s.subject_id);
                        const uni = universities.find((u) => u.id === sub?.university_id);
                        return occursOnSabadoVariant(
                          { classroom: s.classroom, periodicity: s.periodicity, has_alternating_saturdays: uni?.has_alternating_saturdays },
                          sabadoType
                        );
                      }
                      return true;
                    });

                    return (
                      <div
                        key={cellDate.toISOString()}
                        onClick={() => {
                          setDisplayDate(cellDate);
                          setViewMode('day');
                        }}
                        className={`min-h-[110px] p-1.5 transition-colors cursor-pointer relative group flex flex-col justify-start ${
                          isCurrentMonth
                            ? 'bg-surface hover:bg-slate-50 dark:hover:bg-slate-900/40'
                            : 'bg-slate-50/50 dark:bg-slate-900/20 text-slate-400 dark:text-slate-600'
                        } ${isToday ? 'bg-sky-500/[0.04] dark:bg-sky-500/[0.08]' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                              isToday
                                ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm font-extrabold'
                                : isCurrentMonth
                                ? 'text-slate-800 dark:text-slate-200'
                                : 'text-slate-400 dark:text-slate-600'
                            }`}
                          >
                            {cellDate.getDate()}
                          </span>
                          {cellIsoDay === 6 && isCurrentMonth && (
                            <span className="text-[9px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {sabadoType === 'sabado_a' ? 'Sáb A' : 'Sáb B'}
                            </span>
                          )}
                        </div>

                        {/* Mini pills list */}
                        <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-none">
                          {cellSchedules.map((s) => {
                            const sub = getSubject(s.subject_id);
                            const isPresencial = sub?.modality === 'presencial';
                            const mappedSlot = mappedSlots.find((ms) => ms.id === s.id);

                            return (
                              <div
                                key={s.id}
                                onMouseEnter={(e) => {
                                  if (mappedSlot) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setHoveredSlot({
                                      slot: mappedSlot,
                                      x: rect.left + rect.width / 2,
                                      y: rect.top - 8,
                                    });
                                  }
                                }}
                                onMouseLeave={() => setHoveredSlot(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetails(s);
                                }}
                                className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border flex items-center justify-between group/pill ${
                                  isPresencial
                                    ? 'bg-sky-50 dark:bg-sky-950/80 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200'
                                    : 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                                }`}
                              >
                                <span className="truncate">{sub?.name || 'Clase'}</span>
                                <span className="text-[9px] opacity-75 font-mono ml-1 shrink-0">
                                  {s.start_time}
                                </span>
                              </div>
                            );
                          })}

                          {/* Deliverables Pills */}
                          {(() => {
                            const cellDeliverables = getDeliverablesForDate(deliverables, cellDate);
                            return cellDeliverables.map((d) => {
                              const _subject = getSubject(d.subject_id);
                              const isOverdue = isDeliverableOverdue(d);

                              let bgClass = '';
                              let textClass = '';

                              if (isOverdue) {
                                bgClass = 'bg-red-100 dark:bg-red-900/30';
                                textClass = 'text-red-700 dark:text-red-300';
                              } else if (d.status === 'pendiente') {
                                bgClass = 'bg-amber-100 dark:bg-amber-900/30';
                                textClass = 'text-amber-700 dark:text-amber-300';
                              } else if (d.status === 'entregado') {
                                bgClass = 'bg-cyan-100 dark:bg-cyan-900/30';
                                textClass = 'text-cyan-700 dark:text-cyan-300';
                              } else if (d.status === 'calificado') {
                                bgClass = 'bg-emerald-100 dark:bg-emerald-900/30';
                                textClass = 'text-emerald-700 dark:text-emerald-300';
                              }

                              return (
                                <div
                                  key={d.id}
                                  className={`text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium border ${bgClass} ${textClass} flex items-center gap-1 border-current/20`}
                                >
                                  {isOverdue ? (
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                  ) : (
                                    <FileCheck className="w-3 h-3 shrink-0" />
                                  )}
                                  <span className="truncate flex-1">{d.title}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Hover Tooltip for Month View */}
      {hoveredSlot && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredSlot.x}px`,
            top: `${hoveredSlot.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-50 pointer-events-none bg-slate-900 text-white text-xs p-2.5 rounded-lg shadow-xl border border-slate-700 max-w-xs space-y-1 animate-fade-in"
        >
          <div className="font-bold text-slate-100 font-heading">{hoveredSlot.slot.subjectName}</div>
          <div className="text-[11px] text-slate-300 flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            {hoveredSlot.slot.start_time} - {hoveredSlot.slot.end_time}
          </div>
          {hoveredSlot.slot.classroom && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
              {hoveredSlot.slot.classroom}
            </div>
          )}
          <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1 mt-1">
            {hoveredSlot.slot.universityName}
          </div>
        </div>
      )}

      {/* Modal Add / Edit Schedule */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedSched(null);
        }}
        title={selectedSched ? 'Editar Horario de Clase' : 'Asignar Horario a Materia'}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          {Number(schedDay) === 6 && (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Periodicidad Sábado</label>
              <select
                value={schedPeriodicity}
                onChange={(e) => setSchedPeriodicity(e.target.value as any)}
                className={inputClass}
              >
                <option value="semanal">Semanal (Todos los sábados)</option>
                <option value="sabado_a">Sábado A (Quincenal)</option>
                <option value="sabado_b">Sábado B (Quincenal)</option>
              </select>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-2">
            {selectedSched && selectedSched.id ? (
              <Button
                variant="danger"
                className="w-full sm:w-auto text-xs"
                onClick={() => handleDeleteSchedule(selectedSched.id!)}
              >
                Eliminar Horario
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="ghost"
                className="w-full sm:w-auto text-xs"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                  setSelectedSched(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="aeroespacial"
                className="w-full sm:w-auto text-xs"
                onClick={handleSaveSchedule}
                disabled={!schedSubjectId || !schedStart.trim() || !schedEnd.trim()}
              >
                {selectedSched ? 'Guardar Cambios' : 'Guardar Horario'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <SubjectDetailsModal
        isOpen={detailsSched !== null}
        onClose={() => setDetailsSched(null)}
        subject={detailsSched ? getSubject(detailsSched.subject_id) || null : null}
        university={detailsSched ? getUniversityBySubjectId(detailsSched.subject_id) || null : null}
        professor={detailsSched ? getProfessorBySubjectId(detailsSched.subject_id) || null : null}
        classSessions={classSessions}
        schedule={detailsSched}
        onEditSchedule={handleOpenEdit}
      />
    </div>
  );
};
