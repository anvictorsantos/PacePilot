import mongoose from 'mongoose'

// Cached promise reused across requests: a fresh handshake + pool per request
// exhausts the pool. Reset on failure so a rejected promise cannot poison retries.
declare global {
  // eslint-disable-next-line no-var
  var __mongoosePromise: Promise<typeof mongoose> | null
}

let cached: Promise<typeof mongoose> | null = globalThis.__mongoosePromise

function freshConnect(uri: string): Promise<typeof mongoose> {
  cached = mongoose.connect(uri).catch((err) => {
    cached = null
    globalThis.__mongoosePromise = null
    throw err
  })
  globalThis.__mongoosePromise = cached
  return cached
}

export async function connectDB(uri: string): Promise<void> {
  if (!uri) {
    console.warn('[db] No MONGODB_URI — running without database; API routes will return 503')
    return
  }
  try {
    if (mongoose.connection.readyState === 1) return
    await (cached || freshConnect(uri))
    console.log('[db] Connected to MongoDB')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[db] MongoDB connection failed — continuing without DB:', message)
  }
}
