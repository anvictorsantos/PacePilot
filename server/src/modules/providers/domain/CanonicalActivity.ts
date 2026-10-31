// Every adapter translates its wire format into this shape, so the activity domain
// never learns a provider's field names. Units live in the field name on purpose.
import type { Sport } from '@/modules/activities/domain/value-object/Sport.ts'

export interface CanonicalLap {
  distanceM: number | null
  movingTimeS: number | null
  elapsedTimeS: number | null
  avgSpeedMps: number | null
  avgHr: number | null
  elevationM: number | null
}

export interface CanonicalStreams {
  time?: Array<number | null>
  distance?: Array<number | null>
  velocity_smooth?: Array<number | null>
  heartrate?: Array<number | null>
  latlng?: Array<[number, number] | null>
}

export interface CanonicalTrophy {
  segment: string
  rank: number
  type: string
  typeId: number | null
  time: number | null
  label: string
}

export interface CanonicalActivity {
  /** Stable id inside the provider. Unique together with the provider. */
  externalId: string
  startedAt: Date
  /** The provider's own label, kept for tracing only. */
  rawSport: string
  sport: Sport
  distanceM: number
  movingTimeS: number
  elapsedTimeS: number
  avgSpeedMps: number | null
  maxSpeedMps: number | null
  elevationM: number
  avgHr: number | null
  maxHr: number | null
  avgCadenceSpm: number | null
  hasHr: boolean
  calories: number | null
  achievementCount: number
  prCount: number
  laps?: CanonicalLap[]
  trophies?: CanonicalTrophy[]
  streams?: CanonicalStreams
  /** Provider payload, stored trimmed for debugging and never sent to a client. */
  raw: unknown
}

export interface CanonicalActivityPage {
  items: CanonicalActivity[]
  hasMore: boolean
}

export interface CanonicalZone {
  min: number
  max: number
}

/** Ordered low → high; the first entry is the easiest zone. */
export type CanonicalZones = CanonicalZone[]

export interface CanonicalAthlete {
  externalAthleteId: string
  firstname?: string | null
  lastname?: string | null
  profile?: string | null
  badges?: unknown
  badgeTypeId?: number | null
}
