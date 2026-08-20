import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverEffect = true,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800/30 rounded-xl p-6 shadow-sm transition-all duration-200',
        hoverEffect && 'hover:border-slate-200/60 dark:hover:border-slate-700/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
