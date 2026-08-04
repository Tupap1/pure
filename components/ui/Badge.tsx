import React from 'react';

interface BadgeProps {
  variant?:
    | 'aeroespacial'
    | 'software'
    | 'synergy'
    | 'warning'
    | 'danger'
    | 'no_iniciado'
    | 'en_estudio'
    | 'repasado'
    | 'dominado'
    | 'outline';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'outline',
  children,
  className = '',
}) => {
  const variantClasses = {
    aeroespacial: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 dark:bg-sky-950/40',
    software: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 dark:bg-purple-950/40',
    synergy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 dark:bg-emerald-950/40',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:bg-amber-950/40',
    danger: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 dark:bg-rose-950/40',
    no_iniciado: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/80',
    en_estudio: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 animate-pulse',
    repasado: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40',
    dominado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
    outline: 'bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium tracking-tight border transition-colors ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};


