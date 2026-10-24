<template>
  <div class="flex flex-col gap-3">
    <p class="text-label font-bold uppercase tracking-widest text-muted">
      {{ $t('ui.next_week_preview', { weekNumber }) }}
    </p>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div
        v-for="p in items"
        :key="`${p.date}-${p.title}`"
        class="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-4"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <span
            class="inline-flex self-start rounded bg-white/[0.08] px-1.5 py-0.5 text-micro font-extrabold uppercase leading-normal tracking-wide text-muted"
            >{{ p.badge }}</span
          >
          <p class="text-sm font-bold leading-normal text-white">{{ p.title }}</p>
          <p
            v-if="p.date"
            class="text-caption font-normal leading-normal text-faint"
          >
            {{ p.date }}
          </p>
          <p class="text-xs font-normal leading-normal text-muted">{{ p.desc }}</p>
        </div>
        <div class="flex shrink-0 flex-col items-end leading-normal">
          <p class="text-lg font-black leading-none text-white">{{ p.distance }}</p>
          <p class="text-label font-normal text-muted">{{ $t('ui.estimated') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

/** One preview card. The parent supplies localized copy, the formatted date and
 *  the distance string — this component only lays them out. */
interface PreviewItem {
  badge: string
  title: string
  desc: string
  distance: string
  /** Weekday + day + month, already formatted in the active locale. */
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
