import * as webpush from 'web-push'
import { env } from '@/modules/shared/infrastructure/config/env.ts'

export interface PushSubscriptionRecord {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

let configured = false

/** False when the deploy has no VAPID pair — the tick still runs, push is skipped. */
export function pushEnabled(): boolean {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey)
}

function ensureConfigured(): boolean {
  if (!pushEnabled()) return false
  if (!configured) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey)
    configured = true
  }
  return true
}

/**
 * Sends one payload to every device. Returns endpoints the push service rejected
 * as gone (404/410) so the caller can prune them; other failures are logged and
 * left in place for the next tick.
 */
export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRecord[],
  payload: PushPayload,
): Promise<{ sent: number; gone: string[] }> {
  if (!ensureConfigured() || subscriptions.length === 0) return { sent: 0, gone: [] }

  const body = JSON.stringify(payload)
  let sent = 0
  const gone: string[] = []
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(subscription, body, { TTL: 60 * 60 })
      sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        gone.push(subscription.endpoint)
      } else {
        console.warn(
          `[push] delivery failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }
  return { sent, gone }
}
