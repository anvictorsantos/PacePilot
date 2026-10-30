/**
 * The registry is the only place an adapter is named. Routes resolve a provider
 * id here; the client reads the descriptors here; CSP image origins come from
 * here. Adding a provider is one registration.
 */
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import type { ActivityProvider } from '@/modules/providers/domain/ports/ActivityProvider.ts'
import type { ProviderDescriptor } from '@/modules/providers/domain/ProviderCapabilities.ts'
import { Provider, isProvider } from '@/modules/providers/domain/Provider.ts'
import { ProviderError } from '@/modules/providers/domain/errors.ts'
import { createStravaProvider } from '@/modules/providers/infrastructure/providers/strava/StravaProvider.ts'

const adapters = new Map<string, ActivityProvider>()

const IMAGE_ORIGINS: Record<string, string[]> = {
  [Provider.Strava]: ['https://dgalywyr863hv.cloudfront.net'],
}

export function registerProvider(provider: ActivityProvider): void {
  adapters.set(provider.id, provider)
}

export function registerDefaultProviders(): void {
  registerProvider(
    createStravaProvider({
      clientId: env.stravaClientId,
      clientSecret: env.stravaClientSecret,
      redirectUri: env.stravaRedirectUri,
      webhookVerifyToken: env.stravaWebhookVerifyToken,
      webhookSubscriptionId: env.stravaWebhookSubscriptionId,
    }),
  )
}

export function enabledProviderIds(): string[] {
  return env.providersEnabled.filter((id) => adapters.has(id))
}

export function getProvider(id: string): ActivityProvider {
  const provider = adapters.get(id)
  if (!provider || !enabledProviderIds().includes(id)) {
    throw new ProviderError(`Unknown or disabled provider: ${id}`, {
      status: 404,
      provider: id,
      code: 'unknown_provider',
    })
  }
  return provider
}

export function providerDescriptors(): ProviderDescriptor[] {
  return enabledProviderIds().map((id) => {
    const provider = adapters.get(id) as ActivityProvider
    return {
      id,
      labelKey: `providers.${id}`,
      authKind: 'oauth',
      capabilities: provider.capabilities,
      imageOrigins: IMAGE_ORIGINS[id] ?? [],
    }
  })
}

export function isEnabledProvider(value: unknown): value is string {
  return isProvider(value) && enabledProviderIds().includes(value)
}
