import { describe, expect, it, vi } from 'vitest'

import { TrackWorkoutLogged } from '@/modules/analytics/application/use-case/subscriber/TrackWorkoutLogged.ts'
import type { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { RunDayCompletedDomainEvent } from '@/modules/run-day/domain/event/RunDayCompletedDomainEvent.ts'

function recordingTrackEvent() {
  const execute = vi.fn(() => true)
  return { execute, port: { execute } as unknown as TrackEvent }
}

function completed(params: { dateKey: string; activityId?: string | null }) {
  return new RunDayCompletedDomainEvent({ aggregateId: params.dateKey, ...params })
}

describe('TrackWorkoutLogged', () => {
  it('reports a synced run and an explicit feedback completion', async () => {
    const { execute, port } = recordingTrackEvent()
    const subscriber = new TrackWorkoutLogged(port)

    await subscriber.on(completed({ dateKey: '2026-10-18', activityId: '998877' }))
    await subscriber.on(completed({ dateKey: '2026-10-19' }))

    expect(execute).toHaveBeenNthCalledWith(1, AnalyticsEventName.WorkoutLogged, {
      source: 'strava',
    })
    expect(execute).toHaveBeenNthCalledWith(2, AnalyticsEventName.WorkoutLogged, {
      source: 'feedback',
    })
  })

  it('counts a re-read of the same day once', async () => {
    const { execute, port } = recordingTrackEvent()
    const subscriber = new TrackWorkoutLogged(port)
    const event = completed({ dateKey: '2026-10-18', activityId: '998877' })

    await subscriber.on(event)
    await subscriber.on(event)

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('does not confuse a day logged twice with different sources', async () => {
    const { execute, port } = recordingTrackEvent()
    const subscriber = new TrackWorkoutLogged(port)

    await subscriber.on(completed({ dateKey: '2026-10-18' }))
    await subscriber.on(completed({ dateKey: '2026-10-18', activityId: '998877' }))

    expect(execute).toHaveBeenCalledTimes(2)
  })
})
