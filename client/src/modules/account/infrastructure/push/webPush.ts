import type { PushSubscriptionBody } from '@/modules/account/infrastructure/dto/CoachingPreferences.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

const SW_PATH = '/sw.js'

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

async function applicationServerKey(): Promise<BufferSource | null> {
  let value = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!value) value = (await api.account.pushKey().catch(() => ({ key: '' }))).key
  if (!value) return null
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  try {
    const raw = atob(base64)
    return Uint8Array.from(raw, (char) => char.charCodeAt(0)) as unknown as BufferSource
  } catch {
    return null
  }
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
  if (!pushSupported()) throw new Error('unsupported')
  const key = await applicationServerKey()
  if (!key) throw new Error('unavailable')

  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
  if (permission !== 'granted') throw new Error('denied')

  const reg = await registration()
  const existing = await reg.pushManager.getSubscription()
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    }))
  await api.account.addPushSubscription(toBody(subscription))
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
