// Day keys for the athlete's zone. The server may run anywhere; only this module
// decides which calendar day an instant belongs to.
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    formatters.set(zone, formatter)
  }
  return formatter
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `YYYY-MM-DD` for the calendar day `date` falls on in `timeZone` (server local when absent). */
export function dateKeyInZone(date: Date, timeZone?: string): string {
  if (!timeZone) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  const parts = formatterFor(timeZone).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value
  return `${part('year') ?? '0000'}-${part('month') ?? '01'}-${part('day') ?? '01'}`
}

/** A valid IANA zone from the request header, or undefined so callers keep server local. */
export function timeZoneFromHeader(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const zone = value.trim()
  try {
    formatterFor(zone)
    return zone
  } catch {
    return undefined
  }
}

/** UTC noon on a date key: DST and the local zone cannot shift it. */
function keyToUtcNoon(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  return Date.UTC(Number(match[1] ?? 0), Number(match[2] ?? 1) - 1, Number(match[3] ?? 1), 12)
}

/** A `YYYY-MM-DD` key plus whole days. */
export function addDaysToKey(key: string, days: number): string {
  const at = keyToUtcNoon(key)
  if (at == null) return key
  const date = new Date(at + days * 86_400_000)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** 0 = Sunday … 6 = Saturday for a `YYYY-MM-DD` key. */
export function weekdayOfKey(key: string): number {
  const at = keyToUtcNoon(key)
  return at == null ? 0 : new Date(at).getUTCDay()
}

/** Whole calendar days from `fromKey` to `toKey`; NaN when either is malformed. */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = keyToUtcNoon(fromKey)
  const to = keyToUtcNoon(toKey)
  if (from == null || to == null) return NaN
  return Math.round((to - from) / 86_400_000)
}
