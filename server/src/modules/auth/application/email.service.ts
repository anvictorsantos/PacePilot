/**
 * Composes and sends the two account emails. Delivery is best-effort: an
 * account must still be usable when the provider is briefly down, and the
 * resend endpoint exists for exactly that case.
 */
import { env } from '@/modules/shared/infrastructure/config/env.ts'
import { emailSender } from '@/modules/auth/infrastructure/email/email-sender-factory.ts'
import { renderEmail } from '@/modules/auth/infrastructure/email/templates.ts'
import type { EmailLocale } from '@/modules/auth/domain/email-sender.ts'

function actionUrl(path: string, token: string): string {
  return `${env.appUrl}${path}?token=${encodeURIComponent(token)}`
}

async function deliver(
  kind: 'verification' | 'reset',
  to: string,
  token: string,
  locale: EmailLocale,
): Promise<void> {
  const path = kind === 'verification' ? '/verify-email' : '/reset-password'
  const url = actionUrl(path, token)
  const rendered = renderEmail(kind, locale, url, to)

  try {
    await emailSender().send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })
  } catch (error) {
    // Never include the token or the link. The athlete can request another one.
    console.warn(
      `[email] ${kind} delivery failed:`,
      error instanceof Error ? error.message : String(error),
    )
  }
}

export function sendVerificationEmail(to: string | null, token: string, locale: EmailLocale): Promise<void> {
  if (!to) return Promise.resolve()
  return deliver('verification', to, token, locale)
}

export function sendPasswordResetEmail(to: string | null, token: string, locale: EmailLocale): Promise<void> {
  if (!to) return Promise.resolve()
  return deliver('reset', to, token, locale)
}
