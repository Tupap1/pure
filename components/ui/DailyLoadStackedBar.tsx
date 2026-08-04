import React from 'react';

export interface DayLoadData {
  dayName: string;   // e.g. "Lun"
  fullDay: string;   // e.g. "Lunes"
  classHours: number; // e.g. 4
  dmeHours: number;   // e.g. 2.5
  sleepHours: number; // 7h
  freeHours: number;  // e.g. 10.5
}

interface DailyLoadStackedBarProps {
  data?: DayLoadData[];
}

const defaultDays: DayLoadData[] = [
  { dayName: 'Lun', fullDay: 'Lunes', classHours: 6, dmeHours: 2.5, sleepHours: 7, freeHours: 8.5 },
  { dayName: 'Mar', fullDay: 'Martes', classHours: 4, dmeHours: 3.0, sleepHours: 7, freeHours: 10.0 },
  { dayName: 'Mié', fullDay: 'Miércoles', classHours: 6, dmeHours: 2.0, sleepHours: 7, freeHours: 9.0 },
  { dayName: 'Jue', fullDay: 'Jueves', classHours: 4, dmeHours: 3.5, sleepHours: 7, freeHours: 9.5 },
  { dayName: 'Vie', fullDay: 'Viernes', classHours: 2, dmeHours: 2.0, sleepHours: 7, freeHours: 13.0 },
  { dayName: 'Sáb', fullDay: 'Sábado', classHours: 0, dmeHours: 4.0, sleepHours: 7, freeHours: 13.0 },
  { dayName: 'Dom', fullDay: 'Domingo', classHours: 0, dmeHours: 1.0, sleepHours: 7, freeHours: 16.0 },
];

export const DailyLoadStackedBar: React.FC<DailyLoadStackedBarProps> = ({ data = defaultDays }) => {
  const totalDayHours = 24;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading tracking-tight">
            Distribución Diaria de Carga (24h por día)
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Comparativo diario: Clases, Estudio DME, Sueño y Tiempo Libre
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Clases
          </span>
          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> DME
          </span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Libre
          </span>
        </div>
      </div>

      <div className="p-4 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
        {data.map((item) => {
          const classPct = (item.classHours / totalDayHours) * 100;
          const dmePct = (item.dmeHours / totalDayHours) * 100;
          const sleepPct = (item.sleepHours / totalDayHours) * 100;
          const freePct = Math.max(0, (item.freeHours / totalDayHours) * 100);

          return (
            <div key={item.dayName} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="font-bold text-slate-800 dark:text-slate-200 w-12">{item.dayName}</span>
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[10px]">
                  {item.classHours > 0 && <span className="text-sky-600 dark:text-sky-400">{item.classHours}h clase</span>}
                  {item.dmeHours > 0 && <span className="text-purple-600 dark:text-purple-400">{item.dmeHours}h DME</span>}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{item.freeHours.toFixed(1)}h libre</span>
                </div>
              </div>

              {/* Stacked Progress Bar Line */}
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden flex shadow-inner">
                {classPct > 0 && (
                  <div
                    className="bg-sky-500 h-full transition-all duration-300"
                    style={{ width: `${classPct}%` }}
                    title={`${item.fullDay}: ${item.classHours}h clases`}
                  />
                )}
                {dmePct > 0 && (
                  <div
                    className="bg-purple-500 h-full transition-all duration-300"
                    style={{ width: `${dmePct}%` }}
                    title={`${item.fullDay}: ${item.dmeHours}h estudio DME`}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
