<template>
  <div
    class="flex flex-col items-start gap-3 self-stretch rounded-xl border border-white/10 bg-card p-4.5 w-full"
  >
    <p class="font-medium text-body text-primary">
      {{ title || $t('ui.intensity') }}
    </p>
    <div class="flex w-full flex-col gap-2">
      <div class="flex items-baseline justify-between">
        <p class="font-mono text-stat tracking-tight leading-none text-primary">
          {{ value
          }}<span
            v-if="unit"
            class="text-label text-muted"
          >
            {{ unit }}</span
          >
        </p>
        <span
          v-if="badge"
          class="rounded bg-accent/10 px-2 py-0.5 font-mono text-label text-accent"
          >{{ badge }}</span
        >
      </div>
      <div
        v-if="hint"
        class="text-label leading-normal text-faint"
      >
        {{ hint }}
      </div>
      <div
        v-if="zones?.length"
        class="flex w-full flex-col gap-1.5"
      >
        <div
          v-for="z in zones"
          :key="z.label"
          class="flex items-center gap-2"
        >
          <span class="w-16 shrink-0 font-mono text-label text-faint">{{ z.label }}</span>
          <div class="h-1.5 flex-1">
            <ProgressBar
              :pct="z.pct"
              :label="z.label"
              size="sm"
            />
          </div>
          <span class="w-8 text-right font-mono text-label text-primary">{{ z.pct }}%</span>
        </div>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

import ProgressBar from '@/components/ui/ProgressBar.vue'

interface IntensityZone {
  label: string
  pct: number
}

defineProps({
  title: { type: String, default: '' },
  value: { type: [String, Number], default: '—' },
  unit: { type: String, default: '' },
  badge: { type: String, default: '' },
  hint: { type: String, default: '' },
  zones: { type: Array as PropType<IntensityZone[] | null>, default: null },
})
</script>
