<template>
  <!-- Daily workouts -->
  <section
    id="how"
    class="items-center gap-12 lg:gap-24 grid lg:grid-cols-2 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell scroll-mt-20"
  >
    <div class="flex flex-col items-start gap-6">
      <p class="font-bold text-label text-primary">{{ $t('today.label') }}</p>
      <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
        {{ $t('today.title') }}</h2>
      <p class="max-w-narrow text-muted text-base leading-loose">
        {{ $t('today.desc') }}</p>
      <div class="flex flex-col gap-6 pt-2.5">
        <div class="flex items-start gap-4">
          <RouteIcon cls="mt-0.5 h-[21px] w-[21px] shrink-0 text-primary" />
          <div>
            <p class="font-bold text-lead">
              {{ $t('today.b1t') }}</p>
            <p class="mt-1 text-body text-muted">
              {{ $t('today.b1d') }}</p>
          </div>
        </div>
        <div class="flex items-start gap-4">
          <PulseIcon cls="mt-0.5 h-[21px] w-[21px] shrink-0 text-primary" />
          <div>
            <p class="font-bold text-lead">{{ $t('today.b2t') }}</p>
            <p class="mt-1 text-body text-muted">
              {{ $t('today.b2d') }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-start text-label">
        <p class="font-bold text-muted">{{ $t('today.date') }}</p>
        <p class="text-success">{{ $t('today.week') }}</p>
      </div>
      <div class="bg-card p-7 border border-white/10 rounded-2xl">
        <div class="flex justify-between items-center">
          <p
            class="bg-primary/10 px-2.5 py-1 rounded font-extrabold text-caption text-primary uppercase"
          >
            {{ $t('plan.tempo') }}</p>
          <p class="flex items-center gap-1.5 text-label text-muted">
            <span class="bg-muted rounded-full w-2 h-2"></span>{{ $t('today.effort') }}</p>
        </div>
        <p class="mt-4 font-black text-hero leading-none">
          {{ $t('today.dist') }}<span class="ml-2 font-bold text-2xl align-middle">{{ $t('today.unit') }}</span>
        </p>
        <p class="mt-2 text-body text-muted">
          {{ $t('today.about') }}<span class="font-bold text-white">{{ $t('today.pace') }}</span>
        </p>
        <div class="gap-2.5 grid grid-cols-3 mt-5">
          <div class="bg-background p-3 border border-white/10 rounded-card">
            <p class="font-semibold text-micro text-muted uppercase">{{ $t('today.warmup') }}</p>
            <p class="mt-1 font-bold">{{ $t('today.warmupD') }}</p>
            <p class="text-caption text-muted">{{ $t('today.easy') }}</p>
          </div>
          <div class="bg-primary/10 p-3 border border-primary rounded-card">
            <p class="font-semibold text-micro text-primary uppercase">
              {{ $t('today.tempoBlock') }}</p>
            <p class="mt-1 font-bold">{{ $t('today.tempoD') }}</p>
            <p class="text-caption text-primary">{{ $t('today.tempoPace') }}</p>
          </div>
          <div class="bg-background p-3 border border-white/10 rounded-card">
            <p class="font-semibold text-micro text-muted uppercase">
              {{ $t('today.cooldown') }}</p>
            <p class="mt-1 font-bold">{{ $t('today.coolD') }}</p>
            <p class="text-caption text-muted">{{ $t('today.easy') }}</p>
          </div>
        </div>
        <div class="mt-5 pt-4 border-white/10 border-t">
          <p class="font-bold text-caption text-muted">{{ $t('today.why') }}</p>
          <p class="mt-2 text-muted text-xs leading-relaxed">
            {{ $t('today.whyText') }}</p>
        </div>
      </div>
      <div
        class="flex items-center gap-4 bg-card p-4.5 border border-white/10 rounded-2xl"
      >
        <div class="flex-1">
          <p class="font-semibold text-caption text-muted">
            {{ $t('today.rpe') }}</p>
          <p class="mt-1 font-semibold text-body">{{ $t('today.rpeV') }}</p>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-caption text-muted">{{ $t('today.status') }}</p>
          <p class="mt-1 text-body">{{ $t('today.statusV') }}</p>
        </div>
        <p class="flex items-center gap-1 font-bold text-primary text-xs">
          {{ $t('today.save') }}<ArrowUpRightIcon cls="h-3.5 w-3.5" />
        </p>
      </div>
    </div>
  </section>

  <!-- Training plan -->
  <section id="plan" class="bg-panel border-white/10 border-y scroll-mt-20">
    <div
      class="flex flex-col gap-9 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell"
    >
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-bold text-label text-primary">
            {{ $t('plan.label') }}</p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            {{ $t('plan.titleA') }}<br />{{ $t('plan.titleB') }}</h2>
        </div>
        <p
          class="lg:self-end lg:ml-auto max-w-mid text-muted text-base leading-loose"
        >
          {{ $t('plan.desc') }}</p>
      </div>
      <div>
        <div class="flex justify-between items-start gap-4">
          <p class="font-bold text-xs">{{ $t('plan.table') }}</p>
          <p class="text-label text-muted text-right">
            {{ $t('plan.week') }}</p>
        </div>
        <div class="gap-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 mt-5">
          <div
            v-for="d in week"
            :key="d.day"
            class="flex flex-col gap-4 p-4.5 border rounded-2xl min-h-[220px]"
            :class="
              d.today
                ? 'border-2 border-primary bg-primary/10'
                : 'border-white/10 bg-card'
            "
          >
            <div>
              <p
                class="font-extrabold text-sm"
                :class="d.today && 'text-primary'"
              >
                {{ $t(d.dayKey) }}
              </p>
              <p class="text-caption text-muted">{{ d.date }}</p>
            </div>
            <div class="bg-white/10 h-px"></div>
            <p
              class="font-extrabold text-micro"
              :class="d.typeKey === 'plan.rest' ? 'text-muted' : 'text-primary'"
            >
              {{ $t(d.typeKey).toUpperCase() }}
            </p>
            <p class="font-extrabold text-h3">{{ d.dist }}</p>
            <p class="text-label text-muted">{{ d.paceKey ? $t(d.paceKey) : d.pace }}</p>
            <p
              v-if="d.extra || d.extraKey"
              class="text-caption"
              :class="d.today ? 'text-primary' : 'text-muted'"
            >
              {{ d.extraKey ? $t(d.extraKey) : d.extra }}
            </p>
          </div>
        </div>
        <div
          class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-card mt-5 p-4 sm:p-5 border border-white/10 rounded-2xl"
        >
          <LightBulbIcon cls="h-[22px] w-[22px] shrink-0 sm:mt-1 text-primary" />
          <div class="flex-1">
            <p class="font-bold text-sm sm:text-body">
              {{ $t('plan.tipT') }}</p>
            <p class="text-muted text-xs sm:text-sm">
              {{ $t('plan.tipD') }}</p>
          </div>
          <p class="font-semibold text-xs sm:text-label text-primary whitespace-nowrap">
            {{ $t('plan.tipTag') }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Progress analytics -->
  <section
    id="progress"
    class="justify-items-end items-center gap-12 lg:gap-22 grid lg:grid-cols-2 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell scroll-mt-20"
  >
    <div class="flex flex-col gap-4">
      <div class="bg-card p-7 border border-white/10 rounded-2xl">
        <div class="flex justify-between items-center gap-4">
          <div>
            <p class="font-bold text-caption text-muted">
              {{ $t('progress.vol') }}</p>
            <p class="mt-1 font-extrabold text-[19px]">
              {{ $t('progress.volT') }}</p>
          </div>
          <p class="font-semibold text-body whitespace-nowrap">{{ $t('progress.peak') }}</p>
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
          <p class="font-bold text-sm">{{ $t('progress.paceT') }}</p>
          <p class="font-semibold text-success text-xs whitespace-nowrap">
            {{ $t('progress.paceD') }}</p>
        </div>
        <PaceSparklineIcon cls="mt-4 h-[70px] w-full" />
        <div class="flex justify-between mt-4 text-caption text-muted">
          <span>W1</span><span>W2</span><span>W3</span><span>W4</span
          ><span>W5</span><span>W6</span><span>W7</span>
        </div>
      </div>
    </div>
    <div class="flex flex-col items-start gap-6">
      <p class="font-bold text-label text-primary">{{ $t('progress.label') }}</p>
      <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
        {{ $t('progress.titleA') }}<br />{{ $t('progress.titleB') }}</h2>
      <p class="max-w-narrow text-muted text-base leading-loose">
        {{ $t('progress.desc') }}</p>
      <div class="flex gap-6 py-5 border-white/10 border-y w-full max-w-narrow">
        <div class="flex-1">
          <p class="font-semibold text-caption text-muted">{{ $t('progress.adh') }}</p>
          <p class="mt-2 font-extrabold text-h3">{{ $t('progress.adhV') }}</p>
          <p class="text-label text-muted">{{ $t('progress.adhD') }}</p>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-caption text-muted">{{ $t('progress.active') }}</p>
          <p class="mt-2 font-extrabold text-h3">{{ $t('progress.activeV') }}</p>
          <p class="text-label text-muted">{{ $t('progress.activeD') }}</p>
        </div>
      </div>
      <div class="flex flex-col gap-3 w-full max-w-narrow">
        <p class="font-bold text-caption text-muted">{{ $t('progress.mix') }}</p>
        <div v-for="m in mix" :key="m.label" class="flex flex-col gap-1.5">
          <div class="flex justify-between text-xs">
            <p class="text-muted">{{ m.label }}</p>
            <p class="font-bold">{{ m.pct }}%</p>
          </div>
          <div class="bg-track rounded h-1">
            <div
              class="bg-primary rounded h-1"
              :style="{ width: m.pct + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Activity history -->
  <section class="bg-panel border-white/10 border-y">
    <div class="flex flex-col gap-9 mx-auto px-6 lg:px-20 py-16 max-w-shell">
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-bold text-label text-primary">
            {{ $t('activities.label') }}</p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            {{ $t('activities.titleA') }}<br />{{ $t('activities.titleB') }}</h2>
        </div>
        <p
          class="lg:self-end lg:ml-auto max-w-mid text-muted text-base leading-loose"
        >
          {{ $t('activities.desc') }}</p>
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
      <div class="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible">
        <div
          v-for="r in rows"
          :key="r.title"
          class="flex min-w-[280px] flex-1 flex-col gap-3 rounded-2xl p-4 bg-card border border-white/10"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium text-caption text-primary">{{ r.type }}</span>
            <span class="text-muted">·</span>
            <span class="text-muted text-caption">{{ r.date }}</span>
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
    class="items-center gap-12 lg:gap-24 grid lg:grid-cols-2 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell"
  >
    <div class="flex flex-col items-start gap-6">
      <p class="font-bold text-label text-primary">
        {{ $t('goals.label') }}</p>
      <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
        {{ $t('goals.titleA') }}<br />{{ $t('goals.titleB') }}</h2>
      <p class="max-w-narrow text-muted text-base leading-loose">
        {{ $t('goals.desc') }}</p>
      <div
        class="flex flex-col gap-3.5 pt-4 border-white/10 border-t w-full max-w-narrow"
      >
        <p class="font-bold text-caption text-muted">
          {{ $t('goals.prs') }}</p>
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
          <p class="font-bold text-caption text-primary">{{ $t('goals.race') }}</p>
          <p class="text-label text-muted whitespace-nowrap">
            {{ $t('goals.left') }}</p>
        </div>
        <p class="mt-4 font-black text-[40px]">{{ $t('goals.raceName') }}</p>
        <div class="bg-track mt-4 rounded h-2">
          <div class="bg-primary rounded w-1/2 h-2"></div>
        </div>
        <div class="flex justify-between mt-3 text-label text-muted">
          <p>{{ $t('goals.weeks') }}</p>
          <p class="font-bold text-primary">50%</p>
        </div>
        <div
          class="gap-5 grid grid-cols-3 mt-5 pt-4.5 border-white/10 border-t"
        >
          <div>
            <p class="font-semibold text-caption text-muted">{{ $t('goals.finish') }}</p>
            <p class="mt-2 font-extrabold text-h3">1:45:00</p>
          </div>
          <div>
            <p class="font-semibold text-caption text-muted">{{ $t('goals.tpace') }}</p>
            <p class="mt-2 font-extrabold text-h3">5:00 /km</p>
          </div>
          <div>
            <p class="font-semibold text-caption text-muted">{{ $t('goals.mileage') }}</p>
            <p class="mt-2 font-extrabold text-h3">{{ $t('goals.miles') }}</p>
          </div>
        </div>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <p class="font-bold text-label">{{ $t('goals.upcoming') }}</p>
        <div
          v-for="m in milestones"
          :key="m.tKey"
          class="flex items-center gap-3.5 mt-4"
        >
          <span
            class="flex justify-center items-center border rounded-md w-[22px] h-[22px] shrink-0"
            :class="m.done ? 'border-primary bg-primary/10' : 'border-white/10'"
          >
            <CheckIcon v-if="m.done" cls="h-3 w-3 text-primary" />
          </span>
          <div>
            <p class="text-body" :class="m.done ? '' : 'text-muted'">
              {{ $t(m.tKey) }}
            </p>
            <p class="text-caption text-faint">{{ $t(m.dKey) }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Onboarding -->
  <section class="bg-panel border-white/10 border-y">
    <div class="flex flex-col gap-11 mx-auto px-6 lg:px-20 py-16 max-w-shell">
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-bold text-label text-primary">{{ $t('connect.label') }}</p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            {{ $t('connect.titleA') }}<br />{{ $t('connect.titleB') }}</h2>
        </div>
        <p class="max-w-mid text-muted text-base leading-loose">
          {{ $t('connect.desc') }}</p>
      </div>
      <div class="gap-6 grid md:grid-cols-3">
        <div
          v-for="s in steps"
          :key="s.n"
          class="flex flex-col gap-5 bg-background p-7 border border-white/10 rounded-2xl"
        >
          <div class="flex justify-between items-start">
            <p class="font-semibold text-primary text-xs">{{ s.n }}</p>
            <component :is="s.icon" cls="h-[22px] w-[22px] text-muted" />
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
      <p class="font-bold text-label text-primary">{{ $t('faq.label') }}</p>
      <h2 class="font-extrabold text-[42px] leading-display">
        {{ $t('faq.title') }}</h2>
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

<script setup>
import RouteIcon from "@/components/icons/RouteIcon.vue";
import PulseIcon from "@/components/icons/PulseIcon.vue";
import ArrowUpRightIcon from "@/components/icons/ArrowUpRightIcon.vue";
import LinkIcon from "@/components/icons/LinkIcon.vue";
import FlagIcon from "@/components/icons/FlagIcon.vue";
import LightBulbIcon from "@/components/icons/LightBulbIcon.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import PaceSparklineIcon from "@/components/icons/PaceSparklineIcon.vue";

const week = [
  {
    dayKey: "plan.mon",
    date: "Aug 25",
    typeKey: "plan.rest",
    dist: "—",
    paceKey: "plan.restNote1",
    extraKey: "plan.restSub1",
  },
  {
    dayKey: "plan.tue",
    date: "Aug 26",
    typeKey: "plan.recovery",
    dist: "5.0 km",
    pace: "5:50/km",
    extra: "RPE 4",
  },
  {
    dayKey: "plan.wed",
    date: "Aug 27",
    typeKey: "plan.tempo",
    dist: "7.0 km",
    pace: "5:15/km",
    extraKey: "plan.todayTag",
  },
  {
    dayKey: "plan.thu",
    date: "Aug 28",
    typeKey: "plan.rest",
    dist: "—",
    paceKey: "plan.restNote2",
    extraKey: "plan.restSub2",
  },
  {
    dayKey: "plan.fri",
    date: "Aug 29",
    typeKey: "plan.intervals",
    dist: "6.0 km",
    pace: "4:55/km",
    extra: "RPE 8",
  },
  {
    dayKey: "plan.sat",
    date: "Aug 30",
    typeKey: "plan.easy",
    dist: "4.0 km",
    pace: "6:00/km",
    extra: "RPE 3",
  },
  {
    dayKey: "plan.sun",
    date: "Aug 31",
    typeKey: "plan.long",
    dist: "12.0 km",
    pace: "5:40/km",
    extra: "RPE 5",
  },
];
week[2].today = true;
const bars = [66, 80, 92, 110, 102, 126, 141, 154];
const mix = [
  { label: "{{ $t('progress.mix1') }}", pct: 70 },
  { label: "{{ $t('progress.mix2') }}", pct: 20 },
  { label: "{{ $t('progress.mix3') }}", pct: 10 },
];
const filters = [
  "activities.all",
  "activities.easy",
  "activities.tempo",
  "activities.long",
  "activities.threshold",
  "activities.interval",
  "activities.recovery",
];
const rows = [
  {
    date: "Wed, Aug 27",
    type: "TEMPO",
    titleKey: "activities.r1t",
    dist: "7.0 km",
    dur: "36:12",
    pace: "5:10/km",
    hr: "158 bpm",
  },
  {
    date: "Tue, Aug 26",
    type: "EASY",
    titleKey: "activities.r2t",
    dist: "5.2 km",
    dur: "28:14",
    pace: "5:26/km",
    hr: "142 bpm",
  },
  {
    date: "Sun, Aug 24",
    type: "LONG",
    titleKey: "activities.r3t",
    dist: "16.5 km",
    dur: "1:26:12",
    pace: "5:13/km",
    hr: "146 bpm",
  },
  {
    date: "Thu, Aug 21",
    type: "INTERVAL",
    titleKey: "activities.r4t",
    dist: "6.4 km",
    dur: "32:15",
    pace: "5:02/km",
    hr: "168 bpm",
  },
];
const prs = [
  { dKey: "goals.pr1d", t: "22:15" },
  { dKey: "goals.pr2d", t: "46:30" },
  { dKey: "goals.pr3d", t: "1:52:00" },
];
const milestones = [
  {
    tKey: "goals.m1t",
    dKey: "goals.m1d",
    done: true,
  },
  {
    tKey: "goals.m2t",
    dKey: "goals.m2d",
    done: false,
  },
  {
    tKey: "goals.m3t",
    dKey: "goals.m3d",
    done: false,
  },
];
const steps = [
  {
    n: "01 /",
    tKey: "connect.s1t",
    dKey: "connect.s1d",
    icon: LinkIcon,
  },
  {
    n: "02 /",
    tKey: "connect.s2t",
    dKey: "connect.s2d",
    icon: FlagIcon,
  },
  {
    n: "03 /",
    tKey: "connect.s3t",
    dKey: "connect.s3d",
    icon: RouteIcon,
  },
];
const faqs = [
  {
    qKey: "faq.q1",
    aKey: "faq.a1",
  },
  {
    qKey: "faq.q2",
    aKey: "faq.a2",
  },
  {
    qKey: "faq.q3",
    aKey: "faq.a3",
  },
];
</script>
