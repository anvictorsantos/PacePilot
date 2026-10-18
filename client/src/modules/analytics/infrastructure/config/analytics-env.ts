/**
 * GA4 settings, read once at boot from the same `import.meta.env` the Sentry
 * block in `main.ts` reads. TypeScript does not check environment variables, so
 * this is the boundary: trim, default, and hand the rest of the app a value it
 * can trust.
 */
export interface AnalyticsEnv {
  /** The GA4 measurement id (`G-XXXXXXX`) the tag is configured with. */
  measurementId: string
  /** DebugView traffic. On in development, so a dev hit is verifiable. */
  debug: boolean
}

/**
 * `null` when no measurement id is configured. Nothing is loaded and no hit is
 * ever queued, so a checkout without analytics runs exactly as before — the same
 * shape as the optional `VITE_SENTRY_DSN` gate.
 */
export function readAnalyticsEnv(): AnalyticsEnv | null {
  const measurementId = String(import.meta.env.VITE_GA4_MEASUREMENT_ID ?? '').trim()
  if (!measurementId) return null

  const flag = String(import.meta.env.VITE_ANALYTICS_DEBUG ?? '').trim()
  return {
    measurementId,
    debug: flag ? flag === 'true' : Boolean(import.meta.env.DEV),
  }
}
