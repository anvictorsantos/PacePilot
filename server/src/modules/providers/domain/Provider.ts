// Evidence, never a rule: nothing under `training`, `progress` or `ai` may branch on
// this. A const object, not a TS `enum`: Node's strip-only type removal rejects enum syntax.
export const Provider = {
  Strava: 'strava',
  Garmin: 'garmin',
} as const

export type Provider = (typeof Provider)[keyof typeof Provider]

export const PROVIDERS: readonly Provider[] = Object.values(Provider)

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value)
}
