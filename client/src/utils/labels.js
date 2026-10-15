/** Shared workout labels — single source for titles, type names and RPE labels. */
import { i18n } from '@/i18n'

function t(key) {
  return i18n.global.t(key)
}

export const TITLE_MAP = {
  easy: 'ui.title_easy',
  tempo: 'ui.title_tempo',
  long: 'ui.title_long',
  threshold: 'ui.title_threshold',
  interval: 'ui.title_interval',
  recovery: 'ui.title_recovery',
  steady: 'ui.title_steady',
  unknown: 'ui.title_unknown',
}

export function activityTitle(a) {
  if (a?.name && a.name !== 'Run') return a.name
  const key = TITLE_MAP[a?.workout_type] || TITLE_MAP.unknown
  return t(key)
}

export const WORKOUT_TYPE_NAMES = {
  tempo: 'ui.type_tempo',
  interval: 'ui.type_interval',
  threshold: 'ui.type_threshold',
  steady: 'ui.type_steady',
  easy: 'ui.type_easy',
  recovery: 'ui.type_recovery',
  long: 'ui.type_long',
}

export const INTENSITY_LABELS = {
  recovery: 'ui.intensity_recovery',
  easy: 'ui.intensity_easy',
  long: 'ui.intensity_long',
  steady: 'ui.intensity_steady',
  tempo: 'ui.intensity_tempo',
  threshold: 'ui.intensity_threshold',
  interval: 'ui.intensity_interval',
}
