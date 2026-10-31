import { ClearRunDayCache } from '@/modules/run-day/application/use-case/ClearRunDayCache.ts'
import { RefreshRunDay } from '@/modules/run-day/application/use-case/RefreshRunDay.ts'
import { SubmitRunDayFeedback } from '@/modules/run-day/application/use-case/SubmitRunDayFeedback.ts'
import { AnnounceFeedbackLogged } from '@/modules/run-day/application/use-case/subscriber/AnnounceFeedbackLogged.ts'
import { InvalidateStaleReadsOnFeedbackLogged } from '@/modules/run-day/application/use-case/subscriber/InvalidateStaleReadsOnFeedbackLogged.ts'
import type { CachedFeedback } from '@/modules/run-day/domain/entity/RunDay.ts'
import type { RunDayRepository } from '@/modules/run-day/domain/repository/run-day.repository.ts'
import { ToastRunDayNotifier } from '@/modules/run-day/infrastructure/notification/ToastRunDayNotifier.ts'
import { LocalStorageRunDayRepository } from '@/modules/run-day/infrastructure/repository/LocalStorageRunDayRepository.ts'
import type { EventBus } from '@/modules/shared/domain/EventBus.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'
import { container } from '@/modules/shared/infrastructure/container.ts'
import type { ContainerToken } from '@/modules/shared/infrastructure/container.ts'
import { DomainEventSubscribers } from '@/modules/shared/infrastructure/EventBus/DomainEventSubscribers.ts'
import { InMemoryAsyncEventBus } from '@/modules/shared/infrastructure/EventBus/InMemory/InMemoryAsyncEventBus.ts'

/**
 * Wiring for the run-day module: subscribers are bound before the bus collects them,
 * and a test can swap any piece by binding its own.
 */
const EVENT_BUS: ContainerToken = 'EventBus'
const RUN_DAY_REPOSITORY: ContainerToken = 'RunDayRepository'
const RUN_DAY_NOTIFIER: ContainerToken = 'RunDayNotifier'

container.bindSingleton(EVENT_BUS, () => new InMemoryAsyncEventBus())
container.bindSingleton(RUN_DAY_REPOSITORY, () => new LocalStorageRunDayRepository())
container.bindSingleton(RUN_DAY_NOTIFIER, () => new ToastRunDayNotifier())

container.bind('DomainEventSubscriber', (c) => new AnnounceFeedbackLogged(c.get(RUN_DAY_NOTIFIER)))
container.bind('DomainEventSubscriber', () => new InvalidateStaleReadsOnFeedbackLogged())

container.bindSingleton(
  RefreshRunDay,
  (c) => new RefreshRunDay(c.get<RunDayRepository>(RUN_DAY_REPOSITORY), c.get<EventBus>(EVENT_BUS)),
)
container.bindSingleton(
  SubmitRunDayFeedback,
  (c) =>
    new SubmitRunDayFeedback(
      c.get<RunDayRepository>(RUN_DAY_REPOSITORY),
      c.get<EventBus>(EVENT_BUS),
    ),
)
container.bindSingleton(
  ClearRunDayCache,
  (c) =>
    new ClearRunDayCache(c.get<RunDayRepository>(RUN_DAY_REPOSITORY), c.get<EventBus>(EVENT_BUS)),
)

container.get<EventBus>(EVENT_BUS).addSubscribers(DomainEventSubscribers.from(container))

export const runDayModule = {
  refresh: container.get<RefreshRunDay>(RefreshRunDay),
  submit: container.get<SubmitRunDayFeedback>(SubmitRunDayFeedback),
  clear: container.get<ClearRunDayCache>(ClearRunDayCache),
  repository: container.get<RunDayRepository>(RUN_DAY_REPOSITORY),
}

/** The cached day, read synchronously so the first paint is never wrong. */
export function readCachedRunDay(
  dateKey: LocalDateKey = LocalDateKey.today(),
): CachedFeedback | null {
  return runDayModule.repository.readCachedFeedback(dateKey)
}
