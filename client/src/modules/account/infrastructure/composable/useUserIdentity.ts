import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'

// Presentation identity for the session athlete: the fallback name and the
// avatar initials live here so every surface of the shell agrees.
export function useUserIdentity() {
  const { t } = useI18n()
  const { user: currentUser } = useCurrentUser()

  const fullName = computed(() => {
    const f = currentUser.value?.firstname || ''
    const l = currentUser.value?.lastname || ''
    const n = `${f} ${l}`.trim()
    return n || currentUser.value?.email || t('shell.athlete')
  })

  const initials = computed(() => {
    const f = currentUser.value?.firstname?.[0] || ''
    const l = currentUser.value?.lastname?.[0] || ''
    const fromName = (f + l).toUpperCase()
    if (fromName) return fromName
    const email = currentUser.value?.email || ''
    return email.slice(0, 1).toUpperCase() || 'A'
  })

  return { currentUser, fullName, initials }
}
