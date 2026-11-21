<template>
  <div
    class="flex flex-row items-center gap-3 self-stretch rounded-xl border-white/10 p-4.5 w-full"
    :class="hasSignals ? 'border-white/10 bg-card' : 'border-white/10 bg-card'"
  >
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      :class="hasSignals ? 'bg-warning/15' : 'bg-success/15'"
    >
      <ExclamationTriangleIcon
        :cls="hasSignals ? 'h-4 w-4 text-warning' : 'h-4 w-4 text-success'"
      />
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p
        class="font-mono text-caption uppercase tracking-widest"
        :class="hasSignals ? 'text-warning' : 'text-success'"
      >
        {{ hasSignals ? $t('ui.fatigue_signals') : $t('ui.fatigue_check') }}
      </p>
      <p
        v-if="!hasSignals"
        class="text-body leading-snug text-primary"
      >
        {{ $t('ui.no_fatigue_signals') }}
      </p>
      <ul
        v-else
        class="flex flex-col gap-1"
      >
        <li
          v-for="(s, i) in signals"
          :key="i"
          class="flex gap-2 text-body leading-snug text-primary"
        >
          <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-warning"></span>{{ s }}
        </li>
      </ul>
    </div>
    <span
      v-if="hasSignals"
      class="shrink-0 rounded bg-warning/15 px-2 py-0.5 text-label font-medium text-warning"
      >{{ signals.length }}</span
    >
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import ExclamationTriangleIcon from '@/components/icons/ExclamationTriangleIcon.vue'
const props = defineProps({
  signals: { type: Array, default: () => [] },
})
const hasSignals = computed(() => (props.signals?.length ?? 0) > 0)
</script>
