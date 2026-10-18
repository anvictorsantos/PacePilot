/**
 * The athlete's answer to the analytics banner (CONTEXT.md §Analytics Consent).
 *
 * `Denied` is not the same state as "never asked": Consent Mode starts denied, so
 * `null` from a repository means the banner still owes the athlete the question,
 * while `Denied` means they said no and must not be asked again.
 */
export enum AnalyticsConsent {
  Granted = 'granted',
  Denied = 'denied',
}

export const ANALYTICS_CONSENTS: readonly AnalyticsConsent[] = Object.values(AnalyticsConsent)

/** Narrow a persisted or untrusted value; `null` when it is neither answer. */
export function toAnalyticsConsent(value: unknown): AnalyticsConsent | null {
  const key = String(value ?? '')
  return (ANALYTICS_CONSENTS as readonly string[]).includes(key) ? (key as AnalyticsConsent) : null
}

/** The one question the gate asks: may this hit be sent? */
export function isAnalyticsGranted(value: unknown): boolean {
  return toAnalyticsConsent(value) === AnalyticsConsent.Granted
}
