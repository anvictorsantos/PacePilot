/**
 * Connection use cases — OAuth exchange, token refresh, status, revoke and the
 * capacity count. This is the only module that touches ciphertext or a
 * provider's token endpoints.
 *
 * Reads fall back to the legacy `Athlete` columns for one release, so a
 * deployment that has not run the migration yet still behaves exactly as before.
 */
import mongoose from 'mongoose'

import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { Activity } from '@/modules/activities/infrastructure/persistence/Activity.ts'
import { WorkoutFeedback } from '@/modules/training/infrastructure/persistence/WorkoutFeedback.ts'
import { clearAiCacheForAthlete } from '@/modules/ai/application/quota-cache.ts'
import { decryptToken, encryptToken } from '@/modules/shared/infrastructure/utils/tokenCrypto.ts'
import { Provider } from '@/modules/providers/domain/Provider.ts'
import type { CanonicalZones } from '@/modules/providers/domain/CanonicalActivity.ts'
import { ProviderAuthError } from '@/modules/providers/domain/errors.ts'
import {
  Connection,
  CONNECTED_CONNECTION_FILTER,
} from '@/modules/providers/infrastructure/persistence/Connection.ts'
import { enabledProviderIds, getProvider } from '@/modules/providers/application/provider-registry.ts'
import { env } from '@/modules/shared/infrastructure/config/env.ts'

/** The fields this service needs from a connection, legacy or persisted. */
export interface ConnectionLike {
  _id?: unknown
  athlete?: unknown
  provider: string
  external_athlete_id: string
  firstname?: string | null
  lastname?: string | null
  profile?: string | null
  badge_type_id?: number | null
  badges?: unknown
  access_token?: string | null
  refresh_token?: string | null
  expires_at?: Date | number | null
  scopes?: string[]
  zones?: CanonicalZones
  last_synced_at?: Date | string | null
  disconnected_at?: Date | null
}

export interface ConnectionStatus {
  provider: string
  connected: boolean
  last_synced_at: string | null
}

function idOf(value: unknown): string | null {
  if (!value) return null
  return String(value)
}

/** Translate the legacy `Athlete.zones` payload at the boundary, once. */
export function zonesFromLegacy(raw: unknown): CanonicalZones {
  if (!raw || typeof raw !== 'object') return []
  const groups = Array.isArray(raw) ? raw : null
  const heartRate =
    (raw as { heart_rate?: { zones?: unknown } }).heart_rate?.zones ??
    groups?.find((group) => (group as { type?: unknown }).type === 'heartrate')?.zones ??
    (Array.isArray((raw as { zones?: unknown }).zones) ? (raw as { zones?: unknown }).zones : null)
  if (!Array.isArray(heartRate)) return []
  return heartRate
    .map((zone) => {
      const entry = zone as { min?: unknown; max?: unknown }
      return { min: Number(entry.min), max: Number(entry.max) }
    })
    .filter((zone) => Number.isFinite(zone.min) && Number.isFinite(zone.max))
}

function legacyConnection(athlete: Record<string, unknown>, provider: string): ConnectionLike | null {
  if (provider !== Provider.Strava) return null
  if (!athlete.access_token || !athlete.strava_athlete_id) return null
  return {
    athlete: athlete._id,
    provider: Provider.Strava,
    external_athlete_id: String(athlete.strava_athlete_id),
    firstname: (athlete.firstname as string | null) ?? null,
    lastname: (athlete.lastname as string | null) ?? null,
    profile: (athlete.profile as string | null) ?? null,
    badge_type_id: (athlete.badge_type_id as number | null) ?? null,
    badges: athlete.badges,
    access_token: athlete.access_token as string,
    refresh_token: (athlete.refresh_token as string | null) ?? null,
    expires_at: (athlete.expires_at as number | null) ?? null,
    scopes: (athlete.scopes as string[] | undefined) ?? [],
    zones: zonesFromLegacy(athlete.zones),
    last_synced_at: (athlete.last_synced_at as Date | null) ?? null,
    disconnected_at: (athlete.disconnected_at as Date | null) ?? null,
  }
}

/**
 * Load a connection for an athlete. The legacy fallback keeps pre-migration
 * accounts connected; the migration script is still the intended end state.
 */
