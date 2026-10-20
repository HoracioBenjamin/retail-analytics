import { useState, type CSSProperties } from 'react'
import { ChevronRight, LayoutGrid } from 'lucide-react'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { SidebarEntry } from './SidebarItem'
import { SIDEBAR_ENTRIES } from './sidebarEntries'
import { DemoChip } from '@/components/shared/DemoChip'

const SIDEBAR_STORAGE_KEY = 'retail-analytics-sidebar'

function readInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed'
  } catch {
    return false
  }
}

/**
 * AppShell (plan 7.2): cabecera fija de 64 px, sidebar plegable a la
 * izquierda y área de contenido con margen de 24 px y un único scroll.
 * El shell posee el estado plegado para ajustar el margen del contenido
 * y persistirla con la clave propia del plan (`retail-analytics-sidebar`).
 */
export function AppShell({
  activeId,
  onSelect,
  children
}: {
  activeId: string
  onSelect: (entry: SidebarEntry) => void
  children: React.ReactNode
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(readInitialCollapsed)
  const sectionLabel = SIDEBAR_ENTRIES.find((entry) => entry.id === activeId)?.label ?? 'Resumen'

  const toggleCollapsed = (): void => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'expanded')
    } catch {
      // Preferencia no crítica.
    }
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="one-app-shell"
        data-sidebar={collapsed ? 'collapsed' : 'expanded'}
        style={{ '--sidebar-width': collapsed ? '64px' : '240px' } as CSSProperties}
      >
        <AppHeader activeId={activeId} onSelect={onSelect} />
        <AppSidebar
          activeId={activeId}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onSelect={onSelect}
        />
        <main className="one-main" id="main-content">
          <div className="one-content">
            <div className="one-context-bar">
              <nav aria-label="Ruta de navegación" className="one-breadcrumb">
                <LayoutGrid className="size-3.5" aria-hidden="true" />
                <button type="button" onClick={() => onSelect(SIDEBAR_ENTRIES[0])}>
                  Retail Analytics
                </button>
                <ChevronRight className="size-3" aria-hidden="true" />
                <span aria-current="page">{sectionLabel}</span>
              </nav>
              <div className="one-context-meta">
                <DemoChip />
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
