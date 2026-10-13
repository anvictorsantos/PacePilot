import { defineStore } from 'pinia'
import api from '../services/api.js'

export const useGoalsStore = defineStore('goals', {
  state: () => ({ goal: null, loading: false }),
  actions: {
    async fetch() {
      const { data } = await api.get('/goals')
      this.goal = data
    },
    async save(payload) {
      const { data } = await api.put('/goals', payload)
      this.goal = data
      return data
    },
  },
})
