import { watch } from 'vue'
import { createI18n } from 'vue-i18n'

import pt from '@/i18n/pt.json'
import { recordRecoveredError } from '@/modules/shared/infrastructure/observability/logger.ts'

// pt is the default and fallback, so it ships in the entry chunk; every other catalogue
// is its own chunk, fetched on first use (~21 kB minified each).

const STORAGE_KEY = 'pacepilot-locale'

export type Locale = 'pt' | 'en'

type Catalogue = typeof pt

const CATALOGUES: Record<Exclude<Locale, 'pt'>, () => Promise<{ default: Catalogue }>> = {
  en: () => import('./en.json'),
}

const loaded = new Set<Locale>(['pt'])

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'pt' || stored === 'en') return stored
  } catch (error) {
    recordRecoveredError(error)
  }
  return 'pt'
}

export const SUPPORTED: Locale[] = ['pt', 'en']

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'pt',
  messages: { pt },
  datetimeFormats: {
    pt: {
      short: { day: 'numeric', month: 'short' },
      long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    },
    en: {
      short: { day: 'numeric', month: 'short' },
      long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    },
  },
  numberFormats: {
    pt: { decimal: { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 } },
    en: { decimal: { style: 'decimal', minimumFractionDigits: 1, maximumFractionDigits: 1 } },
  },
})

export function currentLocale(): Locale {
  return i18n.global.locale.value === 'en' ? 'en' : 'pt'
}

function isSupported(value: string): value is Locale {
  return SUPPORTED.some((locale) => locale === value)
}

function syncDocument() {
  if (typeof document === 'undefined') return
  // The active locale's catalogue can still be in flight (en is a lazy chunk):
  // translating now would warn and fall back to pt. loadLocale syncs after.
  const locale = currentLocale()
  if (!loaded.has(locale)) return
  document.title = i18n.global.t('common.siteTitle')
  document.documentElement.lang = locale === 'pt' ? 'pt-PT' : 'en'
}

// A locale that is already loaded resolves immediately, so boot and switches can
// await this unconditionally.
export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === 'pt' || loaded.has(locale)) return
  const { default: messages } = await CATALOGUES[locale]()
  i18n.global.setLocaleMessage(locale, messages)
  loaded.add(locale)
  syncDocument()
}

export async function setLocale(next: string): Promise<void> {
  if (!isSupported(next)) return
  try {
    await loadLocale(next)
  } catch (error) {
    // Stay on the current locale rather than switch to a catalogue that never arrived.
    recordRecoveredError(error)
    return
  }
  i18n.global.locale.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch (error) {
    recordRecoveredError(error)
  }
}

if (typeof document !== 'undefined') {
  syncDocument()
  watch(i18n.global.locale, syncDocument)
}
