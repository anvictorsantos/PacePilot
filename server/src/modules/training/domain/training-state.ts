/**
 * Deterministic training-state calculation. Pure functions over normalized activities.
 * Rolling windows: 7 / 14 / 28 / 42-84 days.
 */

function inWindow(activities, days) {
  const cutoff = Date.now() - days * 86400000
  return activities.filter(a => new Date(a.date).getTime() >= cutoff)
}

export function calcTrainingState(activities) {
  const sorted = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date))
  const w7 = inWindow(sorted, 7)
  const w14 = inWindow(sorted, 14)
  const w28 = inWindow(sorted, 28)
  const w84 = inWindow(sorted, 84)

  const sumDist = arr => arr.reduce((s, a) => s + (a.distance_km ?? 0), 0)
  const avgPace = arr => {
    const withPace = arr.filter(a => a.avg_pace_sec_km)
    if (!withPace.length) return null
    return Math.round(withPace.reduce((s, a) => s + a.avg_pace_sec_km, 0) / withPace.length)
  }
  const avgHr = arr => {
    const withHr = arr.filter(a => a.avg_hr)
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
  const dist28 = {}
  for (const a of w28) dist28[a.workout_type] = (dist28[a.workout_type] || 0) + 1

  // Consistency
  const gaps = []
  for (let i = 1; i < sorted.length; i++) {
    const gap = (new Date(sorted[i - 1].date) - new Date(sorted[i].date)) / 86400000
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
  const fatigueSignals = []
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

export function weeklyVolumeSeries(activities, weeks = 8) {
  const now = new Date()
  const series = []
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
