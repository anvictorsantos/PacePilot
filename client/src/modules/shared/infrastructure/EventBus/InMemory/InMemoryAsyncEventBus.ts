import type { DomainEvent } from '@/modules/shared/domain/DomainEvent'
import type { EventBus } from '@/modules/shared/domain/EventBus'
import type { DomainEventSubscribers } from '@/modules/shared/infrastructure/EventBus/DomainEventSubscribers'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

// Browser bundle, so a name → handlers map instead of Node's EventEmitter. Publish
// settles once every handler settles; a throwing handler is reported, not rethrown.
export class InMemoryAsyncEventBus implements EventBus {
  private readonly handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>()

  async publish(events: Array<DomainEvent>): Promise<void> {
    await Promise.all(
      events.map(async (event) => {
        const handlers = this.handlers.get(event.eventName) ?? []
        await Promise.all(
          handlers.map(async (handler) => {
            try {
              await handler(event)
            } catch (error) {
              recordRecoveredError(error, { feature: 'event-bus', operation: event.eventName })
            }
          }),
        )
      }),
    )
  }

  addSubscribers(subscribers: DomainEventSubscribers): void {
    subscribers.items.forEach((subscriber) => {
      subscriber.subscribedTo().forEach((eventClass) => {
        const handlers = this.handlers.get(eventClass.EVENT_NAME) ?? []
        handlers.push(subscriber.on.bind(subscriber) as (event: DomainEvent) => Promise<void>)
        this.handlers.set(eventClass.EVENT_NAME, handlers)
      })
    })
  }
}
