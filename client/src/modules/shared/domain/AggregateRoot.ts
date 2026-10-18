import { DomainEvent } from './DomainEvent'

/**
 * Base for the aggregates in this client. State changes are made through named
 * methods that record an event, and the application layer publishes what the
 * aggregate accumulated — the only way a side effect (toast, cache clear, bell
 * refresh) gets triggered is by something having happened.
 */
export abstract class AggregateRoot {
  private domainEvents: Array<DomainEvent> = []

  pullDomainEvents(): Array<DomainEvent> {
    const domainEvents = this.domainEvents.slice()
    this.domainEvents = []
    return domainEvents
  }

  record(event: DomainEvent): void {
    this.domainEvents.push(event)
  }

  abstract toPrimitives(): Record<string, unknown>
}
