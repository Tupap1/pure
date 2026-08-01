import React from 'react';
import {
  LayoutDashboard,
  GitMerge,
  Calendar,
  CheckSquare,
  Building2,
  Sparkles
} from 'lucide-react';

export type DashboardTab = 'command' | 'syllabus' | 'schedule' | 'deliverables' | 'config';

interface SidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
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
      label: 'Universidades & Profe',
      icon: Building2,
      description: 'CRUD de Entidades Base',
    },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 z-30">
      {/* Brand / Logo */}
      <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-purple-500 to-emerald-400 p-0.5 shadow-lg shadow-sky-500/20">
          <div className="w-full h-full bg-[#070a12] rounded-[10px] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-sky-400" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold font-heading bg-gradient-to-r from-sky-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">
            PURE
          </h1>
          <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
            Doble Ingeniería OS
          </p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-200 group ${
                isActive
                  ? 'bg-slate-800/90 text-sky-400 border border-sky-500/30 shadow-lg shadow-sky-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-sky-400' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-sm font-semibold leading-none">{item.label}</div>
                <div className="text-[10px] text-slate-400 mt-1">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/60 m-3 glass-panel rounded-xl">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">Uni 1 (Aero)</span>
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
          <span className="font-mono">Uni 2 (Soft)</span>
          <span className="w-2 h-2 rounded-full bg-purple-400"></span>
        </div>
      </div>
    </aside>
  );
};
