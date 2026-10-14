<template>
  <header class="border-white/10 border-b">
    <div
      class="flex justify-between items-center mx-auto px-6 lg:px-20 max-w-shell h-[88px]"
    >
      <RouterLink to="/" class="flex items-center gap-2.5">
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
      <div class="flex items-center gap-3 sm:gap-6">
        <LanguageSwitcher />
        <RouterLink
          to="/login"
          class="flex items-center gap-3 bg-primary hover:brightness-110 px-5.5 py-4 rounded-lg font-bold text-sm transition"
          >{{ $t("nav.login")
          }}<ArrowUpRightIcon cls="h-[18px] w-[18px] text-white"
        /></RouterLink>
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
  { href: "#plan", key: "nav.training" },
  { href: "#how", key: "nav.how" },
];
</script>
