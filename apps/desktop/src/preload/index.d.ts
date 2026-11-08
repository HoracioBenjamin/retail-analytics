import type { AnalyticsApi } from '../shared/contracts'
import type { ReportExportApi } from '../shared/report-export'

declare global {
  interface Window {
    analyticsApi: AnalyticsApi
    reportExportApi: ReportExportApi
  }
}
