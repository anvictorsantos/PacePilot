import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
let demo = null

function load() {
  if (demo) return demo
  const raw = readFileSync(join(__dirname, '../../seeds/demoData.json'), 'utf-8')
  demo = JSON.parse(raw)
  return demo
}

export function getDemoActivities() {
  return load().activities.map(a => ({
    ...a,
    distance_m: a.distance_km * 1000,
    moving_time_s: Math.round(a.moving_time_min * 60),
    elapsed_time_s: Math.round(a.moving_time_min * 60 * 1.05),
    elapsed_time_min: +(a.moving_time_min * 1.05).toFixed(1),
    avg_pace_sec_km: a.avg_pace_sec_km,
    avg_speed: 1000 / a.avg_pace_sec_km,
    max_speed: 1000 / (a.avg_pace_sec_km - 30),
    elevation_m: a.elevation_m,
    has_hr: a.has_hr,
    streams_available: ['time', 'distance', 'velocity_smooth', 'heartrate', 'cadence'],
    laps: [],
    zones: {},
  }))
}

export function getDemoGoal() { return load().goal }
export function getDemoAthlete() { return load().athlete }
export function getDemoStreams(id) {
  // synthetic streams for demo activity detail
  const n = 100
  const time = Array.from({ length: n }, (_, i) => i * 20)
  const distance = time.map(t => t * 3.2)
  const velocity = time.map((_, i) => 3.0 + Math.sin(i / 10) * 0.4 + (Math.random() - 0.5) * 0.2)
  const heartrate = time.map((_, i) => 145 + Math.sin(i / 15) * 10 + (Math.random() - 0.5) * 6)
  const altitude = time.map((_, i) => 50 + Math.sin(i / 20) * 15 + i * 0.02)
  return { time, distance, velocity_smooth: velocity, heartrate, altitude, cadence: time.map(() => 170 + Math.round(Math.random() * 6 - 3)) }
}
