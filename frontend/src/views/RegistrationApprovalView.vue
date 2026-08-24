<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import api from '../services/api.js'
import logo from '../assets/unipu-track-logo.png'

const route = useRoute()
const state = ref('loading')
const message = ref('Provjera poveznice...')
const token = computed(() => typeof route.query.token === 'string' ? route.query.token : '')

async function approve() {
  if (!token.value) {
    state.value = 'error'
    message.value = 'Poveznica za odobrenje nije ispravna.'
    return
  }

  state.value = 'loading'
  message.value = 'Odobravanje korisničkog računa...'

  try {
    const response = await api.post('/api/auth/approve-registration', { token: token.value })
    state.value = 'success'
    message.value = response.data.message
  } catch (error) {
    state.value = 'error'
    message.value = error.response?.data?.message || 'Korisnički račun trenutačno nije moguće odobriti.'
  }
}

onMounted(approve)
</script>

<template>
  <main class="approval-view">
    <section class="approval-card">
      <img :src="logo" alt="UNIPU Track" class="approval-logo">
      <p class="eyebrow">UNIPU Track</p>
      <h1>Odobrenje registracije</h1>
      <div class="status-icon" :class="state" aria-hidden="true">
        {{ state === 'success' ? '✓' : state === 'error' ? '!' : '…' }}
      </div>
      <p :class="['message', state]" role="status">{{ message }}</p>
      <RouterLink class="login-link" to="/prijava">Idi na prijavu</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.approval-view{display:grid;min-height:100vh;padding:24px;place-items:center;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.approval-card{width:min(520px,100%);padding:44px;border:1px solid rgb(var(--v-theme-category-border));border-radius:18px;background:rgb(var(--v-theme-surface));text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.1)}.approval-logo{height:78px;width:auto}.eyebrow{margin:22px 0 8px;color:rgb(var(--v-theme-primary));font-size:.82rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.approval-card h1{margin:0 0 28px;font-size:2rem;font-weight:500}.status-icon{display:grid;width:52px;height:52px;margin:0 auto 18px;place-items:center;border:1px solid rgb(var(--v-theme-primary));border-radius:50%;color:rgb(var(--v-theme-primary));font-size:1.5rem;font-weight:800}.status-icon.error{border-color:rgb(var(--v-theme-error));color:rgb(var(--v-theme-error))}.message{min-height:48px;margin:0 0 26px;color:rgb(var(--v-theme-muted));line-height:1.55}.message.success{color:rgb(var(--v-theme-on-background))}.message.error{color:rgb(var(--v-theme-error))}.login-link{display:inline-flex;min-height:46px;padding:0 26px;align-items:center;justify-content:center;border:1px solid rgb(var(--v-theme-primary));border-radius:9px;color:rgb(var(--v-theme-primary));font-weight:800;text-decoration:none}.login-link:hover{background:rgba(var(--v-theme-primary),.1)}
</style>
