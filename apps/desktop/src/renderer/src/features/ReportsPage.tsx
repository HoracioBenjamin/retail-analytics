import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { AlertTriangle, Boxes, Download, PackageOpen, ShoppingBag, Wallet } from 'lucide-react'
import type { Filters, RiskLevel, VariantRow } from '@shared/schemas'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { FilterBar } from '@/components/shared/FilterBar'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useSearchParams } from 'react-router-dom'
import { analyticsApi, callOk } from '@/services/analytics'
import {
  qk,
  useDataStatus,
  useDatasetMetadata,
  useFiltersAvailability,
  useOverview,
  useRecommendations,
  useVariantRows
} from '@/hooks/api'
import { fmtCLP, fmtNum } from '@/lib/format'
import { buildDateRange, buildWeeklyTrendRanges, PERIOD_LABELS, type Periodo } from './periodRange'
import { calculateForecastExposure, calculateSizeSales } from './reportMetrics'

const RISK_LABELS: Record<RiskLevel, string> = {
  stockout: 'Riesgo de faltante',
  excess: 'Exceso de inventario',
  balanced: 'Equilibrado',
  insufficient_data: 'Datos insuficientes'
}

const RISK_COLORS: Record<RiskLevel, string> = {
  stockout: 'var(--destructive)',
  excess: 'var(--chart-3)',
  balanced: 'var(--chart-2)',
  insufficient_data: 'var(--muted-foreground)'
}

const VALID_PERIODS: Periodo[] = ['all', '12', '8', '4']

function periodLabel(period: Periodo): string {
  return period === 'all' ? 'Todo el histórico' : PERIOD_LABELS[period]
}

function parsePeriod(value: string | null): Periodo {
  return VALID_PERIODS.includes(value as Periodo) ? (value as Periodo) : '12'
}

function shortCurrencyTick(value: number): string {
  if (value >= 1_000_000) return `$${fmtNum(value / 1_000_000)}M`
  if (value >= 1_000) return `$${fmtNum(value / 1_000)}k`
  return `$${fmtNum(value, 0)}`
}

