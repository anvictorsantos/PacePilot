/** `GET/POST /api/providers/:provider/backfill` — how far the walk has got. */
export interface BackfillProgressDto {
  status?: string | null
  imported?: number | null
  skipped?: number | null
  pagesDone?: number | null
  hasMore?: boolean | null
  error?: {
    code?: string | null
    retryAfter?: number | null
  } | null
}
