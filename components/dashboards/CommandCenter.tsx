import React from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MultiProgressRing } from '@/components/ui/ProgressRing';
import { SemesterProgressChart } from '@/components/ui/SemesterProgressChart';
import { StudyHeatmap } from '@/components/ui/StudyHeatmap';
import { DailyLoadStackedBar } from '@/components/ui/DailyLoadStackedBar';
import { SubjectTelemetryTable } from '@/components/ui/SubjectTelemetryTable';
import {
  Clock,
  CheckCircle2,
  CalendarDays,
  GraduationCap,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { buildDailyLoad } from '@/lib/algorithms/academic-load';
import { computeStudyHeatmap } from '@/lib/domain/study-heatmap';
import { saveDeliverable } from '@/lib/db/repository';
import { formatDeliverableDate } from '@/lib/domain/deliverable';
import { useAcademicLoad } from '@/lib/hooks/useAcademicLoad';

export const CommandCenter: React.FC = () => {
  const { isLoaded, universities, subjects, deliverables, schedules, professors, studySessions } = usePureData();
  const academicLoad = useAcademicLoad();

  const dailyLoadData = React.useMemo(
    () => buildDailyLoad(schedules, subjects, universities, academicLoad.normativeIndependentHours),
    [schedules, subjects, universities, academicLoad.normativeIndependentHours]
  );

  // Heatmap de las sesiones de estudio realmente completadas (ver lib/domain/study-heatmap.ts).
  // Debe declararse antes del retorno temprano: un hook detrás de un `return` condicional
  // se salta mientras los datos cargan y rompe el orden de hooks entre renders.
  const realHeatmapDays = React.useMemo(
    () => computeStudyHeatmap(studySessions),
    [studySessions]
  );

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse" role="status" aria-label="Sincronizando estado académico local">
        <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  // Todas las cifras de carga salen del mismo hook que alimenta el encabezado, para que no
  // puedan discrepar entre sí. Ver lib/algorithms/academic-load.ts.
  const {
    classHours,
    normativeIndependentHours,
    totalAcademicHours,
    sleepHours: sleepHoursTotal,
    netFreeTime,
    isOverloaded,
  } = academicLoad;

  const pendingDeliverables = deliverables.filter((d) => d.status === 'pendiente');
  const urgentDeliverables = [...pendingDeliverables].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  const handleMarkAsDone = async (id: string) => {
    const deliv = deliverables.find((d) => d.id === id);
    if (deliv) {
      await saveDeliverable({
        ...deliv,
        status: 'entregado',
      });
    }
  };

  // Concentric multi-rings definition for dashboard
  const multiRings = [
    { label: 'Tiempo Libre', progress: Math.min(100, Math.round((Math.max(0, netFreeTime) / 168) * 100)), color: '#10b981' },
    { label: 'Trabajo independiente', progress: Math.min(100, Math.round((normativeIndependentHours / 168) * 100)), color: '#a855f7' },
    { label: 'Horario Clases', progress: Math.min(100, Math.round((classHours / 168) * 100)), color: '#38bdf8' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {subjects.length === 0 ? (
        /* Empty State */
        <Card hoverEffect={false} className="p-10 bg-transparent border-none space-y-6">
          <div className="max-w-xl mx-auto text-center space-y-3">
            <GraduationCap className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" strokeWidth={1.5} />
            <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Sin materias registradas
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Agrega tu primera universidad y materias en Configuración para activar el horario, balance de tiempo y sinergias.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* 4-Metric Academic Capacity Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3.5 space-y-1">
              <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-medium tracking-wide">Acompañamiento directo</div>
              <div className="text-lg font-mono font-bold text-slate-500 dark:text-slate-400">
                {classHours.toFixed(1)}<span className="text-xs font-normal text-slate-400"> h/sem</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Horas de clase de tu horario</div>
            </Card>

            <Card className="p-3.5 space-y-1">
              <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-medium tracking-wide">Trabajo independiente</div>
              <div className="text-lg font-mono font-bold text-slate-500 dark:text-slate-400">
                {normativeIndependentHours.toFixed(1)}<span className="text-xs font-normal text-slate-400"> h/sem</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Lo que exige el Decreto 1075, menos tu clase</div>
            </Card>

            <Card className="p-3.5 space-y-1">
              <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-medium tracking-wide">Trabajo académico total</div>
              <div className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                {totalAcademicHours.toFixed(1)}<span className="text-xs font-normal text-slate-400"> h/sem</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {academicLoad.totalCredits} créditos × 3 h/sem
              </div>
            </Card>

            <Card
              className={`p-3.5 space-y-1 ${
                isOverloaded ? 'border-red-500/40' : 'border-emerald-500/30'
              }`}
            >
              <div
                className={`text-[10px] uppercase font-medium tracking-wide ${
                  isOverloaded ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isOverloaded ? 'Sobrecarga semanal' : 'Tiempo libre neto'}
              </div>
              <div
                className={`text-lg font-mono font-bold ${
                  isOverloaded ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {netFreeTime.toFixed(1)}<span className="text-xs font-normal text-slate-400"> h/sem</span>
              </div>
              <div className={`text-[10px] ${isOverloaded ? 'text-red-600/80 dark:text-red-500/80' : 'text-emerald-600/80 dark:text-emerald-500/80'}`}>
                {isOverloaded
                  ? 'La carga no cabe en las 168h de la semana'
                  : `168 − ${classHours.toFixed(1)} clase − ${normativeIndependentHours.toFixed(1)} indep. − ${sleepHoursTotal} sueño`}
              </div>
            </Card>
          </div>

          {/* Asymmetric Command Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Primary Hero Block (7/12): Entregas y Asignaturas */}
            <div className="lg:col-span-7 space-y-6">
              {/* Deliverables Card */}
              <Card className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                    <CalendarDays className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    Entregas & Parciales Próximos ({urgentDeliverables.length})
                  </h3>
                </div>

                {urgentDeliverables.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-lg text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <CheckCircle2 className="w-5 h-5 text-slate-500 dark:text-slate-400 mx-auto mb-1" />
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Sin evaluaciones pendientes</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {urgentDeliverables.slice(0, 4).map((deliv) => {
                      const sub = subjects.find((s) => s.id === deliv.subject_id);
                      const formattedDate = formatDeliverableDate(deliv.due_date, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      });

                      return (
                        <div
                          key={deliv.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 transition-colors"
                        >
                          <div className="space-y-1 min-w-0 sm:pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={sub?.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                                {sub?.name || 'Materia'}
                              </Badge>
                              <Badge variant={deliv.complexity === 'dificil' ? 'danger' : 'warning'}>
                                {deliv.complexity}
                              </Badge>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{deliv.title}</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              Límite: <span className="text-slate-800 dark:text-slate-200 font-medium">{formattedDate}</span> • Peso Evaluativo: <span className="text-slate-500 dark:text-slate-400 font-semibold">{deliv.weight_percentage}%</span>
                            </p>
                          </div>
                          <Button
                            variant="synergy"
                            size="sm"
                            className="w-full sm:w-auto min-h-[44px] sm:min-h-0 shrink-0"
                            onClick={() => handleMarkAsDone(deliv.id!)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Entregado
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Asignaturas & Metas de Nota (Matriz Telemétrica) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight font-heading">
                    <TrendingUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    Telemetría Académica & Estado de Asignaturas
                  </h3>
                </div>

                <SubjectTelemetryTable subjects={subjects} professors={professors} universities={universities} />
              </div>
            </div>

            {/* Right Secondary Column (5/12): Multi-Ring Donut Gauge & Balance */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                    <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    Balance de Tiempo Semanal (168h)
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Concentric Multi-Ring Display */}
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-surface-border flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium">
                        Tiempo Libre Neto
                      </div>
                      <div className="text-3xl font-mono font-bold text-slate-500 dark:text-slate-400">
                        {netFreeTime.toFixed(1)}h
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Disponibilidad semanal real.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <MultiProgressRing
                        rings={multiRings}
                        size={120}
                        strokeWidth={7}
                        centerTitle={`${netFreeTime.toFixed(1)}h`}
                        centerSubtitle="Libre"
                      />
                    </div>
                  </div>

                  {/* Legend Breakdown */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
                      <span className="text-slate-700 dark:text-slate-300">Clase: {classHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                      <span className="text-slate-700 dark:text-slate-300">Independiente: {normativeIndependentHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 dark:bg-slate-700" />
                      <span className="text-slate-700 dark:text-slate-300">Sueño: {sleepHoursTotal}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      <span className={`font-bold ${isOverloaded ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {isOverloaded ? 'Sobrecarga' : 'Libre'}: {netFreeTime.toFixed(1)}h
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Day-by-Day Stacked Load Distribution Bar */}
              <Card className="p-5">
                <DailyLoadStackedBar data={dailyLoadData} />
              </Card>

            </div>
          </div>

          {/* Heatmap & Historical GPA Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 space-y-4">
              <StudyHeatmap days={realHeatmapDays} />
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-heading font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                  <BarChart3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  Evolución de Promedio Académico
                </h3>
              </div>
              <SemesterProgressChart
                data={subjects.map((s) => {
                  // Cada materia se mide contra su propia meta y contra la escala de su
                  // universidad, no contra un 4.5 sobre 5.0 fijo para todas.
                  const uni = universities.find((u) => u.id === s.university_id);
                  return {
                    semester: s.code || s.name.substring(0, 6),
                    name: s.name,
                    gpa: s.current_grade || 0,
                    credits: s.credits,
                    targetGrade: s.target_grade,
                    scaleMin: uni?.scale_min ?? 0,
                    scaleMax: uni?.scale_max ?? 5,
                  };
                })}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
};


