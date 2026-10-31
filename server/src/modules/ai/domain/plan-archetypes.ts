// Periodisation shape used to ground the AI coach. Structure and numbers derive
// from the published Nike Run Club programmes; the wording is original, and the
// deterministic engine still owns the schedule.

export interface Phase {
  name: string
  /** Weeks-to-race window, inclusive. */
  weeksOut: [number, number]
  intent: string
}

export interface LongRunStep {
  /** Applies while the athlete is at or inside this many weeks-to-race. */
  weeksOut: number
  target: string
  note: string
}

export interface PlanArchetype {
  id: string
  goalTypes: string[]
  label: string
  programmeWeeks: number
  minWeeksRecommended: number
  sessionsPerWeek: { recovery: number; speed: number; long: number; rest: number }
  phases: Phase[]
  longRun: LongRunStep[]
  /** Weeks that step back from the previous load (3:1 cycle). */
  cutbackWeeksOut: number[]
  /** Intensity tiers the athlete thinks in, easiest → hardest. */
  paceVocabulary: string[]
  intent: string
  coachingNotes: string[]
}

// Effort out of 10, easiest → hardest. Tempo sits ~30-35s slower than 5K pace.
const SHARED_VOCAB = [
  'recovery 4-5/10 (full conversation)',
  '10K 6-7/10',
  'tempo 6/10',
  '5K 7-8/10',
  'mile 9/10',
  'best 10/10',
]

const SHARED_RULES = [
  'Speed and long runs are the sessions that matter; recovery runs and rest days are what make them work.',
  'Never place two speed sessions back to back.',
  'Long and recovery runs are progression runs: start slower than recovery pace, finish faster, averaging recovery pace.',
  'Paces are targets, not laws. Weather, sleep, stress and life outrank the watch.',
]

const FIVE_K: PlanArchetype = {
  id: '5k',
  goalTypes: ['5K'],
  label: '5K',
  programmeWeeks: 8,
  minWeeksRecommended: 4,
  sessionsPerWeek: { recovery: 2, speed: 2, long: 1, rest: 2 },
  intent:
    'Speed-led and short. The race is decided by economy and willingness to hold pace, so most of the programme buys rhythm, turnover and tolerance of discomfort rather than volume.',
  phases: [
    { name: 'rhythm base', weeksOut: [7, 8], intent: 'Two speed sessions of short intervals and one tempo, long runs held at time rather than distance, to find a rhythm before adding volume.' },
    { name: 'speed development', weeksOut: [5, 6], intent: 'Longest time-based long run of the block, then intervals that mix mile pace with short 5K-pace bursts so the athlete learns to hold speed while tired.' },
    { name: 'sharpening', weeksOut: [3, 4], intent: 'Volume steps down while intensity stays, so the athlete arrives fresh but still sharp. Long run shortens to race distance.' },
    { name: 'race prep', weeksOut: [1, 2], intent: 'One short sharpening session, then everything else is short and sharp. No long runs, no new stimulus.' },
  ],
  longRun: [
    { weeksOut: 8, target: '15 minutes easy', note: 'time-based, establishes the habit' },
    { weeksOut: 7, target: '25 minutes easy', note: 'still time-based' },
    { weeksOut: 6, target: '30 minutes easy', note: 'longest time-based effort of the block' },
    { weeksOut: 5, target: '33 minutes easy', note: 'then steps back down' },
    { weeksOut: 3, target: '6.5 km', note: 'first distance-based long run' },
    { weeksOut: 2, target: '5 km', note: 'race distance, run easy' },
    { weeksOut: 1, target: '5 km race', note: 'the race itself' },
  ],
  // No cutback week is claimed: the 5K long run rises monotonically and the
  // source shows no unambiguous step-back week. Asserting one would invent method.
  cutbackWeeksOut: [],
  paceVocabulary: SHARED_VOCAB,
  coachingNotes: [
    'A 5K is won in the first half. Say so when the athlete is building.',
    'Fartlek, hills, short intervals and tempo all appear — variety is the point.',
    'Emphasise turnover and relaxation over raw pace.',
  ],
}

