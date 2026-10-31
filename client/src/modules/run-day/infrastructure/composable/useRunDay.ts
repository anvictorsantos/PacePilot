// Vue projection over the run-day use cases: every rule about today lives in
// `modules/run-day/`; this file only mirrors it and calls the use cases.
import { computed, ref } from 'vue'

import { i18n } from '@/i18n'
import {
  type ActivityKind,
  isCrossTrainingKind,
  toActivityKind,
} from '@/modules/activities/domain/value-object/ActivityKind.ts'
import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'
import type { RunDaySnapshot } from '@/modules/run-day/application/use-case/RefreshRunDay.ts'
import { RunDay } from '@/modules/run-day/domain/entity/RunDay.ts'
import {
  readCachedRunDay,
  runDayModule,
} from '@/modules/run-day/infrastructure/container/run-day-container.ts'
import { LocalDateKey } from '@/modules/shared/domain/value-object/LocalDateKey.ts'
import { apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

const todayKey = ref(LocalDateKey.today().value)
const completed = ref(false)
const activity = ref<Activity | null>(null)
const activityKind = ref<ActivityKind | null>(null)
const feedbackSaved = ref(false)
const rpe = ref<number | null>(null)
const note = ref('')
const status = ref<FeedbackStatus>(FeedbackStatus.Completed)
const submitting = ref(false)

let loaded = false
let pending: Promise<void> | null = null

function applySnapshot(snapshot: RunDaySnapshot): void {
  // A completed day keeps the card it already showed when a re-read comes back empty:
  // sync lag, a failed read, or a run that moved out of the recent page must not hide it.
  const sameDay = todayKey.value === snapshot.primitives.dateKey
  const keepCard = sameDay && completed.value && !snapshot.activity

  todayKey.value = snapshot.primitives.dateKey
  completed.value = snapshot.primitives.completed
  if (!keepCard) {
    activity.value = snapshot.activity
    activityKind.value = toActivityKind(snapshot.primitives.activityKind)
  }
  feedbackSaved.value = snapshot.primitives.feedbackSaved
  rpe.value = snapshot.primitives.rpe
  note.value = snapshot.primitives.note
  status.value = snapshot.primitives.status as FeedbackStatus
}

function resetLocalState(): void {
  completed.value = false
  activity.value = null
  activityKind.value = null
  feedbackSaved.value = false
  rpe.value = null
  note.value = ''
  status.value = FeedbackStatus.Completed
}

/** Hydrate at import so the first paint never flashes "TODAY'S WORKOUT". */
function applyCached(): void {
  todayKey.value = LocalDateKey.today().value
  const cached = readCachedRunDay()
  if (!cached) return
  feedbackSaved.value = true
  rpe.value = cached.rpe
  note.value = cached.note
  status.value = cached.status
  completed.value = cached.status === FeedbackStatus.Completed
}

applyCached()

/** Resolve today from all three sources; one read per page load unless forced. */
export function refreshRunDay(force = false): Promise<void> {
  if (loaded && !force) return Promise.resolve()
  if (pending) return pending

  pending = (async () => {
    try {
      applySnapshot(await runDayModule.refresh.execute(LocalDateKey.today()))
    } catch (error) {
      recordRecoveredError(error, { feature: 'run-day', operation: 'refresh' })
    } finally {
      loaded = true
      pending = null
    }
  })()

  return pending
}

/** Drop every cached entry — the account-erasure path. */
export function clearRunDayCache(): void {
  resetLocalState()
  loaded = false
  runDayModule.clear
    .execute()
    .catch((error) => recordRecoveredError(error, { feature: 'run-day', operation: 'clear' }))
}

/** Failures surface as toasts here; the success announcement comes from the subscriber. */
export async function submitRunDayFeedback(): Promise<boolean> {
  if (feedbackSaved.value) return false
  const t = i18n.global.t
  const { show: showToast } = useToast()

  const runDay = RunDay.fromPrimitives({
    dateKey: todayKey.value,
    completed: completed.value,
    activityId: activity.value
      ? String(activity.value.id ?? activity.value.provider_activity_id ?? '') || null
      : null,
    activityKind: activityKind.value,
    feedbackSaved: feedbackSaved.value,
    rpe: rpe.value,
    note: note.value,
    status: status.value,
  })

  submitting.value = true
  try {
    const result = await runDayModule.submit.execute(
      runDay,
      { rpe: rpe.value, note: note.value, status: status.value },
      (error) => apiErrorMessage(error, t('landing.sections.today.toast.saveFailed')),
    )

    if (result.ok) {
      feedbackSaved.value = true
      if (status.value === FeedbackStatus.Completed) {
        completed.value = true
        await refreshRunDay(true)
      }
      return true
    }

    if (result.reason === 'rpe-required') {
      showToast(t('landing.sections.today.validation.rpeRequired'), { type: ToastType.Warning })
    } else if (result.reason === 'failed') {
      showToast(result.message ?? t('landing.sections.today.toast.saveFailed'), {
        type: ToastType.Error,
      })
    }
    return false
  } finally {
    submitting.value = false
  }
}

export function useRunDay() {
  return {
    /** Local `YYYY-MM-DD` — never UTC (CONTEXT.md §Week Alignment). */
    todayKey,
    /** True once explicit Feedback, a synced activity, or the cache says so. */
    completed,
    /** Today's synced session, when one exists: a run, or cross-training. */
    activity,
    /** The family behind `activity`; `null` until a session completes the day. */
    activityKind,
    /** The day was completed by cross-training, so no run Feedback applies. */
    crossTraining: computed(() => isCrossTrainingKind(activityKind.value)),
    /** A saved Feedback locks today's form to view-only. */
    feedbackSaved,
    rpe,
    note,
    status,
    submitting,
    refresh: refreshRunDay,
    submitFeedback: submitRunDayFeedback,
  }
}
