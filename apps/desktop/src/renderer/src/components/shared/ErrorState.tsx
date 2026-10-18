import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Estado de error del plan (sección 8): distingue códigos estables del
 * contrato (VALIDATION_ERROR, SERVICE_UNAVAILABLE, IPC_REJECTED, NOT_FOUND)
 * y permite reintentar. Nunca sustituye el error por datos ficticios.
 */
export function ErrorState({
  code,
  message,
  onRetry,
  className
}: {
  code?: string
  message: string
  onRetry?: () => void
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center',
        className
      )}
    >
      <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">No se pudo cargar la información</p>
      {code && (
        <p className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {code}
        </p>
      )}
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Reintentar
        </Button>
      )}
    </div>
  )
}
