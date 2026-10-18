import type { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { RunDayCompletedDomainEvent } from '@/modules/run-day/domain/event/RunDayCompletedDomainEvent.ts'
import type { DomainEventClass } from '@/modules/shared/domain/DomainEvent.ts'
import type { DomainEventSubscriber } from '@/modules/shared/domain/DomainEventSubscriber.ts'

/**
 * A day gained a completed session → `workout_logged`.
 *
 * The event is published from a read as well as from a write (`RefreshRunDay`
 * reports whatever the day turned out to be), so the same day would be counted
 * once per page load without the guard below. The guard is in-memory on purpose:
 * a reload is a new funnel chance, but a re-render is not.
 */
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
