import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import type { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import type { PlanFeedback } from '@/modules/feedback/infrastructure/dto/PlanFeedback.ts'
import type { CachedFeedback } from '@/modules/run-day/domain/entity/RunDay.ts'
import type { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'

/** The feedback being submitted for a date. */
export interface RunDayFeedback {
  rpe: number | null
  note: string
  status: FeedbackStatus
}

/**
 * Port for everything the run-day module reads and writes outside the domain:
 * the local cache triple and the two server reads. The adapter that satisfies it
 * (localStorage + the API client) lives in `infrastructure/`; tests supply a
 * fake, which is what makes the aggregate and its use cases testable without a
 * browser.
 */
export interface RunDayRepository {
  readCachedFeedback(dateKey: LocalDateKey): CachedFeedback | null
  writeCachedFeedback(dateKey: LocalDateKey, feedback: RunDayFeedback): void
  clearCachedFeedback(): void
  fetchFeedback(): Promise<PlanFeedback[] | null>
  fetchRecentActivities(): Promise<Activity[]>
  submitFeedback(dateKey: LocalDateKey, feedback: RunDayFeedback): Promise<void>
}
