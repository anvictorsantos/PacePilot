/**
 * Week metadata — current/total week from goal anchor.
 * Moved verbatim from plan.service.js (Pass 4: extract helpers).
 */
export function getWeekMeta(activities = [], goal = null, athlete = null, today = new Date()) {
  // backward compat: getWeekMeta(acts, goal, todayDate) → third arg is Date not athlete
  if (athlete instanceof Date) { today = athlete; athlete = null }
  const goalDate = goal?.goal_date ? new Date(goal.goal_date) : null
  // programStart anchors Week 1 — priority: goalSetAt > athlete.createdAt/updatedAt > earliest activity
  let programStart = null
  const goalSetAt = athlete?.goalSetAt ? new Date(athlete.goalSetAt) : null
  if (goalSetAt && !isNaN(goalSetAt.getTime())) programStart = goalSetAt
  else if (athlete?.createdAt && goal) {
    const ca = new Date(athlete.createdAt)
    if (!isNaN(ca.getTime())) programStart = ca
  }
  if (!programStart && activities?.length) {
    const sorted = [...activities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    if (sorted[0]?.date) {
      const ea = new Date(sorted[0].date)
      if (!isNaN(ea.getTime())) programStart = ea
    }
  }
  let totalWeeks = 12
  if (goalDate && programStart) {
    const diff = Math.ceil((goalDate - new Date(programStart).setHours(0,0,0,0)) / 86400000)
    if (diff > 0) totalWeeks = Math.max(1, Math.ceil(diff / 7))
  } else if (goalDate && !programStart) {
    totalWeeks = 12 // ponytail: fixed 12-week block when no history; derive from goal creation date if tracked
  } else if (!goalDate && programStart) {
    totalWeeks = 12
  }
  let currentWeek = 1
  if (programStart) {
    const daysSinceStart = Math.floor((new Date(today).setHours(0,0,0,0) - new Date(programStart).setHours(0,0,0,0)) / 86400000)
    currentWeek = Math.max(1, Math.min(totalWeeks, Math.floor(daysSinceStart / 7) + 1))
  } else if (goalDate) {
    const daysUntilGoal = Math.ceil((goalDate - new Date(today).setHours(0,0,0,0)) / 86400000)
    const weeksLeft = Math.max(1, Math.ceil(daysUntilGoal / 7))
    currentWeek = Math.max(1, Math.min(totalWeeks, totalWeeks - weeksLeft + 1))
  }
  if (currentWeek > totalWeeks) currentWeek = totalWeeks
  return { currentWeek, totalWeeks }
}
