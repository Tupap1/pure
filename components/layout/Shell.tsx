import React from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { NavigationProvider, useNavigation, type NavView } from '@/lib/hooks/useNavigation';

interface ShellProps {
  children: (view: NavView) => React.ReactNode;
}

/**
 * Cuerpo del shell. Vive dentro del `NavigationProvider` para poder leer la vista activa y
 * pasarla al render-prop; la navegación en sí (sidebar, encabezado, barra inferior) consume
 * el mismo contexto por su cuenta, sin recibir props.
 */
const ShellBody: React.FC<ShellProps> = ({ children }) => {
  const { view } = useNavigation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-slate-900 dark:text-slate-100 transition-colors cyber-grid-bg">
      {/* Desktop Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Header />
        <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto space-y-6">
          {children(view)}
        </main>
      </div>

      {/* Mobile Navigation Bottom Bar */}
      <BottomNav />
    </div>
  );
};

export const Shell: React.FC<ShellProps> = ({ children }) => {
  return (
    <NavigationProvider>
      <ShellBody>{children}</ShellBody>
    </NavigationProvider>
  );
};
