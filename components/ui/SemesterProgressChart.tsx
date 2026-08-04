import React, { useState } from 'react';

export interface SemesterData {
  semester: string; // e.g. "Smt 1"
  gpa: number;      // e.g. 4.2
  credits: number;  // e.g. 18
}

interface SemesterProgressChartProps {
  data?: SemesterData[];
  targetGPA?: number;
}

const defaultData: SemesterData[] = [
  { semester: 'Smt 1', gpa: 4.1, credits: 16 },
  { semester: 'Smt 2', gpa: 4.3, credits: 18 },
  { semester: 'Smt 3', gpa: 3.9, credits: 17 },
  { semester: 'Smt 4', gpa: 4.4, credits: 19 },
  { semester: 'Smt 5', gpa: 4.6, credits: 18 },
  { semester: 'Smt 6', gpa: 4.5, credits: 16 },
  { semester: 'Smt 7', gpa: 4.7, credits: 15 },
  { semester: 'Smt 8', gpa: 4.8, credits: 14 },
];

export const SemesterProgressChart: React.FC<SemesterProgressChartProps> = ({
  data = defaultData,
  targetGPA = 4.5,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(4); // Default hover on Smt 5 like inspo

  const maxGPA = 5.0;
  const height = 180;
  const width = 500;
  const paddingX = 30;
  const paddingTop = 30;
  const paddingBottom = 30;

  const chartHeight = height - paddingTop - paddingBottom;
  const availableWidth = width - paddingX * 2;
  const stepX = availableWidth / (data.length - 1 || 1);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading tracking-tight">
            Evolución de Promedio Académico por Semestre
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Histórico acumulado sobre escala 0.0 - 5.0
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-purple-500 to-sky-400"></span>
            Promedio Real
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-2.5 h-0.5 bg-emerald-400"></span>
            Meta ({targetGPA.toFixed(1)})
          </span>
        </div>
      </div>

      <div className="relative w-full bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-inner">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            {/* Gradient definition matching inspo Cyan to Purple */}
            <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
            </linearGradient>

            <linearGradient id="barGradientHover" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="1" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="1" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Y Axis Guide Lines */}
          {[1.0, 2.0, 3.0, 4.0, 5.0].map((val) => {
            const y = height - paddingBottom - (val / maxGPA) * chartHeight;
            return (
              <g key={val}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800/80"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={12}
                  y={y + 3}
                  className="fill-slate-400 dark:fill-slate-500 text-[9px] font-mono"
                  textAnchor="end"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Target GPA Line */}
          {(() => {
            const targetY = height - paddingBottom - (targetGPA / maxGPA) * chartHeight;
            return (
              <line
                x1={paddingX}
                y1={targetY}
                x2={width - paddingX}
                y2={targetY}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="opacity-75"
              />
            );
          })()}

          {/* Bars */}
          {data.map((item, idx) => {
            const cx = paddingX + idx * stepX;
            const barWidth = 16;
            const x = cx - barWidth / 2;
            const barHeight = (item.gpa / maxGPA) * chartHeight;
            const y = height - paddingBottom - barHeight;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.semester}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredIdx(idx)}
                onClick={() => setHoveredIdx(idx)}
              >
                {/* Background Track Column */}
                <rect
                  x={x - 2}
                  y={paddingTop}
                  width={barWidth + 4}
                  height={chartHeight}
                  rx="6"
                  className="fill-transparent hover:fill-slate-100 dark:hover:fill-slate-900/60 transition-colors"
                />

                {/* Main Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="8"
                  fill={isHovered ? 'url(#barGradientHover)' : 'url(#barGradient)'}
                  filter={isHovered ? 'url(#glow)' : undefined}
                  className="transition-all duration-300"
                />

                {/* X Axis Label */}
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  className={`text-[9px] font-mono transition-colors ${
                    isHovered
                      ? 'fill-sky-600 dark:fill-sky-400 font-bold'
                      : 'fill-slate-500 dark:fill-slate-400'
                  }`}
                >
                  {item.semester}
                </text>

                {/* Floating Tooltip Pill (matching Image 2 inspo) */}
                {isHovered && (
                  <g transform={`translate(${cx}, ${Math.max(12, y - 24)})`}>
                    {/* Tooltip Background Pill */}
                    <rect
                      x="-32"
                      y="-14"
                      width="64"
                      height="20"
                      rx="10"
                      className="fill-slate-900 dark:fill-slate-100 stroke-sky-400 shadow-lg"
                      strokeWidth="1"
                    />
                    {/* Tooltip Text */}
                    <text
                      x="0"
                      y="0"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-slate-100 dark:fill-slate-900 text-[10px] font-mono font-bold"
                    >
                      Nota {item.gpa.toFixed(2)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
