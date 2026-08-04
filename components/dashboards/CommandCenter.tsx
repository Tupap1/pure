import React from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SemesterProgressChart } from '@/components/ui/SemesterProgressChart';
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
  BarChart3
} from 'lucide-react';
import { calculateDME, calculateNetFreeTime } from '@/lib/algorithms/study-hours-dme';
import { pureDB } from '@/lib/db/dexie-schema';

export const CommandCenter: React.FC = () => {
  const { isLoaded, universities, subjects, deliverables, schedules } = usePureData();

  if (!isLoaded) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
        <Zap className="w-4 h-4 text-sky-600 dark:text-sky-400 animate-spin" />
        Sincronizando estado académico local...
      </div>
    );
  }

  const totalDMEHours = subjects.reduce((sum, s) => {
    return sum + calculateDME(s as any).recommendedWeeklyHours;
  }, 0);

  const classHours = schedules.reduce((sum, s) => {
    const startHour = parseInt(s.start_time.split(':')[0], 10);
    const endHour = parseInt(s.end_time.split(':')[0], 10);
    return sum + Math.max(0, endHour - startHour);
  }, 0);

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d121d] to-[#111726] border border-slate-800 rounded-xl p-6 shadow-sm transition-all relative overflow-hidden text-slate-100">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-sky-500/5 blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="aeroespacial">PURE OS • Eficiencia Académica</Badge>
              {subjects.length > 0 && (
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Semestre Activo
                </span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight font-heading">
              Centro de Mando & Foco Semanal
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {subjects.length > 0
                ? `Monitoreando ${subjects.length} asignatura(s) en ${universities.length} institución(es). Calculado con Dosis Mínima Eficaz (DME) para maximizar tu tiempo libre neto.`
                : 'Gestión integrada para carreras concurrentes: optimiza tu carga académica sin sobreestudio.'}
            </p>
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        /* Empty State with Rich Product Preview */
        <Card className="p-8 border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-6">
          <div className="max-w-xl mx-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Sin materias registradas en la base de datos local
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Configura tu primera universidad y asignaturas para activar el motor de cálculo de tiempo libre, detector de traslapes y sinergias temáticas.
            </p>
          </div>

          {/* Interactive Feature Demo Preview Card */}
          <div className="bg-white dark:bg-[#07090e] border border-slate-200 dark:border-slate-800 rounded-lg p-5 max-w-2xl mx-auto space-y-3 text-left shadow-sm">
            <div className="text-[11px] uppercase font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Vista previa del panel configurado</span>
              <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1 font-semibold"><Sparkles className="w-3 h-3" /> PURE Algorithm</span>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md space-y-1">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">TIEMPO LIBRE NETO</div>
                <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">38.5h / sem</div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 dark:bg-emerald-400 h-full w-[75%]"></div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md space-y-1">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">ESTUDIO DME</div>
                <div className="text-lg font-mono font-bold text-sky-600 dark:text-sky-400">14.0h / sem</div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-sky-500 dark:bg-sky-400 h-full w-[40%]"></div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-3 rounded-md space-y-1">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">OVERLAP SINÉRGICO</div>
                <div className="text-lg font-mono font-bold text-purple-600 dark:text-purple-400">74.2% match</div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-purple-500 dark:bg-purple-400 h-full w-[74%]"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-3">
              Paso 1: Agrega tu Institución y Materias en la sección de configuración.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Asymmetric Command Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Primary Hero Block (7/12): Foco y Próximas Entregas */}
            <div className="lg:col-span-7 space-y-6">
              {/* Deliverables Urgency Card */}
              <Card className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                    <CalendarDays className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    Entregas & Parciales Próximos ({urgentDeliverables.length})
                  </h3>
                  <Badge variant="outline">Foco Finito</Badge>
                </div>

                {urgentDeliverables.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800/80 rounded-lg text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Sin evaluaciones pendientes registradas</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Tu tiempo libre proyectado se mantiene intacto.</p>
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
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80 transition-colors"
                        >
                          <div className="space-y-1 min-w-0 pr-3">
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
                          <Button variant="synergy" size="sm" onClick={() => handleMarkAsDone(deliv.id!)}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Entregado
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Asignaturas & Rendimiento Acumulado */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Estado de Asignaturas & Metas de Nota
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subjects.map((sub) => {
                    const dme = calculateDME(sub as any);
                    const gradeProgress = ((sub.current_grade || 0) / 5.0) * 100;
                    const isAboveTarget = (sub.current_grade || 0) >= sub.target_grade;

                    return (
                      <Card key={sub.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs" title={sub.name}>
                              {sub.name}
                            </h4>
                            {sub.code && (
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block truncate">
                                {sub.code}
                              </span>
                            )}
                          </div>
                          <Badge variant={sub.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                            {sub.modality}
                          </Badge>
                        </div>

                        <div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100">
                              {sub.current_grade ? sub.current_grade.toFixed(2) : '0.00'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              Meta: {sub.target_grade.toFixed(2)}
                            </span>
                          </div>

                          <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isAboveTarget ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, gradeProgress))}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60">
                          <span>DME Recomendado:</span>
                          <span className="text-sky-600 dark:text-sky-400 font-semibold">{dme.recommendedWeeklyHours.toFixed(1)}h / sem</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Secondary Column (5/12): Gauge & Balance de Tiempo */}
            <div className="lg:col-span-5 space-y-6">
              {/* Balance Semanal Integrado */}
              <Card className="p-5 space-y-5 bg-white dark:bg-gradient-to-b dark:from-[#111726] dark:to-[#0d121d]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                    <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Balance de Tiempo Semanal (168h)
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-2 py-0.5 rounded-md font-semibold">
                    Algoritmo DME
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Big Metric Display with Donut Progress Ring */}
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-medium">
                        Tiempo Libre Neto
                      </div>
                      <div className="text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {netFreeTime}h
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Disponible tras cubrir clases y estudio.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <ProgressRing
                        progress={Math.min(100, Math.round((Math.max(0, netFreeTime) / 168) * 100))}
                        size={84}
                        strokeWidth={8}
                        color="#10b981"
                        label={`${Math.round((Math.max(0, netFreeTime) / 168) * 100)}%`}
                        sublabel="Libre"
                      />
                    </div>
                  </div>

                  {/* Visual Stacked Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>Distribución de Carga</span>
                      <span>168h Totales</span>
                    </div>
                    <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-sky-500 h-full"
                        style={{ width: `${(classHours / 168) * 100}%` }}
                        title={`Clases: ${classHours}h`}
                      ></div>
                      <div
                        className="bg-purple-500 h-full"
                        style={{ width: `${(totalDMEHours / 168) * 100}%` }}
                        title={`Estudio DME: ${totalDMEHours.toFixed(1)}h`}
                      ></div>
                      <div
                        className="bg-slate-400 dark:bg-slate-700 h-full"
                        style={{ width: `${(sleepHoursTotal / 168) * 100}%` }}
                        title={`Sueño: ${sleepHoursTotal}h`}
                      ></div>
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${(Math.max(0, netFreeTime) / 168) * 100}%` }}
                        title={`Tiempo Libre: ${netFreeTime}h`}
                      ></div>
                    </div>
                  </div>

                  {/* Legend Breakdown */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
                      <span className="text-slate-700 dark:text-slate-300">Clases: {classHours}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span>
                      <span className="text-slate-700 dark:text-slate-300">DME: {totalDMEHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 dark:bg-slate-700"></span>
                      <span className="text-slate-700 dark:text-slate-300">Sueño: {sleepHoursTotal}h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold text-emerald-600 dark:text-emerald-400">Libre: {netFreeTime}h</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Quick Principle Recommendation Card */}
              <Card className="p-4 space-y-2 bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-400 font-mono">
                  <Zap className="w-3.5 h-3.5" />
                  REGLA DE ECOSISTEMA PURE
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  "No estudies más horas por defecto. Ajusta el tiempo de estudio según la complejidad de la entrega y el beneficio decreciente."
                </p>
              </Card>
            </div>
          </div>

          {/* New Section: Historical GPA & Semester Progress Chart (Inspo Image 2) */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Analítica de Avance por Semestre (Inspiración Inspo UI)
              </h3>
              <Badge variant="software">Curva de Rendimiento</Badge>
            </div>
            <SemesterProgressChart targetGPA={4.5} />
          </Card>
        </>
      )}
    </div>
  );
};

