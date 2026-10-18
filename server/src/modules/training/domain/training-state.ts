/**
 * Deterministic training-state calculation. Pure functions over normalized activities.
 * Rolling windows: 7 / 14 / 28 / 42-84 days.
 */

/** A normalized activity as the engine reads it (Activity document or test fixture). */
export interface ActivityRecord {
  date: string | number | Date
  distance_km?: number | null
  avg_pace_sec_km?: number | null
  avg_hr?: number | null
  workout_type: string
}

export interface WeeklySummary {
  distance7?: number
  distance14?: number
  distance28?: number
  distance84?: number
  runs7?: number
  runs14?: number
  runs28?: number
  longRun7?: number
  longRun28?: number
  avgPace7?: number | null
  avgPace28?: number | null
  avgHr7?: number | null
  avgHr28?: number | null
  hardSessions7?: number
  hardSessions14?: number
}

export interface TrainingState {
  weekly: WeeklySummary
  intensityDistribution?: Record<string, number>
  consistency?: { runsPerWeek28: number; longestGapDays: number }
  trend?: string
  fatigueSignals?: string[]
  hasFatigueSignal?: boolean
}

function inWindow(activities: ActivityRecord[], days: number): ActivityRecord[] {
  const cutoff = Date.now() - days * 86400000
  return activities.filter(a => new Date(a.date).getTime() >= cutoff)
}

export function calcTrainingState(activities: ActivityRecord[]): TrainingState {
  const sorted = [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const w7 = inWindow(sorted, 7)
  const w14 = inWindow(sorted, 14)
  const w28 = inWindow(sorted, 28)
  const w84 = inWindow(sorted, 84)

  const sumDist = (arr: ActivityRecord[]) => arr.reduce((s, a) => s + (a.distance_km ?? 0), 0)
  const avgPace = (arr: ActivityRecord[]) => {
    const withPace = arr.filter((a): a is ActivityRecord & { avg_pace_sec_km: number } => Boolean(a.avg_pace_sec_km))
    if (!withPace.length) return null
    return Math.round(withPace.reduce((s, a) => s + a.avg_pace_sec_km, 0) / withPace.length)
  }
  const avgHr = (arr: ActivityRecord[]) => {
    const withHr = arr.filter((a): a is ActivityRecord & { avg_hr: number } => Boolean(a.avg_hr))
    if (!withHr.length) return null
    return Math.round(withHr.reduce((s, a) => s + a.avg_hr, 0) / withHr.length)
  }

  const weekly = {
    distance7: +sumDist(w7).toFixed(1),
    distance14: +sumDist(w14).toFixed(1),
    distance28: +sumDist(w28).toFixed(1),
    distance84: +sumDist(w84).toFixed(1),
    runs7: w7.length,
    runs14: w14.length,
    runs28: w28.length,
    longRun7: Math.max(0, ...w7.map(a => a.distance_km ?? 0)),
    longRun28: Math.max(0, ...w28.map(a => a.distance_km ?? 0)),
    avgPace7: avgPace(w7),
    avgPace28: avgPace(w28),
    avgHr7: avgHr(w7),
    avgHr28: avgHr(w28),
    hardSessions7: w7.filter(a => ['interval', 'threshold', 'tempo', 'race'].includes(a.workout_type)).length,
    hardSessions14: w14.filter(a => ['interval', 'threshold', 'tempo', 'race'].includes(a.workout_type)).length,
  }

  // Intensity distribution (last 28d)
  const dist28: Record<string, number> = {}
  for (const a of w28) dist28[a.workout_type] = (dist28[a.workout_type] || 0) + 1

  // Consistency
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i - 1].date).getTime() - new Date(sorted[i].date).getTime()) / 86400000
    gaps.push(gap)
  }
  const longestGap = gaps.length ? Math.max(...gaps) : 0

  // Trend (compare last 14d vs previous 14d)
  const prev14 = sorted.filter(a => {
    const t = new Date(a.date).getTime()
    const c14 = Date.now() - 14 * 86400000
    const c28 = Date.now() - 28 * 86400000
    return t < c14 && t >= c28
  })
  const trend = (() => {
    const cur = sumDist(w14) - sumDist(inWindow(sorted, 7)) // actually just use 14d comparison
    // simpler: compare 7d vs prior 7d
    const last7 = sumDist(w7)
    const prior7 = sumDist(prev14.filter(a => new Date(a.date).getTime() >= Date.now() - 21 * 86400000 && new Date(a.date).getTime() < Date.now() - 14 * 86400000))
    // fallback: compare w7 vs w14 avg
    const avgRecent = w7.length ? sumDist(w7) / 7 : 0
    const avgPrior = prev14.length ? sumDist(prev14) / 14 : 0
    if (avgRecent > avgPrior * 1.15) return 'building'
    if (avgRecent < avgPrior * 0.85) return 'reducing'
    return 'stable'
  })()

  // Fatigue signals (history-based, not medical)
  const fatigueSignals: string[] = []
  if (weekly.runs7 >= 6 && weekly.hardSessions7 >= 3) fatigueSignals.push('High frequency with multiple hard sessions this week')
  if (weekly.distance7 > weekly.distance28 / 4 * 1.5 && weekly.distance28 > 0) fatigueSignals.push('Recent weekly volume well above 4-week average')
  // Consecutive hard days
  let consecHard = 0, maxConsecHard = 0
  for (const a of sorted.slice(0, 7)) {
    if (['interval', 'threshold', 'tempo', 'race'].includes(a.workout_type)) { consecHard++; maxConsecHard = Math.max(maxConsecHard, consecHard) }
    else consecHard = 0
  }
  if (maxConsecHard >= 2) fatigueSignals.push('Consecutive hard days recently')
  // HR drift (higher HR at similar pace)
  if (weekly.avgHr7 && weekly.avgHr28 && weekly.avgHr7 > weekly.avgHr28 + 7) fatigueSignals.push('Elevated heart rate compared to recent average at similar effort')

  return {
    weekly,
    intensityDistribution: dist28,
    consistency: {
      runsPerWeek28: +(w28.length / 4).toFixed(1),
      longestGapDays: +longestGap.toFixed(1),
    },
    trend,
    fatigueSignals,
    hasFatigueSignal: fatigueSignals.length > 0,
  }
}

export function weeklyVolumeSeries(activities: ActivityRecord[], weeks = 8): Array<{ label: string; distance: number; runs: number }> {
  const now = new Date()
  const series: Array<{ label: string; distance: number; runs: number }> = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(now.getDate() - (i + 1) * 7)
    const end = new Date(now)
    end.setDate(now.getDate() - i * 7)
    const slice = activities.filter(a => {
      const t = new Date(a.date).getTime()
      return t >= start.getTime() && t < end.getTime()
    })
    series.push({
      label: `W${weeks - i}`,
      distance: +slice.reduce((s, a) => s + (a.distance_km ?? 0), 0).toFixed(1),
      runs: slice.length,
    })
  }
  return series
}
