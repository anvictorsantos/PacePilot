// Netlify Function adapter — reuses server Express app, no route duplication.
// No app.listen() here. Netlify rewrite preserves /api/* prefix, app mounts
// /api/* routers, so no path stripping needed. Follows:
// https://docs.netlify.com/build/frameworks/framework-setup-guides/express/
// Lives under server/ (not repo-root netlify/) so esbuild resolves bare
// imports (serverless-http, express, …) from server/node_modules.
import serverless from 'serverless-http'
import { createApp } from '../src/app.js'
import { connectDB } from '../src/config/db.js'
import { env } from '../src/config/env.js'

const app = createApp()

// Warm-start cache: connect once per instance, reuse across invocations.
let dbReady = null
function ensureDB() {
  if (!dbReady) dbReady = connectDB(env.mongoUri).catch((err) => {
    console.warn('[function] DB unavailable:', err?.message)
    dbReady = null
  })
  return dbReady
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false
  await ensureDB()
  const serverlessHandler = serverless(app)
  return serverlessHandler(event, context)
}
