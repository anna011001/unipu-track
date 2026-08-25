<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const router = useRouter()
const userId = 1
const periods = ref([])
const countries = ref([])
const units = ref([])
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const success = ref('')
const visitType = ref(route.query.type === 'planned' ? 'planned' : 'realized')

const form = reactive({
  reporting_period_id: null,
  researcher_name: '',
  academic_title: '',
  home_institution: '',
  country_id: '',
  scientific_field: '',
  arrival_date: '',
  departure_date: '',
  duration_days: '',
  host_unit_id: '',
  mentor_contact: '',
  activities_during_stay: '',
  results: '',
  lecture_count: 0,
  publication_count: 0,
  project_count: 0,
  planned_period: '',
  duration: '',
  mentor: '',
  planned_activities: '',
  invitation_status: '',
  funding_source: '',
  notes: '',
})

const title = computed(() => visitType.value === 'realized' ? 'Dodavanje realiziranog gostovanja' : 'Dodavanje planiranog gostovanja')

function currentPeriod(items) {
  const today = new Date().toISOString().slice(0, 10)
  return items
    .filter((period) => !period.is_closed && String(period.start_date).slice(0, 10) <= today && today <= String(period.end_date).slice(0, 10))
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0]
}

function optionalText(value) {
  return value.trim() || null
}

function optionalId(value) {
  return value === '' || value === null ? null : Number(value)
}

function validate() {
  const result = []
  if (!form.reporting_period_id) result.push('Nije pronađeno otvoreno izvještajno razdoblje.')
  if (!form.researcher_name.trim()) result.push('Ime i prezime istraživača je obavezno.')
  if (visitType.value === 'realized') {
    if (form.arrival_date && form.departure_date && form.departure_date < form.arrival_date) result.push('Datum odlaska ne smije biti prije datuma dolaska.')
    if (form.duration_days !== '' && (!Number.isInteger(Number(form.duration_days)) || Number(form.duration_days) < 0 || Number(form.duration_days) > 999)) result.push('Trajanje mora biti cijeli broj između 0 i 999 dana.')
  }
  return result
}

function commonPayload() {
  return {
    reporting_period_id: Number(form.reporting_period_id),
    researcher_name: form.researcher_name.trim(),
    academic_title: optionalText(form.academic_title),
    home_institution: optionalText(form.home_institution),
    country_id: optionalId(form.country_id),
    scientific_field: optionalText(form.scientific_field),
    host_unit_id: optionalId(form.host_unit_id),
    notes: optionalText(form.notes),
    created_by: userId,
    updated_by: userId,
  }
}

async function submit() {
  errors.value = validate()
  if (errors.value.length) return
  saving.value = true
  const payload = visitType.value === 'realized'
    ? {
        ...commonPayload(),
        arrival_date: form.arrival_date || null,
        departure_date: form.departure_date || null,
        duration_days: optionalId(form.duration_days),
        mentor_contact: optionalText(form.mentor_contact),
        activities_during_stay: optionalText(form.activities_during_stay),
        results: optionalText(form.results),
        lecture_count: Number(form.lecture_count),
        publication_count: Number(form.publication_count),
        project_count: Number(form.project_count),
      }
    : {
        ...commonPayload(),
        planned_period: optionalText(form.planned_period),
        duration: optionalText(form.duration),
        mentor: optionalText(form.mentor),
        planned_activities: optionalText(form.planned_activities),
        invitation_status: optionalText(form.invitation_status),
        funding_source: optionalText(form.funding_source),
      }

  try {
    await api.post(`/api/visiting-researchers/${visitType.value}`, payload)
    saved.value = true
    success.value = visitType.value === 'realized' ? 'Realizirano gostovanje uspješno je spremljeno.' : 'Planirano gostovanje uspješno je spremljeno.'
  } catch (exception) {
    errors.value = exception.response?.data?.errors || [exception.response?.data?.message || 'Gostovanje nije moguće spremiti.']
  } finally {
    saving.value = false
  }
}

async function load() {
  try {
    const [periodResponse, countryResponse, unitResponse] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/countries'),
      api.get('/api/organizational-units'),
    ])
    periods.value = periodResponse.data
    countries.value = countryResponse.data
    units.value = unitResponse.data
    form.reporting_period_id = currentPeriod(periods.value)?.id ?? periods.value.find((period) => !period.is_closed)?.id ?? null
  } catch (exception) {
    errors.value = [exception.response?.data?.message || 'Nije moguće učitati obrazac.']
  } finally {
    loading.value = false
  }
}

watch(visitType, (value) => {
  router.replace({ query: { type: value } })
  errors.value = []
})
onMounted(load)
</script>

