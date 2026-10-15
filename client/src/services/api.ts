import axios, { type AxiosError } from 'axios'

import { captureException } from '@/services/logger.ts'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

function isReportable(error: AxiosError): boolean {
  if (!error.response) return true // network/connectivity/timeout
  if (error.code === 'ECONNABORTED') return true
  return error.response.status >= 500
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as AxiosError
    if (isReportable(axiosError)) {
      const method = axiosError.config?.method?.toUpperCase() || 'UNKNOWN'
      const url = axiosError.config?.url || 'unknown'
      captureException(axiosError, {
        feature: 'http-client',
        operation: `${method} ${url}`,
        status: axiosError.response?.status ?? null,
        code: axiosError.code ?? null,
      })
    }
    // don't throw raw errors to UI; let callers handle
    return Promise.reject(error)
  },
)

export default api