export async function getConnection(
  athleteId: string,
  provider: string,
  { withCredentials = false }: { withCredentials?: boolean } = {},
): Promise<ConnectionLike | null> {
  if (!mongoose.isValidObjectId(athleteId) || mongoose.connection.readyState !== 1) return null
  const connection = await Connection.findOne({ athlete: athleteId, provider }).lean()
  if (connection) {
    return withCredentials
      ? (connection as ConnectionLike)
      : ({ ...connection, access_token: null, refresh_token: null } as ConnectionLike)
  }
  const query = Athlete.findById(athleteId)
  const athlete = await (withCredentials
    ? query
    : query.select('-access_token -refresh_token')
  ).lean()
  if (!athlete) return null
  const legacy = legacyConnection(athlete as Record<string, unknown>, provider)
  return withCredentials ? legacy : legacy && { ...legacy, access_token: null, refresh_token: null }
}

/**
 * Push deliveries name the provider's athlete id, not ours. Resolve the live
 * connection that owns it — `Connection` first, then the legacy `Athlete`
 * columns for an account the migration has not touched — with credentials, so
 * the push path can read the one activity it was told about.
 */
export async function findConnectionByExternalAthlete(
  providerId: string,
  externalAthleteId: string,
): Promise<ConnectionLike | null> {
  if (!externalAthleteId || mongoose.connection.readyState !== 1) return null
  const connection = await Connection.findOne({
    provider: providerId,
    external_athlete_id: externalAthleteId,
    disconnected_at: null,
  }).lean()
  if (connection) return connection as ConnectionLike
  if (providerId !== Provider.Strava || !/^\d+$/.test(externalAthleteId)) return null
  const athlete = await Athlete.findOne({
    strava_athlete_id: Number(externalAthleteId),
    disconnected_at: null,
  }).lean()
  const legacy = athlete ? legacyConnection(athlete as Record<string, unknown>, providerId) : null
  return legacy?.disconnected_at ? null : legacy
}

export async function listConnections(athleteId: string): Promise<ConnectionStatus[]> {
  const ids = enabledProviderIds()
  if (!mongoose.isValidObjectId(athleteId) || mongoose.connection.readyState !== 1) {
    return ids.map((provider) => ({ provider, connected: false, last_synced_at: null }))
  }
  const rows = await Connection.find({ athlete: athleteId }).lean()
  const byProvider = new Map(rows.map((row) => [row.provider, row]))
  const athlete = await Athlete.findById(athleteId).lean()
  return ids.map((provider) => {
    const row = byProvider.get(provider)
    if (row) {
      return {
        provider,
        connected: Boolean(row.external_athlete_id) && Boolean(row.access_token) && !row.disconnected_at,
        last_synced_at: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
      }
    }
    const legacy = athlete ? legacyConnection(athlete as Record<string, unknown>, provider) : null
    return {
      provider,
      connected: Boolean(legacy) && !legacy?.disconnected_at,
      last_synced_at: legacy?.last_synced_at
        ? new Date(legacy.last_synced_at).toISOString()
        : null,
    }
  })
}

export async function isConnected(athleteId: string, provider: string): Promise<boolean> {
  const statuses = await listConnections(athleteId)
  return statuses.some((status) => status.provider === provider && status.connected)
}

/** Exchange a code and attach the source to the account. */
export async function linkProvider(
  athleteId: string,
  providerId: string,
  code: string,
): Promise<ConnectionLike> {
  const provider = getProvider(providerId)
  return linkProviderWithTokens(athleteId, providerId, await provider.exchangeCode(code))
}

