import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent.ts'
import type { DomainEventClass } from '@/modules/shared/domain/DomainEvent.ts'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber.ts'
import { invalidateResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

// Logging Feedback re-adapts the plan and moves the consistency figure, so both cached
// reads go stale; invalidating in place refreshes them without emptying the views.
export class InvalidateStaleReadsOnFeedbackLogged implements DomainEventSubscriber<FeedbackLoggedDomainEvent> {
  subscribedTo(): Array<DomainEventClass> {
    return [FeedbackLoggedDomainEvent]
  }

  async on(): Promise<void> {
    invalidateResource(RESOURCE_KEYS.planWeek)
    invalidateResource(RESOURCE_KEYS.progress)
  }
}
