import { DomainEvent } from '@/modules/shared/domain/DomainEvent'

// The athlete logged Feedback for a date (CONTEXT.md §Feedback). The plan reacts server-side;
// the client drops the reads that are now stale.
export class FeedbackLoggedDomainEvent extends DomainEvent {
  static readonly EVENT_NAME = 'run-day.feedback.logged'

  readonly dateKey: string
  readonly status: string
  readonly rpe: number | null

  constructor(params: {
    aggregateId: string
    dateKey: string
    status: string
    rpe?: number | null
    eventId?: string | undefined
    occurredOn?: Date | undefined
  }) {
    super({
      eventName: FeedbackLoggedDomainEvent.EVENT_NAME,
      aggregateId: params.aggregateId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    })
    this.dateKey = params.dateKey
    this.status = params.status
    this.rpe = params.rpe ?? null
  }

  static fromPrimitives(params: {
    aggregateId: string
    eventId: string
    occurredOn: Date
    attributes: Record<string, unknown>
  }): FeedbackLoggedDomainEvent {
    return new FeedbackLoggedDomainEvent({
      aggregateId: params.aggregateId,
      dateKey: String(params.attributes.dateKey ?? ''),
      status: String(params.attributes.status ?? ''),
      rpe: (params.attributes.rpe as number | null) ?? null,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    })
  }

  toPrimitives(): Record<string, unknown> {
    return { dateKey: this.dateKey, status: this.status, rpe: this.rpe }
  }
}
