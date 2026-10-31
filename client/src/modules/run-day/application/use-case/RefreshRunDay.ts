import {
  ActivityKind,
  toActivityKind,
} from '@/modules/activities/domain/value-object/ActivityKind.ts'
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
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

export interface RunDaySnapshot {
  primitives: RunDayPrimitives
  activity: Activity | null
}

// Most authoritative first: explicit Feedback, then a synced activity, then the
// local cache. A failed source is logged and the read continues with the others.
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
    // A day is done on any real session (issue #8): the run wins, else a
    // cross-training one completes it as itself. It never feeds run volume.
    const sameDay = (activities ?? []).filter((a) => this.dateOf(a).equals(dateKey))
    const activity =
      sameDay.find((a) => this.isRun(a)) ?? sameDay.find((a) => this.isCrossTraining(a)) ?? null
    if (activity) runDay.complete(this.identify(activity), this.kindOf(activity))

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

  /** A provider activity carries `start_date` when it has no `date`. */
  private dateOf(entry: { date?: string | null; start_date?: string | null }): LocalDateKey {
    return LocalDateKey.from(entry.date ?? entry.start_date)
  }

  /** Runs only; legacy rows carry no `kind` but were imported as runs (`other`
   *  excluded). An unknown family is not a run but still counts as a session. */
  private isRun(activity: Activity): boolean {
    const kind = toActivityKind(activity.kind)
    if (kind) return kind === ActivityKind.Run
    return !this.declaresKind(activity) && activity.workout_type !== 'other'
  }

  /** Any session that is not a run, including an unknown family. A legacy row
   *  without `kind` was imported as a run, so it is never one. */
  private isCrossTraining(activity: Activity): boolean {
    const kind = toActivityKind(activity.kind)
    if (kind) return kind !== ActivityKind.Run
    return this.declaresKind(activity)
  }

  /** The family that completed the day. A legacy row is a run by definition; an
   *  unknown family must not be shown as one. */
  private kindOf(activity: Activity): ActivityKind {
    const kind = toActivityKind(activity.kind)
    if (kind) return kind
    return this.declaresKind(activity) ? ActivityKind.Other : ActivityKind.Run
  }

  /** The row carries a family, known or not (null `kind` predates the field). */
  private declaresKind(activity: Activity): boolean {
    return activity.kind != null && String(activity.kind).trim() !== ''
  }

  private identify(activity: Activity): string {
    return String(activity.id ?? activity._id ?? activity.provider_activity_id ?? '')
  }
}
