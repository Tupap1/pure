import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="p-8 sm:p-12 text-center border border-dashed border-surface-border rounded-xl bg-surface-subtle/50 space-y-3 font-sans">
      <div className="w-12 h-12 rounded-full bg-surface-subtle text-slate-400 dark:text-slate-500 border border-surface-border flex items-center justify-center mx-auto">
        <Icon className="w-6 h-6 shrink-0" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm sm:text-base font-bold font-heading text-slate-800 dark:text-slate-200">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
};
