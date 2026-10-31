import type { DomainEvent } from '@/modules/shared/domain/DomainEvent'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber'
import type { Container } from '@/modules/shared/infrastructure/container'

export class DomainEventSubscribers {
  private constructor(readonly items: Array<DomainEventSubscriber<DomainEvent>>) {}

  static from(container: Container): DomainEventSubscribers {
    return new DomainEventSubscribers(
      container.getAll<DomainEventSubscriber<DomainEvent>>('DomainEventSubscriber'),
    )
  }
}
