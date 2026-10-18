import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  archetypeFor,
  currentPhase,
  dayRole,
  describeArchetype,
  isCutbackWeek,
  longRunFor,
  PLAN_ARCHETYPES,
} from '@/modules/ai/domain/plan-archetypes.ts'

describe('archetypeFor', () => {
  test('maps every Athlete.goal_type to the right programme', () => {
    assert.equal(archetypeFor('5K').id, '5k')
    assert.equal(archetypeFor('10K').id, '10k')
    assert.equal(archetypeFor('half_marathon').id, 'half_marathon')
    assert.equal(archetypeFor('marathon').id, 'marathon')
    assert.equal(archetypeFor('general_fitness').id, 'general')
    assert.equal(archetypeFor('maintain').id, 'general')
    assert.equal(archetypeFor('distance_completion').id, 'general')
  })

  test('falls back to general for an unknown or missing goal', () => {
    assert.equal(archetypeFor('triathlon').id, 'general')
    assert.equal(archetypeFor(null).id, 'general')
    assert.equal(archetypeFor(undefined).id, 'general')
  })

  test('programme lengths match the source programmes', () => {
    assert.equal(PLAN_ARCHETYPES.FIVE_K.programmeWeeks, 8)
    assert.equal(PLAN_ARCHETYPES.TEN_K.programmeWeeks, 8)
    assert.equal(PLAN_ARCHETYPES.HALF.programmeWeeks, 14)
    assert.equal(PLAN_ARCHETYPES.MARATHON.programmeWeeks, 18)
  })

  test('session counts match the source programmes', () => {
    // 5K/10K/half: "two Recovery Runs and two Rest Days" -> 5 runs a week.
    // Marathon: "three Recovery Runs and two Rest Days" -> 5 runs, one speed.
    for (const a of [PLAN_ARCHETYPES.FIVE_K, PLAN_ARCHETYPES.TEN_K, PLAN_ARCHETYPES.HALF]) {
      const total = a.sessionsPerWeek.recovery + a.sessionsPerWeek.speed + a.sessionsPerWeek.long
      assert.equal(total, 5, `${a.id} schedules ${total} runs, source says 5`)
      assert.equal(a.sessionsPerWeek.rest, 2)
    }
    assert.equal(PLAN_ARCHETYPES.FIVE_K.sessionsPerWeek.speed, 2)
    assert.equal(PLAN_ARCHETYPES.HALF.sessionsPerWeek.speed, 2)
    assert.equal(PLAN_ARCHETYPES.MARATHON.sessionsPerWeek.speed, 1)
    assert.equal(PLAN_ARCHETYPES.MARATHON.sessionsPerWeek.recovery, 3)
  })
})

describe('currentPhase', () => {
  test('marathon week 5 is peak, not taper — the longest run lives there', () => {
    assert.equal(currentPhase(PLAN_ARCHETYPES.MARATHON, 5).name, 'peak')
  })

  test('marathon taper starts at week 4, after the peak long run', () => {
    assert.equal(currentPhase(PLAN_ARCHETYPES.MARATHON, 4).name, 'taper')
    assert.equal(currentPhase(PLAN_ARCHETYPES.MARATHON, 1).name, 'taper')
  })

  test('covers every week of the marathon programme with a phase', () => {
    for (let w = 1; w <= 18; w++) {
      assert.ok(currentPhase(PLAN_ARCHETYPES.MARATHON, w), `no phase for week ${w}`)
    }
  })

  test('an athlete who joined late still lands in a real phase', () => {
    const p = currentPhase(PLAN_ARCHETYPES.MARATHON, 3)
    assert.equal(p.name, 'taper')
  })

  test('an athlete with more time than the programme starts in its first phase', () => {
    assert.equal(currentPhase(PLAN_ARCHETYPES.MARATHON, 30).name, 'base')
  })

  test('no goal date still yields a phase', () => {
    assert.ok(currentPhase(PLAN_ARCHETYPES.FIVE_K, null))
  })
})

