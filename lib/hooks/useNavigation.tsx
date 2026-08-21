import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { DashboardTab } from '@/lib/navigation';

/**
 * Modelo de la vista activa de la app.
 *
 * Hasta ahora la navegación era un único `DashboardTab` suelto en `Shell`. El hub de
 * asignatura añade dos superficies de detalle a las que se llega por drill-in (tocando una
 * materia), no por la barra de pestañas: el índice de materias y el hub de una materia
 * concreta. Modelarlas como una unión discriminada mantiene explícito, en un solo lugar, en
 * qué superficie está el usuario.
 */
export type NavView =
  | { kind: 'tab'; tab: DashboardTab }
  | { kind: 'subjects-index' }
  | { kind: 'subject'; subjectId: string };

export interface NavigationContextValue {
  view: NavView;
  /** Salta a una de las seis pestañas de función. */
  selectTab: (tab: DashboardTab) => void;
  /** Abre el índice de materias (superficie de detalle, no una pestaña). */
  openSubjectsIndex: () => void;
  /** Entra al hub de una materia concreta. */
  openSubject: (subjectId: string) => void;
  /** Vuelve un nivel: del hub al índice; de cualquier otra superficie, al Dashboard. */
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

/**
 * Primer React Context del repositorio (decisión consciente). Vive lo más alto posible —
 * envolviendo al `Shell`— para que tanto la navegación (sidebar, encabezado) como las tablas
 * de materias enterradas en los dashboards puedan disparar el drill-in sin prop-drilling.
 */
export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setView] = useState<NavView>({ kind: 'tab', tab: 'command' });

  const selectTab = useCallback((tab: DashboardTab) => setView({ kind: 'tab', tab }), []);
  const openSubjectsIndex = useCallback(() => setView({ kind: 'subjects-index' }), []);
  const openSubject = useCallback(
    (subjectId: string) => setView({ kind: 'subject', subjectId }),
    []
  );
  const goBack = useCallback(() => {
    setView((prev) =>
      prev.kind === 'subject' ? { kind: 'subjects-index' } : { kind: 'tab', tab: 'command' }
    );
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({ view, selectTab, openSubjectsIndex, openSubject, goBack }),
    [view, selectTab, openSubjectsIndex, openSubject, goBack]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation debe usarse dentro de <NavigationProvider>.');
  }
  return ctx;
}
