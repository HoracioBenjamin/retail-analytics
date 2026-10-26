import { useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useDataStatus, useDatasetMetadata, useForecastSeries, useVariantRows } from '@/hooks/api'
import { weekLabel } from '@/lib/format'

/**
 * Pantalla Pronósticos (plan, sección 8 "/forecasts"): selector de variante,
 * línea histórica sólida y futura discontinua, fecha de corte y etiqueta
 * baseline Croston-SBA en modo conectado y valores de fixture en demo.
 * El baseline no tiene métricas de precisión validadas.
 */
export function ForecastsPage(): React.JSX.Element {
  const rows = useVariantRows()
  const status = useDataStatus()
  const conectado = useDatasetMetadata()?.data_mode === 'connected'
  const defaultVariantId =
    rows.data?.find((row) => row.forecast_units_total !== null)?.variant_id ??
    rows.data?.at(0)?.variant_id ??
    null
  const [chosen, setChosen] = useState<string | null>(null)
  const selectedId = chosen ?? defaultVariantId
  const series = useForecastSeries(selectedId)

  const history = [...(series.data?.history ?? [])].sort((a, b) =>
    a.period_start.localeCompare(b.period_start)
  )
  const forecast = [...(series.data?.forecast ?? [])].sort((a, b) =>
    a.period_start.localeCompare(b.period_start)
  )

  const data = [
    ...history.map((p) => ({
      label: weekLabel(p.period_start),
      historico: p.units_sold,
      pronostico: null
    })),
    ...forecast.map((p) => ({
      label: weekLabel(p.period_start),
      historico: null,
      pronostico: p.predicted_units
    }))
  ]
  const lastHistoryLabel = history.length > 0 ? weekLabel(history.at(-1)!.period_start) : null
  const selectedRow = rows.data?.find((r) => r.variant_id === selectedId)

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Pronósticos"
          description={
            conectado
              ? 'Baseline Croston-SBA para demanda intermitente, calculado con ventas conectadas. Es una estimación estadística, no un modelo ML entrenado ni validado.'
              : "Valores futuros de ejemplo del dataset (method 'fixture', model_version null). No hay modelo entrenado en esta base."
          }
        />

        <SectionCard
          title="Proyección por variante"
          description={
            status.data?.metadata.forecast_method === 'baseline'
              ? 'Historial real + 4 semanas de estimación Croston-SBA. Sin precisión validada.'
              : status.data?.metadata.forecast_method === null
                ? status.data?.metadata.historical_range
                  ? `Historial real de ventas (modo conectado) · sin proyección: modelo predictivo pendiente`
                  : 'Esperando el estado de datos'
                : status.data?.metadata.historical_range
                  ? `Histórico de 12 semanas + 4 semanas futuras ilustrativas`
                  : 'Esperando el dataset de demostración'
          }
        >
          {rows.isPending ? (
            <LoadingState rows={3} />
          ) : rows.isError ? (
            <ErrorState
              message={rows.error instanceof Error ? rows.error.message : String(rows.error)}
              onRetry={() => void rows.refetch()}
            />
          ) : (rows.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="Sin variantes en el dataset"
              description="El estado de datos explica el detalle."
            />
          ) : (
            <div className="space-y-4">
              <Select value={selectedId ?? ''} onValueChange={(v) => setChosen(v)}>
                <SelectTrigger
                  className="h-9 w-full max-w-md text-xs"
                  aria-label="Selecciona la variante"
                >
                  <SelectValue placeholder="Selecciona una variante" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(rows.data ?? []).map((r) => (
                    <SelectItem key={r.variant_id} value={r.variant_id} className="text-xs">
                      {r.model} · {r.color} · T{r.size} — {r.variant_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {series.isPending ? (
                <LoadingState rows={2} />
              ) : series.isError ? (
                <ErrorState
                  code={
                    series.error instanceof Error
                      ? (series.error as Error & { code?: string }).code
                      : undefined
                  }
                  message={
                    series.error instanceof Error ? series.error.message : String(series.error)
                  }
                  onRetry={() => void series.refetch()}
                />
              ) : (
                <>
                  <div className="h-72" data-testid="forecast-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                          tickLine={false}
                          stroke="var(--border)"
                        />
                        <YAxis
                          width={36}
                          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                          tickLine={false}
                          stroke="var(--border)"
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                            color: 'var(--popover-foreground)'
                          }}
                        />
                        {lastHistoryLabel && (
                          <ReferenceLine
                            x={lastHistoryLabel}
                            stroke="var(--muted-foreground)"
                            strokeDasharray="4 4"
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="historico"
                          name="Ventas históricas (uds)"
                          stroke="var(--foreground)"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="pronostico"
                          name={
                            conectado ? 'Baseline Croston-SBA (uds)' : 'Pronóstico de ejemplo (uds)'
                          }
                          stroke="var(--brand)"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={{ r: 2 }}
                          connectNulls={false}
                        />
                        <Legend
                          verticalAlign="top"
                          height={24}
                          wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {selectedRow && (
                    <p className="text-xs text-muted-foreground">
                      Variante: {selectedRow.model} · {selectedRow.color} · T{selectedRow.size} —{' '}
                      {selectedRow.forecast_units_total === null
                        ? 'sin proyección disponible'
                        : conectado
                          ? `estimación Croston-SBA: ${selectedRow.forecast_units_total} uds en 4 semanas`
                          : `total ilustrativo del horizonte: ${selectedRow.forecast_units_total} uds (4 semanas)`}
                      {conectado
                        ? '. Baseline sin métricas de precisión validadas.'
                        : '. Valor de ejemplo del dataset demo, no predicción de un modelo.'}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  )
}
