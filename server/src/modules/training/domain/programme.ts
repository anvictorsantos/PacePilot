// The programme is a ceiling, not a command: targets are clamped to demonstrated
// fitness, and safety is applied after it (adaptive.ts), never inside it.
import { WORKOUT_TEMPLATES } from '@/modules/training/domain/templates.ts'
import {
  archetypeFor,
  currentPhase,
  isCutbackWeek,
  longRunFor,
  type PlanArchetype,
} from '@/modules/ai/domain/plan-archetypes.ts'

export type SessionRole = 'long' | 'quality' | 'easy' | 'recovery' | 'rest'

export interface ProgrammeWeek {
  /** Session role for Mon–Sun, in order. */
  roles: SessionRole[]
  /** Quality-session type per Mon–Sun index; null where there is no quality day. */
  qualityByIndex: (string | null)[]
  /** What this week's long run should be, in km, before the fitness clamp. */
  longRunTargetKm: number | null
  /** The long run after the fitness clamp — what the athlete is actually told. */
  longRunKm: number | null
  easyKm: number
  phase: string | null
  /** Workout types used for this week's quality sessions, in rotation order. */
  qualityTypes: string[]
  cutback: boolean
  taper: boolean
  weeksOut: number | null
  notes: string[]
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LONG_DAYS = ['Sat', 'Sun']
const DEFAULT_DAYS = ['Tue', 'Wed', 'Thu', 'Sat', 'Sun']
/** Hard sessions want a day clear on either side; prefer mid-week. */
const QUALITY_DAYS = ['Tue', 'Wed', 'Thu', 'Fri']

const DEFAULT_EASY_KM = 6
const MIN_LONG_KM = 5

// Longest run the athlete has actually completed, used to clamp programme targets.
// 28 days: a long run older than that says little about current fitness.
export function fitnessLongRunKm(trainingState: any): number | null {
  const weekly = trainingState?.weekly ?? {}
  const candidates = [weekly.longRun28, weekly.longRun7].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
  )
  if (!candidates.length) return null
  return Math.max(...candidates)
}

function easyRunKm(trainingState: any): number {
  const weekly = trainingState?.weekly ?? {}
  const runs = Number(weekly.runs7 ?? 0)
  const dist = Number(weekly.distance7 ?? 0)
  if (runs > 0 && dist > 0) {
    const avg = dist / runs
    if (Number.isFinite(avg) && avg > 0) return +Math.min(Math.max(avg, 4), 12).toFixed(1)
  }
  return DEFAULT_EASY_KM
}

// Prefers the athlete's stated days, then tops up from the default set so
// days_per_week is honoured even when preferred_days is shorter.
function selectDays(goal: any, archetype: PlanArchetype, trainingState: any): string[] {
  const preferred: string[] = Array.isArray(goal?.preferred_days)
    ? goal.preferred_days.map((d: string) => DAY_NAMES.find((n) => n.toLowerCase() === String(d).toLowerCase().slice(0, 3))).filter(Boolean)
    : []
  const wanted = Number(goal?.days_per_week ?? 0) || preferred.length || DEFAULT_DAYS.length

  const ordered = [...preferred]
  const fallback = [...DEFAULT_DAYS, 'Mon', 'Fri', 'Sun', 'Wed', 'Tue', 'Thu']
  for (const d of fallback) {
    if (ordered.length >= wanted) break
    if (!ordered.includes(d)) ordered.push(d)
  }
  // Never schedule more days than the athlete is currently running, or than the
  // programme's own week shape allows.
  const runs7 = Number(trainingState?.weekly?.runs7 ?? 0)
  const ceiling = Math.max(1, Math.min(archetype.sessionsPerWeek.recovery + archetype.sessionsPerWeek.speed + archetype.sessionsPerWeek.long, wanted, runs7 > 0 ? runs7 + 1 : wanted))
  return [...new Set(ordered)].slice(0, ceiling).sort((a, b) => DAY_NAMES.indexOf(a) - DAY_NAMES.indexOf(b))
}

