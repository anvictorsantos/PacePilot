/**
 * The interactions the client is allowed to report (CONTEXT.md §Analytics).
 *
 * An enum rather than a string union: the name is a wire contract with GA4, so a
 * typo is a silent hole in a funnel. One member here, one `trackEvent` call site
 * elsewhere, and no string literal at the call site.
 */
export enum AnalyticsEventName {
  /** A session was established for the first time on this browser. */
  Signup = 'signup',
  /** A visitor left for the WhatsApp waitlist handoff. */
  WaitlistJoin = 'waitlist_join',
  /** Strava OAuth completed and the athlete is connected. */
  StravaConnect = 'strava_connect',
  /** The coach generated a week the client had not cached. */
  PlanGenerated = 'plan_generated',
  /** A day acquired a completed session — explicit Feedback or a synced run. */
  WorkoutLogged = 'workout_logged',
  /** The athlete submitted the feedback form for a date. */
  FeedbackSubmitted = 'feedback_submitted',
}

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] =
  Object.values(AnalyticsEventName)

/** Narrow an untrusted value — a `dataLayer` replay or a test fixture — to a known name. */
export function toAnalyticsEventName(value: unknown): AnalyticsEventName | null {
  const key = String(value ?? '')
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(key)
    ? (key as AnalyticsEventName)
    : null
}
