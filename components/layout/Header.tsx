import React from 'react';
import { Clock, Cpu, GitMerge } from 'lucide-react';
import { usePureData } from '@/lib/hooks/usePureData';
import { calculateDME, calculateNetFreeTime } from '@/lib/algorithms/study-hours-dme';

export const Header: React.FC = () => {
  const { subjects, deliverables, schedules, universities } = usePureData();

  const totalDMEHours = subjects.reduce((sum, s) => {
    return sum + calculateDME(s as any).recommendedWeeklyHours;
  }, 0);

  const classHours = schedules.reduce((sum, s) => {
    const startHour = parseInt(s.start_time.split(':')[0], 10);
    const endHour = parseInt(s.end_time.split(':')[0], 10);
    return sum + Math.max(0, endHour - startHour);
  }, 0);

  const netFreeTimeHours = calculateNetFreeTime({
    classHours,
    dmeHours: totalDMEHours,
    sleepHoursPerNight: 7,
  });

  return (
    <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between">
      {/* Title / Context */}
      <div>
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          Gestión Académica Multi-Universidad
        </h2>
        <p className="text-xs text-slate-400">
          {universities.length > 0
            ? `${universities.length} Universidades • ${subjects.length} Asignaturas Registradas`
            : 'Configura tus universidades y materias para comenzar'}
        </p>
      </div>

      {/* Metric Quick Indicators */}
      <div className="flex items-center gap-4">
        {/* Net Free Time Metric */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
          <Clock className="w-4 h-4 text-emerald-400" />
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 font-medium">
              Tiempo Libre Neto
            </div>
            <div className="text-xs font-bold text-slate-100">
              {netFreeTimeHours}h / sem
            </div>
          </div>
        </div>

        {/* DME Metric */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
          <Cpu className="w-4 h-4 text-sky-400" />
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 font-medium">
              DME Estudio
            </div>
            <div className="text-xs font-bold text-slate-100">
              {totalDMEHours.toFixed(1)}h / sem
            </div>
          </div>
        </div>

        {/* Synergies Metric */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
          <GitMerge className="w-4 h-4 text-indigo-400" />
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 font-medium">
              Materias Activas
            </div>
            <div className="text-xs font-bold text-slate-100">
              {subjects.length}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
