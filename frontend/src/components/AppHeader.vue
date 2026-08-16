<template>
  <v-app-bar class="app-header" color="surface" elevation="0" border>
    <v-container class="d-flex align-center py-0">
      <RouterLink class="app-name" to="/">UNIPU Track</RouterLink>

      <v-spacer />

      <v-btn class="nav-button" variant="text" to="/">Početna</v-btn>
      <v-btn class="nav-button" variant="text" to="/dashboard">Dashboard</v-btn>
    </v-container>
  </v-app-bar>
</template>

<style scoped>
.app-header {
  border-color: #eee9dc;
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
  .app-name {
    font-size: 1rem;
  }

  .nav-button {
    min-width: auto;
    padding-inline: 8px;
  }
}
</style>
