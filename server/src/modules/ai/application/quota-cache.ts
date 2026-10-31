// Caches the wire payload so the shared 50 req/day OpenRouter free tier is not
// spent twice; failures are never cached, so a bad minute does not become hours.
import type { AiLocale, AiWeekPayload } from '@/modules/ai/domain/coaching-contract.ts'

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
const cache = new Map<string, { at: number; payload: AiWeekPayload }>()

export const cacheTtlMs = TTL_MS

/** Locale and model are key segments: either is a different generation, not a re-render. */
export function aiCacheKey(input: {
  athleteId: string
  weekKey: string
  locale: AiLocale
  model: string
}): string {
  return `${input.athleteId}:${input.weekKey}:${input.locale}:${input.model}`
}

/** Cached payload marked `cached: true`, or null when missing/expired. */
export function cacheGet(key: string): AiWeekPayload | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key)
    return null
  }
  cache.delete(key) // refresh LRU position
  cache.set(key, hit)
  return { ...hit.payload, cached: true }
}

/** Stores with `cached: false`: the flag is a read-side fact, so a hit is not a hit-of-a-hit. */
export function cacheSet(key: string, payload: AiWeekPayload) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { at: Date.now(), payload: { ...payload, cached: false } })
}

export function clearAiCache() {
  cache.clear()
}

// Drop one athlete's weeks only: clearing everyone would spend other athletes'
// quota re-answering unchanged inputs.
export function clearAiCacheForAthlete(athleteId: string) {
  const prefix = `${athleteId}:`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