<template>
  <main class="new-view">
    <nav><RouterLink to="/medunarodna-suradnja">Međunarodna suradnja</RouterLink><span>›</span><RouterLink to="/medunarodna-suradnja/gostujuci-istrazivaci">Gostujući istraživači</RouterLink><span>›</span><span>Novo gostovanje</span></nav>
    <h1>{{ title }}</h1>
    <p class="description">Program međunarodnih gostujućih istraživača</p>

    <p v-if="loading">Učitavanje...</p>
    <form v-else @submit.prevent="submit">
      <div v-if="errors.length" class="alert"><ul><li v-for="error in errors" :key="error">{{ error }}</li></ul></div>
      <div class="card">
        <label class="type-field">Vrsta gostovanja<select v-model="visitType" :disabled="saved"><option value="realized">Realizirano gostovanje</option><option value="planned">Planirano gostovanje</option></select></label>
        <div class="grid">
          <label>Ime i prezime istraživača *<input v-model="form.researcher_name" maxlength="120" :disabled="saved"></label>
          <label>Zvanje<input v-model="form.academic_title" maxlength="30" :disabled="saved"></label>
          <label>Matična institucija<input v-model="form.home_institution" maxlength="200" :disabled="saved"></label>
          <label>Država<CountryAutocomplete v-model="form.country_id" :countries="countries" :disabled="saved" /></label>
          <label>Znanstveno područje<input v-model="form.scientific_field" maxlength="150" :disabled="saved"></label>
          <label>Sastavnica domaćin<select v-model="form.host_unit_id" :disabled="saved"><option value="">Odaberite sastavnicu</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select></label>
        </div>

        <template v-if="visitType === 'realized'">
          <div class="grid three">
            <label>Datum dolaska<input v-model="form.arrival_date" type="date" :disabled="saved"></label>
            <label>Datum odlaska<input v-model="form.departure_date" type="date" :disabled="saved"></label>
            <label>Trajanje (dana)<input v-model="form.duration_days" type="number" min="0" max="999" :disabled="saved"></label>
          </div>
          <label>Mentor / kontakt<input v-model="form.mentor_contact" maxlength="150" :disabled="saved"></label>
          <div class="grid">
            <label>Aktivnosti tijekom boravka<textarea v-model="form.activities_during_stay" rows="4" :disabled="saved"></textarea></label>
            <label>Rezultati (publikacije, predavanja... )<textarea v-model="form.results" rows="4" :disabled="saved"></textarea></label>
          </div>
          <div class="grid three">
            <label>Broj predavanja<input v-model="form.lecture_count" type="number" min="0" max="9999" :disabled="saved"></label>
            <label>Broj publikacija<input v-model="form.publication_count" type="number" min="0" max="9999" :disabled="saved"></label>
            <label>Broj projekata<input v-model="form.project_count" type="number" min="0" max="9999" :disabled="saved"></label>
          </div>
        </template>

        <template v-else>
          <div class="grid">
            <label>Planirano razdoblje<input v-model="form.planned_period" maxlength="100" placeholder="npr. listopad 2026." :disabled="saved"></label>
            <label>Trajanje<input v-model="form.duration" maxlength="60" placeholder="npr. 14 dana" :disabled="saved"></label>
            <label>Mentor<input v-model="form.mentor" maxlength="120" :disabled="saved"></label>
            <label>Status poziva<input v-model="form.invitation_status" maxlength="40" :disabled="saved"></label>
            <label>Izvor financiranja<input v-model="form.funding_source" maxlength="150" :disabled="saved"></label>
          </div>
          <label>Planirane aktivnosti<textarea v-model="form.planned_activities" rows="4" :disabled="saved"></textarea></label>
        </template>

        <label>Napomena<textarea v-model="form.notes" rows="4" :disabled="saved"></textarea></label>
        <div class="actions"><button class="button" :disabled="saving || saved">{{ saving ? 'Spremanje...' : 'Spremi' }}</button></div>
      </div>
      <button type="button" class="button back" @click="router.push('/medunarodna-suradnja/gostujuci-istrazivaci')">Natrag</button>
    </form>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.new-view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}nav,.actions{display:flex;align-items:center}nav{gap:10px;color:rgb(var(--v-theme-muted))}nav a{color:inherit;text-decoration:none}nav a:hover{color:rgb(var(--v-theme-primary))}h1{margin:26px 0 8px;font-weight:400}.description{color:rgb(var(--v-theme-primary))}form{margin-top:45px}.alert{margin-bottom:18px;padding:12px;border:1px solid rgb(var(--v-theme-error));border-radius:8px;color:rgb(var(--v-theme-error))}.card{display:grid;gap:34px;padding:clamp(34px,5vw,76px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 54px}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.type-field{max-width:460px}label{display:grid;gap:8px}input,select,textarea{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.actions{justify-content:flex-end}.button{padding:10px 18px;border:1px solid rgb(var(--v-theme-on-surface));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer}.button:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.button:disabled{cursor:not-allowed;opacity:.55}.back{margin-top:20px}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:760px){.new-view{padding:28px 20px}.grid,.grid.three{grid-template-columns:1fr}}
</style>
