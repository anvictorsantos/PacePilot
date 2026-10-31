import type { DomainEvent } from '@/modules/shared/domain/DomainEvent'
import type { DomainEventSubscribers } from '@/modules/shared/infrastructure/EventBus/DomainEventSubscribers'

export interface EventBus {
  publish(events: Array<DomainEvent>): Promise<void>
  addSubscribers(subscribers: DomainEventSubscribers): void
}
