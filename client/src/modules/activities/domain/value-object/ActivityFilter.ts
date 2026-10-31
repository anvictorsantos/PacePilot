import { EnumValueObject } from '@/modules/shared/domain/value-object/EnumValueObject'
import { toWorkoutType } from '@/modules/training/domain/value-object/WorkoutType.ts'

// One enum feeds the chips, the query parameter and the empty-state copy, so a new
// workout type cannot land in one and be missing from the others.
export enum ActivityFilterValue {
  All = 'all',
  Easy = 'easy',
  Tempo = 'tempo',
  Long = 'long',
  Threshold = 'threshold',
  Interval = 'interval',
  Recovery = 'recovery',
}

export const ACTIVITY_FILTERS: readonly ActivityFilterValue[] = Object.values(ActivityFilterValue)

export class ActivityFilter extends EnumValueObject<ActivityFilterValue> {
  constructor(value: ActivityFilterValue) {
    super(value, ACTIVITY_FILTERS)
  }

  /** Any wire value — an unknown filter reads as "everything". */
  static from(value: unknown): ActivityFilter {
    const key = String(value ?? '')
    return new ActivityFilter(
      (ACTIVITY_FILTERS as readonly string[]).includes(key)
        ? (key as ActivityFilterValue)
        : ActivityFilterValue.All,
    )
  }

  isAll(): boolean {
    return this.value === ActivityFilterValue.All
  }

  toQueryParam(): string {
    return this.value
  }

  // The two enums share their wire strings, so this compares values, not members.
  matches(workoutType: unknown): boolean {
    if (this.isAll()) return true
    const type = toWorkoutType(workoutType)
    return type !== null && String(type) === String(this.value)
  }

  static chips(): ActivityFilter[] {
    return ACTIVITY_FILTERS.map((value) => new ActivityFilter(value))
  }

  labelKey(): string {
    return `landing.sections.activities.filter.${this.value}`
  }
}
