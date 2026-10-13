import mongoose from 'mongoose'

// Cached promise survives warm serverless invocations — avoids a fresh
// handshake + pool per request (pool exhaustion under concurrency).
let cached = globalThis.__mongoosePromise

export async function connectDB(uri) {
  if (!uri) {
    console.warn('[db] No MONGODB_URI — running without database; API routes will return 503')
    return
  }
  try {
    if (!cached) {
      cached = mongoose.connect(uri)
      globalThis.__mongoosePromise = cached
    }
    await cached
    console.log('[db] Connected to MongoDB')
  } catch (err) {
    console.warn('[db] MongoDB connection failed — continuing without DB:', err.message)
  }
}
