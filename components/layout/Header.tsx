import React from 'react';
import { Clock, ShieldCheck, Cpu, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface HeaderProps {
  netFreeTimeHours?: number;
  totalDMEHours?: number;
  synergiesCount?: number;
  isOnline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  netFreeTimeHours = 89,
  totalDMEHours = 12.5,
  synergiesCount = 3,
  isOnline = true,
}) => {
  return (
    <header className="sticky top-0 z-20 glass-panel border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
      {/* Title / Context */}
      <div>
        <h2 className="text-lg font-bold font-heading text-slate-100 flex items-center gap-2">
          Dashboard de Eficiencia Académica
          <Badge variant="synergy">Dosis Mínima Eficaz Active</Badge>
        </h2>
        <p className="text-xs text-slate-400">
          Ingeniería Aeroespacial (Presencial) + Ingeniería de Software (Virtual)
        </p>
      </div>

      {/* Metric Quick Indicators */}
      <div className="flex items-center gap-4">
        {/* Net Free Time Metric */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 glow-synergy">
          <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div>
            <div className="text-[10px] uppercase font-mono text-emerald-400 font-semibold">
              Tiempo Libre Neto
            </div>
            <div className="text-sm font-bold text-slate-100 font-heading">
              {netFreeTimeHours}h / semana
            </div>
          </div>
        </div>

        {/* DME Metric */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25">
          <Cpu className="w-4 h-4 text-sky-400" />
          <div>
            <div className="text-[10px] uppercase font-mono text-sky-400 font-semibold">
              DME Estudio
            </div>
            <div className="text-sm font-bold text-slate-100 font-heading">
              {totalDMEHours}h
            </div>
          </div>
        </div>

        {/* Synergies Metric */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/25">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <div>
            <div className="text-[10px] uppercase font-mono text-purple-400 font-semibold">
              Sinergias
            </div>
            <div className="text-sm font-bold text-slate-100 font-heading">
              {synergiesCount} Materias
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 pl-2 border-l border-slate-800">
          <Wifi className={`w-4 h-4 ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="font-mono text-[11px]">{isOnline ? 'Local-First' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
};
