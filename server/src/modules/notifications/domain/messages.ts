import type { EmailLocale } from '@/modules/auth/domain/email-sender.ts'

const WORKOUT_LABELS: Record<EmailLocale, Record<string, string>> = {
  en: {
    easy: 'Easy run',
    recovery: 'Recovery run',
    long: 'Long run',
    steady: 'Steady run',
    tempo: 'Tempo run',
    threshold: 'Threshold session',
    interval: 'Intervals',
    intervals: 'Intervals',
    race: 'Race',
  },
  pt: {
    easy: 'Corrida fácil',
    recovery: 'Corrida de recuperação',
    long: 'Corrida longa',
    steady: 'Corrida estável',
    tempo: 'Corrida de tempo',
    threshold: 'Sessão de limiar',
    interval: 'Intervalos',
    intervals: 'Intervalos',
    race: 'Prova',
  },
}

export function workoutLabel(locale: EmailLocale, type: string | null | undefined): string {
  const key = String(type ?? '').toLowerCase()
  return WORKOUT_LABELS[locale][key] ?? (locale === 'pt' ? 'Treino' : 'Session')
}

export function reminderMessage(locale: EmailLocale, type: string): { title: string; body: string } {
  const label = workoutLabel(locale, type)
  return locale === 'pt'
    ? { title: 'Sessão de hoje', body: `${label} está no plano para hoje.` }
    : { title: "Today's session", body: `${label} is on the plan today.` }
}

export interface WeeklySummaryInput {
  runs: number
  distanceKm: number
  avgPace: string | null
}

export function weeklySummaryEmail(locale: EmailLocale, input: WeeklySummaryInput) {
  const distance = input.distanceKm.toFixed(1)
  if (locale === 'pt') {
    const pace = input.avgPace ? ` · ritmo médio ${input.avgPace}` : ''
    return {
      subject: 'A tua semana de treino',
      text: `${input.runs} corridas · ${distance} km${pace}`,
      html: `<p>${input.runs} corridas · <strong>${distance} km</strong>${pace}</p>`,
    }
  }
  const pace = input.avgPace ? ` · average pace ${input.avgPace}` : ''
  return {
    subject: 'Your training week',
    text: `${input.runs} runs · ${distance} km${pace}`,
    html: `<p>${input.runs} runs · <strong>${distance} km</strong>${pace}</p>`,
  }
}

/** `300` → `5:00`. */
export function paceString(secondsPerKm: number | null | undefined): string | null {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return null
  const total = Math.round(secondsPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
