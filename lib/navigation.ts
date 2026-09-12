import {
  Sun,
  LayoutDashboard,
  GitMerge,
  Calendar,
  CheckSquare,
  Video,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type DashboardTab =
  | 'hoy'
  | 'command'
  | 'syllabus'
  | 'schedule'
  | 'deliverables'
  | 'sessions'
  | 'config';

/** FR-041: Hoy es la primera pantalla al abrir Pure y el primer destino de la navegación. */
export const HOME_TAB: DashboardTab = 'hoy';

export interface NavItem {
  id: DashboardTab;
  /** Etiqueta única de la sección. Se usa igual en el sidebar, la barra inferior y el encabezado. */
  label: string;
  icon: LucideIcon;
  /**
   * false = no ocupa slot en la barra inferior móvil (FR-041): Configuración se abre desde el
   * encabezado en su lugar, porque la barra ya tenía 6 destinos. Por defecto true (undefined
   * cuenta como true): todo lo demás sigue apareciendo en móvil sin tener que declararlo.
   */
  mobile?: boolean;
}

/**
 * Fuente única de la navegación.
 *
 * Antes existían tres listas separadas — sidebar, barra inferior y títulos del encabezado — y
 * habían divergido: el mismo destino se llamaba "Master Schedule" en escritorio y "Horarios" en
 * móvil. Cualquier sección nueva se declara aquí una sola vez.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'hoy', label: 'Hoy', icon: Sun },
  { id: 'command', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'syllabus', label: 'Temario', icon: GitMerge },
  { id: 'schedule', label: 'Horarios', icon: Calendar },
  { id: 'deliverables', label: 'Agenda', icon: CheckSquare },
  { id: 'sessions', label: 'Clases', icon: Video },
  { id: 'config', label: 'Configuración', icon: Settings, mobile: false },
];

export function getNavLabel(tab: DashboardTab): string {
  return NAV_ITEMS.find((item) => item.id === tab)?.label ?? NAV_ITEMS[0].label;
}
