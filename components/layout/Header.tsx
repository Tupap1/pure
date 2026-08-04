import React from 'react';
import { Clock, Cpu, Sun, Moon } from 'lucide-react';
import { usePureData } from '@/lib/hooks/usePureData';
import { useTheme } from '@/lib/hooks/useTheme';
import { calculateDME, calculateNetFreeTime } from '@/lib/algorithms/study-hours-dme';

export const Header: React.FC = () => {
  const { subjects, schedules, universities } = usePureData();
  const { theme, toggleTheme } = useTheme();

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
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-[#0d121d]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between transition-colors">
      {/* Title / Context */}
      <div className="min-w-0 pr-2">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate tracking-tight">
          PURE <span className="text-xs font-mono font-normal text-slate-400 hidden sm:inline">• Academic OS</span>
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {universities.length > 0
            ? `${universities.length} Universidades • ${subjects.length} Asignaturas Activas`
            : 'Sistema de Eficiencia Académica Multi-Universidad'}
        </p>
      </div>

      {/* Metric Quick Indicators & Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Net Free Time Metric (Compact on mobile) */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase font-mono text-slate-400 font-medium leading-none">
              Libre Net
            </div>
            <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {netFreeTimeHours}h
            </div>
          </div>
        </div>

        {/* DME Metric */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          <Cpu className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 font-medium leading-none">
              DME Semanal
            </div>
            <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {totalDMEHours.toFixed(1)}h
            </div>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700/80 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};

