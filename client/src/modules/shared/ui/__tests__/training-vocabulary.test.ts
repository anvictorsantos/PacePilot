import { describe, it, expect } from 'vitest'

import {
  goalCompletionLabelKey,
  goalLabelKey,
  goalLongRunTargetKm,
} from '@/modules/goals/domain/value-object/GoalType.ts'
import {
  activityBadge,
  activityTitle,
  goalCompletionLabel,
  goalLabel,
  INTENSITY_LABELS,
  intensityAvatarClass,
  intensityDotClass,
  paceFromActivity,
  WORKOUT_BADGES,
  workoutBadge,
  workoutLabel,
  workoutTarget,
} from '@/modules/shared/ui/training-vocabulary.ts'
import {
  isEasyWorkout,
  isHardWorkout,
  isRestWorkout,
  toWorkoutType,
  WorkoutType,
} from '@/modules/training/domain/value-object/WorkoutType.ts'

describe('workout type vocabulary', () => {
  it('narrows a payload string to a known workout type', () => {
    expect(toWorkoutType('Tempo')).toBe(WorkoutType.Tempo)
    expect(toWorkoutType('threshold')).toBe(WorkoutType.Threshold)
    expect(toWorkoutType('sprints')).toBeNull()
    expect(toWorkoutType(null)).toBeNull()
  })

  it('classifies a type once, for every surface that asks', () => {
    expect(isRestWorkout('rest')).toBe(true)
    expect(isRestWorkout('tempo')).toBe(false)
    expect(isHardWorkout('threshold')).toBe(true)
    expect(isHardWorkout('easy')).toBe(false)
    expect(isEasyWorkout('long')).toBe(true)
    expect(isEasyWorkout('interval')).toBe(false)
  })

  it('names a workout type, falling back to the raw type', () => {
    expect(workoutLabel('tempo')).toBeTruthy()
    expect(workoutLabel('race')).toBe('RACE')
    expect(workoutLabel(null)).toBe('')
  })

  it('resolves every badge and intensity label through the catalogue', () => {
    // The copy lives in the i18n catalogues; what this module owns is the key
    // per enum member, so a new member cannot slip through untranslated.
    expect(Object.keys(WORKOUT_BADGES)).toHaveLength(Object.keys(WorkoutType).length)
    expect(WORKOUT_BADGES[WorkoutType.Rest]).toBe('ui.badge.rest')
    expect(WORKOUT_BADGES[WorkoutType.Interval]).toBe('ui.badge.interval')
    expect(INTENSITY_LABELS[WorkoutType.Tempo]).toBe('ui.intensity_tempo')
    expect(workoutBadge('rest')).toBeTruthy()
    expect(workoutBadge('something-else')).toBe('SOMETHING-ELSE')
  })

  it('targets every type, defaulting to the easy prescription', () => {
    expect(workoutTarget('tempo')).toEqual({ pace: '5:15/km', rpe: 7 })
    expect(workoutTarget('rest')).toEqual({ pace: '—', rpe: '—' })
    expect(workoutTarget('sprints')).toEqual(workoutTarget('easy'))
  })

  it('tones every type, and reads an unknown type as muted', () => {
    expect(intensityDotClass('threshold')).toBe('bg-danger')
    expect(intensityDotClass('long')).toBe('bg-success')
    expect(intensityDotClass('sprints')).toBe('bg-muted')
    expect(intensityAvatarClass('tempo')).toBe('bg-primary')
  })

  it('formats pace from either field the server sends', () => {
    expect(paceFromActivity({ avg_pace_sec_km: 330 })).toBe('5:30 /km')
    expect(paceFromActivity({ average_speed: 3.3333 })).toBe('5:00 /km')
    expect(paceFromActivity({})).toBe('—')
  })
})

describe('goal vocabulary', () => {
  it('maps a goal to its catalogue keys', () => {
    expect(goalLabelKey('half_marathon')).toBe('ui.goal.half_marathon')
    expect(goalCompletionLabelKey('half_marathon')).toBe('ui.goal_completion.half_marathon')
    expect(goalLabelKey('5K')).toBe('ui.goal.5k')
    expect(goalLabelKey('something_new')).toBe('ui.goal.fallback')
  })

  it('resolves the copy through the catalogue, in the active locale', () => {
    expect(goalLabel('half_marathon')).toBeTruthy()
    expect(goalCompletionLabel('half_marathon')).toBeTruthy()
  })

  it('knows the long-run distance each goal builds toward', () => {
    expect(goalLongRunTargetKm('marathon')).toBe(20)
    expect(goalLongRunTargetKm('half_marathon')).toBe(14)
    expect(goalLongRunTargetKm('5K')).toBe(10)
    expect(goalLongRunTargetKm(null)).toBe(10)
  })
})

describe('activity titles', () => {
  it('returns name when provided', () => {
    expect(activityTitle({ name: 'Tempo Run', workout_type: 'tempo' })).toBe('Tempo Run')
  })

  it('falls back to a type title, then to the unknown title', () => {
    expect(activityTitle({ workout_type: 'tempo' })).toBeTruthy()
    expect(activityTitle({})).toBeTruthy()
    expect(activityTitle({ workout_type: 'sprints' })).toBe(activityTitle({}))
  })

  it('names a cross-training session from its family, not "other"', () => {
    expect(activityTitle({ kind: 'hiit', workout_type: 'other' })).not.toBe(
      activityTitle({ workout_type: 'other' }),
    )
    expect(activityTitle({ kind: 'hiit', workout_type: 'other' })).toBeTruthy()
  })
})

describe('activity badges', () => {
  it('reads the family for cross-training and the workout type for runs', () => {
    expect(activityBadge({ kind: 'hiit', workout_type: 'other' })).not.toBe(
      activityBadge({ kind: 'strength', workout_type: 'other' }),
    )
    expect(activityBadge({ kind: 'run', workout_type: 'tempo' })).toBe(workoutBadge('tempo'))
  })

  it('falls back to the workout type when a legacy row has no kind', () => {
    expect(activityBadge({ workout_type: 'easy' })).toBe(workoutBadge('easy'))
  })
})
