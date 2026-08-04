import React from 'react';
import {
  LayoutDashboard,
  GitMerge,
  Calendar,
  CheckSquare,
  Building2
} from 'lucide-react';
import { DashboardTab } from './Sidebar';

interface BottomNavProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const menuItems = [
    { id: 'command' as DashboardTab, label: 'Inicio', icon: LayoutDashboard },
    { id: 'syllabus' as DashboardTab, label: 'Temario', icon: GitMerge },
    { id: 'schedule' as DashboardTab, label: 'Horarios', icon: Calendar },
    { id: 'deliverables' as DashboardTab, label: 'Entregas', icon: CheckSquare },
    { id: 'config' as DashboardTab, label: 'Ajustes', icon: Building2 },
  ];

  return (
    <nav aria-label="Navegación Móvil Inferior" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center flex-1 px-1 py-1 rounded-xl transition-all duration-200 ${
              isActive
                ? 'text-sky-400 bg-sky-500/10 font-medium scale-105'
                : 'text-slate-400 hover:text-slate-200 active:scale-95'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
            <span className="text-[10px] mt-0.5 tracking-tight leading-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
