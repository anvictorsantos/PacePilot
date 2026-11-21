import { i18n } from '@/i18n'

/** One row of the "plan" table; a day carries either a literal `pace`/`extra` or its `*Key` twin. */
interface LandingDay {
  dayKey: string
  date: string
  typeKey: string
  dist: string
  paceKey?: string
  pace?: string
  extraKey?: string
  extra?: string
  today?: boolean
  completed?: boolean
}

interface LandingRow {
  date: string
  type: string
  titleKey: string
  dist: string
  dur: string
  pace: string
  hr: string
}

export function useLandingSections() {
  const week: LandingDay[] = [
    {
      dayKey: 'landing.sections.plan.days.monday',
      date: 'Aug 25',
      typeKey: 'landing.sections.plan.session.rest',
      dist: '—',
      paceKey: 'landing.sections.plan.restNote',
      extraKey: 'landing.sections.plan.restSub.first',
    },
    {
      dayKey: 'landing.sections.plan.days.tuesday',
      date: 'Aug 26',
      typeKey: 'landing.sections.plan.session.recovery',
      dist: '4.0 km',
      pace: '6:30–6:50/km',
      extra: `${i18n.global.t('ui.rpe')} 4`,
      completed: true,
    },
    {
      dayKey: 'landing.sections.plan.days.wednesday',
      date: 'Aug 27',
      typeKey: 'landing.sections.plan.session.tempo',
      dist: '7.0 km',
      pace: '5:25–5:40/km',
      extraKey: 'landing.sections.plan.todayTag',
    },
    {
      dayKey: 'landing.sections.plan.days.thursday',
      date: 'Aug 28',
      typeKey: 'landing.sections.plan.session.rest',
      dist: '—',
      paceKey: 'landing.sections.plan.restNote',
      extraKey: 'landing.sections.plan.restSub.second',
    },
    {
      dayKey: 'landing.sections.plan.days.friday',
      date: 'Aug 29',
      typeKey: 'landing.sections.plan.session.intervals',
      dist: '7.0 km',
      pace: '5:00–5:20/km',
      extra: `${i18n.global.t('ui.rpe')} 8`,
    },
    {
      dayKey: 'landing.sections.plan.days.saturday',
      date: 'Aug 30',
      typeKey: 'landing.sections.plan.session.easy',
      dist: '6.0 km',
      pace: '5:55–6:15/km',
      extra: `${i18n.global.t('ui.rpe')} 3`,
    },
    {
      dayKey: 'landing.sections.plan.days.sunday',
      date: 'Aug 31',
      typeKey: 'landing.sections.plan.session.long',
      dist: '12.0 km',
      pace: '5:55–6:15/km',
      extra: `${i18n.global.t('ui.rpe')} 5`,
    },
  ]
  const wednesday = week[2]
  if (wednesday) wednesday.today = true
  const bars = [66, 80, 92, 110, 102, 126, 141, 154]
  const mix = [
    { label: 'landing.sections.progress.mix.aerobic', pct: 70 },
    { label: 'landing.sections.progress.mix.tempo', pct: 20 },
    { label: 'landing.sections.progress.mix.intervals', pct: 10 },
  ]
  const filters = [
    'landing.sections.activities.filter.all',
    'landing.sections.activities.filter.easy',
    'landing.sections.activities.filter.tempo',
    'landing.sections.activities.filter.long',
    'landing.sections.activities.filter.threshold',
    'landing.sections.activities.filter.interval',
    'landing.sections.activities.filter.recovery',
  ]
  const rows: LandingRow[] = [
    {
      date: '24 Nov',
      type: 'Tempo',
      titleKey: 'landing.sections.activities.run1.title',
      dist: '7.0 km',
      dur: '38:35',
      pace: '5:31 /km',
      hr: '172 bpm',
    },
    {
      date: '23 Nov',
      type: 'Easy',
      titleKey: 'landing.sections.activities.run2.title',
      dist: '18.0 km',
      dur: '1:47:24',
      pace: '5:58 /km',
      hr: '149 bpm',
    },
    {
      date: '22 Nov',
      type: 'Long',
      titleKey: 'landing.sections.activities.run3.title',
      dist: '6.0 km',
      dur: '36:12',
      pace: '6:02 /km',
      hr: '138 bpm',
    },
    {
      date: '20 Nov',
      type: 'Interval',
      titleKey: 'landing.sections.activities.run4.title',
      dist: '10.0 km',
      dur: '52:00',
      pace: '5:12 /km',
      hr: '166 bpm',
    },
  ]

  return {
    week,
    bars,
    mix,
    filters,
    rows,
  }
}
