<template>
  <!-- Figma 9:564 metric-card — bg-[#141419] border-white/10 rounded-[12px] p-[14px] gap-[6px] -->
  <!-- also satisfies 9:546 phase sizing via highlighted prop (bg-primary/[0.13] border-primary) -->
  <div
    :class="[
      'flex flex-col gap-[6px] p-[14px] rounded-[12px] border min-w-0',
      highlighted ? 'bg-primary/[0.13] border-primary' : 'bg-card border-white/10',
    ]"
  >
    <p
      class="font-semibold text-[10px] uppercase tracking-wide leading-none truncate"
      :class="highlighted ? 'text-primary' : 'text-muted'"
    >
      {{ label }}
    </p>
    <p class="font-bold text-white text-[18px] leading-none truncate">{{ value }}</p>
    <p class="font-semibold text-[11px] leading-none truncate whitespace-nowrap" :class="subToneClass">
      {{ sub }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  sub: { type: String, default: '' },
  tone: { type: String, default: 'muted', validator: v => ['muted', 'success', 'primary'].includes(v) },
  highlighted: { type: Boolean, default: false },
})

const subToneClass = computed(() => {
  if (props.highlighted) return 'text-primary'
  if (props.tone === 'success') return 'text-success'
  if (props.tone === 'primary') return 'text-primary'
  return 'text-muted'
})
</script>
