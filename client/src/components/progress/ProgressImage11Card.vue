<template>
  <!-- Image #11 — Progress stats / Figma 9:884 replication
       Dark cards bg-card #141419 / border white/10 / rounded-2xl / Inter
       Matches WeeklyScheduleGrid language (11px muted + 22px black) -->
  <div class="flex flex-col gap-3">
    <p class="text-label font-bold uppercase tracking-widest text-muted">Overview</p>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <!-- Total Distance -->
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-label font-bold uppercase tracking-widest text-muted">Total Distance</p>
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="1.5" class="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-8.25v8.25m-10.5 0h15"/></svg>
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-title font-black leading-none text-white">{{ distance }} <span class="text-sm font-bold">km</span></p>
          <p class="text-label font-normal text-muted">All time</p>
        </div>
        <div class="h-px w-full bg-white/10"></div>
        <p class="text-label font-semibold text-success">↗ +12% vs last month</p>
      </div>

      <!-- Activities -->
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-label font-bold uppercase tracking-widest text-muted">Activities</p>
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="1.5" class="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h12M6 12h12M6 18h12"/></svg>
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-title font-black leading-none text-white">{{ activities }}</p>
          <p class="text-label font-normal text-muted">Synced runs</p>
        </div>
        <div class="h-px w-full bg-white/10"></div>
        <p class="text-label font-normal text-muted">Last sync today</p>
      </div>

      <!-- Trend -->
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-label font-bold uppercase tracking-widest text-muted">Trend</p>
          <span class="rounded bg-white/[0.06] px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wide text-muted">{{ trend }}</span>
        </div>
        <div class="flex flex-col gap-2">
          <p class="text-title font-black leading-none text-white capitalize">{{ trend }}</p>
          <p class="text-label font-normal text-muted">{{ trend }} phase</p>
        </div>
        <div class="h-px w-full bg-white/10"></div>
        <p class="text-label font-normal text-muted">Based on 28-day window</p>
      </div>

      <!-- Long Run -->
      <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-label font-bold uppercase tracking-widest text-muted">Long Run</p>
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="1.5" class="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13l3 3L21 3"/></svg>
          </span>
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-title font-black leading-none text-white">{{ longRun }} <span class="text-sm font-bold">km</span></p>
          <p class="text-label font-normal text-muted">28-day best</p>
        </div>
        <div class="h-px w-full bg-white/10"></div>
        <p class="text-label font-semibold text-primary">Peak effort</p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  distance: { type: [Number, String], default: '42.3' },
  activities: { type: [Number, String], default: 20 },
  trend: { type: String, default: 'building' },
  longRun: { type: [Number, String], default: '14.0' },
})
</script>
