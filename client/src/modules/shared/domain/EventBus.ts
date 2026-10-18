import type { DomainEvent } from '@/modules/shared/domain/DomainEvent'
import type { DomainEventSubscribers } from '@/modules/shared/infrastructure/EventBus/DomainEventSubscribers'

/** Publishes what happened; subscribers decide what it means. */
export interface EventBus {
  publish(events: Array<DomainEvent>): Promise<void>
  addSubscribers(subscribers: DomainEventSubscribers): void
}
