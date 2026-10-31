import mongoose from 'mongoose'

// Cached promise is reused across requests — avoids a fresh handshake + pool
// per request (pool exhaustion under concurrency). Reset on failure: a rejected
// cached promise must not poison later retries.
declare global {
  // Assigned by freshConnect below; read back by a later warm invocation.
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
    if (mongoose.connection.readyState === 1) return // already connected
    await (cached || freshConnect(uri))
    console.log('[db] Connected to MongoDB')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[db] MongoDB connection failed — continuing without DB:', message)
  }
}
