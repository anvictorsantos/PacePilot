<template>
  <!-- Tailwind Plus — Calendars / Small calendar — https://tailwindcss.com/plus/ui-blocks/application-ui/data-display/calendars -->
  <!-- Dark-adapted: bg-cardSecondary, border-white/10, primary #F97316 for selected/today -->
  <div ref="root" class="relative">
    <!-- trigger: mirrors AppSelect button styling -->
    <button
      type="button"
      :id="id"
      :aria-expanded="open"
      @click="open = !open"
      class="flex w-full items-center justify-between rounded-xl bg-cardSecondary border border-white/10 px-3 py-2.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
      :class="modelValue ? 'text-white' : 'text-muted'"
    >
      <span>{{ displayValue }}</span>
      <CalendarIcon cls="w-5 h-5 text-muted shrink-0 ml-2" />
    </button>

    <!-- popover calendar -->
    <div
      v-show="open"
      class="absolute z-10 mt-1 w-[19rem] rounded-2xl bg-cardSecondary border border-white/10 shadow-xl p-4"
    >
      <!-- header: month / year + nav -->
      <div class="flex items-center justify-between">
        <button type="button" @click="prevMonth" class="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-white transition" aria-label="Previous month">
          <ChevronLeftIcon cls="w-5 h-5" />
        </button>
        <div class="text-white text-sm font-semibold">{{ monthLabel }}</div>
        <button type="button" @click="nextMonth" class="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-white transition" aria-label="Next month">
          <ChevronRightIcon cls="w-5 h-5" />
        </button>
      </div>

      <!-- weekdays -->
      <div class="mt-4 grid grid-cols-7 text-center text-[11px] tracking-widest text-muted">
        <div v-for="w in weekdays" :key="w" class="py-1">{{ w }}</div>
      </div>

      <!-- days grid -->
      <div class="mt-1 grid grid-cols-7 gap-y-1">
        <button
          v-for="d in days"
          :key="d.key"
          type="button"
          @click="pick(d)"
          class="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition"
          :class="dayClass(d)"
        >{{ d.day }}</button>
      </div>

      <!-- footer -->
      <div class="mt-3 flex justify-between">
        <button type="button" @click="goToday" class="text-xs font-medium text-primary hover:text-primaryBright">Today</button>
        <button type="button" @click="open = false" class="text-xs font-medium text-muted hover:text-white">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import ChevronLeftIcon from '../icons/ChevronLeftIcon.vue'
import ChevronRightIcon from '../icons/ChevronRightIcon.vue'
import CalendarIcon from '../icons/CalendarIcon.vue'

const props = defineProps({
  modelValue: { type: String, default: '' }, // YYYY-MM-DD
  id: { type: String, default: undefined },
  placeholder: { type: String, default: 'Select date' },
})

const emit = defineEmits(['update:modelValue'])

const root = ref(null)
const open = ref(false)

// display month is derived from modelValue or today
function parseISO(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const today = new Date()
today.setHours(0, 0, 0, 0)

const cursor = ref(parseISO(props.modelValue) || new Date(today))

watch(() => props.modelValue, (v) => {
  const d = parseISO(v)
  if (d) cursor.value = new Date(d)
})

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const monthLabel = computed(() =>
  cursor.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder
  const d = parseISO(props.modelValue)
  if (!d) return props.placeholder
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const selectedDate = computed(() => parseISO(props.modelValue))

// Tailwind Plus small calendar: 6 rows × 7, includes leading/trailing days
const days = computed(() => {
  const y = cursor.value.getFullYear()
  const m = cursor.value.getMonth()
  const first = new Date(y, m, 1)
  // Monday-start: 0=Mon ... 6=Sun
  let startDow = (first.getDay() + 6) % 7
  const dim = new Date(y, m + 1, 0).getDate()
  const prevDim = new Date(y, m, 0).getDate()
  const total = 42
  const out = []
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

function dayClass(d) {
  if (d.isSelected) return 'bg-primary text-white font-semibold'
  if (d.isToday) return 'bg-primary/15 text-primary font-semibold ring-1 ring-primary/30'
  if (!d.isCurrentMonth) return 'text-white/25 hover:bg-white/5 hover:text-white/60'
  return 'text-white hover:bg-white/5'
}

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function pick(d) {
  // if picking a trailing/leading day, move cursor to that month
  cursor.value = new Date(d.date.getFullYear(), d.date.getMonth(), 1)
  emit('update:modelValue', toISO(d.date))
  open.value = false
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

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>
