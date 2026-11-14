/** Current and total week, anchored on the goal date and programme start. */
import type { ActivityRecord } from '@/modules/training/domain/training-state.ts'
import {
  dateKeyInZone,
  daysBetweenKeys,
} from '@/modules/shared/infrastructure/time/timeZone.ts'

export interface WeekGoal { goal_date?: string | number | Date | null }
export interface WeekAthlete {
  [key: string]: unknown
  goalSetAt?: string | number | Date | null
  createdAt?: string | number | Date | null
}

/** The instant's calendar day in the athlete's zone, or null when unusable. */
function keyOf(value: unknown, timeZone?: string): string | null {
  if (value == null) return null
  const date = new Date(value as string | number | Date)
  return Number.isNaN(date.getTime()) ? null : dateKeyInZone(date, timeZone)
}

export function getWeekMeta(
  activities: ActivityRecord[] = [],
  goal: WeekGoal | null = null,
  athlete: WeekAthlete | Date | null = null,
  today: Date | number | string = new Date(),
  timeZone?: string
): { currentWeek: number; totalWeeks: number } {
  // backward compat: getWeekMeta(acts, goal, todayDate) → third arg is Date not athlete
  if (athlete instanceof Date) { today = athlete; athlete = null }
  const todayKey = keyOf(today, timeZone) ?? dateKeyInZone(new Date(), timeZone)
  const goalKey = keyOf(goal?.goal_date, timeZone)

  // programStart anchors Week 1 — priority: goalSetAt > athlete.createdAt > earliest activity
  let startKey = keyOf(athlete?.goalSetAt, timeZone)
  if (!startKey && athlete?.createdAt && goal) startKey = keyOf(athlete.createdAt, timeZone)
  if (!startKey && activities?.length) {
    const earliest = [...activities].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )[0]
    startKey = keyOf(earliest?.date, timeZone)
  }

  let totalWeeks = 12
  if (goalKey && startKey) {
    const diff = daysBetweenKeys(startKey, goalKey)
    if (Number.isFinite(diff) && diff > 0) totalWeeks = Math.max(1, Math.ceil(diff / 7))
  }

  let currentWeek = 1
  if (startKey) {
    const daysSinceStart = daysBetweenKeys(startKey, todayKey)
    if (Number.isFinite(daysSinceStart)) {
      currentWeek = Math.max(1, Math.min(totalWeeks, Math.floor(daysSinceStart / 7) + 1))
    }
  } else if (goalKey) {
    const daysUntilGoal = daysBetweenKeys(todayKey, goalKey)
    if (Number.isFinite(daysUntilGoal)) {
      const weeksLeft = Math.max(1, Math.ceil(daysUntilGoal / 7))
      currentWeek = Math.max(1, Math.min(totalWeeks, totalWeeks - weeksLeft + 1))
    }
  }
  if (currentWeek > totalWeeks) currentWeek = totalWeeks
  return { currentWeek, totalWeeks }
}
