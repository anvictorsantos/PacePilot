import mongoose from 'mongoose'

const trainingMetricSchema = new mongoose.Schema(
  {
    athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' },
    calculated_at: { type: Date, default: Date.now },
    period: String,
    distance_km: Number,
    duration_min: Number,
    runs: Number,
    long_run_km: Number,
    hard_sessions: Number,
    intensity_distribution: Object,
    performance_indicators: Object,
  },
  { timestamps: true }
)

export const TrainingMetric = mongoose.model('TrainingMetric', trainingMetricSchema)
