import {
  LayoutDashboard,
  GitMerge,
  Calendar,
  CheckSquare,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type DashboardTab =
  | 'command'
  | 'syllabus'
  | 'schedule'
  | 'deliverables'
  | 'config';

export interface NavItem {
  id: DashboardTab;
  /** Etiqueta única de la sección. Se usa igual en el sidebar, la barra inferior y el encabezado. */
  label: string;
  icon: LucideIcon;
}

/**
 * Fuente única de la navegación.
 *
 * Antes existían tres listas separadas — sidebar, barra inferior y títulos del encabezado — y
 * habían divergido: el mismo destino se llamaba "Master Schedule" en escritorio y "Horarios" en
 * móvil. Cualquier sección nueva se declara aquí una sola vez.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'command', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'syllabus', label: 'Temario', icon: GitMerge },
  { id: 'schedule', label: 'Horarios', icon: Calendar },
  { id: 'deliverables', label: 'Entregas', icon: CheckSquare },
  { id: 'config', label: 'Configuración', icon: Settings },
];

export function getNavLabel(tab: DashboardTab): string {
  return NAV_ITEMS.find((item) => item.id === tab)?.label ?? NAV_ITEMS[0].label;
}
