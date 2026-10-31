// CONTEXT.md §Analytics: the interactions the client may report. Wire contract with
// GA4 — an enum, so a typo is a compile error rather than a silent hole in a funnel.
export enum AnalyticsEventName {
  /** First session established on this browser, not every sign-in. */
  Signup = 'signup',
  WaitlistJoin = 'waitlist_join',
  StravaConnect = 'strava_connect',
  /** The coach generated a week the client had not cached. */
  PlanGenerated = 'plan_generated',
  /** A day acquired a completed session — explicit Feedback or a synced run. */
  WorkoutLogged = 'workout_logged',
  FeedbackSubmitted = 'feedback_submitted',
}

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] =
  Object.values(AnalyticsEventName)

export function toAnalyticsEventName(value: unknown): AnalyticsEventName | null {
  const key = String(value ?? '')
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(key)
    ? (key as AnalyticsEventName)
    : null
}
