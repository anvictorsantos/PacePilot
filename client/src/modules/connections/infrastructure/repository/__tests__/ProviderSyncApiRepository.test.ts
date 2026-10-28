import { afterEach, describe, expect, it } from 'vitest'

import { SyncStatus } from '@/modules/connections/domain/value-object/SyncStatus.ts'
import { ProviderSyncApiRepository } from '@/modules/connections/infrastructure/repository/ProviderSyncApiRepository.ts'
import { http } from '@/modules/shared/infrastructure/http/client.ts'

const defaultAdapter = http.defaults.adapter

interface Call {
  method: string
  url: string
}

/** Answers `/providers/status` and records every request, so a spent sync is visible. */
function server(status: unknown, sync: unknown = {}) {
  const calls: Call[] = []
  http.defaults.adapter = async (config) => {
    const call = { method: String(config.method).toUpperCase(), url: String(config.url) }
    calls.push(call)
    const data = call.url.includes('/sync') ? sync : status
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return calls
}

describe('ProviderSyncApiRepository', () => {
  afterEach(() => {
    if (defaultAdapter) http.defaults.adapter = defaultAdapter
  })

  it('spends no sync request when no provider is linked', async () => {
    const calls = server({ connected: false, provider: null, last_synced_at: null })

    const outcome = await new ProviderSyncApiRepository().importActivities({ force: true })

    expect(calls.filter((call) => call.url.endsWith('/sync'))).toHaveLength(0)
    expect(outcome.status).toBe(SyncStatus.Disconnected)
    expect(outcome.imported).toBe(0)
  })

  it('asks for a forced import and reads existing rows as updated', async () => {
    const calls = server(
      { connected: true, provider: 'strava', last_synced_at: null },
      { imported: 1, skipped: 4, guarded: false },
    )

    const outcome = await new ProviderSyncApiRepository().importActivities({ force: true })

    expect(calls).toContainEqual({ method: 'POST', url: '/providers/strava/sync?force=1' })
    expect(outcome).toMatchObject({ imported: 1, updated: 4, status: SyncStatus.Completed })
  })

  it('reports the server freshness window as throttled, not as a completed import', async () => {
    server(
      { connected: true, provider: 'strava', last_synced_at: '2026-10-28T00:00:00.000Z' },
      { imported: 0, skipped: 0, guarded: true },
    )

    const outcome = await new ProviderSyncApiRepository().importActivities()

    expect(outcome.status).toBe(SyncStatus.Throttled)
  })
})
