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
    aeroespacial: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    software: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    synergy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    no_iniciado: 'bg-slate-800 text-slate-400 border-slate-700',
    en_estudio: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
    repasado: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    dominado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    outline: 'bg-slate-900/60 text-slate-300 border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-md transition-colors ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
