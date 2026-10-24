<template>
  <section
    class="items-center gap-12 lg:gap-12 grid lg:grid-cols-2 mx-auto px-6 lg:px-12 py-12 lg:py-14 lg:pl-20 max-w-shell scroll-mt-20"
  >
    <div class="flex flex-col items-start gap-7">
      <p class="font-bold text-label text-primary tracking-wide">
        {{ $t('landing.hero.kicker') }}
      </p>
      <h1
        class="font-black lg:text-display text-5xl sm:text-6xl leading-[1.05] lg:leading-[99%] tracking-tight"
      >
        {{ $t('landing.hero.titleLine1') }}<br />{{ $t('landing.hero.titleLine2') }}<br /><span
          class="text-primary"
          >{{ $t('landing.hero.titleLine3') }}</span
        >
      </h1>
      <p class="max-w-[510px] text-muted text-lg leading-body">
        {{ $t('landing.hero.subtitle') }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <RouterLink
          to="/login"
          class="flex items-center gap-3 bg-primary hover:brightness-110 px-5.5 py-4 rounded-lg font-bold text-sm transition"
        >
          {{ $t('nav.explore') }}<ArrowUpRightIcon cls="h-[18px] w-[18px] text-white" />
        </RouterLink>
      </div>
      <p class="text-faint text-xs">
        {{ $t('landing.hero.note') }}
      </p>
    </div>

    <!-- Product glimpse (sample preview, not live data) -->
    <div class="relative">
      <img
        src="/running-editorial.jpg"
        alt=""
        aria-hidden="true"
        class="border border-white/10 rounded-2xl w-full h-64 sm:h-80 lg:h-full object-center object-cover"
      />
      <p
        class="top-6 left-6 absolute flex flex-row items-start bg-black/50 px-3 py-[7px] border border-white/20 rounded-full font-semibold text-caption text-white leading-3"
      >
        {{ $t('landing.glimpse.badge') }}
      </p>
      <div
        class="z-10 relative flex flex-col items-start gap-4.5 bg-card mx-4 sm:mx-6 -mt-24 p-6 border border-white/10 rounded-2xl"
      >
        <div class="flex flex-row justify-between items-start self-stretch">
          <p class="font-bold text-label text-muted leading-label">
            {{ $t('landing.glimpse.todayLabel') }}
          </p>
          <p class="text-label text-success leading-label">
            {{ $t('landing.glimpse.weekLabel') }}
          </p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 items-center self-stretch gap-4">
          <div class="flex flex-col items-start gap-[5px]">
            <p class="font-bold text-caption text-primary leading-3">
              {{ $t('landing.glimpse.typeLabel') }}
            </p>
            <p class="font-black text-h1 leading-[53px]">
              {{ $t('landing.sections.today.distance')
              }}<span class="ml-1 font-bold text-lg align-middle">{{
                $t('landing.sections.today.unit')
              }}</span>
            </p>
          </div>
          <div class="flex flex-col items-start gap-[5px]">
            <p class="text-caption text-muted leading-3">
              {{ $t('landing.glimpse.targetLabel') }}
            </p>
            <p class="font-bold text-2xl leading-[29px]">
              {{ $t('landing.sections.today.pace') }}
            </p>
          </div>
          <ArrowUpRightIcon
            cls="col-span-2 sm:col-span-1 justify-self-end w-[30px] h-[30px] shrink-0 text-primary"
          />
        </div>
      </div>
    </div>
  </section>

  <!-- Product overview strip -->
  <section class="border-white/10 border-y">
    <div class="gap-8 grid grid-cols-2 lg:grid-cols-4 mx-auto px-6 lg:px-20 py-8 max-w-shell">
      <div
        v-for="a in areas"
        :key="a.n"
        class="flex flex-col gap-2"
      >
        <p class="text-label text-primary">{{ a.n }}</p>
        <p class="font-bold text-lg">{{ $t(a.tkey) }}</p>
        <p class="text-muted text-xs leading-relaxed">{{ $t(a.dkey) }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import ArrowUpRightIcon from '@/components/icons/ArrowUpRightIcon.vue'
import { useCapacity } from '@/modules/waitlist/infrastructure/composable/useCapacity.ts'

// Visitor-facing capacity is rendered by LandingFooter; the hero only warms the
// shared cache so the number is already there when the footer mounts.
const { checkCapacity } = useCapacity()

onMounted(() => {
  checkCapacity()
})

const areas = [
  {
    n: '01 /',
    tkey: 'landing.areas.today.title',
    dkey: 'landing.areas.today.desc',
  },
  {
    n: '02 /',
    tkey: 'landing.areas.plan.title',
    dkey: 'landing.areas.plan.desc',
  },
  {
    n: '03 /',
    tkey: 'landing.areas.progress.title',
    dkey: 'landing.areas.progress.desc',
  },
  {
    n: '04 /',
    tkey: 'landing.areas.goals.title',
    dkey: 'landing.areas.goals.desc',
  },
]
</script>
