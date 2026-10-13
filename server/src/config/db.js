import mongoose from 'mongoose'

// Cached promise survives warm serverless invocations — avoids a fresh
// handshake + pool per request (pool exhaustion under concurrency).
// Reset on failure: a rejected cached promise must not poison later retries.
let cached = globalThis.__mongoosePromise

function freshConnect(uri) {
  cached = mongoose.connect(uri).catch((err) => {
    cached = null
    globalThis.__mongoosePromise = null
    throw err
  })
  globalThis.__mongoosePromise = cached
  return cached
}

export async function connectDB(uri) {
  if (!uri) {
    console.warn('[db] No MONGODB_URI — running without database; API routes will return 503')
    return
  }
  try {
    if (mongoose.connection.readyState === 1) return // already connected
    await (cached || freshConnect(uri))
    console.log('[db] Connected to MongoDB')
  } catch (err) {
    console.warn('[db] MongoDB connection failed — continuing without DB:', err.message)
  }
}
