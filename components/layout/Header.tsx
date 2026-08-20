import React from 'react';
import { Clock, Cpu, Sun, Moon, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/lib/hooks/useTheme';
import { useAcademicLoad } from '@/lib/hooks/useAcademicLoad';

import { getNavLabel, type DashboardTab } from '@/lib/navigation';

interface HeaderProps {
  activeTab?: DashboardTab;
}

export const Header: React.FC<HeaderProps> = ({ activeTab = 'command' }) => {
  const { normativeIndependentHours, netFreeTime, isOverloaded } = useAcademicLoad();
  const { theme, toggleTheme } = useTheme();

  const title = getNavLabel(activeTab);

  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-obsidian-900/90 backdrop-blur-md border-b border-surface-border px-4 sm:px-6 py-3.5 flex items-center justify-between transition-colors">
      {/* Title / Context */}
      <div className="min-w-0 pr-2">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate tracking-tight font-heading">
          {title}
        </h2>
      </div>

      {/* Metric Quick Indicators & Theme Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Net Free Time — puede ser negativo cuando la carga no cabe en la semana */}
        <div
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border ${
            isOverloaded
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-900/70'
              : 'bg-surface-subtle border-surface-border'
          }`}
          title={
            isOverloaded
              ? 'Sobrecarga: la carga académica más el sueño superan las 168h de la semana'
              : 'Tiempo libre neto: 168h menos clase, trabajo independiente y sueño'
          }
        >
          {isOverloaded ? (
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 dark:text-red-400 shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          )}
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase text-slate-500 dark:text-slate-400 font-medium leading-none tracking-wide">
              {isOverloaded ? 'Sobrecarga' : 'Libre'}
            </div>
            <div
              className={`text-xs font-mono font-bold leading-tight ${
                isOverloaded ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {netFreeTime.toFixed(1)}h/sem
            </div>
          </div>
        </div>

        {/* Trabajo independiente exigido por la norma de créditos */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-subtle border border-surface-border"
          title="Trabajo independiente semanal según el Decreto 1075 de 2015: 48h por crédito por semestre, menos tus horas de clase"
        >
          <Cpu className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-medium leading-none tracking-wide">
              Independiente
            </div>
            <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {normativeIndependentHours.toFixed(1)}h/sem
            </div>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-surface-subtle text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 border border-surface-border transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};


