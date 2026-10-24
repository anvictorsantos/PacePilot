import mongoose from 'mongoose'

const goalSchema = new mongoose.Schema(
  {
    goal_type: { type: String, enum: ['general_fitness', '5K', '10K', 'half_marathon', 'marathon', 'distance_completion', 'maintain'], default: 'general_fitness' },
    target_time_min: Number,
    goal_date: Date,
    days_per_week: { type: Number, default: 4 },
    preferred_days: [String],
    constraints: [String],
  },
  { _id: false }
)

const athleteSchema = new mongoose.Schema(
  {
    strava_athlete_id: { type: Number, unique: true, sparse: true },
    email: { type: String, lowercase: true, trim: true },
    password_hash: { type: String, select: false },
    strava_prompt_seen_at: Date,
    last_login_at: Date,
    email_verified_at: Date,
    email_verification_token_hash: { type: String, select: false },
    email_verification_expires_at: Date,
    password_reset_token_hash: { type: String, select: false },
    password_reset_expires_at: Date,
    firstname: String,
    lastname: String,
    profile: String,
    access_token: String,
    refresh_token: String,
    expires_at: Number,
    scopes: [String],
    timezone: String,
    goal: goalSchema,
    goalSetAt: Date, // when current goal was set — anchors Week 1 (e.g. Aug 20 → Sept 20 = Week 1 of 4)
    zones: Object, // Strava athlete/zones payload (heart_rate.zones), imported on sync
    badge_type_id: Number, // Strava GET /athlete badge_type_id (cached)
    badges: Array, // Strava badges array (cached, if present)
    last_synced_at: Date,
    tokenVersion: { type: Number, default: 0 }, // bump to revoke all sessions (disconnect)
    /** Set when the athlete revoked the grant; a reconnect clears it. */
    disconnected_at: Date,
  },
  { timestamps: true }
)

/**
 * Capacity + OAuth gate: a row still holding a live Strava grant. A logout does
 * not touch this; a real disconnect sets `disconnected_at` and drops the
 * tokens, which frees the athlete slot without erasing training history.
 */
export const CONNECTED_ATHLETE_FILTER = {
  strava_athlete_id: { $ne: null },
  disconnected_at: null,
} as const

// Partial, not sparse: a sparse index still indexes an explicit `null`, so two
// legacy Strava-only rows would collide. Only real strings take part.
athleteSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
)

export const Athlete = mongoose.model('Athlete', athleteSchema)
