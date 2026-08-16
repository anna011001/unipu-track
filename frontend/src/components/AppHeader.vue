<script setup>
import logo from '../assets/unipu-track-logo.png'
</script>

<template>
  <v-app-bar color="surface" elevation="0">
    <div class="header-content d-flex align-center w-100 px-4 px-md-6">
      <RouterLink class="app-logo-link" to="/" aria-label="UNIPU Track - početna">
        <img class="app-logo" :src="logo" alt="UNIPU Track" />
        <span class="app-name">UNIPU Track</span>
      </RouterLink>

      <v-spacer />

      <v-btn class="nav-button" variant="text" to="/">Početna</v-btn>
      <v-btn class="nav-button" variant="text" to="/dashboard">Dashboard</v-btn>
    </div>
  </v-app-bar>
</template>

<style scoped>
.app-logo-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.app-logo {
  display: block;
  width: auto;
  height: 48px;
}

.app-name {
  color: #9f7b00;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.nav-button {
  color: #4b4637;
  text-transform: none;
}

@media (max-width: 480px) {
  .app-logo {
    height: 42px;
  }

  .app-name {
    font-size: 1rem;
  }

  .nav-button {
    min-width: auto;
    padding-inline: 8px;
  }
}
</style>
