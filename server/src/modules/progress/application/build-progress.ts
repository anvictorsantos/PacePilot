import type { Goal } from '@/modules/training/application/plan.service.ts'
import { calcTrainingState, weeklyVolumeSeries } from '@/modules/training/domain/training-state.ts'
import type { ActivityRecord } from '@/modules/training/domain/training-state.ts'
import { ActivityKind } from '@/modules/activities/domain/value-object/ActivityKind.ts'
import { kindOfActivity } from '@/modules/activities/domain/value-object/SportType.ts'

/**
 * What the progress read needs from the training context: the activity shape it
 * publishes, plus the identifiers the best-efforts list reports. Extending the
 * published type (rather than declaring a parallel one) is what keeps the two
 * modules from drifting apart.
 */
export type ProgressActivity = ActivityRecord & {
  provider_activity_id?: string | null
  id?: number | string | null
  _id?: number | string | null
}

export interface ProgressView {
  trainingState: ReturnType<typeof calcTrainingState>
  volumeSeries: ReturnType<typeof weeklyVolumeSeries>
  paceSeries: Array<{ date: ActivityRecord['date']; pace?: number | null; hr?: number | null }>
  records: Array<{
    id?: number | string | null
    date: ActivityRecord['date']
    distance_km?: number | null
    pace?: number | null
  }>
  totalActivities: number
  totalDistance: number
  goalProgress: { pct: number; planned: number; completed: number } | null
}

const DAY_MS = 86_400_000

/**
 * The progress read model (CONTEXT.md §Goal Progress, §WeeklyProgression).
 *
 * This used to be computed inline in the route handler, which put the 14-day
 * honesty rule and the best-efforts ordering in the HTTP layer where no test
 * could reach them. It is a pure function of the activities and the goal now:
 * the route only loads, calls this, and answers.
 */
export function buildProgress(
  activities: ProgressActivity[],
  goal: Goal | null | undefined,
): ProgressView {
  const now = Date.now()
  // The read model is run-centric (distance, pace, best efforts, completed runs).
  // Cross-training is imported and visible in the activities list, but it is not
  // volume, so it never reaches this view.
  const runs = activities.filter((a) => kindOfActivity(a) === ActivityKind.Run)

  const paceSeries = runs
    .slice()
    .reverse()
    .slice(-12)
    .map((a) => ({ date: a.date, pace: a.avg_pace_sec_km, hr: a.avg_hr }))

  const byPace = [...runs].sort(
    (a, b) => (a.avg_pace_sec_km ?? 0) - (b.avg_pace_sec_km ?? 0),
  )

  return {
    trainingState: calcTrainingState(runs),
    volumeSeries: weeklyVolumeSeries(runs, 8),
    paceSeries,
    records: byPace.slice(0, 3).map((a) => ({
      id: a._id ?? a.id ?? a.provider_activity_id,
      date: a.date,
      distance_km: a.distance_km,
      pace: a.avg_pace_sec_km,
    })),
    totalActivities: runs.length,
    totalDistance: +runs.reduce((sum, a) => sum + (a.distance_km ?? 0), 0).toFixed(1),
    goalProgress: goalProgress(runs, goal, now),
  }
}

/**
 * Consistency over 28 days: completed runs over the planned slots.
 *
 * CONTEXT.md §Goal Progress: `null` when there is less than 14 days of history,
 * rather than a number that reads as progress the athlete has not made.
 */
function goalProgress(
  activities: ProgressActivity[],
  goal: Goal | null | undefined,
  now: number,
): ProgressView['goalProgress'] {
  const plannedPerWeek = goal?.preferred_days?.length || goal?.days_per_week || 0
  const planned = plannedPerWeek * 4
  if (!planned) return null

  const cutoff = now - 28 * DAY_MS
  const completed = activities.filter((a) => {
    const time = a.date ? new Date(a.date).getTime() : 0
    return time >= cutoff
  }).length

  // reduce, not Math.min(...arr): spreading a large array into an argument list
  // overflows the call stack.
  const earliest = activities.reduce((min, a) => {
    const time = a.date ? new Date(a.date).getTime() : Infinity
    return time < min ? time : min
  }, Infinity)
  const daysOfHistory = Number.isFinite(earliest) ? (now - earliest) / DAY_MS : 0

  if (daysOfHistory < 14 && completed === 0) return null

  return {
    pct: Math.max(0, Math.min(100, Math.round((completed / planned) * 100))),
    planned,
    completed,
  }
}
