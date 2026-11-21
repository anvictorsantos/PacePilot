import type { AthleteSession } from '@/modules/athlete/application/session.service.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { planWeek } from '@/modules/training/application/plan.service.ts'
import { dateKeyInZone, hourInZone, weekdayOfKey } from '@/modules/shared/infrastructure/time/timeZone.ts'
import {
  paceString,
  reminderMessage,
} from '@/modules/notifications/domain/messages.ts'
import { dueOn, reminderWindow, summaryWindow } from '@/modules/notifications/domain/schedule.ts'
import { sendWeeklySummary } from '@/modules/notifications/infrastructure/summary-email.ts'
import {
  pushEnabled,
  sendPushToSubscriptions,
  type PushSubscriptionRecord,
} from '@/modules/notifications/infrastructure/push-sender.ts'

export interface TickResult {
  reminders: number
  summaries: number
  failed: number
}

type Coaching = {
  explanations?: boolean
  sessionReminder?: boolean
  weeklySummary?: boolean
  locale?: 'en' | 'pt'
  lastSessionReminderOn?: string | null
  lastWeeklySummaryOn?: string | null
}

interface AthleteRow {
  _id: unknown
  email?: string | null
  timezone?: string | null
  preferences?: { coaching?: Coaching | null } | null
  pushSubscriptions?: PushSubscriptionRecord[] | null
}

/**
 * One hourly pass. Reminder pushes and weekly emails are idempotent per local
 * day, so an overlapping or retried tick cannot send twice.
 */
export async function runNotificationTick(now = new Date()): Promise<TickResult> {
  const result: TickResult = { reminders: 0, summaries: 0, failed: 0 }
  const athletes = await Athlete.find({
    $or: [
      { 'preferences.coaching.sessionReminder': true },
      { 'preferences.coaching.weeklySummary': true },
    ],
  })
    .select('_id email timezone preferences.coaching pushSubscriptions')
    .limit(500)
    .lean<AthleteRow[]>()

  for (const athlete of athletes) {
    const coaching: Coaching = athlete.preferences?.coaching ?? {}
    const locale: 'en' | 'pt' = coaching.locale === 'pt' ? 'pt' : 'en'
    const timeZone = athlete.timezone || undefined

    try {
      const dateKey = dateKeyInZone(now, timeZone)
      const hour = hourInZone(now, timeZone)

      if (
        coaching.sessionReminder &&
        pushEnabled() &&
        reminderWindow(hour) &&
        dueOn(coaching.lastSessionReminderOn, dateKey)
      ) {
        const delivered = await sendReminder(String(athlete._id), timeZone, now, locale, athlete)
        if (delivered) {
          await markSent(athlete._id, 'lastSessionReminderOn', dateKey)
          result.reminders += 1
        }
      }

      if (
        coaching.weeklySummary &&
        athlete.email &&
        weekdayOfKey(dateKey) === 0 &&
        summaryWindow(hour) &&
        dueOn(coaching.lastWeeklySummaryOn, dateKey)
      ) {
        const sent = await sendSummary(String(athlete._id), timeZone, now, locale, athlete.email)
        if (sent) {
          await markSent(athlete._id, 'lastWeeklySummaryOn', dateKey)
          result.summaries += 1
        }
      }
    } catch (error) {
      result.failed += 1
      console.warn(
        `[notifications] tick failed for athlete ${String(athlete._id)}:`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  return result
}

async function sendReminder(
  athleteId: string,
  timeZone: string | undefined,
  now: Date,
  locale: 'en' | 'pt',
  athlete: AthleteRow,
): Promise<boolean> {
  const subscriptions = athlete.pushSubscriptions ?? []
  if (!subscriptions.length) return false

  const plan = await planWeek({ athleteId } as AthleteSession, { today: now, timeZone })
  const today = plan?.week.find((day) => day.date === dateKeyInZone(now, timeZone))
  if (!today || today.workout.type === 'rest') return true // nothing to send; stop retrying today

  const message = reminderMessage(locale, today.workout.type)
  const { sent, gone } = await sendPushToSubscriptions(subscriptions, {
    ...message,
    url: '/workout',
  })
  if (gone.length) {
    await Athlete.updateOne(
      { _id: athleteId },
      { $pull: { pushSubscriptions: { endpoint: { $in: gone } } } },
    )
  }
  // A failed send leaves the marker unset so a later tick retries the same day.
  return sent > 0 || gone.length === subscriptions.length
}

async function sendSummary(
  athleteId: string,
  timeZone: string | undefined,
  now: Date,
  locale: 'en' | 'pt',
  email: string,
): Promise<boolean> {
  const plan = await planWeek({ athleteId } as AthleteSession, { today: now, timeZone })
  if (!plan) return false
  const weekly = plan.state.weekly
  return sendWeeklySummary(email, locale, {
    runs: weekly.runs7 ?? 0,
    distanceKm: weekly.distance7 ?? 0,
    avgPace: paceString(weekly.avgPace7),
  })
}

function markSent(athleteId: unknown, field: string, dateKey: string) {
  return Athlete.updateOne(
    { _id: athleteId },
    { $set: { [`preferences.coaching.${field}`]: dateKey } },
  )
}
