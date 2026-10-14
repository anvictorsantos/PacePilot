<template>
  <header class="border-white/10 border-b">
    <div
      class="flex items-center gap-8 mx-auto px-6 lg:px-20 max-w-shell h-[88px]"
    >
      <RouterLink to="/" class="flex items-center gap-2.5 shrink-0">
        <BrandLogo />
      </RouterLink>
      <nav
        class="hidden md:flex items-center gap-8 text-body text-muted"
        :aria-label="$t('nav.app')"
      >
        <a
          v-for="l in links"
          :key="l.href"
          :href="l.href"
          class="hover:text-white transition"
          >{{ $t(l.key) }}</a
        >
      </nav>
      <div class="flex items-center gap-3 sm:gap-6 ml-auto">
        <LanguageSwitcher />
      </div>
    </div>
  </header>
</template>

<script setup>
import BrandLogo from "@/components/ui/BrandLogo.vue";
import ArrowUpRightIcon from "@/components/icons/ArrowUpRightIcon.vue";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher.vue";

const links = [
  { href: "#app", key: "nav.app" },
  { href: "#how", key: "nav.how" },
  { href: "#plan", key: "nav.training" },
  { href: "#progress", key: "nav.progress" },
  { href: "#activities", key: "nav.activities" },
  { href: "#goals", key: "nav.goals" },
  { href: "#connect", key: "nav.connect" },
  { href: "#faq", key: "nav.faq" },
];
</script>
