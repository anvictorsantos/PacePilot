<template>
  <div class="max-w-2xl">
    <h1 class="font-bold text-white text-2xl">Settings</h1>
    <div class="space-y-4 mt-6">
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">Profile</div>
        <div class="mt-1 text-muted text-sm">Your connected Strava athlete</div>
        <div class="mt-2 text-muted text-xs">Timezone: Europe/Lisbon</div>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">Data</div>
        <p class="mt-1 text-muted text-sm">
          Training data (profile, activities, feedback) is used only to build
          your coaching plan. Strava tokens never leave the server.
        </p>
        <p class="mt-2 text-muted text-sm">
          Your rights under the RGPD / GDPR (Regulamento (UE) 2016/679): access,
          correct or erase your data anytime. Disconnect stops all collection.
        </p>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">About PacePilot</div>
        <p class="mt-1 text-muted text-sm">
          Adaptive running coach — Strava supplies the evidence, the training
          engine decides, the coach explains.
        </p>
      </div>
      <div v-if="currentUser" class="bg-card p-6 border border-danger/30 rounded-2xl">
        <div class="font-semibold text-white text-sm">Delete my account</div>
        <p class="mt-1 text-muted text-sm">
          Permanently erases your athlete profile, all activities and all
          feedback. Cannot be undone.
        </p>
        <button
          v-if="!confirming"
          @click="confirming = true"
          class="bg-transparent hover:bg-danger/10 mt-4 px-4 py-2 border border-danger/50 rounded-xl font-semibold text-danger text-sm transition"
        >
          Delete my account
        </button>
        <div v-else class="flex flex-wrap items-center gap-3 mt-4">
          <button
            @click="erase"
            :disabled="erasing"
            class="bg-danger disabled:opacity-50 hover:brightness-110 px-4 py-2 rounded-xl font-semibold text-white text-sm transition"
          >
            {{ erasing ? "Erasing…" : "Yes, erase everything" }}
          </button>
          <button
            @click="confirming = false"
            :disabled="erasing"
            class="bg-white/10 hover:bg-white/15 px-4 py-2 rounded-xl text-white text-sm transition"
          >
            Keep my data
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
import api from "@/services/api.js";
import { useToast } from "@/composables/useToast.js";
import { useCurrentUser } from "@/composables/useCurrentUser.js";

const router = useRouter();
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
    showToast("Account erased", { type: "success" });
    router.replace("/strava");
  } catch (e) {
    error.value = e.response?.data?.error || "Erase failed — try again";
  } finally {
    erasing.value = false;
  }
}
</script>
