import { emailSender } from '@/modules/auth/infrastructure/email/email-sender-factory.ts'
import type { EmailLocale } from '@/modules/auth/domain/email-sender.ts'
import { weeklySummaryEmail, type WeeklySummaryInput } from '@/modules/notifications/domain/messages.ts'

export async function sendWeeklySummary(
  to: string | null | undefined,
  locale: EmailLocale,
  input: WeeklySummaryInput,
): Promise<boolean> {
  if (!to) return false
  const rendered = weeklySummaryEmail(locale, input)
  try {
    await emailSender().send({ to, ...rendered })
    return true
  } catch (error) {
    // The tick logs and the next scheduled run retries; never log the address.
    console.warn(
      '[notifications] weekly summary failed:',
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}
