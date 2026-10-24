<template>
  <div class="flex flex-col gap-6">
    <!-- header-block — Figma main/header-block: row between, h-14 -->
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <p class="font-bold text-label leading-label uppercase tracking-widest text-muted">
          {{ todayLabel }}
        </p>
        <h1 class="font-black text-h2 leading-[39px] tracking-tight text-white">
          {{ $t('ui.activities') }}
        </h1>
      </div>
      <span
        class="inline-flex items-center rounded-full bg-[rgba(249,115,22,0.125)] border border-primary px-3 py-1.5 font-bold text-xs leading-[15px] text-primary shrink-0"
      >
        {{ $t('ui.total_runs', { total }) }}
      </span>
    </div>

    <!-- filter-row — Figma filter-row: wrap gap-2, chip px-4 py-2 -->
    <div class="flex flex-wrap items-start gap-2">
      <button
        v-for="c in chips"
        :key="c.value"
        :class="[
          'rounded-full px-4 py-2 font-bold text-xs leading-[15px] transition',
          filter === c.value
            ? 'bg-primary text-white'
            : 'bg-card border border-white/10 text-white hover:border-white/20',
        ]"
        @click="setFilter(c.value)"
      >
        {{ $t(c.labelKey()) }}
      </button>
    </div>

    <!-- table-card — Figma table-card: bg #141419 border rgba 0.1 radius 16 -->
    <div class="bg-card border border-white/10 rounded-2xl overflow-hidden flex flex-col w-full">
      <!-- table-header — Figma table-header: gap-4 px-4 py-3.5 border-b -->
      <div class="hidden md:flex items-center gap-4 px-4 py-3.5 border-b border-white/10 shrink-0">
        <span class="w-[120px] shrink-0 font-bold text-label leading-label text-muted uppercase">{{
          $t('ui.date')
        }}</span>
        <span class="w-[100px] shrink-0 font-bold text-label leading-label text-muted uppercase">{{
          $t('ui.type')
        }}</span>
        <span class="flex-1 font-bold text-label leading-label text-muted uppercase">{{
          $t('ui.run_title')
        }}</span>
        <span class="w-[90px] shrink-0 font-bold text-label leading-label text-muted uppercase">{{
          $t('ui.distance')
        }}</span>
        <span class="w-[90px] shrink-0 font-bold text-label leading-label text-muted uppercase">{{
          $t('ui.duration')
        }}</span>
        <span class="w-[90px] shrink-0 font-bold text-label leading-label text-muted uppercase">{{
          $t('ui.avg_pace')
        }}</span>
        <span class="w-[90px] shrink-0 font-bold text-label leading-label text-muted uppercase">{{
          $t('ui.avg_hr')
        }}</span>
        <span
          class="w-[70px] shrink-0 font-bold text-label leading-label text-muted uppercase text-right"
          >{{ $t('ui.elevation') }}</span
        >
      </div>

      <!-- table-body -->
      <div
        v-if="loading"
        class="flex flex-col"
      >
        <div
          v-for="n in perPage"
          :key="n"
          class="flex items-center gap-4 px-4 h-[45px] border-b border-white/10 last:border-0 animate-pulse"
        >
          <div class="w-[120px] h-3 bg-white/10 rounded hidden md:block" />
          <div class="w-[100px] h-3 bg-white/10 rounded hidden md:block" />
          <div class="flex-1 h-3 bg-white/10 rounded" />
          <div class="w-[90px] h-3 bg-white/5 rounded hidden md:block" />
          <div class="w-[90px] h-3 bg-white/5 rounded hidden md:block" />
          <div class="w-[90px] h-3 bg-white/5 rounded hidden md:block" />
        </div>
      </div>
      <div
        v-else-if="!items.length"
        class="p-4"
      >
        <EmptyState
          :title="$t('ui.no_activities_found')"
          :message="$t('common.loadFailed')"
        >
          <button
            type="button"
            class="mt-5 inline-flex min-h-touch items-center justify-center rounded-xl bg-primary px-4 py-2 font-bold text-body text-white transition hover:bg-primaryBright focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            @click="reload(true)"
          >
            {{ $t('common.retry') }}
          </button>
        </EmptyState>
      </div>
      <div
        v-else
        class="flex flex-col"
      >
        <RouterLink
          v-for="(a, i) in items"
          :key="String(a.id || a._id || a.provider_activity_id)"
          :to="`/activities/${a.id ?? a._id ?? a.provider_activity_id}`"
          class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 py-3.5 border-b border-white/10 last:border-0 hover:bg-white/[0.03] transition"
          :class="i === 0 ? 'bg-track' : ''"
        >
          <!-- date + mobile badge -->
          <span
            class="w-full md:w-[120px] shrink-0 font-normal text-body leading-4 text-muted flex justify-between md:block"
          >
            <span>{{ fmtDate(a.date) }}</span>
            <span
              class="md:hidden inline-flex rounded px-2 py-0.5 font-extrabold text-micro leading-[11px] uppercase tracking-wide"
              :class="typeBadgeClass(a.workout_type)"
              >{{ fmtType(a) }}</span
            >
          </span>
          <!-- type badge desktop -->
          <span class="hidden md:flex w-[100px] shrink-0">
            <span
              class="rounded px-2 py-0.5 font-extrabold text-micro leading-[11px] uppercase tracking-wide"
              :class="typeBadgeClass(a.workout_type)"
              >{{ fmtType(a) }}</span
            >
          </span>
          <span class="flex-1 font-semibold text-sm leading-[17px] text-white truncate">{{
            runTitle(a)
          }}</span>
          <span
            class="hidden md:block w-[90px] shrink-0 font-extrabold text-sm leading-[17px] text-white"
            >{{ fmtDist(a) }}</span
          >
          <span
            class="hidden md:block w-[90px] shrink-0 font-normal text-sm leading-[17px] text-white"
            >{{ fmtDur(a) }}</span
          >
          <span
            class="hidden md:block w-[90px] shrink-0 font-normal text-sm leading-[17px] text-white"
            >{{ fmtPace(a) }}</span
          >
          <span
            class="hidden md:block w-[90px] shrink-0 font-normal text-sm leading-[17px] text-white"
            >{{ fmtHr(a) }}</span
          >
          <span
            class="hidden md:block w-[70px] shrink-0 font-normal text-sm leading-[17px] text-muted text-right"
            >{{ fmtElev(a) }}</span
          >
          <!-- mobile metrics row -->
          <span class="flex md:hidden gap-3 text-xs text-muted flex-wrap">
            <span class="font-extrabold text-white">{{ fmtDist(a) }}</span>
            <span>{{ fmtDur(a) }}</span
            ><span>{{ fmtPace(a) }}</span
            ><span>{{ fmtHr(a) }}</span
            ><span class="ml-auto">{{ fmtElev(a) }}</span>
          </span>
        </RouterLink>
      </div>
    </div>

    <!-- pagination-row -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <p class="font-normal text-body leading-4 text-muted">
        {{ $t('ui.showing_runs', { rangeLabel, total }) }}
      </p>
      <div class="flex items-center gap-3">
        <button
          :disabled="page <= 1"
          class="px-4 py-2 bg-card border border-white/10 rounded-lg font-semibold text-body leading-4 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:border-white/20 transition"
          @click="prevPage"
        >
          {{ $t('ui.previous') }}
        </button>
        <span class="font-bold text-body leading-4 text-white whitespace-nowrap">{{
          $t('ui.page_of_pages', { page, totalPages })
        }}</span>
        <button
          :disabled="page >= totalPages"
          class="px-4 py-2 bg-card border border-white/10 rounded-lg font-semibold text-body leading-4 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:border-white/20 transition"
          @click="nextPage"
        >
          {{ $t('ui.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import EmptyState from '@/components/ui/EmptyState.vue'
import {
  ActivityFilter,
  ActivityFilterValue,
} from '@/modules/activities/domain/value-object/ActivityFilter.ts'
import type { ActivitiesResponse } from '@/modules/activities/infrastructure/dto/ActivitiesResponse.ts'
import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import { useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'
import {
  formatActivityDistance as fmtDistKm,
  formatActivityDuration as fmtDur,
  formatActivityPace as fmtPace,
} from '@/modules/shared/ui/format.ts'
import {
  activityBadge,
  activityTitle as runTitle,
} from '@/modules/shared/ui/training-vocabulary.ts'

const { locale } = useI18n()

const page = ref(1)
const perPage = 9
const filter = ref<ActivityFilterValue>(ActivityFilterValue.All)

// Paged read through the Resource module: the key carries page + filter, so the
// resource re-reads when either changes and concurrent readers share a request.
const { data, loading, reload } = useResource<ActivitiesResponse>(
  () => `activities:${filter.value}:${page.value}`,
  () => api.activities.list({ page: page.value, perPage, type: filter.value }),
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? items.value.length)

const chips = ActivityFilter.chips()

const todayLabel = new Date()
  .toLocaleDateString(locale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  .toUpperCase()

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / perPage)))
const rangeLabel = computed(() => {
  if (!total.value) return '0–0'
  const start = (page.value - 1) * perPage + 1
  const end = Math.min(page.value * perPage, total.value)
  return `${start}–${end}`
})

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale.value, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
function fmtType(a: Activity) {
  return activityBadge(a)
}
function fmtDist(a: Activity) {
  const km = a.distance_km ?? (a.distance_m != null ? a.distance_m / 1000 : null)
  // HIIT/strength/mobility come back with distance 0 and no pace; "0.0 km"
  // reads as a failed run, so those rows show "—" instead.
  if (!km && a.kind && a.kind !== 'run') return '—'
  return fmtDistKm(a)
}
function typeBadgeClass(t: string | null | undefined) {
  const blue = ['easy', 'recovery']
  const isBlue = blue.includes(t ?? '')
  return isBlue ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary'
}
function fmtHr(a: Activity) {
  return a.avg_hr ? `${Math.round(a.avg_hr)} bpm` : '—'
}
function fmtElev(a: Activity) {
  if (a.elevation_m == null) return '—'
  // Cross-training has no meaningful elevation; 0 m reads as a broken run.
  if (!a.elevation_m && a.kind && a.kind !== 'run') return '—'
  return `+${Math.round(a.elevation_m)}m`
}

function prevPage() {
  if (page.value > 1) page.value--
}
function nextPage() {
  if (page.value < totalPages.value) page.value++
}

function setFilter(value: ActivityFilterValue) {
  filter.value = value
  page.value = 1
}
</script>
