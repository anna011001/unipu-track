<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import logo from '../assets/unipu-track-logo.png'
import api from '../services/api.js'
import { clearAuthSession, currentUser, updateCurrentUser } from '../services/auth.js'

const router = useRouter()
const theme = useTheme()
const isDark = computed(() => theme.global.name.value === 'unipuDark')
const userName = computed(() => currentUser.value ? `${currentUser.value.first_name} ${currentUser.value.last_name}` : 'Korisnik')

function toggleTheme() {
  const newTheme = isDark.value ? 'unipuTheme' : 'unipuDark'
  theme.change(newTheme)
  localStorage.setItem('unipu-theme', newTheme)
}

async function loadCurrentUser() {
  try {
    const response = await api.get('/api/auth/me')
    updateCurrentUser(response.data)
  } catch {}
}

async function logout() {
  clearAuthSession()
  await router.replace({ name: 'login' })
}

onMounted(() => {
  const savedTheme = localStorage.getItem('unipu-theme')

  if (savedTheme === 'unipuTheme' || savedTheme === 'unipuDark') {
    theme.change(savedTheme)
  }

  loadCurrentUser()
})
</script>

<template>
  <v-app-bar color="surface" elevation="0" height="112">
    <div class="header-content">
      <RouterLink class="app-logo-link" to="/" aria-label="UNIPU Track - početna">
        <img class="app-logo" :src="logo" alt="UNIPU Track" />
      </RouterLink>

      <nav class="header-navigation" aria-label="Glavna navigacija">
        <RouterLink class="nav-link" to="/">Početna</RouterLink>
        <RouterLink class="nav-link" to="/glavni-obrazac">Glavni obrazac</RouterLink>
        <span class="nav-link">{{ userName }}</span>
        <button class="logout-button" type="button" @click="logout">Odjava</button>
        <button
          class="theme-toggle"
          type="button"
          :aria-label="isDark ? 'Uključi svijetli način' : 'Uključi tamni način'"
          :title="isDark ? 'Svijetli način' : 'Tamni način'"
          @click="toggleTheme"
        >
          <span aria-hidden="true">{{ isDark ? '☀' : '☾' }}</span>
        </button>
      </nav>
    </div>
  </v-app-bar>
</template>

<style scoped>
.header-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px clamp(28px, 3vw, 72px);
}

.app-logo-link {
  display: inline-flex;
  align-items: center;
}

.app-logo {
  display: block;
  width: auto;
  height: 82px;
}

.header-navigation {
  display: flex;
  align-items: center;
  gap: clamp(22px, 3.5vw, 72px);
}

.nav-link {
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font-size: clamp(1rem, 1.25vw, 2rem);
  font-weight: 700;
  transition: color 160ms ease;
}

.nav-link:hover {
  color: rgb(var(--v-theme-primary));
}

.logout-button {
  padding: 7px 12px;
  border: 1px solid rgba(var(--v-theme-primary), 0.75);
  border-radius: 7px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
}

.logout-button:hover {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.theme-toggle {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(var(--v-theme-primary), 0.75);
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  font: inherit;
  font-size: 1.2rem;
  line-height: 1;
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  background: rgba(var(--v-theme-primary), 0.12);
}

.theme-toggle:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
}

@media (max-width: 600px) {
  .header-content {
    padding-inline: 16px;
  }

  .app-logo {
    height: 64px;
  }

  .header-navigation {
    gap: 12px;
  }

  .nav-link {
    font-size: 0.78rem;
  }

  .logout-button {
    padding: 5px 7px;
    font-size: 0.72rem;
  }

  .theme-toggle {
    width: 32px;
    height: 32px;
    font-size: 1.1rem;
  }
}
</style>
