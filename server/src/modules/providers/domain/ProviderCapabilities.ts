/**
 * What a provider can do. The application and the UI read these flags instead
 * of assuming Strava's pull model: Garmin Health pushes activities and offers no
 * list endpoint, so `pull: false` must be a first-class, supported shape.
 */
export interface ProviderCapabilities {
  /** The provider can list activities on demand (a "Sync now" button). */
  pull: boolean
  /** The provider delivers activities to a webhook. */
  webhook: boolean
  /** Detailed samples for the pace/HR chart and the route map. */
  streams: boolean
  /** Per-lap splits. */
  laps: boolean
  /** Segment achievements / trophies. */
  segments: boolean
  /** Heart-rate zones usable for target HR. */
  zones: boolean
  /** An athlete profile (name, avatar, badges). */
  profile: boolean
}

/** Metadata the client renders — no provider-specific copy or logic in a view. */
export interface ProviderDescriptor {
  id: string
  /** Catalogue key under `providers.<id>` for the brand name. */
  labelKey: string
  /** `oauth` today; a push-only provider may add `webhook` later. */
  authKind: 'oauth'
  capabilities: ProviderCapabilities
  /** Asset origins the provider's avatars load from, for the CSP. */
  imageOrigins: string[]
}
