import { i18n } from '@/i18n'
import type { RunDayNotifier } from '@/modules/run-day/domain/service/run-day-notifier.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

/** Tells the athlete through the toast stack; the copy lives in the catalogue. */
export class ToastRunDayNotifier implements RunDayNotifier {
  feedbackSaved(): void {
    const { show } = useToast()
    show(i18n.global.t('landing.sections.today.toast.feedbackSaved'), {
      type: ToastType.Success,
    })
  }
}
