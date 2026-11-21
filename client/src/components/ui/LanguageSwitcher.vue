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
      :aria-label="`${l.short} — ${l.label}`"
      class="cursor-pointer flex min-h-touch items-center justify-center rounded-lg transition"
      :class="[
        full ? 'px-3 py-1.5 text-body' : 'min-w-touch px-2 text-caption font-medium',
        current === l.code ? 'bg-white/10 text-primary' : 'text-muted hover:text-primary',
      ]"
      @click="setLocale(l.code)"
    >
      {{ full ? l.label.split(' ')[0] : l.short }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { setLocale } from '@/i18n/index.ts'

defineProps({ full: { type: Boolean, default: false } })

const { locale } = useI18n()
const current = computed(() => locale.value)
const locales = [
  { code: 'pt', short: 'PT', label: 'Português (Portugal)' },
  { code: 'en', short: 'EN', label: 'English' },
]
</script>
