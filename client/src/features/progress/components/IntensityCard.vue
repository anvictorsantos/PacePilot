<template>
  <div
    class="flex flex-col items-start gap-3 self-stretch rounded-2xl border border-white/10 bg-card p-4 w-full"
  >
    <p class="text-label font-bold uppercase tracking-widest text-muted">{{ title }}</p>
    <div class="flex w-full flex-col gap-2">
      <div class="flex items-baseline justify-between">
        <p class="text-title font-black leading-none text-white">
          {{ value
          }}<span
            v-if="unit"
            class="text-sm font-bold text-muted"
          >
            {{ unit }}</span
          >
        </p>
        <span
          v-if="badge"
          class="rounded bg-primary/10 px-2 py-0.5 text-label font-bold text-primary"
          >{{ badge }}</span
        >
      </div>
      <div
        v-if="hint"
        class="text-label leading-snug text-muted"
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
          <span class="w-16 shrink-0 text-label font-semibold text-muted">{{ z.label }}</span>
          <div class="h-1.5 flex-1">
            <ProgressBar
              :pct="z.pct"
              :label="z.label"
              size="sm"
            />
          </div>
          <span class="w-8 text-right text-label font-bold text-white">{{ z.pct }}%</span>
        </div>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import ProgressBar from '@/components/ui/ProgressBar.vue'

defineProps({
  title: { type: String, default: 'Intensity' },
  value: { type: [String, Number], default: '—' },
  unit: { type: String, default: '' },
  badge: { type: String, default: '' },
  hint: { type: String, default: '' },
  zones: { type: Array, default: null },
})
</script>
