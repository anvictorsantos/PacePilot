import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { resetResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { http } from '@/modules/shared/infrastructure/http/client.ts'

const defaultAdapter = http.defaults.adapter

const SESSION = {
  authenticated: true,
  user: { email: 'runner@example.com', firstname: null, lastname: null, profile: null },
  strava: { connected: false, promptSeen: false },
}

function respond(body: unknown, status = 200) {
  http.defaults.adapter = async (config) => ({
    data: body,
    status,
    statusText: 'OK',
    headers: {},
    config,
  })
}

describe('useAuth', () => {
  afterEach(() => {
    if (defaultAdapter) http.defaults.adapter = defaultAdapter
    resetResource()
  })

  it('reports an anonymous session without throwing', async () => {
    respond({ authenticated: false, user: null, strava: { connected: false, promptSeen: false } })
    const { ensure, authenticated } = useAuth()
    await expect(ensure()).resolves.toBe(false)
    expect(authenticated.value).toBe(false)
  })

  it('registers and applies the returned session', async () => {
    respond(SESSION, 201)
    const { register, authenticated, user, strava } = useAuth()
    await register('runner@example.com', 'correct horse')
    expect(authenticated.value).toBe(true)
    expect(user.value?.email).toBe('runner@example.com')
    expect(strava.value.connected).toBe(false)
  })

  it('logs in and keeps the Strava link state', async () => {
    respond({ ...SESSION, strava: { connected: true, promptSeen: true } })
    const { login, strava } = useAuth()
    await login('runner@example.com', 'correct horse')
    expect(strava.value.connected).toBe(true)
    expect(strava.value.promptSeen).toBe(true)
  })

  it('clears the session on logout', async () => {
    respond(SESSION)
    const { login, logout, authenticated } = useAuth()
    await login('runner@example.com', 'correct horse')
    respond({ ok: true })
    await logout()
    expect(authenticated.value).toBe(false)
  })

  it('reads /auth/session once for concurrent callers', async () => {
    const calls = vi.fn()
    http.defaults.adapter = async (config) => {
      calls()
      return { data: SESSION, status: 200, statusText: 'OK', headers: {}, config }
    }
    await Promise.all([useAuth().ensure(true), useAuth().ensure(true)])
    expect(calls).toHaveBeenCalledTimes(1)
  })
})
