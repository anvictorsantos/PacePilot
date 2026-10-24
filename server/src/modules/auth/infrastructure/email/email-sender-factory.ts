import { env } from '@/modules/shared/infrastructure/config/env.ts'
import type { EmailMessage, EmailSender } from '@/modules/auth/domain/email-sender.ts'
import { ResendEmailSender } from '@/modules/auth/infrastructure/email/resend-email-sender.ts'

/**
 * Dev adapter. It prints the plain-text body (which contains the action link)
 * so a local flow can be completed without a provider account. Never selected in
 * production — a missing key there is an error, not a silent drop.
 */
class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.info(`[email] to=${message.to} subject="${message.subject}"`)
    console.info(message.text)
  }
}

export function emailSender(): EmailSender {
  if (env.emailEnabled && env.resendApiKey) {
    return new ResendEmailSender(env.resendApiKey, env.emailFrom, env.emailReplyTo)
  }
  if (env.nodeEnv === 'production') {
    throw new Error('RESEND_API_KEY is not configured — transactional email cannot be sent')
  }
  return new ConsoleEmailSender()
}
