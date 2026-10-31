import { computed, ref } from 'vue'

import type { BackfillProgress } from '@/modules/connections/domain/repository/backfill.repository.ts'
import {
  BackfillStatus,
  isBackfillComplete,
  isBackfillRunning,
} from '@/modules/connections/domain/value-object/BackfillStatus.ts'
import { connectionsModule } from '@/modules/connections/infrastructure/container/connections-container.ts'

const progress = ref<BackfillProgress | null>(null)
const failure = ref<unknown>(null)
const walking = ref(false)

// Module scope, not component scope: the shell starts the walk and Settings
// renders it, and both must see the same progress. Nothing blocks a first paint.
export function useBackfill() {
  const status = computed(() => progress.value?.status ?? BackfillStatus.Idle)
  const imported = computed(() => progress.value?.imported ?? 0)
  const hasMore = computed(() => Boolean(progress.value?.hasMore))
  const complete = computed(() => isBackfillComplete(status.value))
  const busy = computed(() => walking.value || isBackfillRunning(status.value))
  // `pending` is queued on connect, not started: the button still reads "Import".
  const started = computed(
    () =>
      imported.value > 0 ||
      status.value === BackfillStatus.Paused ||
      status.value === BackfillStatus.Running ||
      status.value === BackfillStatus.Failed,
  )

  async function refresh(): Promise<void> {
    try {
      progress.value = await connectionsModule.backfill.status()
    } catch {
      // A status read is decoration; the card keeps its last known value.
    }
  }

  /** Start or resume. Never rejects: the card surfaces the failure. */
  async function resume(): Promise<void> {
    if (busy.value) return
    walking.value = true
    failure.value = null
    try {
      progress.value = await connectionsModule.backfill.run()
    } catch (error) {
      failure.value = error
      await refresh()
    } finally {
      walking.value = false
    }
  }

  async function stop(): Promise<void> {
    try {
      progress.value = await connectionsModule.backfill.stop()
    } catch (error) {
      failure.value = error
      await refresh()
    } finally {
      walking.value = false
    }
  }

  function clearFailure(): void {
    failure.value = null
  }

  return {
    status,
    imported,
    hasMore,
    complete,
    busy,
    started,
    failure,
    refresh,
    resume,
    stop,
    clearFailure,
  }
}
