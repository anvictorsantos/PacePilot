import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { connectDB } from '@/modules/shared/infrastructure/config/db.ts'
import { createApp } from '@/app.ts'

const app = createApp()

await connectDB(env.mongoUri)

app.listen(env.port, () => {
  console.log(`[server] Listening on http://localhost:${env.port}`)
})
