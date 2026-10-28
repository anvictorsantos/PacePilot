import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

// The service reads config at import time, so prime the environment first.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000001'

const { freshAccessToken } = await import('@/modules/providers/application/connection.service.ts')
const { encryptToken, decryptToken } = await import(
  '@/modules/shared/infrastructure/utils/tokenCrypto.ts'
)
const { FRESHNESS_WINDOW_MS } = await import('@/modules/providers/domain/tokenExpiry.ts')

const NOW = Date.parse('2026-10-28T09:00:00Z')

function connection(over: Record<string, unknown> = {}) {
  return {
    _id: 'connection-1',
    provider: 'strava',
    athlete: 'athlete-1',
    external_athlete_id: '42',
    access_token: encryptToken('stored-access'),
    refresh_token: encryptToken('stored-refresh'),
    expires_at: new Date(NOW + 10 * 60_000),
    ...over,
  }
}

/** Records provider calls and what the service asked to persist. */
function harness({
  tokens = { accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: new Date(NOW + 6 * 3600_000) },
  delayMs = 5,
} = {}) {
  const calls: string[] = []
  const persisted: Array<Record<string, unknown>> = []
  const deps = {
    now: () => NOW,
    refresh: async (_provider: string, refreshToken: string) => {
      calls.push(refreshToken)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return tokens
    },
    persist: async (
      target: { _id?: unknown },
      pair: { access_token: string | null; refresh_token: string | null; expires_at: Date | null },
    ) => {
      persisted.push({ id: target._id, ...pair })
    },
  }
  return { deps, calls, persisted }
}

