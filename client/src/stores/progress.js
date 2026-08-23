import { defineStore } from 'pinia'
import api from '@/services/api.js'

export const useProgressStore = defineStore('progress', {
  state: () => ({ data: null, loading: false }),
  actions: {
    async fetch() {
      this.loading = true
      try { const { data } = await api.get('/progress'); this.data = data } finally { this.loading = false }
    },
  },
})