describe('longRunFor', () => {
  test('returns the target for the current position in the build', () => {
    assert.equal(longRunFor(PLAN_ARCHETYPES.MARATHON, 5).target, '29-35 km (18-22 miles)')
    assert.equal(longRunFor(PLAN_ARCHETYPES.HALF, 4).target, '20 km')
    assert.equal(longRunFor(PLAN_ARCHETYPES.TEN_K, 7).target, '6.5 km (4 miles)')
    assert.equal(longRunFor(PLAN_ARCHETYPES.FIVE_K, 6).target, '30 minutes easy')
  })

  test('monotonically reaches the race at one week out', () => {
    assert.match(longRunFor(PLAN_ARCHETYPES.MARATHON, 1).target, /42\.2 km race/)
    assert.match(longRunFor(PLAN_ARCHETYPES.HALF, 1).target, /21\.1 km race/)
    assert.match(longRunFor(PLAN_ARCHETYPES.FIVE_K, 1).target, /5 km race/)
  })

  test('returns null when there is no race or no date', () => {
    assert.equal(longRunFor(PLAN_ARCHETYPES.GENERAL, 5), null)
    assert.equal(longRunFor(PLAN_ARCHETYPES.MARATHON, null), null)
  })
})

describe('isCutbackWeek', () => {
  test('marathon cutbacks fall every fourth week as the 3:1 cycle states', () => {
    assert.deepEqual(PLAN_ARCHETYPES.MARATHON.cutbackWeeksOut, [16, 13, 10, 6])
    assert.equal(isCutbackWeek(PLAN_ARCHETYPES.MARATHON, 16), true)
    assert.equal(isCutbackWeek(PLAN_ARCHETYPES.MARATHON, 13), true)
    assert.equal(isCutbackWeek(PLAN_ARCHETYPES.MARATHON, 10), true)
    assert.equal(isCutbackWeek(PLAN_ARCHETYPES.MARATHON, 6), true)
    assert.equal(isCutbackWeek(PLAN_ARCHETYPES.MARATHON, 5), false)
  })

  test('half marathon cutbacks are at weeks 10 and 6', () => {
    assert.deepEqual(PLAN_ARCHETYPES.HALF.cutbackWeeksOut, [10, 6])
  })

  test('no cutback is claimed for the 5K programme', () => {
    assert.deepEqual(PLAN_ARCHETYPES.FIVE_K.cutbackWeeksOut, [])
    assert.equal(isCutbackWeek(PLAN_ARCHETYPES.FIVE_K, 5), false)
  })

  test('no date means no cutback claim', () => {
    assert.equal(isCutbackWeek(PLAN_ARCHETYPES.MARATHON, null), false)
  })
})

describe('dayRole', () => {
  test('labels the long run with its phase and target', () => {
    assert.equal(dayRole(PLAN_ARCHETYPES.MARATHON, 5, 'long'), 'peak long run, target 29-35 km (18-22 miles)')
    assert.equal(dayRole(PLAN_ARCHETYPES.MARATHON, 4, 'long'), 'taper long run, target 24-26 km')
  })

  test('does not attach a phase name to easy, rest or quality sessions', () => {
    // Measured: a free model shown a phase per day repeats it in prose and gets
    // it wrong. Only the long run carries the phase.
    assert.equal(dayRole(PLAN_ARCHETYPES.MARATHON, 4, 'rest'), 'rest day')
    assert.equal(dayRole(PLAN_ARCHETYPES.MARATHON, 4, 'easy'), 'easy run')
    assert.equal(dayRole(PLAN_ARCHETYPES.MARATHON, 4, 'tempo'), 'quality session')
    assert.equal(/phase|peak|taper|base/.test(dayRole(PLAN_ARCHETYPES.MARATHON, 4, 'easy')), false)
  })

  test('marks cutback weeks on the non-long sessions', () => {
    assert.equal(dayRole(PLAN_ARCHETYPES.MARATHON, 6, 'easy'), 'cutback week easy run')
    assert.equal(dayRole(PLAN_ARCHETYPES.MARATHON, 6, 'tempo'), 'cutback week quality session')
  })

  test('still labels long runs on a cutback week', () => {
    assert.match(dayRole(PLAN_ARCHETYPES.MARATHON, 6, 'long'), /long run/)
  })

  test('general fitness never invents a race role', () => {
    assert.equal(dayRole(PLAN_ARCHETYPES.GENERAL, 5, 'long'), 'long run')
    assert.equal(dayRole(PLAN_ARCHETYPES.GENERAL, 5, 'easy'), 'easy run')
  })
})

