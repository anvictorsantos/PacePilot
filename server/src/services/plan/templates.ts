/**
 * Workout templates — static shape of each workout type.
 * Extracted from the Plan module (services/plan.service.ts).
 */
export const WORKOUT_TEMPLATES = {
  recovery: { type: 'recovery', distance_km: 4, duration_min: 25, intensity: 'very easy', purpose: 'Active recovery and circulation' },
  easy: { type: 'easy', distance_km: 6, duration_min: 35, intensity: 'easy', purpose: 'Aerobic development without unnecessary fatigue' },
  long: { type: 'long', distance_km: 12, duration_min: 75, intensity: 'easy', purpose: 'Endurance and long-run progression' },
  steady: { type: 'steady', distance_km: 8, duration_min: 45, intensity: 'moderate', purpose: 'Sustained aerobic running' },
  tempo: { type: 'tempo', distance_km: 7, duration_min: 40, intensity: 'tempo', purpose: 'Lactate threshold development' },
  threshold: { type: 'threshold', distance_km: 8, duration_min: 45, intensity: 'threshold', purpose: 'Threshold and race-pace efficiency' },
  interval: { type: 'interval', distance_km: 7, duration_min: 45, intensity: 'hard', purpose: ' VO2max and speed development' },
}

export function structureFor(type) {
  const map = {
    recovery: { warmup: '5 min very easy jog', main: '15–20 min very easy', cooldown: '5 min walk/jog' },
    easy: { warmup: '10 min very easy', main: '30–35 min easy, conversational', cooldown: '5 min relaxed cooldown' },
    long: { warmup: '10 min easy', main: '50–60 min easy, controlled', cooldown: '5–10 min easy cooldown' },
    steady: { warmup: '10 min easy', main: '30 min steady (comfortably hard)', cooldown: '5 min easy' },
    tempo: { warmup: '12 min easy + 4×20s strides', main: '20 min tempo (controlled, not maximal)', cooldown: '10 min easy' },
    threshold: { warmup: '12 min easy + drills', main: '3×6 min threshold w/ 2 min jog recoveries', cooldown: '10 min easy' },
    interval: { warmup: '12 min easy + 4×100m strides', main: '5×800m at 5K effort w/ 2 min jog', cooldown: '10 min easy' },
  }
  return map[type] || map.easy
}
