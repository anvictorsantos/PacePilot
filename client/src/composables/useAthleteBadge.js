import { ref } from 'vue'
import api from '../services/api.js'

let cache = null
let promise = null

const badge = ref(null)

export function useAthleteBadge() {
  async function fetchBadge() {
    if (cache) { badge.value = cache; return cache }
    if (promise) { const d = await promise; badge.value = d; return d }
    promise = api.get('/strava/athlete').then(({ data }) => {
      cache = data
      badge.value = data
      return data
    }).catch(() => {
      cache = { badge_type_id: 0, badges: [] }
      badge.value = cache
      return cache
    })
    return promise
  }
  return { badge, fetchBadge }
}
