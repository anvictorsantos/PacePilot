import { InvalidArgumentError } from '@/modules/shared/domain/exception/InvalidArgumentError'
import { ValueObject } from '@/modules/shared/domain/value-object/ValueObject'

/** RPE 1 (very easy) → 10 (maximal) for a Feedback date (CONTEXT.md §RPE). */
export class Rpe extends ValueObject<number> {
  static readonly MIN = 1
  static readonly MAX = 10

  constructor(value: number) {
    super(value)
    this.ensureIsInRange(value)
  }

  /** Any wire value — a number, or the string a native `<select>` hands back. */
  static from(value: unknown): Rpe | null {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    if (!Number.isInteger(parsed)) return null
    return new Rpe(parsed)
  }

  /** The band's label key. */
  labelKey(): string {
    if (this.value <= 2) return 'ui.rpe_label.very_easy'
    if (this.value <= 4) return 'ui.rpe_label.easy'
    if (this.value <= 6) return 'ui.rpe_label.moderate'
    if (this.value <= 8) return 'ui.rpe_label.moderate_hard'
    if (this.value === 9) return 'ui.rpe_label.hard'
    return 'ui.rpe_label.max'
  }

  /** At or above this, the engine drops the next workout's intensity. */
  isHigh(): boolean {
    return this.value >= 8
  }

  private ensureIsInRange(value: number): void {
    if (!Number.isInteger(value) || value < Rpe.MIN || value > Rpe.MAX) {
      throw new InvalidArgumentError(
        `<${this.constructor.name}> does not allow the value <${value}> (expected ${Rpe.MIN}–${Rpe.MAX})`,
      )
    }
  }
}
