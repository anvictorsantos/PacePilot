import { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import { Rpe } from '@/modules/feedback/domain/value-object/Rpe.ts'
import type { RunDay } from '@/modules/run-day/domain/entity/RunDay.ts'
import type {
  RunDayFeedback,
  RunDayRepository,
} from '@/modules/run-day/domain/repository/run-day.repository.ts'
import type { EventBus } from '@/modules/shared/domain/EventBus.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'

// Failures are returned, not published — nothing happened, so there is no fact to react to.
export type SubmitRunDayFeedbackFailure = 'already-saved' | 'rpe-required' | 'failed'

export interface SubmitRunDayFeedbackResult {
  ok: boolean
  reason?: SubmitRunDayFeedbackFailure
  message?: string
}

// CONTEXT.md §Skip Without RPE: a plain `skipped` needs no RPE; anything else does.
// On success the aggregate records `FeedbackLoggedDomainEvent` for the subscribers.
export class SubmitRunDayFeedback {
  constructor(
    private readonly repository: RunDayRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    runDay: RunDay,
    feedback: RunDayFeedback,
    apiErrorMessage: (error: unknown) => string,
  ): Promise<SubmitRunDayFeedbackResult> {
    if (runDay.feedbackSaved) return { ok: false, reason: 'already-saved' }

    const rpe = Rpe.from(feedback.rpe)
    if (!rpe && feedback.status !== FeedbackStatus.Skipped) {
      return { ok: false, reason: 'rpe-required' }
    }

    const dateKey = runDay.dateKey
    try {
      await this.repository.submitFeedback(dateKey, { ...feedback, rpe: rpe?.value ?? null })
    } catch (error) {
      return { ok: false, reason: 'failed', message: apiErrorMessage(error) }
    }

    this.repository.writeCachedFeedback(dateKey, { ...feedback, rpe: rpe?.value ?? null })
    runDay.logFeedback({ ...feedback, rpe: rpe?.value ?? null })
    await this.eventBus.publish(runDay.pullDomainEvents())

    return { ok: true }
  }

  static today(): LocalDateKey {
    return LocalDateKey.today()
  }
}
