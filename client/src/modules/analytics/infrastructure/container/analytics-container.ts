import { DecideAnalyticsConsent } from '@/modules/analytics/application/use-case/DecideAnalyticsConsent.ts'
import { TrackFeedbackSubmitted } from '@/modules/analytics/application/use-case/subscriber/TrackFeedbackSubmitted.ts'
import { TrackWorkoutLogged } from '@/modules/analytics/application/use-case/subscriber/TrackWorkoutLogged.ts'
import { TrackEvent } from '@/modules/analytics/application/use-case/TrackEvent.ts'
import { TrackPageView } from '@/modules/analytics/application/use-case/TrackPageView.ts'
import { TrackSignup } from '@/modules/analytics/application/use-case/TrackSignup.ts'
import type { AnalyticsConsentRepository } from '@/modules/analytics/domain/repository/analytics-consent.repository.ts'
import type { SignupMarker } from '@/modules/analytics/domain/repository/signup-marker.ts'
import type { AnalyticsTracker } from '@/modules/analytics/domain/service/analytics-tracker.ts'
import { readAnalyticsEnv } from '@/modules/analytics/infrastructure/config/analytics-env.ts'
import { GtagAnalyticsTracker } from '@/modules/analytics/infrastructure/gtag/GtagAnalyticsTracker.ts'
import { NoopAnalyticsTracker } from '@/modules/analytics/infrastructure/gtag/NoopAnalyticsTracker.ts'
import { LocalStorageAnalyticsConsentRepository } from '@/modules/analytics/infrastructure/repository/LocalStorageAnalyticsConsentRepository.ts'
import { LocalStorageSignupMarker } from '@/modules/analytics/infrastructure/repository/LocalStorageSignupMarker.ts'
import { container } from '@/modules/shared/infrastructure/container.ts'
import type { ContainerToken } from '@/modules/shared/infrastructure/container.ts'

// Tracker chosen once: no measurement id binds a Null Object, not a null every call site must
// remember. Must be imported before `run-day-container.ts` collects subscriber bindings.
const TRACKER: ContainerToken = 'AnalyticsTracker'
const CONSENT_REPOSITORY: ContainerToken = 'AnalyticsConsentRepository'
const SIGNUP_MARKER: ContainerToken = 'SignupMarker'

container.bindSingleton(TRACKER, () => {
  const env = readAnalyticsEnv()
  return env ? new GtagAnalyticsTracker(env.measurementId, env.debug) : new NoopAnalyticsTracker()
})
container.bindSingleton(CONSENT_REPOSITORY, () => new LocalStorageAnalyticsConsentRepository())
container.bindSingleton(SIGNUP_MARKER, () => new LocalStorageSignupMarker())

container.bindSingleton(
  TrackEvent,
  (c) => new TrackEvent(c.get<AnalyticsTracker>(TRACKER), c.get(CONSENT_REPOSITORY)),
)
container.bindSingleton(
  TrackPageView,
  (c) => new TrackPageView(c.get<AnalyticsTracker>(TRACKER), c.get(CONSENT_REPOSITORY)),
)
container.bindSingleton(
  DecideAnalyticsConsent,
  (c) => new DecideAnalyticsConsent(c.get(CONSENT_REPOSITORY), c.get<AnalyticsTracker>(TRACKER)),
)
container.bindSingleton(
  TrackSignup,
  (c) => new TrackSignup(c.get<SignupMarker>(SIGNUP_MARKER), c.get(TrackEvent)),
)

container.bind('DomainEventSubscriber', (c) => new TrackWorkoutLogged(c.get(TrackEvent)))
container.bind('DomainEventSubscriber', (c) => new TrackFeedbackSubmitted(c.get(TrackEvent)))

// Resolving `TrackEvent` builds the tracker, which installs the `gtag` stub and Consent
// Mode's denied default — so this must run before any other code queues a hit.
export const analyticsModule = {
  trackEvent: container.get<TrackEvent>(TrackEvent),
  trackPageView: container.get<TrackPageView>(TrackPageView),
  decideConsent: container.get<DecideAnalyticsConsent>(DecideAnalyticsConsent),
  trackSignup: container.get<TrackSignup>(TrackSignup),
  consent: container.get<AnalyticsConsentRepository>(CONSENT_REPOSITORY),
  tracker: container.get<AnalyticsTracker>(TRACKER),
}

// Consent Mode opens denied on every visit, so a stored answer is re-asserted here: without
// it a consented athlete runs the session with analytics storage denied and the tag never told.
const storedConsent = analyticsModule.consent.read()
if (storedConsent) analyticsModule.tracker.setConsent(storedConsent)
