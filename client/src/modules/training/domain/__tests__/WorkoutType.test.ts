import { describe, expect, it } from 'vitest'

import {
  isEasyWorkout,
  isHardWorkout,
  isNonTrainingWorkout,
  isRestWorkout,
  toWorkoutType,
  WORKOUT_TYPES,
  WorkoutType,
} from '@/modules/training/domain/value-object/WorkoutType'

describe('WorkoutType', () => {
  it('narrows a wire value, case-insensitively', () => {
    expect(toWorkoutType('Tempo')).toBe(WorkoutType.Tempo)
    expect(toWorkoutType('THRESHOLD')).toBe(WorkoutType.Threshold)
  })

  it('returns null for a type the plan does not prescribe', () => {
    expect(toWorkoutType('sprints')).toBeNull()
    expect(toWorkoutType(undefined)).toBeNull()
    expect(toWorkoutType(null)).toBeNull()
  })

  it('keeps the wire values the server sends', () => {
    expect(WorkoutType.Rest).toBe('rest')
    expect(WorkoutType.Intervals).toBe('intervals')
    expect(WorkoutType.Unknown).toBe('unknown')
  })

  it('covers the whole set with its predicates', () => {
    expect(WORKOUT_TYPES).toContain(WorkoutType.Intervals)
    expect(isRestWorkout('rest')).toBe(true)
    expect(isNonTrainingWorkout('unknown')).toBe(true)
    expect(isNonTrainingWorkout('rest')).toBe(true)
    expect(isNonTrainingWorkout('easy')).toBe(false)
    expect(isHardWorkout('interval')).toBe(true)
    expect(isHardWorkout('steady')).toBe(false)
    expect(isEasyWorkout('recovery')).toBe(true)
    expect(isEasyWorkout('race')).toBe(false)
  })
})
