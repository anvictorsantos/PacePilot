/** `GET /api/providers` — what the client may render, driven by the server. */
export interface ProviderCapabilities {
  pull: boolean
  webhook: boolean
  streams: boolean
  laps: boolean
  segments: boolean
  zones: boolean
  profile: boolean
}

export interface ProviderDescriptor {
  id: string
  labelKey: string
  authKind: 'oauth'
  capabilities: ProviderCapabilities
  imageOrigins: string[]
}

export interface ProviderListResponse {
  providers: ProviderDescriptor[]
}
