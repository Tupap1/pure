import React from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Clock,
  BookOpen,
  CheckCircle2,
  CalendarDays,
  GraduationCap
} from 'lucide-react';
import { calculateDME, calculateNetFreeTime } from '@/lib/algorithms/study-hours-dme';
import { pureDB } from '@/lib/db/dexie-schema';

export const CommandCenter: React.FC = () => {
  const { isLoaded, universities, subjects, deliverables, schedules } = usePureData();

  if (!isLoaded) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono">
        Cargando datos locales...
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

  const netFreeTime = calculateNetFreeTime({
    classHours,
    dmeHours: totalDMEHours,
    sleepHoursPerNight: 7,
  });

  const pendingDeliverables = deliverables.filter((d) => d.status === 'pendiente');

  const handleMarkAsDone = async (id: string) => {
    await pureDB.deliverables.update(id, { status: 'entregado' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overview Header */}
      <div className="bg-slate-900/80 rounded-xl p-6 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-50">
              Dashboard de Eficiencia Académica
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {subjects.length > 0
                ? `Calculado para ${universities.length} universidad(es) y ${subjects.length} asignatura(s) activas.`
                : 'Bienvenido a Pure. Registra tu primera Universidad y Asignatura para comenzar.'}
            </p>
          </div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-800 bg-slate-950/40 space-y-4">
          <GraduationCap className="w-12 h-12 text-sky-400 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-slate-200">Comienza a configurar tu semestre</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Actualmente tu base de datos local está limpia. Para aprovechar la calculadora de tiempo libre, el detector de traslapes y las sinergias temáticas, agrega tus instituciones y materias.
            </p>
          </div>
          <div className="pt-2">
            <p className="text-xs text-slate-500 font-mono mb-3">
              Paso 1: Ve a la pestaña "Configuración & CRUD" para agregar tus entidades.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Operative Data Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="space-y-2 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>TIEMPO LIBRE NETO</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-slate-50">{netFreeTime}h / sem</div>
              <div className="w-full bg-slate-900 border border-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-[80%]"></div>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Disponible después de clases y estudio
              </span>
            </Card>

            <Card className="space-y-2 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>ESTUDIO DME SEMANAL</span>
                <BookOpen className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-slate-50">{totalDMEHours.toFixed(1)} h</div>
              <div className="w-full bg-slate-900 border border-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-sky-400 h-full w-[35%]"></div>
              </div>
              <span className="text-[11px] text-sky-400 font-medium">
                Dosis Mínima Eficaz recomendada
              </span>
            </Card>

            {subjects.map((sub) => (
              <Card key={sub.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="truncate max-w-[140px]">{sub.code || sub.name}</span>
                  <Badge variant={sub.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                    {sub.modality}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-slate-50">
                  {sub.current_grade ? sub.current_grade.toFixed(2) : '0.00'}{' '}
                  <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
                </div>
                <div className="w-full bg-slate-900 border border-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      (sub.current_grade || 0) >= sub.target_grade ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${((sub.current_grade || 0) / 5.0) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Meta: {sub.target_grade.toFixed(2)}
                </span>
              </Card>
            ))}
          </div>

          {/* Main Grid: Urgent Deliverables */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-sky-400" />
                Próximas Entregas & Parciales ({pendingDeliverables.length})
              </h3>
            </div>

            {pendingDeliverables.length === 0 ? (
              <Card className="p-6 text-center border-dashed border-slate-800 bg-slate-950/40 text-xs text-slate-400">
                No tienes entregas o evaluaciones registradas pendientes.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingDeliverables.map((deliv) => {
                  const sub = subjects.find((s) => s.id === deliv.subject_id);
                  const formattedDate = new Date(deliv.due_date).toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <Card key={deliv.id} className="flex items-center justify-between p-3.5 bg-slate-900/60">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={sub?.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                            {sub?.name || 'Materia'}
                          </Badge>
                          <Badge variant={deliv.complexity === 'dificil' ? 'danger' : 'warning'}>
                            {deliv.complexity}
                          </Badge>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">{deliv.title}</h4>
                        <p className="text-xs text-slate-400 font-mono">
                          Límite: {formattedDate} • Peso: {deliv.weight_percentage}%
                        </p>
                      </div>
                      <Button variant="synergy" size="sm" onClick={() => handleMarkAsDone(deliv.id!)}>
                        <CheckCircle2 className="w-4 h-4" /> Entregado
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
