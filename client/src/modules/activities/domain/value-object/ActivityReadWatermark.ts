/**
 * The instant an account last looked at the notification feed — the one piece of
 * state the feed compares against.
 *
 * It is deliberately a value and not just a `Date | null`: "never looked" and
 * "looked at 09:00" are different answers, and a corrupt stored value has to
 * degrade to "never looked" rather than to "now". The second would silently
 * swallow the next import, which is the failure this module exists to end.
 */
export class ActivityReadWatermark {
  private constructor(private readonly value: Date | null) {}

  /** An account that has never marked the feed read. */
  static never(): ActivityReadWatermark {
    return new ActivityReadWatermark(null)
  }

  /** What is in the browser, where anything unreadable reads as never looked. */
  static fromPrimitives(value: string | null | undefined): ActivityReadWatermark {
    if (typeof value !== 'string' || value.trim() === '') return ActivityReadWatermark.never()
    const instant = Date.parse(value)
    return Number.isNaN(instant)
      ? ActivityReadWatermark.never()
      : new ActivityReadWatermark(new Date(instant))
  }

  /**
   * The watermark a "mark all read" writes: the newest import on screen.
   *
   * Deliberately not `max(now, newest import)`. The browser clock is not the
   * server's: a fast one puts the watermark in the future and swallows every
   * activity imported inside that window — the panel's own original failure,
   * re-created by skew. The latest import instant alone is the whole claim,
   * because the button only covers what the athlete can see.
   *
   * With nothing to cover there is no instant to stamp: the caller keeps the
   * watermark it already has rather than writing a clock reading.
   */
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

  /** True when the athlete has already looked at something imported at `at`. */
  covers(at: Date | null | undefined): boolean {
    if (!at || !this.value) return false
    return at.getTime() <= this.value.getTime()
  }

  /** The browser's wire format; `null` means never looked. */
  toPrimitives(): string | null {
    return this.value ? this.value.toISOString() : null
  }
}
