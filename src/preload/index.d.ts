import type { DashboardAPI } from '../shared/api'

declare global {
  interface Window {
    api: DashboardAPI
  }
}

export {}
