import crypto from 'node:crypto'

const PREFIX = 'enc:v1:'
let warned = false

function warnOnce(msg: string) {
  if (!warned) {
    warned = true
    console.warn(msg)
  }
}

/** `error.message` for a real Error, else undefined — mirrors the old `error?.message`. */
function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

// 32-byte key from TOKEN_ENCRYPTION_KEY (hex 64 / base64 44 / raw → sha256).
// Unset → passthrough (back-compat) with one warning. Set key in prod.
function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) {
    warnOnce('[crypto] TOKEN_ENCRYPTION_KEY unset — tokens stored plaintext. Set it before prod deploy.')
    return null
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  if (/^[A-Za-z0-9+/=]{40,}$/.test(raw)) {
    try {
      const b = Buffer.from(raw, 'base64')
      if (b.length === 32) return b
    } catch (error) {
      // fallback to sha256 below
      console.debug('[crypto] invalid base64 token key:', errorMessage(error))
    }
  }
  return crypto.createHash('sha256').update(raw).digest()
}

export function encryptToken(plain: string): string {
  if (!plain || typeof plain !== 'string') return plain
  if (plain.startsWith(PREFIX)) return plain // already encrypted
  const key = getKey()
  if (!key) return plain
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`
}

export function decryptToken(stored: string): string {
  if (!stored || typeof stored !== 'string') return stored
  if (!stored.startsWith(PREFIX)) return stored // legacy plaintext row
  const key = getKey()
  if (!key) {
    warnOnce('[crypto] Cannot decrypt token without TOKEN_ENCRYPTION_KEY.')
    return stored
  }
  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) return stored
  try {
    const [ivB, ctB, tagB] = parts
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8')
  } catch (error) {
    warnOnce(`[crypto] Failed to decrypt stored token: ${errorMessage(error) || 'unknown error'}`)
    return stored
  }
}
