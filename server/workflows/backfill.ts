import { task, type TaskContext } from '@renderinc/sdk/workflows'

import {
  runBackfillStep,
  type BackfillProgress,
} from '@/modules/providers/application/backfill.service.ts'
import { drainBackfill } from '@/modules/providers/application/drain-backfill.ts'

const PAGE_RETRY = {
  maxRetries: 3,
  waitDurationMs: 5000,
  backoffScaling: 2,
}

const HISTORY_RETRY = {
  maxRetries: 1,
  waitDurationMs: 10000,
  backoffScaling: 2,
}

export function registerBackfillTasks(): void {
  const backfillPage = task(
    { name: 'backfillPage', retry: PAGE_RETRY, timeoutSeconds: 120 },
    async (_ctx: TaskContext, athleteId: string, providerId: string): Promise<BackfillProgress> =>
      runBackfillStep({ athleteId, providerId }),
  )

  task(
    { name: 'backfillHistory', retry: HISTORY_RETRY, timeoutSeconds: 1800 },
    async (ctx: TaskContext, athleteId: string, providerId: string) => {
      const result = await drainBackfill(() => ctx.run(backfillPage, athleteId, providerId))
      console.log(
        `[backfill] status=${result.progress.status} steps=${result.steps} imported=${result.progress.imported} skipped=${result.progress.skipped}`,
      )
      return result
    },
  )
}
