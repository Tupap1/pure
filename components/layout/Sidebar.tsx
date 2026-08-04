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
      description: 'Panel de Control y Tiempo Libre',
    },
    {
      id: 'syllabus' as DashboardTab,
      label: 'Sinergias & Syllabus',
      icon: GitMerge,
      description: 'Ejes Temáticos y Cross-Degree',
    },
    {
      id: 'schedule' as DashboardTab,
      label: 'Master Schedule',
      icon: Calendar,
      description: 'Calendario y Traslapes',
    },
    {
      id: 'deliverables' as DashboardTab,
      label: 'Entregas & Finales',
      icon: CheckSquare,
      description: 'Trabajos, Parciales y Grupos',
    },
    {
      id: 'config' as DashboardTab,
      label: 'Configuración & CRUD',
      icon: Building2,
      description: 'Universidades, Materias y Profesores',
    },
  ];

  return (
    <aside className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between h-screen sticky top-0 z-30 transition-colors">
      {/* Brand / Logo */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-600 text-slate-50 flex items-center justify-center font-bold">
          P
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            PURE
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
            Academic OS
          </p>
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-sky-100 dark:bg-slate-800 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-slate-700 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <div>
                <div className="text-xs font-semibold leading-snug">{item.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Dynamic Universities List in Footer (Only if exist) */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40">
        <div className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-medium mb-2 flex items-center gap-1.5">
          <GraduationCap className="w-3 h-3 text-sky-600 dark:text-sky-400" />
          Universidades ({universities.length})
        </div>
        {universities.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">Sin universidades configuradas</p>
        ) : (
          <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {universities.map((uni) => (
              <div key={uni.id} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <span className="truncate max-w-[170px] text-[11px]">{uni.name}</span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
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
