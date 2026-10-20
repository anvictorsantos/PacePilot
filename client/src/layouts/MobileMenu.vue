<template>
  <button
    type="button"
    class="group md:hidden flex justify-center items-center hover:bg-white/5 rounded-full w-11 h-11 min-h-touch text-white transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
    :aria-label="$t('shell.openMenu')"
    aria-haspopup="dialog"
    :aria-expanded="open ? 'true' : 'false'"
    @click="open = true"
  >
    <Bars3Icon
      cls="w-6 h-6 transition-transform duration-200 ease-out group-hover:rotate-90 group-active:scale-90"
      :class="open ? 'rotate-90' : 'rotate-0'"
    />
  </button>

  <Teleport to="body">
    <Transition name="mobile-menu-fade">
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions, vuejs-accessibility/click-events-have-key-events -- overlay closes on click; Escape is owned by useDialog while open -->
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/70"
        @click.self="close"
      >
        <Transition
          name="mobile-menu-slide"
          appear
        >
          <div
            v-if="open"
            ref="panel"
            v-bind="dialogAttrs"
            class="ml-auto flex flex-col bg-background border-white/10 border-l w-72 max-w-[85vw] h-full"
          >
            <div class="flex justify-end items-center px-6 border-white/10 border-b h-16 shrink-0">
              <h2
                id="mobile-menu-title"
                class="sr-only"
              >
                {{ $t('shell.menu') }}
              </h2>
              <button
                ref="closeButton"
                type="button"
                :aria-label="$t('shell.closeMenu')"
                class="group flex justify-center items-center hover:bg-white/5 rounded-full w-11 h-11 min-h-touch text-muted hover:text-white transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                @click="close"
              >
                <XMarkIcon
                  cls="mobile-menu-close-icon w-5 h-5 transition-transform duration-200 ease-out group-hover:rotate-90 group-active:scale-90"
                />
              </button>
            </div>

            <nav class="flex-1 px-4 py-4 overflow-y-auto">
              <ul class="space-y-1">
                <li
                  v-for="item in navItems"
                  :key="item.to"
                >
                  <RouterLink
                    :to="item.to"
                    :aria-current="$route.path === item.to ? 'page' : undefined"
                    class="group flex items-center gap-3 p-3 rounded-card text-body font-semibold transition"
                    :class="
                      $route.path === item.to
                        ? 'bg-track text-white'
                        : 'text-muted hover:bg-white/5 hover:text-white'
                    "
                    @click="close"
                  >
                    <component
                      :is="item.icon"
                      cls="w-5 h-5 shrink-0"
                      :class="
                        $route.path === item.to
                          ? 'text-primary'
                          : 'text-muted group-hover:text-white'
                      "
                    />
                    {{ $t(item.key) }}
                  </RouterLink>
                </li>
              </ul>

              <RouterLink
                to="/settings"
                :aria-current="$route.path === '/settings' ? 'page' : undefined"
                class="group mt-1 flex items-center gap-2.5 p-3 rounded-card font-bold text-body leading-4 transition"
                :class="
                  $route.path === '/settings'
                    ? 'bg-track text-white'
                    : 'text-muted hover:bg-white/5 hover:text-white'
                "
                @click="close"
              >
                <Cog6ToothIcon
                  cls="h-4.5 w-4.5 shrink-0"
                  :class="
                    $route.path === '/settings'
                      ? 'text-primary'
                      : 'text-muted group-hover:text-white'
                  "
                />
                {{ $t('shell.settings') }}
              </RouterLink>

              <div
                class="my-4 border-white/10 border-t"
                role="separator"
              ></div>
            </nav>

            <div class="px-6 py-5 flex items-center gap-3">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <AthleteAvatar />
                <div class="min-w-0">
                  <div class="font-semibold text-white text-sm truncate">
                    {{ fullName }}
                  </div>
                  <div class="text-muted text-xs truncate">
                    {{ currentUser?.email || $t('shell.athlete') }}
                  </div>
                </div>
              </div>
              <button
                type="button"
                :aria-label="$t('shell.logout')"
                :title="$t('shell.logout')"
                :disabled="loggingOut"
                class="flex justify-center items-center hover:bg-white/5 disabled:opacity-50 rounded-lg min-w-touch min-h-touch text-muted hover:text-white shrink-0 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                @click="logout"
              >
                <LogoutIcon cls="w-4 h-4" />
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import Bars3Icon from '@/components/icons/Bars3Icon.vue'
import CalendarDaysIcon from '@/components/icons/CalendarDaysIcon.vue'
import ChartBarIcon from '@/components/icons/ChartBarIcon.vue'
import Cog6ToothIcon from '@/components/icons/Cog6ToothIcon.vue'
import LogoutIcon from '@/components/icons/LogoutIcon.vue'
import PlayCircleIcon from '@/components/icons/PlayCircleIcon.vue'
import QueueListIcon from '@/components/icons/QueueListIcon.vue'
import TrophyIcon from '@/components/icons/TrophyIcon.vue'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'
import AthleteAvatar from '@/components/ui/AthleteAvatar.vue'
import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useLogout } from '@/modules/account/infrastructure/composable/useLogout.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'
import { useDialog } from '@/modules/shared/ui/useDialog.ts'

const navItems = [
  { to: '/workout', key: 'shell.today', icon: PlayCircleIcon },
  { to: '/plan', key: 'shell.plan', icon: CalendarDaysIcon },
  { to: '/progress', key: 'shell.progress', icon: ChartBarIcon },
  { to: '/activities', key: 'shell.runs', icon: QueueListIcon },
  { to: '/goals', key: 'shell.goals', icon: TrophyIcon },
]

const open = ref(false)
const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLElement | null>(null)
const { user: currentUser, fetchUser } = useCurrentUser()
const { fullName } = useUserIdentity()
const { loggingOut, logout } = useLogout()

const { attrs: dialogAttrs } = useDialog(panel, {
  active: open,
  labelledby: 'mobile-menu-title',
  onEscape: close,
  initialFocus: closeButton,
})

function close() {
  open.value = false
}

onMounted(() => {
  fetchUser()
})
</script>

<style scoped>
.mobile-menu-fade-enter-active,
.mobile-menu-fade-leave-active {
  transition: opacity 0.2s ease;
}
.mobile-menu-fade-enter-from,
.mobile-menu-fade-leave-to {
  opacity: 0;
}
.mobile-menu-slide-enter-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.mobile-menu-slide-leave-active {
  transition: transform 0.15s ease;
}
.mobile-menu-slide-enter-from,
.mobile-menu-slide-leave-to {
  transform: translateX(100%);
}
.mobile-menu-close-icon {
  animation: mobile-menu-icon-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes mobile-menu-icon-in {
  from {
    opacity: 0;
    transform: rotate(-90deg) scale(0.75);
  }
  to {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mobile-menu-fade-enter-active,
  .mobile-menu-fade-leave-active,
  .mobile-menu-slide-enter-active,
  .mobile-menu-slide-leave-active {
    transition: none;
  }
  .mobile-menu-slide-enter-from,
  .mobile-menu-slide-leave-to {
    transform: none;
  }
  .mobile-menu-close-icon {
    animation: none;
  }
}
</style>
