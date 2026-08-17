<script setup>
import { computed, onMounted, ref } from 'vue'
import { useTheme } from 'vuetify'
import logo from '../assets/unipu-track-logo.png'
import api from '../services/api.js'

const userName = ref('Korisnik')
const theme = useTheme()
const isDark = computed(() => theme.global.name.value === 'unipuDark')

function toggleTheme() {
  const newTheme = isDark.value ? 'unipuTheme' : 'unipuDark'
  theme.change(newTheme)
  localStorage.setItem('unipu-theme', newTheme)
}

async function loadCurrentUser() {
  try {
    const response = await api.get('/api/users/1')
    userName.value = `${response.data.first_name} ${response.data.last_name}`
  } catch {
    userName.value = 'Korisnik'
  }
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
        <span class="nav-link">{{ userName }}</span>
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
  gap: clamp(32px, 5vw, 112px);
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
    gap: 16px;
  }

  .nav-link {
    font-size: 0.9rem;
  }

  .theme-toggle {
    width: 32px;
    height: 32px;
    font-size: 1.1rem;
  }
}
</style>
