import type { RiskLevel } from '@shared/schemas'
import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  CircleAlert,
  type LucideIcon
} from 'lucide-react'

/**
 * Metadatos de estado por riesgo (plan 7.1): SIEMPRE texto + icono, nunca
 * solo color (accesibilidad). Colores desde tokens del theme.
 */
export const STATUS_META: Record<
  RiskLevel,
  { label: string; icon: LucideIcon; text: string; bg: string }
> = {
  stockout: {
    label: 'Riesgo de faltante',
    icon: AlertTriangle,
    text: 'text-status-stockout',
    bg: 'bg-status-stockout/10'
  },
  excess: {
    label: 'Exceso de inventario',
    icon: ArrowDownRight,
    text: 'text-status-excess',
    bg: 'bg-status-excess/10'
  },
  balanced: {
    label: 'Equilibrado',
    icon: CheckCircle2,
    text: 'text-status-balanced',
    bg: 'bg-status-balanced/10'
  },
  insufficient_data: {
    label: 'Datos insuficientes',
    icon: CircleAlert,
    text: 'text-status-insufficient',
    bg: 'bg-status-insufficient/10'
  }
}
