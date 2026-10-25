<template>
  <div
    ref="root"
    class="relative"
  >
    <button
      :id="id"
      ref="trigger"
      type="button"
      :aria-expanded="open"
      aria-haspopup="dialog"
      class="cursor-pointer flex w-full items-center justify-between rounded-xl bg-cardSecondary border border-white/10 px-3 py-2.5 text-left text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
      :class="modelValue ? 'text-white' : 'text-muted'"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span>{{ displayValue }}</span>
      <CalendarIcon cls="w-5 h-5 text-muted shrink-0 ml-2" />
    </button>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
      @after-enter="onAfterEnter"
      @before-leave="onBeforeLeave"
    >
      <div
        v-show="open"
        ref="panel"
        class="absolute z-10 mt-1 w-[19rem] rounded-2xl bg-cardSecondary border border-white/10 shadow-xl p-4"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="id"
      >
        <div class="flex items-center justify-between">
          <button
            type="button"
            class="cursor-pointer p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-white transition"
            :aria-label="$t('ui.previous_month')"
            @click="prevMonth"
            @keydown="onNavKeydown"
          >
            <ChevronLeftIcon cls="w-5 h-5" />
          </button>
          <div
            class="text-white text-sm font-semibold"
            aria-live="polite"
          >
            {{ monthLabel }}
          </div>
          <button
            type="button"
            class="cursor-pointer p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-white transition"
            :aria-label="$t('ui.next_month')"
            @click="nextMonth"
            @keydown="onNavKeydown"
          >
            <ChevronRightIcon cls="w-5 h-5" />
          </button>
        </div>

        <div
          class="mt-4 grid grid-cols-7 text-center text-label tracking-widest text-muted"
          role="rowheader"
        >
          <div
            v-for="w in weekdays"
            :key="w"
            class="py-1"
            role="columnheader"
          >
            {{ w }}
          </div>
        </div>

        <div
          class="mt-1 grid grid-cols-7 gap-y-1"
          role="grid"
          :aria-label="$t('ui.calendar')"
        >
          <button
            v-for="d in days"
            :key="d.key"
            ref="dayButtons"
            type="button"
            class="cursor-pointer mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition disabled:cursor-not-allowed"
            :class="dayClass(d)"
            :aria-label="formatAriaLabel(d)"
            :aria-selected="d.isSelected"
            :aria-current="d.isToday ? 'date' : undefined"
            :disabled="!d.isCurrentMonth"
            @click="pick(d)"
            @keydown="onDayKeydown(d, $event)"
            @focus="focusedDayIndex = dayIndex(d)"
          >
            {{ d.day }}
          </button>
        </div>

        <div class="mt-3 flex justify-between">
          <button
            type="button"
            class="cursor-pointer text-xs font-medium text-primary hover:text-primaryBright"
            @click="goToday"
          >
            {{ $t('ui.today') }}
          </button>
          <button
            type="button"
            class="cursor-pointer text-xs font-medium text-muted hover:text-white"
            @click="close"
          >
            {{ $t('ui.close') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

import CalendarIcon from '@/components/icons/CalendarIcon.vue'
import ChevronLeftIcon from '@/components/icons/ChevronLeftIcon.vue'
import ChevronRightIcon from '@/components/icons/ChevronRightIcon.vue'

interface CalendarDay {
  key: string
  day: number
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
}

const { locale, t } = useI18n()

const props = defineProps({
  modelValue: { type: String, default: '' },
  id: { type: String, default: undefined },
  placeholder: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const dayButtons = ref<HTMLButtonElement[]>([])
const open = ref(false)
const focusedDayIndex = ref(-1)

function parseISO(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const today = new Date()
today.setHours(0, 0, 0, 0)

const cursor = ref(parseISO(props.modelValue) || new Date(today))

watch(
  () => props.modelValue,
  (v) => {
    const d = parseISO(v)
    if (d) cursor.value = new Date(d)
  },
)

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const monthLabel = computed(() =>
  cursor.value.toLocaleDateString(locale.value, { month: 'long', year: 'numeric' }),
)

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder || t('ui.select_date')
  const d = parseISO(props.modelValue)
  if (!d) return props.placeholder || t('ui.select_date')
  return d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
})

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const selectedDate = computed(() => parseISO(props.modelValue))

const days = computed<CalendarDay[]>(() => {
  const y = cursor.value.getFullYear()
  const m = cursor.value.getMonth()
  const first = new Date(y, m, 1)
  let startDow = (first.getDay() + 6) % 7
  const dim = new Date(y, m + 1, 0).getDate()
  const prevDim = new Date(y, m, 0).getDate()
  const total = 42
  const out: CalendarDay[] = []
  for (let i = 0; i < total; i++) {
    let day, date, isCurrentMonth
    if (i < startDow) {
      day = prevDim - startDow + 1 + i
      date = new Date(y, m - 1, day)
      isCurrentMonth = false
    } else if (i < startDow + dim) {
      day = i - startDow + 1
      date = new Date(y, m, day)
      isCurrentMonth = true
    } else {
      day = i - startDow - dim + 1
      date = new Date(y, m + 1, day)
      isCurrentMonth = false
    }
    out.push({
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      day,
      date,
      isCurrentMonth,
      isToday: isSameDay(date, today),
      isSelected: selectedDate.value ? isSameDay(date, selectedDate.value) : false,
    })
  }
  return out
})

function dayClass(d: CalendarDay) {
  if (d.isSelected) return 'bg-primary text-white font-semibold'
  if (d.isToday) return 'bg-primary/15 text-primary font-semibold ring-1 ring-primary/30'
  if (!d.isCurrentMonth) return 'text-white/25 hover:bg-white/5 hover:text-white/60'
  return 'text-white hover:bg-white/5'
}

function dayIndex(d: Pick<CalendarDay, 'key'>) {
  return days.value.findIndex((day) => day.key === d.key)
}

function formatAriaLabel(d: CalendarDay) {
  const dateStr = d.date.toLocaleDateString(locale.value, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  let label = dateStr
  if (d.isSelected) label += ', selected'
  if (d.isToday) label += ', today'
  if (!d.isCurrentMonth) label += ', outside current month'
  return label
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
  nextTick(() => trigger.value?.focus())
}

function pick(d: CalendarDay) {
  if (!d.isCurrentMonth) {
    cursor.value = new Date(d.date.getFullYear(), d.date.getMonth(), 1)
  }
  emit('update:modelValue', toISO(d.date))
  close()
}

function prevMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1)
}

function nextMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
}

function goToday() {
  cursor.value = new Date(today)
  emit('update:modelValue', toISO(today))
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    open.value = true
  } else if (e.key === 'Escape') {
    close()
  } else if (e.key === 'Tab') {
    open.value = false
  }
}

