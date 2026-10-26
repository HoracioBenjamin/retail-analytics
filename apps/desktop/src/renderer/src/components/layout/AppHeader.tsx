import {
  Check,
  ChevronDown,
  Database,
  LayoutGrid,
  Moon,
  RefreshCw,
  Settings,
  Store,
  Sun
} from 'lucide-react'
import { useTheme } from '@/app/useTheme'
import { useDataStatus, useRefreshAnalyticsData } from '@/hooks/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SIDEBAR_ENTRIES } from './sidebarEntries'
import type { SidebarEntry } from './SidebarItem'

/** Cabecera inspirada en ONE: marca, selector de módulo y espacio de usuario. */
export function AppHeader({
  activeId,
  onSelect
}: {
  activeId: string
  onSelect: (entry: SidebarEntry) => void
}): React.JSX.Element {
  const { theme, toggleTheme } = useTheme()
  const status = useDataStatus()
  const refreshData = useRefreshAnalyticsData()
  const connected = status.data?.metadata.data_mode === 'connected'
  const modeLabel = status.isError
    ? 'Origen no disponible'
    : !status.data
      ? 'Consultando origen…'
      : connected
        ? 'Datos conectados · solo lectura'
        : 'Espacio de demostración'

  return (
    <header className="one-topbar">
      <button
        type="button"
        className="one-wordmark"
        aria-label="Zapatillas Duoc Analytics — ir al resumen"
        onClick={() => onSelect(SIDEBAR_ENTRIES[0])}
      >
        <span className="one-brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="one-wordmark-copy">
          <span className="one-wordmark-name">
            DUOC<span>analytics</span>
          </span>
          <span className="one-wordmark-caption">VENTAS E INVENTARIO</span>
        </span>
      </button>
      <div className="one-topbar-center">
        <DropdownMenu>
          <DropdownMenuTrigger className="one-module-trigger">
            <LayoutGrid className="size-4" aria-hidden="true" />
            <span>Retail Analytics</span>
            <ChevronDown className="size-3.5 opacity-50" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" sideOffset={14} className="one-dark-menu w-64">
            <DropdownMenuLabel>ANÁLISIS COMERCIAL</DropdownMenuLabel>
            {SIDEBAR_ENTRIES.map((entry) => (
              <DropdownMenuItem key={entry.id} onSelect={() => onSelect(entry)}>
                <entry.icon className="size-4" />
                {entry.label}
                {activeId === entry.id && <Check className="ml-auto size-3.5 text-red-400" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="one-topbar-user">
        <button
          type="button"
          onClick={() => refreshData.mutate()}
          disabled={refreshData.isPending}
          className="one-theme-button"
          aria-label={
            refreshData.isError ? 'Reintentar actualización de datos' : 'Actualizar datos ahora'
          }
          title={
            refreshData.isError ? 'Falló la actualización; reintentar' : 'Actualizar datos ahora'
          }
        >
          <RefreshCw
            className={refreshData.isPending ? 'size-4 animate-spin' : 'size-4'}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="one-theme-button"
          aria-label={theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
          title={theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
        >
          {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="one-profile-trigger">
            <span className="one-profile-avatar" aria-hidden="true">
              <Store className="size-4" />
            </span>
            <span className="one-profile-copy">
              <span>Panel de análisis</span>
              <span>{modeLabel}</span>
            </span>
            <ChevronDown className="size-3.5 opacity-50" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={12} className="one-dark-menu w-64">
            <DropdownMenuLabel>ESPACIO DE TRABAJO</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={toggleTheme}>
              {theme === 'light' ? <Moon /> : <Sun />}
              {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onSelect(SIDEBAR_ENTRIES.find((e) => e.id === 'data-status')!)}
            >
              <Database />
              Estado de datos
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onSelect(SIDEBAR_ENTRIES.find((e) => e.id === 'settings')!)}
            >
              <Settings />
              Preferencias
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
