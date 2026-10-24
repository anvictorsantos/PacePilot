import { DomainEvent } from '@/modules/shared/domain/DomainEvent'

/** Today's run happened — explicit Feedback or a synced provider activity. */
export class RunDayCompletedDomainEvent extends DomainEvent {
  static readonly EVENT_NAME = 'run-day.completed'

  readonly dateKey: string
  readonly activityId: string | null

  constructor(params: {
    aggregateId: string
    dateKey: string
    activityId?: string | null
    eventId?: string | undefined
    occurredOn?: Date | undefined
  }) {
    super({
      eventName: RunDayCompletedDomainEvent.EVENT_NAME,
      aggregateId: params.aggregateId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    })
    this.dateKey = params.dateKey
    this.activityId = params.activityId ?? null
  }

  static fromPrimitives(params: {
    aggregateId: string
    eventId: string
    occurredOn: Date
    attributes: Record<string, unknown>
  }): RunDayCompletedDomainEvent {
    return new RunDayCompletedDomainEvent({
      aggregateId: params.aggregateId,
      dateKey: String(params.attributes.dateKey ?? ''),
      activityId: (params.attributes.activityId as string | null) ?? null,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    })
  }

  toPrimitives(): Record<string, unknown> {
    return { dateKey: this.dateKey, activityId: this.activityId }
  }
}
