import { defineStore } from 'pinia'
import api from '@/services/api.js'

export const usePlanStore = defineStore('plan', {
  state: () => ({ today: null, week: null, goal: null, loading: false }),
  actions: {
    async fetchToday() {
      this.loading = true
      try { const { data } = await api.get('/plan/today'); this.today = data } finally { this.loading = false }
    },
    async fetchWeek() {
      const { data } = await api.get('/plan/week')
      this.week = data.week; this.goal = data.goal
    },
  },
})
