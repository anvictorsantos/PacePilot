export type CoachingLocale = 'en' | 'pt'

/** `GET/PUT /api/me/preferences`. */
export interface CoachingPreferences {
  explanations: boolean
  sessionReminder: boolean
  weeklySummary: boolean
  locale: CoachingLocale
}

export interface PushSubscriptionBody {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
