import { Moon, Sun } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { DemoChip } from '@/components/shared/DemoChip'
import { useDataStatus } from '@/hooks/api'
import { useTheme } from '@/app/useTheme'
import { cn } from '@/lib/utils'

/**
 * Pantalla Ajustes (plan, sección 8 "/settings"): tema, información de
 * versión y modo activo. Configuración técnica visible para revisión; sin
 * credenciales de base de datos (regla del plan).
 */
export function SettingsPage(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const status = useDataStatus()

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Ajustes"
          description="Preferencias de apariencia e información técnica de la base. Sin credenciales ni ajustes de conexión."
          actions={<DemoChip />}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard
            title="Tema"
            description="Tema claro por defecto; la preferencia se guarda en el equipo."
          >
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="gap-1.5"
                aria-pressed={theme === 'light'}
              >
                <Moon className="size-4" aria-hidden="true" />
                Claro
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="gap-1.5"
                aria-pressed={theme === 'dark'}
              >
                <Sun className="size-4" aria-hidden="true" />
                Oscuro
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Claves de preferencia: <span className="font-mono">retail-analytics-theme</span> ·{' '}
              <span className="font-mono">retail-analytics-sidebar</span> (plegado de la barra
              lateral).
            </p>
          </SectionCard>

          <SectionCard
            title="Información de la aplicación"
            description="Versión y modo de datos activo."
          >
            <dl className="space-y-2 text-xs">
              <Row
                label="Versión"
                value={`${APP_VERSION} (Entrega A: base visual de demostración)`}
                mono
              />
              <Row
                label="Modo activo"
                value={status.data ? status.data.metadata.data_mode : 'Consultando…'}
                mono
              />
              <Row
                label="Variable de configuración"
                value={import.meta.env.MAIN_VITE_DATA_MODE as string}
                mono
              />
            </dl>
          </SectionCard>

          <SectionCard
            className="md:col-span-2"
            title="Límites de esta base (A+B)"
            description="Documentado para revisión técnica: no hay capacidades simuladas."
          >
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>
                Los datos provienen EXCLUSIVAMENTE de{' '}
                <span className="font-mono">fixtures/demo-v1.json</span> (determinista, con fecha de
                corte fija).
              </li>
              <li>
                El pronóstico es un ejemplo del dataset (method «fixture», model_version null): no
                hay modelo entrenado.
              </li>
              <li>
                El modo <span className="font-mono">demo-api</span> (FastAPI) se conecta en la
                Entrega B y el modo <span className="font-mono">connected</span> NO está disponible
                en esta base: corresponde a una etapa posterior autenticada.
              </li>
              <li>
                Sin botones de entrenamiento, compras automáticas ni exportaciones (se omiten, no se
                simulan).
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  )
}

/** Versión leída de package.json al compilar (define de electron-vite). */
declare const APP_VERSION: string

function Row({
  label,
  value,
  mono = false
}: {
  label: string
  value: string
  mono?: boolean
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-0.5')}>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? 'font-mono text-xs text-foreground' : 'text-xs text-foreground'}>
        {value}
      </dd>
    </div>
  )
}
