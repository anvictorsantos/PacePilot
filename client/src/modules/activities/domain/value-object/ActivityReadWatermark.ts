// `null` means never looked, and an unreadable stored value degrades to it: reading
// it as "now" would swallow the next import.
export class ActivityReadWatermark {
  private constructor(private readonly value: Date | null) {}

  static never(): ActivityReadWatermark {
    return new ActivityReadWatermark(null)
  }

  static fromPrimitives(value: string | null | undefined): ActivityReadWatermark {
    if (typeof value !== 'string' || value.trim() === '') return ActivityReadWatermark.never()
    const instant = Date.parse(value)
    return Number.isNaN(instant)
      ? ActivityReadWatermark.never()
      : new ActivityReadWatermark(new Date(instant))
  }

  // Deliberately not `max(now, newest import)`: a fast browser clock puts the mark in
  // the future and swallows every import inside that window. Nothing to cover keeps the old mark.
  static covering(instants: readonly (Date | null | undefined)[]): ActivityReadWatermark {
    let latest: number | null = null
    for (const instant of instants) {
      if (!instant) continue
      if (latest === null || instant.getTime() > latest) latest = instant.getTime()
    }
    return latest === null
      ? ActivityReadWatermark.never()
      : new ActivityReadWatermark(new Date(latest))
  }

  get instant(): Date | null {
    return this.value ? new Date(this.value.getTime()) : null
  }

  isNever(): boolean {
    return this.value === null
  }

  covers(at: Date | null | undefined): boolean {
    if (!at || !this.value) return false
    return at.getTime() <= this.value.getTime()
  }

  toPrimitives(): string | null {
    return this.value ? this.value.toISOString() : null
  }
}
