<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'

const router = useRouter()
const userId = 1
const periods = ref([])
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const success = ref('')

const form = reactive({
  reporting_period_id: null,
  authors_and_title: '',
  publication_year: new Date().getFullYear(),
  category: '',
  publication_link: '',
})

const categories = [
  { value: 'WOS_SCOPUS_Q1_Q2', label: 'Radovi u časopisima indeksirani u WoS/Scopus (Q1–Q2)' },
  { value: 'WOS_SCOPUS_Q3_Q4', label: 'Radovi u časopisima indeksirani u WoS/Scopus (Q3–Q4)' },
  { value: 'OTHER_INTERNATIONAL_JOURNALS', label: 'Radovi u ostalim međunarodnim časopisima' },
  { value: 'DOMESTIC_JOURNALS', label: 'Radovi u domaćim časopisima' },
  { value: 'BOOK_CHAPTERS', label: 'Poglavlja u knjigama' },
  { value: 'CONFERENCE_PROCEEDINGS', label: 'Radovi u zbornicima skupova' },
]

function currentPeriod(items) {
  const today = new Date().toISOString().slice(0, 10)
  return items
    .filter((period) => !period.is_closed && String(period.start_date).slice(0, 10) <= today && today <= String(period.end_date).slice(0, 10))
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0]
}

function validate() {
  const result = []
  const maxYear = new Date().getFullYear() + 1
  if (!form.reporting_period_id) result.push('Nije pronađeno otvoreno izvještajno razdoblje.')
  if (!form.authors_and_title.trim()) result.push('Autori i naslov rada su obavezni.')
  if (!form.category) result.push('Kategorija rada je obavezna.')
  if (!Number.isInteger(Number(form.publication_year)) || Number(form.publication_year) < 2000 || Number(form.publication_year) > maxYear) {
    result.push(`Godina objave mora biti između 2000. i ${maxYear}.`)
  }
  return result
}

async function submit() {
  errors.value = validate()
  if (errors.value.length) return
  saving.value = true
  try {
    await api.post('/api/coauthorships/papers', {
      reporting_period_id: Number(form.reporting_period_id),
      authors_and_title: form.authors_and_title.trim(),
      publication_year: Number(form.publication_year),
      category: form.category,
      publication_link: form.publication_link.trim() || null,
      created_by: userId,
      updated_by: userId,
    })
    saved.value = true
    success.value = 'Koautorski rad uspješno je spremljen.'
  } catch (error) {
    errors.value = error.response?.data?.errors || [error.response?.data?.message || 'Koautorski rad nije moguće spremiti.']
  } finally {
    saving.value = false
  }
}

async function load() {
  try {
    const response = await api.get('/api/reporting-periods')
    periods.value = response.data
    form.reporting_period_id = currentPeriod(periods.value)?.id ?? null
  } catch (error) {
    errors.value = [error.response?.data?.message || 'Nije moguće učitati obrazac.']
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="new-view">
    <nav>
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink><span>›</span>
      <RouterLink to="/istrazivanje-i-razvoj/koautorstva">Koautorstva</RouterLink><span>›</span>
      <span>Novi koautorski rad</span>
    </nav>

    <h1>Dodavanje novog koautorskog rada</h1>
    <p class="description">Evidencija koautorstva na znanstvenim radovima</p>

    <p v-if="loading">Učitavanje...</p>
    <form v-else @submit.prevent="submit">
      <div v-if="errors.length" class="alert"><ul><li v-for="error in errors" :key="error">{{ error }}</li></ul></div>
      <div class="card">
        <label>Autori i naslov rada *<textarea v-model="form.authors_and_title" rows="5" :disabled="saved" placeholder="Prezime, I., Prezime, I. (2026). Naslov rada. Naziv časopisa..."></textarea></label>
        <div class="grid">
          <label>Godina objave *<input v-model="form.publication_year" type="number" min="2000" :max="new Date().getFullYear() + 1" :disabled="saved"></label>
          <label>Kategorija rada *<select v-model="form.category" :disabled="saved"><option value="" disabled>Odaberite kategoriju</option><option v-for="category in categories" :key="category.value" :value="category.value">{{ category.label }}</option></select></label>
        </div>
        <label>Link na objavljeni rad<input v-model="form.publication_link" type="url" placeholder="https://doi.org/..." :disabled="saved"></label>
        <div class="actions"><button class="button" :disabled="saving || saved">{{ saving ? 'Spremanje...' : 'Spremi' }}</button></div>
      </div>
      <button type="button" class="button back" @click="router.push('/istrazivanje-i-razvoj/koautorstva')">Natrag</button>
    </form>

    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.new-view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}
nav,.actions{display:flex;align-items:center}nav{gap:10px;color:rgb(var(--v-theme-muted))}nav a{color:inherit;text-decoration:none}nav a:hover{color:rgb(var(--v-theme-primary))}
h1{margin:26px 0 8px;font-weight:400}.description{color:rgb(var(--v-theme-primary))}form{margin-top:45px}
.alert{margin-bottom:18px;padding:12px;border:1px solid rgb(var(--v-theme-error));border-radius:8px;color:rgb(var(--v-theme-error))}
.card{display:grid;gap:34px;padding:clamp(34px,5vw,76px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 54px}label{display:grid;gap:8px}
input,select,textarea{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}
.actions{justify-content:flex-end}.button{padding:10px 18px;border:1px solid rgb(var(--v-theme-on-surface));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer}.button:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.button:disabled{cursor:not-allowed;opacity:.55}.back{margin-top:20px}
.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}
@media(max-width:650px){.new-view{padding:28px 20px}.grid{grid-template-columns:1fr}}
</style>
