<template>
  <div
    class="flex items-center gap-1"
    role="group"
    :aria-label="$t('ui.language')"
  >
    <button
      v-for="l in locales"
      :key="l.code"
      :aria-pressed="current === l.code"
      :aria-label="l.label"
      class="flex min-h-touch min-w-touch items-center justify-center rounded-lg px-2 text-caption font-bold transition"
      :class="current === l.code ? 'bg-white/10 text-white' : 'text-muted hover:text-white'"
      @click="setLocale(l.code)"
    >
      {{ l.short }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { setLocale } from '@/i18n/index.js'

const { locale } = useI18n()
const current = computed(() => locale.value)
const locales = [
  { code: 'pt', short: 'PT', label: 'Português (Portugal)' },
  { code: 'en', short: 'EN', label: 'English' },
]
</script>
