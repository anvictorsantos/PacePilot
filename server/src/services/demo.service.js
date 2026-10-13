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

// Synthetic trophies matching real Strava segment_efforts.achievements (GET /activities/{id}?include_all_efforts=true)
// Examples requested: "Para acabar 2nd fastest time 1:45", "EDMUNDO - CAMADA 3rd fastest time 1:50"
const DEMO_TROPHIES = {
  102: [{ segment: 'Para acabar', rank: 2, type: 'overall', type_id: 2, time: 105, label: '2nd fastest time' }],
  104: [{ segment: 'Lago Loop', rank: 1, type: 'pr', type_id: 3, time: 212, label: 'PR' }],
  106: [{ segment: 'EDMUNDO - CAMADA', rank: 3, type: 'overall', type_id: 2, time: 110, label: '3rd fastest time' }],
  110: [{ segment: 'Vale Sprint', rank: 2, type: 'overall', type_id: 2, time: 98, label: '2nd fastest time' }, { segment: 'Rio Climb', rank: 1, type: 'pr', type_id: 3, time: 245, label: 'PR' }],
  116: [{ segment: 'Marina Straight', rank: 1, type: 'overall', type_id: 2, time: 88, label: 'Fastest time' }],
  119: [{ segment: 'EDMUNDO - CAMADA', rank: 2, type: 'overall', type_id: 2, time: 108, label: '2nd fastest time' }],
}

export function getDemoActivities() {
  return load().activities.map(a => {
    const trophies = DEMO_TROPHIES[a.id] || []
    const pr_count = trophies.filter(t => t.type === 'pr').length
    return {
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
      achievement_count: trophies.length,
      pr_count,
      trophies,
      laps: [],
      zones: {},
    }
  })
}

export function getDemoGoal() { return load().goal }
export function getDemoAthlete() { return load().athlete }
export function getDemoZones() {
  // Synthetic 5-zone HR model (matches targetHr mapping: Z1 recovery, Z2 easy/long, Z3 tempo, Z4 threshold, Z5 interval)
  return { heart_rate: { custom_zones: true, zones: [{ min: 0, max: 134 }, { min: 135, max: 151 }, { min: 152, max: 164 }, { min: 165, max: 177 }, { min: 178, max: 190 }] } }
}
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
