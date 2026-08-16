<script setup>
const categories = [
  {
    title: 'Research & development',
    description: 'Memberships, professional development, workshops, co-authorships and projects',
  },
  {
    title: 'International cooperation',
    description: 'Visiting researchers, international conferences and cooperation',
  },
  {
    title: 'Teaching & quality',
    description: 'Schedules, adjustments, sabbaticals and survey action plans',
  },
  {
    title: 'Cooperation & events',
    description: 'Stakeholders and joint events',
  },
  {
    title: 'Faculty reports',
    description: 'Faculty data and reporting modules',
  },
]
</script>

<template>
  <v-container class="home-view py-10 py-md-16">
    <section class="mb-10">
      <h1 class="text-h3 font-weight-bold mb-3">Praćenje aktivnosti fakulteta</h1>
      <p class="text-body-1 text-medium-emphasis intro-text">
        Odaberite kategoriju za pregled i upravljanje podacima.
      </p>
    </section>

    <v-row>
      <v-col
        v-for="category in categories"
        :key="category.title"
        cols="12"
        sm="6"
        lg="4"
      >
        <v-card class="category-card h-100 pa-6" color="primary" elevation="0">
          <v-card-title class="text-h5 font-weight-bold pa-0 mb-3">
            {{ category.title }}
          </v-card-title>
          <v-card-text class="text-body-2 pa-0">
            {{ category.description }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-btn class="mt-8" color="primary" size="large" to="/dashboard">
      Otvori dashboard
    </v-btn>
  </v-container>
</template>

<style scoped>
.home-view {
  max-width: 1200px;
}

.intro-text {
  max-width: 620px;
}

.category-card {
  min-height: 190px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border: 1px solid #c69a05;
}
</style>
