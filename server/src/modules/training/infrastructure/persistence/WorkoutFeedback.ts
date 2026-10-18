import mongoose from 'mongoose'

const workoutFeedbackSchema = new mongoose.Schema(
  {
    athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' },
    planned_workout: { type: mongoose.Schema.Types.ObjectId, ref: 'PlannedWorkout' },
    actual_activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
    date: Date, // feedback date (YYYY-MM-DD), used when no planned_workout ref yet
    rpe: { type: Number, min: 1, max: 10 },
    status: { type: String, enum: ['completed', 'skipped', 'modified'], default: 'completed' },
    completion_status: { type: String, enum: ['completed_as_intended', 'easier', 'harder', 'incomplete', 'different'], default: 'completed_as_intended' },
    deviation: Object,
    notes: String,
  },
  { timestamps: true }
)

/**
 * Indexes.
 *
 * `athlete + date` was missing entirely, so every lookup in the Plan module
 * (services/plan.service.ts) and routes/plan.routes.ts was a full collection
 * scan. Verified against production: the collection carried only the default
 * `_id_` index.
 *
 * The compound UNIQUE index is what makes the feedback upsert in
 * routes/plan.routes.ts safe. Without it, `findOneAndUpdate({athlete, date},
 * ..., {upsert: true})` can insert two rows for the same logical day when two
 * requests race, after which `findOne` picks an arbitrary one.
 *
 * Deploy note: building this index fails if duplicates already exist. Run
 * `npm run db:indexes` once before deploying — it de-duplicates, keeping the
 * most recent row per (athlete, date), then creates the indexes.
 */
workoutFeedbackSchema.index({ athlete: 1, date: -1 })
workoutFeedbackSchema.index({ athlete: 1, date: 1 }, { unique: true })

export const WorkoutFeedback = mongoose.model('WorkoutFeedback', workoutFeedbackSchema)
