/**
 * The AI quota cache. One responsibility: remember a successful athlete-week
 * result for a bounded time so the free tier is not spent answering the same
 * request twice.
 *
 * Why it exists at all: the OpenRouter free tier allows 50 req/day for the whole
 * account, shared by every athlete. The rate limiter protects the server; this
 * protects the quota. Failures are deliberately never cached — a quota error or
 * an outage is transient, and caching it would turn one bad minute into hours of
 * "AI unavailable".
 */
import type { AiWeekResult } from '@/modules/ai/domain/coaching-contract.ts'

function numEnv(name: string, fallback: number, bounds: { min: number; max: number }) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  return Math.min(Math.max(raw, bounds.min), bounds.max)
}

const TTL_MS = Math.max(
  60_000,
  numEnv('AI_CACHE_TTL_MS', 6 * 3600_000, { min: 60_000, max: 24 * 3600_000 })
)
const MAX_ENTRIES = 500

/** Insertion-ordered, so `keys().next()` is the least recently used entry. */
const cache = new Map<string, { at: number; result: AiWeekResult }>()

export const cacheTtlMs = TTL_MS

/** Cached result marked `cached: true`, or null when missing/expired. */
export function cacheGet(key: string): AiWeekResult | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key)
    return null
  }
  cache.delete(key) // refresh LRU position
  cache.set(key, hit)
  return { ...hit.result, cached: true }
}

export function cacheSet(key: string, result: AiWeekResult) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { at: Date.now(), result })
}

export function clearAiCache() {
  cache.clear()
}

/**
 * Drop one athlete's cached weeks. Keys are `${athleteId}:${weekKey}:${model}`,
 * so a new activity invalidates exactly the athlete it belongs to — clearing
 * everyone would spend other athletes' quota on re-answering unchanged inputs.
 */
export function clearAiCacheForAthlete(athleteId: string) {
  const prefix = `${athleteId}:`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
