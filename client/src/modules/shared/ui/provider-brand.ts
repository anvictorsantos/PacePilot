/**
 * Provider presentation only: the icon and colour a source is drawn with. No
 * rule, capability or route lives here — that comes from `GET /api/providers`.
 */

import LinkIcon from '@/components/icons/LinkIcon.vue'
import StravaIcon from '@/components/icons/StravaIcon.vue'

import type { Component } from 'vue'

interface ProviderBrand {
  icon: Component
  iconClass: string
  buttonClass: string
  iconTileClass: string
}

const BRANDS: Record<string, ProviderBrand> = {
  strava: {
    icon: StravaIcon,
    iconClass: 'text-white',
    buttonClass: 'bg-strava hover:brightness-110',
    iconTileClass: 'bg-strava/15 text-strava',
  },
}

const FALLBACK: ProviderBrand = {
  icon: LinkIcon,
  iconClass: 'text-white',
  buttonClass: 'bg-primary hover:brightness-110',
  iconTileClass: 'bg-primary/15 text-primary',
}

export function providerBrand(id: string): ProviderBrand {
  return BRANDS[id] ?? FALLBACK
}
