import type { DomainEvent } from './DomainEvent'
import type { DomainEventSubscribers } from '../infrastructure/EventBus/DomainEventSubscribers'

/** Publishes what happened; subscribers decide what it means. */
export interface EventBus {
  publish(events: Array<DomainEvent>): Promise<void>
  addSubscribers(subscribers: DomainEventSubscribers): void
}
