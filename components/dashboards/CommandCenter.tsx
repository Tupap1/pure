import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import {
  Clock,
  Sparkles,
  AlertTriangle,
  BookOpen,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';

export const CommandCenter: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome & Strategy Header */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 bg-gradient-to-r from-sky-950/40 via-purple-950/30 to-emerald-950/40 border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-500/10 via-purple-500/10 to-emerald-500/10 blur-3xl -z-10 rounded-full"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="aeroespacial">Ingeniería Aeroespacial (Uni 1)</Badge>
              <Badge variant="software">Ingeniería de Software (Uni 2)</Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold font-heading text-slate-50 tracking-tight">
              Estrategia de Eficiencia Académica Activa
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
              Sistema calibrado para la <strong className="text-emerald-400">Dosis Mínima Eficaz (DME)</strong>. Estudia solo las horas estrictamente necesarias para alcanzar tus notas meta y disponer de <strong className="text-emerald-400">89 horas libres reales</strong> esta semana.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="synergy" size="lg">
              <Sparkles className="w-4 h-4" /> Optimizar Semana con IA
            </Button>
          </div>
        </div>
      </div>

      {/* Top 4 Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Tiempo Libre Real */}
        <Card glowColor="synergy" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono uppercase text-slate-400">Tiempo Libre Neto</span>
            <div className="text-2xl font-bold font-heading text-slate-50 mt-1">89 h / sem</div>
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> +12h ganadas por Sinergia
            </span>
          </div>
          <ProgressRing progress={89} size={70} strokeWidth={6} color="#10b981" label="89h" />
        </Card>

        {/* Metric 2: DME Horas Recomendadas */}
        <Card glowColor="aeroespacial" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono uppercase text-slate-400">DME Estudio Semanal</span>
            <div className="text-2xl font-bold font-heading text-slate-50 mt-1">12.5 h</div>
            <span className="text-[11px] text-sky-400 font-medium mt-1 block">
              3.5h completadas (28%)
            </span>
          </div>
          <ProgressRing progress={28} size={70} strokeWidth={6} color="#38bdf8" label="28%" />
        </Card>

        {/* Metric 3: Promedio Ponderado Aeroespacial */}
        <Card glowColor="software" className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono uppercase text-slate-400">Promedio Aeroespacial</span>
            <div className="text-2xl font-bold font-heading text-slate-50 mt-1">4.65 / 5.0</div>
            <span className="text-[11px] text-purple-300 font-medium mt-1 block">
              Meta: 4.50 (Superada ✅)
            </span>
          </div>
          <ProgressRing progress={93} size={70} strokeWidth={6} color="#a855f7" label="4.65" />
        </Card>

        {/* Metric 4: Promedio Ponderado Software */}
        <Card className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono uppercase text-slate-400">Promedio Software</span>
            <div className="text-2xl font-bold font-heading text-slate-50 mt-1">4.40 / 5.0</div>
            <span className="text-[11px] text-emerald-400 font-medium mt-1 block">
              Meta: 4.00 (Cumplida)
            </span>
          </div>
          <ProgressRing progress={88} size={70} strokeWidth={6} color="#38bdf8" label="4.40" />
        </Card>
      </div>

      {/* Main Grid: Urgent Deliverables & Synergy Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Urgent Deliverables */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-400" />
              Entregas Urgentes (Próximos 7 Días)
            </h3>
            <span className="text-xs text-slate-400">3 pendientes</span>
          </div>

          <div className="space-y-3">
            {/* Urgent Item 1 */}
            <Card className="flex items-center justify-between p-4 border-l-4 border-l-rose-500">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="aeroespacial">Aeroespacial</Badge>
                    <Badge variant="danger">Alta Complejidad</Badge>
                    <Badge variant="outline" className="font-mono">👥 Grupal</Badge>
                  </div>
                  <h4 className="text-base font-bold text-slate-100 mt-1">
                    Proyecto Integrador: Mecánica Orbital C++
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fecha límite: <strong className="text-rose-400">Mañana a las 23:59</strong> • Peso: <strong className="text-slate-200">30%</strong>
                  </p>
                </div>
              </div>
              <Button variant="aeroespacial" size="sm">
                Iniciar Bloque (1.5h)
              </Button>
            </Card>

            {/* Urgent Item 2 */}
            <Card className="flex items-center justify-between p-4 border-l-4 border-l-amber-500">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 mt-0.5">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="software">Software</Badge>
                    <Badge variant="warning">Complejidad Media</Badge>
                    <Badge variant="outline" className="font-mono">👤 Individual</Badge>
                  </div>
                  <h4 className="text-base font-bold text-slate-100 mt-1">
                    Taller 2: Algoritmos Numéricos & Matrices
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fecha límite: <strong className="text-amber-400">En 3 días (Jueves)</strong> • Peso: <strong className="text-slate-200">15%</strong>
                  </p>
                </div>
              </div>
              <Button variant="synergy" size="sm">
                Sinergia (1h)
              </Button>
            </Card>
          </div>
        </div>

        {/* Right Column (1/3): Active Synergies & Exam Readiness */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Sinergias & Exámenes Finales
          </h3>

          {/* Synergy Highlight Card */}
          <Card glowColor="synergy" className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="synergy">Cross-Degree Synergy</Badge>
              <span className="text-[10px] font-mono text-emerald-400">92% Similitud</span>
            </div>
            <h4 className="text-sm font-bold text-slate-100">
              Sinergia: Métodos Numéricos y Matrices
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              El tema de <strong className="text-sky-300">Resolución de Matrices en Aeroespacial</strong> es 92% idéntico a <strong className="text-purple-300">Algoritmos Numéricos en Software</strong>.
            </p>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>1 sola sesión de 45 mins cubre ambas materias esta semana.</span>
            </div>
          </Card>

          {/* Exam Readiness Card */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-slate-400">Preparación Finales Presenciales</span>
              <span className="text-xs font-bold text-sky-400">78% Listo</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full w-[78%]"></div>
            </div>
            <p className="text-[11px] text-slate-400">
              14 de 18 ejes temáticos presenciales en estado <strong className="text-emerald-400">Dominado</strong>.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
