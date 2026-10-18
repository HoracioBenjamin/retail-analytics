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
import type { ForecastPoint, SalesPoint } from '@shared/schemas'
import { weekLabel } from '@/lib/format'

/**
 * Gráfico de ventas históricas + pronóstico ilustrativo (plan, Paso 5
 * punto 4): contenedor con tamaño definido, colores temáticos y leyenda
 * que separa EXPLÍCITAMENTE el histórico del valor futuro de ejemplo.
 * Marca de corte en la última semana histórica (as_of del dataset).
 */
export function HistoryForecastChart({
  history,
  forecast,
  heightClass = 'h-64',
  valueLabel = 'Unidades vendidas',
  showAxes = true
}: {
  history: SalesPoint[]
  forecast: ForecastPoint[]
  heightClass?: string
  valueLabel?: string
  showAxes?: boolean
}): React.JSX.Element {
  const sortedHistory = [...history].sort((a, b) => a.period_start.localeCompare(b.period_start))
  const sortedForecast = [...forecast].sort((a, b) => a.period_start.localeCompare(b.period_start))

  const data: Array<{ label: string; historico: number | null; pronostico: number | null }> = [
    ...sortedHistory.map((p) => ({
      label: weekLabel(p.period_start),
      historico: p.units_sold,
      pronostico: null
    })),
    ...sortedForecast.map((p) => ({
      label: weekLabel(p.period_start),
      historico: null,
      pronostico: p.predicted_units
    }))
  ]

  const lastHistoryLabel = sortedHistory.at(-1)
    ? weekLabel(sortedHistory.at(-1)!.period_start)
    : null

  return (
    <div className={heightClass} data-testid="history-forecast-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          {showAxes && (
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              stroke="var(--border)"
            />
          )}
          {showAxes && (
            <YAxis
              width={36}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              stroke="var(--border)"
            />
          )}
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--popover-foreground)'
            }}
            labelStyle={{ color: 'var(--muted-foreground)' }}
          />
          {lastHistoryLabel && (
            <ReferenceLine
              x={lastHistoryLabel}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: 'Corte',
                position: 'insideTopLeft',
                fontSize: 10,
                fill: 'var(--muted-foreground)'
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="historico"
            name={`Ventas históricas (${valueLabel})`}
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            legendType="plainline"
          />
          <Line
            type="monotone"
            dataKey="pronostico"
            name="Pronóstico de ejemplo (fixture, sin modelo)"
            stroke="var(--brand)"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
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
  )
}
