<template>
  <div class="flex flex-col gap-6">
    <!-- header-block — Figma main/header-block: row between, h-14 -->
    <div class="flex justify-between items-center gap-4">
      <div class="flex flex-col items-start gap-1">
        <p class="font-bold text-label text-muted uppercase leading-label tracking-widest">
          {{ todayLabel }}
        </p>
        <h1 class="font-black text-h2 text-white leading-[39px] tracking-tight">
          {{ $t('ui.activities') }}
        </h1>
      </div>
      <span
        class="inline-flex items-center bg-[rgba(249,115,22,0.125)] px-3 py-1.5 border border-primary rounded-full font-bold text-primary text-xs leading-[15px] shrink-0"
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
          'rounded-full cursor-pointer px-4 py-2 font-bold text-xs leading-[15px] transition',
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
    <div class="flex flex-col bg-card border border-white/10 rounded-2xl w-full overflow-hidden">
      <!-- table-header — Figma table-header: gap-4 px-4 py-3.5 border-b -->
      <div class="hidden md:flex items-center gap-4 px-4 py-3.5 border-white/10 border-b shrink-0">
        <span class="w-[120px] font-bold text-label text-muted uppercase leading-label shrink-0">{{
          $t('ui.date')
        }}</span>
        <span class="w-[100px] font-bold text-label text-muted uppercase leading-label shrink-0">{{
          $t('ui.type')
        }}</span>
        <span class="flex-1 font-bold text-label text-muted uppercase leading-label">{{
          $t('ui.run_title')
        }}</span>
        <span class="w-[90px] font-bold text-label text-muted uppercase leading-label shrink-0">{{
          $t('ui.distance')
        }}</span>
        <span class="w-[90px] font-bold text-label text-muted uppercase leading-label shrink-0">{{
          $t('ui.duration')
        }}</span>
        <span class="w-[90px] font-bold text-label text-muted uppercase leading-label shrink-0">{{
          $t('ui.avg_pace')
        }}</span>
        <span class="w-[90px] font-bold text-label text-muted uppercase leading-label shrink-0">{{
          $t('ui.avg_hr')
        }}</span>
        <span
          class="w-[70px] font-bold text-label text-muted text-right uppercase leading-label shrink-0"
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
          class="flex items-center gap-4 px-4 border-white/10 last:border-0 border-b h-[45px] animate-pulse"
        >
          <div class="hidden md:block bg-white/10 rounded w-[120px] h-3" />
          <div class="hidden md:block bg-white/10 rounded w-[100px] h-3" />
          <div class="flex-1 bg-white/10 rounded h-3" />
          <div class="hidden md:block bg-white/5 rounded w-[90px] h-3" />
          <div class="hidden md:block bg-white/5 rounded w-[90px] h-3" />
          <div class="hidden md:block bg-white/5 rounded w-[90px] h-3" />
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
            class="inline-flex justify-center items-center bg-primary hover:bg-primaryBright mt-5 px-4 py-2 rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-bold text-body text-white transition cursor-pointer"
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
          class="flex md:flex-row flex-col md:items-center gap-2 md:gap-4 hover:bg-white/[0.03] px-4 py-3.5 border-white/10 last:border-0 border-b transition"
          :class="i === 0 ? 'bg-track' : ''"
        >
          <!-- date + mobile badge -->
          <span
            class="md:block flex justify-between w-full md:w-[120px] font-normal text-body text-muted leading-4 shrink-0"
          >
            <span>{{ fmtDate(a.date) }}</span>
            <span
              class="md:hidden inline-flex px-2 py-0.5 rounded font-extrabold text-micro uppercase leading-[11px] tracking-wide"
              :class="typeBadgeClass(a.workout_type)"
              >{{ fmtType(a) }}</span
            >
          </span>
          <!-- type badge desktop -->
          <span class="hidden md:flex w-[100px] shrink-0">
            <span
              class="px-2 py-0.5 rounded font-extrabold text-micro uppercase leading-[11px] tracking-wide"
              :class="typeBadgeClass(a.workout_type)"
              >{{ fmtType(a) }}</span
            >
          </span>
          <span class="flex-1 font-semibold text-white text-sm truncate leading-[17px]">{{
            runTitle(a)
          }}</span>
          <span
            class="hidden md:block w-[90px] font-extrabold text-white text-sm leading-[17px] shrink-0"
            >{{ fmtDist(a) }}</span
          >
          <span
            class="hidden md:block w-[90px] font-normal text-white text-sm leading-[17px] shrink-0"
            >{{ fmtDur(a) }}</span
          >
          <span
            class="hidden md:block w-[90px] font-normal text-white text-sm leading-[17px] shrink-0"
            >{{ fmtPace(a) }}</span
          >
          <span
            class="hidden md:block w-[90px] font-normal text-white text-sm leading-[17px] shrink-0"
            >{{ fmtHr(a) }}</span
          >
          <span
            class="hidden md:block w-[70px] font-normal text-muted text-sm text-right leading-[17px] shrink-0"
            >{{ fmtElev(a) }}</span
          >
          <!-- mobile metrics row -->
          <span class="md:hidden flex flex-wrap gap-3 text-muted text-xs">
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
    <div class="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-3">
      <p class="font-normal text-body text-muted leading-4">
        {{ $t('ui.showing_runs', { rangeLabel, total }) }}
      </p>
      <div class="flex items-center gap-3">
        <button
          :disabled="page <= 1"
          class="cursor-pointer bg-card disabled:opacity-40 px-4 py-2 border border-white/10 hover:border-white/20 rounded-lg font-semibold text-body text-white leading-4 transition disabled:cursor-not-allowed"
          @click="prevPage"
        >
          {{ $t('ui.previous') }}
        </button>
        <span class="font-bold text-body text-white leading-4 whitespace-nowrap">{{
          $t('ui.page_of_pages', { page, totalPages })
        }}</span>
        <button
          :disabled="page >= totalPages"
          class="cursor-pointer bg-card disabled:opacity-40 px-4 py-2 border border-white/10 hover:border-white/20 rounded-lg font-semibold text-body text-white leading-4 transition disabled:cursor-not-allowed"
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
