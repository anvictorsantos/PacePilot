// CONTEXT.md §Analytics Consent. `null` means never asked and `Denied` means no and
// never ask again — Consent Mode starts denied, so the banner owes the question only once.
export enum AnalyticsConsent {
  Granted = 'granted',
  Denied = 'denied',
}

export const ANALYTICS_CONSENTS: readonly AnalyticsConsent[] = Object.values(AnalyticsConsent)

export function toAnalyticsConsent(value: unknown): AnalyticsConsent | null {
  const key = String(value ?? '')
  return (ANALYTICS_CONSENTS as readonly string[]).includes(key) ? (key as AnalyticsConsent) : null
}

export function isAnalyticsGranted(value: unknown): boolean {
  return toAnalyticsConsent(value) === AnalyticsConsent.Granted
}
