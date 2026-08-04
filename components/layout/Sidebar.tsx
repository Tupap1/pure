import React from 'react';
import {
  LayoutDashboard,
  GitMerge,
  Calendar,
  CheckSquare,
  Building2,
  GraduationCap
} from 'lucide-react';
import { usePureData } from '@/lib/hooks/usePureData';

export type DashboardTab = 'command' | 'syllabus' | 'schedule' | 'deliverables' | 'config';

interface SidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { universities } = usePureData();

  const menuItems = [
    {
      id: 'command' as DashboardTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'syllabus' as DashboardTab,
      label: 'Sinergias & Syllabus',
      icon: GitMerge,
    },
    {
      id: 'schedule' as DashboardTab,
      label: 'Master Schedule',
      icon: Calendar,
    },
    {
      id: 'deliverables' as DashboardTab,
      label: 'Entregas & Evaluaciones',
      icon: CheckSquare,
    },
    {
      id: 'config' as DashboardTab,
      label: 'Configuración',
      icon: Building2,
    },
  ];

  return (
    <aside className="hidden md:flex w-60 bg-white dark:bg-[#090d18] border-r border-slate-200 dark:border-slate-800/80 flex-col justify-between h-screen sticky top-0 z-30 transition-colors">
      {/* Brand / Logo */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-mono font-bold text-sm shadow-sm glow-aeroespacial">
            P
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-heading leading-none">
              PURE OS
            </h1>
            <span className="text-[9px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold tracking-wider uppercase block mt-0.5">
              v2.0 Cybernetic
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 relative cursor-pointer ${
                isActive
                  ? 'bg-sky-500/10 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-sky-500 dark:bg-sky-400"></span>
              )}
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'}`} />
              <span className="text-xs font-semibold leading-snug truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Clean Minimal Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5 truncate">
          <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{universities.length} Institución(es)</span>
        </span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Base de datos local activa" />
      </div>
    </aside>
  );
};


