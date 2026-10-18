import { resetResource } from '@/composables/useResource.ts'
import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent.ts'
import type { DomainEventClass } from '@/modules/shared/domain/DomainEvent.ts'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

/**
 * Logging Feedback changes the plan (the engine re-adapts the week) and the
 * consistency figure, so the cached reads of both are stale the moment it lands.
 * Dropping them here is why the Progress and Plan views show the new numbers on
 * the next visit instead of the previous page's.
 */
export class InvalidateStaleReadsOnFeedbackLogged implements DomainEventSubscriber<FeedbackLoggedDomainEvent> {
  subscribedTo(): Array<DomainEventClass> {
    return [FeedbackLoggedDomainEvent]
  }

  async on(): Promise<void> {
    resetResource(RESOURCE_KEYS.planWeek)
    resetResource(RESOURCE_KEYS.progress)
  }
}