export function weeksUntilGoal(goal: any, weekStart: Date): number | null {
  if (!goal?.goal_date) return null
  const d = new Date(goal.goal_date)
  if (Number.isNaN(d.getTime())) return null
  const from = new Date(weekStart)
  from.setHours(0, 0, 0, 0)
  const to = new Date(d)
  to.setHours(0, 0, 0, 0)
  // Whole calendar days first: raw ms ÷ 7 drifts ±1h across a DST boundary,
  // which turned an exact 13 weeks into ceil(13.006) = 14.
  const days = Math.round((to.getTime() - from.getTime()) / 86400000)
  return Math.ceil(days / 7)
}

// Pure: same inputs always give the same week.
export function buildProgrammeWeek(
  trainingState: any,
  goal: any,
  weekStart: Date = new Date()
): ProgrammeWeek {
  const archetype = archetypeFor(goal?.goal_type)
  const weeksOut = weeksUntilGoal(goal, weekStart)
  const phase = currentPhase(archetype, weeksOut)
  const cutback = isCutbackWeek(archetype, weeksOut)
  // Taper is derived from the phase the archetype is in, so flag and label cannot
  // disagree. The numeric clause only covers a goal date inside the final fortnight.
  const taperPhase = phase?.name === 'taper'
  const taper = taperPhase || (weeksOut != null && weeksOut <= 2)
  const notes: string[] = []

  const days = selectDays(goal, archetype, trainingState)
  const speedCount = Math.max(0, Math.min(archetype.sessionsPerWeek.speed, days.length - 1))
  const wantLong = archetype.sessionsPerWeek.long > 0 && days.length > 0
  const qualityTypes = qualityRotation(archetype, speedCount)

  const step = longRunFor(archetype, weeksOut)
  const parsedTarget = step ? parseKm(step.target) : null
  const recentLong = fitnessLongRunKm(trainingState)

  // The fitness clamp wins over the programme target. A step that exists but
  // carries no distance ("short / cross-training") means "much less", not the
  // template default: fall back to 60% of it.
  const templateLong = WORKOUT_TEMPLATES.long.distance_km
  let longRunKm = parsedTarget
  if (longRunKm == null) {
    longRunKm = step ? +(templateLong * 0.6).toFixed(1) : templateLong
  }
  if (recentLong != null) longRunKm = Math.min(longRunKm, +(recentLong + 2).toFixed(1))
  // No history is not licence to run anything: cap at the template long run, or an
  // athlete with no recorded runs is told to do a 21 km long run.
  else longRunKm = Math.min(longRunKm, templateLong)
  longRunKm = +Math.max(longRunKm, MIN_LONG_KM).toFixed(1)
  if (longRunKm != null && recentLong != null && longRunKm < parsedTarget!) {
    notes.push(
      `Long run capped at ${longRunKm} km — your longest recent run is ${recentLong} km, so the programme target of ${parsedTarget} km is ahead of you.`
    )
  }

  let easyKm = easyRunKm(trainingState)
  if (cutback) {
    easyKm = +Math.max(4, easyKm * 0.8).toFixed(1)
    notes.push('Cutback week — volume is deliberately reduced. This is the programme working.')
  }
  if (taper) {
    // In an archetype taper phase the progression target ALREADY tapers, so cutting
    // it again would double-count; the extra long-run reduction is only the safety net.
    easyKm = +Math.max(4, easyKm * 0.75).toFixed(1)
    if (!taperPhase) longRunKm = +Math.max(4, longRunKm * 0.65).toFixed(1)
    notes.push(
      weeksOut === 1
        ? 'Race week — the long run is a shakeout. The race itself is the test.'
        : 'Taper week — volume drops so you arrive fresh for race day.'
    )
  }
  if (phase) notes.push(`Phase: ${phase.name} — ${phase.intent}`)

  const roles: SessionRole[] = Array(7).fill('rest')
  const qualityByIndex: (string | null)[] = Array(7).fill(null)
  if (!days.length) {
    return { roles, qualityByIndex, longRunTargetKm: parsedTarget, longRunKm, easyKm, phase: phase?.name ?? null, qualityTypes, cutback, taper, weeksOut, notes }
  }

  // Long run on the latest available day, preferring a weekend slot so it has
  // recovery time on both sides.
  let longDayIdx = -1
  if (wantLong) {
    for (const name of [...LONG_DAYS].reverse()) {
      const i = DAY_NAMES.indexOf(name)
      if (days.includes(name)) { longDayIdx = i; break }
    }
    if (longDayIdx === -1) longDayIdx = DAY_NAMES.indexOf(days[days.length - 1])
  }

  const remaining = days
    .map(d => DAY_NAMES.indexOf(d))
    .filter(i => i !== longDayIdx)

  // Quality days: as close to mid-week as possible, never adjacent to the long
  // run — no two hard sessions back to back.
  const qualityIdxs: number[] = []
  for (let n = 0; n < speedCount; n++) {
    const candidates = remaining.filter(i => !qualityIdxs.includes(i))
    if (!candidates.length) break
    const scored = candidates
      .map(i => ({ i, penalty: adj(i, longDayIdx) * 10 + Math.abs(i - QUALITY_DAYS.indexOf(DAY_NAMES[i])) }))
      .sort((a, b) => a.penalty - b.penalty)
    const pick = scored.find(c => !qualityIdxs.some(q => Math.abs(q - c.i) === 1)) ?? scored[0]
    qualityIdxs.push(pick.i)
  }

  for (const i of remaining) {
    // Taper has no hard sessions — a tempo this close to a race is a mistake.
    if (taper) roles[i] = cutback ? 'recovery' : 'easy'
    else if (qualityIdxs.includes(i)) roles[i] = 'quality'
    else roles[i] = cutback ? 'recovery' : 'easy'
  }
  // Rotate by ORDINAL among quality days, not by day index: Tue and Thu are both
  // odd indices and would otherwise draw the same type.
  let q = 0
  for (const i of qualityIdxs) {
    if (!taper) qualityByIndex[i] = qualityTypes[q % qualityTypes.length]
    q++
  }
  if (longDayIdx >= 0) roles[longDayIdx] = 'long'

  return { roles, qualityByIndex, longRunTargetKm: parsedTarget, longRunKm, easyKm, phase: phase?.name ?? null, qualityTypes, cutback, taper, weeksOut, notes }
}

