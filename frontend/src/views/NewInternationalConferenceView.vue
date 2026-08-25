<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'

const router = useRouter()
const userId = 1
const periods = ref([])
const units = ref([])
const countries = ref([])
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const success = ref('')

const form = reactive({
  reporting_period_id: null,
  conference_name: '',
  held_on: '',
  location: '',
  organizer_unit_id: '',
  coorganizers: '',
  scientific_field: '',
  total_participants: '',
  foreign_participants: '',
  country_count: '',
  presentation_count: '',
  published_paper_count: '',
  web_or_proceedings_link: '',
  notes: '',
})

const detail = reactive({
  english_name: '',
  organizing_committee_chair: '',
  program_committee_chair: '',
  unipu_program_members: '',
  foreign_program_members: '',
  submitted_abstract_count: '',
  accepted_abstract_count: '',
  plenary_lecture_count: '',
  section_count: '',
  proceedings_indexing: '',
  conference_website: '',
  media_coverage: '',
  organization_cost_eur: '',
  funding_sources: '',
})

const statistics = ref([])
function currentPeriod(items) {
  const today = new Date().toISOString().slice(0, 10)
  return items
    .filter((period) => !period.is_closed && String(period.start_date).slice(0, 10) <= today && today <= String(period.end_date).slice(0, 10))
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0]
}

function optionalText(value) { return String(value ?? '').trim() || null }
function optionalNumber(value) { return value === '' || value === null || value === undefined ? null : Number(value) }
function apiError(exception, fallback) {
  const responseErrors = exception.response?.data?.errors
  return Array.isArray(responseErrors) ? responseErrors : [exception.response?.data?.message || fallback]
}

function addStatistic() {
  statistics.value.push({ temporaryId: crypto.randomUUID(), country_id: '', country_name: '', participant_count: '', presentation_count: '' })
}

function removeStatistic(row) {
  statistics.value = statistics.value.filter((item) => item !== row)
}

function updateCountryName(row) {
  const country = countries.value.find((item) => Number(item.id) === Number(row.country_id))
  row.country_name = country ? (country.name_hr || country.name_en) : ''
}

function conferencePayload() {
  return {
    reporting_period_id: Number(form.reporting_period_id),
    conference_name: form.conference_name.trim(),
    held_on: form.held_on || null,
    location: optionalText(form.location),
    organizer_unit_id: optionalNumber(form.organizer_unit_id),
    coorganizers: optionalText(form.coorganizers),
    scientific_field: optionalText(form.scientific_field),
    total_participants: optionalNumber(form.total_participants),
    foreign_participants: optionalNumber(form.foreign_participants),
    country_count: statistics.value.length || optionalNumber(form.country_count),
    presentation_count: optionalNumber(form.presentation_count),
    published_paper_count: optionalNumber(form.published_paper_count),
    web_or_proceedings_link: optionalText(form.web_or_proceedings_link),
    notes: optionalText(form.notes),
    created_by: userId,
    updated_by: userId,
  }
}

function detailPayload() {
  const numberFields = new Set(['submitted_abstract_count', 'accepted_abstract_count', 'plenary_lecture_count', 'section_count', 'organization_cost_eur'])
  return Object.fromEntries(Object.entries(detail).map(([key, value]) => [key, numberFields.has(key) ? optionalNumber(value) : optionalText(value)]))
}

function validate() {
  const result = []
  if (!form.reporting_period_id) result.push('Nije pronađeno otvoreno izvještajno razdoblje.')
  if (!form.conference_name.trim()) result.push('Naziv konferencije je obavezan.')
  if (statistics.value.some((row) => !row.country_name.trim())) result.push('Država je obavezna za svaki redak strukture sudionika.')
  const numericValues = [form.total_participants, form.foreign_participants, form.country_count, form.presentation_count, form.published_paper_count, detail.submitted_abstract_count, detail.accepted_abstract_count, detail.plenary_lecture_count, detail.section_count]
  if (numericValues.some((value) => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0))) result.push('Brojčana polja moraju sadržavati nenegativne cijele brojeve.')
  if (form.total_participants !== '' && form.foreign_participants !== '' && Number(form.foreign_participants) > Number(form.total_participants)) {
    result.push('Broj stranih sudionika ne može biti veći od ukupnog broja sudionika.')
  }
  if (detail.organization_cost_eur !== '' && Number(detail.organization_cost_eur) < 0) result.push('Trošak organizacije ne može biti negativan.')
  return result
}

