<template>
  <div
    class="relative flex flex-col border-border rounded-2xl"
    :class="[
      layout === 'column' ? 'flex-1 w-full' : 'flex-none sm:flex-1 w-full',
      size === 'lg'
        ? 'gap-6 p-6 min-h-[240px] min-w-cardWide'
        : size === 'sm'
          ? 'gap-2 p-3 min-h-[180px] min-w-cardDay'
          : size === 'compact'
            ? 'gap-4 p-4 min-w-[124px] sm:min-w-0'
            : 'gap-4 p-4.5 min-h-[220px] min-w-cardMid',
      cardClass,
    ]"
    :aria-current="isToday ? 'date' : undefined"
  >
    <span
      v-if="completed"
      class="sr-only"
      >{{ $t('ui.completed') }}</span
    >
    <div
      v-if="layout !== 'column'"
      class="sm:hidden"
    >
      <div class="flex items-center gap-2">
        <span
          class="font-bold text-caption"
          :class="typeTextClass"
          >{{ typeLabel || (typeKey ? $t(typeKey) : '') }}</span
        >
        <span class="text-muted">·</span>
        <span class="text-caption text-muted">{{ date }}</span>
      </div>
      <p
        class="mt-2 font-extrabold text-lead"
        :class="dayTextClass"
      >
        {{ dayLabel || (dayKey ? $t(dayKey) : '') }}
      </p>
      <div class="mt-2 flex flex-wrap gap-3 text-body text-muted">
        <span>{{ dist }}</span>
        <span v-if="paceKey || pace">{{ paceKey ? $t(paceKey) : pace }}</span>
        <span v-if="extra || extraKey">{{ extraKey ? $t(extraKey) : extra }}</span>
      </div>
    </div>

    <!-- sm+: column card; `layout="column"` keeps the column shape on mobile too -->
    <div
      :class="[
        layout === 'column' ? 'flex flex-1 flex-col' : 'hidden sm:flex sm:flex-col sm:flex-1',
        size === 'lg' ? 'gap-6' : size === 'sm' ? 'gap-2' : 'gap-4',
      ]"
    >
      <div>
        <p
          class="font-extrabold"
          :class="[
            dayTextClass,
            size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm',
          ]"
        >
          {{ dayLabel || (dayKey ? $t(dayKey) : '') }}
        </p>
        <p class="text-caption text-muted">{{ date }}</p>
      </div>
      <div class="bg-white/10 h-px"></div>
      <slot name="body">
        <p
          class="font-extrabold text-micro"
          :class="typeTextClass"
        >
          {{ typeLabel || (typeKey ? $t(typeKey) : '') }}
        </p>
        <p class="font-extrabold text-h3">{{ dist }}</p>
        <p class="text-label text-muted">{{ paceKey ? $t(paceKey) : pace }}</p>
        <p
          v-if="extra || extraKey"
          class="text-caption"
          :class="extraTextClass"
        >
          {{ extraKey ? $t(extraKey) : extra }}
        </p>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  dayKey: { type: String, default: '' },
  /** Resolved day title, for callers whose label is not an i18n key. */
  dayLabel: { type: String, default: '' },
  date: { type: String, required: true },
  typeKey: { type: String, default: '' },
  /** Resolved type/badge label, for callers whose label is not an i18n key. */
  typeLabel: { type: String, default: '' },
  dist: { type: String, default: '' },
  paceKey: { type: String, default: '' },
  pace: { type: String, default: '' },
  extraKey: { type: String, default: '' },
  extra: { type: String, default: '' },
  today: { type: Boolean, default: false },
  /** The session on this day was logged; the card turns green. */
  completed: { type: Boolean, default: false },
  /** Explicit rest state, for callers whose rest label is not an i18n key. */
  rest: { type: Boolean, default: false },
  /** `column` keeps the column layout at every breakpoint. */
  layout: { type: String, default: 'responsive' },
  size: { type: String, default: 'md' },
})

const isToday = computed(() => props.today)

const isRest = computed(() => props.rest || props.typeKey === 'landing.sections.plan.session.rest')

/** Completed wins over today (a logged session reads green, not orange) and today
 *  over rest so the current day is never dimmed. */
const state = computed(() => {
  if (props.completed) return 'completed'
  if (isToday.value) return 'today'
  if (isRest.value) return 'rest'
  return 'upcoming'
})

const cardClass = computed(() => {
  switch (state.value) {
    case 'completed':
      return 'border-2 border-success bg-card opacity-100'
    case 'today':
      return 'border-2 border-primary bg-card opacity-100'
    case 'rest':
      return 'border-white/10 bg-card opacity-100'
    default:
      return 'border-white/10 bg-card opacity-100'
  }
})

const dayTextClass = computed(() =>
  state.value === 'completed'
    ? 'text-success'
    : state.value === 'today'
      ? 'text-primaryBright'
      : 'text-white',
)

const typeTextClass = computed(() =>
  state.value === 'completed'
    ? 'text-success'
    : state.value === 'rest'
      ? 'text-muted'
      : 'text-primaryBright',
)

const extraTextClass = computed(() =>
  state.value === 'completed'
    ? 'text-success'
    : state.value === 'today'
      ? 'text-primaryBright'
      : 'text-muted',
)
</script>
