import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import {
  FeedbackStatus,
  toFeedbackStatus,
} from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import type { PlanFeedback } from '@/modules/feedback/infrastructure/dto/PlanFeedback.ts'
import type { CachedFeedback } from '@/modules/run-day/domain/entity/RunDay.ts'
import type {
  RunDayFeedback,
  RunDayRepository,
} from '@/modules/run-day/domain/repository/run-day.repository.ts'
import { RunDayCacheKey } from '@/modules/run-day/domain/value-object/RunDayCacheKey.ts'
import type { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

/**
 * The real adapter: the local cache triple plus the two API reads the run-day
 * module needs. The cache schema lives entirely in `RunDayCacheKey`, so a
 * storage failure is reported and reported once, here.
 */
export class LocalStorageRunDayRepository implements RunDayRepository {
  readCachedFeedback(dateKey: LocalDateKey): CachedFeedback | null {
    try {
      const keys = RunDayCacheKey.forDate(dateKey)
      if (!localStorage.getItem(keys.mark)) return null
      const parsed = JSON.parse(localStorage.getItem(keys.data) || '{}')
      return {
        status: toFeedbackStatus(localStorage.getItem(keys.status)) ?? FeedbackStatus.Completed,
        rpe: parsed.rpe ?? null,
        note: parsed.note ?? '',
      }
    } catch (error) {
      recordRecoveredError(error, { feature: 'run-day', operation: 'read-cache' })
      return null
    }
  }

  writeCachedFeedback(dateKey: LocalDateKey, feedback: RunDayFeedback): void {
    try {
      const keys = RunDayCacheKey.forDate(dateKey)
      localStorage.setItem(keys.mark, '1')
      localStorage.setItem(keys.status, feedback.status)
      localStorage.setItem(
        keys.data,
        JSON.stringify({ rpe: feedback.rpe, note: feedback.note, status: feedback.status }),
      )
    } catch (error) {
      recordRecoveredError(error, { feature: 'run-day', operation: 'write-cache' })
    }
  }

  clearCachedFeedback(): void {
    try {
      Object.keys(localStorage)
        .filter(RunDayCacheKey.isRunDayKey)
        .forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      recordRecoveredError(error, { feature: 'run-day', operation: 'clear-cache' })
    }
  }

  fetchFeedback(): Promise<PlanFeedback[] | null> {
    return api.plan.feedback()
  }

  async fetchRecentActivities(): Promise<Activity[]> {
    const data = await api.activities.list({ perPage: 10 })
    return data.items ?? []
  }

  async submitFeedback(dateKey: LocalDateKey, feedback: RunDayFeedback): Promise<void> {
    await api.plan.submitFeedback({
      date: dateKey.value,
      rpe: feedback.rpe,
      note: feedback.note,
      status: feedback.status,
    })
  }
}
