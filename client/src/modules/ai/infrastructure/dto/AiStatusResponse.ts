/** `GET /api/plan/ai/status` — free-tier health of the configured model. */
export interface AiStatusResponse {
  enabled?: boolean
  configured?: boolean
  model?: string
  fallbackModel?: string | null
  modelStillFree?: boolean | null
  freeModels?: Array<{ id: string; supportsJsonMode: boolean }> | null
  catalogError?: string | null
}
