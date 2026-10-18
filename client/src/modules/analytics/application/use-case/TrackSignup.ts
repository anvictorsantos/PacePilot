import type { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import type { SignupMarker } from '@/modules/analytics/domain/repository/signup-marker.ts'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'

/**
 * Report the athlete's first session on this browser, exactly once.
 *
 * The server's OAuth redirect carries no "new athlete" flag, so this is a local
 * approximation: the first connection this browser sees counts as the signup,
 * later ones do not. It is a funnel shape, not an accounting figure — if the
 * server ever sends `?new=1`, this marker is what should be deleted.
 */
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
