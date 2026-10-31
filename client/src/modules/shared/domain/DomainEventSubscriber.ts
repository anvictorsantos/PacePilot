import type { DomainEvent, DomainEventClass } from '@/modules/shared/domain/DomainEvent'

// A subscriber's side effect lives beside the event it belongs to, not inside the
// use case that published it.
export interface DomainEventSubscriber<T extends DomainEvent> {
  subscribedTo(): Array<DomainEventClass>
  on(domainEvent: T): Promise<void>
}
