<template>
  <section
    id="plan"
    class="bg-band border-white/10 border-y scroll-mt-20"
  >
    <div class="flex flex-col gap-9 mx-auto px-6 lg:px-12 py-16 max-w-[1240px]">
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-mono text-label text-faint">
            {{ $t('landing.sections.plan.kicker') }}
          </p>
          <h2 class="font-medium text-3xl lg:text-section leading-[1.06] tracking-[-0.03em]">
            {{ $t('landing.sections.plan.titleLine1') }}<br /><span class="text-muted">{{
              $t('landing.sections.plan.titleLine2')
            }}</span>
          </h2>
        </div>
        <p class="lg:self-end lg:ml-auto max-w-mid text-muted text-base leading-loose">
          {{ $t('landing.sections.plan.desc') }}
        </p>
      </div>
      <div class="mt-5">
        <div
          class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-5 [&>*]:min-w-0"
          role="group"
          tabindex="0"
          :aria-label="$t('landing.sections.plan.titleLine1')"
        >
          <DayCard
            v-for="d in week"
            :key="d.dayKey"
            :day-key="d.dayKey"
            :type-key="d.typeKey"
            :dist="d.dist"
            :today="d.today ?? false"
            :completed="d.completed ?? false"
          />
        </div>
        <div
          class="flex sm:flex-row flex-col items-start sm:items-center gap-3 sm:gap-4 bg-card mt-5 p-4 sm:p-5 border border-white/10 rounded-xl"
        >
          <div
            class="flex justify-center items-center bg-accent/10 p-3 rounded-xl w-[46px] h-[46px] shrink-0"
          >
            <LightBulbIcon cls="h-[22px] w-[22px] shrink-0 sm:mt-1 text-accent" />
          </div>
          <div class="flex-1">
            <p class="font-medium text-lead">
              {{ $t('landing.sections.plan.tip.title') }}
            </p>
            <p class="text-body text-muted">
              {{ $t('landing.sections.plan.tip.desc') }}
            </p>
          </div>
          <p class="font-mono text-label text-muted whitespace-nowrap">
            {{ $t('landing.sections.plan.tip.tag') }}
          </p>
        </div>
      </div>
    </div>
  </section>

  <section
    id="progress"
    class="mx-auto px-6 lg:px-12 py-16 max-w-[1240px] scroll-mt-20"
  >
    <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-14">
      <div class="flex flex-col items-start gap-6 w-full lg:w-[480px] shrink-0">
        <p class="font-mono text-label text-faint">
          {{ $t('landing.sections.progress.kicker') }}
        </p>
        <h2 class="font-medium text-3xl lg:text-section leading-[1.06] tracking-[-0.03em]">
          {{ $t('landing.sections.progress.titleLine1') }}<br /><span class="text-muted">{{
            $t('landing.sections.progress.titleLine2')
          }}</span>
        </h2>
        <p class="max-w-narrow text-muted text-base leading-loose">
          {{ $t('landing.sections.progress.desc') }}
        </p>
        <div class="flex gap-6 py-5 border-white/10 border-y w-full max-w-narrow">
          <div class="flex-1">
            <p class="font-medium text-caption text-muted">
              {{ $t('landing.sections.progress.adherence.title') }}
            </p>
            <p class="mt-2 font-medium text-h3">
              {{ $t('landing.sections.progress.adherence.value') }}
            </p>
            <p class="text-label text-muted">
              {{ $t('landing.sections.progress.adherence.desc') }}
            </p>
          </div>
          <div class="flex-1">
            <p class="font-medium text-caption text-muted">
              {{ $t('landing.sections.progress.activeWeeks.title') }}
            </p>
            <p class="mt-2 font-medium text-h3">
              {{ $t('landing.sections.progress.activeWeeks.value') }}
            </p>
            <p class="text-label text-muted">
              {{ $t('landing.sections.progress.activeWeeks.desc') }}
            </p>
          </div>
        </div>
        <div class="flex flex-col w-full max-w-narrow">
          <div
            v-for="m in mix"
            :key="m.label"
            class="flex justify-between py-3.5 border-b border-white/10 text-body last:border-0"
          >
            <p class="text-muted">{{ $t(m.label) }}</p>
            <p class="font-mono text-primary">{{ m.pct }}%</p>
          </div>
        </div>
      </div>
      <div class="flex flex-col flex-1 min-w-0 gap-4">
        <div class="bg-card p-5 border border-white/10 rounded-xl">
          <div class="flex justify-between items-baseline gap-4">
            <p class="font-medium text-body text-primary">
              {{ $t('landing.sections.progress.volume.title') }}
            </p>
            <p class="font-mono text-label text-muted whitespace-nowrap">
              {{ $t('landing.sections.progress.volume.peak') }}
            </p>
          </div>
          <div class="flex items-end gap-2 mt-6 h-[180px]">
            <div
              v-for="(h, i) in bars"
              :key="i"
              class="flex flex-col flex-1 justify-end items-center self-stretch gap-2.5"
            >
              <div
                class="rounded-t-md w-full"
                :class="i === bars.length - 1 ? 'bg-accent' : 'bg-bar'"
                :style="{ height: h + 'px' }"
              ></div>
              <p
                class="font-mono text-label"
                :class="i === bars.length - 1 ? 'text-primary' : 'text-muted'"
              >
                W{{ i + 1 }}
              </p>
            </div>
          </div>
        </div>
        <div class="bg-card p-5 border border-white/10 rounded-xl">
          <div class="flex justify-between items-start gap-4">
            <p class="font-medium text-sm">{{ $t('landing.sections.progress.pace.title') }}</p>
            <p class="font-mono text-accent text-xs whitespace-nowrap">
              {{ $t('landing.sections.progress.pace.delta') }}
            </p>
          </div>
          <LandingPaceChart class="mt-5" />
        </div>
      </div>
    </div>
  </section>

  <section
    id="activities"
    class="bg-band border-white/10 border-y"
  >
    <div class="flex flex-col gap-9 mx-auto px-6 lg:px-12 py-16 max-w-[1240px]">
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-mono text-label text-faint">
            {{ $t('landing.sections.activities.kicker') }}
          </p>
          <h2 class="font-medium text-3xl lg:text-section leading-[1.06] tracking-[-0.03em]">
            {{ $t('landing.sections.activities.titleLine1') }}<br /><span class="text-muted">{{
              $t('landing.sections.activities.titleLine2')
            }}</span>
          </h2>
        </div>
        <p class="lg:self-end lg:ml-auto max-w-mid text-muted text-base leading-loose">
          {{ $t('landing.sections.activities.desc') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-6 border-b border-white/10">
        <span
          v-for="(f, i) in filters"
          :key="f"
          class="-mb-px pb-3 border-b text-body"
          :class="i === 0 ? 'text-primary border-white/30' : 'text-muted border-transparent'"
          >{{ $t(f) }}</span
        >
      </div>
      <div
        class="flex gap-2.5 -mx-1 px-1 pb-1 sm:overflow-visible overflow-x-auto"
        role="group"
        tabindex="0"
        :aria-label="$t('landing.sections.activities.titleLine1')"
      >
        <div
          v-for="(r, i) in rows"
          :key="r.titleKey"
          class="flex flex-col flex-1 gap-3 bg-card px-5 py-6 border border-white/10 rounded-xl min-w-[260px]"
        >
          <div class="flex items-center gap-2 font-mono text-caption">
            <span
              v-if="i === 0"
              class="w-1.5 h-1.5 rounded-full bg-accent"
            ></span>
            <span class="text-primary">{{ r.type }}</span>
            <span class="ml-1 text-faint">{{ r.date }}</span>
          </div>
          <p class="font-medium text-lead leading-snug">{{ $t(r.titleKey) }}</p>
          <div class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-label text-muted">
            <span class="text-primary">{{ r.dist }}</span>
            <span>{{ r.dur }}</span>
            <span>{{ r.pace }}</span>
            <span>{{ r.hr }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import LightBulbIcon from '@/components/icons/LightBulbIcon.vue'
import DayCard from '@/components/ui/DayCard.vue'
import LandingPaceChart from '@/features/landing/components/LandingPaceChart.vue'
import { useLandingSections } from '@/features/landing/composables/useLandingSections.ts'

const { week, bars, mix, filters, rows } = useLandingSections()
</script>
