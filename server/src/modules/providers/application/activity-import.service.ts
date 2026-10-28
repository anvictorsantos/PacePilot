/**
 * Import activities from any provider through one pipeline: throttle → pages →
 * canonical evidence → normalize → classify → idempotent bulk upsert → watermark.
 * Pull providers call this directly; a push provider feeds the same writer
 * through `ingestActivities` (WS8) instead of duplicating the rules.
 */
import mongoose from 'mongoose'

import { Activity, OTHER_WORKOUT_TYPE } from '@/modules/activities/infrastructure/persistence/Activity.ts'
import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import {
  classifyActivity,
  isRelevantRun,
  normalizeActivity,
} from '@/modules/activities/application/activity.service.ts'
import { clearAiCacheForAthlete } from '@/modules/ai/application/quota-cache.ts'
import { ProviderAuthError } from '@/modules/providers/domain/errors.ts'
import type { CanonicalActivity, CanonicalZones } from '@/modules/providers/domain/CanonicalActivity.ts'
import type { BackfillPausePort } from '@/modules/providers/domain/ports/BackfillPause.ts'
import { getProvider } from '@/modules/providers/application/provider-registry.ts'
import {
  freshAccessToken,
  getConnection,
  touchConnection,
  type ConnectionLike,
} from '@/modules/providers/application/connection.service.ts'
import { Provider } from '@/modules/providers/domain/Provider.ts'
import { serviceUnavailable } from '@/modules/shared/infrastructure/errors/AppError.ts'
import { mongoBackfillCursor } from '@/modules/providers/infrastructure/persistence/BackfillCursor.ts'

/** Auto-import fires on app load; this window keeps a tab loop from burning quota. */
export const SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000
/** Activity `start_date` can precede the sync that first saw it (late uploads). */
export const SYNC_OVERLAP_MS = 14 * 86400000
export const SYNC_PER_PAGE = 50
/** 500 activities per run — bounds quota burn and request time. */
export const MAX_SYNC_PAGES = 10

/** The side effects a pull import needs from the rest of the provider context. */
export interface ImportDeps {
  /** Take the provider from a historical walk while this sync runs. */
  pauseBackfill: BackfillPausePort
}

const defaultDeps: ImportDeps = { pauseBackfill: mongoBackfillCursor }

export interface ImportOutcome {
  imported: number
  skipped: number
  totalFetched: number
  total: number
  truncated: boolean
  guarded: boolean
  last_synced_at: Date | null
  zones: boolean
}

function recentBaselineQuery(athleteId: mongoose.Types.ObjectId) {
  // Runs only: a ride's speed would skew the pace bands.
  return Activity.find({ athlete: athleteId, kind: 'run', avg_pace_sec_km: { $ne: null } })
    .sort({ date: -1 })
    .limit(10)
    .lean()
}

function writePayload(
  item: CanonicalActivity,
  athleteId: mongoose.Types.ObjectId,
  providerId: string,
  recentAvgPace: number | null,
) {
  const normalized = normalizeActivity(item)
  const { raw: _raw, ...doc } = normalized
  const isRun = isRelevantRun(item)
  return {
    ...doc,
    workout_type: isRun ? classifyActivity(normalized, recentAvgPace) : OTHER_WORKOUT_TYPE,
    athlete: athleteId,
    provider: providerId,
    provider_activity_id: item.externalId,
    raw: item.raw,
    // Legacy column, dual-written for one release. Only a Strava id is numeric.
    ...(providerId === Provider.Strava && /^\d+$/.test(item.externalId)
      ? { strava_activity_id: Number(item.externalId) }
      : {}),
  }
}

