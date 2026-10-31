import type { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { RunDayCompletedDomainEvent } from '@/modules/run-day/domain/event/RunDayCompletedDomainEvent.ts'
import type { DomainEventClass } from '@/modules/shared/domain/DomainEvent.ts'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber.ts'

// The event is published from a read as well as a write, so the guard stops the same
// day counting once per page load; a reload is a new funnel chance, a re-render is not.
export class TrackWorkoutLogged implements DomainEventSubscriber<RunDayCompletedDomainEvent> {
  private readonly counted = new Set<string>()

  constructor(private readonly trackEvent: TrackEvent) {}

  subscribedTo(): Array<DomainEventClass> {
    return [RunDayCompletedDomainEvent]
  }

  async on(event: RunDayCompletedDomainEvent): Promise<void> {
    const source = event.activityId ? 'strava' : 'feedback'
    const key = `${event.dateKey}:${source}`
    if (this.counted.has(key)) return
    this.counted.add(key)
    this.trackEvent.execute(AnalyticsEventName.WorkoutLogged, { source })
  }
}
