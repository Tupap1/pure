import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { cn } from '@/lib/utils';

interface StatTileProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'highlight' | 'warning' | 'danger';
  className?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  className,
}) => {
  const variantStyles = {
    default: 'text-slate-900 dark:text-slate-100',
    highlight: 'text-cyan-600 dark:text-cyan-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
  };

  return (
    <Card className={cn('p-4 space-y-2 font-sans', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-heading truncate">
          {title}
        </span>
        {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
      </div>

      <div className="space-y-0.5">
        <div className={cn('text-xl font-bold font-mono tracking-tight', variantStyles[variant])}>
          {value}
        </div>
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-snug">
            {subtitle}
          </p>
        )}
      </div>
    </Card>
  );
};
