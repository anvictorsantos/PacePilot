import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey'
import { StringValueObject } from '@/modules/shared/domain/value-object/StringValueObject'

/** The three cache keys for one day's feedback (`feedback:<date>[:status|:data]`),
 *  built here so the schema cannot drift across call sites. */
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
