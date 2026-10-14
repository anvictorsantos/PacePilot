import mongoose from 'mongoose'

const waitlistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
  },
  { timestamps: true },
)

export const Waitlist = mongoose.model('Waitlist', waitlistSchema)
