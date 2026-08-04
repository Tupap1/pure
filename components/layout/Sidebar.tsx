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
      label: 'Command Center',
      icon: LayoutDashboard,
      description: 'Panel de Control & Balance',
    },
    {
      id: 'syllabus' as DashboardTab,
      label: 'Sinergias & Syllabus',
      icon: GitMerge,
      description: 'Overlap Temático & Ejes',
    },
    {
      id: 'schedule' as DashboardTab,
      label: 'Master Schedule',
      icon: Calendar,
      description: 'Horario & Detector Traslapes',
    },
    {
      id: 'deliverables' as DashboardTab,
      label: 'Entregas & Evaluaciones',
      icon: CheckSquare,
      description: 'Entregables, Parciales & Status',
    },
    {
      id: 'config' as DashboardTab,
      label: 'Configuración & CRUD',
      icon: Building2,
      description: 'Universidades & Asignaturas',
    },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-white dark:bg-[#0d121d] border-r border-slate-200 dark:border-slate-800/80 flex-col justify-between h-screen sticky top-0 z-30 transition-colors">
      {/* Brand / Logo */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center font-mono font-bold text-sm shadow-sm">
          P
        </div>
        <div>
          <h1 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-heading">
            PURE
          </h1>
          <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">
            Academic OS
          </p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 relative cursor-pointer ${
                isActive
                  ? 'bg-sky-500/10 dark:bg-sky-950/40 text-sky-400 border border-sky-500/30 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-sky-400"></span>
              )}
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold leading-snug truncate">{item.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Dynamic Universities List in Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="text-[10px] uppercase font-mono text-slate-400 font-medium mb-2 flex items-center gap-1.5 tracking-wider">
          <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
          Universidades ({universities.length})
        </div>
        {universities.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">Sin universidades configuradas</p>
        ) : (
          <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {universities.map((uni) => (
              <div key={uni.id} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <span className="truncate max-w-[170px] text-[11px] font-medium">{uni.name}</span>
                <span
                  className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: uni.color || '#38bdf8' }}
                ></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

