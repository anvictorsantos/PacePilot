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
    goalSetAt: Date, // anchors Week 1 of the programme
    zones: Object, // legacy provider payload, deprecated after migration
    /** Canonical low → high bpm zones, cached from the active connection. */
    hr_zones: [{ min: Number, max: Number }],
    badge_type_id: Number,
    badges: Array,
    last_synced_at: Date,
    tokenVersion: { type: Number, default: 0 }, // bump to revoke all sessions (disconnect)
    /** Consecutive failed password attempts; reset on success. */
    failed_login_count: { type: Number, default: 0 },
    /** Set while the account is throttled; authenticate() refuses until it passes. */
    locked_until: Date,
    /** Set when the athlete revoked the grant; a reconnect clears it. */
    disconnected_at: Date,
  },
  { timestamps: true }
)

/** A live Strava grant: logout leaves it; a real disconnect nulls it and frees
 *  the athlete slot without erasing training history. */
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
