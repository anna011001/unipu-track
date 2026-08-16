<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const router = useRouter()

const userId = ref(route.query.user_id ? String(route.query.user_id) : '')
const records = ref([])
const loading = ref(false)
const errorMessage = ref('')
const hasSearched = ref(false)

const columns = computed(() => {
  if (records.value.length === 0) {
    return []
  }

  return Object.keys(records.value[0])
})

function columnLabel(column) {
  return column
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatValue(value, column) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  if (column.endsWith('_at') || column.endsWith('_date')) {
    const date = new Date(value)

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeStyle: column.endsWith('_at') ? 'short' : undefined,
      }).format(date)
    }
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
}

async function loadRecentRecords() {
  const parsedUserId = Number(userId.value)

  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    errorMessage.value = 'ID korisnika mora biti pozitivan cijeli broj.'
    records.value = []
    hasSearched.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/api/dashboard/recent', {
      params: { user_id: parsedUserId },
    })

    records.value = Array.isArray(response.data) ? response.data : []
    hasSearched.value = true

    await router.replace({
      name: 'dashboard',
      query: { user_id: parsedUserId },
    })
  } catch (error) {
    records.value = []
    hasSearched.value = true
    errorMessage.value =
      error.response?.data?.message ||
      'Nije moguće dohvatiti zadnje uređivane zapise.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (userId.value) {
    loadRecentRecords()
  }
})
</script>

<template>
  <v-container class="dashboard-view py-10 py-md-16">
    <section class="mb-8">
      <p class="text-overline text-primary mb-2">Dashboard</p>
      <h1 class="text-h3 font-weight-bold mb-3">Zadnje uređivani zapisi</h1>
      <p class="text-body-1 text-medium-emphasis">
        Prikazuje najviše 10 zapisa koje je odabrani korisnik posljednje uređivao.
      </p>
    </section>

    <v-card class="pa-5 mb-6" variant="outlined">
      <v-form class="user-form" @submit.prevent="loadRecentRecords">
        <v-text-field
          v-model="userId"
          label="ID korisnika"
          type="number"
          min="1"
          variant="outlined"
          hide-details
        />
        <v-btn color="primary" size="large" type="submit" :loading="loading">
          Prikaži zapise
        </v-btn>
      </v-form>
    </v-card>

    <v-alert v-if="errorMessage" class="mb-6" type="error" variant="tonal">
      {{ errorMessage }}
    </v-alert>

    <div v-if="loading" class="loading-state py-12">
      <v-progress-circular color="primary" indeterminate />
    </div>

    <v-card v-else-if="records.length" variant="outlined">
      <v-table class="records-table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column">
              {{ columnLabel(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(record, index) in records" :key="record.id ?? index">
            <td v-for="column in columns" :key="column">
              {{ formatValue(record[column], column) }}
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-alert v-else-if="hasSearched" type="info" variant="tonal">
      Za odabranog korisnika nema nedavno uređivanih zapisa.
    </v-alert>

    <v-alert v-else type="info" variant="tonal">
      Unesite ID korisnika kako biste dohvatili zadnje uređivane zapise.
    </v-alert>
  </v-container>
</template>

<style scoped>
.dashboard-view {
  max-width: 1200px;
}

.user-form {
  display: grid;
  grid-template-columns: minmax(220px, 360px) auto;
  align-items: center;
  gap: 16px;
}

.loading-state {
  display: flex;
  justify-content: center;
}

.records-table {
  overflow-x: auto;
}

.records-table th {
  white-space: nowrap;
  color: #5e563e;
  background: #fbf8ee;
}

.records-table td {
  min-width: 130px;
}

@media (max-width: 600px) {
  .user-form {
    grid-template-columns: 1fr;
  }
}
</style>
