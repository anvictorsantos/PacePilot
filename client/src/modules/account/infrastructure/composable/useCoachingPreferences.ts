import { computed, ref } from 'vue'

import type { CoachingPreferences } from '@/modules/account/infrastructure/dto/CoachingPreferences.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

// One shared state: Plan reads `explanations`, Settings writes all three.
const preferences = ref<CoachingPreferences | null>(null)
const loading = ref(false)
const saving = ref(false)
let pending: Promise<CoachingPreferences> | null = null
let generation = 0

/** Hard clear for the next account on this browser (logout). */
export function resetCoachingPreferences(): void {
  generation += 1
  preferences.value = null
  pending = null
}

export function useCoachingPreferences() {
  async function load(): Promise<CoachingPreferences | null> {
    if (pending) return pending
    if (preferences.value) return preferences.value
    loading.value = true
    const readGeneration = generation
    pending = api.account
      .preferences()
      .then((value) => {
        if (readGeneration === generation) preferences.value = value
        return value
      })
      .catch((error) => {
        recordRecoveredError(error, { feature: 'coaching', operation: 'preferences' })
        throw error
      })
      .finally(() => {
        loading.value = false
        pending = null
      })
    return pending
  }

  /** Optimistic: the switch moves now, reverts if the write fails. */
  async function save(patch: Partial<CoachingPreferences>): Promise<CoachingPreferences | null> {
    const previous = preferences.value
    if (previous) preferences.value = { ...previous, ...patch }
    saving.value = true
    try {
      const value = await api.account.savePreferences(patch)
      preferences.value = value
      return value
    } catch (error) {
      preferences.value = previous
      recordRecoveredError(error, { feature: 'coaching', operation: 'preferences.save' })
      throw error
    } finally {
      saving.value = false
    }
  }

  return {
    preferences: computed(() => preferences.value),
    explanationsEnabled: computed(() => preferences.value?.explanations !== false),
    loading: computed(() => loading.value),
    saving: computed(() => saving.value),
    load,
    save,
  }
}