// Two quality days must not be the same stimulus twice, so speed-led programmes
// rotate between them.
function qualityRotation(archetype: PlanArchetype, speedCount: number): string[] {
  if (speedCount <= 0) return []
  const speedLed = archetype.sessionsPerWeek.speed >= 2
  const pool = speedLed
    ? (archetype.id === '5k' || archetype.id === '10k'
        ? ['tempo', 'interval']
        : ['tempo', 'threshold'])
    : ['tempo']
  const out: string[] = []
  for (let i = 0; i < speedCount; i++) out.push(pool[i % pool.length])
  return out
}

function adj(i: number, longIdx: number): number {
  if (longIdx < 0) return 0
  return Math.abs(i - longIdx) <= 1 ? 1 : 0
}

// Accepts "6.5 km" (single) or "29-35 km" (midpoint averaged).
export function parseKm(target: string): number | null {
  if (!target) return null
  const range = target.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*km/i)
  if (range) return +((Number(range[1]) + Number(range[2])) / 2).toFixed(1)
  const single = target.match(/(\d+(?:\.\d+)?)\s*km/i)
  if (single) return Number(single[1])
  // Convert time targets at a deliberately slow 6 min/km so a time-based long run
  // never over-prescribes distance.
  const mins = target.match(/(\d+)\s*(?:min|minute)/i)
  if (mins) return +((Number(mins[1]) * 6) / 60).toFixed(1)
  return null
}

// Returns null for rest so callers can skip.
export function workoutForRole(role: SessionRole, programme: ProgrammeWeek, index = 0) {
  if (role === 'rest') return null
  if (role === 'long') {
    const tpl = { ...WORKOUT_TEMPLATES.long }
    tpl.distance_km = programme.longRunKm ?? tpl.distance_km
    return { ...tpl, label: 'LONG' }
  }
  if (role === 'quality') {
    // Resolved per day by the planner so two quality days never draw the same
    // stimulus; programmes deliberately mix intervals, tempo and threshold.
    const type = programme.qualityByIndex[index ?? 0] ?? programme.qualityTypes[0] ?? 'tempo'
    return { ...WORKOUT_TEMPLATES[type], label: type.toUpperCase() }
  }
  if (role === 'recovery') {
    return { ...WORKOUT_TEMPLATES.recovery, label: 'RECOVERY', distance_km: +Math.max(4, programme.easyKm * 0.7).toFixed(1) }
  }
  const tpl = { ...WORKOUT_TEMPLATES.easy, distance_km: programme.easyKm }
  return { ...tpl, label: 'EASY' }
}
