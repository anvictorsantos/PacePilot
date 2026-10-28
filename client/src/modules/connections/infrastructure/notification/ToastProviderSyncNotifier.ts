import { i18n } from '@/i18n'
import type { ProviderSyncNotifier } from '@/modules/connections/domain/service/provider-sync-notifier.ts'
import { apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

/** Tells the athlete through the toast stack; the copy lives in the catalogue. */
export class ToastProviderSyncNotifier implements ProviderSyncNotifier {
  imported(count: number): void {
    this.show(
      i18n.global.t(count === 1 ? 'strava.sync.importedOne' : 'strava.sync.importedOther', {
        n: count,
      }),
      ToastType.Success,
    )
  }

  updated(count: number): void {
    this.show(
      i18n.global.t(count === 1 ? 'strava.sync.updatedOne' : 'strava.sync.updatedOther', {
        n: count,
      }),
      ToastType.Success,
    )
  }

  importedAndUpdated(imported: number, updated: number): void {
    this.show(
      i18n.global.t('strava.sync.importedAndUpdated', {
        n: imported + updated,
        imported,
        updated,
      }),
      ToastType.Success,
    )
  }

  upToDate(): void {
    this.show(i18n.global.t('strava.sync.upToDate'), ToastType.Info)
  }

  throttled(): void {
    this.show(i18n.global.t('strava.sync.throttled'), ToastType.Info)
  }

  disconnected(): void {
    this.show(
      i18n.global.t('strava.sync.disconnected', {
        provider: i18n.global.t('providers.strava'),
      }),
      ToastType.Warning,
    )
  }

  failed(error: unknown): void {
    const status = (error as { response?: { status?: number } })?.response?.status
    this.show(
      apiErrorMessage(error, i18n.global.t('strava.sync.failed')),
      status === 429 ? ToastType.Warning : ToastType.Error,
    )
  }

  private show(message: string, type: ToastType): void {
    const { show } = useToast()
    show(message, { type })
  }
}