describe('freshAccessToken', () => {
  test('uses the stored token when it is more than a minute from expiry', async () => {
    const { deps, calls, persisted } = harness()
    const token = await freshAccessToken(connection(), deps)
    assert.equal(token, 'stored-access')
    assert.deepEqual(calls, [])
    assert.deepEqual(persisted, [])
  })

  test('refreshes a token within a minute of expiry and persists the rotated pair first', async () => {
    const { deps, calls, persisted } = harness()
    const target = connection({ expires_at: new Date(NOW + FRESHNESS_WINDOW_MS - 1000) })
    const token = await freshAccessToken(target, deps)

    assert.equal(token, 'new-access')
    assert.deepEqual(calls, ['stored-refresh'])
    assert.equal(persisted.length, 1)
    assert.equal(decryptToken(String(persisted[0].access_token)), 'new-access')
    assert.equal(decryptToken(String(persisted[0].refresh_token)), 'new-refresh')
    assert.deepEqual(persisted[0].expires_at, new Date(NOW + 6 * 3600_000))
    // The caller's copy carries the new pair, so a later read in the same
    // request does not refresh again.
    assert.equal(decryptToken(String(target.access_token)), 'new-access')
    assert.deepEqual(target.expires_at, new Date(NOW + 6 * 3600_000))
  })

  test('two concurrent reads that both need a refresh make one provider call', async () => {
    const { deps, calls, persisted } = harness()
    const target = connection({ expires_at: new Date(NOW + 1000) })
    const other = connection({ expires_at: new Date(NOW + 1000) })

    const [first, second] = await Promise.all([
      freshAccessToken(target, deps),
      freshAccessToken(other, deps),
    ])

    assert.deepEqual([first, second], ['new-access', 'new-access'])
    assert.equal(calls.length, 1)
    assert.equal(persisted.length, 1)
  })

  test('a migrated 1970 expiry is refreshed once, then used as stored', async () => {
    const { deps, calls, persisted } = harness()
    // The production shape: epoch seconds cast into the date field.
    const target = connection({ expires_at: new Date(1_728_000_000) })

    assert.equal(await freshAccessToken(target, deps), 'new-access')
    assert.equal(calls.length, 1)

    // Next read: the persisted row, as the service wrote it.
    const reloaded = connection({
      access_token: String(persisted[0].access_token),
      refresh_token: String(persisted[0].refresh_token),
      expires_at: persisted[0].expires_at as Date,
    })
    assert.equal(await freshAccessToken(reloaded, deps), 'new-access')
    assert.equal(calls.length, 1)
  })

  test('different connections refresh independently', async () => {
    const { deps, calls } = harness()
    await Promise.all([
      freshAccessToken(connection({ _id: 'a', expires_at: new Date(NOW) }), deps),
      freshAccessToken(connection({ _id: 'b', expires_at: new Date(NOW) }), deps),
    ])
    assert.equal(calls.length, 2)
  })

  test('fails as not-connected rather than looping when there is no refresh token', async () => {
    const { deps, calls } = harness()
    await assert.rejects(
      () => freshAccessToken(connection({ refresh_token: null, expires_at: new Date(NOW) }), deps),
      (error: { code?: string }) => error.code === 'not_connected',
    )
    assert.deepEqual(calls, [])
  })

  test('a failed refresh is not cached: the next read tries again', async () => {
    const { deps, calls, persisted } = harness()
    const failing = {
      ...deps,
      refresh: async (_provider: string, refreshToken: string) => {
        calls.push(refreshToken)
        throw new Error('upstream down')
      },
    }
    const target = connection({ expires_at: new Date(NOW) })
    await assert.rejects(() => freshAccessToken(target, failing), /upstream down/)
    assert.deepEqual(calls, ['stored-refresh'])

    const { deps: okDeps } = harness()
    assert.equal(await freshAccessToken(connection({ expires_at: new Date(NOW) }), okDeps), 'new-access')
    assert.equal(persisted.length, 0)
  })

  test('a transient persist failure is retried, so the rotated grant survives', async () => {
    const { deps } = harness()
    let attempts = 0
    const lost: unknown[] = []
    const flaky = {
      ...deps,
      persist: async (target: unknown, pair: unknown) => {
        attempts++
        if (attempts === 1) throw new Error('mongo blip')
        return deps.persist(target as { _id?: unknown }, pair as never)
      },
      recordGrantLost: async () => {
        lost.push('recorded')
      },
    }

    const token = await freshAccessToken(connection({ expires_at: new Date(NOW) }), flaky)

    assert.equal(token, 'new-access')
    assert.equal(attempts, 2)
    assert.equal(lost.length, 0, 'a retried persist is not a lost grant')
  })

  test('a persist that fails twice is recorded and reported as a lost grant', async () => {
    const { deps } = harness()
    let attempts = 0
    const lost: unknown[] = []
    const broken = {
      ...deps,
      persist: async () => {
        attempts++
        throw new Error('mongo down')
      },
      recordGrantLost: async () => {
        lost.push('recorded')
      },
    }

    await assert.rejects(
      () => freshAccessToken(connection({ expires_at: new Date(NOW) }), broken),
      (error: { code?: string; message?: string }) =>
        error.code === 'not_connected' && /reconnect strava/.test(String(error.message)),
    )
    assert.equal(attempts, 2, 'one retry, never a loop')
    assert.equal(lost.length, 1)
  })

  test('a stale snapshot does not overwrite the grant another instance stored', async () => {
    const { deps } = harness()
    const winner = {
      access_token: encryptToken('winner-access'),
      refresh_token: encryptToken('winner-refresh'),
      expires_at: new Date(NOW + 5 * 3600_000),
    }
    const losing = {
      ...deps,
      persist: async () => ({ stored: false, supersededBy: winner }),
    }
    const target = connection({ expires_at: new Date(NOW) })

    const token = await freshAccessToken(target, losing)

    // The loser's own pair was already rotated away by the winner: use the
    // stored grant, and carry it on this request's connection.
    assert.equal(token, 'winner-access')
    assert.equal(decryptToken(String(target.access_token)), 'winner-access')
    assert.equal(decryptToken(String(target.refresh_token)), 'winner-refresh')
    assert.deepEqual(target.expires_at, winner.expires_at)
  })

  test('losing the race with nothing stored fails as not-connected, never silently', async () => {
    const { deps } = harness()
    const losing = {
      ...deps,
      persist: async () => ({ stored: false, supersededBy: null }),
    }

    await assert.rejects(
      () =>
        freshAccessToken(connection({ expires_at: new Date(NOW) }), losing),
      (error: { code?: string }) => error.code === 'not_connected',
    )
  })
})
