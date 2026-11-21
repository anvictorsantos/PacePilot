import type { PushSubscriptionBody } from '@/modules/account/infrastructure/dto/CoachingPreferences.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

const SW_PATH = '/sw.js'

export type PushErrorCode = 'unsupported' | 'unavailable' | 'denied' | 'subscribe' | 'server'

export class PushSetupError extends Error {
  constructor(readonly code: PushErrorCode) {
    super(code)
    this.name = 'PushSetupError'
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function decodeKey(value: string): Uint8Array | null {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  try {
    const raw = atob(base64)
    return Uint8Array.from(raw, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

/** The server's key is authoritative; a stale build-time key must not win. */
async function applicationServerKey(): Promise<{ raw: Uint8Array; source: string } | null> {
  const fromServer = await api.account
    .pushKey()
    .then((value) => value.key)
    .catch(() => '')
  const source = fromServer || ((import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ?? '')
  if (!source) return null
  const raw = decodeKey(source)
  return raw ? { raw, source } : null
}

function sameKey(subscription: PushSubscription, expected: Uint8Array): boolean {
  const current = subscription.options.applicationServerKey
  if (!current) return false
  const bytes = new Uint8Array(current)
  if (bytes.length !== expected.length) return false
  return bytes.every((byte, index) => byte === expected[index])
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(SW_PATH, { scope: '/' })
  return navigator.serviceWorker.ready
}

function toBody(subscription: PushSubscription): PushSubscriptionBody {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
  }
}

/** Registers the worker, asks permission and stores this device's subscription. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new PushSetupError('unsupported')
  const key = await applicationServerKey()
  if (!key) throw new PushSetupError('unavailable')

  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
  if (permission !== 'granted') throw new PushSetupError('denied')

  let subscription: PushSubscription
  try {
    const reg = await registration()
    const existing = await reg.pushManager.getSubscription()
    // A subscription made with a previous VAPID key cannot be used by this
    // server; replace it instead of storing a dead endpoint.
    if (existing && !sameKey(existing, key.raw)) await existing.unsubscribe()
    subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.raw as unknown as BufferSource,
      }))
  } catch (error) {
    recordRecoveredError(error, { feature: 'push', operation: 'subscribe' })
    throw new PushSetupError('subscribe')
  }

  try {
    await api.account.addPushSubscription(toBody(subscription))
  } catch (error) {
    recordRecoveredError(error, { feature: 'push', operation: 'store' })
    throw new PushSetupError('server')
  }
}

/** Unsubscribes this browser and drops its row; other devices stay subscribed. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH)
  const subscription = await reg?.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe().catch(() => undefined)
  await api.account.removePushSubscription(endpoint).catch(() => undefined)
}
