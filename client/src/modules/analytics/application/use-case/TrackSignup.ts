import type { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import type { SignupMarker } from '@/modules/analytics/domain/repository/signup-marker.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

// Exactly once per browser: the OAuth redirect carries no new-athlete flag, so the
// first connection this browser sees counts as the signup. A funnel shape, not accounting.
export class TrackSignup {
  constructor(
    private readonly marker: SignupMarker,
    private readonly trackEvent: TrackEvent,
  ) {}

  execute(): void {
    if (this.marker.sent()) return
    // The flag follows the send, not the attempt: without consent the signup is
    // not lost, it is reported on the first session that has it.
    if (this.trackEvent.execute(AnalyticsEventName.Signup)) this.marker.remember()
  }
}
