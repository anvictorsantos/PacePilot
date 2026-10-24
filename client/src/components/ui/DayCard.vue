<template>
  <div
    class="flex flex-col flex-none sm:flex-1 border-border rounded-2xl w-full"
    :class="[
      size === 'lg'
        ? 'gap-6 p-6 min-h-[240px] min-w-cardWide'
        : size === 'sm'
          ? 'gap-2 p-3 min-h-[180px] min-w-cardDay'
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
    <!-- mobile: compact row card (type · date / title / stats) -->
    <div class="sm:hidden">
      <div class="flex items-center gap-2">
        <span
          class="font-bold text-caption"
          :class="typeTextClass"
          >{{ $t(typeKey).toUpperCase() }}</span
        >
        <span class="text-muted">·</span>
        <span class="text-caption text-muted">{{ date }}</span>
      </div>
      <p
        class="mt-2 font-extrabold text-lead"
        :class="dayTextClass"
      >
        {{ $t(dayKey) }}
      </p>
      <div class="mt-2 flex flex-wrap gap-3 text-body text-muted">
        <span>{{ dist }}</span>
        <span v-if="paceKey || pace">{{ paceKey ? $t(paceKey) : pace }}</span>
        <span v-if="extra || extraKey">{{ extraKey ? $t(extraKey) : extra }}</span>
      </div>
    </div>

    <!-- sm+: column card -->
    <div
      class="hidden sm:flex sm:flex-col sm:flex-1"
      :class="size === 'lg' ? 'gap-6' : size === 'sm' ? 'gap-2' : 'gap-4'"
    >
      <div>
        <p
          class="font-extrabold"
          :class="[
            dayTextClass,
            size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm',
          ]"
        >
          {{ $t(dayKey) }}
        </p>
        <p class="text-caption text-muted">{{ date }}</p>
      </div>
      <div class="bg-white/10 h-px"></div>
      <p
        class="font-extrabold text-micro"
        :class="typeTextClass"
      >
        {{ $t(typeKey).toUpperCase() }}
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  dayKey: { type: String, required: true },
  date: { type: String, required: true },
  typeKey: { type: String, required: true },
  dist: { type: String, required: true },
  paceKey: { type: String, default: '' },
  pace: { type: String, default: '' },
  extraKey: { type: String, default: '' },
  extra: { type: String, default: '' },
  today: { type: Boolean, default: false },
  /** The session on this day was logged; the card turns green. */
  completed: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
})

const isToday = computed(() => props.today)

const isRest = computed(() => props.typeKey === 'landing.sections.plan.session.rest')

/** Completed wins over today (a logged session reads green, not orange); today
 *  wins over rest so the current day is never dimmed. Everything else — the
 *  next training included — keeps full opacity. */
const state = computed(() => {
  if (props.completed) return 'completed'
  if (isToday.value) return 'today'
  if (isRest.value) return 'rest'
  return 'upcoming'
})

const cardClass = computed(() => {
  switch (state.value) {
    case 'completed':
      return 'border-2 border-success bg-success/10 opacity-100'
    case 'today':
      return 'border-2 border-primary bg-primary/10 opacity-100'
    case 'rest':
      return 'border-white/10 bg-card opacity-60'
    default:
      return 'border-white/10 bg-card opacity-100'
  }
})

const dayTextClass = computed(() =>
  state.value === 'completed'
    ? 'text-success'
    : state.value === 'today'
      ? 'text-primary'
      : 'text-white',
)

const typeTextClass = computed(() =>
  state.value === 'completed'
    ? 'text-success'
    : state.value === 'rest'
      ? 'text-muted'
      : 'text-primary',
)

const extraTextClass = computed(() =>
  state.value === 'completed'
    ? 'text-success'
    : state.value === 'today'
      ? 'text-primary'
      : 'text-muted',
)
</script>
