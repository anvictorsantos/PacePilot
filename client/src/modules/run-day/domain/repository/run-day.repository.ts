import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import type { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import type { PlanFeedback } from '@/modules/feedback/infrastructure/dto/PlanFeedback.ts'
import type { CachedFeedback } from '@/modules/run-day/domain/entity/RunDay.ts'
import type { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'

export interface RunDayFeedback {
  rpe: number | null
  note: string
  status: FeedbackStatus
}

/**
 * Port for everything the run-day module reads and writes outside the domain: the
 * local cache triple and the two server reads. Tests supply a fake, so the aggregate
 * and its use cases run without a browser.
 */
export interface RunDayRepository {
  readCachedFeedback(dateKey: LocalDateKey): CachedFeedback | null
  writeCachedFeedback(dateKey: LocalDateKey, feedback: RunDayFeedback): void
  clearCachedFeedback(): void
  fetchFeedback(): Promise<PlanFeedback[] | null>
  fetchRecentActivities(): Promise<Activity[]>
  submitFeedback(dateKey: LocalDateKey, feedback: RunDayFeedback): Promise<void>
}