const TEN_K: PlanArchetype = {
  id: '10k',
  goalTypes: ['10K'],
  label: '10K',
  programmeWeeks: 8,
  minWeeksRecommended: 4,
  sessionsPerWeek: { recovery: 2, speed: 2, long: 1, rest: 2 },
  intent:
    'The balance point between the two distances: enough speed to hold a hard effort, enough endurance to keep it honest from 5K to 10K.',
  phases: [
    { name: 'aerobic base', weeksOut: [7, 8], intent: 'Long runs step up through 5K, 6.5K and 8K while speed work stays on intervals — build the engine before loading it.' },
    { name: 'build', weeksOut: [5, 6], intent: 'Long run reaches the race distance itself, so the athlete rehearses exactly what race day asks for. Speed sessions push toward 5K pace.' },
    { name: 'sharpen', weeksOut: [3, 4], intent: 'Long run extends slightly past race distance to build resilience, volume drops, intensity holds.' },
    { name: 'peak and taper', weeksOut: [1, 2], intent: 'One race-pace long run at 10K, then a short race. Everything else shrinks.' },
  ],
  longRun: [
    { weeksOut: 8, target: '5 km', note: 'shortest long run of the block' },
    { weeksOut: 7, target: '6.5 km (4 miles)', note: 'progression begins' },
    { weeksOut: 6, target: '8 km', note: 'build' },
    { weeksOut: 5, target: '10 km', note: 'race distance' },
    { weeksOut: 3, target: '11.25 km', note: 'slightly past race distance' },
    { weeksOut: 2, target: '10 km', note: 'race distance, easy' },
    { weeksOut: 1, target: '10 km race', note: 'the race itself' },
  ],
  cutbackWeeksOut: [4],
  paceVocabulary: SHARED_VOCAB,
  coachingNotes: [
    'Race distance appears in training two separate times: once to rehearse, once to race.',
    'The 10K punishes going out too fast. Say so.',
    'Threshold (tempo) work is the highest-value session for this distance.',
  ],
}

const HALF: PlanArchetype = {
  id: 'half_marathon',
  goalTypes: ['half_marathon'],
  label: 'Half Marathon',
  programmeWeeks: 14,
  minWeeksRecommended: 6,
  // Source states five runs a week: one speed session instead of two drops the athlete to four.
  sessionsPerWeek: { recovery: 2, speed: 2, long: 1, rest: 2 },
  intent:
    'Endurance-led with one quality session a week. Most runners need to arrive able to hold one pace for two hours, not to run faster in training.',
  phases: [
    { name: 'base', weeksOut: [12, 14], intent: 'Five runs a week, mostly easy. Long runs climb from 4 miles to 10K with a single speed session to keep the legs sharp.' },
    { name: 'build', weeksOut: [8, 11], intent: 'Long runs extend through 13K and 15K to the mid-20s. Volume rises, one speed session anchors the week.' },
    { name: 'peak', weeksOut: [5, 7], intent: 'Two long runs near the half distance, and a half-marathon race effort used as a dress rehearsal. Peak volume of the block.' },
    { name: 'specific', weeksOut: [3, 4], intent: 'One long run beyond half distance to prove the athlete can go further than race pace requires, then an hour-long steady effort.' },
    { name: 'taper', weeksOut: [1, 2], intent: 'Volume drops hard, the last long run is a short shakeout, everything is fresh.' },
  ],
  longRun: [
    { weeksOut: 13, target: '6.4 km (4 miles)', note: 'longest run in years for many — start easy' },
    { weeksOut: 12, target: '8 km (5 miles)', note: 'build' },
    { weeksOut: 11, target: '10 km', note: 'build' },
    { weeksOut: 10, target: '10 km', note: 'hold, absorb' },
    { weeksOut: 9, target: '13 km (8 miles)', note: 'step up' },
    { weeksOut: 8, target: '15 km', note: 'build' },
    { weeksOut: 7, target: '16 km (10 miles)', note: 'build' },
    { weeksOut: 6, target: '16 km', note: 'hold' },
    { weeksOut: 5, target: '13.1 km', note: 'half-marathon effort as rehearsal' },
    { weeksOut: 4, target: '20 km', note: 'longest run of the block' },
    { weeksOut: 3, target: '60 minutes', note: 'time-based, steady' },
    { weeksOut: 2, target: '11 km (7 miles)', note: 'taper' },
    { weeksOut: 1, target: '21.1 km race', note: 'the race itself' },
  ],
  cutbackWeeksOut: [10, 6],
  paceVocabulary: SHARED_VOCAB,
  coachingNotes: [
    'Fuel and hydration are training topics, not race-day topics. Raise them.',
    'A half is a patience race; the second half is the test.',
    'One speed session per week is enough at this distance — resist adding more.',
  ],
}

