import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent.ts'
import type { DomainEventClass } from '@/modules/shared/domain/DomainEvent.ts'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber.ts'
import { invalidateResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * Logging Feedback changes the plan (the engine re-adapts the week) and the
 * consistency figure, so the cached reads of both are stale the moment it lands.
 * Refreshing them in place is why the Progress and Plan views show the new
 * numbers without emptying while the athlete is still looking at them.
 */
export class InvalidateStaleReadsOnFeedbackLogged implements DomainEventSubscriber<FeedbackLoggedDomainEvent> {
  subscribedTo(): Array<DomainEventClass> {
    return [FeedbackLoggedDomainEvent]
  }

  async on(): Promise<void> {
    invalidateResource(RESOURCE_KEYS.planWeek)
    invalidateResource(RESOURCE_KEYS.progress)
  }
}
