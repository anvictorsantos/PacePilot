import { Router } from 'express'

import { buildProgress } from '@/modules/progress/application/build-progress.ts'
import { getSession } from '@/modules/athlete/application/session.service.ts'
import { requireAuthForUserData } from '@/modules/shared/infrastructure/http/auth.ts'
import { loadTrainingData } from '@/modules/training/application/plan.service.ts'

const router = Router()

router.get('/', requireAuthForUserData, async (req, res, next) => {
  try {
    const data = await loadTrainingData(await getSession(req))
    if (!data) return res.status(401).json({ error: 'Not authenticated' })
    // the read model is a pure function of these two; the route only loads
    res.json(buildProgress(data.activities, data.goal))
  } catch (e) {
    next(e)
  }
})

export default router
