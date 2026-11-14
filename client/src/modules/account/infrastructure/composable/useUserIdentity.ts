import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import type { CurrentUser } from '@/modules/account/infrastructure/dto/CurrentUser.ts'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'

/** `/me` is a one-shot probe; the session read that gates every route carries the
 *  same athlete. A probe that never answers must not blank the name or the photo. */
export function identityFrom(
  accountUser: CurrentUser | null | undefined,
  sessionUser: CurrentUser | null | undefined,
): CurrentUser | null {
  return accountUser ?? sessionUser ?? null
}

export function useUserIdentity() {
  const { t } = useI18n()
  const { user: accountUser } = useCurrentUser()
  const { user: sessionUser } = useAuth()
  const currentUser = computed(() => identityFrom(accountUser.value, sessionUser.value))

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
