import { Router } from 'express'
import type { Request } from 'express'
import mongoose from 'mongoose'

import { requireAuthForUserData } from '@/modules/shared/infrastructure/http/auth.ts'
import { getSession } from '@/modules/athlete/application/session.service.ts'
import { parsePagination } from '@/modules/shared/infrastructure/utils/pagination.ts'
import {
  ACTIVITY_WORKOUT_TYPES,
  Activity,
} from '@/modules/activities/infrastructure/persistence/Activity.ts'
import {
  normalizeLaps,
  normalizeStreams,
} from '@/modules/activities/application/activity.service.ts'
import { getProvider } from '@/modules/providers/application/provider-registry.ts'
import {
  freshAccessToken,
  getConnection,
} from '@/modules/providers/application/connection.service.ts'
import { Provider } from '@/modules/providers/domain/Provider.ts'

const router = Router()

// `getSession` declares a symbol-keyed cache slot on its structural request
// argument that Express's `Request` type does not. It is the same object at
// runtime; bridge the two type views once here rather than at every call site.
function sessionFor(req: Request, options?: { withCredentials?: boolean }) {
  return getSession(req as unknown as Parameters<typeof getSession>[0], options)
}

/** Never send a provider's raw blob or internals to the client. */
function sanitizeActivity(a: unknown) {
  if (!a || typeof a !== 'object') return a
  const doc = a as Record<string, unknown>
  const { raw: _raw, __v: _v, ...safe } = doc
  return {
    ...safe,
    // Opaque and stable: two providers may reuse a numeric id, so the URL key
    // is our document id. Legacy numeric/`provider_activity_id` links still
    // resolve in the detail route.
    id: doc._id ?? doc.provider_activity_id ?? doc.id,
    provider: doc.provider ?? Provider.Strava,
    provider_activity_id: doc.provider_activity_id ?? doc.strava_activity_id ?? null,
  }
}

router.get('/', requireAuthForUserData, async (req, res, next) => {
  try {
    const athleteId = (await sessionFor(req)).athleteId
    if (!athleteId) return res.status(401).json({ error: 'Not authenticated' })
    const { page, perPage, skip } = parsePagination(req.query)
    const filter: { athlete: string; workout_type?: string } = { athlete: athleteId }
    // Whitelist string values only — blocks qs operator injection (?type[$ne]=x
    // parses to an object). The set comes from the model enum so it cannot drift.
    const ALLOWED_TYPES = ACTIVITY_WORKOUT_TYPES
    if (typeof req.query.type === 'string' && req.query.type !== 'all') {
      if (ALLOWED_TYPES.has(req.query.type)) {
        filter.workout_type = req.query.type
      } else {
        return res.status(400).json({
          error: 'Invalid type',
          details: [{ path: ['type'], message: `must be one of: all, ${[...ALLOWED_TYPES].join(', ')}` }],
        })
      }
    }
    const [rawItems, total] = await Promise.all([
      Activity.find(filter).sort({ date: -1 }).skip(skip).limit(perPage).select('-raw').lean(),
      Activity.countDocuments(filter),
    ])
    const items = rawItems.map((a) => sanitizeActivity(a))
    res.json({ items, total, page, perPage })
  } catch (e) { next(e) }
})

router.get('/:id', requireAuthForUserData, async (req, res, next) => {
  try {
    const raw = req.params.id
    let act = null
    // New links are opaque document ids; legacy numeric Strava ids and
    // provider-owned ids keep resolving for one release.
    if (mongoose.isValidObjectId(raw)) act = await Activity.findById(raw).select('-raw').lean()
    if (!act) act = await Activity.findOne({ provider_activity_id: raw }).select('-raw').lean()
    if (!act && /^\d+$/.test(raw)) {
      act = await Activity.findOne({ strava_activity_id: Number(raw) }).select('-raw').lean()
    }
    if (!act) return res.status(404).json({ error: 'Not found' })
    // Ownership check — 404 on mismatch so IDs are not enumerable across users.
    const requesterId = (await sessionFor(req)).athleteId
    if (!requesterId) return res.status(401).json({ error: 'Not authenticated' })
    if (act.athlete && String(act.athlete) !== String(requesterId)) {
      return res.status(404).json({ error: 'Not found' })
    }

    const providerId = act.provider || Provider.Strava
    const externalId = act.provider_activity_id ?? (act.strava_activity_id ? String(act.strava_activity_id) : null)

    // Trophies come from the provider's detailed activity and are cached on the
    // row. Opt-in so a detail view does not spend quota; the stored value still
    // renders either way.
    if (req.query.refresh_trophies === '1' && mongoose.connection.readyState === 1 && externalId) {
      try {
        const connection = await getConnection(requesterId, providerId, { withCredentials: true })
        if (connection?.access_token) {
          const adapter = getProvider(providerId)
          const detailed = await adapter.getActivity(await freshAccessToken(connection), externalId)
          if (detailed) {
            act.trophies = detailed.trophies ?? act.trophies ?? []
            act.achievement_count = detailed.achievementCount ?? act.achievement_count
            act.pr_count = detailed.prCount ?? act.pr_count
            await Activity.updateOne(
              { _id: act._id },
              {
                $set: {
                  trophies: act.trophies,
                  achievement_count: act.achievement_count,
                  pr_count: act.pr_count,
                },
              },
            ).catch(() => {})
          }
        }
      } catch (error) {
        // Never fail the read because an enrichment call failed.
        console.warn('[activities] trophy refresh failed:', error instanceof Error ? error.message : error)
      }
    }

    // Laps and streams are not on the list payload. Fetch them once per row,
    // cache them, and never fail the read when the provider is slow or rate
    // limiting: the chart, lap table and map degrade to their empty states.
    const DETAIL_VERSION = 2
    if (
      (!act.detail_synced_at || (act.detail_version ?? 0) < DETAIL_VERSION) &&
      mongoose.connection.readyState === 1 &&
      externalId
    ) {
      try {
        const connection = await getConnection(requesterId, providerId, { withCredentials: true })
        if (connection?.access_token) {
          const adapter = getProvider(providerId)
          const accessToken = await freshAccessToken(connection)
          const [detailed, streamPayload] = await Promise.all([
            adapter.getActivity(accessToken, externalId).catch(() => null),
            adapter.capabilities.streams && adapter.getStreams
              ? adapter.getStreams(accessToken, externalId).catch(() => null)
              : Promise.resolve(null),
          ])
          // Only mark the row synced when the provider answered something; a
          // total failure must be retried on the next view.
          if (detailed || streamPayload) {
            const laps = adapter.capabilities.laps && detailed ? normalizeLaps(detailed.laps) : []
            const { streams, available } = normalizeStreams(streamPayload)
            const detail_synced_at = new Date()
            act.laps = laps
            act.streams = streams
            act.streams_available = available
            act.detail_synced_at = detail_synced_at
            act.detail_version = DETAIL_VERSION
            await Activity.updateOne(
              { _id: act._id },
              {
                $set: {
                  laps,
                  streams,
                  streams_available: available,
                  detail_synced_at,
                  detail_version: DETAIL_VERSION,
                },
              },
            ).catch(() => {})
          }
        }
      } catch (error) {
        // Never fail the read because an enrichment call failed.
        console.warn('[activities] detail enrichment failed:', error instanceof Error ? error.message : error)
      }
    }

    res.json(sanitizeActivity(act))
  } catch (e) { next(e) }
})

export default router
