import FlagIcon from '@/components/icons/FlagIcon.vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import RouteIcon from '@/components/icons/RouteIcon.vue'
import { i18n } from '@/i18n'

/** One row of the landing "plan" table. `pace`/`extra` and their `*Key` twins
 *  are optional because each day uses one or the other. */
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
}

/** One row of the landing "activity history" strip. */
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
      dist: '5.0 km',
      pace: '5:50/km',
      extra: `${i18n.global.t('ui.rpe')} 4`,
    },
    {
      dayKey: 'landing.sections.plan.days.wednesday',
      date: 'Aug 27',
      typeKey: 'landing.sections.plan.session.tempo',
      dist: '7.0 km',
      pace: '5:15/km',
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
      dist: '6.0 km',
      pace: '4:55/km',
      extra: `${i18n.global.t('ui.rpe')} 8`,
    },
    {
      dayKey: 'landing.sections.plan.days.saturday',
      date: 'Aug 30',
      typeKey: 'landing.sections.plan.session.easy',
      dist: '4.0 km',
      pace: '6:00/km',
      extra: `${i18n.global.t('ui.rpe')} 3`,
    },
    {
      dayKey: 'landing.sections.plan.days.sunday',
      date: 'Aug 31',
      typeKey: 'landing.sections.plan.session.long',
      dist: '12.0 km',
      pace: '5:40/km',
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
      date: 'Wed, Aug 27',
      type: 'TEMPO',
      titleKey: 'landing.sections.activities.run1.title',
      dist: '7.0 km',
      dur: '36:12',
      pace: '5:10/km',
      hr: '158 bpm',
    },
    {
      date: 'Tue, Aug 26',
      type: 'EASY',
      titleKey: 'landing.sections.activities.run2.title',
      dist: '5.2 km',
      dur: '28:14',
      pace: '5:26/km',
      hr: '142 bpm',
    },
    {
      date: 'Sun, Aug 24',
      type: 'LONG',
      titleKey: 'landing.sections.activities.run3.title',
      dist: '16.5 km',
      dur: '1:26:12',
      pace: '5:13/km',
      hr: '146 bpm',
    },
    {
      date: 'Thu, Aug 21',
      type: 'INTERVAL',
      titleKey: 'landing.sections.activities.run4.title',
      dist: '6.4 km',
      dur: '32:15',
      pace: '5:02/km',
      hr: '168 bpm',
    },
  ]
  const prs = [
    { dKey: 'landing.sections.goals.pr.5k', t: '22:15' },
    { dKey: 'landing.sections.goals.pr.10k', t: '46:30' },
    { dKey: 'landing.sections.goals.pr.half', t: '1:52:00' },
  ]
  const milestones = [
    {
      tKey: 'landing.sections.goals.milestone1.title',
      dKey: 'landing.sections.goals.milestone1.desc',
      done: true,
    },
    {
      tKey: 'landing.sections.goals.milestone2.title',
      dKey: 'landing.sections.goals.milestone2.desc',
      done: false,
    },
    {
      tKey: 'landing.sections.goals.milestone3.title',
      dKey: 'landing.sections.goals.milestone3.desc',
      done: false,
    },
  ]
  const steps = [
    {
      n: '01 /',
      tKey: 'landing.sections.connect.step1.title',
      dKey: 'landing.sections.connect.step1.desc',
      icon: LinkIcon,
    },
    {
      n: '02 /',
      tKey: 'landing.sections.connect.step2.title',
      dKey: 'landing.sections.connect.step2.desc',
      icon: FlagIcon,
    },
    {
      n: '03 /',
      tKey: 'landing.sections.connect.step3.title',
      dKey: 'landing.sections.connect.step3.desc',
      icon: RouteIcon,
    },
  ]
  const faqs = [
    {
      qKey: 'landing.sections.faq.question1',
      aKey: 'landing.sections.faq.answer1',
    },
    {
      qKey: 'landing.sections.faq.question2',
      aKey: 'landing.sections.faq.answer2',
    },
    {
      qKey: 'landing.sections.faq.question3',
      aKey: 'landing.sections.faq.answer3',
    },
  ]

  return {
    week,
    bars,
    mix,
    filters,
    rows,
    prs,
    milestones,
    steps,
    faqs,
  }
}
