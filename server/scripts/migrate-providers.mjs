// One-off, idempotent backfill of the provider model.
//
//   npm run db:migrate-providers -- --dry-run
//   npm run db:migrate-providers
//
// 1. Athlete token columns → a `Connection` row (tokens copied as ciphertext).
// 2. Connections migrated with an epoch-seconds expiry → a real date.
// 3. Activities without `provider` → provider=strava + provider_activity_id.
// 4. Build the new indexes.
//
// The legacy columns and indexes are left in place: the app dual-writes and
// reads them for one release, so this script is safe to run before a deploy,
// and safe to re-run.
import 'dotenv/config'

const dryRun = process.argv.includes('--dry-run')
const mongoose = (await import('mongoose')).default
const { Athlete } = await import('@/modules/athlete/infrastructure/persistence/Athlete.ts')
const { Activity } = await import('@/modules/activities/infrastructure/persistence/Activity.ts')
const { Connection } = await import('@/modules/providers/infrastructure/persistence/Connection.ts')
const { BackfillCursor } = await import(
  '@/modules/providers/infrastructure/persistence/BackfillCursor.ts'
)
const { EARLIEST_PLAUSIBLE_EPOCH_MS, expiryFromStored, isExpiryCorrupted } = await import(
  '@/modules/providers/domain/tokenExpiry.ts'
)

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set — nothing to do.')
  process.exit(1)
}

function zonesFromLegacy(raw) {
  if (!raw || typeof raw !== 'object') return []
  const groups = Array.isArray(raw) ? raw : null
  const heartRate =
    raw.heart_rate?.zones ??
    groups?.find((group) => group?.type === 'heartrate')?.zones ??
    (Array.isArray(raw.zones) ? raw.zones : null)
  if (!Array.isArray(heartRate)) return []
  return heartRate
    .map((zone) => ({ min: Number(zone?.min), max: Number(zone?.max) }))
    .filter((zone) => Number.isFinite(zone.min) && Number.isFinite(zone.max))
}

await mongoose.connect(process.env.MONGODB_URI)

const athletes = await Athlete.find({
  strava_athlete_id: { $ne: null },
  access_token: { $ne: null },
}).lean()

let created = 0
let skipped = 0
for (const athlete of athletes) {
  const existing = await Connection.findOne({
    athlete: athlete._id,
    provider: 'strava',
  }).select('_id')
  if (existing) {
    skipped++
    continue
  }
  if (dryRun) {
    created++
    continue
  }
  await Connection.create({
    athlete: athlete._id,
    provider: 'strava',
    external_athlete_id: String(athlete.strava_athlete_id),
    firstname: athlete.firstname ?? null,
    lastname: athlete.lastname ?? null,
    profile: athlete.profile ?? null,
    badge_type_id: athlete.badge_type_id ?? null,
    badges: athlete.badges ?? [],
    // Already ciphertext: copy verbatim, never decrypt in a script.
    access_token: athlete.access_token,
    refresh_token: athlete.refresh_token ?? null,
    // The legacy column holds epoch seconds; the date field wants a real date.
    expires_at: expiryFromStored(athlete.expires_at),
    scopes: athlete.scopes ?? [],
    zones: zonesFromLegacy(athlete.zones),
    last_synced_at: athlete.last_synced_at ?? null,
    disconnected_at: athlete.disconnected_at ?? null,
  })
  if (zonesFromLegacy(athlete.zones).length) {
    await Athlete.updateOne(
      { _id: athlete._id },
      { $set: { hr_zones: zonesFromLegacy(athlete.zones) } },
    )
  }
  created++
}

// Rows migrated before #9 carry epoch seconds cast into the date field, so they
// read as 1970 and the token looks permanently stale. The floor is the only
// filter that matches them and a repaired row sits above it, so this pass is
// idempotent and safe to re-run; `expires_at` in the update guard keeps a
// concurrent refresh that already wrote a correct date.
const corruptedFilter = {
  expires_at: { $ne: null, $lt: new Date(EARLIEST_PLAUSIBLE_EPOCH_MS) },
}
const corrupted = await Connection.find(corruptedFilter).select('_id expires_at').lean()
let repaired = 0
for (const row of corrupted) {
  const expiresAt = expiryFromStored(row.expires_at)
  if (!isExpiryCorrupted(row.expires_at) || !expiresAt) continue
  repaired++
  if (dryRun) continue
  await Connection.updateOne(
    { _id: row._id, expires_at: row.expires_at },
    { $set: { expires_at: expiresAt } },
  )
}

const pendingActivities = await Activity.countDocuments({
  $or: [{ provider: { $exists: false } }, { provider: null }, { provider_activity_id: { $exists: false } }],
  strava_activity_id: { $ne: null },
})
if (!dryRun && pendingActivities) {
  await Activity.updateMany(
    {
      $or: [{ provider: { $exists: false } }, { provider: null }, { provider_activity_id: { $exists: false } }],
      strava_activity_id: { $ne: null },
    },
    [
      {
        $set: {
          provider: { $ifNull: ['$provider', 'strava'] },
          provider_activity_id: {
            $ifNull: ['$provider_activity_id', { $toString: '$strava_activity_id' }],
          },
        },
      },
    ],
  )
}

if (!dryRun) {
  await Connection.createIndexes()
  await Activity.createIndexes()
  // Unique per (athlete, provider): the claim relies on one cursor row.
  await BackfillCursor.createIndexes()
}

const connections = dryRun ? created : await Connection.countDocuments({ provider: 'strava' })
console.log(JSON.stringify({
  dryRun,
  athletesWithLegacyGrant: athletes.length,
  connectionsCreated: created,
  alreadyMigrated: skipped,
  expiriesRepaired: repaired,
  activitiesBackfilled: pendingActivities,
  connections,
}, null, 2))

await mongoose.disconnect()
