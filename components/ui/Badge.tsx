import React from 'react';
import { cn } from '@/lib/utils';

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

/**
 * Etiqueta de estado. Su contenido es texto, no dato numérico, por lo que usa la
 * fuente de interfaz: DESIGN.md reserva JetBrains Mono estrictamente para cifras.
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'outline',
  children,
  className = '',
}) => {
  const variantClasses = {
    aeroespacial:
      'bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 dark:bg-cyan-950/20',
    software:
      'bg-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20 dark:bg-purple-950/20',
    synergy:
      'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:bg-emerald-950/20',
    warning:
      'bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:bg-amber-950/20',
    danger:
      'bg-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:bg-rose-950/20',
    no_iniciado:
      'bg-slate-100/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200/40 dark:border-slate-800/30',
    en_estudio:
      'bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20',
    repasado:
      'bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    dominado:
      'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    outline:
      'bg-slate-100/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200/40 dark:border-slate-800/30',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
