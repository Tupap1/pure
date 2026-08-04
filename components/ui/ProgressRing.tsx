import React from 'react';

interface ProgressRingProps {
  progress: number; // 0 a 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export interface RingSegment {
  progress: number; // 0 to 100
  color: string;    // hex or css color
  label: string;    // name
}

interface MultiProgressRingProps {
  rings: RingSegment[];
  size?: number;
  strokeWidth?: number;
  centerTitle?: string;
  centerSubtitle?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 10,
  color = '#10b981',
  label,
  sublabel,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label && <span className="text-xl font-bold font-heading text-slate-900 dark:text-slate-100">{label}</span>}
        {sublabel && <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{sublabel}</span>}
      </div>
    </div>
  );
};

export const MultiProgressRing: React.FC<MultiProgressRingProps> = ({
  rings,
  size = 140,
  strokeWidth = 8,
  centerTitle,
  centerSubtitle,
}) => {
  const gap = 3;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {rings.map((ring, idx) => {
          const radius = (size - strokeWidth) / 2 - idx * (strokeWidth + gap);
          if (radius <= 0) return null;

          const circumference = radius * 2 * Math.PI;
          const clamped = Math.min(100, Math.max(0, ring.progress));
          const strokeDashoffset = circumference - (clamped / 100) * circumference;

          return (
            <g key={ring.label}>
              {/* Background Ring Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="rgba(148, 163, 184, 0.15)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Concentric Progress Segment */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </g>
          );
        })}
      </svg>
      {(centerTitle || centerSubtitle) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          {centerTitle && (
            <span className="text-base font-extrabold font-heading text-slate-900 dark:text-slate-100 leading-none">
              {centerTitle}
            </span>
          )}
          {centerSubtitle && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 leading-tight">
              {centerSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
