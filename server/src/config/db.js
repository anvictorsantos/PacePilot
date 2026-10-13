import mongoose from 'mongoose'

export async function connectDB(uri) {
  if (!uri) {
    console.warn('[db] No MONGODB_URI — running without database; API routes will return 503')
    return
  }
  try {
    await mongoose.connect(uri)
    console.log('[db] Connected to MongoDB')
  } catch (err) {
    console.warn('[db] MongoDB connection failed — continuing without DB:', err.message)
  }
}
