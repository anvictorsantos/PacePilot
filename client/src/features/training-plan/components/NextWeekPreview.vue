<template>
  <div class="flex flex-col gap-3">
    <p class="font-mono text-caption text-faint uppercase tracking-widest">
      {{ $t('ui.next_week_preview', { weekNumber }) }}
    </p>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div
        v-for="p in items"
        :key="`${p.date}-${p.title}`"
        class="flex items-center gap-4 rounded-xl border border-white/10 bg-card p-4"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <span
            class="inline-flex self-start font-mono text-caption uppercase tracking-wide text-faint"
            >{{ p.badge }}</span
          >
          <p class="text-body font-medium leading-normal text-primary">{{ p.title }}</p>
          <p
            v-if="p.date"
            class="font-mono text-caption leading-normal text-faint"
          >
            {{ p.date }}
          </p>
          <p class="text-label font-normal leading-normal text-muted">{{ p.desc }}</p>
        </div>
        <div class="flex shrink-0 flex-col items-end leading-normal">
          <p class="font-mono text-lead leading-none text-primary">{{ p.distance }}</p>
          <p class="text-label font-normal text-faint">{{ $t('ui.estimated') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

/** Presentational only: the parent supplies localized copy and formatted strings. */
interface PreviewItem {
  badge: string
  title: string
  desc: string
  distance: string
  /** Already formatted in the active locale. */
  date?: string
}

defineProps({
  weekNumber: { type: Number, required: true },
  items: {
    type: Array as PropType<PreviewItem[]>,
    required: true,
  },
})
</script>
