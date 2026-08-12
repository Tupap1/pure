import React, { useState } from 'react';
import { Sidebar, DashboardTab } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Header } from './Header';

interface ShellProps {
  children: (activeTab: DashboardTab) => React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('command');

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-slate-900 dark:text-slate-100 transition-colors cyber-grid-bg">
      {/* Desktop Navigation Sidebar */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header activeTab={activeTab} />
        <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto space-y-6">
          {children(activeTab)}
        </main>
      </div>

      {/* Mobile Navigation Bottom Bar */}
      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
};