function SelectFilter({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 min-w-36 text-xs" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function aggregateByVariant(rows: VariantRow[]): {
  topVariants: { label: string; revenue: number; units: number }[]
  riskDistribution: { risk: RiskLevel; label: string; variants: number }[]
} {
  const topVariants = [...rows]
    .sort((a, b) => b.sales_amount_clp_period - a.sales_amount_clp_period)
    .slice(0, 8)
    .map((row) => ({
      label: `${row.model} · ${row.color} · T${row.size}`,
      revenue: row.sales_amount_clp_period,
      units: row.units_sold_period
    }))
  const risks: RiskLevel[] = ['stockout', 'excess', 'balanced', 'insufficient_data']
  const riskDistribution = risks.map((risk) => ({
    risk,
    label: RISK_LABELS[risk],
    variants: rows.filter((row) => row.risk === risk).length
  }))
  return { topVariants, riskDistribution }
}

export function ReportsPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const periodo = parsePeriod(params.get('periodo'))

  const status = useDataStatus()
  const metadata = useDatasetMetadata()
  const histStart = status.data?.metadata.historical_range?.start ?? null
  const histEnd = status.data?.metadata.historical_range?.end ?? null
  const availability = useFiltersAvailability()
  const selectedModel = params.get('modelo')
  const selectedColor = params.get('color')
  const selectedSize = params.get('talla')
  const dateRange = useMemo(() => buildDateRange(periodo, histEnd), [histEnd, periodo])
  const filters = useMemo<Partial<Filters>>(
    () => ({
      ...dateRange,
      model: params.get('modelo') ?? undefined,
      color: params.get('color') ?? undefined,
      size: params.get('talla') ?? undefined
    }),
    [dateRange, params]
  )
  const overview = useOverview(filters)
  const variants = useVariantRows(filters)
  const sizeAnalysisFilters = useMemo<Partial<Filters>>(
    () => ({
      ...dateRange,
      model: selectedModel ?? undefined,
      color: selectedColor ?? undefined
    }),
    [dateRange, selectedColor, selectedModel]
  )
  const sizeAnalysis = useVariantRows(sizeAnalysisFilters)
  const recommendations = useRecommendations(filters)
  const trendRanges = useMemo(
    () => buildWeeklyTrendRanges(periodo, histStart, histEnd),
    [histEnd, histStart, periodo]
  )
  const trendQueries = useQueries({
    queries: trendRanges.map((range) => {
      const trendFilters = { ...filters, date_from: range.date_from, date_to: range.date_to }
      return {
        queryKey: qk.overview(trendFilters),
        enabled: Boolean(histEnd),
        queryFn: () =>
          callOk(analyticsApi.getOverview(trendFilters as Filters)).then((result) => result.data)
      }
    })
  })

  const rows = useMemo(() => variants.data ?? [], [variants.data])
  const sizeRows = useMemo(() => sizeAnalysis.data ?? [], [sizeAnalysis.data])
  const { topVariants, riskDistribution } = useMemo(() => aggregateByVariant(rows), [rows])
  const sizeSales = useMemo(() => calculateSizeSales(sizeRows), [sizeRows])
  const exposure = useMemo(() => calculateForecastExposure(rows), [rows])
  const trendData = trendRanges.map((range, index) => ({
    label: range.label,
    revenue: trendQueries[index]?.data?.sales_amount_clp ?? 0,
    units: trendQueries[index]?.data?.units_sold ?? 0
  }))
  const inventoryUnits = rows.reduce((total, row) => total + row.stock_on_hand, 0)
  const connected = metadata?.data_mode === 'connected'
  const selectedModelName = useMemo(
    () => availability.data?.models.find((model) => model === selectedModel) ?? selectedModel,
    [availability.data?.models, selectedModel]
  )
  const reportTitle = selectedModelName
    ? `Ventas de ${selectedModelName}`
    : 'Reporte general de ventas'
  const reportPeriod =
    overview.data?.period_start && overview.data.period_end
      ? `${periodLabel(periodo)} · ${overview.data.period_start} al ${overview.data.period_end}`
      : periodo === 'all'
        ? 'Todo el historial disponible'
        : periodLabel(periodo)
  const primaryError =
    status.error ?? overview.error ?? variants.error ?? sizeAnalysis.error ?? recommendations.error
  const isPending =
    status.isPending ||
    overview.isPending ||
    variants.isPending ||
    sizeAnalysis.isPending ||
    recommendations.isPending
  const trendPending = trendQueries.some((query) => query.isPending)
  const trendError = trendQueries.some((query) => query.isError)
  const applyParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params)
    if (value === 'all' && key !== 'periodo') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
    setExportMessage(null)
  }
  const exportPdf = async (): Promise<void> => {
    setExporting(true)
    setExportMessage(null)
    try {
      const result = await window.reportExportApi.saveCurrentReportAsPdf()
      if (!result.ok) {
        setExportMessage(result.error)
      } else if (!result.canceled) {
        setExportMessage(`Reporte guardado: ${result.fileName}`)
      }
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'No se pudo generar el PDF.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="report-page space-y-6">
      <div className="report-print-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Zapatillas Duoc Analytics
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {reportTitle}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Período de ventas: {reportPeriod}
            {selectedColor ? ` · Color: ${selectedColor}` : ''}
            {selectedSize ? ` · Talla: ${selectedSize}` : ''}
            {' · Generado: '}
            {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(new Date())}
          </p>
        </div>
        <span className="report-source-badge">
          {connected ? 'Datos conectados' : 'Datos de demostración'}
        </span>
      </div>

      <PageHeader
        title={selectedModelName ? `Ventas de ${selectedModelName}` : 'Reporte general de ventas'}
        description="Consulta ventas, tallas e inventario por período. Descarga esta vista en PDF."
        actions={
          <Button
            onClick={() => void exportPdf()}
            disabled={
              exporting ||
              isPending ||
              trendPending ||
              trendError ||
              Boolean(primaryError) ||
              !overview.data ||
              rows.length === 0
            }
            className="report-no-print gap-2"
            data-testid="export-report-pdf"
          >
            <Download className="size-4" aria-hidden="true" />
            {exporting ? 'Preparando PDF…' : 'Descargar PDF'}
          </Button>
        }
      />

      <div className="report-no-print">
        <FilterBar>
          <SelectFilter
            label="Período de ventas"
            value={periodo}
            options={VALID_PERIODS.map((value) => ({ value, label: periodLabel(value) }))}
            onChange={(value) => applyParam('periodo', value)}
          />
          <SelectFilter
            label="Zapatilla"
            value={params.get('modelo') ?? 'all'}
            options={[
              { value: 'all', label: 'Todas las zapatillas' },
              ...(availability.data?.models ?? []).map((value) => ({ value, label: value }))
            ]}
            onChange={(value) => applyParam('modelo', value)}
          />
          <SelectFilter
            label="Color"
            value={params.get('color') ?? 'all'}
            options={[
              { value: 'all', label: 'Todos los colores' },
              ...(availability.data?.colors ?? []).map((value) => ({ value, label: value }))
            ]}
            onChange={(value) => applyParam('color', value)}
          />
          <SelectFilter
            label="Talla"
            value={params.get('talla') ?? 'all'}
            options={[
              { value: 'all', label: 'Todas las tallas' },
              ...(availability.data?.sizes ?? []).map((value) => ({ value, label: value }))
            ]}
            onChange={(value) => applyParam('talla', value)}
          />
        </FilterBar>
      </div>

      <div className="report-filter-summary" aria-live="polite">
        <p>
          <strong>Zapatilla:</strong> {selectedModelName ?? 'todas'}
          {selectedColor ? ` · color ${selectedColor}` : ''}
          {selectedSize ? ` · talla ${selectedSize}` : ''}
        </p>
        <p>
          <strong>Fechas de venta:</strong> {reportPeriod}
        </p>
        {selectedModelName && selectedSize && (
          <p>
            La comparación de tallas incluye todas las tallas de {selectedModelName}, aunque haya
            una talla seleccionada en el filtro.
          </p>
        )}
      </div>

      {exportMessage && (
        <p className="report-no-print text-xs text-muted-foreground" role="status">
          {exportMessage}
        </p>
      )}

      {isPending ? (
        <LoadingState rows={3} />
      ) : primaryError ? (
        <ErrorState
          code={
            primaryError instanceof Error
              ? (primaryError as Error & { code?: string }).code
              : undefined
          }
          message={primaryError instanceof Error ? primaryError.message : String(primaryError)}
          onRetry={() => {
            void status.refetch()
            void overview.refetch()
            void variants.refetch()
            void sizeAnalysis.refetch()
            void recommendations.refetch()
          }}
        />
      ) : !overview.data || rows.length === 0 ? (
        <EmptyState
          title="No hay datos para este filtro"
          description="Prueba otro período, modelo, color o talla."
        />
      ) : (
        <>
          <section aria-label="Indicadores clave" className="space-y-3">
            <h2 className="report-section-heading">
              Indicadores clave · {selectedModelName ?? 'todas las zapatillas'} · {reportPeriod}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                label="Ventas del período"
                icon={Wallet}
                value={fmtCLP(overview.data.sales_amount_clp)}
                hint="Suma de cantidad × precio unitario"
              />
              <KpiCard
                label="Unidades vendidas"
                icon={ShoppingBag}
                value={fmtNum(overview.data.units_sold)}
                hint="Ventas confirmadas incluidas en el reporte"
              />
              <KpiCard
                label="Variantes en el catálogo"
                icon={Boxes}
                value={fmtNum(overview.data.variants_total)}
                hint="Modelo, color y talla"
              />
              <KpiCard
                label="Unidades en inventario"
                icon={PackageOpen}
                value={fmtNum(inventoryUnits)}
                hint="Stock actual de las variantes filtradas"
              />
              <KpiCard
                label="Riesgo de faltante"
                icon={AlertTriangle}
                value={fmtNum(overview.data.risk_counts.stockout ?? 0)}
                hint="Variantes clasificadas con riesgo de agotamiento"
              />
              <KpiCard
                label="Exceso de inventario"
                icon={PackageOpen}
                value={fmtNum(overview.data.risk_counts.excess ?? 0)}
                hint={`${fmtNum(recommendations.data?.length ?? 0)} recomendaciones calculadas`}
              />
            </div>
          </section>

          <section aria-label="Ventas por talla" className="space-y-3">
            <h2 className="report-section-heading">
              Tallas de {selectedModelName ?? 'la zapatilla seleccionada'}
            </h2>
            {selectedModelName ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Se encontraron {fmtNum(sizeSales.sizesRegistered)} tallas registradas
                  {selectedColor ? ` en color ${selectedColor}` : ''}. Las ventas corresponden al
                  período seleccionado.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <KpiCard
                    label="Tallas registradas"
                    icon={Boxes}
                    value={fmtNum(sizeSales.sizesRegistered)}
                    hint="Tallas con registro de inventario para esta zapatilla"
                  />
                  <KpiCard
                    label="Talla con más ventas"
                    icon={ShoppingBag}
                    value={
                      sizeSales.bestSellingSizes.length === 0
                        ? 'Sin ventas en el período'
                        : sizeSales.bestSellingSizes.length === 1
                          ? `Talla ${sizeSales.bestSellingSizes[0]}`
                          : `Empate: ${sizeSales.bestSellingSizes
                              .map((size) => `Talla ${size}`)
                              .join(' y ')}`
                    }
                    hint={
                      sizeSales.bestSellingSizes.length > 0
                        ? `${fmtNum(sizeSales.bestSellingUnits)} ${
                            sizeSales.bestSellingUnits === 1
                              ? 'unidad vendida'
                              : 'unidades vendidas'
                          }`
                        : 'No se registraron ventas en el período seleccionado'
                    }
                  />
                </div>
                {sizeSales.rows.length === 0 || sizeSales.totalUnitsSold === 0 ? (
                  <EmptyState
                    title="Aún no hay ventas por talla"
                    description="Las tallas están registradas, pero no hay ventas para el período elegido."
                  />
                ) : (
                  <SectionCard
                    title={`Unidades vendidas por talla · ${selectedModelName}`}
                    description="Compara cada talla. Si se seleccionó un color, solo se incluyen las ventas de ese color."
                    className="report-chart-card"
                  >
                    <div className="report-chart report-chart-wide">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={sizeSales.rows.map((row) => ({
                            ...row,
                            label: `Talla ${row.size}`
                          }))}
                          margin={{ top: 16, right: 24, bottom: 8, left: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                          <Tooltip
                            formatter={(value) => [`${fmtNum(Number(value))} unidades`, 'Ventas']}
                          />
                          <Bar
                            dataKey="unitsSold"
                            name="Unidades vendidas"
                            fill="var(--chart-1)"
                            radius={[4, 4, 0, 0]}
                            label={{ position: 'top', fontSize: 10 }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </SectionCard>
                )}
              </>
            ) : (
              <EmptyState
                title="Selecciona una zapatilla para comparar sus tallas"
                description="Usa el filtro Zapatilla para ver cuántas tallas tiene y cuál registra más ventas."
              />
            )}
          </section>

          <section aria-label="Estimación de demanda expuesta" className="space-y-3">
            <h2 className="report-section-heading">Demanda futura expuesta · próximas 4 semanas</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                label="Demanda proyectada sin cobertura"
                icon={AlertTriangle}
                value={
                  exposure.forecastVariants > 0
                    ? `${fmtNum(exposure.uncoveredUnits)} unidades`
                    : '—'
                }
                hint="Demanda estimada que supera el inventario actual"
              />
              <KpiCard
                label="Ventas brutas potenciales expuestas"
                icon={Wallet}
                value={
                  exposure.rows.length > 0 || exposure.uncoveredUnits === 0
                    ? fmtCLP(exposure.estimatedRevenueClp)
                    : 'No estimable'
                }
                hint="Demanda expuesta × precio promedio observado; no es venta ni pérdida confirmada"
              />
              <KpiCard
                label="Utilidad perdida"
                icon={PackageOpen}
                value="No calculable"
                hint="Falta costo unitario o margen real por variante"
              />
            </div>
            {exposure.unpricedVariants > 0 && (
              <p className="text-xs text-muted-foreground">
                Hay {fmtNum(exposure.unpricedVariants)} variantes con demanda expuesta sin ventas en
                el período seleccionado; no se les asignó un precio estimado.
              </p>
            )}
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Tendencia de ventas"
              description="Ventas semanales del período. El filtro “Todo el histórico” muestra las últimas 12 semanas."
              className="report-chart-card"
            >
              {trendQueries.some((query) => query.isError) ? (
                <p className="text-xs text-destructive">
                  No se pudo cargar la tendencia semanal. Reintenta la consulta.
                </p>
              ) : trendQueries.some((query) => query.isPending) ? (
                <LoadingState rows={2} />
              ) : trendData.length === 0 ? (
                <EmptyState
                  title="Sin historial para graficar"
                  description="Aún no hay fechas de venta para mostrar."
                />
              ) : (
                <div className="report-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis
                        yAxisId="revenue"
                        tick={{ fontSize: 10 }}
                        tickFormatter={shortCurrencyTick}
                      />
                      <YAxis
                        yAxisId="units"
                        orientation="right"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value: number) => fmtNum(value, 0)}
                      />
                      <Tooltip
                        formatter={(value, name) =>
                          name === 'Ventas (CLP)'
                            ? fmtCLP(Number(value))
                            : `${fmtNum(Number(value))} unidades`
                        }
                      />
                      <Legend />
                      <Line
                        yAxisId="revenue"
                        type="monotone"
                        dataKey="revenue"
                        name="Ventas (CLP)"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="units"
                        type="monotone"
                        dataKey="units"
                        name="Unidades"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Variantes por nivel de riesgo"
              description="Clasificación actual para las variantes incluidas en el filtro."
              className="report-chart-card"
            >
              <div className="report-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={riskDistribution}
                    margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="label" width={135} tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="variants" name="Variantes" radius={[4, 4, 0, 0]}>
                      {riskDistribution.map((item) => (
                        <Cell key={item.risk} fill={RISK_COLORS[item.risk]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Oportunidad bruta expuesta por quiebre potencial"
            description="Diferencia entre la demanda estimada para 4 semanas y el inventario actual, valorizada al precio promedio observado. No equivale a pérdida real ni a utilidad."
            className="report-chart-card"
          >
            {exposure.rows.length === 0 ? (
              <EmptyState
                title="No hay exposición valorizable"
                description={
                  exposure.uncoveredUnits > 0
                    ? 'Hay demanda proyectada superior al stock, pero no precio observado para estimar ventas brutas.'
                    : 'El stock actual cubre la demanda proyectada o no hay pronóstico disponible.'
                }
              />
            ) : (
              <div className="report-chart report-chart-wide">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={exposure.rows.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 8, right: 24, bottom: 0, left: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickFormatter={shortCurrencyTick}
                    />
                    <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 9 }} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === 'Ventas brutas expuestas'
                          ? fmtCLP(Number(value))
                          : `${fmtNum(Number(value))} unidades`
                      }
                    />
                    <Bar
                      dataKey="estimatedRevenueClp"
                      name="Ventas brutas expuestas"
                      fill="var(--destructive)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Variantes con mayores ventas"
            description="Ranking por ventas registradas en el período seleccionado; no representa margen ni utilidad."
            className="report-chart-card"
          >
            {topVariants.every((item) => item.revenue === 0) ? (
              <EmptyState
                title="Sin ventas para este período"
                description="No hay ingresos registrados para las variantes filtradas."
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                    Por ventas (CLP)
                  </h3>
                  <div className="report-chart report-chart-wide">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topVariants}
                        layout="vertical"
                        margin={{ top: 8, right: 20, bottom: 0, left: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10 }}
                          tickFormatter={shortCurrencyTick}
                        />
                        <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 9 }} />
                        <Tooltip />
                        <Bar
                          dataKey="revenue"
                          name="Ventas (CLP)"
                          fill="var(--chart-1)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                    Por unidades vendidas
                  </h3>
                  <div className="report-chart report-chart-wide">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[...topVariants].sort((a, b) => b.units - a.units)}
                        layout="vertical"
                        margin={{ top: 8, right: 20, bottom: 0, left: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 9 }} />
                        <Tooltip />
                        <Bar
                          dataKey="units"
                          name="Unidades"
                          fill="var(--chart-2)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Alcance del reporte"
            description="Transparencia sobre el origen y los límites de las métricas."
          >
            <ul className="report-limitations">
              <li>
                Fuente: {connected ? 'Supabase conectado' : 'datos de demostración'} ·{' '}
                {reportPeriod}.
              </li>
              <li>
                Las ventas usan pedidos confirmados y el importe suma cantidad × precio unitario; no
                incluye costos, margen ni utilidad.
              </li>
              <li>
                La exposición a quiebres compara la demanda estimada de las próximas 4 semanas con
                el stock actual; valoriza unidades expuestas con el precio promedio del período. No
                confirma que se pierda una venta.
              </li>
              <li>
                La utilidad/ganancia perdida no se calcula porque el origen conectado no entrega
                costo unitario ni margen por variante.
              </li>
              <li>
                Los riesgos son clasificaciones informativas del sistema, no garantías de
                disponibilidad ni predicciones con precisión validada.
              </li>
              {(status.data?.metadata.limitations ?? []).map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  )
}
