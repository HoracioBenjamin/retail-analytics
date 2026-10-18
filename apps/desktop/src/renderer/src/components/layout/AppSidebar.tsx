import { Button } from '@/components/ui/button'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { SidebarItem } from './SidebarItem'
import { SIDEBAR_ENTRIES } from './sidebarEntries'
import type { SidebarEntry } from './SidebarItem'

/**
 * Sidebar plegable (plan 7.1: 64 px plegado / 240 px desplegado, fondo
 * oscuro translúcido, acento rojo en la opción activa, tooltips al plegar).
 * El estado plegado lo posee AppShell y llega por props.
 *
 * Las pantallas se conectan por HashRouter (Paso 5): onSelect navega.
 */

interface AppSidebarProps {
  /** id de la sección activa derivada de la ruta actual. */
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
    <aside
      className={`
        fixed left-0 top-16 bottom-0 z-10 flex flex-col gap-2 border-r
        bg-surface-sidebar text-surface-sidebar-text backdrop-blur-sm
        transition-[width] duration-200
        ${collapsed ? 'w-16' : 'w-[240px]'}
      `}
      aria-label="Navegación principal"
    >
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {SIDEBAR_ENTRIES.map((entry) => (
          <SidebarItem
            key={entry.id}
            entry={entry}
            active={entry.id === activeId}
            collapsed={collapsed}
            onSelect={onSelect}
          />
        ))}
      </nav>

      <div className="border-t border-surface-sidebar-border p-2">
        <Button
          variant="ghost"
          onClick={onToggleCollapsed}
          className="h-9 w-full justify-center gap-3 text-surface-sidebar-text hover:bg-surface-sidebar-hover hover:text-surface-sidebar-text-active"
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" />
              <span className="text-sm">Plegar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
