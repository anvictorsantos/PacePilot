<template>
  <div
    class="flex flex-col items-start gap-3 self-stretch w-full rounded-xl border border-white/10 bg-card p-4.5"
  >
    <p class="font-medium text-body leading-label text-primary self-stretch">
      {{ title || $t('ui.adherence_title') }}
    </p>
    <div class="flex flex-row items-center justify-between self-stretch">
      <p class="font-mono text-stat tracking-tight leading-none text-primary">
        {{ pct != null ? pct + '%' : '—' }}
      </p>
      <p class="font-mono text-label leading-4 text-muted text-right">
        {{ delta || $t('ui.adherence_delta') }}
      </p>
    </div>
    <p class="font-normal text-label leading-normal text-faint self-stretch">
      {{ hint || $t('ui.adherence_hint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps({
  title: { type: String, default: '' },
  pct: { type: Number, default: null },
  delta: { type: String, default: '' },
  hint: { type: String, default: '' },
  completed: { type: Number, default: 0 },
  planned: { type: Number, default: 0 },
  subtitle: { type: String, default: '' },
})
</script>
