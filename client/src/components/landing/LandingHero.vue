<template>
  <section
    id="app"
    class="items-center gap-12 lg:gap-12 grid lg:grid-cols-2 mx-auto px-6 lg:px-12 py-12 lg:py-14 lg:pl-20 max-w-shell scroll-mt-20"
  >
    <div class="flex flex-col items-start gap-7">
      <p class="font-bold text-label text-primary tracking-wide">
        YOUR RUNNING. WITH DIRECTION.
      </p>
      <h1
        class="font-black lg:text-display text-5xl sm:text-6xl leading-[1.05] lg:leading-[99%] tracking-tight"
      >
        Every run.<br />A reason.<br /><span class="text-primary"
          >A little closer.</span
        >
      </h1>
      <p class="max-w-[510px] text-muted text-lg leading-body">
        Bring your daily workouts, training plan and progress into focus. From
        today's tempo to your next starting line.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <a
          href="/api/strava/authorize"
          class="flex items-center gap-3 bg-strava hover:brightness-110 px-5.5 py-4 rounded-lg font-bold text-sm transition"
        >
          <StravaIcon cls="h-[25px] w-[25px] text-white" />
          Continue with Strava
        </a>
        <RouterLink
          to="/login"
          class="flex items-center gap-3 hover:bg-white/5 px-5.5 py-4 border border-white/10 rounded-lg font-bold text-sm transition"
        >
          Explore the app
          <ArrowUpRightIcon cls="h-[18px] w-[18px] text-white" />
        </RouterLink>
      </div>
      <p class="text-faint text-xs">
        Connect with Strava. Keep your running in view.
      </p>
      <p class="flex items-center gap-3 pt-6 font-bold text-caption text-muted">
        PLAN WITH PURPOSE
        <span class="font-normal text-primary text-xs">/</span> SEE YOUR
        PROGRESS
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
        BUILT AROUND THE RUN
      </p>
      <div
        class="z-10 relative flex flex-col items-start gap-4.5 bg-card mx-4 sm:mx-6 -mt-24 p-6 border border-white/10 rounded-2xl"
      >
        <div class="flex flex-row justify-between items-start self-stretch">
          <p class="font-bold text-label text-muted leading-label">
            TODAY'S WORKOUT
          </p>
          <p class="text-label text-success leading-label">Week 6 of 12</p>
        </div>
        <div
          class="flex flex-row justify-between items-center self-stretch gap-4"
        >
          <div class="flex flex-col items-start gap-[5px]">
            <p class="font-bold text-caption text-primary leading-3">
              TEMPO RUN
            </p>
            <p class="font-black text-h1 leading-[53px]">
              7.0<span class="ml-1 font-bold text-lg align-middle">km</span>
            </p>
          </div>
          <div class="flex flex-col items-start gap-[5px]">
            <p class="text-caption text-muted leading-3">TARGET PACE</p>
            <p class="font-bold text-2xl leading-[29px]">5:15/km</p>
          </div>
          <ArrowUpRightIcon cls="w-[30px] h-[30px] shrink-0 text-primary" />
        </div>
        <p class="text-caption text-faint leading-3">
          Illustrative athlete data
        </p>
      </div>
    </div>
  </section>

  <!-- Product overview strip -->
  <section class="border-white/10 border-y">
    <div
      class="gap-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mx-auto px-6 lg:px-20 py-8 max-w-shell"
    >
      <div v-for="a in areas" :key="a.n" class="flex flex-col gap-2">
        <p class="text-caption text-primary">{{ a.n }}</p>
        <p class="font-bold text-lg">{{ a.title }}</p>
        <p class="text-muted text-xs leading-relaxed">{{ a.desc }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import StravaIcon from "@/components/icons/StravaIcon.vue";
import ArrowUpRightIcon from "@/components/icons/ArrowUpRightIcon.vue";

const areas = [
  {
    n: "01 /",
    title: "Today",
    desc: "Know the session. Understand the why.",
  },
  {
    n: "02 /",
    title: "Plan",
    desc: "See the rhythm of your training.",
  },
  {
    n: "03 /",
    title: "Progress",
    desc: "Put your effort into perspective.",
  },
  {
    n: "04 /",
    title: "Goals & activities",
    desc: "Keep the bigger picture in sight.",
  },
];
</script>
