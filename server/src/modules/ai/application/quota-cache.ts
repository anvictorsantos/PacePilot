/**
 * The AI quota cache. One responsibility: remember a successful
 * `/api/plan/ai/week` body for a bounded time so the free tier is not spent
 * answering the same request twice.
 *
 * Why it exists at all: the OpenRouter free tier allows 50 req/day for the whole
 * account, shared by every athlete. The rate limiter protects the server; this
 * protects the quota. Failures are deliberately never cached — a quota error or
 * an outage is transient, and caching it would turn one bad minute into hours of
 * "AI unavailable".
 *
 * The cached unit is the wire payload, not the service's result. That is what
 * lets the route answer a hit before the per-athlete limiter and without
 * rebuilding the deterministic week: the key needs only athlete, week, locale
 * and model.
 */
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

/** The one key builder. Locale and model are segments because two languages and
 *  a model switch are two different generations, not a re-render. */
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

/** Store the body as built. `cached` is a read-side fact: the stored copy stays
 *  false so a second hit is not a hit-of-a-hit. */
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

/**
 * Drop one athlete's cached weeks. Keys are `${athleteId}:${weekKey}:${locale}:${model}`,
 * so a write to any prompt input (activity import, feedback note, goal change)
 * invalidates exactly the athlete it belongs to — clearing everyone would spend
 * other athletes' quota on re-answering unchanged inputs.
 */
export function clearAiCacheForAthlete(athleteId: string) {
  const prefix = `${athleteId}:`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
