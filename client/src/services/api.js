import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.response.use(
  r => r,
  err => {
    // don't throw raw errors to UI; let callers handle
    return Promise.reject(err)
  }
)

export default api
