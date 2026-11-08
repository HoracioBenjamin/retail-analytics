import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { SIDEBAR_ENTRIES } from '@/components/layout/sidebarEntries'
import type { SidebarEntry } from '@/components/layout/SidebarItem'
import { OverviewPage } from '@/features/OverviewPage'
import { VariantsPage } from '@/features/VariantsPage'
import { ForecastsPage } from '@/features/ForecastsPage'
import { RecommendationsPage } from '@/features/RecommendationsPage'
import { DataStatusPage } from '@/features/DataStatusPage'
import { SettingsPage } from '@/features/SettingsPage'
import { ReportsPage } from '@/features/ReportsPage'

/**
 * App de escritorio: HashRouter con las pantallas funcionales del producto
 * pantallas, shell de diseño del Paso 4 y navegación persistida.
 */
function RoutedApp(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const section = location.pathname.split('/')[1]
  const activeId = SIDEBAR_ENTRIES.some((e) => e.id === section) ? section : 'overview'

  const handleSelect = (entry: SidebarEntry): void => {
    navigate(entry.path)
  }

  return (
    <AppShell activeId={activeId} onSelect={handleSelect}>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/variants" element={<VariantsPage />} />
        <Route path="/forecasts" element={<ForecastsPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/data-status" element={<DataStatusPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </AppShell>
  )
}

export default function App(): React.JSX.Element {
  return (
    <HashRouter>
      <RoutedApp />
    </HashRouter>
  )
}
