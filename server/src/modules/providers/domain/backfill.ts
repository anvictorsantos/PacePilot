/**
 * Historical import below the first-import cap. A first pull stops at
 * `MAX_SYNC_PAGES`; a windowed sync only looks back from the watermark. This
 * cursor fills the gap without breaking the quota either of them relies on.
 *
 * The rules are pure and the state is small on purpose:
 * - **bounded** — a floor (nothing older than retention keeps) and a page budget
 *   per step, so one request can never walk a decade of history;
 * - **resumable** — the cursor *is* the state, so a stop, a crash or a rate limit
 *   costs nothing: the next step continues below the oldest row already seen;
 * - **idempotent** — the cursor only ever moves backwards, and the writer upserts
 *   by `{provider, external id}`, so a re-run cannot duplicate a row.
 */
export const BACKFILL_STATUSES = ['idle', 'pending', 'running', 'paused', 'complete', 'failed'] as const
export type BackfillStatus = (typeof BACKFILL_STATUSES)[number]

/** Provider page size for the historical walk. */
export const BACKFILL_PER_PAGE = 50
/** Pages per request: bounds quota burn and request time, like `MAX_SYNC_PAGES`. */
export const BACKFILL_PAGES_PER_STEP = 3
/** A step that stopped updating for this long is dead; the cursor frees itself. */
export const BACKFILL_STALE_MS = 2 * 60 * 1000
/** `before` is exclusive; step 1s so a page ending on the cursor still makes progress. */
const CURSOR_STEP_MS = 1000
const DAY_MS = 86400000

export interface BackfillError {
  code: string
  at: Date
  retryAfter?: number | null
}

export interface BackfillState {
  status: BackfillStatus
  /** Exclusive upper bound of the next provider page. */
  cursorBefore: Date | null
  /** Oldest instant worth importing; anything older is past retention. */
  floor: Date | null
  pagesDone: number
  imported: number
  skipped: number
  requestedAt: Date | null
  /** Last time a step touched this state; the stale-claim clock. */
  updatedAt: Date | null
  error: BackfillError | null
}

export function emptyBackfill(): BackfillState {
  return {
    status: 'idle',
    cursorBefore: null,
    floor: null,
    pagesDone: 0,
    imported: 0,
    skipped: 0,
    requestedAt: null,
    updatedAt: null,
    error: null,
  }
}

/**
 * Queue a backfill behind the oldest activity the account already holds. When
 * that is already older than the floor there is nothing to fetch, so the state
 * is `complete` and no provider call is made.
 */
export function planBackfillStart({
  now,
  oldestActivityAt,
  windowDays,
}: {
  now: Date
  oldestActivityAt: Date | null
  /** How far back to reach, in days. The caller owns retention, not this rule. */
  windowDays: number
}): BackfillState {
  const floor = new Date(now.getTime() - windowDays * DAY_MS)
  const cursorBefore = oldestActivityAt ?? now
  const base: BackfillState = {
    ...emptyBackfill(),
    cursorBefore,
    floor,
    requestedAt: now,
    updatedAt: now,
  }
  return cursorBefore.getTime() <= floor.getTime()
    ? { ...base, status: 'complete' }
    : { ...base, status: 'pending' }
}

/** A step may claim the cursor only when no live step holds it. */
export function isBackfillRunnable(state: BackfillState, now: Date): boolean {
  switch (state.status) {
    case 'pending':
    case 'paused':
      return true
    case 'failed':
      // The provider asked us to wait: a 429 hint is a floor, not decoration.
      return !state.error?.at || now.getTime() >= retryNotBefore(state.error)
    case 'running':
      return Boolean(state.updatedAt) && now.getTime() - state.updatedAt!.getTime() >= BACKFILL_STALE_MS
    default:
      return false
  }
}

/** When a failed walk is allowed to try the provider again, epoch milliseconds. */
function retryNotBefore(error: BackfillError): number {
  const at = error.at.getTime()
  return error.retryAfter && error.retryAfter > 0 ? at + error.retryAfter * 1000 : at
}

/** Claim the cursor for one bounded step; a completed run stays completed. */
export function beginBackfillStep(state: BackfillState, now: Date = new Date()): BackfillState {
  if (!isBackfillRunnable(state, now)) return state
  return {
    ...state,
    status: 'running',
    error: null,
    requestedAt: state.requestedAt ?? now,
    updatedAt: now,
  }
}

/** What to fetch next, or `null` when the range is covered. */
export function nextBackfillRequest(state: BackfillState): { before: Date; perPage: number } | null {
  if (!state.cursorBefore || !state.floor) return null
  if (state.status === 'complete') return null
  if (state.cursorBefore.getTime() <= state.floor.getTime()) return null
  return { before: state.cursorBefore, perPage: BACKFILL_PER_PAGE }
}

/**
 * Fold one fetched page into the cursor. `fetched` is what the provider
 * returned, `oldest` the oldest `startedAt` in it.
 */
export function advanceBackfill(
  state: BackfillState,
  {
    fetched,
    oldest,
    exhausted = false,
    now,
  }: { fetched: number; oldest: Date | null; exhausted?: boolean; now: Date },
): BackfillState {
  if (state.status !== 'running') return state

  if (fetched === 0 || !oldest) {
    return { ...state, status: 'complete', updatedAt: now }
  }

  // Never let a provider that ignores `before` trap the walk on one page.
  const candidate = oldest.getTime() - CURSOR_STEP_MS
  const previous = state.cursorBefore ? state.cursorBefore.getTime() - CURSOR_STEP_MS : candidate
  const cursorBefore = new Date(Math.min(candidate, previous))
  const pagesDone = state.pagesDone + 1

  // A short page means the history ends here: one more call would return nothing.
  if (exhausted || !state.floor || cursorBefore.getTime() <= state.floor.getTime()) {
    return { ...state, cursorBefore, pagesDone, status: 'complete', updatedAt: now }
  }

  return {
    ...state,
    cursorBefore,
    pagesDone,
    // The page budget is a pause, not an end: the cursor is ready for the next call.
    status: pagesDone >= BACKFILL_PAGES_PER_STEP ? 'paused' : 'running',
    updatedAt: now,
  }
}

/** The athlete stopped it, or a manual sync took the provider. Cursor intact. */
export function pauseBackfill(state: BackfillState, now: Date = new Date()): BackfillState {
  if (state.status !== 'running' && state.status !== 'pending') return state
  return { ...state, status: 'paused', updatedAt: now }
}

/** Provider refused (quota, network): keep the cursor, record why, stay resumable. */
export function failBackfill(
  state: BackfillState,
  { code, now, retryAfter = null }: { code: string; now: Date; retryAfter?: number | null },
): BackfillState {
  if (state.status === 'complete') return state
  return {
    ...state,
    status: 'failed',
    error: { code, at: now, retryAfter },
    updatedAt: now,
  }
}
