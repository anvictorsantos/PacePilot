// Production reports to Sentry. A non-production build (vite dev, the Playwright
// run) reports only when VITE_SENTRY_FORCE opts in, keeping local failures out.
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
