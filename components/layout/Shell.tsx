import React, { useState } from 'react';
import { Sidebar, DashboardTab } from './Sidebar';
import { Header } from './Header';

interface ShellProps {
  children: (activeTab: DashboardTab) => React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('command');

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-sky-500/30 selection:text-sky-900 dark:selection:text-sky-200 transition-colors">
      {/* Navigation Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
          {children(activeTab)}
        </main>
      </div>
    </div>
  );
};
