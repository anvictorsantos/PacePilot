import { DomainEvent } from '@/modules/shared/domain/DomainEvent'

/** Every cached run-day key was dropped — account erasure, or a sign-out. */
export class RunDayCacheClearedDomainEvent extends DomainEvent {
  static readonly EVENT_NAME = 'run-day.cache.cleared'

  constructor(params: {
    aggregateId: string
    eventId?: string | undefined
    occurredOn?: Date | undefined
  }) {
    super({
      eventName: RunDayCacheClearedDomainEvent.EVENT_NAME,
      aggregateId: params.aggregateId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    })
  }

  static fromPrimitives(params: {
    aggregateId: string
    eventId: string
    occurredOn: Date
    attributes: Record<string, unknown>
  }): RunDayCacheClearedDomainEvent {
    return new RunDayCacheClearedDomainEvent({
      aggregateId: params.aggregateId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    })
  }

  toPrimitives(): Record<string, unknown> {
    return {}
  }
}
