<template>
  <div
    class="flex flex-col gap-1 p-3 border rounded-lg min-h-[96px]"
    :class="
      state === 'today'
        ? 'border-white/20 bg-cardSecondary'
        : state === 'rest'
          ? 'border-dashed border-white/10 bg-transparent'
          : 'border-white/10 bg-card'
    "
    :aria-current="isToday ? 'date' : undefined"
  >
    <span
      v-if="completed"
      class="sr-only"
      >{{ $t('ui.completed') }}</span
    >
    <span
      class="font-mono text-caption"
      :class="state === 'today' ? 'text-primary' : 'text-faint'"
      >{{ dayLabel || (dayKey ? $t(dayKey) : '') }}</span
    >
    <span class="text-label leading-tight text-muted truncate">{{
      typeLabel || (typeKey ? $t(typeKey) : '')
    }}</span>
    <span
      class="mt-auto font-mono text-body"
      :class="state === 'rest' ? 'text-faint' : 'text-primary'"
      >{{ dist || '—' }}</span
    >
    <span
      v-if="pace || paceKey"
      class="font-mono text-caption text-faint truncate"
      >{{ paceKey ? $t(paceKey) : pace }}</span
    >
    <span
      v-if="extra || extraKey"
      class="font-mono text-caption text-faint truncate"
      >{{ extraKey ? $t(extraKey) : extra }}</span
    >
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  dayKey: { type: String, default: '' },
  /** Resolved day title, for callers whose label is not an i18n key. */
  dayLabel: { type: String, default: '' },
  typeKey: { type: String, default: '' },
  /** Resolved type/badge label, for callers whose label is not an i18n key. */
  typeLabel: { type: String, default: '' },
  dist: { type: String, default: '' },
  paceKey: { type: String, default: '' },
  pace: { type: String, default: '' },
  extraKey: { type: String, default: '' },
  extra: { type: String, default: '' },
  today: { type: Boolean, default: false },
  /** The session on this day was logged. */
  completed: { type: Boolean, default: false },
  /** Explicit rest state, for callers whose rest label is not an i18n key. */
  rest: { type: Boolean, default: false },
})

const isToday = computed(() => props.today)

const state = computed(() => {
  if (props.completed) return 'completed'
  if (isToday.value) return 'today'
  if (props.rest || props.typeKey === 'landing.sections.plan.session.rest') return 'rest'
  return 'upcoming'
})
</script>