const MARATHON: PlanArchetype = {
  id: 'marathon',
  goalTypes: ['marathon'],
  label: 'Marathon',
  programmeWeeks: 18,
  minWeeksRecommended: 12,
  sessionsPerWeek: { recovery: 3, speed: 1, long: 1, rest: 2 },
  intent:
    'An 18-week endurance build on a 3:1 cycle: three weeks of loading into one lighter week, repeated, with a single long run as the week’s centrepiece.',
  phases: [
    { name: 'base', weeksOut: [16, 18], intent: 'Six sessions a week, mostly recovery mileage, one speed session. Long run climbs 10K to 16K, then steps back — the first cutback week.' },
    { name: 'build', weeksOut: [11, 15], intent: 'Three loading weeks building to 20K and then a half-marathon long run, then the second cutback week.' },
    { name: 'peak', weeksOut: [5, 10], intent: 'The biggest weeks of the programme: long runs of 22-29K, a cutback at 90 minutes, then the longest runs of the athlete’s life at 29-35K.' },
    { name: 'taper', weeksOut: [1, 4], intent: 'Volume falls every week — 24-26K, then 19-23K, then 16K, then the race. Nothing fitness-related is gained here; it is spent, not built.' },
  ],
  longRun: [
    { weeksOut: 18, target: '10 km', note: 'start of the build' },
    { weeksOut: 17, target: '11.25 km (7 miles)', note: 'build' },
    { weeksOut: 16, target: '10 km', note: 'cutback week — back off' },
    { weeksOut: 15, target: '13 km (8 miles)', note: 'build' },
    { weeksOut: 14, target: '16 km (10 miles)', note: 'build' },
    { weeksOut: 13, target: '15 km', note: 'cutback week' },
    { weeksOut: 12, target: '20 km (12.5 miles)', note: 'step up' },
    { weeksOut: 11, target: '21.1 km (half)', note: 'dress rehearsal at half pace' },
    { weeksOut: 10, target: 'short / cross-training', note: 'cutback week' },
    { weeksOut: 9, target: '120 minutes', note: 'time-based steady' },
    { weeksOut: 8, target: '22-26 km (14-16 miles)', note: 'biggest phase begins' },
    { weeksOut: 7, target: '26-29 km (16-18 miles)', note: 'build' },
    { weeksOut: 6, target: '90 minutes', note: 'cutback week' },
    { weeksOut: 5, target: '29-35 km (18-22 miles)', note: 'longest run of the programme' },
    { weeksOut: 4, target: '24-26 km', note: 'taper begins' },
    { weeksOut: 3, target: '19-23 km', note: 'taper' },
    { weeksOut: 2, target: '16 km (10 miles)', note: 'last long run' },
    { weeksOut: 1, target: '42.2 km race', note: 'the race itself' },
  ],
  cutbackWeeksOut: [16, 13, 10, 6],
  paceVocabulary: SHARED_VOCAB,
  coachingNotes: [
    'Volume drops every fourth week by design. Say it is deliberate before the athlete feels it as a failure.',
    'The peak long run at 5 weeks out is the single most important session; after it, maintenance only.',
    'Taper means less, not "stay sharp". Never suggest extra work.',
    'The three easy runs a week are the engine of this plan, not padding.',
  ],
}

