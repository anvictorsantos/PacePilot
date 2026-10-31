// GA4 settings from `import.meta.env`. TypeScript does not check environment
// variables, so this is the boundary: trim, default, hand out a trusted value.
export interface AnalyticsEnv {
  /** GA4 measurement id, `G-XXXXXXX`. */
  measurementId: string
  /** DebugView traffic. */
  debug: boolean
}

// `null` when unconfigured: nothing loads, no hit is queued, the app runs as before.
export function readAnalyticsEnv(): AnalyticsEnv | null {
  const measurementId = String(import.meta.env.VITE_GA4_MEASUREMENT_ID ?? '').trim()
  if (!measurementId) return null

  const flag = String(import.meta.env.VITE_ANALYTICS_DEBUG ?? '').trim()
  return {
    measurementId,
    debug: flag ? flag === 'true' : Boolean(import.meta.env.DEV),
  }
}
