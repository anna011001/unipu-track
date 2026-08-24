<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import api from '../services/api.js'
import { saveAuthSession } from '../services/auth.js'
import logo from '../assets/unipu-track-logo.png'

const route = useRoute()
const router = useRouter()
const theme = useTheme()
const form = reactive({ email: '', password: '' })
const registrationForm = reactive({ first_name: '', last_name: '', email: '', password: '', password_confirmation: '' })
const mode = ref('login')
const showPassword = ref(false)
const showRegistrationPassword = ref(false)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const isDark = computed(() => theme.global.name.value === 'unipuDark')

function toggleTheme() {
  const newTheme = isDark.value ? 'unipuTheme' : 'unipuDark'
  theme.change(newTheme)
  localStorage.setItem('unipu-theme', newTheme)
}

function destination() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  return redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
}

async function login() {
  error.value = ''
  success.value = ''

  if (!form.email.trim() || !form.password) {
    error.value = 'Unesite e-mail i lozinku.'
    return
  }

  submitting.value = true

  try {
    const response = await api.post('/api/auth/login', {
      email: form.email.trim(),
      password: form.password,
    })
    saveAuthSession(response.data.jwt_token, response.data.user)
    await router.replace(destination())
  } catch (exception) {
    error.value = exception.response?.data?.message || 'Prijava trenutačno nije moguća.'
  } finally {
    submitting.value = false
  }
}

function changeMode(nextMode) {
  mode.value = nextMode
  error.value = ''
  success.value = ''
}

async function register() {
  error.value = ''
  success.value = ''

  if (!registrationForm.first_name.trim() || !registrationForm.last_name.trim() || !registrationForm.email.trim() || !registrationForm.password || !registrationForm.password_confirmation) {
    error.value = 'Popunite sva polja.'
    return
  }
  if (!registrationForm.email.trim().toLowerCase().endsWith('@unipu.hr')) {
    error.value = 'Registracija je moguća samo službenom @unipu.hr adresom.'
    return
  }
  if (registrationForm.password.length < 8) {
    error.value = 'Lozinka mora imati najmanje 8 znakova.'
    return
  }
  if (registrationForm.password !== registrationForm.password_confirmation) {
    error.value = 'Lozinke se ne podudaraju.'
    return
  }

  submitting.value = true

  try {
    const response = await api.post('/api/auth/register', {
      first_name: registrationForm.first_name.trim(),
      last_name: registrationForm.last_name.trim(),
      email: registrationForm.email.trim(),
      password: registrationForm.password,
      password_confirmation: registrationForm.password_confirmation,
    })
    success.value = response.data.message
    registrationForm.password = ''
    registrationForm.password_confirmation = ''
  } catch (exception) {
    const details = exception.response?.data?.errors
    error.value = Array.isArray(details) ? details.join(' ') : exception.response?.data?.message || 'Registracija trenutačno nije moguća.'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem('unipu-theme')
  if (savedTheme === 'unipuTheme' || savedTheme === 'unipuDark') theme.change(savedTheme)
})
</script>

