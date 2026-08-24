<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { RouterView } from 'vue-router'
import AppHeader from './components/AppHeader.vue'

const route = useRoute()
const showHeader = computed(() => route.matched.length > 0 && !route.meta.public)
</script>

<template>
  <v-app>
    <AppHeader v-if="showHeader" />

    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>
