import mongoose from 'mongoose'

const activityStreamSchema = new mongoose.Schema(
  {
    activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
    strava_activity_id: Number,
    stream_type: String,
    data: [Number],
    series_type: String,
  },
  { timestamps: true }
)

export const ActivityStream = mongoose.model('ActivityStream', activityStreamSchema)
