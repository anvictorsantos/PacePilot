import { connectDB } from '@/modules/shared/infrastructure/config/db.ts'
import { env } from '@/modules/shared/infrastructure/config/env.ts'

import { registerBackfillTasks } from './backfill.ts'

await connectDB(env.mongoUri)
registerBackfillTasks()
console.log('[workflows] backfill tasks registered')
