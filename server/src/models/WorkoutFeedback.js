import mongoose from 'mongoose'

const workoutFeedbackSchema = new mongoose.Schema(
  {
    athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' },
    planned_workout: { type: mongoose.Schema.Types.ObjectId, ref: 'PlannedWorkout' },
    actual_activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
    completion_status: { type: String, enum: ['completed_as_intended', 'easier', 'harder', 'incomplete', 'different'], default: 'completed_as_intended' },
    deviation: Object,
    notes: String,
  },
  { timestamps: true }
)

export const WorkoutFeedback = mongoose.model('WorkoutFeedback', workoutFeedbackSchema)
