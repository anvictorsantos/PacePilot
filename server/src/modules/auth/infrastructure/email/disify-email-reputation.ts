import {
  emailDomain,
  type EmailReputationChecker,
  type EmailReputationVerdict,
} from '@/modules/auth/domain/email-reputation.ts'

const DISIFY_ENDPOINT = 'https://disify.com/api/email'
const TIMEOUT_MS = 2500
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 1000

interface CacheEntry {
  verdict: EmailReputationVerdict
  expiresAt: number
}

/**
 * Disify answers anonymously at 30 requests/minute per egress IP, so the domain cache
 * is what keeps normal signup traffic inside that budget. Failures are never cached:
 * an outage must not pin every address to the same verdict for a day.
 */
export class DisifyEmailReputation implements EmailReputationChecker {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number

  constructor(fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
    this.fetchImpl = fetchImpl
    this.now = now
  }

  async check(email: string): Promise<EmailReputationVerdict | null> {
    const domain = emailDomain(email)
    if (!domain) return null

    const cached = this.read(domain)
    if (cached) return cached

    const verdict = await this.lookup(domain)
    if (verdict) this.write(domain, verdict)
    return verdict
  }

  private async lookup(domain: string): Promise<EmailReputationVerdict | null> {
    // The probe local part keeps the athlete's real address out of the third-party log.
    const url = `${DISIFY_ENDPOINT}/${encodeURIComponent(`probe@${domain}`)}`
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) {
        console.warn(`[email-reputation] disify answered ${response.status} for ${domain} — allowing`)
        return null
      }
      const body: unknown = await response.json()
      const disposable = (body as { disposable?: unknown } | null)?.disposable
      if (typeof disposable !== 'boolean') {
        console.warn(`[email-reputation] unrecognised payload for ${domain} — allowing`)
        return null
      }
      return { disposable }
    } catch (error) {
      console.warn(
        `[email-reputation] lookup failed for ${domain} — allowing:`,
        error instanceof Error ? error.message : error,
      )
      return null
    }
  }

  private read(domain: string): EmailReputationVerdict | null {
    const entry = this.cache.get(domain)
    if (!entry) return null
    if (entry.expiresAt <= this.now()) {
      this.cache.delete(domain)
      return null
    }
    return entry.verdict
  }

  private write(domain: string, verdict: EmailReputationVerdict): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    this.cache.set(domain, { verdict, expiresAt: this.now() + CACHE_TTL_MS })
  }
}

let shared: DisifyEmailReputation | null = null

export function emailReputationChecker(): EmailReputationChecker {
  shared ??= new DisifyEmailReputation()
  return shared
}
