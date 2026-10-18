import { Boxes, ChartLine, ClipboardList, Database, LayoutDashboard, Settings } from 'lucide-react'
import type { SidebarEntry } from './SidebarItem'

/**
 * Entradas de navegación (plan 7.2): el id coincide con el nombre de
 * feature y con la ruta del Paso 5 (HashRouter).
 */
export const SIDEBAR_ENTRIES: SidebarEntry[] = [
  { id: 'overview', label: 'Resumen', path: '/overview', icon: LayoutDashboard },
  { id: 'variants', label: 'Variantes e inventario', path: '/variants', icon: Boxes },
  { id: 'forecasts', label: 'Pronósticos', path: '/forecasts', icon: ChartLine },
  {
    id: 'recommendations',
    label: 'Recomendaciones',
    path: '/recommendations',
    icon: ClipboardList
  },
  { id: 'data-status', label: 'Estado de datos', path: '/data-status', icon: Database },
  { id: 'settings', label: 'Ajustes', path: '/settings', icon: Settings }
]
