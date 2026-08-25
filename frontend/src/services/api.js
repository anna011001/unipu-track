import axios from 'axios'
import { authToken, clearAuthSession } from './auth.js'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = authToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url === '/api/auth/login'

    if (error.response?.status === 401 && !isLoginRequest) {
      clearAuthSession()

      if (window.location.pathname !== '/prijava') {
        const redirect = `${window.location.pathname}${window.location.search}`
        window.location.assign(`/prijava?redirect=${encodeURIComponent(redirect)}`)
      }
    }

    return Promise.reject(error)
  },
)

export default api
