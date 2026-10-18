import type { DomainEvent } from '../../domain/DomainEvent'
import type { DomainEventSubscriber } from '../../domain/DomainEventSubscriber'
import type { Container } from '../container'

/** The set of subscribers a container knows about, for the bus to register. */
export class DomainEventSubscribers {
  private constructor(readonly items: Array<DomainEventSubscriber<DomainEvent>>) {}

  static from(container: Container): DomainEventSubscribers {
    return new DomainEventSubscribers(
      container.getAll<DomainEventSubscriber<DomainEvent>>('DomainEventSubscriber'),
    )
  }
}
