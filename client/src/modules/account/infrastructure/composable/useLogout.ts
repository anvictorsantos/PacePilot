import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { clearRunDayCache } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

// Ends the session without revoking the Strava grant; Settings owns the real disconnect.
// No `setConnected(false)`: the grant still exists, and the hard clear below drops the entry.
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
