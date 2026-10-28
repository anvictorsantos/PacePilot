import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { clearRunDayCache } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

/**
 * End the account session without revoking the Strava grant: the athlete keeps
 * their slot and only has to sign in again. Settings owns the real disconnect.
 *
 * No `setConnected(false)` here: the grant still exists, so writing "not
 * connected" and then firing an unauthenticated status read would be a guess with
 * nobody to read the answer. The hard clear below drops that entry anyway.
 */
export function useLogout() {
  const router = useRouter()
  const { t } = useI18n()
  const { show: showToast } = useToast()
  const { logout: endSession } = useAuth()
  const loggingOut = ref(false)

  async function logout(): Promise<void> {
    if (loggingOut.value) return
    loggingOut.value = true
    try {
      await endSession()
      clearRunDayCache()
      // A hard clear, not an invalidation: nothing may survive for the next
      // account on this browser.
      resetResource()
      await router.replace('/login')
    } catch (error) {
      showToast(apiErrorMessage(error, t('shell.logoutFailed')), { type: ToastType.Error })
    } finally {
      loggingOut.value = false
    }
  }

  return { loggingOut, logout }
}
