import { describe, expect, it, vi } from 'vitest'

import type { Activity } from '@/modules/activities/infrastructure/dto/Activity'
import { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus'
import type { PlanFeedback } from '@/modules/feedback/infrastructure/dto/PlanFeedback'
import { ClearRunDayCache } from '@/modules/run-day/application/use-case/ClearRunDayCache'
import { RefreshRunDay } from '@/modules/run-day/application/use-case/RefreshRunDay'
import { SubmitRunDayFeedback } from '@/modules/run-day/application/use-case/SubmitRunDayFeedback'
import { AnnounceFeedbackLogged } from '@/modules/run-day/application/use-case/subscriber/AnnounceFeedbackLogged'
import { RunDay } from '@/modules/run-day/domain/entity/RunDay'
import type { CachedFeedback } from '@/modules/run-day/domain/entity/RunDay'
import { FeedbackLoggedDomainEvent } from '@/modules/run-day/domain/event/FeedbackLoggedDomainEvent'
import type {
  RunDayFeedback,
  RunDayRepository,
} from '@/modules/run-day/domain/repository/run-day.repository'
import type { RunDayNotifier } from '@/modules/run-day/domain/service/run-day-notifier'
import { DomainEvent } from '@/modules/shared/domain/DomainEvent'
import type { EventBus } from '@/modules/shared/domain/EventBus'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey'
import { Container } from '@/modules/shared/infrastructure/container'
import { DomainEventSubscribers } from '@/modules/shared/infrastructure/EventBus/DomainEventSubscribers'
import { InMemoryAsyncEventBus } from '@/modules/shared/infrastructure/EventBus/InMemory/InMemoryAsyncEventBus'

const TODAY = LocalDateKey.from('2026-10-05')

/** The adapter the port exists for: no browser, no network, no clock. */
class FakeRunDayRepository implements RunDayRepository {
  cache: Record<string, CachedFeedback> = {}
  feedback: PlanFeedback[] | null = []
  activities: Activity[] = []
  submitted: Array<{ date: string; feedback: RunDayFeedback }> = []
  submitError: Error | null = null
  feedbackError: Error | null = null

  readCachedFeedback(dateKey: LocalDateKey): CachedFeedback | null {
    return this.cache[dateKey.value] ?? null
  }
  writeCachedFeedback(dateKey: LocalDateKey, feedback: RunDayFeedback): void {
    this.cache[dateKey.value] = { rpe: feedback.rpe, note: feedback.note, status: feedback.status }
  }
  clearCachedFeedback(): void {
    this.cache = {}
  }
  async fetchFeedback(): Promise<PlanFeedback[] | null> {
    if (this.feedbackError) throw this.feedbackError
    return this.feedback
  }
  async fetchRecentActivities(): Promise<Activity[]> {
    return this.activities
  }
  async submitFeedback(dateKey: LocalDateKey, feedback: RunDayFeedback): Promise<void> {
    if (this.submitError) throw this.submitError
    this.submitted.push({ date: dateKey.value, feedback })
  }
}

class RecordingEventBus implements EventBus {
  published: DomainEvent[] = []
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events)
  }
  addSubscribers(): void {}
}

function today(overrides: Partial<ReturnType<RunDay['toPrimitives']>> = {}): RunDay {
  return RunDay.fromPrimitives({
    dateKey: '2026-10-05',
    completed: false,
    activityId: null,
    activityKind: null,
    feedbackSaved: false,
    rpe: null,
    note: '',
    status: FeedbackStatus.Completed,
    ...overrides,
  })
}

const serverMessage = (message: string) => () => message

