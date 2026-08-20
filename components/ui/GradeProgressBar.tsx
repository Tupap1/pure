import React from 'react';

interface GradeProgressBarProps {
  currentGrade: number;
  targetGrade: number;
  scaleMin?: number;
  scaleMax?: number;
  className?: string;
}

export const GradeProgressBar: React.FC<GradeProgressBarProps> = ({
  currentGrade,
  targetGrade,
  scaleMin = 0,
  scaleMax = 5,
  className = '',
}) => {
  const range = scaleMax - scaleMin;
  const currentPercentage = Math.min(Math.max(((currentGrade - scaleMin) / range) * 100, 0), 100);
  const targetPercentage = Math.min(Math.max(((targetGrade - scaleMin) / range) * 100, 0), 100);
  const isAboveTarget = currentGrade >= targetGrade;

  return (
    <div className={`space-y-1.5 font-sans ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-600 dark:text-slate-400">
          Nota: <strong className="text-slate-900 dark:text-slate-100">{currentGrade > 0 ? currentGrade.toFixed(2) : '—'}</strong>
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          Meta: <strong className="text-slate-500 dark:text-slate-400">{targetGrade.toFixed(2)}</strong>
        </span>
      </div>

      <div className="relative h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isAboveTarget ? 'bg-emerald-500' : 'bg-cyan-500'
          }`}
          style={{ width: `${currentPercentage}%` }}
        />

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-slate-100 shadow-sm"
          style={{ left: `${targetPercentage}%` }}
          title={`Meta: ${targetGrade.toFixed(2)}`}
        />
      </div>
    </div>
  );
};
