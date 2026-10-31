import {
  FeedbackStatus,
  toFeedbackStatus,
} from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent.ts'
import type { RunDayNotifier } from '@/modules/run-day/domain/service/run-day-notifier.ts'
import type { DomainEventClass } from '@/modules/shared/domain/DomainEvent.ts'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber.ts'

export class AnnounceFeedbackLogged implements DomainEventSubscriber<FeedbackLoggedDomainEvent> {
  constructor(private readonly notifier: RunDayNotifier) {}

  subscribedTo(): Array<DomainEventClass> {
    return [FeedbackLoggedDomainEvent]
  }

  async on(event: FeedbackLoggedDomainEvent): Promise<void> {
    this.notifier.feedbackSaved(toFeedbackStatus(event.status) ?? FeedbackStatus.Completed)
  }
}
