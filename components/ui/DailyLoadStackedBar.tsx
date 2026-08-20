import React from 'react';

export interface DayLoadData {
  dayName: string;   // e.g. "Lun"
  fullDay: string;   // e.g. "Lunes"
  classHours: number; // e.g. 4
  dmeHours?: number;   // e.g. 2.5
  independentHours?: number; // e.g. 2.5
  sleepHours: number; // 7h
  freeHours: number;  // e.g. 10.5
  isOverloaded?: boolean;
}

interface DailyLoadStackedBarProps {
  data: DayLoadData[];
}

export const DailyLoadStackedBar: React.FC<DailyLoadStackedBarProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 space-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sin datos de horario o materias registradas para calcular la carga diaria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading tracking-tight">
            Distribución Diaria de Carga (24h por día)
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Clases reales + Trabajo independiente (meta semanal distribuida en 7 días)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-sans flex-wrap">
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Clases
          </span>
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> Independiente
          </span>
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Libre
          </span>
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Exceso
          </span>
        </div>
      </div>

      <div className="p-4 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
        {data.map((item) => {
          const indepHours = item.independentHours ?? item.dmeHours ?? 0;
          const isOverloaded = item.freeHours < 0;
          const excessHours = isOverloaded ? Math.abs(item.freeHours) : 0;
          const totalNeeded = Math.max(24, item.classHours + indepHours + item.sleepHours);

          const classPct = (item.classHours / totalNeeded) * 100;
          const indepPct = (indepHours / totalNeeded) * 100;
          const sleepPct = (item.sleepHours / totalNeeded) * 100;
          const freePct = !isOverloaded ? (item.freeHours / 24) * 100 : 0;
          const excessPct = isOverloaded ? (excessHours / totalNeeded) * 100 : 0;

          return (
            <div key={item.dayName} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-800 dark:text-slate-200 w-12 font-sans">{item.dayName}</span>
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[10px] font-mono">
                  {item.classHours > 0 && <span className="text-slate-500 dark:text-slate-400">{item.classHours.toFixed(1)}h clase</span>}
                  {indepHours > 0 && <span className="text-slate-500 dark:text-slate-400">{indepHours.toFixed(1)}h indep.</span>}
                  {isOverloaded ? (
                    <span className="font-bold text-rose-600 dark:text-rose-400">{item.freeHours.toFixed(1)}h exceso</span>
                  ) : (
                    <span className="font-bold text-slate-500 dark:text-slate-400">{item.freeHours.toFixed(1)}h libre</span>
                  )}
                </div>
              </div>

              {/* Stacked Progress Bar Line */}
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden flex shadow-inner">
                {classPct > 0 && (
                  <div
                    className="bg-sky-500 h-full transition-all duration-300"
                    style={{ width: `${classPct}%` }}
                    title={`${item.fullDay}: ${item.classHours.toFixed(1)}h clases`}
                  />
                )}
                {indepPct > 0 && (
                  <div
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${indepPct}%` }}
                    title={`${item.fullDay}: ${indepHours.toFixed(1)}h trabajo independiente (meta)`}
                  />
                )}
                <div
                  className="bg-slate-400 dark:bg-slate-700 h-full transition-all duration-300"
                  style={{ width: `${sleepPct}%` }}
                  title={`${item.fullDay}: ${item.sleepHours}h descanso`}
                />
                {freePct > 0 && (
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${freePct}%` }}
                    title={`${item.fullDay}: ${item.freeHours.toFixed(1)}h tiempo libre`}
                  />
                )}
                {excessPct > 0 && (
                  <div
                    className="bg-rose-500 h-full transition-all duration-300 animate-pulse"
                    style={{ width: `${excessPct}%` }}
                    title={`${item.fullDay}: ${excessHours.toFixed(1)}h sobrecarga (déficit)`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
