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
      'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 dark:bg-cyan-950/40',
    software:
      'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/40 dark:bg-purple-950/40',
    synergy:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 dark:bg-emerald-950/40',
    warning:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 dark:bg-amber-950/40',
    danger:
      'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40 dark:bg-rose-950/40',
    no_iniciado:
      'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    en_estudio:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40',
    repasado:
      'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/40',
    dominado:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
    outline:
      'bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border transition-colors',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
