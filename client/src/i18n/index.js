import { createI18n } from 'vue-i18n'
import { watch } from 'vue'
import pt from './pt.json'
import en from './en.json'

const STORAGE_KEY = 'pacepilot-locale'

function detectLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'pt' || stored === 'en') return stored
  } catch {}
  return 'pt'
}

export const SUPPORTED = ['pt', 'en']

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'pt',
  messages: { pt, en },
  datetimeFormats: {
    pt: { short: { day: 'numeric', month: 'short' }, long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } },
    en: { short: { day: 'numeric', month: 'short' }, long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } },
  },
  numberFormats: {
    pt: { decimal: { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 } },
    en: { decimal: { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 } },
  },
})

export function currentLocale() {
  return i18n.global.locale.value
}

export function setLocale(next) {
  if (!SUPPORTED.includes(next)) return
  i18n.global.locale.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {}
  document.documentElement.lang = next === 'pt' ? 'pt-PT' : 'en'
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLocale() === 'pt' ? 'pt-PT' : 'en'
  document.title = i18n.global.t('common.siteTitle')
  watch(i18n.global.locale, (newLocale) => {
    document.title = i18n.global.t('common.siteTitle')
    document.documentElement.lang = newLocale === 'pt' ? 'pt-PT' : 'en'
  })
}
