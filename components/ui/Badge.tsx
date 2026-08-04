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
    aeroespacial: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/40 dark:bg-cyan-950/40 glow-aeroespacial',
    software: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/40 dark:bg-purple-950/40 glow-software',
    synergy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 dark:bg-emerald-950/40 glow-synergy',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/40 dark:bg-amber-950/40',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/40 dark:bg-rose-950/40',
    no_iniciado: 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    en_estudio: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/40 animate-pulse',
    repasado: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/40',
    dominado: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/40',
    outline: 'bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase border transition-colors ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
