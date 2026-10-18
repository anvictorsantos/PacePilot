import { Uuid } from './value-object/Uuid'

/** Payload an event carries, as primitives — safe to log, persist or replay. */
export type DomainEventAttributes = Record<string, unknown>

/**
 * Base domain event: a fact that already happened, named in the past tense and
 * carrying the aggregate it came from. Mirrors the reference
 * `shared/domain/DomainEvent`.
 */
export abstract class DomainEvent {
  static EVENT_NAME: string
  static fromPrimitives: (params: {
    aggregateId: string
    eventId: string
    occurredOn: Date
    attributes: DomainEventAttributes
  }) => DomainEvent

  readonly aggregateId: string
  readonly eventId: string
  readonly occurredOn: Date
  readonly eventName: string

  constructor(params: {
    eventName: string
    aggregateId: string
    eventId?: string | undefined
    occurredOn?: Date | undefined
  }) {
    const { aggregateId, eventName, eventId, occurredOn } = params
    this.aggregateId = aggregateId
    this.eventId = eventId ?? Uuid.random().value
    this.occurredOn = occurredOn ?? new Date()
    this.eventName = eventName
  }

  abstract toPrimitives(): DomainEventAttributes
}

/** What a subscriber registers against: the event class, not an instance. */
export type DomainEventClass = {
  EVENT_NAME: string
  fromPrimitives(params: {
    aggregateId: string
    eventId: string
    occurredOn: Date
    attributes: DomainEventAttributes
  }): DomainEvent
}
