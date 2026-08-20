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
  // Chip neutro con hairline; el color de carrera/estado vive solo en el texto,
  // en los tonos muted definidos por los tokens (nada de neón).
  const chip = 'bg-black/[0.03] dark:bg-white/[0.05] border-black/[0.06] dark:border-white/[0.08]';
  const variantClasses = {
    aeroespacial: `${chip} text-aeroespacial`,
    software: `${chip} text-software`,
    synergy: `${chip} text-synergy`,
    warning: `${chip} text-amber-700 dark:text-amber-500`,
    danger: `${chip} text-red-700 dark:text-red-400`,
    no_iniciado: `${chip} text-slate-500 dark:text-slate-400`,
    en_estudio: `${chip} text-amber-700 dark:text-amber-500`,
    repasado: `${chip} text-aeroespacial`,
    dominado: `${chip} text-synergy`,
    outline: `${chip} text-slate-500 dark:text-slate-400`,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
