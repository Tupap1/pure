import React from 'react';
import { usePureData } from '@/lib/hooks/usePureData';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Clock,
  Sparkles,
  AlertTriangle,
  BookOpen,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  CalendarDays,
  User,
  Users
} from 'lucide-react';
import { calculateNetFreeTime } from '@/lib/algorithms/study-hours-dme';
import { pureDB } from '@/lib/db/dexie-schema';

export const CommandCenter: React.FC = () => {
  const { isLoaded, universities, subjects, deliverables } = usePureData();

  if (!isLoaded) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono">
        Cargando motor de base de datos local (IndexedDB)...
      </div>
    );
  }

  const netFreeTime = calculateNetFreeTime({ classHours: 20, dmeHours: 12.5, sleepHoursPerNight: 7 });
  const pendingDeliverables = deliverables.filter((d) => d.status === 'pendiente');

  const handleMarkAsDone = async (id: string) => {
    await pureDB.deliverables.update(id, { status: 'entregado' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* High-Craft Strategy Banner - No Eyebrows, Clean Heading */}
      <div className="glass-panel rounded-2xl p-6 bg-gradient-to-r from-sky-950/40 via-purple-950/30 to-emerald-950/40 border border-slate-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold font-heading text-slate-50">
              Estrategia de Eficiencia Académica
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Dosis Mínima Eficaz (DME) calibrada para <strong className="text-emerald-400">{netFreeTime} horas libres reales</strong> esta semana cursando {universities.length} ingenierías en paralelo.
            </p>
          </div>
          <Button variant="synergy">
            <Sparkles className="w-4 h-4" /> Recalcular Horas con IA
          </Button>
        </div>
      </div>

      {/* Operative Data Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>TIEMPO LIBRE NETO</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-heading text-slate-50">{netFreeTime}h / sem</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full w-[89%]"></div>
          </div>
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> +12h ganadas por sinergia
          </span>
        </Card>

        <Card className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>ESTUDIO DME SEMANAL</span>
            <BookOpen className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-bold font-heading text-slate-50">12.5 h</div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-sky-400 h-full w-[28%]"></div>
          </div>
          <span className="text-[11px] text-sky-400 font-medium">
            3.5h completadas (28%)
          </span>
        </Card>

        {subjects.map((sub) => (
          <Card key={sub.id} className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="truncate max-w-[140px]">{sub.code || sub.name}</span>
              <Badge variant={sub.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                {sub.modality}
              </Badge>
            </div>
            <div className="text-3xl font-bold font-heading text-slate-50">
              {sub.current_grade.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  sub.current_grade >= sub.target_grade ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ width: `${(sub.current_grade / 5.0) * 100}%` }}
              ></div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Meta: {sub.target_grade.toFixed(2)} ({sub.current_grade >= sub.target_grade ? 'Cumplida ✅' : 'En progreso'})
            </span>
          </Card>
        ))}
      </div>

      {/* Main Grid: Urgent Deliverables & Synergy Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Urgent Deliverables */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-400" />
              Entregas Urgentes en IndexedDB
            </h3>
            <span className="text-xs text-slate-400">{pendingDeliverables.length} pendientes</span>
          </div>

          <div className="space-y-3">
            {pendingDeliverables.map((deliv) => {
              const sub = subjects.find((s) => s.id === deliv.subject_id);
              const formattedDate = new Date(deliv.due_date).toLocaleDateString('es-ES', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Card key={deliv.id} className="flex items-center justify-between p-4 bg-slate-900/60">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-800 text-amber-400 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sub?.modality === 'presencial' ? 'aeroespacial' : 'software'}>
                          {sub?.name || 'Materia'}
                        </Badge>
                        <Badge variant={deliv.complexity === 'dificil' ? 'danger' : 'warning'}>
                          {deliv.complexity}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1 font-mono">
                          {deliv.is_group ? <Users className="w-3 h-3 text-purple-400" /> : <User className="w-3 h-3 text-sky-400" />}
                          {deliv.is_group ? 'Grupal' : 'Individual'}
                        </Badge>
                      </div>
                      <h4 className="text-base font-bold text-slate-100 mt-1">{deliv.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Límite: <strong className="text-amber-400 font-mono">{formattedDate}</strong> • Peso: <strong className="text-slate-200">{deliv.weight_percentage}%</strong>
                      </p>
                    </div>
                  </div>
                  <Button variant="synergy" size="sm" onClick={() => handleMarkAsDone(deliv.id!)}>
                    <CheckCircle2 className="w-4 h-4" /> Marcar Entregado
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column (1/3): Active Synergies & Exam Readiness */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Sinergias & Exámenes Finales
          </h3>

          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <Badge variant="synergy">Cross-Degree Synergy</Badge>
              <span className="text-xs font-mono text-emerald-400 font-bold">92% Similitud</span>
            </div>
            <h4 className="text-sm font-bold text-slate-100">
              Matrices & Algoritmos Numéricos
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              El tema de <strong className="text-sky-300">Mecánica Orbital</strong> comparte ejes temáticos con <strong className="text-purple-300">Algoritmos Numéricos</strong>.
            </p>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>1 sola sesión de 45 mins cubre ambas materias en IndexedDB.</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
