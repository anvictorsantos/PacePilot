import { RunDay } from '@/modules/run-day/domain/entity/RunDay.ts'
import type { RunDayRepository } from '@/modules/run-day/domain/repository/run-day.repository.ts'
import type { EventBus } from '@/modules/shared/domain/EventBus.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'

export class ClearRunDayCache {
  constructor(
    private readonly repository: RunDayRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(dateKey: LocalDateKey = LocalDateKey.today()): Promise<void> {
    this.repository.clearCachedFeedback()
    const runDay = RunDay.empty(dateKey)
    runDay.clear()
    await this.eventBus.publish(runDay.pullDomainEvents())
  }
}
