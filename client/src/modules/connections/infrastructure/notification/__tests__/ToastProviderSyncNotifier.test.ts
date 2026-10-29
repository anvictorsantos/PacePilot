import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import { ToastProviderSyncNotifier } from '@/modules/connections/infrastructure/notification/ToastProviderSyncNotifier.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

const { toasts, dismiss } = useToast()
const notifier = new ToastProviderSyncNotifier()

function lastToast() {
  const list = toasts.value
  const toast = list[list.length - 1]
  if (!toast) throw new Error('no toast was raised')
  return toast
}

/** What axios rejects with: the status lives on `response`. */
function httpError(status: number, body: unknown = {}) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { data: body, status, statusText: 'ERR', headers: {} },
  })
}

describe('ToastProviderSyncNotifier', () => {
  beforeEach(() => {
    for (const toast of [...toasts.value]) dismiss(toast.id)
  })

  it('tells the athlete to retry when the data store is down, not that sync broke', () => {
    // The incident: a database-less server answers 503 on POST /strava/sync,
    // which is the designed behaviour of every data route.
    notifier.failed(httpError(503))

    const toast = lastToast()
    expect(toast.type).toBe(ToastType.Warning)
    // Copy is locale-dependent: assert the catalogue entry, not English text.
    expect(toast.message).toBe(i18n.global.t('strava.sync.unavailable'))
  })

  it('prefers the server copy for a 4xx it can explain', () => {
    notifier.failed(httpError(429, { error: 'Strava rate limit reached' }))

    const toast = lastToast()
    expect(toast.type).toBe(ToastType.Warning)
    expect(toast.message).toBe('Strava rate limit reached')
  })

  it('reports an unexplained failure as an error, not a warning', () => {
    notifier.failed(httpError(500))

    const toast = lastToast()
    expect(toast.type).toBe(ToastType.Error)
    expect(toast.message).toBe(i18n.global.t('strava.sync.failed'))
  })

  it('survives a failure with no response at all', () => {
    // The offline path: no status to read, so the generic copy is the answer.
    notifier.failed(Object.assign(new Error('Network Error'), { isAxiosError: true }))

    expect(lastToast().type).toBe(ToastType.Error)
  })
})
