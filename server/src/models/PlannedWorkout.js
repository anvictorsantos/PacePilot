import mongoose from 'mongoose'

const plannedWorkoutSchema = new mongoose.Schema(
  {
    athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' },
    date: Date,
    workout_type: String,
    distance_km: Number,
    duration_min: Number,
    intensity: String,
    warmup: String,
    main_set: String,
    cooldown: String,
    purpose: String,
    alternative: String,
    target_pace: String,
    target_hr: String,
    status: { type: String, enum: ['planned', 'completed', 'skipped', 'modified', 'recovery'], default: 'planned' },
    source: { type: String, default: 'engine' },
  },
  { timestamps: true }
)

plannedWorkoutSchema.index({ athlete: 1, date: 1 })

export const PlannedWorkout = mongoose.model('PlannedWorkout', plannedWorkoutSchema)
