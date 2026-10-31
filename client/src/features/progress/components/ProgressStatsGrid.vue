<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
      <p class="text-label font-bold uppercase tracking-widest text-muted">
        {{ $t('ui.total_distance') }}
      </p>
      <div class="flex flex-col gap-1">
        <p class="text-title font-black leading-none text-white">
          {{ data.totalDistance }} <span class="text-sm font-bold">{{ $t('ui.km_unit') }}</span>
        </p>
        <p class="text-label font-normal text-muted">{{ $t('ui.all_time') }}</p>
      </div>
    </div>
    <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
      <p class="text-label font-bold uppercase tracking-widest text-muted">
        {{ $t('ui.activities') }}
      </p>
      <div class="flex flex-col gap-1">
        <p class="text-title font-black leading-none text-white">{{ data.totalActivities }}</p>
        <p class="text-label font-normal text-muted">{{ $t('ui.synced_runs') }}</p>
      </div>
    </div>
    <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
      <p class="text-label font-bold uppercase tracking-widest text-muted">{{ $t('ui.trend') }}</p>
      <div class="flex flex-col gap-2">
        <span
          class="inline-flex self-start rounded bg-white/[0.06] px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wide text-muted"
          >{{ data.trainingState.trend }}</span
        >
        <p class="text-label font-normal text-muted capitalize">
          {{ $t('ui.trend_phase', { trend: data.trainingState.trend }) }}
        </p>
      </div>
    </div>
    <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
      <p class="text-label font-bold uppercase tracking-widest text-muted">
        {{ $t('ui.long_run') }}
      </p>
      <div class="flex flex-col gap-1">
        <p class="text-title font-black leading-none text-white">
          {{ data.trainingState.weekly.longRun28 }}
          <span class="text-sm font-bold">{{ $t('ui.km_unit') }}</span>
        </p>
        <p class="text-label font-normal text-muted">{{ $t('ui.28_day_best') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  data: { type: Object, required: true },
})
</script>
