/**
 * Whether this build reports to Sentry.
 *
 * A development build is not the athlete's production: it talks to a local
 * server, it can be running against a stale module graph, and it includes the
 * Playwright run. Those events landed in the same project as real failures,
 * where they are indistinguishable from one — `ReferenceError: useSession is
 * not defined` on `localhost` and a 503 from a database-less e2e server were
 * both counted as production incidents.
 *
 * Production reports by default. A non-production build reports only when it is
 * asked to, so verifying the integration stays possible without polluting the
 * issue stream.
 */
export interface ObservabilityBuild {
  /** `import.meta.env.PROD` — false for `vite dev` and the Playwright run. */
  prod: boolean
  /** `VITE_SENTRY_FORCE` — `'true'` opts a non-production build back in. */
  force?: string | undefined
}

export function observabilityEnabled(build: ObservabilityBuild): boolean {
  if (build.prod) return true
  return build.force === 'true'
}
