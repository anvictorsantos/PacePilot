<template>
  <!-- notifications — last activities after last sync (Tailwind Plus dropdown list) -->
  <AppDropdown panel-class="right-0 w-80 sm:w-96">
    <template #trigger>
      <button
        type="button"
        class="relative flex items-center justify-center hover:bg-white/5 min-h-touch min-w-[44px] rounded-full text-muted hover:text-white transition"
        aria-label="Notifications"
        @click="onBellClick"
      >
        <BellIcon cls="w-5 h-5" />
        <span
          v-if="newCount > 0"
          class="top-1.5 right-1.5 absolute flex w-2 h-2"
        >
          <span
            class="inline-flex absolute bg-primary opacity-75 rounded-full w-full h-full animate-ping"
          ></span>
          <span
            class="inline-flex relative bg-primary rounded-full ring-2 ring-background w-2 h-2"
          ></span>
        </span>
      </button>
    </template>

    <template #default="{ close }">
      <div class="px-4 py-3 border-white/10 border-b">
        <div class="font-semibold text-white text-sm">
          New after last sync
        </div>
        <div class="mt-0.5 text-muted text-xs">
          <template v-if="lastSyncedAt"
            >Since {{ formatDate(lastSyncedAt) }}</template
          >
          <template v-else>Recent activities</template>
        </div>
      </div>

      <div
        v-if="bellLoading"
        class="px-4 py-8 text-muted text-sm text-center"
      >
        Loading…
      </div>
      <div v-else-if="!bellItems.length" class="px-4 py-8 text-center">
        <div class="text-white text-sm">No new activities</div>
        <div class="mt-1 text-muted text-xs">
          You're up to date since last sync.
        </div>
      </div>
      <ul v-else class="divide-y divide-white/5 max-h-80 overflow-auto">
        <li
          v-for="a in bellItems"
          :key="a.id || a.strava_activity_id"
          class="flex gap-3 hover:bg-white/5 px-4 py-3 transition"
        >
          <div
            class="flex justify-center items-center bg-primary/15 border border-primary/20 rounded-xl w-9 h-9 shrink-0"
          >
            <span class="font-bold text-primary text-xs">{{
              (a.workout_type || a.type || "run").slice(0, 3).toUpperCase()
            }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-baseline gap-2">
              <span class="font-medium text-white text-sm">{{
                displayDistance(a)
              }}</span>
              <span class="text-muted text-xs">{{
                a.workout_type || a.type
              }}</span>
              <span class="text-muted text-xs"
                >· {{ formatShortDate(a.date || a.start_date) }}</span
              >
            </div>
            <div class="mt-0.5 text-muted text-xs truncate">
              {{ paceFor(a) }} · {{ timeFor(a) }}
            </div>
          </div>
        </li>
      </ul>

      <div class="p-2 border-white/10 border-t">
        <RouterLink
          to="/activities"
          class="block bg-white/5 hover:bg-white/10 py-2 rounded-lg font-medium text-white text-sm text-center transition"
          @click="close()"
          >View all activities</RouterLink
        >
      </div>
    </template>
  </AppDropdown>
</template>
<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";
import api from "@/services/api.js";
import AppDropdown from "@/components/ui/AppDropdown.vue";
import BellIcon from "@/components/icons/BellIcon.vue";

// Moved verbatim from AppHeader (Pass 9: extract, no visual change).
// Same API calls: GET /activities perPage 10 on mount + 30s poll.
const props = defineProps({ lastSyncedAt: String });

const bellItems = ref([]);
const bellLoading = ref(false);
let bellFetched = false;
const bellSeen = ref(false);

const newCount = computed(() => (bellSeen.value ? 0 : bellItems.value.length));

function formatDate(s) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return String(s);
  }
}
function formatShortDate(s) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return String(s);
  }
}
function displayDistance(a) {
  const km =
    a.distance_km ??
    (a.distance != null ? (a.distance / 1000).toFixed(2) : null);
  return km != null ? `${km} km` : "—";
}
function paceFor(a) {
  const sec = a.avg_pace_sec_km;
  if (sec)
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} /km`;
  if (a.average_speed) return `${(1000 / a.average_speed / 60).toFixed(1)} /km`;
  return "—";
}
function timeFor(a) {
  if (a.moving_time_min) return `${a.moving_time_min} min`;
  if (a.moving_time) return `${Math.round(a.moving_time / 60)} min`;
  return "";
}

async function fetchBell(force = false) {
  if (bellFetched && !force) return;
  bellLoading.value = true;
  try {
    const { data } = await api.get("/activities", { params: { perPage: 10 } });
    const items = data.items || data || [];
    const cutoff = props.lastSyncedAt
      ? new Date(props.lastSyncedAt).getTime()
      : null;
    const next = cutoff
      ? items.filter((a) => new Date(a.date || a.start_date).getTime() > cutoff)
      : items.slice(0, 6);
    // if new items arrived after dismissal, re-show the dot
    if (next.length && bellSeen.value && next.length !== bellItems.value.length)
      bellSeen.value = false;
    else if (!bellSeen.value && next.length === 0) {
      /* keep hidden if nothing new */
    }
    bellItems.value = next;
    bellFetched = true;
  } catch {
    bellItems.value = [];
  } finally {
    bellLoading.value = false;
  }
}

async function onBellClick() {
  if (!bellFetched) await fetchBell();
  if (bellItems.value.length) bellSeen.value = true;
}

let poll = null;
onMounted(async () => {
  // prefetch quietly so badge is accurate on load (dot shows before click)
  await fetchBell();
  // poll so a newly synced activity shows the dot without needing to click Refresh
  poll = setInterval(() => fetchBell(true), 30000);
});
onUnmounted(() => {
  if (poll) clearInterval(poll);
});
</script>