function onAfterEnter() {
  const selectedIdx = dayIndex({
    key: selectedDate.value
      ? `${selectedDate.value.getFullYear()}-${selectedDate.value.getMonth()}-${selectedDate.value.getDate()}`
      : '',
  })
  focusedDayIndex.value = selectedIdx >= 0 ? selectedIdx : days.value.findIndex((d) => d.isToday)
  if (focusedDayIndex.value < 0) focusedDayIndex.value = 0
  nextTick(() => {
    dayButtons.value[focusedDayIndex.value]?.focus?.()
  })
}

function onBeforeLeave() {
  // focus restored in close()
}

function onNavKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'Tab') {
    // allow tab navigation
  }
}

function onDayKeydown(d: CalendarDay, e: KeyboardEvent) {
  const idx = dayIndex(d)
  const total = days.value.length
  const cols = 7

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    const nextIdx = Math.min(idx + 1, total - 1)
    focusedDayIndex.value = nextIdx
    dayButtons.value[nextIdx]?.focus?.()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    const nextIdx = Math.max(idx - 1, 0)
    focusedDayIndex.value = nextIdx
    dayButtons.value[nextIdx]?.focus?.()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIdx = Math.min(idx + cols, total - 1)
    focusedDayIndex.value = nextIdx
    dayButtons.value[nextIdx]?.focus?.()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const nextIdx = Math.max(idx - cols, 0)
    focusedDayIndex.value = nextIdx
    dayButtons.value[nextIdx]?.focus?.()
  } else if (e.key === 'Home') {
    e.preventDefault()
    const rowStart = idx - (idx % cols)
    focusedDayIndex.value = rowStart
    dayButtons.value[rowStart]?.focus?.()
  } else if (e.key === 'End') {
    e.preventDefault()
    const rowEnd = Math.min(idx + cols - 1, total - 1)
    focusedDayIndex.value = rowEnd
    dayButtons.value[rowEnd]?.focus?.()
  } else if (e.key === 'PageDown') {
    e.preventDefault()
    nextMonth()
    nextTick(() => {
      focusedDayIndex.value = 0
      dayButtons.value[0]?.focus?.()
    })
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    prevMonth()
    nextTick(() => {
      focusedDayIndex.value = 0
      dayButtons.value[0]?.focus?.()
    })
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (d.isCurrentMonth) pick(d)
  } else if (e.key === 'Escape') {
    close()
  } else if (e.key === 'Tab') {
    close()
  }
}

function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node | null)) open.value = false
}
onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>
