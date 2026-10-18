import { StringValueObject } from '@/modules/shared/domain/value-object/StringValueObject'

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * A local calendar day, `YYYY-MM-DD`, never a UTC conversion.
 *
 * CONTEXT.md §Week Alignment: `toISOString().slice(0, 10)` shifts the day at
 * midnight in any non-UTC timezone, which is how the app used to disagree with
 * itself about whether today's run had happened. Every date key in the client
 * goes through this value object.
 */
export class LocalDateKey extends StringValueObject {
  static today(): LocalDateKey {
    return LocalDateKey.fromDate(new Date())
  }

  static fromDate(date: Date): LocalDateKey {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return new LocalDateKey(`${year}-${month}-${day}`)
  }

  /** Any wire value — an ISO timestamp, a `YYYY-MM-DD`, a number, a `Date`. */
  static from(value: unknown): LocalDateKey {
    if (value instanceof Date) return LocalDateKey.fromDate(value)
    if (typeof value === 'number') return LocalDateKey.fromDate(new Date(value))
    const raw = String(value ?? '')
    if (LOCAL_DATE_PATTERN.test(raw)) return new LocalDateKey(raw)
    const parsed = new Date(raw)
    if (!isNaN(parsed.getTime())) return LocalDateKey.fromDate(parsed)
    // unparseable: keep the leading date so the key stays comparable
    return new LocalDateKey(raw.slice(0, 10))
  }

  equals(other: LocalDateKey): boolean {
    return other instanceof LocalDateKey && other.value === this.value
  }

  isBefore(other: LocalDateKey): boolean {
    return this.value < other.value
  }

  isAfter(other: LocalDateKey): boolean {
    return this.value > other.value
  }

  /** `Mon 12:00` — midday anchor so a date string never lands on the previous day. */
  toDate(): Date {
    return new Date(`${this.value}T12:00:00`)
  }
}
