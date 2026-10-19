import { i18n } from '@/i18n'
import { apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'
import type { StravaSyncNotifier } from '@/modules/strava/domain/service/strava-sync-notifier.ts'

/** Tells the athlete through the toast stack; the copy lives in the catalogue. */
export class ToastStravaSyncNotifier implements StravaSyncNotifier {
  imported(count: number): void {
    const { show } = useToast()
    show(
      i18n.global.t(count === 1 ? 'strava.sync.importedOne' : 'strava.sync.importedOther', {
        n: count,
      }),
      { type: ToastType.Success },
    )
  }

  upToDate(): void {
    const { show } = useToast()
    show(i18n.global.t('strava.sync.upToDate'), { type: ToastType.Info })
  }

  failed(error: unknown): void {
    const status = (error as { response?: { status?: number } })?.response?.status
    const { show } = useToast()
    show(apiErrorMessage(error, i18n.global.t('strava.sync.failed')), {
      type: status === 429 ? ToastType.Warning : ToastType.Error,
    })
  }
}
