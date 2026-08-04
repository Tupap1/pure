import React, { useState } from 'react';

export interface HeatmapDay {
  date: string;       // YYYY-MM-DD
  hours: number;      // e.g. 2.5
  intensity: 0 | 1 | 2 | 3 | 4; // 0 = 0h, 1 = 1-2h, 2 = 3-4h, 3 = 5-6h, 4 = 7h+
}

interface StudyHeatmapProps {
  days?: HeatmapDay[];
}

const intensityStyles = {
  0: 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800/80',
  1: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  2: 'bg-emerald-300 dark:bg-emerald-800/80 text-emerald-950 dark:text-emerald-200 border-emerald-400 dark:border-emerald-700',
  3: 'bg-emerald-500 dark:bg-emerald-600 text-white border-emerald-600 dark:border-emerald-500 shadow-sm shadow-emerald-500/20',
  4: 'bg-emerald-600 dark:bg-emerald-400 text-white dark:text-slate-950 font-bold border-emerald-500 dark:border-emerald-300 shadow-md shadow-emerald-500/30',
};

export const StudyHeatmap: React.FC<StudyHeatmapProps> = ({ days = [] }) => {
  const [activeHovered, setActiveHovered] = useState<HeatmapDay | null>(days.length > 0 ? days[days.length - 1] : null);

  const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const totalHours = days.reduce((sum, d) => sum + d.hours, 0);
  const activeDaysCount = days.filter((d) => d.hours > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading tracking-tight">
            Matriz de Intensidad de Estudio (Últimos 28 Días)
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Registro visual de horas DME y entregas completadas por día
          </p>
        </div>
        <div className="text-right font-mono">
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {totalHours.toFixed(1)}h acumuladas
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            {activeDaysCount} de 28 días activos
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
        {days.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
            Sin datos de actividad para los últimos 28 días.
          </div>
        ) : (
          /* Heatmap Grid (7 rows x 4 cols = 28 squares) */
          <div className="grid grid-cols-7 gap-2">
            {days.map((item, idx) => {
              const isHovered = activeHovered?.date === item.date;
              const dateObj = new Date(item.date + 'T00:00:00');
              const dayName = dayLabels[idx % 7];
              const formattedDate = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

              return (
                <button
                  key={item.date}
                  onMouseEnter={() => setActiveHovered(item)}
                  onClick={() => setActiveHovered(item)}
                  className={`h-9 rounded-lg border text-xs font-mono transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                    intensityStyles[item.intensity]
                  } ${isHovered ? 'ring-2 ring-cyan-400 scale-105 z-10' : 'hover:scale-105'}`}
                >
                  <span className="text-[9px] opacity-70 leading-none">{dayName}</span>
                  <span className="text-[11px] font-bold leading-tight mt-0.5">
                    {item.hours > 0 ? `${item.hours.toFixed(1)}h` : '-'}
                  </span>

                  {/* Hover Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-mono px-2.5 py-1 rounded-md border border-slate-700 shadow-xl whitespace-nowrap z-30 pointer-events-none">
                      {formattedDate}: {item.hours > 0 ? `${item.hours.toFixed(1)} hrs estudio/entregas` : 'Descanso'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend Indicator */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800/80">
          <span>Menos intensidad</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800" />
            <span className="w-2.5 h-2.5 rounded bg-emerald-200 dark:bg-emerald-950 border border-emerald-400" />
            <span className="w-2.5 h-2.5 rounded bg-emerald-400 dark:bg-emerald-700" />
            <span className="w-2.5 h-2.5 rounded bg-emerald-600 dark:bg-emerald-400" />
          </div>
          <span>Más intensidad</span>
        </div>
      </div>
    </div>
  );
};
