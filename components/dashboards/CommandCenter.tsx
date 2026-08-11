import React from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressRing, MultiProgressRing } from '@/components/ui/ProgressRing';
import { SemesterProgressChart } from '@/components/ui/SemesterProgressChart';
import { StudyHeatmap } from '@/components/ui/StudyHeatmap';
import { DailyLoadStackedBar } from '@/components/ui/DailyLoadStackedBar';
import { SubjectTelemetryTable } from '@/components/ui/SubjectTelemetryTable';
import {
  Clock,
  BookOpen,
  CheckCircle2,
  CalendarDays,
  GraduationCap,
  Sparkles,
  Zap,
  TrendingUp,
  ArrowRight,
  BarChart3,
  Activity,
  Layers
} from 'lucide-react';
import { calculateDME, calculateNetFreeTime, calculateTotalClassHours } from '@/lib/algorithms/study-hours-dme';
import { pureDB } from '@/lib/db/dexie-schema';

export const CommandCenter: React.FC = () => {
  const { isLoaded, universities, subjects, deliverables, schedules, professors } = usePureData();

  if (!isLoaded) {
    return (
      <div className="space-y-6 animate-pulse" role="status" aria-label="Sincronizando estado académico local">
        <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  const totalDMEHours = subjects.reduce((sum, s) => {
    return sum + calculateDME(s as any).recommendedWeeklyHours;
  }, 0);

  const classHours = calculateTotalClassHours(schedules);

  const sleepHoursTotal = 7 * 7; // 49h weekly

  const netFreeTime = calculateNetFreeTime({
    classHours,
    dmeHours: totalDMEHours,
    sleepHoursPerNight: 7,
  });

  const pendingDeliverables = deliverables.filter((d) => d.status === 'pendiente');
  const urgentDeliverables = [...pendingDeliverables].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  const handleMarkAsDone = async (id: string) => {
    await pureDB.deliverables.update(id, { status: 'entregado' });
  };

  // Concentric multi-rings definition for dashboard
  const multiRings = [
    { label: 'Tiempo Libre', progress: Math.min(100, Math.round((Math.max(0, netFreeTime) / 168) * 100)), color: '#10b981' },
    { label: 'Carga DME', progress: Math.min(100, Math.round((totalDMEHours / 168) * 100)), color: '#a855f7' },
    { label: 'Horario Clases', progress: Math.min(100, Math.round((classHours / 168) * 100)), color: '#38bdf8' },
  ];

  // Dynamic Heatmap Days calculated from active subjects and deliverables in IndexedDB
  const realHeatmapDays = React.useMemo(() => {
    const result = [];
    const now = new Date();
    const dailyDmeTarget = subjects.length > 0 ? (totalDMEHours / 5) : 0;

    for (let i = 27; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();

      const delivsOnDate = deliverables.filter((del) => del.due_date?.startsWith(dateStr));
      const completedDelivs = delivsOnDate.filter((del) => del.status === 'entregado');

      let hours = 0;
      if (completedDelivs.length > 0) {
        hours += completedDelivs.length * 2.0;
      } else if (delivsOnDate.length > 0 && dayOfWeek !== 0) {
        hours += delivsOnDate.length * 1.5;
      } else if (dailyDmeTarget > 0 && dayOfWeek >= 1 && dayOfWeek <= 5 && i <= 7) {
        hours = Number(dailyDmeTarget.toFixed(1));
      }

      const intensity = (hours === 0 ? 0 : hours <= 2 ? 1 : hours <= 4 ? 2 : hours <= 6 ? 3 : 4) as 0 | 1 | 2 | 3 | 4;
      result.push({ date: dateStr, hours, intensity });
    }
    return result;
  }, [deliverables, subjects, totalDMEHours]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Header Banner */}
      <div className="bg-[#090d18] border border-cyan-500/30 rounded-xl p-5 shadow-sm text-slate-100 glow-aeroespacial">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight font-heading">
              Dashboard Académico
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {subjects.length > 0
                ? `${subjects.length} asignatura(s) activas en ${universities.length} institución(es).`
                : 'Configura tus instituciones y materias para iniciar la gestión.'}
            </p>
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        /* Empty State */
        <Card className="p-8 border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-6">
          <div className="max-w-xl mx-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
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
            <Card className="p-3.5 bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium">Clases en Horario</div>
              <div className="text-lg font-mono font-bold text-cyan-600 dark:text-cyan-400">
                {classHours.toFixed(1)}h<span className="text-xs font-normal text-slate-400"> /sem</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Horas de asistencia agendadas</div>
            </Card>

            <Card className="p-3.5 bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium">Estudio por Fuera (DME)</div>
              <div className="text-lg font-mono font-bold text-purple-600 dark:text-purple-400">
                {totalDMEHours.toFixed(1)}h<span className="text-xs font-normal text-slate-400"> /sem</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Trabajo autónomo sugerido</div>
            </Card>

            <Card className="p-3.5 bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium">Dedicación Total</div>
              <div className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                {(classHours + totalDMEHours).toFixed(1)}h<span className="text-xs font-normal text-slate-400"> /sem</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Carga académica global</div>
            </Card>

            <Card className="p-3.5 bg-white dark:bg-[#0d1322] border border-emerald-500/30 space-y-1 glow-synergy">
              <div className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-medium">Tiempo Libre Neto</div>
              <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {netFreeTime.toFixed(1)}h<span className="text-xs font-normal text-slate-400"> /sem</span>
              </div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 font-mono">Margen libre (descontando 7h sueño)</div>
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
                    <CalendarDays className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    Entregas & Parciales Próximos ({urgentDeliverables.length})
                  </h3>
                </div>

                {urgentDeliverables.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-lg text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Sin evaluaciones pendientes</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {urgentDeliverables.slice(0, 4).map((deliv) => {
                      const sub = subjects.find((s) => s.id === deliv.subject_id);
                      const formattedDate = new Date(deliv.due_date).toLocaleDateString('es-ES', {
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
                              Límite: <span className="text-slate-800 dark:text-slate-200 font-medium">{formattedDate}</span> • Peso Evaluativo: <span className="text-sky-600 dark:text-sky-400 font-semibold">{deliv.weight_percentage}%</span>
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
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
                    <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Balance de Tiempo Semanal (168h)
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Concentric Multi-Ring Display */}
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium">
                        Tiempo Libre Neto
                      </div>
                      <div className="text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
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
                      <span className="text-slate-700 dark:text-slate-300">Clases: {classHours}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                      <span className="text-slate-700 dark:text-slate-300">DME: {totalDMEHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 dark:bg-slate-700" />
                      <span className="text-slate-700 dark:text-slate-300">Sueño: {sleepHoursTotal}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      <span className="text-slate-700 dark:text-slate-300 font-bold text-emerald-600 dark:text-emerald-400">Libre: {netFreeTime}h</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Day-by-Day Stacked Load Distribution Bar */}
              <Card className="p-5">
                <DailyLoadStackedBar />
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
                  <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Evolución de Promedio Académico
                </h3>
              </div>
              <SemesterProgressChart data={subjects.map((s) => ({ semester: s.code || s.name.substring(0, 6), gpa: s.current_grade || 0, credits: s.credits }))} targetGPA={4.5} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
};