/** Same as `linkProvider` when the caller already exchanged the code once. */
export async function linkProviderWithTokens(
  athleteId: string,
  providerId: string,
  tokens: import('@/modules/providers/domain/ports/ActivityProvider.ts').ProviderTokens,
): Promise<ConnectionLike> {
  if (!tokens.externalAthleteId) {
    throw new ProviderAuthError(providerId, `${providerId} did not return an athlete id`)
  }

  // Another account already owns this grant. A legacy provider-only row (no
  // email, no password) is the same person mid-migration: adopt its data rather
  // than locking them out of their own Strava history. A real account still
  // blocks the link.
  const bound = await Connection.findOne({
    provider: providerId,
    external_athlete_id: tokens.externalAthleteId,
    athlete: { $ne: athleteId },
  })
    .select('_id athlete')
    .lean()
  if (bound) {
    const legacy = bound.athlete
      ? await Athlete.findById(bound.athlete).select('+password_hash').lean()
      : null
    if (!legacy) {
      // Dangling connection: nothing to protect, drop it and continue.
      await Connection.deleteOne({ _id: bound._id })
    } else if (legacy.email || legacy.password_hash) {
      throw new ProviderAuthError(providerId, `${providerId} account already linked`)
    } else {
      await adoptLegacyAccount(athleteId, String(bound.athlete), providerId)
    }
  }

  const profile = tokens.profile
  const update = {
    provider: providerId,
    external_athlete_id: tokens.externalAthleteId,
    firstname: profile?.firstname ?? null,
    lastname: profile?.lastname ?? null,
    profile: profile?.profile ?? null,
    badge_type_id: profile?.badgeTypeId ?? null,
    badges: profile?.badges,
    access_token: encryptToken(tokens.accessToken),
    refresh_token: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
    expires_at: tokens.expiresAt ?? null,
    scopes: tokens.scopes ?? [],
    disconnected_at: null,
  }
  const connection = await Connection.findOneAndUpdate(
    { athlete: athleteId, provider: providerId },
    { $set: update },
    { upsert: true, new: true },
  )

  // Dual-write the legacy columns for one release so a rollback still works.
  if (providerId === Provider.Strava) {
    await Athlete.updateOne(
      { _id: athleteId },
      {
        $set: {
          strava_athlete_id: Number(tokens.externalAthleteId),
          firstname: profile?.firstname,
          lastname: profile?.lastname,
          profile: profile?.profile,
          access_token: update.access_token,
          refresh_token: update.refresh_token,
          expires_at: tokens.expiresAt,
          strava_prompt_seen_at: new Date(),
        },
        $unset: { disconnected_at: 1 },
      },
    )
  }
  return connection.toObject() as ConnectionLike
}

/** A standalone mongod (no replica set) rejects transactions this way. */
function isUnsupportedTransaction(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null | undefined
  const message = String(e?.message ?? '')
  return (
    e?.code === 20 ||
    /transaction numbers are only allowed on a replica set member or mongos/i.test(message)
  )
}

/**
 * Move an orphan legacy account into the authenticated account. Runs in a
 * transaction where Mongo supports it; the ordered fallback exists for a
 * standalone dev mongod, exactly like GDPR erasure.
 */
async function adoptLegacyAccount(
  currentId: string,
  legacyId: string,
  providerId: string,
): Promise<void> {
  const [current, legacy] = await Promise.all([
    Athlete.findById(currentId).select('firstname lastname profile timezone goal goalSetAt hr_zones badges strava_prompt_seen_at').lean(),
    Athlete.findById(legacyId)
      .select('+password_hash firstname lastname profile timezone goal goalSetAt hr_zones badges strava_prompt_seen_at')
      .lean(),
  ])
  if (!current) throw new ProviderAuthError(providerId, 'Current account not found')
  if (!legacy) throw new ProviderAuthError(providerId, 'Legacy account not found')

  const existing = await Connection.findOne({ athlete: currentId, provider: providerId })
    .select('_id')
    .lean()
  if (existing) {
    throw new ProviderAuthError(providerId, `${providerId} account already linked to this account`)
  }

  const copy: Record<string, unknown> = {}
  for (const key of [
    'firstname',
    'lastname',
    'profile',
    'timezone',
    'goal',
    'goalSetAt',
    'badges',
    'strava_prompt_seen_at',
  ] as const) {
    if (current[key] == null && legacy[key] != null) copy[key] = legacy[key]
  }
  if (
    (!Array.isArray(current.hr_zones) || current.hr_zones.length === 0) &&
    Array.isArray(legacy.hr_zones) &&
    legacy.hr_zones.length > 0
  ) {
    copy.hr_zones = legacy.hr_zones
  }

  const move = async (session?: mongoose.ClientSession) => {
    await Activity.updateMany({ athlete: legacyId }, { $set: { athlete: currentId } }, { session })
    await WorkoutFeedback.updateMany({ athlete: legacyId }, { $set: { athlete: currentId } }, { session })
    await Connection.updateOne(
      { athlete: legacyId, provider: providerId },
      { $set: { athlete: currentId } },
      { session },
    )
    if (Object.keys(copy).length) {
      await Athlete.updateOne({ _id: currentId }, { $set: copy }, { session })
    }
    await Athlete.deleteOne({ _id: legacyId }, { session })
  }

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      await move(session)
    })
  } catch (error) {
    if (!isUnsupportedTransaction(error)) throw error
    await move(undefined)
  } finally {
    await session.endSession()
  }
  clearAiCacheForAthlete(currentId)
  clearAiCacheForAthlete(legacyId)
}