const GENERAL: PlanArchetype = {
  id: 'general',
  goalTypes: ['general_fitness', 'maintain', 'distance_completion'],
  label: 'General fitness',
  programmeWeeks: 0,
  minWeeksRecommended: 0,
  sessionsPerWeek: { recovery: 2, speed: 1, long: 1, rest: 2 },
  intent:
    'No race, no deadline. Consistency and staying healthy for the next few years matter more than any single week.',
  phases: [{ name: 'consolidation', weeksOut: [0, 99], intent: 'Hold volume, keep one quality session a week, vary the routes so training stays interesting.' }],
  longRun: [],
  cutbackWeeksOut: [],
  paceVocabulary: SHARED_VOCAB,
  coachingNotes: [
    'There is no race to peak for. Focus on durability and enjoyment.',
    'Vary the stimulus — the same run 17 weeks running is how runners get bored and injured.',
  ],
}

const BY_GOAL_TYPE: Record<string, PlanArchetype> = {}
for (const a of [FIVE_K, TEN_K, HALF, MARATHON, GENERAL]) {
  for (const g of a.goalTypes) BY_GOAL_TYPE[g] = a
}

export function archetypeFor(goalType: string | null | undefined): PlanArchetype {
  if (!goalType) return GENERAL
  return BY_GOAL_TYPE[goalType] ?? GENERAL
}

export function currentPhase(a: PlanArchetype, weeksOut: number | null): Phase | null {
  if (!a.phases.length) return a.phases[0] ?? null
  if (weeksOut == null) return a.phases[0]
  // Phases run earliest-first (most weeks out); the first window containing
  // weeksOut wins.
  for (const p of a.phases) {
    if (weeksOut >= p.weeksOut[0] && weeksOut <= p.weeksOut[1]) return p
  }
  if (weeksOut > a.phases[0].weeksOut[1]) return a.phases[0]
  return a.phases[a.phases.length - 1]
}

/** The long-run target for this phase, or null when the plan has none. */
export function longRunFor(a: PlanArchetype, weeksOut: number | null) {
  if (!a.longRun.length || weeksOut == null) return null
  // Steps are labelled by the week they apply to, so the current week maps to the
  // step with the SAME label — a threshold scan is wrong in both directions.
  const exact = a.longRun.find(step => step.weeksOut === weeksOut)
  if (exact) return exact

  // Gaps exist (the 5K programme has no week 4): take the nearest, preferring the
  // earlier week so volume never jumps forward.
  let best: LongRunStep | null = null
  let bestDelta = Infinity
  for (const step of a.longRun) {
    const delta = step.weeksOut - weeksOut
    const abs = Math.abs(delta)
    if (abs < bestDelta || (abs === bestDelta && best && delta > 0 && step.weeksOut < best.weeksOut)) {
      best = step
      bestDelta = abs
    }
  }
  return best
}

export function isCutbackWeek(a: PlanArchetype, weeksOut: number | null): boolean {
  if (weeksOut == null) return false
  return a.cutbackWeeksOut.includes(weeksOut)
}

// Per-day programme role, computed server-side so the model never derives (or
// invents) where in the plan a session sits.
export function dayRole(
  a: PlanArchetype,
  weeksOut: number | null,
  workoutType: string
): string {
  const phaseName = currentPhase(a, weeksOut)?.name ?? 'current block'
  const longRun = longRunFor(a, weeksOut)
  const cutback = isCutbackWeek(a, weeksOut)

  // Phase names attach ONLY to the long run: a 120B model shown one per day
  // repeats it in prose and mislabels phases (calling a taper "base phase").
  if (workoutType === 'rest') return 'rest day'
  if (HARD.has(workoutType)) return cutback ? 'cutback week quality session' : 'quality session'
  if (workoutType === 'long') {
    // No race programme (general fitness) → no phase to name.
    if (!a.longRun.length) return 'long run'
    const target = longRun ? `, target ${longRun.target}` : ''
    return `${phaseName} long run${target}`
  }
  return cutback ? 'cutback week easy run' : 'easy run'
}

const HARD = new Set(['tempo', 'threshold', 'interval'])

