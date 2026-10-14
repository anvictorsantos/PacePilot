<template>
  <!-- notifications — centered modal with overlay -->
  <div>
    <button
      type="button"
      class="relative flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label="Notifications"
      :aria-expanded="open ? 'true' : 'false'"
      @click="onBellClick"
    >
      <BellIcon cls="w-5 h-5" />
      <span
        v-if="newCount > 0"
        class="absolute right-1.5 top-1.5 flex h-2 w-2"
      >
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"
        ></span>
        <span
          class="relative inline-flex h-2 w-2 rounded-full bg-primary ring-2 ring-background"
        ></span>
      </span>
    </button>

    <Teleport to="body">
      <Transition name="notif-fade">
        <div
          v-if="open"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
          @click.self="close"
        >
          <Transition name="notif-pop" appear>
            <div
              v-if="open"
              class="max-h-[85vh] w-full max-w-mid overflow-auto rounded-card border border-border bg-card text-ink"
            >
              <div class="flex items-start justify-between px-5 pt-4">
                <div>
                  <p class="font-bold text-body text-white">Activity</p>
                  <p class="mt-0.5 text-caption text-muted">
                    {{ newCount > 0 ? `${newCount} unread notification${newCount === 1 ? '' : 's'}` : "You're all caught up" }}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    v-if="newCount > 0"
                    type="button"
                    @click="bellSeen = true"
                    class="min-h-touch font-medium text-caption text-primaryBright transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Mark all as read
                  </button>
                  <button
                    type="button"
                    @click="close"
                    aria-label="Close notifications"
                    class="flex h-11 min-h-touch w-11 items-center justify-center rounded-full bg-cardSecondary text-white transition hover:bg-track focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <XMarkIcon cls="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                v-if="bellLoading"
                class="px-5 py-8 text-center text-body text-muted"
              >
                Loading…
              </div>
              <div v-else-if="!bellItems.length" class="px-5 py-8 text-center">
                <p class="font-medium text-body text-white">No new activities</p>
                <p class="mt-1 text-caption text-muted">
                  You're up to date since last sync.
                </p>
              </div>
              <ul v-else class="max-h-80 divide-y divide-border overflow-auto px-2 pb-2">
                <p class="px-3 pb-1 pt-3 font-medium text-caption uppercase tracking-wide text-faint">Today</p>
                <li
                  v-for="a in bellItems"
                  :key="a.id || a.strava_activity_id"
                  class="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-white/5"
                >
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-label text-white"
                    :class="avatarClass(a)"
                  >
                    {{ (a.workout_type || a.type || "R").slice(0, 1).toUpperCase() }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-2">
                      <p class="min-w-0 flex-1 truncate font-bold text-body text-white">
                        {{ activityTitle(a) }}
                      </p>
                      <span class="shrink-0 text-caption text-muted">{{ formatShortDate(a.date || a.start_date) }}</span>
                      <span v-if="!bellSeen" class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
                    </div>
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      <span class="rounded-md bg-track px-2 py-0.5 font-medium text-caption text-primaryBright">{{ paceFor(a) }}</span>
                      <span class="rounded-md bg-track px-2 py-0.5 text-caption text-muted">{{ timeFor(a) || displayDistance(a) }}</span>
                    </div>
                    <p class="mt-1.5 truncate text-caption text-muted">
                      {{ displayDistance(a) }} · {{ formatDate(a.date || a.start_date) }}
                    </p>
                  </div>
                </li>
              </ul>

              <div class="border-t border-border p-2">
                <RouterLink
                  to="/activities"
                  class="flex min-h-touch items-center justify-center rounded-lg bg-cardSecondary py-2 text-center font-medium text-body text-white transition hover:bg-track focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  @click="close()"
                  >View all activities</RouterLink
                >
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import api from "@/services/api.js";
import BellIcon from "@/components/icons/BellIcon.vue";
import XMarkIcon from "@/components/icons/XMarkIcon.vue";

// Moved verbatim from AppHeader (Pass 9: extract, no visual change).
// Same API calls: GET /activities perPage 10 on mount + 30s poll.
const props = defineProps({ lastSyncedAt: String });

const bellItems = ref([]);
const bellLoading = ref(false);
let bellFetched = false;
const bellSeen = ref(false);
const open = ref(false);

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
function activityTitle(a) {
  const t = (a.workout_type || a.type || "Run").toLowerCase();
  const label = t.charAt(0).toUpperCase() + t.slice(1);
  const km =
    a.distance_km ?? (a.distance != null ? (a.distance / 1000).toFixed(1) : null);
  return km != null ? `${label} · ${km} km` : label;
}
const AVATAR_COLORS = {
  tempo: "bg-orange-500",
  threshold: "bg-orange-500",
  interval: "bg-orange-500",
  easy: "bg-green-500",
  recovery: "bg-green-500",
  long: "bg-blue-500",
  race: "bg-purple-500",
};
function avatarClass(a) {
  const t = (a.workout_type || a.type || "").toLowerCase();
  return AVATAR_COLORS[t] || "bg-gray-500";
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

function close() {
  open.value = false;
}

function onKey(e) {
  if (e.key === "Escape") close();
}

async function onBellClick() {
  if (!bellFetched) await fetchBell();
  open.value = true;
  if (bellItems.value.length) bellSeen.value = true;
}

watch(open, (v) => {
  document.body.style.overflow = v ? "hidden" : "";
  if (v) window.addEventListener("keydown", onKey);
  else window.removeEventListener("keydown", onKey);
});

let poll = null;
onMounted(async () => {
  // prefetch quietly so badge is accurate on load (dot shows before click)
  await fetchBell();
  // poll so a newly synced activity shows the dot without needing to click Refresh
  poll = setInterval(() => fetchBell(true), 30000);
});
onUnmounted(() => {
  if (poll) clearInterval(poll);
  document.body.style.overflow = "";
  window.removeEventListener("keydown", onKey);
});
</script>

<style scoped>
.notif-fade-enter-active,
.notif-fade-leave-active {
  transition: opacity 0.2s ease;
}
.notif-fade-enter-from,
.notif-fade-leave-to {
  opacity: 0;
}
.notif-pop-enter-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.notif-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.notif-pop-enter-from,
.notif-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .notif-fade-enter-active,
  .notif-fade-leave-active,
  .notif-pop-enter-active,
  .notif-pop-leave-active {
    transition: none;
  }
  .notif-pop-enter-from,
  .notif-pop-leave-to {
    transform: none;
  }
}
</style>
