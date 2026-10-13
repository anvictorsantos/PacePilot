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

export const WorkoutFeedback = mongoose.model('WorkoutFeedback', workoutFeedbackSchema)
