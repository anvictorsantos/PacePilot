import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import {
  FeedbackStatus,
  toFeedbackStatus,
} from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import type { PlanFeedback } from '@/modules/feedback/infrastructure/dto/PlanFeedback.ts'
import { RunDay, type RunDayPrimitives } from '@/modules/run-day/domain/entity/RunDay.ts'
import type { RunDayRepository } from '@/modules/run-day/domain/repository/run-day.repository.ts'
import type { EventBus } from '@/modules/shared/domain/EventBus.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'
import { recordRecoveredError } from '@/services/logger.ts'

/** What a read resolves to: the day's state plus the activity behind it. */
export interface RunDaySnapshot {
  primitives: RunDayPrimitives
  activity: Activity | null
}

/**
 * Resolve the day from its three sources, most authoritative first — explicit
 * Feedback (CONTEXT.md §Feedback), then a synced Strava Activity, then the local
 * cache — and publish whatever that turned out to be. A source that fails is
 * reported and the read continues with the others: a missing activities endpoint
 * must not blank the screen.
 */
export class RefreshRunDay {
  constructor(
    private readonly repository: RunDayRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(dateKey: LocalDateKey = LocalDateKey.today()): Promise<RunDaySnapshot> {
    const runDay = RunDay.empty(dateKey)

    // the local cache is the optimistic fast path; the server read below wins
    runDay.hydrate({ feedback: this.repository.readCachedFeedback(dateKey) })

    const feedback = await this.fetch(this.repository.fetchFeedback(), 'feedback')
    const entry = this.findForDate(feedback, dateKey)
    if (entry) {
      const status = toFeedbackStatus(entry.status) ?? FeedbackStatus.Completed
      runDay.hydrate({
        feedback: {
          rpe: entry.rpe ?? null,
          note: entry.notes ?? entry.note ?? '',
          status,
        },
      })
      this.repository.writeCachedFeedback(dateKey, {
        rpe: entry.rpe ?? null,
        note: entry.notes ?? entry.note ?? '',
        status,
      })
    }

    const activities = await this.fetch(this.repository.fetchRecentActivities(), 'activities')
    const activity = (activities ?? []).find((a) => this.dateOf(a).equals(dateKey)) ?? null
    if (activity) runDay.complete(this.identify(activity))

    await this.eventBus.publish(runDay.pullDomainEvents())

    return { primitives: runDay.toPrimitives(), activity }
  }

  private async fetch<T>(promise: Promise<T>, source: string): Promise<T | null> {
    try {
      return await promise
    } catch (error) {
      recordRecoveredError(error, { feature: 'run-day', operation: `read:${source}` })
      return null
    }
  }

  private findForDate(entries: PlanFeedback[] | null, dateKey: LocalDateKey): PlanFeedback | null {
    if (!Array.isArray(entries)) return null
    return entries.find((entry) => this.dateOf(entry).equals(dateKey)) ?? null
  }

  /** A Strava activity carries `start_date` when it has no `date`. */
  private dateOf(entry: { date?: string | null; start_date?: string | null }): LocalDateKey {
    return LocalDateKey.from(entry.date ?? entry.start_date)
  }

  private identify(activity: Activity): string {
    return String(activity.strava_activity_id ?? activity.id ?? activity._id ?? '')
  }
}
