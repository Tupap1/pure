import React from 'react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, type DashboardTab } from '@/lib/navigation';

interface BottomNavProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav
      role="tablist"
      aria-label="Secciones"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-obsidian-900/95 backdrop-blur-md border-t border-surface-border px-2 py-1.5 flex items-center justify-around"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectTab(item.id)}
            className={cn(
              'min-h-[44px] min-w-[44px] flex flex-col items-center justify-center flex-1 px-1 py-1 rounded-lg border transition-colors duration-200',
              isActive
                ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border-cyan-500/30 font-semibold'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <Icon className={cn('w-5 h-5', isActive ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-400')} />
            <span className="text-[11px] mt-0.5 tracking-tight leading-tight font-semibold">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
