import type { CurrentUser } from '@/modules/account/infrastructure/dto/CurrentUser.ts'
import { useResource, resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

// The athlete behind the session. Read through the Resource module: the header
// and Settings share one request instead of each fetching `/me`.
const KEY = 'account.current'

export function useCurrentUser() {
  const {
    data: user,
    loading,
    error,
    settled,
    reload,
  } = useResource<CurrentUser | null>(KEY, () => api.account.current(), { immediate: false })

  async function fetchUser(force = false): Promise<CurrentUser | null> {
    // a failed read is worth retrying; a settled one is not
    if (settled.value && !force && !error.value) return user.value
    await reload(force)
    return user.value
  }

  function clearUser(): void {
    // The hard clear empties the mounted readers in place — the header and the
    // menu label included — so no local write is needed on top of it.
    resetResource(KEY)
  }

  return { user, loading, fetchUser, clearUser }
}
