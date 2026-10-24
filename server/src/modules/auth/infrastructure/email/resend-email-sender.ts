import type { EmailMessage, EmailSender } from '@/modules/auth/domain/email-sender.ts'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Resend HTTPS API adapter. Plain `fetch` — no SDK dependency.
 *
 * The API key stays in env and never appears in a log line. Provider errors are
 * truncated: they describe the request, not our credentials.
 */
export class ResendEmailSender implements EmailSender {
  private readonly apiKey: string
  private readonly from: string
  private readonly replyTo?: string

  constructor(apiKey: string, from: string, replyTo?: string) {
    this.apiKey = apiKey
    this.from = from
    this.replyTo = replyTo
  }

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(this.replyTo ? { reply_to: this.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200)
      throw new Error(`Resend rejected the email (${response.status}): ${detail}`)
    }
  }
}
