export type EmailLocale = 'pt' | 'en'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>
}

/** `pt-PT`, `pt-BR`, `pt` all get Portuguese; everything else gets English. */
export function emailLocaleFrom(acceptLanguage: unknown): EmailLocale {
  const value = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage
  return typeof value === 'string' && /^\s*pt\b/i.test(value) ? 'pt' : 'en'
}
