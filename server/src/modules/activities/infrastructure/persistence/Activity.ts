import mongoose from 'mongoose'

import { ACTIVITY_KINDS } from '@/modules/activities/domain/value-object/ActivityKind.ts'

/**
 * The type every non-run import carries (ride, swim, HIIT, strength …). The
 * training engine reads runs only, so this member is the marker that keeps a
 * cross-training session out of distance/pace/consistency sums. Declared here
 * so the enum, the schema and the sync route cannot drift.
 */
export const OTHER_WORKOUT_TYPE = 'other'

/** Single source of truth for the workout_type enum — reused by query filters. */
export const ACTIVITY_WORKOUT_TYPES = new Set([
  'recovery', 'easy', 'long', 'steady', 'tempo', 'threshold', 'interval', 'hill', 'race', 'unknown', OTHER_WORKOUT_TYPE,
])

const activitySchema = new mongoose.Schema(
  {
    strava_activity_id: { type: Number, unique: true, sparse: true },
    athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' },
    date: Date,
    sport: String,
    /** The Strava `sport_type` exactly as received, for tracing the family. */
    sport_type: String,
    /** PacePilot family — `run` alone counts as training volume. */
    kind: { type: String, enum: [...ACTIVITY_KINDS], default: 'other' },
    workout_type: { type: String, enum: [...ACTIVITY_WORKOUT_TYPES], default: 'unknown' },
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
    achievement_count: Number,
    pr_count: Number,
    trophies: Array, // [{ segment, rank, type, time, label }] from segment_efforts.achievements
    laps: Array, // Strava detailed-activity laps, normalized on the detail read
    streams: Object, // { time, distance, velocity_smooth, heartrate } — chart samples
    streams_available: [String],
    /** When the detailed activity + streams were fetched (lazy, once per row). */
    detail_synced_at: Date,
    /** Enrichment schema version — bump to backfill new stream keys once. */
    detail_version: Number,
    zones: Object,
    raw: Object,
  },
  { timestamps: true }
)

activitySchema.index({ athlete: 1, date: -1 })

export const Activity = mongoose.model('Activity', activitySchema)
