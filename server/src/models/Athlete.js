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
    email: String,
    firstname: String,
    lastname: String,
    profile: String,
    access_token: String,
    refresh_token: String,
    expires_at: Number,
    scopes: [String],
    timezone: String,
    goal: goalSchema,
    zones: Object, // Strava athlete/zones payload (heart_rate.zones), imported on sync
    badge_type_id: Number, // Strava GET /athlete badge_type_id (cached)
    badges: Array, // Strava badges array (cached, if present)
    last_synced_at: Date,
  },
  { timestamps: true }
)

export const Athlete = mongoose.model('Athlete', athleteSchema)
