import { Render } from '@renderinc/sdk'

import { env } from '@/modules/shared/infrastructure/config/env.ts'

const TASK = 'backfillHistory'

export function isHistoryWorkflowConfigured(): boolean {
  return Boolean(env.renderApiKey && env.workflowServiceSlug)
}

export async function startHistoryBackfill(
  athleteId: string,
  providerId: string,
): Promise<string | null> {
  if (!isHistoryWorkflowConfigured()) return null

  const render = new Render({ token: env.renderApiKey })
  const started = await render.workflows.startTask(
    `${env.workflowServiceSlug}/${TASK}`,
    [athleteId, providerId],
  )
  return started.taskRunId
}