// Catalogue key suffix, decoupled from the free-prose phase name so the two can
// be renamed apart.
export function phaseSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Machine-readable role: dayRole() stays the English prompt sentence, this one
// resolves through the catalogue so a caption never mixes languages.
export interface ProgrammeRole {
  /** Catalogue key suffix, resolved as `ui.<key>`. */
  key: 'role_quality' | 'role_cutback_quality' | 'role_easy' | 'role_cutback_easy' | 'role_long'
  params?: { phase?: string; target?: string }
}

export function dayRoleKey(
  a: PlanArchetype,
  weeksOut: number | null,
  workoutType: string
): ProgrammeRole | null {
  if (workoutType === 'rest') return null
  const cutback = isCutbackWeek(a, weeksOut)
  if (HARD.has(workoutType)) {
    return { key: cutback ? 'role_cutback_quality' : 'role_quality' }
  }
  if (workoutType === 'long') {
    const step = longRunFor(a, weeksOut)
    const params: ProgrammeRole['params'] = {}
    // No race programme (general fitness) → no phase to name, same rule as dayRole.
    if (a.longRun.length) params.phase = phaseSlug(currentPhase(a, weeksOut)?.name ?? 'current block')
    if (step?.target) params.target = step.target
    return { key: 'role_long', params: Object.keys(params).length ? params : undefined }
  }
  return { key: cutback ? 'role_cutback_easy' : 'role_easy' }
}

// Injected into the system prompt; kept short because prompt length is context
// the free tier pays for every athlete-week.
export function describeArchetype(
  goalType: string | null | undefined,
  weeksOut: number | null
): string {
  const a = archetypeFor(goalType)
  const phase = currentPhase(a, weeksOut)
  const longRun = longRunFor(a, weeksOut)
  const cutback = isCutbackWeek(a, weeksOut)

  if (a.id === 'general') {
    return [
      `TRAINING PROGRAMME: ${a.label} (no race target).`,
      `- week shape: ${a.sessionsPerWeek.recovery} easy, ${a.sessionsPerWeek.speed} quality, ${a.sessionsPerWeek.long} long, ${a.sessionsPerWeek.rest} rest`,
      `- intent: ${a.intent}`,
      `- notes: ${a.coachingNotes.join(' ')}`,
      '',
      'SHARED METHOD (applies to every programme):',
      ...SHARED_RULES,
    ].join('\n')
  }

  const lines = [
    `TRAINING PROGRAMME: ${a.label} — ${a.programmeWeeks}-week structure, ${a.minWeeksRecommended} weeks minimum recommended.`,
    `- week shape: ${a.sessionsPerWeek.recovery} easy/recovery, ${a.sessionsPerWeek.speed} speed/quality, ${a.sessionsPerWeek.long} long, ${a.sessionsPerWeek.rest} rest`,
    `- intent: ${a.intent}`,
    `- programme notes: ${a.coachingNotes.join(' ')}`,
  ]

  lines.push(`PROGRAMME_PHASE: ${phase?.name ?? 'unphased'} (context only — never state it in the output)`)
  if (phase && weeksOut != null) {
    lines.push(`- the athlete is ${weeksOut} week${weeksOut === 1 ? '' : 's'} out: ${phase.intent}`)
  } else if (phase) {
    lines.push(`- ${phase.intent}`)
  }

  if (longRun) lines.push(`- long run at this point in the programme: ${longRun.target} (${longRun.note})`)
  if (cutback) lines.push('- THIS IS A CUTBACK WEEK. The drop in volume is the programme working, not a setback. Say so.')
  if (weeksOut != null && weeksOut <= 1) {
    lines.push('- RACE WEEK. Confirm freshness, fuelling and pacing intent. No new stimulus, no heroics.')
  }

  lines.push(
    '',
    'SHARED METHOD (applies to every programme):',
    ...SHARED_RULES,
    '',
    `PACE VOCABULARY the athlete thinks in: ${a.paceVocabulary.join('; ')}.`,
    '',
    'USE THIS WHEN EXPLAINING: name the phase and what it is for, connect the session to',
    'the programme position (build, cutback, peak, taper), and only then describe the run.',
    'Do not restate the schedule itself — the athlete can already see it.'
  )
  return lines.join('\n')
}

export const PLAN_ARCHETYPES = { FIVE_K, TEN_K, HALF, MARATHON, GENERAL }
