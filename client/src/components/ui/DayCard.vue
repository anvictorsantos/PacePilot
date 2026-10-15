<template>
  <div
    class="flex flex-col gap-4 p-4.5 border rounded-2xl min-h-[220px]"
    :class="
      isToday
        ? 'border-2 border-primary bg-primary/10'
        : isRest || isPastDay
          ? 'border-white/10 bg-card opacity-60'
          : 'border-white/10 bg-card'
  "
  >
    <div>
      <p class="font-extrabold text-sm" :class="isToday ? 'text-primary' : 'text-white'">{{ $t(dayKey) }}</p>
      <p class="text-caption text-muted">{{ date }}</p>
    </div>
    <div class="bg-white/10 h-px"></div>
    <p
      class="font-extrabold text-micro"
      :class="
        typeKey === 'landing.sections.plan.session.rest' ? 'text-muted' : 'text-primary'
      "
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
})

const isToday = computed(() => props.today)

const isRest = computed(() => props.typeKey === 'landing.sections.plan.session.rest')

const isPastDay = computed(() => {
  const entryDate = new Date(props.date + 'T12:00:00')
  entryDate.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return entryDate < now && !props.today
})
</script>
