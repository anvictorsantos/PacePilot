import type { BackfillProgress } from '@/modules/providers/application/backfill.service.ts'

export const MAX_BACKFILL_STEPS = 60

export interface DrainResult {
  progress: BackfillProgress
  steps: number
  exhausted: boolean
}

export async function drainBackfill(
  runStep: () => Promise<BackfillProgress>,
  maxSteps = MAX_BACKFILL_STEPS,
): Promise<DrainResult> {
  let progress = await runStep()
  let steps = 1

  while (
    steps < maxSteps &&
    progress.hasMore &&
    progress.status !== 'complete' &&
    progress.status !== 'failed'
  ) {
    progress = await runStep()
    steps += 1
  }

  return {
    progress,
    steps,
    exhausted: !progress.hasMore || progress.status === 'complete' || progress.status === 'failed',
  }
}
