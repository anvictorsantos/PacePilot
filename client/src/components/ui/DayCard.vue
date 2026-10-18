<template>
  <div
    class="flex flex-col flex-none sm:flex-1 border-border rounded-2xl w-full"
    :class="[
      size === 'lg'
        ? 'gap-6 p-6 min-h-[240px] min-w-cardWide'
        : size === 'sm'
          ? 'gap-2 p-3 min-h-[180px] min-w-cardDay'
          : 'gap-4 p-4.5 min-h-[220px] min-w-cardMid',
      isToday
        ? 'border-2 border-primary bg-primary/10'
        : isRest || isPastDay
          ? 'border-white/10 bg-card opacity-60'
          : 'border-white/10 bg-card',
    ]"
  >
    <!-- mobile: compact row card (type · date / title / stats) -->
    <div class="sm:hidden">
      <div class="flex items-center gap-2">
        <span class="font-bold text-caption text-primary">{{ $t(typeKey).toUpperCase() }}</span>
        <span class="text-muted">·</span>
        <span class="text-caption text-muted">{{ date }}</span>
      </div>
      <p
        class="mt-2 font-extrabold text-lead"
        :class="isToday ? 'text-primary' : 'text-white'"
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
            isToday ? 'text-primary' : 'text-white',
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
        :class="isRest ? 'text-muted' : 'text-primary'"
      >
        {{ $t(typeKey).toUpperCase() }}
      </p>
      <p class="font-extrabold text-h3">{{ dist }}</p>
      <p class="text-label text-muted">{{ paceKey ? $t(paceKey) : pace }}</p>
      <p
        v-if="extra || extraKey"
        class="text-caption"
        :class="isToday ? 'text-primary' : 'text-muted'"
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
  size: { type: String, default: 'md' },
})

const isToday = computed(() => props.today)

const isRest = computed(() => props.typeKey === 'landing.sections.plan.session.rest')

const isPastDay = computed(() => {
  const entryDate = new Date(`${props.date} ${new Date().getFullYear()}`)
  entryDate.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return entryDate < now && !props.today
})
</script>
