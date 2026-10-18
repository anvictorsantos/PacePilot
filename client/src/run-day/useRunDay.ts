/**
 * Run-Day module — the single owner of "did today's run happen".
 *
 * Two surfaces derived that answer independently from three sources (server
 * Feedback, Strava Activity, and a `feedback:<date>` localStorage triple), and
 * the copies disagreed: one keyed the day with UTC `toISOString().slice(0, 10)`
 * while the plan keys it locally, so the answer flipped at midnight in any
 * non-UTC timezone (CONTEXT.md §Week Alignment). A third wrote those cache keys
 * by hand (the account-erasure path), and a fourth read the same activities
 * endpoint with its own unwrap.
 *
 * One interface now serves every caller: `completed`, `activity`, the `feedback`
 * form fields, `submitFeedback()` and the cache lifecycle. The date key, the
 * three sources, the localStorage schema and the submit path are implementation.
 *
 * State is a module-level singleton so a future consumer (header, a "next up"
 * card) reads the same truth instead of re-deriving it. Nothing here
 * auto-fetches: callers opt in with `refreshRunDay()`.
 */
import { ref } from 'vue'

import { useToast } from '@/composables/useToast.ts'
import { ToastType } from '@/composables/useToast.ts'
import { i18n } from '@/i18n'
import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import {
  FeedbackStatus,
  toFeedbackStatus,
} from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import type { PlanFeedback } from '@/modules/feedback/infrastructure/dto/PlanFeedback.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'
import { api, apiErrorMessage } from '@/services/client.ts'
import { recordRecoveredError } from '@/services/logger.ts'

const CACHE_PREFIX = 'feedback:'

function cacheKeys(date: string) {
  return {
    mark: `${CACHE_PREFIX}${date}`,
    status: `${CACHE_PREFIX}${date}:status`,
    data: `${CACHE_PREFIX}${date}:data`,
  }
}

const todayKey = ref(LocalDateKey.today().value)
const completed = ref(false)
const activity = ref<Activity | null>(null)
const feedbackSaved = ref(false)
const rpe = ref<number | null>(null)
const note = ref('')
const status = ref<FeedbackStatus>(FeedbackStatus.Completed)
const submitting = ref(false)

let loaded = false
let pending: Promise<void> | null = null

/** Read the local cache for `date`; `null` when nothing was logged. */
function readCache(date: string): {
  status: FeedbackStatus
  rpe: number | null
  note: string
} | null {
  try {
    const { mark, status: statusKey, data } = cacheKeys(date)
    if (!localStorage.getItem(mark)) return null
    const parsed = JSON.parse(localStorage.getItem(data) || '{}')
    return {
      status: toFeedbackStatus(localStorage.getItem(statusKey)) ?? FeedbackStatus.Completed,
      rpe: parsed.rpe ?? null,
      note: parsed.note ?? '',
    }
  } catch (error) {
    recordRecoveredError(error)
    return null
  }
}

function writeCache(
  date: string,
  feedback: { rpe: number | null; note: string; status: FeedbackStatus },
) {
  try {
    const { mark, status: statusKey, data } = cacheKeys(date)
    localStorage.setItem(mark, '1')
    localStorage.setItem(statusKey, feedback.status)
    localStorage.setItem(data, JSON.stringify(feedback))
  } catch (error) {
    recordRecoveredError(error)
  }
}

/** Drop every cached run-day entry — the account-erasure path in Settings. */
export function clearRunDayCache(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    recordRecoveredError(error)
  }
  completed.value = false
  activity.value = null
  feedbackSaved.value = false
  rpe.value = null
  note.value = ''
  status.value = FeedbackStatus.Completed
}

function hydrateFromCache(): void {
  todayKey.value = LocalDateKey.today().value
  const cached = readCache(todayKey.value)
  if (!cached) return
  feedbackSaved.value = true
  rpe.value = cached.rpe
  note.value = cached.note
  status.value = cached.status
  // cache is the optimistic fast path; the server read below is authoritative
  completed.value = cached.status === FeedbackStatus.Completed
}

// Hydrate at import so the first paint never flashes "TODAY'S WORKOUT" before
// switching to the completed state.
hydrateFromCache()

async function findTodayActivity(): Promise<Activity | null> {
  try {
    const data = await api.activities.list({ perPage: 10 })
    const items = data.items || []
    return (
      items.find((a) => LocalDateKey.from(a.date || a.start_date).value === todayKey.value) || null
    )
  } catch (error) {
    recordRecoveredError(error)
    return null
  }
}

function feedbackForToday(entries: PlanFeedback[] | null | undefined): PlanFeedback | null {
  if (!Array.isArray(entries)) return null
  return entries.find((entry) => LocalDateKey.from(entry.date).value === todayKey.value) || null
}

/**
 * Resolve today's state from all three sources, most authoritative first:
 * explicit Feedback, then a Strava Activity for today, then the local cache.
 */
export function refreshRunDay(force = false): Promise<void> {
  if (loaded && !force) return Promise.resolve()
  if (pending) return pending

  hydrateFromCache()

  pending = (async () => {
    let serverFeedback: PlanFeedback | null = null
    try {
      serverFeedback = feedbackForToday(await api.plan.feedback())
    } catch (error) {
      recordRecoveredError(error)
    }

    if (serverFeedback) {
      feedbackSaved.value = true
      rpe.value = serverFeedback.rpe ?? rpe.value
      note.value = serverFeedback.notes ?? serverFeedback.note ?? note.value
      status.value = toFeedbackStatus(serverFeedback.status) ?? status.value
      writeCache(todayKey.value, {
        rpe: serverFeedback.rpe ?? rpe.value,
        note: note.value,
        status: status.value,
      })
      if (status.value === FeedbackStatus.Completed) completed.value = true
    }

    const today = await findTodayActivity()
    activity.value = today
    if (today) completed.value = true

    loaded = true
    pending = null
  })()

  return pending
}

/** Whether the athlete already logged a `note`/`rpe`/`status` for today. */
export function useRunDay() {
  return {
    /** Local `YYYY-MM-DD` — never UTC (CONTEXT.md §Week Alignment). */
    todayKey,
    /** True once explicit Feedback, a Strava Activity, or the cache says so. */
    completed,
    /** Today's Strava run, when one exists. */
    activity,
    /** True when a Feedback entry exists for today — locks the form (view-only). */
    feedbackSaved,
    rpe,
    note,
    status,
    submitting,
    refresh: refreshRunDay,
    submitFeedback: submitRunDayFeedback,
  }
}

/** Validate, POST and cache the athlete's Feedback for today. */
export async function submitRunDayFeedback(): Promise<boolean> {
  if (feedbackSaved.value) return false
  const { show: showToast } = useToast()
  const t = i18n.global.t

  if (!rpe.value && status.value !== 'skipped') {
    showToast(t('landing.sections.today.validation.rpeRequired'), { type: ToastType.Warning })
    return false
  }

  submitting.value = true
  const date = LocalDateKey.today().value
  try {
    await api.plan.submitFeedback({
      date,
      rpe: rpe.value,
      note: note.value,
      status: status.value,
    })
    writeCache(date, { rpe: rpe.value, note: note.value, status: status.value })
    feedbackSaved.value = true
    showToast(t('landing.sections.today.toast.feedbackSaved'), { type: ToastType.Success })
    if (status.value === 'completed') completed.value = true
    return true
  } catch (error) {
    showToast(apiErrorMessage(error, t('landing.sections.today.toast.saveFailed')), {
      type: ToastType.Error,
    })
    return false
  } finally {
    submitting.value = false
  }
}
