<template>
  <div class="flex flex-col gap-5">
    <div class="flex justify-between items-start gap-6">
      <div>
        <p class="mb-1.5 font-mono text-label text-faint">{{ todayLabel }}</p>
        <h1 class="font-medium text-page text-primary tracking-tight leading-none">
          {{ $t('ui.activities') }}
        </h1>
      </div>
      <div class="font-mono text-label text-muted text-right leading-relaxed">
        {{ $t('ui.total_runs', { total }) }}
      </div>
    </div>

    <div class="flex flex-wrap gap-5 border-b border-white/10">
      <button
        v-for="c in chips"
        :key="c.value"
        class="-mb-px pb-3 pt-1 border-b text-body transition cursor-pointer"
        :class="
          filter === c.value
            ? 'text-primary border-white/30'
            : 'text-faint border-transparent hover:text-primary'
        "
        @click="setFilter(c.value)"
      >
        {{ $t(c.labelKey()) }}
      </button>
    </div>

    <div
      class="hidden md:grid grid-cols-[92px_26px_1fr_96px_84px_76px_60px] gap-3.5 px-1 pb-2.5 border-b border-white/10 text-caption text-faint"
    >
      <span>{{ $t('ui.date') }}</span>
      <span></span>
      <span>{{ $t('ui.run_title') }}</span>
      <span class="text-right">{{ $t('ui.distance') }}</span>
      <span class="text-right">{{ $t('ui.avg_pace') }}</span>
      <span class="text-right">{{ $t('ui.duration') }}</span>
      <span class="text-right">{{ $t('ui.avg_hr') }}</span>
    </div>

    <div
      v-if="loading"
      class="flex flex-col"
    >
      <div
        v-for="n in perPage"
        :key="n"
        class="flex items-center gap-4 px-1 border-white/10 last:border-0 border-b h-[50px] animate-pulse"
      >
        <div class="hidden md:block bg-white/10 rounded w-20 h-3" />
        <div class="flex-1 bg-white/10 rounded h-3" />
        <div class="hidden md:block bg-white/5 rounded w-16 h-3" />
        <div class="hidden md:block bg-white/5 rounded w-16 h-3" />
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
          class="inline-flex justify-center items-center bg-primary hover:bg-primaryBright mt-5 px-4 py-2 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-medium text-body text-background transition cursor-pointer"
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
        v-for="a in items"
        :key="String(a.id || a._id || a.provider_activity_id)"
        :to="`/activities/${a.id ?? a._id ?? a.provider_activity_id}`"
        class="grid grid-cols-[1fr_auto] md:grid-cols-[92px_26px_1fr_96px_84px_76px_60px] gap-2 md:gap-3.5 items-center px-1 py-3.5 border-b border-white/10 last:border-0 text-body hover:bg-white/[0.03] transition"
      >
        <span class="font-mono text-label text-faint">{{ fmtDate(a.date) }}</span>
        <span class="hidden md:block text-faint">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M4 18l4-5 3 2 4-6 5 9" />
          </svg>
        </span>
        <span class="min-w-0 truncate text-primary">
          {{ runTitle(a) }}
          <small class="block text-faint text-label">{{ fmtType(a) }}</small>
        </span>
        <span class="hidden md:block font-mono text-label text-muted text-right">{{
          fmtDist(a)
        }}</span>
        <span class="hidden md:block font-mono text-label text-muted text-right">{{
          fmtPace(a)
        }}</span>
        <span class="hidden md:block font-mono text-label text-muted text-right">{{
          fmtDur(a)
        }}</span>
        <span class="hidden md:block font-mono text-label text-faint text-right">{{
          fmtHr(a)
        }}</span>
        <span class="md:hidden flex flex-wrap gap-x-3 font-mono text-label text-muted">
          <span class="text-primary">{{ fmtDist(a) }}</span>
          <span>{{ fmtPace(a) }}</span>
          <span>{{ fmtDur(a) }}</span>
          <span class="text-faint">{{ fmtHr(a) }}</span>
        </span>
      </RouterLink>
    </div>

    <div class="flex justify-between items-center mt-1 text-label text-faint">
      <span>{{ rangeLabel }} / {{ total }}</span>
      <div class="flex items-center gap-1">
        <button
          :disabled="page <= 1"
          type="button"
          class="grid place-items-center w-7 h-7 border border-white/10 rounded-xs text-muted transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :aria-label="$t('ui.previous')"
          @click="prevPage"
        >
          <ChevronLeftIcon cls="w-3.5 h-3.5" />
        </button>
        <span
          class="grid place-items-center min-w-7 h-7 px-1.5 border border-white/20 rounded-xs font-mono text-primary"
          >{{ page }}</span
        >
        <span class="px-1">{{ $t('ui.page_of_pages', { page, totalPages }) }}</span>
        <button
          :disabled="page >= totalPages"
          type="button"
          class="grid place-items-center w-7 h-7 border border-white/10 rounded-xs text-muted transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :aria-label="$t('ui.next')"
          @click="nextPage"
        >
          <ChevronRightIcon cls="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import ChevronRightIcon from '@/components/icons/ChevronRightIcon.vue'
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

const todayLabel = new Date().toLocaleDateString(locale.value, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

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
function fmtHr(a: Activity) {
  return a.avg_hr ? `${Math.round(a.avg_hr)} bpm` : '—'
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
