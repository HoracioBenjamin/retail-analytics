import { cn } from '@/lib/utils'
import { fmtNum } from '@/lib/format'

export interface ReportDonutSlice {
  label: string
  value: number
  color: string
}

/**
 * Tarjeta donut del panorama visual del reporte (plan 7.3): anillo + centro
 * con el valor clave y leyenda textual (el tooltip no existe en el PDF).
 * Solo presentación: los datos ya vienen calculados de reportMetrics.ts;
 * no inventa métricas y sin datos muestra el aviso explícito.
 */
export function ReportDonut({
  title,
  description,
  slices,
  centerValue,
  centerLabel,
  hint,
  formatSliceValue = (value) => fmtNum(value, 0),
  className
}: {
  title: string
  description?: string
  /** Objetos { label, value, color }; se omiten los de value <= 0. */
  slices: ReportDonutSlice[]
  centerValue: string
  centerLabel: string
  hint?: string
  /** Formato de los valores de la leyenda (unidades, CLP…). */
  formatSliceValue?: (value: number) => string
  className?: string
}): React.JSX.Element {
  const visibleSlices = slices.filter((slice) => slice.value > 0)
  const hasData = visibleSlices.length > 0
  const total = visibleSlices.reduce((sum, slice) => sum + slice.value, 0)
  const circumference = 2 * Math.PI * 92

  return (
    <div
      className={cn(
        'one-kpi-card flex flex-col rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]',
        className
      )}
    >
      <div>
        <p className="text-xs font-medium leading-5 text-muted-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
        )}
      </div>

      {hasData ? (
        <>
          <div className="report-donut relative">
            {/* Un único viewBox mantiene el anillo centrado al imprimir y no
                depende de ResizeObserver ni de las dimensiones de la ventana. */}
            <svg
              viewBox="0 0 240 240"
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={title}
            >
              <title>{title}</title>
              {visibleSlices.map((slice, index) => {
                const length = (slice.value / total) * circumference
                const gap = visibleSlices.length > 1 ? Math.min(3, length * 0.1) : 0
                const start =
                  (visibleSlices
                    .slice(0, index)
                    .reduce((sum, previous) => sum + previous.value, 0) /
                    total) *
                  circumference
                return (
                  <circle
                    key={slice.label}
                    cx="120"
                    cy="120"
                    r="92"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="30"
                    strokeDasharray={`${length - gap} ${circumference - length + gap}`}
                    strokeDashoffset={-start}
                    transform="rotate(-90 120 120)"
                  >
                    <title>{`${slice.label}: ${formatSliceValue(slice.value)}`}</title>
                  </circle>
                )
              })}
            </svg>
            <div className="report-donut-center" aria-hidden="true">
              <span className="text-xl font-semibold leading-tight tracking-tight text-foreground tabular-nums">
                {centerValue}
              </span>
              <span className="max-w-32 text-center text-[10px] leading-3 text-muted-foreground">
                {centerLabel}
              </span>
            </div>
          </div>
          <ul className="report-donut-legend" aria-label={`Leyenda: ${title}`}>
            {visibleSlices.map((slice) => (
              <li key={slice.label}>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="report-donut-legend-label min-w-0 flex-1 truncate">
                  {slice.label}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums text-foreground">
                  {formatSliceValue(slice.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="report-donut-empty text-[11px] leading-relaxed text-muted-foreground">
          Sin datos suficientes para este indicador en el período seleccionado.
        </p>
      )}

      {hint && (
        <div className="mt-4 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  )
}
