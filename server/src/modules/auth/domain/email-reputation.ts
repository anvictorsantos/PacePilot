// Pure vocabulary for the disposable-address check. The network lives in infrastructure.

export interface EmailReputationVerdict {
  disposable: boolean
}

export interface EmailReputationChecker {
  /** `null` means the verdict could not be established; callers decide what to do with unknown. */
  check(email: string): Promise<EmailReputationVerdict | null>
}

/** The domain is the only part a provider needs: the local part never leaves the server. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return null
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.+$/, '')
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)
    ? domain
    : null
}
