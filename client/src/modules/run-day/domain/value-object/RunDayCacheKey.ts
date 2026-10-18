import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey'
import { StringValueObject } from '@/modules/shared/domain/value-object/StringValueObject'

/**
 * The local-cache keys for one day's feedback: `feedback:<date>`,
 * `feedback:<date>:status` and `feedback:<date>:data`.
 *
 * They used to be built by hand in three places (the composable, the dead
 * WorkoutCard and the account-erasure path), which is how a schema drifts. The
 * triple is one value object now.
 */
export class RunDayCacheKey extends StringValueObject {
  static readonly PREFIX = 'feedback:'

  static forDate(dateKey: LocalDateKey): RunDayCacheKey {
    return new RunDayCacheKey(`${RunDayCacheKey.PREFIX}${dateKey.value}`)
  }

  /** The mark written when feedback exists at all. */
  get mark(): string {
    return this.value
  }

  get status(): string {
    return `${this.value}:status`
  }

  get data(): string {
    return `${this.value}:data`
  }

  /** True for every key this object owns — the account-erasure sweep. */
  static isRunDayKey(key: string): boolean {
    return key.startsWith(RunDayCacheKey.PREFIX)
  }
}
