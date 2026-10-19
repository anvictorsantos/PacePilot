import path from 'node:path'
import { existsSync } from 'node:fs'

import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { connectDB } from '@/modules/shared/infrastructure/config/db.ts'
import { createApp } from '@/app.ts'

// Host that serves the built SPA from the same origin (Render): this process is
// the only origin, so it answers / as well as /api. Netlify never runs this file
// — its function imports app.ts and its CDN serves client/dist. With no local
// build the directory is absent and the static layer is skipped, so Vite's dev
// proxy keeps working unchanged.
const distDir = path.resolve(import.meta.dirname, '../../client/dist')

const app = createApp({ staticDir: existsSync(distDir) ? distDir : undefined })

await connectDB(env.mongoUri)

app.listen(env.port, () => {
  console.log(`[server] Listening on http://localhost:${env.port}`)
})