<template>
  <main class="login-view">
    <header class="login-header">
      <img :src="logo" alt="UNIPU Track" class="login-logo">
      <button
        class="theme-toggle"
        type="button"
        :aria-label="isDark ? 'Uključi svijetli način' : 'Uključi tamni način'"
        @click="toggleTheme"
      >
        <span aria-hidden="true">{{ isDark ? '☀' : '☾' }}</span>
      </button>
    </header>

    <section class="login-content">
      <div class="intro">
        <p class="eyebrow">Sveučilište Jurja Dobrile u Puli</p>
        <h1>Dobro došli u<br><span>UNIPU Track</span></h1>
        <p>Centralno mjesto za evidenciju aktivnosti, praćenje pokazatelja i izradu fakultetskih izvješća.</p>
      </div>

      <form v-if="mode === 'login'" class="login-card" @submit.prevent="login">
        <div>
          <p class="eyebrow">Pristup aplikaciji</p>
          <h2>Prijava</h2>
          <p class="description">Unesite podatke svojeg korisničkog računa.</p>
        </div>

        <label>
          <span>E-mail</span>
          <input v-model="form.email" type="email" autocomplete="username" placeholder="ime.prezime@unipu.hr" :disabled="submitting">
        </label>

        <label>
          <span>Lozinka</span>
          <span class="password-field">
            <input v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Unesite lozinku" :disabled="submitting">
            <button type="button" :aria-label="showPassword ? 'Sakrij lozinku' : 'Prikaži lozinku'" @click="showPassword = !showPassword">
              {{ showPassword ? 'Sakrij' : 'Prikaži' }}
            </button>
          </span>
        </label>

        <p v-if="error" class="login-error" role="alert">{{ error }}</p>

        <button class="submit-button" type="submit" :disabled="submitting">
          {{ submitting ? 'Prijava...' : 'Prijavi se' }}
        </button>

        <p class="switch-copy">Nemate korisnički račun?</p>
        <button class="secondary-button" type="button" @click="changeMode('register')">Registrirajte se</button>
      </form>

      <form v-else class="login-card registration-card" @submit.prevent="register">
        <div>
          <p class="eyebrow">Novi korisnički račun</p>
          <h2>Registracija</h2>
          <p class="description">Upotrijebite službenu e-mail adresu Sveučilišta.</p>
        </div>

        <div class="name-fields">
          <label>
            <span>Ime</span>
            <input v-model="registrationForm.first_name" autocomplete="given-name" :disabled="submitting">
          </label>
          <label>
            <span>Prezime</span>
            <input v-model="registrationForm.last_name" autocomplete="family-name" :disabled="submitting">
          </label>
        </div>

        <label>
          <span>Službeni e-mail</span>
          <input v-model="registrationForm.email" type="email" autocomplete="email" placeholder="ime.prezime@unipu.hr" :disabled="submitting">
        </label>

        <label>
          <span>Lozinka</span>
          <span class="password-field">
            <input v-model="registrationForm.password" :type="showRegistrationPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Najmanje 8 znakova" :disabled="submitting">
            <button type="button" @click="showRegistrationPassword = !showRegistrationPassword">{{ showRegistrationPassword ? 'Sakrij' : 'Prikaži' }}</button>
          </span>
        </label>

        <label>
          <span>Ponovite lozinku</span>
          <input v-model="registrationForm.password_confirmation" type="password" autocomplete="new-password" :disabled="submitting">
        </label>

        <p v-if="error" class="login-error" role="alert">{{ error }}</p>
        <p v-if="success" class="login-success" role="status">{{ success }}</p>

        <button class="submit-button" type="submit" :disabled="submitting || Boolean(success)">
          {{ submitting ? 'Slanje...' : success ? 'Zahtjev je poslan' : 'Pošalji zahtjev' }}
        </button>
        <button class="secondary-button" type="button" @click="changeMode('login')">Natrag na prijavu</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-view{min-height:100vh;padding:24px clamp(24px,4vw,72px) 48px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.login-header{display:flex;align-items:center;justify-content:space-between}.login-logo{width:auto;height:88px}.theme-toggle{display:grid;width:36px;height:36px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-primary));border-radius:50%;background:transparent;color:rgb(var(--v-theme-primary));cursor:pointer;font:inherit;font-size:1.2rem}.theme-toggle:hover{background:rgba(var(--v-theme-primary),.12)}.login-content{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,500px);gap:clamp(64px,10vw,180px);align-items:center;width:min(1180px,100%);min-height:calc(100vh - 180px);margin:auto}.intro{max-width:620px}.eyebrow{margin:0;color:rgb(var(--v-theme-primary));font-size:.85rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase}.intro h1{margin:18px 0 24px;color:rgb(var(--v-theme-on-background));font-size:clamp(2.7rem,5vw,5.8rem);font-weight:400;line-height:1.02}.intro h1 span{color:rgb(var(--v-theme-primary))}.intro>p:last-child{max-width:540px;margin:0;color:rgb(var(--v-theme-muted));font-size:clamp(1rem,1.25vw,1.25rem);line-height:1.7}.login-card{display:grid;gap:24px;padding:clamp(30px,4vw,52px);border:1px solid rgb(var(--v-theme-category-border));border-radius:18px;background:rgb(var(--v-theme-surface));box-shadow:0 24px 70px rgba(0,0,0,.1)}.registration-card{gap:18px;padding-top:34px;padding-bottom:34px}.login-card h2{margin:8px 0 5px;font-size:clamp(2rem,3vw,2.8rem);font-weight:500}.description{margin:0;color:rgb(var(--v-theme-muted))}.login-card label{display:grid;gap:9px;font-weight:700}.name-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.login-card input{width:100%;height:52px;padding:0 15px;border:1px solid rgb(var(--v-theme-category-border));border-radius:9px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background));font:inherit;box-sizing:border-box;outline:none}.login-card input:focus{border-color:rgb(var(--v-theme-primary));box-shadow:0 0 0 3px rgba(var(--v-theme-primary),.14)}.password-field{position:relative;display:block}.password-field input{padding-right:82px}.password-field button{position:absolute;top:50%;right:12px;padding:6px;border:0;background:transparent;color:rgb(var(--v-theme-primary));cursor:pointer;font:inherit;font-size:.82rem;font-weight:700;transform:translateY(-50%)}.login-error,.login-success{margin:-8px 0 0;font-size:.92rem;line-height:1.45}.login-error{color:rgb(var(--v-theme-error))}.login-success{color:rgb(var(--v-theme-on-background))}.submit-button,.secondary-button{height:52px;border:1px solid rgb(var(--v-theme-primary));border-radius:9px;cursor:pointer;font:inherit;font-weight:800}.submit-button{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.secondary-button{background:transparent;color:rgb(var(--v-theme-primary))}.submit-button:hover:not(:disabled){filter:brightness(.92)}.secondary-button:hover{background:rgba(var(--v-theme-primary),.1)}.submit-button:disabled{cursor:wait;opacity:.65}.switch-copy{margin:0 0 -14px;color:rgb(var(--v-theme-muted));text-align:center;font-size:.9rem}@media(max-width:820px){.login-content{grid-template-columns:1fr;gap:42px;padding-top:45px}.intro{text-align:center;margin:auto}.login-card{width:min(500px,100%);margin:auto;box-sizing:border-box}}@media(max-width:520px){.login-view{padding:18px 18px 36px}.login-logo{height:68px}.login-content{min-height:auto;padding-top:52px}.intro h1{font-size:2.6rem}.login-card{padding:26px 22px}.name-fields{grid-template-columns:1fr}}
</style>
