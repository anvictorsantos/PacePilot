import mongoose from 'mongoose'

const activitySchema = new mongoose.Schema(
  {
    strava_activity_id: { type: Number, unique: true, sparse: true },
    athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' },
    date: Date,
    sport: String,
    workout_type: { type: String, enum: ['recovery', 'easy', 'long', 'steady', 'tempo', 'threshold', 'interval', 'hill', 'race', 'unknown'], default: 'unknown' },
    distance_m: Number,
    distance_km: Number,
    moving_time_s: Number,
    moving_time_min: Number,
    elapsed_time_s: Number,
    elapsed_time_min: Number,
    elevation_m: Number,
    avg_speed: Number,
    max_speed: Number,
    avg_pace_sec_km: Number,
    avg_hr: Number,
    max_hr: Number,
    avg_cadence: Number,
    has_hr: Boolean,
    calories: Number,
    laps: Array,
    zones: Object,
    streams_available: [String],
    raw: Object,
  },
  { timestamps: true }
)

activitySchema.index({ athlete: 1, date: -1 })

export const Activity = mongoose.model('Activity', activitySchema)
