import mongoose from 'mongoose'

const zoneSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  { _id: false },
)

// Per-source state — tokens, scopes, zones, watermark — lives here, not on `Athlete`, so a new provider
// never widens the athlete row. Tokens are encrypted by `tokenCrypto` and never serialised to a client.
const connectionSchema = new mongoose.Schema(
  {
    athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete', required: true },
    provider: { type: String, required: true },
    external_athlete_id: { type: String, required: true },
    firstname: String,
    lastname: String,
    profile: String,
    badge_type_id: Number,
    badges: Array,
    access_token: String,
    refresh_token: String,
    expires_at: Date,
    scopes: [String],
    /** Canonical low → high bpm zones; provider payloads are translated on ingest. */
    zones: [zoneSchema],
    last_synced_at: Date,
    last_sync_error: {
      code: String,
      at: Date,
    },
    /** Set on a real disconnect; a reconnect clears it and restores the slot. */
    disconnected_at: { type: Date, default: null },
  },
  { timestamps: true },
)

connectionSchema.index({ athlete: 1, provider: 1 }, { unique: true })
connectionSchema.index({ provider: 1, external_athlete_id: 1 }, { unique: true })
connectionSchema.index({ provider: 1, disconnected_at: 1 })

/** Capacity gate: a connection still holding a live grant. */
export const CONNECTED_CONNECTION_FILTER = {
  disconnected_at: null,
  access_token: { $ne: null },
} as const

export const Connection = mongoose.model('Connection', connectionSchema)