async function submit() {
  errors.value = validate()
  if (errors.value.length) return
  saving.value = true
  try {
    const conferenceResponse = await api.post('/api/international-conferences', conferencePayload())
    const conferenceId = conferenceResponse.data.id
    const details = detailPayload()
    if (Object.values(details).some((value) => value !== null)) {
      await api.post('/api/international-conferences/details', { ...details, conference_id: conferenceId, created_by: userId, updated_by: userId })
    }
    const total = Number(form.total_participants) || 0
    await Promise.all(statistics.value.map((row) => {
      const participantCount = optionalNumber(row.participant_count)
      return api.post('/api/international-conferences/countries', {
        conference_id: conferenceId,
        country_id: optionalNumber(row.country_id),
        country_name: row.country_name.trim(),
        participant_count: participantCount,
        presentation_count: optionalNumber(row.presentation_count),
        share_percent: total > 0 && participantCount !== null ? Number(((participantCount / total) * 100).toFixed(2)) : null,
        created_by: userId,
        updated_by: userId,
      })
    }))
    saved.value = true
    success.value = 'Međunarodna konferencija uspješno je spremljena.'
  } catch (exception) {
    errors.value = apiError(exception, 'Konferenciju nije moguće spremiti.')
  } finally { saving.value = false }
}

