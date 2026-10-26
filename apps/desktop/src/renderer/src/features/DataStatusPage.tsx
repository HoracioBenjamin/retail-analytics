import { CheckCircle2, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { useDataStatus } from '@/hooks/api'
import { rangeLabel } from '@/lib/format'

/**
 * Pantalla Estado de datos (plan, sección 8 "/data-status"): fuente y modo,
 * fecha de actualización, alcance temporal del dataset, disponibilidad del
 * servicio y futuras necesidades de datos. Sin simular sincronización real.
 */
export function DataStatusPage(): React.JSX.Element {
  const status = useDataStatus()

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Estado de datos"
          description="Diagnóstico transparente del dataset en uso y de las capacidades disponibles en esta base."
        />

        {status.isPending ? (
          <LoadingState rows={5} />
        ) : status.isError ? (
          <ErrorState
            message={status.error instanceof Error ? status.error.message : String(status.error)}
            onRetry={() => void status.refetch()}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard title="Fuente y modo" description="Modo de datos activo de la aplicación.">
              <dl className="space-y-2 text-xs">
                <StatusLine label="Modo de datos" value={status.data.metadata.data_mode} mono />
                <StatusLine
                  label="Origen"
                  value={
                    status.data.metadata.data_source === 'demo'
                      ? 'Dataset de demostración local (fixtures/demo-v1.json)'
                      : status.data.metadata.data_source
                  }
                />
                <StatusLine
                  label="Servicio de datos"
                  value={
                    status.data.metadata.data_source === 'supabase'
                      ? 'Disponible: conectado a Supabase en modo de solo lectura.'
                      : status.data.fixture_available
                        ? 'Disponible: el fixture canónico cargó y validó correctamente.'
                        : 'No disponible: revisa las limitaciones indicadas abajo.'
                  }
                />
              </dl>
            </SectionCard>

            <SectionCard title="Actualización y versión">
              <dl className="space-y-2 text-xs">
                <StatusLine
                  label="Versión del dataset"
                  value={status.data.metadata.dataset_version ?? 'No disponible'}
                  mono
                />
              </dl>
            </SectionCard>

            <SectionCard
              title="Alcance temporal del dataset"
              description="Período cubierto por la fuente de datos activa."
            >
              {status.data.metadata.historical_range || status.data.metadata.forecast_range ? (
                <dl className="space-y-2 text-xs">
                  {status.data.metadata.historical_range && (
                    <StatusLine
                      label="Histórico"
                      value={rangeLabel(
                        status.data.metadata.historical_range.start,
                        status.data.metadata.historical_range.end
                      )}
                    />
                  )}
                  {status.data.metadata.forecast_range && (
                    <StatusLine
                      label="Horizonte futuro"
                      value={rangeLabel(
                        status.data.metadata.forecast_range.start,
                        status.data.metadata.forecast_range.end
                      )}
                    />
                  )}
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">
                  La fuente no tiene fechas disponibles.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Capacidades y necesidades futuras"
              description="Lo que esta base incluye y lo que queda documentado como etapa posterior."
            >
              <ul className="space-y-2 text-xs">
                <CapabilityItem
                  ok
                  text={
                    status.data.metadata.data_mode === 'connected'
                      ? 'FastAPI conectado a Supabase en modo de solo lectura; las políticas RLS se respetan.'
                      : 'Proveedor de demostración con contratos IPC validados (sobre { ok, data|error }).'
                  }
                />
                <CapabilityItem
                  ok
                  text={
                    status.data.metadata.data_mode === 'connected'
                      ? 'Ventas e inventario derivados de Supabase; Croston-SBA es un baseline estadístico, no ML entrenado, y no tiene precisión validada.'
                      : 'Datos derivados con reglas ilustrativas: sin modelo entrenado ni métricas de precisión.'
                  }
                />
                <CapabilityItem
                  ok
                  text="Gráficos y tablas solo lectura; no hay botones de entrenamiento ni de exportación."
                />
                <CapabilityItem text="Las credenciales de Supabase se configuran solo en el backend; Electron no recibe claves." />
                <CapabilityItem text="Para clasificar riesgo de faltante se requieren 28 días de ventas y configurar el plazo real del proveedor." />
                <CapabilityItem text="Autenticación y multiempresa: posteriores; sin credenciales guardadas ni solicitadas." />
              </ul>
            </SectionCard>

            <SectionCard
              className="md:col-span-2"
              title="Limitaciones declaradas"
              description="Tal como las entrega el proveedor de datos en los metadatos (DataMetadata.limitations)."
            >
              <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                {status.data.metadata.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </SectionCard>
          </div>
        )}
      </div>
    </>
  )
}

function StatusLine({
  label,
  value,
  mono = false
}: {
  label: string
  value: string
  mono?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? 'font-mono text-xs text-foreground' : 'text-xs text-foreground'}>
        {value}
      </dd>
    </div>
  )
}

function CapabilityItem({ ok, text }: { ok?: boolean; text: string }): React.JSX.Element {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2
          className="mt-0.5 size-3.5 shrink-0 text-status-balanced"
          aria-hidden="true"
        />
      ) : (
        <Wrench className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{text}</span>
    </li>
  )
}
