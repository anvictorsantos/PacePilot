<template>
  <div
    class="flex flex-row items-center gap-3 self-stretch rounded-2xl border p-4 w-full"
    :class="hasSignals ? 'border-warning/20 bg-card' : 'border-success/30 bg-success/10'"
  >
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      :class="hasSignals ? 'bg-warning/15' : 'bg-success/15'"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        :stroke="hasSignals ? '#F59E0B' : '#22C55E'"
        class="h-4 w-4"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p
        class="text-label font-bold uppercase tracking-widest"
        :class="hasSignals ? 'text-warning' : 'text-success'"
      >
        {{ hasSignals ? 'Fatigue Signals' : 'Fatigue Check' }}
      </p>
      <p
        v-if="!hasSignals"
        class="text-sm leading-snug text-white"
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
          class="flex gap-2 text-sm leading-snug text-white"
        >
          <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-warning"></span>{{ s }}
        </li>
      </ul>
    </div>
    <span
      v-if="hasSignals"
      class="shrink-0 rounded bg-warning/15 px-2 py-0.5 text-label font-bold text-warning"
      >{{ signals.length }}</span
    >
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps({
  signals: { type: Array, default: () => [] },
})
const hasSignals = computed(() => (props.signals?.length ?? 0) > 0)
</script>
