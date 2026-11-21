<template>
  <svg
    :width="512"
    :height="100"
    viewBox="0 0 512 100"
    class="absolute inset-0 w-full h-full"
    aria-hidden="true"
  >
    <line
      x1="0"
      y1="50"
      x2="512"
      y2="50"
      stroke="#232329"
      stroke-width="1"
      stroke-dasharray="6 6"
    />
    <polyline
      :points="polyPoints"
      fill="none"
      stroke="#9B9BA4"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle
      v-for="(p, i) in dots"
      :key="i"
      :cx="p.x"
      :cy="p.y"
      r="4"
      :fill="i === dots.length - 1 ? '#F97316' : '#9B9BA4'"
      stroke="#0B0B0F"
      stroke-width="1.5"
    />
  </svg>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

interface Dot {
  x: number
  y: number
}

defineProps({
  polyPoints: { type: String, required: true },
  dots: { type: Array as PropType<Dot[]>, required: true },
})
</script>