describe('describeArchetype', () => {
  test('identifies the programme, phase and long run for the current position', () => {
    const block = describeArchetype('marathon', 5)
    assert.match(block, /18-week structure/)
    assert.match(block, /PROGRAMME_PHASE: peak/)
    assert.match(block, /29-35 km/)
  })

  test('flags a cutback week explicitly', () => {
    assert.match(describeArchetype('marathon', 6), /CUTBACK WEEK/)
  })

  test('flags race week', () => {
    assert.match(describeArchetype('half_marathon', 1), /RACE WEEK/)
  })

  test('states the shared method and pace vocabulary in every block', () => {
    for (const goal of ['5K', '10K', 'half_marathon', 'marathon']) {
      const block = describeArchetype(goal, 4)
      assert.match(block, /PACE VOCABULARY/, `${goal} missing pace vocabulary`)
      assert.match(block, /progression runs/i, `${goal} missing progression-run method`)
      assert.match(block, /SHARED METHOD/, `${goal} missing shared method`)
    }
  })

  test('general fitness gets no race framing', () => {
    const block = describeArchetype('general_fitness', 5)
    assert.equal(/RACE WEEK/.test(block), false)
    assert.equal(/CUTBACK WEEK/.test(block), false)
    assert.match(block, /no race target/i)
  })

  test('blocks stay compact — roughly 450 tokens against a ~13k-token prompt', () => {
    // Not a hard token cost (free models are $0) but a guard against the block
    // growing without bound; the weekly prompt is mostly athlete data.
    for (const goal of ['5K', '10K', 'half_marathon', 'marathon', 'general_fitness']) {
      const block = describeArchetype(goal, 5)
      assert.ok(block.length < 1800, `${goal} block is ${block.length} chars`)
    }
  })

  test('never reproduces source prose verbatim', () => {
    // Guards against the archetype module drifting into copied copy.
    const all = Object.values(PLAN_ARCHETYPES)
      .map(a => `${a.intent} ${a.coachingNotes.join(' ')} ${a.phases.map(p => p.intent).join(' ')}`)
      .join(' ')
      .toLowerCase()
    for (const phrase of [
      'kickass playlist',
      'a great coach will tell you',
      'let them all out',
      'written in stone',
    ]) {
      assert.equal(all.includes(phrase), false, `copied source phrase: ${phrase}`)
    }
  })
})

describe('weeks vs days regression', () => {
  test('a 4-weeks-out marathon reports the taper, not the first phase', () => {
    // Regression: the runtime path once passed DAYS into a WEEKS-indexed
    // lookup, so 28 looked like "past every window" and fell back to base.
    const days = 4 * 7
    const weeks = Math.ceil(days / 7)
    assert.equal(currentPhase(PLAN_ARCHETYPES.MARATHON, weeks).name, 'taper')
    assert.equal(currentPhase(PLAN_ARCHETYPES.MARATHON, days).name, 'base')
    assert.match(describeArchetype('marathon', weeks), /PROGRAMME_PHASE: taper/)
  })

  test('a 5-weeks-out marathon reports peak and its longest run', () => {
    assert.match(describeArchetype('marathon', Math.ceil(5 * 7 / 7)), /PROGRAMME_PHASE: peak/)
    assert.match(describeArchetype('marathon', 5), /29-35 km/)
  })
})
