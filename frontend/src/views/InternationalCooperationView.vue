<script setup>
const modules = [
  { title: 'Gostujući istraživači', to: '/medunarodna-suradnja/gostujuci-istrazivaci' },
  { title: 'Međunarodne konferencije' },
  { title: 'Mobilnost osoblja' },
  { title: 'Partnerstva' },
]
</script>

<template>
  <main class="international-view">
    <h1>Međunarodna suradnja</h1>

    <div class="module-grid">
      <template v-for="module in modules" :key="module.title">
        <RouterLink v-if="module.to" class="module-card" :to="module.to">
          {{ module.title }}
        </RouterLink>
        <article v-else class="module-card">
          {{ module.title }}
        </article>
      </template>
    </div>
  </main>
</template>

<style scoped>
.international-view {
  min-height: calc(100vh - 112px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 34px clamp(32px, 5vw, 128px) 80px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.international-view h1 {
  margin: 0;
  font-size: clamp(2rem, 2.1vw, 3.5rem);
  font-weight: 400;
  line-height: 1.2;
}

.module-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(220px, 1fr));
  gap: clamp(42px, 6vh, 82px) clamp(44px, 7vw, 130px);
  margin-top: clamp(46px, 7vh, 92px);
  padding-inline: clamp(0px, 2vw, 42px);
}

.module-card {
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
  font-size: clamp(1.4rem, 1.8vw, 2.6rem);
  font-weight: 400;
  line-height: 1.4;
  text-align: center;
  text-decoration: none;
  transition: background-color 160ms ease, border-color 160ms ease;
}

.module-card[href] {
  cursor: pointer;
}

.module-card[href]:hover {
  background: rgb(var(--v-theme-category-card-hover));
}

@media (max-width: 760px) {
  .international-view {
    padding: 28px 20px 56px;
  }

  .module-grid {
    flex: none;
    grid-template-columns: 1fr;
    grid-template-rows: none;
    gap: 28px;
    padding-inline: 0;
  }

  .module-card {
    min-height: 200px;
  }
}
</style>
