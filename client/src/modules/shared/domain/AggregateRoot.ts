import { DomainEvent } from '@/modules/shared/domain/DomainEvent'

// Aggregates record events in named methods; the application layer publishes what
// `pullDomainEvents()` returns, so a side effect only follows something having happened.
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
