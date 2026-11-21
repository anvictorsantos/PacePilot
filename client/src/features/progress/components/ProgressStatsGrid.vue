<template>
  <div
    class="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-xl overflow-hidden"
  >
    <div class="flex flex-col bg-card p-4.5">
      <p class="mb-2 text-label text-muted">{{ $t('ui.total_distance') }}</p>
      <p class="font-mono text-stat text-primary tracking-tight leading-none">
        {{ data.totalDistance }}<small class="ml-1 text-label text-muted">{{ $t('ui.km_unit') }}</small>
      </p>
      <p class="mt-1.5 text-label text-faint">{{ $t('ui.all_time') }}</p>
    </div>
    <div class="flex flex-col bg-card p-4.5">
      <p class="mb-2 text-label text-muted">{{ $t('ui.activities') }}</p>
      <p class="font-mono text-stat text-primary tracking-tight leading-none">
        {{ data.totalActivities }}
      </p>
      <p class="mt-1.5 text-label text-faint">{{ $t('ui.synced_runs') }}</p>
    </div>
    <div class="flex flex-col bg-card p-4.5">
      <p class="mb-2 text-label text-muted">{{ $t('ui.trend') }}</p>
      <p class="font-mono text-stat text-primary tracking-tight leading-none capitalize">
        {{ data.trainingState.trend }}
      </p>
      <p class="mt-1.5 text-label text-faint capitalize">
        {{ $t('ui.trend_phase', { trend: data.trainingState.trend }) }}
      </p>
    </div>
    <div class="flex flex-col bg-card p-4.5">
      <p class="mb-2 text-label text-muted">{{ $t('ui.long_run') }}</p>
      <p class="font-mono text-stat text-primary tracking-tight leading-none">
        {{ data.trainingState.weekly.longRun28
        }}<small class="ml-1 text-label text-muted">{{ $t('ui.km_unit') }}</small>
      </p>
      <p class="mt-1.5 text-label text-faint">{{ $t('ui.28_day_best') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  data: { type: Object, required: true },
})
</script>