describe('RefreshRunDay', () => {
  it('resolves a day from an explicit Feedback entry', async () => {
    const repository = new FakeRunDayRepository()
    repository.feedback = [{ date: '2026-10-05T00:00:00.000Z', status: 'completed', rpe: 7 }]

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.primitives.feedbackSaved).toBe(true)
    expect(snapshot.primitives.rpe).toBe(7)
    expect(snapshot.primitives.completed).toBe(true)
    expect(repository.cache['2026-10-05']?.rpe).toBe(7)
  })

  it('treats a synced activity as the run having happened, and announces it', async () => {
    const repository = new FakeRunDayRepository()
    repository.activities = [{ id: 987, start_date: '2026-10-05T06:00:00Z' }]
    const bus = new RecordingEventBus()

    const snapshot = await new RefreshRunDay(repository, bus).execute(TODAY)

    expect(snapshot.activity?.id).toBe(987)
    expect(snapshot.primitives.completed).toBe(true)
    expect(bus.published.map((event) => event.eventName)).toEqual(['run-day.completed'])
  })

  it('resolves a day whose only imported activity is cross-training', async () => {
    const repository = new FakeRunDayRepository()
    repository.activities = [{ id: 55, date: '2026-10-05', kind: 'hiit', workout_type: 'other' }]
    const bus = new RecordingEventBus()

    const snapshot = await new RefreshRunDay(repository, bus).execute(TODAY)

    expect(snapshot.activity?.id).toBe(55)
    expect(snapshot.primitives.completed).toBe(true)
    expect(snapshot.primitives.activityKind).toBe('hiit')
    expect(bus.published.map((event) => event.eventName)).toEqual(['run-day.completed'])
  })

  it('keeps the run when the day also has a cross-training session', async () => {
    const repository = new FakeRunDayRepository()
    repository.activities = [
      { id: 55, date: '2026-10-05', kind: 'strength', workout_type: 'other' },
      { id: 56, date: '2026-10-05', kind: 'run', workout_type: 'easy' },
    ]

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.activity?.id).toBe(56)
    expect(snapshot.primitives.activityKind).toBe('run')
  })

  it('does not let another day\u2019s cross-training session complete today', async () => {
    const repository = new FakeRunDayRepository()
    repository.activities = [{ id: 55, date: '2026-10-04', kind: 'hiit' }]

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.activity).toBeNull()
    expect(snapshot.primitives.completed).toBe(false)
    expect(snapshot.primitives.activityKind).toBeNull()
  })

  it('leaves a legacy row tagged `other` incomplete, as before', async () => {
    const repository = new FakeRunDayRepository()
    repository.activities = [{ id: 55, date: '2026-10-05', workout_type: 'other' }]

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.primitives.completed).toBe(false)
  })

  it('completes the day for a family this build does not know, instead of dropping it', async () => {
    // A newer server imports a family this client build has no name for. A raw
    // truthiness check on `kind` made it neither run nor cross-training, so the
    // day completed as nothing and the athlete's session vanished from Today.
    const repository = new FakeRunDayRepository()
    repository.activities = [{ id: 66, date: '2026-10-05', kind: 'kayak', workout_type: 'other' }]

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.activity?.id).toBe(66)
    expect(snapshot.primitives.completed).toBe(true)
    // Unknown family: a session, never a run.
    expect(snapshot.primitives.activityKind).toBe('other')
  })

  it('falls back to workout_type only when kind is absent', async () => {
    const legacyRun = new FakeRunDayRepository()
    legacyRun.activities = [{ id: 67, date: '2026-10-05', workout_type: 'easy' }]
    const run = await new RefreshRunDay(legacyRun, new RecordingEventBus()).execute(TODAY)
    expect(run.primitives.completed).toBe(true)
    expect(run.primitives.activityKind).toBe('run')

    // `kind` present but unknown: `workout_type` does not decide the family.
    const unknown = new FakeRunDayRepository()
    unknown.activities = [{ id: 68, date: '2026-10-05', kind: 'kayak', workout_type: 'easy' }]
    const other = await new RefreshRunDay(unknown, new RecordingEventBus()).execute(TODAY)
    expect(other.primitives.activityKind).toBe('other')
  })

  it('falls back to the local cache when the server has nothing', async () => {
    const repository = new FakeRunDayRepository()
    repository.cache['2026-10-05'] = { rpe: 4, note: 'easy', status: FeedbackStatus.Completed }

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.primitives.completed).toBe(true)
    expect(snapshot.primitives.note).toBe('easy')
  })

  it('keeps going when a source fails, instead of blanking the day', async () => {
    const repository = new FakeRunDayRepository()
    repository.feedbackError = new Error('feedback endpoint down')
    repository.activities = [{ id: 1, date: '2026-10-05' }]

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.primitives.completed).toBe(true)
    expect(snapshot.activity?.id).toBe(1)
  })

  it('does not claim completion for a day whose feedback was skipped', async () => {
    const repository = new FakeRunDayRepository()
    repository.feedback = [{ date: '2026-10-05', status: 'skipped' }]

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.primitives.feedbackSaved).toBe(true)
    expect(snapshot.primitives.completed).toBe(false)
  })

  it('ignores entries for other days', async () => {
    const repository = new FakeRunDayRepository()
    repository.feedback = [{ date: '2026-10-04', status: 'completed', rpe: 9 }]

    const snapshot = await new RefreshRunDay(repository, new RecordingEventBus()).execute(TODAY)

    expect(snapshot.primitives.feedbackSaved).toBe(false)
  })
})

