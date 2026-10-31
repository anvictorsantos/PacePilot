import type { FeedbackStatus } from '@/modules/feedback/domain/value-object/FeedbackStatus.ts'

// Port the module's subscribers talk to: the domain decides what happened, the
// adapter behind it decides how the athlete is told.
export interface RunDayNotifier {
  feedbackSaved(status: FeedbackStatus): void
}
