import type { DomainEvent, DomainEventClass } from '@/modules/shared/domain/DomainEvent'

/**
 * Reacts to a domain event. A subscriber declares which events it wants and
 * what it does when one arrives — so the side effect lives beside the event it
 * belongs to, not inside the use case that published it.
 */
export interface DomainEventSubscriber<T extends DomainEvent> {
  subscribedTo(): Array<DomainEventClass>
  on(domainEvent: T): Promise<void>
}
