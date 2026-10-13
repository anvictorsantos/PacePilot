import { defineStore } from 'pinia'
import api from '@/services/api.js'

export const useActivitiesStore = defineStore('activities', {
  state: () => ({ items: [], total: 0, page: 1, perPage: 20, loading: false, detail: null }),
  actions: {
    async fetch(params = {}) {
      this.loading = true
      try {
        const { data } = await api.get('/activities', { params })
        this.items = data.items; this.total = data.total; this.page = data.page
      } finally { this.loading = false }
    },
    async fetchOne(id) {
      const { data } = await api.get(`/activities/${id}`)
      this.detail = data
      return data
    },
  },
})
