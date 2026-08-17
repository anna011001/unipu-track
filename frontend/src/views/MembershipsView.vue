<template>
  <main class="memberships-view">
    <nav class="breadcrumbs" aria-label="Putanja stranice">
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink>
      <span aria-hidden="true">›</span>
      <span>Članstva</span>
    </nav>

    <h1>Članstva</h1>
    <p>Evidencija članstva u znanstvenim, stručnim i umjetničkim organizacijama</p>
  </main>
</template>

<style scoped>
.memberships-view {
  min-height: calc(100vh - 112px);
  padding: 34px clamp(32px, 5vw, 128px) 80px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgb(var(--v-theme-muted));
  font-size: clamp(1rem, 1.1vw, 1.45rem);
}

.breadcrumbs a {
  transition: color 160ms ease;
}

.breadcrumbs a:hover {
  color: rgb(var(--v-theme-primary));
}

.memberships-view h1 {
  margin: 28px 0 12px;
  font-size: clamp(2rem, 2.1vw, 3.5rem);
  font-weight: 400;
  line-height: 1.2;
}

.memberships-view p {
  margin: 0;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(1.1rem, 1.3vw, 1.8rem);
}

@media (max-width: 600px) {
  .memberships-view {
    padding: 28px 20px 56px;
  }
}
</style>
