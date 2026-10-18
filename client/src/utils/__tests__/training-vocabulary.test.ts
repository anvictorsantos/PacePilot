import { describe, it, expect } from 'vitest'

import {
  activityTitle,
  goalCompletionLabel,
  goalLabel,
  intensityAvatarClass,
  intensityDotClass,
  paceFromActivity,
  toWorkoutType,
  workoutBadge,
  workoutLabel,
  workoutTarget,
} from '@/utils/training-vocabulary.ts'

describe('training vocabulary', () => {
  it('narrows a payload string to a known workout type', () => {
    expect(toWorkoutType('Tempo')).toBe('tempo')
    expect(toWorkoutType('threshold')).toBe('threshold')
    expect(toWorkoutType('sprints')).toBeNull()
    expect(toWorkoutType(null)).toBeNull()
  })

  it('names a workout type, falling back to the raw type', () => {
    expect(workoutLabel('tempo')).toBeTruthy()
    expect(workoutLabel('race')).toBe('RACE')
    expect(workoutLabel(null)).toBe('')
  })

  it('badges every type the plan and Strava can produce', () => {
    expect(workoutBadge('rest')).toBe('REST DAY')
    expect(workoutBadge('interval')).toBe('INTERVALS')
    expect(workoutBadge('unknown')).toBe('RUN')
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

  it('labels goals, with a completion variant and a plan variant', () => {
    expect(goalLabel('half_marathon')).toBe('Half Marathon')
    expect(goalCompletionLabel('half_marathon')).toBe('Half Marathon Completion')
    expect(goalLabel('some_new_goal')).toBe('Some New Goal')
    expect(goalLabel(null)).toBe('—')
    expect(goalCompletionLabel(null)).toBe('—')
  })

  it('returns name when provided', () => {
    expect(activityTitle({ name: 'Tempo Run', workout_type: 'tempo' })).toBe('Tempo Run')
  })

  it('falls back to a type title, then to the unknown title', () => {
    expect(activityTitle({ workout_type: 'tempo' })).toBeTruthy()
    expect(activityTitle({})).toBeTruthy()
    expect(activityTitle({ workout_type: 'sprints' })).toBe(activityTitle({}))
  })
})
