<template>
  <!-- Daily workouts -->
  <section
    id="how"
    class="items-center gap-12 lg:gap-24 grid lg:grid-cols-2 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell scroll-mt-20"
  >
    <div class="flex flex-col items-start gap-6">
      <p class="font-bold text-label text-primary">01 / MAKE TODAY COUNT</p>
      <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
        Don't just know what. Know why.
      </h2>
      <p class="max-w-narrow text-muted text-base leading-loose">
        Head out with a clear distance, target pace and effort level. Every
        session is broken into warmup, main work and cooldown — with the purpose
        behind it.
      </p>
      <div class="flex flex-col gap-6 pt-2.5">
        <div class="flex items-start gap-4">
          <RouteIcon cls="mt-0.5 h-[21px] w-[21px] shrink-0 text-primary" />
          <div>
            <p class="font-bold text-lead">
              A clear session, from start to finish
            </p>
            <p class="mt-1 text-body text-muted">
              See the structure before you lace up.
            </p>
          </div>
        </div>
        <div class="flex items-start gap-4">
          <PulseIcon cls="mt-0.5 h-[21px] w-[21px] shrink-0 text-primary" />
          <div>
            <p class="font-bold text-lead">
              Your effort belongs in the story
            </p>
            <p class="mt-1 text-body text-muted">
              Log RPE, completion and how the run felt.
            </p>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-start text-label">
        <p class="font-bold text-muted">TODAY / WEDNESDAY, AUG 27</p>
        <p class="text-success">Week 6 of 12</p>
      </div>
      <div class="bg-card p-7 border border-white/10 rounded-2xl">
        <div class="flex justify-between items-center">
          <p
            class="bg-primary/10 px-2.5 py-1 rounded font-extrabold text-caption text-primary"
          >
            TEMPO RUN
          </p>
          <p class="flex items-center gap-1.5 text-label text-muted">
            <span class="bg-muted rounded-full w-2 h-2"></span>Moderate–Hard
          </p>
        </div>
        <p class="mt-4 font-black text-hero leading-none">
          7.0<span class="ml-2 font-bold text-2xl align-middle">km</span>
        </p>
        <p class="mt-2 text-body text-muted">
          ~40 min · Target pace
          <span class="font-bold text-white">5:15/km</span>
        </p>
        <div class="gap-2.5 grid grid-cols-3 mt-5">
          <div class="bg-background p-3 border border-white/10 rounded-card">
            <p class="font-semibold text-micro text-muted uppercase">Warmup</p>
            <p class="mt-1 font-bold">1.5 km</p>
            <p class="text-caption text-muted">Easy pace</p>
          </div>
          <div class="bg-primary/10 p-3 border border-primary rounded-card">
            <p class="font-semibold text-micro text-primary uppercase">
              Tempo block
            </p>
            <p class="mt-1 font-bold">4.0 km</p>
            <p class="text-caption text-primary">5:15/km pace</p>
          </div>
          <div class="bg-background p-3 border border-white/10 rounded-card">
            <p class="font-semibold text-micro text-muted uppercase">
              Cooldown
            </p>
            <p class="mt-1 font-bold">1.5 km</p>
            <p class="text-caption text-muted">Easy pace</p>
          </div>
        </div>
        <div class="mt-5 pt-4 border-white/10 border-t">
          <p class="font-bold text-caption text-muted">WHY THIS WORKOUT</p>
          <p class="mt-2 text-muted text-xs leading-relaxed">
            Tempo runs increase your lactate threshold, allowing you to sustain
            a faster pace for longer without building up excessive muscle
            fatigue.
          </p>
        </div>
      </div>
      <div
        class="flex items-center gap-4 bg-card p-4.5 border border-white/10 rounded-2xl"
      >
        <div class="flex-1">
          <p class="font-semibold text-caption text-muted">
            EFFORT INTENSITY (RPE)
          </p>
          <p class="mt-1 font-semibold text-body">7 – Moderate Hard</p>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-caption text-muted">COMPLETION STATUS</p>
          <p class="mt-1 text-body">Completed as planned</p>
        </div>
        <p class="flex items-center gap-1 font-bold text-primary text-xs">
          Save Session <ArrowUpRightIcon cls="h-3.5 w-3.5" />
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
            02 / THE WEEK HAS A RHYTHM
          </p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            The right work.<br />Room to recover.
          </h2>
        </div>
        <p
          class="lg:self-end lg:ml-auto max-w-mid text-muted text-base leading-loose"
        >
          Easy days, tempo sessions, intervals and long runs, all in one weekly
          view. Look ahead to the next training block and understand when it's
          time to taper.
        </p>
      </div>
      <div>
        <div class="flex justify-between items-start gap-4">
          <p class="font-bold text-xs">HALF MARATHON TRAINING PLAN</p>
          <p class="text-label text-muted text-right">
            WEEK 6 OF 12 · AUGUST 25 – AUGUST 31
          </p>
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
                {{ d.day }}
              </p>
              <p class="text-caption text-muted">{{ d.date }}</p>
            </div>
            <div class="bg-white/10 h-px"></div>
            <p
              class="font-extrabold text-micro"
              :class="d.type === 'Rest day' ? 'text-muted' : 'text-primary'"
            >
              {{ d.type.toUpperCase() }}
            </p>
            <p class="font-extrabold text-h3">{{ d.dist }}</p>
            <p class="text-label text-muted">{{ d.pace }}</p>
            <p
              v-if="d.extra"
              class="text-caption"
              :class="d.today ? 'text-primary' : 'text-muted'"
            >
              {{ d.extra }}
            </p>
          </div>
        </div>
        <div
          class="flex items-center gap-4 bg-card mt-5 p-5 border border-white/10 rounded-2xl"
        >
          <LightBulbIcon cls="h-[22px] w-[22px] shrink-0 text-primary" />
          <div class="flex-1">
            <p class="font-bold text-body">
              Coaching Tip: The Science of Tapering
            </p>
            <p class="text-muted text-xs">
              Understand why reducing volume in the final weeks gives recovery
              its place in your race preparation.
            </p>
          </div>
          <p class="font-semibold text-label text-primary whitespace-nowrap">
            BUILD → PEAK → TAPER
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Progress analytics -->
  <section
    id="progress"
    class="items-center gap-12 lg:gap-22 grid lg:grid-cols-2 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell scroll-mt-20"
  >
    <div class="flex flex-col gap-4">
      <div class="bg-card p-7 border border-white/10 rounded-2xl">
        <div class="flex justify-between items-center gap-4">
          <div>
            <p class="font-bold text-caption text-muted">
              WEEKLY TRAINING VOLUME
            </p>
            <p class="mt-1 font-extrabold text-[19px]">
              Progression Over 8 Weeks
            </p>
          </div>
          <p class="font-semibold text-body whitespace-nowrap">
            Peak: 38.6 km
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
          <p class="font-bold text-sm">Average Pace Trend</p>
          <p class="font-semibold text-success text-xs whitespace-nowrap">
            −14s/km faster
          </p>
        </div>
        <PaceSparklineIcon cls="mt-4 h-[70px] w-full" />
        <div class="flex justify-between mt-4 text-caption text-muted">
          <span>W1</span><span>W2</span><span>W3</span><span>W4</span
          ><span>W5</span><span>W6</span><span>W7</span>
        </div>
      </div>
    </div>
    <div class="flex flex-col items-start gap-6">
      <p class="font-bold text-label text-primary">03 / SEE THE WORK ADD UP</p>
      <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
        More context.<br />Less guesswork.
      </h2>
      <p class="max-w-narrow text-muted text-base leading-loose">
        Distance tells one part of the story. Follow volume and pace over time,
        then look at adherence and intensity to understand the shape of your
        training.
      </p>
      <div
        class="flex gap-6 py-5 border-white/10 border-y w-full max-w-narrow"
      >
        <div class="flex-1">
          <p class="font-semibold text-caption text-muted">28D ADHERENCE</p>
          <p class="mt-2 font-extrabold text-h3">92%</p>
          <p class="text-label text-muted">Scheduled runs completed</p>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-caption text-muted">ACTIVE WEEKS</p>
          <p class="mt-2 font-extrabold text-h3">6 / 12</p>
          <p class="text-label text-muted">Training plan progress</p>
        </div>
      </div>
      <div class="flex flex-col gap-3 w-full max-w-narrow">
        <p class="font-bold text-caption text-muted">INTENSITY DISTRIBUTION</p>
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
            04 / EVERY SESSION HAS A STORY
          </p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            Your running history.<br />Not just a feed.
          </h2>
        </div>
        <p
          class="lg:self-end lg:ml-auto max-w-mid text-muted text-base leading-loose"
        >
          Revisit your runs by type. Compare distance, duration, pace and heart
          rate, then explore lap splits and session detail when you want a
          closer look.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(f, i) in filters"
          :key="f"
          class="px-4.5 py-2 border border-white/10 rounded-full font-bold text-label"
          :class="i === 0 ? 'bg-primary' : 'bg-card'"
          >{{ f }}</span
        >
      </div>
      <div class="bg-card border border-white/10 rounded-2xl overflow-x-auto">
        <table class="w-full min-w-[760px] text-left">
          <thead>
            <tr class="font-bold text-caption text-muted">
              <th class="p-4.5 font-bold">DATE</th>
              <th class="font-bold">TYPE</th>
              <th class="font-bold">RUN TITLE</th>
              <th class="font-bold">DISTANCE</th>
              <th class="font-bold">DURATION</th>
              <th class="font-bold">AVG PACE</th>
              <th class="font-bold">AVG HR</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in rows"
              :key="r.title"
              class="border-white/10 border-t text-body"
            >
              <td class="p-4.5 px-4.5 py-5.5 text-muted">
                {{ r.date }}
              </td>
              <td class="font-medium text-caption text-primary">{{ r.type }}</td>
              <td class="font-bold">{{ r.title }}</td>
              <td class="font-bold">{{ r.dist }}</td>
              <td>{{ r.dur }}</td>
              <td>{{ r.pace }}</td>
              <td>{{ r.hr }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Goals -->
  <section
    class="items-center gap-12 lg:gap-24 grid lg:grid-cols-2 mx-auto px-6 lg:px-20 py-16 lg:py-22 max-w-shell"
  >
    <div class="flex flex-col items-start gap-6">
      <p class="font-bold text-label text-primary">
        05 / KEEP YOUR FINISH LINE IN VIEW
      </p>
      <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
        A bigger goal.<br />Smaller milestones.
      </h2>
      <p class="max-w-narrow text-muted text-base leading-loose">
        Give your training a destination. Keep your target race, finish time,
        training pace and weekly mileage together, alongside the milestones and
        personal records that make the journey yours.
      </p>
      <div
        class="flex flex-col gap-3.5 pt-4 border-white/10 border-t w-full max-w-narrow"
      >
        <p class="font-bold text-caption text-muted">
          PERSONAL RECORDS / YOUR BENCHMARKS
        </p>
        <div
          v-for="pr in prs"
          :key="pr.d"
          class="flex justify-between items-center py-3 border-white/10 border-b text-body"
        >
          <p>{{ pr.d }}</p>
          <p class="font-bold text-lead text-primary">{{ pr.t }}</p>
        </div>
      </div>
    </div>
    <div class="flex flex-col gap-4">
      <div class="bg-card p-7 border border-white/10 rounded-2xl">
        <div class="flex justify-between items-start gap-4">
          <p class="font-bold text-caption text-primary">PRIMARY TARGET RACE</p>
          <p class="text-label text-muted whitespace-nowrap">
            54 days left · Oct 19
          </p>
        </div>
        <p class="mt-4 font-black text-[40px]">Half Marathon</p>
        <div class="bg-track mt-4 rounded h-2">
          <div class="bg-primary rounded w-1/2 h-2"></div>
        </div>
        <div class="flex justify-between mt-3 text-label text-muted">
          <p>6 of 12 weeks complete</p>
          <p class="font-bold text-primary">50%</p>
        </div>
        <div
          class="gap-5 grid grid-cols-3 mt-5 pt-4.5 border-white/10 border-t"
        >
          <div>
            <p class="font-semibold text-caption text-muted">FINISH TIME</p>
            <p class="mt-2 font-extrabold text-h3">1:45:00</p>
          </div>
          <div>
            <p class="font-semibold text-caption text-muted">TRAINING PACE</p>
            <p class="mt-2 font-extrabold text-h3">5:00 /km</p>
          </div>
          <div>
            <p class="font-semibold text-caption text-muted">WEEKLY MILEAGE</p>
            <p class="mt-2 font-extrabold text-h3">40 km</p>
          </div>
        </div>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <p class="font-bold text-label">UPCOMING RACE MILESTONES</p>
        <div
          v-for="m in milestones"
          :key="m.t"
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
              {{ m.t }}
            </p>
            <p class="text-faint text-caption">{{ m.d }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Onboarding -->
  <section class="bg-panel border-white/10 border-y">
    <div
      class="flex flex-col gap-11 mx-auto px-6 lg:px-20 py-16 max-w-shell"
    >
      <div class="flex lg:flex-row flex-col lg:items-end gap-5 lg:gap-24">
        <div class="flex flex-col gap-5">
          <p class="font-bold text-label text-primary">
            06 / CONNECT THE DOTS
          </p>
          <h2 class="font-extrabold text-4xl lg:text-5xl leading-display">
            Starts with Strava.<br />Continues with purpose.
          </h2>
        </div>
        <p class="max-w-mid text-muted text-base leading-loose">
          One sign-in method. One place to see your running in the context of
          your training and your goals.
        </p>
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
          <p class="font-bold text-xl">{{ s.t }}</p>
          <p class="text-muted text-sm leading-body">{{ s.d }}</p>
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
      <p class="font-bold text-label text-primary">BEFORE YOU HEAD OUT</p>
      <h2 class="font-extrabold text-[42px] leading-display">
        A few things<br />to know.
      </h2>
    </div>
    <div class="flex flex-col">
      <div
        v-for="q in faqs"
        :key="q.q"
        class="flex flex-col gap-3 py-6 border-white/10 border-t"
      >
        <p class="font-bold text-[17px]">{{ q.q }}</p>
        <p class="text-muted text-sm leading-body">{{ q.a }}</p>
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

const benefits = [
  {
    title: "Phases, not just distance",
    desc: "Warmup, main set and cooldown with paces for each.",
  },
  {
    title: "Adapts to yesterday",
    desc: "Hard session, skipped run or illness — tomorrow reshapes.",
  },
];
const week = [
  {
    day: "MON",
    date: "Aug 25",
    type: "Rest day",
    dist: "—",
    pace: "Recovery focus",
    extra: "Let the work settle.",
  },
  {
    day: "TUE",
    date: "Aug 26",
    type: "Recovery",
    dist: "5.0 km",
    pace: "5:50/km",
    extra: "RPE 4",
  },
  {
    day: "WED",
    date: "Aug 27",
    type: "Tempo run",
    dist: "7.0 km",
    pace: "5:15/km",
    extra: "TODAY · RPE 7",
  },
  {
    day: "THU",
    date: "Aug 28",
    type: "Rest day",
    dist: "—",
    pace: "Recovery focus",
    extra: "Time to recharge.",
  },
  {
    day: "FRI",
    date: "Aug 29",
    type: "Intervals",
    dist: "6.0 km",
    pace: "4:55/km",
    extra: "RPE 8",
  },
  {
    day: "SAT",
    date: "Aug 30",
    type: "Easy run",
    dist: "4.0 km",
    pace: "6:00/km",
    extra: "RPE 3",
  },
  {
    day: "SUN",
    date: "Aug 31",
    type: "Long run",
    dist: "12.0 km",
    pace: "5:40/km",
    extra: "RPE 5",
  },
];
week[2].today = true;
const bars = [66, 80, 92, 110, 102, 126, 141, 154];
const mix = [
  { label: "Aerobic / Easy Run", pct: 70 },
  { label: "Tempo / Threshold", pct: 20 },
  { label: "Intervals / Hard", pct: 10 },
];
const filters = [
  "All",
  "Easy",
  "Tempo",
  "Long",
  "Threshold",
  "Interval",
  "Recovery",
];
const rows = [
  {
    date: "Wed, Aug 27",
    type: "TEMPO",
    title: "Mid-Week Threshold Intervals",
    dist: "7.0 km",
    dur: "36:12",
    pace: "5:10/km",
    hr: "158 bpm",
  },
  {
    date: "Tue, Aug 26",
    type: "EASY",
    title: "Easy Recovery Spin",
    dist: "5.2 km",
    dur: "28:14",
    pace: "5:26/km",
    hr: "142 bpm",
  },
  {
    date: "Sun, Aug 24",
    type: "LONG",
    title: "Sunday Long Aerobic Block",
    dist: "16.5 km",
    dur: "1:26:12",
    pace: "5:13/km",
    hr: "146 bpm",
  },
  {
    date: "Thu, Aug 21",
    type: "INTERVAL",
    title: "8×400m VO2Max Intervals",
    dist: "6.4 km",
    dur: "32:15",
    pace: "5:02/km",
    hr: "168 bpm",
  },
];
const prs = [
  { d: "5K PR", t: "22:15" },
  { d: "10K PR", t: "46:30" },
  { d: "Half Marathon PR", t: "1:52:00" },
];
const milestones = [
  {
    t: "15km long run peak session",
    d: "Completed · Week 4 milestone achieved",
    done: true,
  },
  {
    t: "Race week tapering phase starts",
    d: "Week 10 · Oct 5 countdown",
    done: false,
  },
  {
    t: "Race Day — Half Marathon",
    d: "Week 12 · Oct 19 race target",
    done: false,
  },
];
const steps = [
  {
    n: "01 /",
    t: "Connect with Strava",
    d: "Continue to Strava to sign in and review the connection permissions.",
    icon: LinkIcon,
  },
  {
    n: "02 /",
    t: "Put your goal in focus",
    d: "Keep your race target, finish time and training milestones in view.",
    icon: FlagIcon,
  },
  {
    n: "03 /",
    t: "Meet your next session",
    d: "Open Today for your workout, then use Plan and Progress to see the bigger picture.",
    icon: RouteIcon,
  },
];
const faqs = [
  {
    q: "Do I need a Strava account?",
    a: "Yes. PacePilot uses Strava as its only sign-in method. You'll continue to Strava to sign in and review the connection permissions.",
  },
  {
    q: "What can I see in PacePilot?",
    a: "Your daily workout, weekly training plan, progress analytics, activity history and goals — connected through one running-focused workspace.",
  },
  {
    q: "Are these results from real athletes?",
    a: "The workouts, charts and records shown on this page are illustrative product examples, not performance claims or expected results.",
  },
];
</script>
