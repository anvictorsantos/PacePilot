<template>
  <div
    role="progressbar"
    class="w-full overflow-hidden"
    :class="[sizeClass, trackClass, rounded ? 'rounded-full' : 'rounded']"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label"
  >
    <div
      class="h-full transition-all duration-500"
      :class="[barClass, rounded ? 'rounded-full' : 'rounded']"
      :style="{ width: clamped + '%' }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Width is runtime data, so a :style binding replaces a w-[N%] class and its 101-entry
// safelist; the role/aria-valuenow triple is part of the component's contract.
const props = defineProps({
  pct: { type: Number, default: 0 },
  label: { type: String, required: true },
  /** track thickness: 4 / 6 / 8 / 10px */
  size: { type: String, default: 'md' },
  /** bar colour class — pass the caller's tone class so business rules stay in the feature */
  barClass: { type: String, default: 'bg-primary' },
  trackClass: { type: String, default: 'bg-white/10' },
  rounded: { type: Boolean, default: true },
})

const SIZE_CLASSES: Record<string, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-2.5',
}

const sizeClass = computed(() => SIZE_CLASSES[props.size] ?? SIZE_CLASSES.md)

const clamped = computed(() => {
  const pct = Number(props.pct)
  if (!isFinite(pct)) return 0
  return Math.min(100, Math.max(0, Math.round(pct)))
})
</script>
