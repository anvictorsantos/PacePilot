import type { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import type { AnalyticsParams } from '@/modules/analytics/domain/service/analytics-tracker.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent.ts'
import type { DomainEventClass } from '@/modules/shared/domain/DomainEvent.ts'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber.ts'

/**
 * Only a real submission publishes this event, so no guard is needed here.
 * `status` and `rpe` are the funnel's dimensions and neither identifies the athlete.
 */
export class TrackFeedbackSubmitted implements DomainEventSubscriber<FeedbackLoggedDomainEvent> {
  constructor(private readonly trackEvent: TrackEvent) {}

  subscribedTo(): Array<DomainEventClass> {
    return [FeedbackLoggedDomainEvent]
  }

  async on(event: FeedbackLoggedDomainEvent): Promise<void> {
    const params: AnalyticsParams = { status: event.status }
    if (event.rpe !== null) params.rpe = event.rpe
    this.trackEvent.execute(AnalyticsEventName.FeedbackSubmitted, params)
  }
}
