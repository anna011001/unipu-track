import { computed, ref } from 'vue'

const tokenKey = 'unipu-auth-token'
const userKey = 'unipu-auth-user'
const storedToken = ref(localStorage.getItem(tokenKey))

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem(userKey) || 'null')
  } catch {
    return null
  }
}

export const currentUser = ref(storedUser())
export const isAuthenticated = computed(() => Boolean(storedToken.value))

export function authToken() {
  return storedToken.value
}

export function saveAuthSession(token, user) {
  localStorage.setItem(tokenKey, token)
  localStorage.setItem(userKey, JSON.stringify(user))
  storedToken.value = token
  currentUser.value = user
}

export function updateCurrentUser(user) {
  localStorage.setItem(userKey, JSON.stringify(user))
  currentUser.value = user
}

export function clearAuthSession() {
  localStorage.removeItem(tokenKey)
  localStorage.removeItem(userKey)
  storedToken.value = null
  currentUser.value = null
}
