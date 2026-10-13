import { env } from './config/env.js'
import { connectDB } from './config/db.js'
import { createApp } from './app.js'

const app = createApp()

await connectDB(env.mongoUri)

app.listen(env.port, () => {
  console.log(`[server] Listening on http://localhost:${env.port}`)
})