async function load() {
  try {
    const [periodResponse, unitResponse, countryResponse] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/organizational-units'),
      api.get('/api/countries'),
    ])
    periods.value = periodResponse.data
    units.value = unitResponse.data
    countries.value = countryResponse.data
    form.reporting_period_id = currentPeriod(periods.value)?.id ?? periods.value.find((period) => !period.is_closed)?.id ?? null
  } catch (exception) {
    errors.value = apiError(exception, 'Nije moguće učitati obrazac.')
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <main class="new-view">
    <nav><RouterLink to="/medunarodna-suradnja">Međunarodna suradnja</RouterLink><span>›</span><RouterLink to="/medunarodna-suradnja/medunarodne-konferencije">Međunarodne konferencije</RouterLink><span>›</span><span>Nova konferencija</span></nav>
    <h1>Dodavanje međunarodne konferencije</h1>
    <p v-if="loading">Učitavanje...</p>
    <form v-else @submit.prevent="submit">
      <div v-if="errors.length" class="alert"><ul><li v-for="error in errors" :key="error">{{ error }}</li></ul></div>
      <div class="card">
        <section>
          <h2>Osnovni podaci</h2>
          <div class="grid">
            <label class="wide">Naziv konferencije *<input v-model="form.conference_name" maxlength="250" :disabled="saved"></label>
            <label>Datum održavanja<input v-model="form.held_on" type="date" :disabled="saved"></label>
            <label>Mjesto<input v-model="form.location" maxlength="150" :disabled="saved"></label>
            <label>Organizator (sastavnica)<select v-model="form.organizer_unit_id" :disabled="saved"><option value="">Odaberite sastavnicu</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select></label>
            <label>Znanstveno područje<input v-model="form.scientific_field" maxlength="150" :disabled="saved"></label>
            <label class="wide">Suorganizatori<textarea v-model="form.coorganizers" rows="3" :disabled="saved"></textarea></label>
          </div>
          <div class="grid counts">
            <label>Ukupno sudionika<input v-model="form.total_participants" type="number" min="0" max="9999" :disabled="saved"></label>
            <label>Strani sudionici<input v-model="form.foreign_participants" type="number" min="0" :max="form.total_participants || 9999" :disabled="saved"></label>
            <label>Broj država<input v-model="form.country_count" type="number" min="0" max="250" :disabled="saved || statistics.length > 0"></label>
            <label>Broj izlaganja<input v-model="form.presentation_count" type="number" min="0" max="9999" :disabled="saved"></label>
            <label>Objavljeni radovi<input v-model="form.published_paper_count" type="number" min="0" max="9999" :disabled="saved"></label>
          </div>
          <div class="grid">
            <label class="wide">Link na web / zbornik<input v-model="form.web_or_proceedings_link" type="url" :disabled="saved"></label>
            <label class="wide">Napomena<textarea v-model="form.notes" rows="3" :disabled="saved"></textarea></label>
          </div>
        </section>

        <section>
          <h2>Detaljni podaci o konferenciji</h2>
          <div class="grid">
            <label class="wide">Puni naziv na engleskom<input v-model="detail.english_name" maxlength="250" :disabled="saved"></label>
            <label>Predsjednik organizacijskog odbora<input v-model="detail.organizing_committee_chair" maxlength="120" :disabled="saved"></label>
            <label>Predsjednik programskog odbora<input v-model="detail.program_committee_chair" maxlength="120" :disabled="saved"></label>
            <label>Članovi programskog odbora – UNIPU<textarea v-model="detail.unipu_program_members" rows="3" :disabled="saved"></textarea></label>
            <label>Strani članovi programskog odbora<textarea v-model="detail.foreign_program_members" rows="3" :disabled="saved"></textarea></label>
          </div>
          <div class="grid counts detail-counts">
            <label>Prijavljeni sažeci<input v-model="detail.submitted_abstract_count" type="number" min="0" max="9999" :disabled="saved"></label>
            <label>Prihvaćeni sažeci<input v-model="detail.accepted_abstract_count" type="number" min="0" max="9999" :disabled="saved"></label>
            <label>Plenarna predavanja<input v-model="detail.plenary_lecture_count" type="number" min="0" max="999" :disabled="saved"></label>
            <label>Broj sekcija<input v-model="detail.section_count" type="number" min="0" max="999" :disabled="saved"></label>
          </div>
          <div class="grid">
            <label>Indeksacija zbornika<input v-model="detail.proceedings_indexing" maxlength="150" :disabled="saved"></label>
            <label>Web stranica konferencije<input v-model="detail.conference_website" type="url" :disabled="saved"></label>
            <label>Ukupni troškovi organizacije (€)<input v-model="detail.organization_cost_eur" type="number" min="0" max="999999.99" step="0.01" :disabled="saved"></label>
            <label>Izvori financiranja<input v-model="detail.funding_sources" :disabled="saved"></label>
            <label class="wide">Medijska pokrivenost<textarea v-model="detail.media_coverage" rows="3" :disabled="saved"></textarea></label>
          </div>
        </section>

        <section>
          <header class="section-heading"><h2>Struktura sudionika po državama</h2><button v-if="!saved" type="button" class="square plus" aria-label="Dodaj državu" @click="addStatistic">+</button></header>
          <div v-if="statistics.length" class="table"><table><thead><tr><th>Država</th><th>Broj sudionika</th><th>Broj izlaganja</th><th></th></tr></thead><tbody><tr v-for="row in statistics" :key="row.temporaryId"><td><CountryAutocomplete v-model="row.country_id" :countries="countries" :disabled="saved" placeholder="Odaberite državu" @change="updateCountryName(row)" /></td><td><input v-model="row.participant_count" type="number" min="0" max="9999" :disabled="saved"></td><td><input v-model="row.presentation_count" type="number" min="0" max="9999" :disabled="saved"></td><td><button v-if="!saved" type="button" class="square minus" aria-label="Ukloni državu" @click="removeStatistic(row)">−</button></td></tr></tbody></table></div>
        </section>
        <div class="actions"><button class="button" :disabled="saving || saved">{{ saving ? 'Spremanje...' : 'Spremi' }}</button></div>
      </div>
      <button type="button" class="button back" @click="router.push('/medunarodna-suradnja/medunarodne-konferencije')">Natrag</button>
    </form>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.new-view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}nav,.actions,.section-heading{display:flex;align-items:center}nav{gap:10px;color:rgb(var(--v-theme-muted))}nav a{color:inherit;text-decoration:none}nav a:hover{color:rgb(var(--v-theme-primary))}h1{margin:26px 0 8px;font-weight:400}form{margin-top:45px}.alert{margin-bottom:18px;padding:12px;border:1px solid rgb(var(--v-theme-error));border-radius:8px;color:rgb(var(--v-theme-error))}.card{display:grid;gap:38px;padding:clamp(34px,5vw,76px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.card section{display:grid;gap:24px;padding-top:28px;border-top:1px solid rgb(var(--v-theme-category-border))}h2{margin:0;font-weight:400}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 54px}.grid.counts{grid-template-columns:repeat(5,minmax(0,1fr))}.grid.detail-counts{grid-template-columns:repeat(4,minmax(0,1fr))}.wide{grid-column:1/-1}label{display:grid;gap:8px}input,select,textarea{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.section-heading{justify-content:flex-start;gap:12px}.square{display:grid;width:38px;height:38px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-on-surface));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font-size:1.2rem}.section-heading .plus{width:30px;height:30px;font-size:1rem}.plus:hover{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.minus:hover{background:rgb(var(--v-theme-error));color:#fff}.table{overflow-x:auto;border-radius:10px}.table table{width:100%;border-collapse:collapse}.table th,.table td{padding:11px 12px;border:1px solid rgb(var(--v-theme-table-border));text-align:left}.table th{border-color:rgb(var(--v-theme-table-header-border))}.table td input,.table td select{min-width:145px}.custom-country{margin-top:7px}.empty{margin:0;color:rgb(var(--v-theme-muted))}.actions{justify-content:flex-end}.button{padding:10px 18px;border:1px solid rgb(var(--v-theme-on-surface));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer}.button:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.button:disabled{cursor:not-allowed;opacity:.55}.back{margin-top:20px}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:1050px){.grid.counts,.grid.detail-counts{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.new-view{padding:28px 20px}.grid,.grid.counts,.grid.detail-counts{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
