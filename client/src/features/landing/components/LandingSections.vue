<template>
  <!-- Daily workouts -->
  <section
    id="how"
    class="items-center gap-12 lg:gap-24 grid lg:grid-cols-2 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell scroll-mt-20"
  >
    <div class="flex flex-col items-start gap-6">
      <p class="font-bold text-label text-primary">{{ $t('landing.sections.today.kicker') }}</p>
      <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
        {{ $t('landing.sections.today.title') }}
      </h2>
      <p class="max-w-narrow text-muted text-base leading-loose">
        {{ $t('landing.sections.today.desc') }}
      </p>
      <div class="flex flex-col gap-6 pt-2.5">
        <div class="flex items-start gap-4">
          <div
            class="flex justify-center items-center bg-primary/10 p-3 rounded-xl w-[46px] h-[46px] shrink-0"
          >
            <RouteIcon cls="mt-0.5 h-[21px] w-[21px] shrink-0 text-primary" />
          </div>
          <div>
            <p class="font-bold text-lead">
              {{ $t('landing.sections.today.block1.title') }}
            </p>
            <p class="mt-1 text-body text-muted">
              {{ $t('landing.sections.today.block1.desc') }}
            </p>
          </div>
        </div>
        <div class="flex items-start gap-4">
          <div
            class="flex justify-center items-center bg-primary/10 p-3 rounded-xl w-[46px] h-[46px] shrink-0"
          >
            <PulseIcon cls="mt-0.5 h-[21px] w-[21px] shrink-0 text-primary" />
          </div>
          <div>
            <p class="font-bold text-lead">{{ $t('landing.sections.today.block2.title') }}</p>
            <p class="mt-1 text-body text-muted">
              {{ $t('landing.sections.today.block2.desc') }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-start text-label">
        <p class="font-bold text-muted">{{ $t('landing.sections.today.date') }}</p>
        <p class="text-success">{{ $t('landing.sections.today.week') }}</p>
      </div>
      <div class="bg-card p-7 border border-white/10 rounded-2xl">
        <div class="flex justify-between items-center">
          <p
            class="bg-primary/10 px-2.5 py-1 rounded font-extrabold text-caption text-primary uppercase"
          >
            {{ $t('landing.sections.plan.session.tempo') }}
          </p>
          <p class="flex items-center gap-1.5 text-label text-muted">
            <span class="bg-muted rounded-full w-2 h-2"></span
            >{{ $t('landing.sections.today.effort') }}
          </p>
        </div>
        <p class="mt-4 font-black text-hero leading-none">
          {{ $t('landing.sections.today.distance')
          }}<span class="ml-2 font-bold text-2xl align-middle">{{
            $t('landing.sections.today.unit')
          }}</span>
        </p>
        <p class="mt-2 text-body text-muted">
          {{ $t('landing.sections.today.about') }}
          <span class="font-bold text-white">{{ $t('landing.sections.today.pace') }}</span>
        </p>
        <div class="gap-2.5 grid grid-cols-3 mt-5">
          <div class="bg-background p-3 border border-white/10 rounded-card">
            <p class="font-semibold text-micro text-muted uppercase">
              {{ $t('landing.sections.today.warmup.label') }}
            </p>
            <p class="mt-1 font-bold">{{ $t('landing.sections.today.warmup.distance') }}</p>
            <p class="text-caption text-muted">{{ $t('landing.sections.today.easyPace') }}</p>
          </div>
          <div class="bg-primary/10 p-3 border border-primary rounded-card">
            <p class="font-semibold text-micro text-primary uppercase">
              {{ $t('landing.sections.today.tempo.label') }}
            </p>
            <p class="mt-1 font-bold">{{ $t('landing.sections.today.tempo.distance') }}</p>
            <p class="text-caption text-primary">{{ $t('landing.sections.today.tempo.pace') }}</p>
          </div>
          <div class="bg-background p-3 border border-white/10 rounded-card">
            <p class="font-semibold text-micro text-muted uppercase">
              {{ $t('landing.sections.today.cooldown.label') }}
            </p>
            <p class="mt-1 font-bold">{{ $t('landing.sections.today.cooldown.distance') }}</p>
            <p class="text-caption text-muted">{{ $t('landing.sections.today.easyPace') }}</p>
          </div>
        </div>
        <div class="mt-5 pt-4 border-white/10 border-t">
          <p class="font-bold text-caption text-muted">
            {{ $t('landing.sections.today.why.label') }}
          </p>
          <p class="mt-2 text-muted text-xs leading-relaxed">
            {{ $t('landing.sections.today.why.text') }}
          </p>
        </div>
      </div>
      <div
        class="flex sm:flex-row flex-col sm:items-center gap-x-4 gap-y-4 sm:gap-y-0 bg-card p-4.5 border border-white/10 rounded-2xl"
      >
        <div class="sm:flex-1 w-full sm:w-auto">
          <p class="font-semibold text-caption text-muted">
            {{ $t('landing.sections.today.rpe.label') }}
          </p>
          <p class="mt-1 font-semibold text-body">{{ $t('landing.sections.today.rpe.value') }}</p>
        </div>
        <div class="sm:flex-1 w-full sm:w-auto">
          <p class="font-semibold text-caption text-muted">
            {{ $t('landing.sections.today.status.label') }}
          </p>
          <p class="mt-1 text-body">{{ $t('landing.sections.today.status.value') }}</p>
        </div>
        <p class="flex items-center gap-1 font-bold text-primary text-xs">
          {{ $t('landing.sections.today.saveAction') }}<ArrowUpRightIcon cls="h-3.5 w-3.5" />
        </p>
      </div>
    </div>
  </section>

  <!-- Training plan -->
  <section
    id="plan"
    class="bg-panel border-white/10 border-y scroll-mt-20"
  >
    <div class="flex flex-col gap-9 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell">
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-bold text-label text-primary">
            {{ $t('landing.sections.plan.kicker') }}
          </p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            {{ $t('landing.sections.plan.titleLine1') }}<br />{{
              $t('landing.sections.plan.titleLine2')
            }}
          </h2>
        </div>
        <p class="lg:self-end lg:ml-auto max-w-mid text-muted text-base leading-loose">
          {{ $t('landing.sections.plan.desc') }}
        </p>
      </div>
      <div class="mt-5">
        <div class="flex flex-col justify-between items-start gap-4">
          <p class="font-bold text-xs">{{ $t('landing.sections.plan.tableTitle') }}</p>
          <p class="text-label text-muted text-right">
            {{ $t('landing.sections.plan.weekTitle') }}
          </p>
        </div>
        <div class="flex gap-2.5 -mx-1 mt-5 px-1 pb-1 sm:overflow-visible overflow-x-auto">
          <DayCard
            v-for="d in week"
            :key="d.dayKey"
            size="sm"
            :day-key="d.dayKey"
            :date="d.date"
            :type-key="d.typeKey"
            :dist="d.dist"
            :pace-key="d.paceKey ?? ''"
            :pace="d.pace ?? ''"
            :extra-key="d.extraKey ?? ''"
            :extra="d.extra ?? ''"
            :today="d.today ?? false"
          />
        </div>
        <div
          class="flex sm:flex-row flex-col items-start sm:items-center gap-3 sm:gap-4 bg-card mt-5 p-4 sm:p-5 border border-white/10 rounded-2xl"
        >
          <div
            class="flex justify-center items-center bg-primary/10 p-3 rounded-xl w-[46px] h-[46px] shrink-0"
          >
            <LightBulbIcon cls="h-[22px] w-[22px] shrink-0 sm:mt-1 text-primary" />
          </div>
          <div class="flex-1">
            <p class="font-bold sm:text-body text-sm">
              {{ $t('landing.sections.plan.tip.title') }}
            </p>
            <p class="text-muted text-xs sm:text-sm">
              {{ $t('landing.sections.plan.tip.desc') }}
            </p>
          </div>
          <p class="font-semibold text-primary sm:text-label text-xs whitespace-nowrap">
            {{ $t('landing.sections.plan.tip.tag') }}
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Progress analytics -->
  <section
    id="progress"
    class="mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell scroll-mt-20"
  >
    <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
      <div class="flex flex-col items-start gap-6">
        <p class="font-bold text-label text-primary">
          {{ $t('landing.sections.progress.kicker') }}
        </p>
        <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
          {{ $t('landing.sections.progress.titleLine1') }}<br />{{
            $t('landing.sections.progress.titleLine2')
          }}
        </h2>
        <p class="max-w-narrow text-muted text-base leading-loose">
          {{ $t('landing.sections.progress.desc') }}
        </p>
        <div class="flex gap-6 py-5 border-white/10 border-y w-full max-w-narrow">
          <div class="flex-1">
            <p class="font-semibold text-caption text-muted">
              {{ $t('landing.sections.progress.adherence.title') }}
            </p>
            <p class="mt-2 font-extrabold text-h3">
              {{ $t('landing.sections.progress.adherence.value') }}
            </p>
            <p class="text-label text-muted">
              {{ $t('landing.sections.progress.adherence.desc') }}
            </p>
          </div>
          <div class="flex-1">
            <p class="font-semibold text-caption text-muted">
              {{ $t('landing.sections.progress.activeWeeks.title') }}
            </p>
            <p class="mt-2 font-extrabold text-h3">
              {{ $t('landing.sections.progress.activeWeeks.value') }}
            </p>
            <p class="text-label text-muted">
              {{ $t('landing.sections.progress.activeWeeks.desc') }}
            </p>
          </div>
        </div>
        <div class="flex flex-col gap-3 w-full max-w-narrow">
          <p class="font-bold text-caption text-muted">
            {{ $t('landing.sections.progress.mix.title') }}
          </p>
          <div
            v-for="m in mix"
            :key="m.label"
            class="flex flex-col gap-1.5"
          >
            <div class="flex justify-between text-xs">
              <p class="text-muted">{{ $t(m.label) }}</p>
              <p class="font-bold">{{ m.pct }}%</p>
            </div>
            <ProgressBar
              :pct="m.pct"
              :label="$t(m.label)"
              size="xs"
              :rounded="false"
              bar-class="bg-primary"
              track-class="bg-track"
            />
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <div class="bg-card p-7 border border-white/10 rounded-2xl">
          <div class="flex justify-between items-center gap-4">
            <div>
              <p class="font-bold text-caption text-muted">
                {{ $t('landing.sections.progress.volume.title') }}
              </p>
              <p class="mt-1 font-extrabold text-[19px]">
                {{ $t('landing.sections.progress.volume.chartTitle') }}
              </p>
            </div>
            <p class="font-semibold text-body whitespace-nowrap">
              {{ $t('landing.sections.progress.volume.peak') }}
            </p>
          </div>
          <div class="flex items-end gap-2 sm:gap-4 mt-6 h-[160px]">
            <div
              v-for="(h, i) in bars"
              :key="i"
              class="flex flex-col flex-1 justify-end items-center self-stretch gap-2.5"
            >
              <div
                class="rounded-t-[5px] w-full max-w-[35px]"
                :class="i === 5 ? 'bg-primary' : 'bg-bar'"
                :style="{ height: h + 'px' }"
              ></div>
              <p
                class="text-caption"
                :class="i === 5 ? 'text-primary' : 'text-muted'"
              >
                W{{ i + 1 }}
              </p>
            </div>
          </div>
        </div>
        <div class="bg-card p-6 border border-white/10 rounded-2xl">
          <div class="flex justify-between items-start gap-4">
            <p class="font-bold text-sm">{{ $t('landing.sections.progress.pace.title') }}</p>
            <p class="font-semibold text-success text-xs whitespace-nowrap">
              {{ $t('landing.sections.progress.pace.delta') }}
            </p>
          </div>
          <PaceSparklineIcon cls="mt-4 h-[70px] w-full" />
          <div class="flex justify-between mt-4 text-caption text-muted">
            <span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span
            ><span>W6</span><span>W7</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Activity history -->
  <section
    id="activities"
    class="bg-panel border-white/10 border-y"
  >
    <div class="flex flex-col gap-9 mx-auto px-6 lg:px-20 py-16 max-w-shell">
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-bold text-label text-primary">
            {{ $t('landing.sections.activities.kicker') }}
          </p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            {{ $t('landing.sections.activities.titleLine1') }}<br />{{
              $t('landing.sections.activities.titleLine2')
            }}
          </h2>
        </div>
        <p class="lg:self-end lg:ml-auto max-w-mid text-muted text-base leading-loose">
          {{ $t('landing.sections.activities.desc') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(f, i) in filters"
          :key="f"
          class="px-4.5 py-2 border border-white/10 rounded-full font-bold text-label"
          :class="i === 0 ? 'bg-primary' : 'bg-card'"
          >{{ $t(f) }}</span
        >
      </div>
      <div class="flex gap-2.5 -mx-1 px-1 pb-1 sm:overflow-visible overflow-x-auto">
        <div
          v-for="r in rows"
          :key="r.titleKey"
          class="flex flex-col flex-1 gap-3 bg-card p-4 border border-white/10 rounded-2xl min-w-[280px]"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium text-caption text-primary">{{ r.type }}</span>
            <span class="text-muted">·</span>
            <span class="text-caption text-muted">{{ r.date }}</span>
          </div>
          <p class="font-bold text-lg">{{ $t(r.titleKey) }}</p>
          <div class="flex flex-wrap gap-3 text-body text-muted">
            <span>{{ r.dist }}</span>
            <span>{{ r.dur }}</span>
            <span>{{ r.pace }}</span>
            <span>{{ r.hr }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Goals -->
  <section
    id="goals"
    class="items-center gap-12 lg:gap-24 grid lg:grid-cols-2 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell"
  >
    <div class="flex flex-col items-start gap-6">
      <p class="font-bold text-label text-primary">
        {{ $t('landing.sections.goals.kicker') }}
      </p>
      <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
        {{ $t('landing.sections.goals.titleLine1') }}<br />{{
          $t('landing.sections.goals.titleLine2')
        }}
      </h2>
      <p class="max-w-narrow text-muted text-base leading-loose">
        {{ $t('landing.sections.goals.desc') }}
      </p>
      <div class="flex flex-col gap-3.5 pt-4 border-white/10 border-t w-full max-w-narrow">
        <p class="font-bold text-caption text-muted">
          {{ $t('landing.sections.goals.prs.title') }}
        </p>
        <div
          v-for="pr in prs"
          :key="pr.dKey"
          class="flex justify-between items-center py-3 border-white/10 border-b text-body"
        >
          <p>{{ $t(pr.dKey) }}</p>
          <p class="font-bold text-lead text-primary">{{ pr.t }}</p>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-4">
      <div class="bg-card p-7 border border-white/10 rounded-2xl">
        <div class="flex justify-between items-start gap-4">
          <p class="font-bold text-caption text-primary">
            {{ $t('landing.sections.goals.race.title') }}
          </p>
          <p class="text-label text-muted whitespace-nowrap">
            {{ $t('landing.sections.goals.race.daysLeft') }}
          </p>
        </div>
        <p class="mt-4 font-black text-[40px]">{{ $t('landing.sections.goals.race.name') }}</p>
        <div class="bg-track mt-4 rounded h-2">
          <div class="bg-primary rounded w-1/2 h-2"></div>
        </div>
        <div class="flex justify-between mt-3 text-label text-muted">
          <p>{{ $t('landing.sections.goals.race.weeksComplete') }}</p>
          <p class="font-bold text-primary">50%</p>
        </div>
        <div class="gap-5 grid grid-cols-3 mt-5 pt-4.5 border-white/10 border-t">
          <div>
            <p class="font-semibold text-caption text-muted">
              {{ $t('landing.sections.goals.finishTime.label') }}
            </p>
            <p class="mt-2 font-extrabold text-h3">1:45:00</p>
          </div>
          <div>
            <p class="font-semibold text-caption text-muted">
              {{ $t('landing.sections.goals.trainingPace.label') }}
            </p>
            <p class="mt-2 font-extrabold text-h3">5:00 /km</p>
          </div>
          <div>
            <p class="font-semibold text-caption text-muted">
              {{ $t('landing.sections.goals.weeklyMileage.label') }}
            </p>
            <p class="mt-2 font-extrabold text-h3">
              {{ $t('landing.sections.goals.weeklyMileage.value') }}
            </p>
          </div>
        </div>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <p class="font-bold text-label">{{ $t('landing.sections.goals.milestones.title') }}</p>
        <div
          v-for="m in milestones"
          :key="m.tKey"
          class="flex items-center gap-3.5 mt-4"
        >
          <span
            class="flex justify-center items-center border-border rounded-md w-[22px] h-[22px] shrink-0"
            :class="m.done ? 'border-primary bg-primary/10' : 'border-white/10'"
          >
            <CheckIcon
              v-if="m.done"
              cls="h-3 w-3 text-primary"
            />
          </span>
          <div>
            <p
              class="text-body"
              :class="m.done ? '' : 'text-muted'"
            >
              {{ $t(m.tKey) }}
            </p>
            <p class="text-caption text-faint">{{ $t(m.dKey) }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Onboarding -->
  <section
    id="connect"
    class="bg-panel border-white/10 border-y"
  >
    <div class="flex flex-col gap-11 mx-auto px-6 lg:px-20 py-16 max-w-shell">
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-bold text-label text-primary">
            {{ $t('landing.sections.connect.kicker') }}
          </p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            {{ $t('landing.sections.connect.titleLine1') }}<br />{{
              $t('landing.sections.connect.titleLine2')
            }}
          </h2>
        </div>
        <p class="max-w-mid text-muted text-base leading-loose">
          {{ $t('landing.sections.connect.desc') }}
        </p>
      </div>
      <div class="gap-6 grid md:grid-cols-3">
        <div
          v-for="s in steps"
          :key="s.n"
          class="flex flex-col gap-5 bg-background p-7 border border-white/10 rounded-2xl"
        >
          <div class="flex justify-between items-start">
            <p class="font-semibold text-label text-primary">{{ s.n }}</p>

            <div
              class="flex justify-center items-center bg-primary/10 p-3 rounded-xl w-[46px] h-[46px] shrink-0"
            >
              <component
                :is="s.icon"
                cls="h-[22px] w-[22px] text-primary"
              />
            </div>
          </div>
          <p class="font-bold text-xl">{{ $t(s.tKey) }}</p>
          <p class="text-muted text-sm leading-body">{{ $t(s.dKey) }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section
    id="faq"
    class="gap-10 lg:gap-24 grid lg:grid-cols-[380px_1fr] mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell scroll-mt-20"
  >
    <div class="flex flex-col gap-5">
      <p class="font-bold text-label text-primary">{{ $t('landing.sections.faq.kicker') }}</p>
      <h2 class="font-extrabold text-[42px] leading-display">
        {{ $t('landing.sections.faq.title') }}
      </h2>
    </div>
    <div class="flex flex-col">
      <div
        v-for="q in faqs"
        :key="q.qKey"
        class="flex flex-col gap-3 py-6 border-white/10 border-t"
      >
        <p class="font-bold text-[17px]">{{ $t(q.qKey) }}</p>
        <p class="text-muted text-sm leading-body">{{ $t(q.aKey) }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import ArrowUpRightIcon from '@/components/icons/ArrowUpRightIcon.vue'
import CheckIcon from '@/components/icons/CheckIcon.vue'
import LightBulbIcon from '@/components/icons/LightBulbIcon.vue'
import PaceSparklineIcon from '@/components/icons/PaceSparklineIcon.vue'
import PulseIcon from '@/components/icons/PulseIcon.vue'
import RouteIcon from '@/components/icons/RouteIcon.vue'
import DayCard from '@/components/ui/DayCard.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import { useLandingSections } from '@/features/landing/composables/useLandingSections.ts'

const { week, bars, mix, filters, rows, prs, milestones, steps, faqs } = useLandingSections()
</script>