/** Refresh when the stored token is within a minute of expiry. */
export async function freshAccessToken(connection: ConnectionLike): Promise<string> {
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0
  const stillFresh = expiresAt && expiresAt > Date.now() + 60_000
  if (stillFresh && connection.access_token) return decryptToken(connection.access_token)

  if (!connection.refresh_token) {
    throw new ProviderAuthError(connection.provider, `${connection.provider} session expired`)
  }
  const provider = getProvider(connection.provider)
  const tokens = await provider.refresh(decryptToken(connection.refresh_token))
  const accessToken = encryptToken(tokens.accessToken)
  const refreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : connection.refresh_token
  const expiresAtDate = tokens.expiresAt ?? null

  if (connection._id) {
    await Connection.updateOne(
      { _id: connection._id },
      {
        $set: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAtDate,
          ...(tokens.scopes?.length ? { scopes: tokens.scopes } : {}),
        },
      },
    )
  } else if (connection.provider === Provider.Strava) {
    await Athlete.updateOne(
      { _id: connection.athlete },
      { $set: { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAtDate } },
    )
  }

  connection.access_token = accessToken
  connection.refresh_token = refreshToken
  connection.expires_at = expiresAtDate
  return tokens.accessToken
}

/** Persist the watermark on whichever representation this connection uses. */
export async function touchConnection(
  connection: ConnectionLike,
  fields: {
    last_synced_at?: Date
    zones?: CanonicalZones
    profile?: { firstname?: string | null; lastname?: string | null; profile?: string | null }
    last_sync_error?: { code: string; at: Date } | null
  },
): Promise<void> {
  const set: Record<string, unknown> = {}
  if (fields.last_synced_at) set.last_synced_at = fields.last_synced_at
  if (fields.zones) set.zones = fields.zones
  if (fields.profile) {
    if (fields.profile.firstname !== undefined) set.firstname = fields.profile.firstname
    if (fields.profile.lastname !== undefined) set.lastname = fields.profile.lastname
    if (fields.profile.profile !== undefined) set.profile = fields.profile.profile
  }
  if (fields.last_sync_error !== undefined) set.last_sync_error = fields.last_sync_error

  if (connection._id) {
    await Connection.updateOne({ _id: connection._id }, { $set: set })
  } else if (connection.provider === Provider.Strava && connection.athlete) {
    const legacySet: Record<string, unknown> = {}
    if (set.last_synced_at) legacySet.last_synced_at = set.last_synced_at
    if (set.zones) legacySet.zones = set.zones
    if (set.profile) Object.assign(legacySet, set.profile)
    await Athlete.updateOne({ _id: connection.athlete }, { $set: legacySet })
  }

  if (set.last_synced_at) connection.last_synced_at = set.last_synced_at as Date
  if (set.zones) connection.zones = set.zones as CanonicalZones
}

/** Revoke at the provider (best effort), then drop local credentials. */
export async function disconnectProvider(athleteId: string, providerId: string): Promise<void> {
  const connection = await getConnection(athleteId, providerId, { withCredentials: true })
  if (connection?.access_token) {
    try {
      await getProvider(providerId).revoke(decryptToken(connection.access_token))
    } catch {
      // Provider unreachable or the grant was already gone: local disconnect wins.
    }
  }

  await Connection.updateOne(
    { athlete: athleteId, provider: providerId },
    {
      $set: { disconnected_at: new Date() },
      $unset: { access_token: 1, refresh_token: 1, expires_at: 1 },
    },
  )
  if (providerId === Provider.Strava) {
    await Athlete.updateOne(
      { _id: athleteId },
      {
        $set: { disconnected_at: new Date() },
        $unset: { access_token: 1, refresh_token: 1, expires_at: 1 },
      },
    )
  }
}

/** Athlete slots used, across providers. */
export async function connectedCount(): Promise<number> {
  if (mongoose.connection.readyState !== 1) return 0
  return Connection.countDocuments(CONNECTED_CONNECTION_FILTER)
}

export async function athleteLimit(): Promise<number> {
  return env.athleteLimit
}

export function athleteIdOf(connection: ConnectionLike): string | null {
  return idOf(connection.athlete)
}