describe('SubmitRunDayFeedback', () => {
  it('refuses a non-skip without an RPE (CONTEXT.md §Skip Without RPE)', async () => {
    const repository = new FakeRunDayRepository()

    const result = await new SubmitRunDayFeedback(repository, new RecordingEventBus()).execute(
      today(),
      { rpe: null, note: '', status: FeedbackStatus.Completed },
      serverMessage('nope'),
    )

    expect(result).toEqual({ ok: false, reason: 'rpe-required' })
    expect(repository.submitted).toHaveLength(0)
  })

  it('accepts a plain skip with no RPE', async () => {
    const repository = new FakeRunDayRepository()

    const result = await new SubmitRunDayFeedback(repository, new RecordingEventBus()).execute(
      today(),
      { rpe: null, note: '', status: FeedbackStatus.Skipped },
      serverMessage('nope'),
    )

    expect(result.ok).toBe(true)
    expect(repository.submitted[0]?.feedback.status).toBe(FeedbackStatus.Skipped)
  })

  it('caches what it submitted and publishes the fact', async () => {
    const repository = new FakeRunDayRepository()
    const bus = new RecordingEventBus()

    await new SubmitRunDayFeedback(repository, bus).execute(
      today(),
      { rpe: 8, note: 'hard', status: FeedbackStatus.Completed },
      serverMessage('nope'),
    )

    expect(repository.cache['2026-10-05']?.rpe).toBe(8)
    expect(bus.published[0]).toBeInstanceOf(FeedbackLoggedDomainEvent)
  })

  it('reports the server message when the write fails', async () => {
    const repository = new FakeRunDayRepository()
    repository.submitError = new Error('offline')

    const result = await new SubmitRunDayFeedback(repository, new RecordingEventBus()).execute(
      today(),
      { rpe: 5, note: '', status: FeedbackStatus.Completed },
      serverMessage('Strava rate limit reached'),
    )

    expect(result).toEqual({ ok: false, reason: 'failed', message: 'Strava rate limit reached' })
  })

  it('does nothing when the day was already logged', async () => {
    const repository = new FakeRunDayRepository()

    const result = await new SubmitRunDayFeedback(repository, new RecordingEventBus()).execute(
      today({ feedbackSaved: true }),
      { rpe: 5, note: '', status: FeedbackStatus.Completed },
      serverMessage('nope'),
    )

    expect(result).toEqual({ ok: false, reason: 'already-saved' })
  })
})

describe('the module wired together', () => {
  it('announces logged feedback to the athlete, through the notifier port', async () => {
    const notifier: RunDayNotifier = { feedbackSaved: vi.fn() }
    const container = new Container()
    container.bind('DomainEventSubscriber', () => new AnnounceFeedbackLogged(notifier))
    const bus = new InMemoryAsyncEventBus()
    bus.addSubscribers(DomainEventSubscribers.from(container))

    await bus.publish([
      new FeedbackLoggedDomainEvent({
        aggregateId: '2026-10-05',
        dateKey: '2026-10-05',
        status: 'completed',
      }),
    ])

    expect(notifier.feedbackSaved).toHaveBeenCalledWith(FeedbackStatus.Completed)
  })

  it('clears the cache and records that it did', async () => {
    const repository = new FakeRunDayRepository()
    repository.cache['2026-10-05'] = { rpe: 5, note: '', status: FeedbackStatus.Completed }
    const bus = new RecordingEventBus()

    await new ClearRunDayCache(repository, bus).execute(TODAY)

    expect(repository.cache).toEqual({})
    expect(bus.published.map((event) => event.eventName)).toEqual(['run-day.cache.cleared'])
  })
})
