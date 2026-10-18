import type { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'

/**
 * Domain service the module's subscribers talk to. The domain decides *what*
 * happened; the adapter behind this port decides how the athlete is told (a
 * toast, today). Mirrors the reference's `domain/service/email.service.ts`.
 */
export interface RunDayNotifier {
  feedbackSaved(status: FeedbackStatus): void
}
