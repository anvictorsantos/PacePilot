import { i18n } from '@/i18n'

// One mapping from a connect failure code to copy, shared by the live flow and the
// `?error=` redirect, so the same failure never reads two ways.
export function providerConnectErrorMessage(code: string): string {
  const t = i18n.global.t
  switch (code) {
    case 'popup_blocked':
      return t('auth.connectModal.errors.popupBlocked')
    case 'app_full':
      return t('auth.connectModal.errors.appFull')
    case 'already_linked':
    case 'strava_already_linked':
      return t('auth.connectModal.errors.alreadyLinked')
    case 'timeout':
      return t('auth.connectModal.errors.timeout')
    case 'connect_requires_login':
      return t('auth.connectModal.errors.loginFirst')
    case 'missing_activity_scope':
      return t('auth.connectModal.errors.missingActivityScope')
    default:
      return t('auth.connectModal.errors.generic')
  }
}
