<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '../services/api.js'

const categories = [
  {
    title: 'Istraživanje i razvoj',
    to: '/istrazivanje-i-razvoj',
  },
  {
    title: 'Međunarodna suradnja',
  },
  {
    title: 'Nastava i kvaliteta',
  },
  {
    title: 'Suradnja i događanja',
  },
]

const records = ref([])
const loading = ref(true)
const errorMessage = ref('')

const recentRecords = computed(() => records.value.slice(0, 3))

function getRecordRoute(record) {
  const membershipTypes = {
    NEW_MEMBERSHIPS: 'new',
    ACTIVE_MEMBERSHIPS: 'active',
  }
  const type = membershipTypes[record.record_type]

  if (!type) {
    return null
  }

  return {
    name: 'memberships',
    query: {
      type,
      id: record.record_id,
    },
  }
}

function getCategory(recordType) {
  const type = recordType || ''

  if (
    ['MEMBERSHIP', 'PROFESSIONAL_DEVELOPMENT', 'EVENT_PARTICIPATION', 'WORKSHOP', 'COAUTHOR', 'PROJECT'].some(
      (part) => type.includes(part),
    )
  ) {
    return 'Istraživanje i razvoj'
  }

  if (
    ['VISITING_RESEARCHER', 'INTERNATIONAL_CONFERENCE', 'INTERNATIONAL_COOPERATION'].some(
      (part) => type.includes(part),
    )
  ) {
    return 'Međunarodna suradnja'
  }

  if (
    ['SCHEDULE', 'SABBATICAL', 'SURVEY_ACTION_PLAN'].some((part) => type.includes(part))
  ) {
    return 'Nastava i kvaliteta'
  }

  if (['STAKEHOLDER', 'JOINT_EVENT'].some((part) => type.includes(part))) {
    return 'Suradnja i događanja'
  }

  return 'Izvještaji fakulteta'
}

function formatModified(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const differenceInDays = Math.round((startOfToday - startOfDate) / 86400000)
  const time = new Intl.DateTimeFormat('hr-HR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  if (differenceInDays === 0) {
    return `danas u ${time}`
  }

  if (differenceInDays === 1) {
    return `jučer u ${time}`
  }

  return new Intl.DateTimeFormat('hr-HR').format(date)
}

async function loadRecentRecords() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/api/dashboard/recent', {
      params: { user_id: 1 },
    })
    records.value = Array.isArray(response.data) ? response.data : []
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message || 'Nije moguće dohvatiti zadnje uređivane zapise.'
  } finally {
    loading.value = false
  }
}

onMounted(loadRecentRecords)
</script>

<template>
  <div class="home-view">
    <section class="recent-section">
      <h1>Nedavno uređeni zapisi</h1>

      <div class="recent-table-wrapper">
        <table class="recent-table">
          <thead>
            <tr>
              <th>Kategorija</th>
              <th>Zapis</th>
              <th>Izmijenjeno</th>
            </tr>
          </thead>
          <tbody v-if="recentRecords.length">
            <tr v-for="record in recentRecords" :key="`${record.record_type}-${record.record_id}`">
              <td>{{ getCategory(record.record_type) }}</td>
              <td>
                <RouterLink
                  v-if="getRecordRoute(record)"
                  class="record-name"
                  :to="getRecordRoute(record)"
                >
                  {{ record.module_name }}
                </RouterLink>
                <span v-else>{{ record.module_name }}</span>
              </td>
              <td>{{ formatModified(record.updated_at) }}</td>
            </tr>
          </tbody>
        </table>

        <p v-if="loading" class="table-message">Učitavanje...</p>
        <p v-else-if="errorMessage" class="table-message table-error">{{ errorMessage }}</p>
        <p v-else-if="!recentRecords.length" class="table-message">Nema nedavno uređivanih zapisa.</p>
      </div>
    </section>

    <section class="categories-section">
      <h2>Kategorije obrazaca</h2>

      <div class="category-grid">
        <template v-for="category in categories" :key="category.title">
          <RouterLink v-if="category.to" class="category-card" :to="category.to">
            {{ category.title }}
          </RouterLink>
          <article v-else class="category-card">
            {{ category.title }}
          </article>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-view {
  --home-text: rgb(var(--v-theme-on-background));
  --home-divider: rgb(var(--v-theme-divider));
  --home-record: rgb(var(--v-theme-record));
  --home-record-hover: rgb(var(--v-theme-record-hover));
  --home-muted: rgb(var(--v-theme-muted));
  --home-error: rgb(var(--v-theme-error));
  --card-background: rgb(var(--v-theme-category-card));
  --card-background-hover: rgb(var(--v-theme-category-card-hover));
  --card-border: rgb(var(--v-theme-category-border));
  --card-text: rgb(var(--v-theme-on-category-card));
  min-height: calc(100vh - 112px);
  padding: 34px clamp(32px, 5vw, 128px) 80px;
  background: rgb(var(--v-theme-background));
  color: var(--home-text);
}

.recent-section h1,
.categories-section h2 {
  margin: 0;
  font-size: clamp(2rem, 2.1vw, 3.5rem);
  font-weight: 400;
  line-height: 1.2;
}

.recent-table-wrapper {
  width: min(100%, 1520px);
  margin-top: 44px;
}

.recent-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: clamp(1rem, 1.15vw, 1.85rem);
}

.recent-table th,
.recent-table td {
  padding: 20px 40px;
  text-align: left;
  vertical-align: middle;
}

.recent-table th:first-child,
.recent-table td:first-child {
  width: 29%;
}

.recent-table th:nth-child(2),
.recent-table td:nth-child(2) {
  width: 43%;
}

.recent-table th:last-child,
.recent-table td:last-child {
  width: 28%;
}

.recent-table th {
  font-weight: 700;
}

.recent-table td {
  font-weight: 600;
}

.recent-table tbody tr:not(:last-child) td:not(:first-child) {
  border-bottom: 1px solid var(--home-divider);
}

.record-name {
  color: var(--home-record);
  cursor: pointer;
  transition: color 160ms ease;
}

.record-name:hover {
  color: var(--home-record-hover);
}

.table-message {
  margin: 24px 40px 0;
  color: var(--home-muted);
  font-size: 1rem;
}

.table-error {
  color: var(--home-error);
}

.categories-section {
  margin-top: clamp(70px, 8vh, 140px);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(24px, 3.5vw, 88px);
  margin-top: clamp(38px, 5vh, 78px);
}

.category-card {
  min-height: clamp(230px, 19vw, 470px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: var(--card-background);
  color: var(--card-text);
  font-size: clamp(1.55rem, 2vw, 3rem);
  font-weight: 400;
  line-height: 1.6;
  text-align: center;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease;
}

.category-card:hover {
  background: var(--card-background-hover);
}

@media (max-width: 1100px) {
  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recent-table-wrapper {
    overflow-x: auto;
  }

  .recent-table {
    min-width: 850px;
  }
}

@media (max-width: 600px) {
  .home-view {
    padding: 28px 20px 56px;
  }

  .recent-table th,
  .recent-table td {
    padding-inline: 20px;
  }

  .category-grid {
    grid-template-columns: 1fr;
  }

  .category-card {
    min-height: 210px;
  }
}
</style>
