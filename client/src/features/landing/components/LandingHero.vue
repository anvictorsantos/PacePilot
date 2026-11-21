<template>
  <section
    class="items-center gap-12 lg:gap-14 grid lg:grid-cols-[1.02fr_1fr] mx-auto px-6 lg:px-12 py-14 max-w-[1240px] scroll-mt-20"
  >
    <div class="flex flex-col items-start">
      <p class="mb-5.5 font-mono text-label text-muted">{{ $t('landing.hero.kicker') }}</p>
      <h1
        class="mb-6 font-medium text-5xl sm:text-6xl lg:text-[62px] leading-[1.02] tracking-[-0.035em] text-balance"
      >
        {{ $t('landing.hero.titleLine1') }}<br />{{ $t('landing.hero.titleLine2') }}<br /><span
          class="text-muted"
          >{{ $t('landing.hero.titleLine3') }}</span
        >
      </h1>
      <p class="mb-7.5 max-w-[44ch] text-muted text-lead leading-relaxed">
        {{ $t('landing.hero.subtitle') }}
      </p>
      <div class="flex items-center gap-5 mb-4.5">
        <RouterLink
          :to="{ path: '/login', query: { mode: 'register' } }"
          class="inline-flex items-center bg-primary hover:brightness-110 px-4.5 py-2.5 rounded-lg font-medium text-body text-background transition"
        >
          {{ $t('nav.register') }}
        </RouterLink>
        <RouterLink
          to="/login"
          class="text-muted hover:text-primary text-body transition"
        >
          {{ $t('nav.login') }}
        </RouterLink>
      </div>
      <p class="text-label text-faint">
        {{ $t('landing.hero.note') }}
      </p>
    </div>

    <!-- Sample preview, not live data -->
    <div class="bg-card p-5 border border-white/10 rounded-xl shadow-[0_18px_40px_rgba(0,0,0,.35)]">
      <div class="flex justify-between items-baseline mb-4">
        <span class="font-medium text-body text-primary">{{
          $t('landing.glimpse.weekLabel')
        }}</span>
        <span class="font-mono text-label text-muted">{{ $t('landing.hero.featurePlan') }}</span>
      </div>
      <div class="grid grid-cols-7 gap-2">
        <div
          v-for="d in sampleWeek"
          :key="d.day"
          class="flex flex-col gap-1 p-2.5 pb-3 border rounded-lg min-h-[96px]"
          :class="
            d.today
              ? 'border-white/20 bg-cardSecondary'
              : d.rest
                ? 'border-white/10 bg-transparent'
                : 'border-white/10 bg-transparent'
          "
        >
          <span
            class="font-mono text-caption"
            :class="d.today ? 'text-primary' : 'text-faint'"
            >{{ $t(d.day) }}</span
          >
          <span
            class="text-label leading-tight"
            :class="d.today ? 'text-primary' : 'text-muted'"
            >{{ $t(d.type) }}</span
          >
          <span
            class="mt-auto font-mono text-label"
            :class="d.rest ? 'text-faint' : 'text-primary'"
            >{{ d.km }}</span
          >
        </div>
      </div>
      <div class="mt-4 pt-3.5 border-t border-white/10">
        <div class="flex justify-between mb-2.5 font-mono text-label text-muted">
          <span>{{ $t('landing.sections.today.date') }}</span>
          <span>{{ $t('landing.sections.today.week') }}</span>
        </div>
        <div
          class="flex gap-0.5 h-2"
          aria-hidden="true"
        >
          <i class="block bg-[#2c2c34] rounded-xs w-[29%]"></i>
          <i class="block bg-accent rounded-xs w-[48%]"></i>
          <i class="block bg-[#2c2c34] rounded-xs w-[23%]"></i>
        </div>
        <div class="flex gap-0.5 mt-2 font-mono text-caption text-faint">
          <span class="w-[29%] whitespace-nowrap overflow-hidden text-ellipsis">{{
            $t('landing.sections.today.warmup.distance')
          }}</span>
          <span class="w-[48%] whitespace-nowrap overflow-hidden text-ellipsis">{{
            $t('landing.sections.today.tempo.distance')
          }}</span>
          <span class="w-[23%] whitespace-nowrap overflow-hidden text-ellipsis">{{
            $t('landing.sections.today.cooldown.distance')
          }}</span>
        </div>
      </div>
    </div>
  </section>

  <section class="border-white/10 border-y">
    <div class="gap-8 grid grid-cols-2 lg:grid-cols-4 mx-auto px-6 lg:px-12 py-8 max-w-[1240px]">
      <div
        v-for="a in areas"
        :key="a.n"
        class="flex flex-col gap-2"
      >
        <p class="font-mono text-caption text-faint">{{ a.n }}</p>
        <p class="font-medium text-body text-primary">{{ $t(a.tkey) }}</p>
        <p class="text-muted text-label leading-relaxed">{{ $t(a.dkey) }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const sampleWeek = [
  {
    day: 'landing.sections.plan.days.monday',
    type: 'landing.sections.plan.session.easy',
    km: '8 km',
  },
  {
    day: 'landing.sections.plan.days.tuesday',
    type: 'landing.sections.plan.session.tempo',
    km: '7 km',
    today: true,
  },
  {
    day: 'landing.sections.plan.days.wednesday',
    type: 'landing.sections.plan.session.rest',
    km: '—',
    rest: true,
  },
  {
    day: 'landing.sections.plan.days.thursday',
    type: 'landing.sections.plan.session.intervals',
    km: '10 km',
  },
  {
    day: 'landing.sections.plan.days.friday',
    type: 'landing.sections.plan.session.easy',
    km: '6 km',
  },
  {
    day: 'landing.sections.plan.days.saturday',
    type: 'landing.sections.plan.session.rest',
    km: '—',
    rest: true,
  },
  {
    day: 'landing.sections.plan.days.sunday',
    type: 'landing.sections.plan.session.long',
    km: '18 km',
  },
]

const areas = [
  { n: '01', tkey: 'landing.areas.today.title', dkey: 'landing.areas.today.desc' },
  { n: '02', tkey: 'landing.areas.plan.title', dkey: 'landing.areas.plan.desc' },
  { n: '03', tkey: 'landing.areas.progress.title', dkey: 'landing.areas.progress.desc' },
  { n: '04', tkey: 'landing.areas.goals.title', dkey: 'landing.areas.goals.desc' },
]
</script>
