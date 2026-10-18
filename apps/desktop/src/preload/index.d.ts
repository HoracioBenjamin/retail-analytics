import type { AnalyticsApi } from '../shared/contracts'

declare global {
  interface Window {
    analyticsApi: AnalyticsApi
  }
}
