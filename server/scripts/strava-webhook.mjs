/**
 * Strava push subscription — one per environment, created once.
 *
 *   npm run webhook:strava -- status
 *   npm run webhook:strava -- subscribe
 *   npm run webhook:strava -- delete <subscription-id> --yes
 *
 * The callback must be publicly reachable over HTTPS (port 443) and must answer
 * the `hub.challenge` handshake with `STRAVA_WEBHOOK_VERIFY_TOKEN` set on that
 * deployment. Strava keeps a single subscription per API app, so a deploy
 * preview that registers one replaces production's; use one Strava API app per
 * environment.
 *
 * Reads server/.env via dotenv. Never prints the client secret or verify token.
 */
import 'dotenv/config'

const API = 'https://www.strava.com/api/v3/push_subscriptions'

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`[webhook] Missing env: ${name}`)
    process.exit(1)
  }
  return value
}

function callbackUrl() {
  const configured = process.env.STRAVA_WEBHOOK_CALLBACK_URL
  if (configured) return configured.replace(/\/+$/, '')
  const base = (process.env.APP_URL || process.env.CLIENT_URL || '')
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '')
  if (!base) {
    console.error('[webhook] Set STRAVA_WEBHOOK_CALLBACK_URL (or CLIENT_URL) first.')
    process.exit(1)
  }
  return `${base}/api/providers/strava/webhook`
}

function credentials() {
  return {
    client_id: required('STRAVA_CLIENT_ID'),
    client_secret: required('STRAVA_CLIENT_SECRET'),
  }
}

function safeSubscription(raw) {
  return {
    id: raw?.id,
    callback_url: raw?.callback_url,
    created_at: raw?.created_at,
    updated_at: raw?.updated_at,
  }
}

async function request(url, options) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const hint = res.status === 401 ? ' (check client id/secret and app ownership)' : ''
    console.error(`[webhook] Strava answered ${res.status}${hint}`)
    if (body && typeof body === 'object') console.error(JSON.stringify(body))
    process.exit(1)
  }
  return body
}

async function list() {
  const params = new URLSearchParams(credentials())
  return request(`${API}?${params}`)
}

async function run() {
  const [command = 'status', argument] = process.argv.slice(2)

  if (command === 'status') {
    const rows = await list()
    const subscriptions = Array.isArray(rows) ? rows : rows ? [rows] : []
    if (!subscriptions.length) {
      console.log('[webhook] No subscription registered for this Strava app.')
      return
    }
    for (const row of subscriptions) console.log(JSON.stringify(safeSubscription(row)))
    return
  }

  if (command === 'subscribe') {
    const body = new URLSearchParams({
      ...credentials(),
      callback_url: callbackUrl(),
      verify_token: required('STRAVA_WEBHOOK_VERIFY_TOKEN'),
    })
    const created = await request(API, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    console.log(`[webhook] Subscribed: ${JSON.stringify(safeSubscription(created))}`)
    console.log(
      '[webhook] Add the id above to STRAVA_WEBHOOK_SUBSCRIPTION_ID on this deployment, then redeploy.',
    )
    return
  }

  if (command === 'delete') {
    if (!argument || !process.argv.includes('--yes')) {
      console.error('[webhook] Usage: delete <subscription-id> --yes')
      process.exit(1)
    }
    const params = new URLSearchParams(credentials())
    await request(`${API}/${encodeURIComponent(argument)}?${params}`, { method: 'DELETE' })
    console.log(`[webhook] Deleted subscription ${argument}.`)
    return
  }

  console.error('[webhook] Usage: status | subscribe | delete <id> --yes')
  process.exit(1)
}

run().catch((error) => {
  console.error('[webhook] Failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
