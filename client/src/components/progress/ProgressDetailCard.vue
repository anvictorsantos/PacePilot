<template>
  <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5">
    <div class="flex items-center justify-between">
      <p class="text-label font-bold uppercase tracking-widest text-muted">{{ title }}</p>
      <span v-if="badge" class="rounded bg-primary/10 px-2 py-0.5 text-label font-bold text-primary">{{ badge }}</span>
    </div>
    <div class="flex items-baseline gap-2">
      <p class="text-title font-black leading-none text-white">{{ value }}<span v-if="unit" class="text-sm font-bold text-muted"> {{ unit }}</span></p>
      <p v-if="subtitle" class="text-label font-normal text-muted">{{ subtitle }}</p>
    </div>
    <div v-if="hint" class="text-sm leading-snug text-muted">{{ hint }}</div>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: 'Detail' },
  value: { type: [String, Number], default: '—' },
  unit: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  badge: { type: String, default: '' },
  hint: { type: String, default: '' },
})
</script>
