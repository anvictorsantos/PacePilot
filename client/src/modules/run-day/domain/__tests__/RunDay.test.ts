import { describe, expect, it } from 'vitest'

import { ActivityKind } from '@/modules/activities/domain/value-object/ActivityKind'
import { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus'
import { RunDay } from '@/modules/run-day/domain/entity/RunDay'
import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent'
import { RunDayCacheClearedDomainEvent } from '@/modules/run-day/domain/event/RunDayCacheClearedDomainEvent'
import { RunDayCompletedDomainEvent } from '@/modules/run-day/domain/event/RunDayCompletedDomainEvent'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey'

const TODAY = LocalDateKey.from('2026-10-05')

describe('RunDay', () => {
  it('starts empty for the date it is created for', () => {
    const runDay = RunDay.empty(TODAY)
    expect(runDay.id).toBe('2026-10-05')
    expect(runDay.completed).toBe(false)
    expect(runDay.feedbackSaved).toBe(false)
    expect(runDay.pullDomainEvents()).toHaveLength(0)
  })

  it('records completion once, however many reads report it', () => {
    const runDay = RunDay.empty(TODAY)
    runDay.complete('1234')
    runDay.complete('1234')

    const events = runDay.pullDomainEvents()

    expect(events).toHaveLength(1)
    expect(events[0]).toBeInstanceOf(RunDayCompletedDomainEvent)
    expect((events[0] as RunDayCompletedDomainEvent).activityId).toBe('1234')
  })

  it('remembers the activity of a day that was already complete', () => {
    const runDay = RunDay.fromPrimitives({
      dateKey: '2026-10-05',
      completed: true,
      activityId: null,
      activityKind: null,
      feedbackSaved: false,
      rpe: null,
      note: '',
      status: FeedbackStatus.Completed,
    })

    runDay.complete('987')

    expect(runDay.activityId).toBe('987')
    expect(runDay.pullDomainEvents()).toHaveLength(0)
  })

  it('a run completes the day without making it a cross-training day', () => {
    const runDay = RunDay.empty(TODAY)

    runDay.complete('1234', ActivityKind.Run)

    expect(runDay.completed).toBe(true)
    expect(runDay.activityKind).toBe(ActivityKind.Run)
    expect(runDay.crossTraining).toBe(false)
  })

  it('a day completed by an imported HIIT session is done, and reads as cross-training', () => {
    const runDay = RunDay.empty(TODAY)

    runDay.complete('987', ActivityKind.Hiit)

    expect(runDay.completed).toBe(true)
    expect(runDay.activityId).toBe('987')
    expect(runDay.activityKind).toBe(ActivityKind.Hiit)
    expect(runDay.crossTraining).toBe(true)
  })

  it('hydrating from cache changes state without claiming something happened', () => {
    const runDay = RunDay.empty(TODAY)
    runDay.hydrate({ feedback: { rpe: 7, note: 'windy', status: FeedbackStatus.Completed } })

    expect(runDay.feedbackSaved).toBe(true)
    expect(runDay.rpe).toBe(7)
    expect(runDay.note).toBe('windy')
    expect(runDay.completed).toBe(true)
    expect(runDay.pullDomainEvents()).toHaveLength(0)
  })

  it('a skipped day is logged but not completed (CONTEXT.md §Skipped)', () => {
    const runDay = RunDay.empty(TODAY)
    runDay.hydrate({ feedback: { rpe: 6, note: '', status: FeedbackStatus.Completed } })

    runDay.logFeedback({ rpe: null, note: '', status: FeedbackStatus.Skipped })

    expect(runDay.completed).toBe(false)
    expect(runDay.feedbackSaved).toBe(true)
    expect(runDay.pullDomainEvents()[0]).toBeInstanceOf(FeedbackLoggedDomainEvent)
  })

  it('logging feedback carries what the subscribers need', () => {
    const runDay = RunDay.empty(TODAY)
    runDay.logFeedback({ rpe: 9, note: 'legs heavy', status: FeedbackStatus.Completed })

    const [event] = runDay.pullDomainEvents() as FeedbackLoggedDomainEvent[]

    expect(event?.status).toBe('completed')
    expect(event?.rpe).toBe(9)
    expect(event?.dateKey).toBe('2026-10-05')
  })

  it('clearing resets the day and records it', () => {
    const runDay = RunDay.fromPrimitives({
      dateKey: '2026-10-05',
      completed: true,
      activityId: '1234',
      activityKind: 'hiit',
      feedbackSaved: true,
      rpe: 8,
      note: 'ok',
      status: FeedbackStatus.Completed,
    })

    runDay.clear()

    expect(runDay.completed).toBe(false)
    expect(runDay.activityKind).toBeNull()
    expect(runDay.feedbackSaved).toBe(false)
    expect(runDay.rpe).toBeNull()
    expect(runDay.note).toBe('')
    expect(runDay.pullDomainEvents()[0]).toBeInstanceOf(RunDayCacheClearedDomainEvent)
  })

  it('exposes the RPE as a value object, so callers do not re-parse it', () => {
    const runDay = RunDay.empty(TODAY)
    expect(runDay.rpeValueObject()).toBeNull()
    runDay.hydrate({ feedback: { rpe: 8, note: '', status: FeedbackStatus.Completed } })
    expect(runDay.rpeValueObject()?.isHigh()).toBe(true)
  })

  it('round-trips its primitives', () => {
    const runDay = RunDay.empty(TODAY)
    runDay.complete('1234')
    runDay.logFeedback({ rpe: 5, note: 'steady', status: FeedbackStatus.Completed })

    const primitives = runDay.toPrimitives()

    expect(primitives.dateKey).toBe('2026-10-05')
    expect(primitives.activityId).toBe('1234')
    expect(primitives.status).toBe('completed')
    expect(RunDay.fromPrimitives(primitives).toPrimitives()).toEqual(primitives)
  })
})
