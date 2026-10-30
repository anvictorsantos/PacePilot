import { ActivityKind, toActivityKind } from '@/modules/activities/domain/value-object/ActivityKind'
import { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus'
import { Rpe } from '@/modules/feedback/domain/value-object/Rpe'
import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent'
import { RunDayCacheClearedDomainEvent } from '@/modules/run-day/domain/event/RunDayCacheClearedDomainEvent'
import { RunDayCompletedDomainEvent } from '@/modules/run-day/domain/event/RunDayCompletedDomainEvent'
import { AggregateRoot } from '@/modules/shared/domain/AggregateRoot'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey'

// A type alias, not an interface: only aliases carry the implicit index
// signature that makes this assignable to `AggregateRoot.toPrimitives()`.
export type RunDayPrimitives = {
  dateKey: string
  completed: boolean
  activityId: string | null
  /** The family of the session behind the activity: a run or cross-training. */
  activityKind: string | null
  feedbackSaved: boolean
  rpe: number | null
  note: string
  status: string
}

export interface CachedFeedback {
  rpe: number | null
  note: string
  status: FeedbackStatus
}

/**
 * One day of training, as the athlete's own record of it: whether the session
 * happened, which activity it was, its family, and the Feedback logged for the
 * date.
 *
 * The aggregate owns the transitions. Reading state (hydrating from the local
 * cache, or from a server read) changes nothing and records nothing; completing
 * the day, logging feedback and clearing the cache are the three facts the rest
 * of the app reacts to, and each records an event that the application layer
 * publishes.
 *
 * A day counts as done when any real session happened (issue #8): a run or an
 * imported cross-training session. Only a run feeds run metrics — the server
 * keeps contribution out — and a cross-training day never asks for run Feedback.
 */
export class RunDay extends AggregateRoot {
  private constructor(
    readonly dateKey: LocalDateKey,
    private completedFlag: boolean,
    private activityIdValue: string | null,
    private activityKindValue: ActivityKind | null,
    private feedbackSavedFlag: boolean,
    private rpeValue: number | null,
    private noteValue: string,
    private statusValue: FeedbackStatus,
  ) {
    super()
  }

  static empty(dateKey: LocalDateKey): RunDay {
    return new RunDay(dateKey, false, null, null, false, null, '', FeedbackStatus.Completed)
  }

  static fromPrimitives(primitives: RunDayPrimitives): RunDay {
    return new RunDay(
      LocalDateKey.from(primitives.dateKey),
      primitives.completed,
      primitives.activityId,
      toActivityKind(primitives.activityKind),
      primitives.feedbackSaved,
      primitives.rpe,
      primitives.note,
      (primitives.status as FeedbackStatus) ?? FeedbackStatus.Completed,
    )
  }

  get id(): string {
    return this.dateKey.value
  }

  get completed(): boolean {
    return this.completedFlag
  }

  get activityId(): string | null {
    return this.activityIdValue
  }

  get activityKind(): ActivityKind | null {
    return this.activityKindValue
  }

  /** The day happened, but not from a run: imported cross-training. */
  get crossTraining(): boolean {
    return this.activityKindValue !== null && this.activityKindValue !== ActivityKind.Run
  }

  get feedbackSaved(): boolean {
    return this.feedbackSavedFlag
  }

  get rpe(): number | null {
    return this.rpeValue
  }

  get note(): string {
    return this.noteValue
  }

  get status(): FeedbackStatus {
    return this.statusValue
  }

  /** Reading state — no transition, no event. */
  hydrate(params: {
    completed?: boolean
    activityId?: string | null
    feedback?: CachedFeedback | null
  }): void {
    if (params.completed) this.completedFlag = true
    if (params.activityId !== undefined) this.activityIdValue = params.activityId
    if (params.feedback) {
      this.feedbackSavedFlag = true
      this.rpeValue = params.feedback.rpe
      this.noteValue = params.feedback.note
      this.statusValue = params.feedback.status
      // an explicit completed entry means the day happened; a skip means it did
      // not, and it overrides the optimistic cache
      this.completedFlag = params.feedback.status === FeedbackStatus.Completed
    }
  }

  /** The session happened. Records only on the transition, so a re-read is silent. */
  complete(activityId: string | null, kind: ActivityKind | null = null): void {
    if (this.completedFlag) {
      if (activityId) this.activityIdValue = activityId
      if (kind) this.activityKindValue = kind
      return
    }
    this.completedFlag = true
    this.activityIdValue = activityId
    this.activityKindValue = kind
    this.record(
      new RunDayCompletedDomainEvent({ aggregateId: this.id, dateKey: this.id, activityId }),
    )
  }

  /** The athlete logged the outcome for the date. */
  logFeedback(feedback: { rpe: number | null; note: string; status: FeedbackStatus }): void {
    this.feedbackSavedFlag = true
    this.rpeValue = feedback.rpe
    this.noteValue = feedback.note
    this.statusValue = feedback.status
    // Logging feedback is a statement about the plan; a synced activity is
    // evidence a run happened, and evidence is not undone by a later skip.
    if (feedback.status === FeedbackStatus.Completed) this.completedFlag = true
    else if (!this.activityIdValue) this.completedFlag = false
    this.record(
      new FeedbackLoggedDomainEvent({
        aggregateId: this.id,
        dateKey: this.id,
        status: feedback.status,
        rpe: feedback.rpe,
      }),
    )
  }

  /** The cached day is gone (account erasure). */
  clear(): void {
    this.completedFlag = false
    this.activityIdValue = null
    this.activityKindValue = null
    this.feedbackSavedFlag = false
    this.rpeValue = null
    this.noteValue = ''
    this.statusValue = FeedbackStatus.Completed
    this.record(new RunDayCacheClearedDomainEvent({ aggregateId: this.id }))
  }

  /** The RPE as a value object, for callers that need its band or threshold. */
  rpeValueObject(): Rpe | null {
    return this.rpeValue === null ? null : Rpe.from(this.rpeValue)
  }

  toPrimitives(): RunDayPrimitives {
    return {
      dateKey: this.dateKey.value,
      completed: this.completedFlag,
      activityId: this.activityIdValue,
      activityKind: this.activityKindValue,
      feedbackSaved: this.feedbackSavedFlag,
      rpe: this.rpeValue,
      note: this.noteValue,
      status: this.statusValue,
    }
  }
}
