import React from 'react';
import { cn } from '@/lib/utils';
import { GraduationCap, BookOpen } from 'lucide-react';
import { usePureData } from '@/lib/hooks/usePureData';
import { useNavigation } from '@/lib/hooks/useNavigation';
import { NAV_ITEMS, type DashboardTab } from '@/lib/navigation';

export type { DashboardTab };

export const Sidebar: React.FC = () => {
  const { universities } = usePureData();
  const { view, selectTab, openSubjectsIndex } = useNavigation();

  // Cuando el hub de asignatura está activo, ninguna pestaña de función se marca seleccionada.
  const activeTab: DashboardTab | null = view.kind === 'tab' ? view.tab : null;
  const isSubjectsActive = view.kind === 'subjects-index' || view.kind === 'subject';

  const itemClass = (active: boolean) =>
    cn(
      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors duration-150 cursor-pointer',
      active
        ? 'bg-surface-subtle text-slate-900 dark:text-slate-100 font-medium'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
    );

  const iconClass = (active: boolean) =>
    cn('w-4 h-4 shrink-0', active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500');

  return (
    <aside className="hidden md:flex w-60 bg-white dark:bg-obsidian-900 border-r border-surface-border flex-col justify-between h-screen sticky top-0 z-30 transition-colors">
      {/* Brand / Logo */}
      <div className="p-4 border-b border-surface-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface-subtle text-slate-700 dark:text-slate-200 border border-surface-border flex items-center justify-center font-bold text-sm">
          P
        </div>
        <h1 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-heading leading-none">
          PURE OS
        </h1>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="tablist" aria-label="Secciones">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(item.id)}
              className={itemClass(isActive)}
            >
              <Icon className={iconClass(isActive)} />
              <span className="text-xs font-semibold leading-snug truncate">{item.label}</span>
            </button>
          );
        })}

        {/* Asignaturas — superficie de detalle (drill-in), fuera de NAV_ITEMS para no ocupar
            un slot en la barra inferior, que mapea la misma lista. */}
        <div className="pt-1 mt-1 border-t border-surface-border">
          <button
            role="tab"
            aria-selected={isSubjectsActive}
            onClick={openSubjectsIndex}
            className={itemClass(isSubjectsActive)}
          >
            <BookOpen className={iconClass(isSubjectsActive)} />
            <span className="text-xs font-semibold leading-snug truncate">Asignaturas</span>
          </button>
        </div>
      </nav>

      {/* Clean Minimal Footer */}
      <div className="p-3 border-t border-surface-border bg-slate-50/50 dark:bg-slate-950/40 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="truncate">
          <span className="font-mono font-semibold">{universities.length}</span>{' '}
          {universities.length === 1 ? 'institución' : 'instituciones'}
        </span>
      </div>
    </aside>
  );
};
