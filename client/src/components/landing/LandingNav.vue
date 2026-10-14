<template>
  <header class="border-white/10 border-b">
    <div
      class="flex justify-between items-center mx-auto px-6 lg:px-20 max-w-[1440px] h-[88px]"
    >
      <a href="#top" class="flex items-center gap-2.5">
        <span
          class="flex justify-center items-center bg-primary/10 rounded-lg w-[34px] h-[34px]"
        >
          <BoltIcon cls="h-[20px] w-[18px] text-primary" />
        </span>
        <span class="font-extrabold text-[22px] tracking-tight">PacePilot</span>
      </a>
      <nav
        class="hidden md:flex items-center gap-8 text-[13px] text-muted"
        aria-label="Page"
      >
        <a
          v-for="l in links"
          :key="l.href"
          :href="l.href"
          class="hover:text-white transition"
          >{{ l.label }}</a
        >
      </nav>
      <div class="flex items-center gap-6">
        <RouterLink
          to="/login"
          class="hidden sm:block font-semibold text-[13px]"
          >Log in</RouterLink
        >
        <a
          href="/api/strava/authorize"
          class="flex items-center gap-3 bg-primary hover:brightness-110 px-[22px] py-4 rounded-lg font-bold text-sm transition"
        >
          Get started
          <ArrowUpRightIcon cls="h-[18px] w-[18px] text-white" />
        </a>
      </div>
    </div>
  </header>
</template>

<script setup>
import BoltIcon from "@/components/icons/BoltIcon.vue";
import ArrowUpRightIcon from "@/components/icons/ArrowUpRightIcon.vue";

const links = [
  { href: "#app", label: "The app" },
  { href: "#plan", label: "Training" },
  { href: "#how", label: "How it works" },
];
</script>
