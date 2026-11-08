import { ChevronsLeft, ChevronsRight, Store } from 'lucide-react'
import { SidebarItem } from './SidebarItem'
import { SIDEBAR_ENTRIES } from './sidebarEntries'
import type { SidebarEntry } from './SidebarItem'

interface AppSidebarProps {
  activeId: string
  collapsed: boolean
  onSelect: (entry: SidebarEntry) => void
  onToggleCollapsed: () => void
}

export function AppSidebar({
  activeId,
  collapsed,
  onToggleCollapsed,
  onSelect
}: AppSidebarProps): React.JSX.Element {
  return (
    <aside className="one-sidebar" aria-label="Navegación principal">
      <div className="one-sidebar-heading">
        {!collapsed && <span>Navegación</span>}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="one-sidebar-toggle"
          aria-label={collapsed ? 'Desplegar navegación' : 'Plegar navegación'}
          aria-expanded={!collapsed}
          aria-controls="retail-navigation"
          title={collapsed ? 'Desplegar navegación' : 'Plegar navegación'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>
      <nav id="retail-navigation" className="one-sidebar-nav">
        {!collapsed && <p className="one-nav-label">ANÁLISIS COMERCIAL</p>}
        {SIDEBAR_ENTRIES.slice(0, 5).map((entry) => (
          <SidebarItem
            key={entry.id}
            entry={entry}
            active={entry.id === activeId}
            collapsed={collapsed}
            onSelect={onSelect}
          />
        ))}
        <div className="one-nav-separator" />
        {!collapsed && <p className="one-nav-label">ESPACIO DE TRABAJO</p>}
        {SIDEBAR_ENTRIES.slice(5).map((entry) => (
          <SidebarItem
            key={entry.id}
            entry={entry}
            active={entry.id === activeId}
            collapsed={collapsed}
            onSelect={onSelect}
          />
        ))}
      </nav>
      <div className="one-sidebar-footer">
        <span className="one-workspace-icon" aria-hidden="true">
          <Store className="size-4" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">Zapatillas Duoc</p>
            <p className="mt-1 text-[11px] text-neutral-400">Ventas e inventario</p>
          </div>
        )}
      </div>
    </aside>
  )
}
