<template>
  <!-- Figma 9:564 metric-card — bg-card border-white/10 rounded-xl p-3.5 gap-1.5 -->
  <!-- also satisfies 9:546 phase sizing via highlighted prop (bg-primary/[0.13] border-primary) -->
  <div
    :class="[
      'flex flex-col gap-1.5 p-3.5 rounded-xl border border-border min-w-0',
      highlighted ? 'bg-primary/[0.13] border-primary' : 'bg-card border-white/10',
    ]"
  >
    <p
      class="font-semibold text-caption uppercase tracking-wide leading-none truncate"
      :class="highlighted ? 'text-primary' : 'text-muted'"
    >
      {{ label }}
    </p>
    <p class="font-bold text-white text-lg leading-none truncate">{{ value }}</p>
    <p
      class="font-semibold text-label leading-none truncate whitespace-nowrap"
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
  if (props.highlighted) return 'text-primary'
  if (props.tone === 'success') return 'text-success'
  if (props.tone === 'primary') return 'text-primary'
  return 'text-muted'
})
</script>
