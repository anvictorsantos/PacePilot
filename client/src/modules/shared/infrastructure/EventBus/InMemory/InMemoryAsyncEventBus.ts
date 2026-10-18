import type { DomainEvent } from '@/modules/shared/domain/DomainEvent'
import type { EventBus } from '@/modules/shared/domain/EventBus'
import type { DomainEventSubscribers } from '@/modules/shared/infrastructure/EventBus/DomainEventSubscribers'
import { recordRecoveredError } from '@/services/logger.ts'

/**
 * In-memory async bus. The reference extends Node's `EventEmitter`; this app is
 * a browser bundle, so it keeps a plain name → handlers map instead. Same
 * contract: publish settles once every handler has settled, and a handler that
 * throws is reported rather than failing the publish that triggered it — a
 * failed toast must not undo a saved session.
 */
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
