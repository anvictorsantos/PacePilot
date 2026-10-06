import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { connectDB } from './config/db.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { requireSameOrigin } from './middleware/auth.js'

import stravaRoutes from './routes/strava.routes.js'
import activitiesRoutes from './routes/activities.routes.js'
import planRoutes from './routes/plan.routes.js'
import goalsRoutes from './routes/goals.routes.js'
import meRoutes from './routes/me.routes.js'
import progressRoutes from './routes/progress.routes.js'

const app = express()

app.use(cors({ origin: env.clientUrl, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(requireSameOrigin)

app.get('/api/health', (_req, res) => res.json({ ok: true, demo: env.demoMode }))

app.use('/api/strava', stravaRoutes)
app.use('/api/activities', activitiesRoutes)
app.use('/api/plan', planRoutes)
app.use('/api/goals', goalsRoutes)
app.use('/api/me', meRoutes)
app.use('/api/progress', progressRoutes)

app.use(notFound)
app.use(errorHandler)

await connectDB(env.mongoUri)

app.listen(env.port, () => {
  console.log(`[server] Listening on http://localhost:${env.port} (demo=${env.demoMode})`)
})
