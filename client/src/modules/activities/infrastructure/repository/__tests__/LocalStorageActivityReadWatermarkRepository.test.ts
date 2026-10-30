/**
 * The watermark survives a reload and never crosses accounts. Both are storage
 * properties, so they are pinned here: one key per account id, and an unknown
 * account is refused rather than written under a shared key.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark'
import { LocalStorageActivityReadWatermarkRepository } from '@/modules/activities/infrastructure/repository/LocalStorageActivityReadWatermarkRepository'

const AT_09 = ActivityReadWatermark.fromPrimitives('2026-10-28T09:00:00.000Z')
const AT_10 = ActivityReadWatermark.fromPrimitives('2026-10-28T10:00:00.000Z')

function storage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial))
  return {
    entries,
    api: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LocalStorageActivityReadWatermarkRepository', () => {
  it('reads back what was saved, so a reload keeps the feed read', () => {
    vi.stubGlobal('localStorage', storage().api)

    new LocalStorageActivityReadWatermarkRepository().save('athlete-a', AT_09)

    // A fresh instance is what the next page load gets.
    const watermark = new LocalStorageActivityReadWatermarkRepository().load('athlete-a')
    expect(watermark.toPrimitives()).toBe(AT_09.toPrimitives())
  })

  it('starts an account clean while leaving the other one alone', () => {
    const { api } = storage()
    vi.stubGlobal('localStorage', api)
    const repository = new LocalStorageActivityReadWatermarkRepository()

    repository.save('athlete-a', AT_09)
    repository.save('athlete-b', AT_10)

    expect(repository.load('athlete-a').toPrimitives()).toBe(AT_09.toPrimitives())
    expect(repository.load('athlete-b').toPrimitives()).toBe(AT_10.toPrimitives())
    expect(repository.load('athlete-c').isNever()).toBe(true)
  })

  it('does not carry one account watermark over when another signs in', () => {
    const { api } = storage()
    vi.stubGlobal('localStorage', api)
    const repository = new LocalStorageActivityReadWatermarkRepository()

    repository.save('athlete-a', AT_10)

    expect(repository.load('athlete-b').covers(new Date('2026-10-28T09:30:00.000Z'))).toBe(false)
  })

  it('reads an unknown or unreadable value as never looked', () => {
    vi.stubGlobal(
      'localStorage',
      storage({
        'activity-read:athlete-a': 'null',
        'activity-read:athlete-b': 'not-a-date',
      }).api,
    )
    const repository = new LocalStorageActivityReadWatermarkRepository()

    expect(repository.load('athlete-a').isNever()).toBe(true)
    expect(repository.load('athlete-b').isNever()).toBe(true)
  })

  it('refuses to store without an account id', () => {
    const { api, entries } = storage()
    vi.stubGlobal('localStorage', api)
    const repository = new LocalStorageActivityReadWatermarkRepository()

    expect(repository.load('').isNever()).toBe(true)
    repository.save('', AT_09)

    expect([...entries.keys()]).toEqual([])
  })

  it('survives a storage that refuses to answer', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    const repository = new LocalStorageActivityReadWatermarkRepository()

    expect(() => repository.save('athlete-a', AT_09)).not.toThrow()
    expect(repository.load('athlete-a').isNever()).toBe(true)
    expect(() => repository.clear('athlete-a')).not.toThrow()
  })

  it('clears only the account it is told to', () => {
    const { api } = storage()
    vi.stubGlobal('localStorage', api)
    const repository = new LocalStorageActivityReadWatermarkRepository()

    repository.save('athlete-a', AT_09)
    repository.save('athlete-b', AT_10)
    repository.clear('athlete-a')

    expect(repository.load('athlete-a').isNever()).toBe(true)
    expect(repository.load('athlete-b').toPrimitives()).toBe(AT_10.toPrimitives())
  })
})
