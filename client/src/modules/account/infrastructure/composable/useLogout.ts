import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { clearRunDayCache } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api, apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'
import { useSession } from '@/modules/strava/infrastructure/composable/useSession.ts'

/**
 * End the session without revoking the Strava grant: the athlete keeps their
 * slot and only has to log in again. Settings owns the real disconnect.
 */
export function useLogout() {
  const router = useRouter()
  const { t } = useI18n()
  const { show: showToast } = useToast()
  const { clearUser } = useCurrentUser()
  const { setConnected } = useSession()
  const loggingOut = ref(false)

  async function logout(): Promise<void> {
    if (loggingOut.value) return
    loggingOut.value = true
    try {
      await api.strava.logout()
      setConnected(false)
      clearUser()
      clearRunDayCache()
      resetResource(RESOURCE_KEYS.waitlistCapacity)
      await router.replace('/login')
    } catch (error) {
      showToast(apiErrorMessage(error, t('shell.logoutFailed')), { type: ToastType.Error })
    } finally {
      loggingOut.value = false
    }
  }

  return { loggingOut, logout }
}
