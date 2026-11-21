<template>
  <span class="flex items-center gap-2">
    <img
      src="/logo-white.png"
      alt=""
      aria-hidden="true"
      :width="markSize"
      :height="markSize"
      class="shrink-0 object-contain"
    />
    <span
      v-if="showText"
      class="font-medium text-primary tracking-tight"
      :class="size === 'sm' ? 'text-body' : 'text-lead'"
      >PacePilot</span
    >
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  showText: { type: Boolean, default: true },
  size: { type: String as () => 'sm' | 'md', default: 'md' },
})

const markSize = computed(() => (props.size === 'sm' ? 18 : 20))
</script>
