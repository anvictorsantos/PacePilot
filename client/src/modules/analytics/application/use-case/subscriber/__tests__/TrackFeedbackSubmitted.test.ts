import { describe, expect, it, vi } from 'vitest'

import { TrackFeedbackSubmitted } from '@/modules/analytics/application/use-case/subscriber/TrackFeedbackSubmitted.ts'
import type { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent.ts'

function recordingTrackEvent() {
  const execute = vi.fn(() => true)
  return { execute, port: { execute } as unknown as TrackEvent }
}

function logged(params: { status: string; rpe?: number | null }) {
  return new FeedbackLoggedDomainEvent({
    aggregateId: '2026-10-18',
    dateKey: '2026-10-18',
    ...params,
  })
}

describe('TrackFeedbackSubmitted', () => {
  it('sends the status and the effort', async () => {
    const { execute, port } = recordingTrackEvent()

    await new TrackFeedbackSubmitted(port).on(logged({ status: FeedbackStatus.Completed, rpe: 7 }))

    expect(execute).toHaveBeenCalledWith(AnalyticsEventName.FeedbackSubmitted, {
      status: 'completed',
      rpe: 7,
    })
  })

  it('omits an absent effort rather than sending null', async () => {
    const { execute, port } = recordingTrackEvent()

    await new TrackFeedbackSubmitted(port).on(logged({ status: FeedbackStatus.Skipped, rpe: null }))

    expect(execute).toHaveBeenCalledWith(AnalyticsEventName.FeedbackSubmitted, {
      status: 'skipped',
    })
  })
})
