import { describe, expect, it } from 'vitest'

import {
  GOAL_OPTIONS,
  GOAL_TYPES,
  goalCompletionLabelKey,
  goalLabelKey,
  goalLongRunTargetKm,
  goalPlanLabelKey,
  GoalType,
  toGoalType,
} from '@/modules/goals/domain/value-object/GoalType'

describe('GoalType', () => {
  it('keeps the wire values the API expects', () => {
    expect(GoalType.HalfMarathon).toBe('half_marathon')
    expect(GoalType.FiveK).toBe('5K')
    expect(GOAL_TYPES).toHaveLength(7)
  })

  it('narrows a wire value', () => {
    expect(toGoalType('marathon')).toBe(GoalType.Marathon)
    expect(toGoalType('ultra')).toBeNull()
    expect(toGoalType(null)).toBeNull()
  })

  it('maps every member to catalogue keys, so none renders blank', () => {
    for (const type of GOAL_TYPES) {
      expect(goalLabelKey(type)).toMatch(/^ui\.goal\./)
      expect(goalCompletionLabelKey(type)).toMatch(/^ui\.goal_completion\./)
      expect(goalPlanLabelKey(type)).toMatch(/^ui\.goal_label\./)
    }
    expect(goalLabelKey('ultra')).toBe('ui.goal.fallback')
  })

  it('uses the catalogue spelling for the 5K/10K keys', () => {
    expect(goalLabelKey('5K')).toBe('ui.goal.5k')
    expect(goalPlanLabelKey('10K')).toBe('ui.goal_label.10k')
  })

  it('knows the long-run distance each goal builds toward', () => {
    expect(goalLongRunTargetKm(GoalType.Marathon)).toBe(20)
    expect(goalLongRunTargetKm(GoalType.HalfMarathon)).toBe(14)
    expect(goalLongRunTargetKm(GoalType.FiveK)).toBe(10)
  })

  it('offers every goal in the form, each with a key', () => {
    expect(GOAL_OPTIONS).toHaveLength(7)
    expect(GOAL_OPTIONS[0]?.labelKey).toBe('ui.goal.general_fitness')
  })
})
