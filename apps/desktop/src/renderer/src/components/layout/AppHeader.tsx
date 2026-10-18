import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/app/useTheme'
import { useDataStatus } from '@/hooks/api'
import { DemoChip } from '@/components/shared/DemoChip'
import { longDate } from '@/lib/format'

/**
 * Cabecera de aplicación 64 px, fondo oscuro translúcido permanente
 * (plan 7.1): marca, contexto central (indicador demo + corte), tema y
 * usuario demo (la autenticación es etapa posterior).
 */
export function AppHeader(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme()
  const status = useDataStatus()

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center justify-between gap-4 border-b bg-surface-header px-4 text-surface-sidebar-text backdrop-blur-sm">
      {/* Marca */}
      <div className="flex items-center gap-2">
        <span className="inline-block size-2.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
        <span className="text-sm font-semibold text-surface-sidebar-text-active">
          Zapatillas Duoc Analytics
        </span>
      </div>

      {/* Contexto central: modo demo + corte del dataset */}
      <div className="hidden flex-1 justify-center md:flex">
        <div className="flex items-center gap-2">
          <DemoChip />
          {status.data?.metadata.as_of && (
            <span className="text-xs text-surface-sidebar-text">
              corte {longDate(status.data.metadata.as_of)}
            </span>
          )}
        </div>
      </div>

      {/* Tema + usuario demo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
          className="text-surface-sidebar-text hover:text-surface-sidebar-text-active hover:bg-surface-sidebar-hover"
        >
          {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>
        <div
          className="flex items-center gap-2 rounded-full px-2 py-1 text-xs text-surface-sidebar-text"
          title="Sesión demo — la autenticación real es etapa posterior"
        >
          <span
            className="flex size-6 items-center justify-center rounded-full bg-brand-soft-strong text-xs font-semibold text-brand-strong"
            aria-hidden="true"
          >
            D
          </span>
          <span className="hidden lg:inline">Usuario demo</span>
        </div>
      </div>
    </header>
  )
}
