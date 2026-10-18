import { useState } from 'react'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { SidebarEntry } from './SidebarItem'

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
      {/* BFC: contiene el margen del <main> (sin colapso) para que el
          documento no desborde 100vh y solo exista el scroll interno. */}
      <div className="h-screen overflow-hidden">
        <AppHeader />
        <AppSidebar
          activeId={activeId}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onSelect={onSelect}
        />
        <main
          className={`
            mt-16 h-[calc(100vh-4rem)] overflow-y-auto p-6 transition-[padding]
            duration-200
            ${collapsed ? 'pl-16' : 'md:pl-[240px] pl-16'}
          `}
        >
          {children}
        </main>
      </div>
    </TooltipProvider>
  )
}
