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
   * The watermark a "mark all read" writes: the later of now and the newest
   * import on screen. Anchoring on the newest import keeps the button honest
   * when the browser clock runs behind the server's — otherwise the rows the
   * athlete just acknowledged would stay unread until the clocks caught up.
   */
  static covering(
    instants: readonly (Date | null | undefined)[],
    now: Date,
  ): ActivityReadWatermark {
    let latest = now.getTime()
    for (const instant of instants) {
      if (instant && instant.getTime() > latest) latest = instant.getTime()
    }
    return new ActivityReadWatermark(new Date(latest))
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
