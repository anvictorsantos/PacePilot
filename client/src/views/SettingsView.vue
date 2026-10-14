<template>
  <div class="max-w-2xl">
    <div class="flex items-center justify-between gap-4">
      <h1 class="font-bold text-white text-2xl">{{ $t('settings.title') }}</h1>
      <LanguageSwitcher />
    </div>
    <div class="space-y-4 mt-6">
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.profile') }}</div>
        <div class="mt-1 text-muted text-sm">{{ $t('settings.profileD') }}</div>
        <div class="mt-2 text-muted text-xs">{{ $t('settings.timezone') }}: Europe/Lisbon</div>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.data') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.dataD') }}</p>
        <p class="mt-2 text-muted text-sm">{{ $t('settings.rgpd') }}</p>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.aboutT') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.aboutD') }}</p>
      </div>
      <div v-if="currentUser" class="bg-card p-6 border border-danger/30 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.del') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.delD') }}</p>
        <button
          v-if="!confirming"
          @click="confirming = true"
          class="bg-transparent hover:bg-danger/10 mt-4 px-4 py-2 min-h-touch border border-danger/50 rounded-xl font-semibold text-danger text-sm transition"
        >
          {{ $t('settings.delBtn') }}
        </button>
        <div v-else class="flex flex-wrap items-center gap-3 mt-4">
          <button
            @click="erase"
            :disabled="erasing"
            class="bg-danger disabled:opacity-50 hover:brightness-110 px-4 py-2 min-h-touch rounded-xl font-semibold text-white text-sm transition"
          >
            {{ erasing ? $t('settings.erasing') : $t('settings.confirm') }}
          </button>
          <button
            @click="confirming = false"
            :disabled="erasing"
            class="bg-white/10 hover:bg-white/15 px-4 py-2 min-h-touch rounded-xl text-white text-sm transition"
          >
            {{ $t('settings.keep') }}
          </button>
        </div>
        <p v-if="error" class="mt-3 text-danger text-sm">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import api from "@/services/api.js";
import { useToast } from "@/composables/useToast.js";
import { useCurrentUser } from "@/composables/useCurrentUser.js";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher.vue";

const router = useRouter();
const { t } = useI18n();
const { show: showToast } = useToast();
const { user: currentUser, fetchUser, clearUser } = useCurrentUser();
const confirming = ref(false);
const erasing = ref(false);
const error = ref("");

onMounted(() => {
  fetchUser();
});

async function erase() {
  erasing.value = true;
  error.value = "";
  try {
    await api.delete("/me");
    clearUser();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("feedback:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
    showToast(t("settings.erased"), { type: "success" });
    router.replace("/strava");
  } catch (e) {
    error.value = e.response?.data?.error || t("settings.eraseFail");
  } finally {
    erasing.value = false;
  }
}
</script>
