import type { ProviderDescriptor } from '@/modules/connections/infrastructure/dto/ProviderDescriptor.ts'
import { useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import { RESOURCE_KEYS } from '@/modules/shared/infrastructure/resource-keys.ts'

// Enabled sources are server truth: the UI never hardcodes which provider exists
// or what it can do. Cached per page load like every other read.
export function useProviders() {
  const { data, settled, loading, reload } = useResource<{ providers: ProviderDescriptor[] }>(
    RESOURCE_KEYS.providers,
    () => api.providers.list(),
  )

  return {
    providers: data,
    settled,
    loading,
    reload,
  }
}
