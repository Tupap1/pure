import React from 'react';
import { cn } from '@/lib/utils';

export interface FilterTabOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterTabsProps {
  options: FilterTabOption[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  options,
  activeId,
  onChange,
  className,
}) => {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-sans',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = activeId === opt.id;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg border font-medium transition-all shrink-0 flex items-center gap-1.5',
              isActive
                ? 'bg-cyan-600 text-white border-cyan-500 font-bold shadow-sm'
                : 'bg-surface text-slate-600 dark:text-slate-400 border-surface-border hover:border-surface-hover'
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span className="font-mono opacity-80 text-[11px]">({opt.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
