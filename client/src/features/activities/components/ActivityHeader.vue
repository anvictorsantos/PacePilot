<template>
  <div class="flex items-center gap-3">
    <RouterLink
      to="/activities"
      class="w-9 h-9 shrink-0 flex items-center justify-center bg-card border border-white/10 rounded-full hover:border-white/20 transition text-white"
    >
      <ArrowLeftIcon cls="w-4 h-4" />
    </RouterLink>
    <div class="flex flex-col items-start gap-0.5">
      <p class="font-bold text-xs leading-none uppercase tracking-widest text-muted">
        {{ dateLabel }}
      </p>
      <h1 class="font-black text-[28px] leading-none tracking-tight text-white">{{ title }}</h1>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon.vue'
const { locale } = useI18n()

const props = defineProps({
  date: { type: [String, Date], default: null },
  title: { type: String, default: '' },
})
const dateLabel = computed(() => {
  const d = props.date ? new Date(props.date) : new Date()
  return d
    .toLocaleDateString(locale.value, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase()
})
</script>
