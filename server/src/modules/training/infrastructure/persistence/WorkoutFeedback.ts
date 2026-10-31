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

// The unique `athlete + date` index is what makes the plan feedback upsert race-safe; build it with
// `npm run db:indexes`, which de-duplicates first (creating it fails while duplicates exist).
workoutFeedbackSchema.index({ athlete: 1, date: -1 })
workoutFeedbackSchema.index({ athlete: 1, date: 1 }, { unique: true })

export const WorkoutFeedback = mongoose.model('WorkoutFeedback', workoutFeedbackSchema)
