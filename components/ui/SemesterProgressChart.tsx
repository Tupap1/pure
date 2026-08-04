import React from 'react';
import { Badge } from './Badge';

export interface SemesterData {
  semester: string; // e.g. "Cálculo Diferencial" or "2585132"
  name?: string;     // Full name if available
  gpa: number;      // Current grade e.g. 0.00 or 4.20
  credits: number;  // e.g. 3
}

interface SemesterProgressChartProps {
  data?: SemesterData[];
  targetGPA?: number;
}

export const SemesterProgressChart: React.FC<SemesterProgressChartProps> = ({
  data = [],
  targetGPA = 4.5,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading tracking-tight">
              Desempeño Académico por Asignatura
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Progreso ponderado sobre escala 0.0 - 5.0
            </p>
          </div>
        </div>

        <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Sin notas registradas aún
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Ingresa a <span className="font-mono text-cyan-600 dark:text-cyan-400">Configuración</span> para registrar tus asignaturas y calificaciones.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading tracking-tight">
            Desempeño & Proyección por Asignatura
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Calificaciones actuales respecto a la meta ({targetGPA.toFixed(1)})
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></span> Nota
          </span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="w-2.5 h-0.5 bg-emerald-400"></span> Meta
          </span>
        </div>
      </div>

      <div className="p-4 bg-slate-50/50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-none">
        {data.map((item, idx) => {
          const maxGrade = 5.0;
          const currentPct = Math.min(100, Math.max(0, (item.gpa / maxGrade) * 100));
          const targetPct = Math.min(100, Math.max(0, (targetGPA / maxGrade) * 100));
          const isAboveTarget = item.gpa >= targetGPA;

          return (
            <div
              key={idx}
              className="p-3 rounded-lg bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/80 space-y-2 hover:border-cyan-500/40 transition-colors"
            >
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs font-heading">
                    {item.name || item.semester}
                  </span>
                  {item.semester && item.name && (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      [{item.semester}]
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">{item.credits} crd</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {item.gpa.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">/ 5.0</span>
                </div>
              </div>

              {/* Horizontal Bar with Target Marker Line */}
              <div className="relative h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                {/* Target Marker Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 z-10 opacity-80"
                  style={{ left: `${targetPct}%` }}
                  title={`Meta: ${targetGPA.toFixed(1)}`}
                />
                {/* Filled Progress Bar */}
                <div
                  className={`h-full transition-all duration-500 ${
                    isAboveTarget
                      ? 'bg-emerald-500'
                      : item.gpa > 0
                      ? 'bg-cyan-500'
                      : 'bg-slate-400 dark:bg-slate-700'
                  }`}
                  style={{ width: `${Math.max(2, currentPct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
