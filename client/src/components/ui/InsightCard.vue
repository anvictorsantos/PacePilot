<template>
  <div
    :class="[
      'flex flex-col p-4.5 rounded-xl border min-w-0',
      highlighted ? 'bg-accent/[0.08] border-accent/40' : 'bg-card border-white/10',
    ]"
  >
    <p class="mb-2 font-medium text-label text-muted leading-none truncate">
      {{ label }}
    </p>
    <p class="font-mono text-stat text-primary tracking-tight leading-none truncate">{{ value }}</p>
    <p
      class="mt-1.5 text-label leading-none truncate whitespace-nowrap"
      :class="subToneClass"
    >
      {{ sub }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  sub: { type: String, default: '' },
  tone: {
    type: String,
    default: 'muted',
    validator: (v) => typeof v === 'string' && ['muted', 'success', 'primary'].includes(v),
  },
  highlighted: { type: Boolean, default: false },
})

const subToneClass = computed(() => {
  if (props.highlighted) return 'text-accent'
  if (props.tone === 'success') return 'text-success'
  if (props.tone === 'primary') return 'text-accent'
  return 'text-faint'
})
</script>
