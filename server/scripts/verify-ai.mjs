// Manual verification for the AI integration. Loads server/.env, finds a real
// athlete, mints a session token and exercises /api/plan/ai/week end to end.
// Prints no secrets.
import 'dotenv/config'

const base = process.env.STAVA_REDIRECT_URI?.replace(/\/api\/.*$/, '') || 'http://localhost:3000'
const uri = new URL(process.env.MONGODB_URI)
console.log('mongo host:', uri.host, '| db:', uri.pathname)

const mongoose = (await import('mongoose')).default
const { Athlete } = await import('../src/models/Athlete.ts')
const { signToken } = await import('../src/middleware/auth.ts')

await mongoose.connect(process.env.MONGODB_URI)
const athlete = await Athlete.findOne().select('_id tokenVersion').lean()
if (!athlete) {
  console.log('no athlete in db — connect a Strava account first')
  await mongoose.disconnect()
  process.exit(1)
}

const token = signToken({ athleteId: String(athlete._id), tv: athlete.tokenVersion ?? 0 })
console.log('athlete:', String(athlete._id), '| token minted')

const auth = { Cookie: `token=${token}`, Origin: process.env.CLIENT_URL }
const get = async (path) => {
  const res = await fetch(`${base}${path}`, { headers: auth })
  return { status: res.status, body: await res.json().catch(() => null) }
}

const status = await get('/api/plan/ai/status')
console.log('\n== /api/plan/ai/status ==')
console.log(JSON.stringify({
  enabled: status.body.enabled,
  configured: status.body.configured,
  model: status.body.model,
  fallbackModel: status.body.fallbackModel,
  modelStillFree: status.body.modelStillFree,
  freeModelCount: status.body.freeModels?.length,
}, null, 1))

const t0 = Date.now()
const ai = await get('/api/plan/ai/week')
console.log('\n== /api/plan/ai/week ==', `${ai.status} in ${Date.now() - t0}ms`)
if (ai.body?.degraded) {
  console.log('DEGRADED:', ai.body.degraded, '| code:', ai.body.code)
} else {
  console.log('model:', ai.body.model, '| cached:', ai.body.cached, '| confidence:', ai.body.confidence)
  console.log('days:', ai.body.week?.length, '| suggestions:', ai.body.suggestions?.length)
  for (const d of ai.body.week || []) console.log(` ${d.date}: ${d.aiExplanation}`)
  for (const s of ai.body.suggestions || []) console.log(` suggest[${s.dayIndex}] -> ${s.suggestedType}: ${s.reason}`)
}

const t1 = Date.now()
const ai2 = await get('/api/plan/ai/week')
console.log('\n== second call (should be cached) ==', `${ai2.status} in ${Date.now() - t1}ms`, '| cached:', ai2.body?.cached)

await mongoose.disconnect()
