<script setup>
const modules = [
  {
    title: 'Članstva',
    to: '/istrazivanje-i-razvoj/clanstva',
  },
  {
    title: 'Stručna usavršavanja',
    to: '/istrazivanje-i-razvoj/strucna-usavrsavanja',
  },
  {
    title: 'Sudjelovanja na događanjima',
    to: '/istrazivanje-i-razvoj/sudjelovanja',
  },
  {
    title: 'Radionice',
    to: '/istrazivanje-i-razvoj/radionice',
  },
  {
    title: 'Koautorstva',
    to: '/istrazivanje-i-razvoj/koautorstva',
  },
  {
    title: 'Projektne prijave',
    to: '/istrazivanje-i-razvoj/projektne-prijave',
  },
]
</script>

<template>
  <main class="research-view">
    <h1>Istraživanje i razvoj</h1>

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
.research-view {
  min-height: calc(100vh - 112px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 34px clamp(32px, 5vw, 128px) 80px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.research-view h1 {
  margin: 0;
  font-size: clamp(2rem, 2.1vw, 3.5rem);
  font-weight: 400;
  line-height: 1.2;
}

.module-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(220px, 1fr));
  gap: clamp(32px, 4vw, 86px);
  margin-top: clamp(46px, 7vh, 92px);
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
  cursor: pointer;
  font-size: clamp(1.4rem, 1.8vw, 2.6rem);
  font-weight: 400;
  line-height: 1.4;
  text-align: center;
  text-decoration: none;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
}

.module-card:hover {
  background: rgb(var(--v-theme-category-card-hover));
}

@media (max-width: 900px) {
  .module-grid {
    flex: none;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(220px, 1fr));
  }
}

@media (max-width: 600px) {
  .research-view {
    padding: 28px 20px 56px;
  }

  .module-grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
  }

  .module-card {
    min-height: 200px;
  }
}
</style>