/** Shared writer for push and pull. Idempotent by `{provider, external id}`. */
export async function persistActivities(
  athleteId: mongoose.Types.ObjectId,
  providerId: string,
  items: CanonicalActivity[],
): Promise<{ imported: number; skipped: number }> {
  if (!items.length) return { imported: 0, skipped: 0 }

  const recentRuns = await recentBaselineQuery(athleteId)
  const recentAvgPace = recentRuns.length
    ? recentRuns.reduce((sum, run) => sum + (run.avg_pace_sec_km ?? 0), 0) / recentRuns.length
    : null

  const ids = items.map((item) => item.externalId)
  const existing = await Activity.find({
    provider: providerId,
    provider_activity_id: { $in: ids },
  })
    .select('_id provider_activity_id')
    .lean()
  const knownIds = new Set(existing.map((row) => row.provider_activity_id))

  let imported = 0
  let skipped = 0
  const writeOps = []
  for (const item of items) {
    if (knownIds.has(item.externalId)) skipped++
    else imported++
    const payload = writePayload(item, athleteId, providerId, recentAvgPace)
    writeOps.push({
      updateOne: {
        filter: { provider: providerId, provider_activity_id: item.externalId },
        update: { $set: payload },
        upsert: true,
      },
    })
  }

  // Chunked so one oversized batch cannot exceed the 16MB driver document limit
  // or the 100k write limit, and so partial progress lands as we go.
  const CHUNK = 100
  for (let i = 0; i < writeOps.length; i += CHUNK) {
    await Activity.bulkWrite(writeOps.slice(i, i + CHUNK), { ordered: false })
  }
  if (imported > 0) clearAiCacheForAthlete(String(athleteId))
  return { imported, skipped }
}

/** Pull import. Throws a typed provider error; the route maps it to HTTP. */
export async function importActivities(
  {
    athleteId,
    providerId,
    force = false,
  }: {
    athleteId: string
    providerId: string
    force?: boolean
  },
  deps: ImportDeps = defaultDeps,
): Promise<ImportOutcome> {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable('Database not connected — check MONGODB_URI')
  }
  const provider = getProvider(providerId)
  if (!provider.capabilities.pull) {
    return {
      imported: 0,
      skipped: 0,
      totalFetched: 0,
      total: 0,
      truncated: false,
      guarded: true,
      last_synced_at: null,
      zones: false,
    }
  }

  const connection = await getConnection(athleteId, providerId, { withCredentials: true })
  if (!connection?.access_token) {
    throw new ProviderAuthError(providerId, `No ${providerId} credentials found for this session — reconnect ${providerId}`)
  }

  const lastSyncMs = connection.last_synced_at
    ? new Date(connection.last_synced_at).getTime()
    : 0
  if (!force && lastSyncMs && Date.now() - lastSyncMs < SYNC_MIN_INTERVAL_MS) {
    return {
      imported: 0,
      skipped: 0,
      totalFetched: 0,
      total: 0,
      truncated: false,
      guarded: true,
      last_synced_at: connection.last_synced_at ? new Date(connection.last_synced_at) : null,
      zones: Boolean(connection.zones?.length),
    }
  }

  const accessToken = await freshAccessToken(connection)
  const after = lastSyncMs
    ? new Date(lastSyncMs - SYNC_OVERLAP_MS)
    : undefined

  // The athlete's sync wins: a historical walk holds the cursor, not the
  // provider, so pausing it here resumes it from the same page afterwards.
  await deps.pauseBackfill.pauseRunning(athleteId, providerId, new Date())

  let page = 1
  let imported = 0
  let skipped = 0
  let totalFetched = 0
  let truncated = false

  while (true) {
    if (page > MAX_SYNC_PAGES) {
      truncated = true
      break
    }
    const batch = await provider.listActivities(accessToken, {
      after,
      page,
      perPage: SYNC_PER_PAGE,
    })
    const items = batch.items
    if (!items.length) break
    totalFetched += items.length
    const result = await persistActivities(connection.athlete as mongoose.Types.ObjectId, providerId, items)
    imported += result.imported
    skipped += result.skipped
    if (!batch.hasMore) break
    page++
  }

  let zones: CanonicalZones | null = null
  try {
    zones = provider.getZones ? await provider.getZones(accessToken) : null
  } catch {
    // Zones are best-effort: the plan falls back to estimated bands.
  }

  const syncedAt = new Date()
  await touchConnection(connection, {
    last_synced_at: syncedAt,
    ...(zones?.length ? { zones } : {}),
  })
  if (zones?.length) await cacheZonesOnAthlete(connection, zones)

  return {
    imported,
    skipped,
    totalFetched,
    total: imported + skipped,
    truncated,
    guarded: false,
    last_synced_at: syncedAt,
    zones: Boolean(zones?.length || connection.zones?.length),
  }
}

/**
 * `Athlete.hr_zones` is a canonical cache of the connection's zones, so the
 * deterministic plan reads one field and never imports a provider module.
 */
async function cacheZonesOnAthlete(connection: ConnectionLike, zones: CanonicalZones): Promise<void> {
  await Athlete.updateOne({ _id: connection.athlete }, { $set: { hr_zones: zones } })
}
