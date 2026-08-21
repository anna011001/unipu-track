<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const userId = 1
const perPage = 10

const periods = ref([])
const realized = ref([])
const planned = ref([])
const analyses = ref([])
const countries = ref([])
const units = ref([])
const periodId = ref(null)
const realizedPage = ref(1)
const plannedPage = ref(1)
const selectedType = ref('')
const selected = ref(null)
const form = ref(null)
const detailsCard = ref(null)
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')
const editError = ref('')
const success = ref('')
let snackbarTimer = null

const commonFields = [
  { key: 'researcher_name', label: 'Ime i prezime istraživača', required: true },
  { key: 'academic_title', label: 'Zvanje' },
  { key: 'home_institution', label: 'Matična institucija' },
  { key: 'country_id', label: 'Država', kind: 'country' },
  { key: 'scientific_field', label: 'Znanstveno područje' },
]

const realizedFields = [
  ...commonFields,
  { key: 'arrival_date', label: 'Datum dolaska', kind: 'date' },
  { key: 'departure_date', label: 'Datum odlaska', kind: 'date' },
  { key: 'duration_days', label: 'Trajanje (dana)', kind: 'number' },
  { key: 'host_unit_id', label: 'Sastavnica domaćin', kind: 'unit' },
  { key: 'mentor_contact', label: 'Mentor / kontakt' },
  { key: 'activities_during_stay', label: 'Aktivnosti tijekom boravka', kind: 'textarea' },
  { key: 'results', label: 'Rezultati', kind: 'textarea' },
  { key: 'lecture_count', label: 'Broj predavanja', kind: 'number' },
  { key: 'publication_count', label: 'Broj publikacija', kind: 'number' },
  { key: 'project_count', label: 'Broj projekata', kind: 'number' },
  { key: 'notes', label: 'Napomena', kind: 'textarea' },
]

const plannedFields = [
  ...commonFields,
  { key: 'planned_period', label: 'Planirano razdoblje' },
  { key: 'duration', label: 'Trajanje' },
  { key: 'host_unit_id', label: 'Sastavnica domaćin', kind: 'unit' },
  { key: 'mentor', label: 'Mentor' },
  { key: 'planned_activities', label: 'Planirane aktivnosti', kind: 'textarea' },
  { key: 'invitation_status', label: 'Status poziva' },
  { key: 'funding_source', label: 'Izvor financiranja' },
  { key: 'notes', label: 'Napomena', kind: 'textarea' },
]

const periodRealized = computed(() => realized.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)))
const periodPlanned = computed(() => planned.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)))
const periodAnalyses = computed(() => analyses.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)))
const realizedPages = computed(() => Math.ceil(periodRealized.value.length / perPage))
const plannedPages = computed(() => Math.ceil(periodPlanned.value.length / perPage))
const shownRealized = computed(() => periodRealized.value.slice((realizedPage.value - 1) * perPage, realizedPage.value * perPage))
const shownPlanned = computed(() => periodPlanned.value.slice((plannedPage.value - 1) * perPage, plannedPage.value * perPage))
const selectedFields = computed(() => selectedType.value === 'realized' ? realizedFields : plannedFields)

function display(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

function date(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(parsed)
}

function dateInput(value) {
  return value ? String(value).slice(0, 10) : ''
}

function countryName(id) {
  const country = countries.value.find((item) => Number(item.id) === Number(id))
  return country?.name_hr || country?.name_en || '—'
}

function unitName(id) {
  const unit = units.value.find((item) => Number(item.id) === Number(id))
  return unit?.short_name || unit?.name || '—'
}

function fieldValue(field) {
  const value = selected.value?.[field.key]
  if (field.kind === 'date') return date(value)
  if (field.kind === 'country') return countryName(value)
  if (field.kind === 'unit') return unitName(value)
  return display(value)
}

function optionalText(value) {
  return String(value ?? '').trim() || null
}

function optionalId(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

function apiError(exception, fallback) {
  const errors = exception.response?.data?.errors
  return Array.isArray(errors) ? errors.join(' ') : exception.response?.data?.message || fallback
}

function toast(message) {
  success.value = message
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { success.value = '' }, 4000)
}

async function refreshAnalyses() {
  const response = await api.get('/api/visiting-researchers/unit-analyses')
  analyses.value = response.data
}

function choose(type, item) {
  selectedType.value = type
  selected.value = item
  form.value = null
  editError.value = ''
}

function startEdit() {
  form.value = Object.fromEntries(selectedFields.value.map((field) => [
    field.key,
    field.kind === 'date' ? dateInput(selected.value[field.key]) : selected.value[field.key] ?? '',
  ]))
}

function cancelEdit() {
  form.value = null
  editError.value = ''
}

function payload() {
  const result = { updated_by: userId }
  for (const field of selectedFields.value) {
    if (field.required) result[field.key] = String(form.value[field.key] ?? '').trim()
    else if (field.kind === 'country' || field.kind === 'unit' || field.kind === 'number') result[field.key] = optionalId(form.value[field.key])
    else if (field.kind === 'date') result[field.key] = form.value[field.key] || null
    else result[field.key] = optionalText(form.value[field.key])
  }
  return result
}

async function save() {
  editError.value = ''
  if (!String(form.value.researcher_name ?? '').trim()) {
    editError.value = 'Ime i prezime istraživača je obavezno.'
    return
  }
  saving.value = true
  try {
    const response = await api.patch(`/api/visiting-researchers/${selectedType.value}/${selected.value.id}`, payload())
    const collection = selectedType.value === 'realized' ? realized : planned
    const updated = { ...selected.value, ...response.data }
    const index = collection.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) collection.value[index] = updated
    selected.value = updated
    if (selectedType.value === 'realized') await refreshAnalyses()
    form.value = null
    toast(selectedType.value === 'realized' ? 'Realizirano gostovanje uspješno je izmijenjeno.' : 'Planirano gostovanje uspješno je izmijenjeno.')
  } catch (exception) {
    editError.value = apiError(exception, 'Gostovanje nije moguće izmijeniti.')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm(`Želite li izbrisati gostovanje istraživača „${selected.value.researcher_name}”?`)) return
  deleting.value = true
  try {
    await api.delete(`/api/visiting-researchers/${selectedType.value}/${selected.value.id}`)
    const collection = selectedType.value === 'realized' ? realized : planned
    collection.value = collection.value.filter((item) => item.id !== selected.value.id)
    if (selectedType.value === 'realized') await refreshAnalyses()
    selected.value = null
    form.value = null
    toast('Gostovanje uspješno je izbrisano.')
  } catch (exception) {
    editError.value = apiError(exception, 'Gostovanje nije moguće izbrisati.')
  } finally {
    deleting.value = false
  }
}

async function openFromRoute() {
  const id = Number(route.query.id)
  const type = route.query.type === 'planned' ? 'planned' : 'realized'
  if (!id) return
  const collection = type === 'realized' ? realized.value : planned.value
  const item = collection.find((entry) => Number(entry.id) === id)
  if (!item) return
  periodId.value = item.reporting_period_id
  await nextTick()
  if (type === 'realized') realizedPage.value = Math.floor(periodRealized.value.findIndex((entry) => entry.id === id) / perPage) + 1
  else plannedPage.value = Math.floor(periodPlanned.value.findIndex((entry) => entry.id === id) / perPage) + 1
  choose(type, item)
  await nextTick()
  detailsCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function load() {
  try {
    const [periodResponse, realizedResponse, plannedResponse, analysisResponse, countryResponse, unitResponse] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/visiting-researchers/realized'),
      api.get('/api/visiting-researchers/planned'),
      api.get('/api/visiting-researchers/unit-analyses'),
      api.get('/api/countries'),
      api.get('/api/organizational-units'),
    ])
    periods.value = periodResponse.data
    realized.value = realizedResponse.data
    planned.value = plannedResponse.data
    analyses.value = analysisResponse.data
    countries.value = countryResponse.data
    units.value = unitResponse.data
    periodId.value = periods.value[0]?.id ?? null
    await openFromRoute()
  } catch (exception) {
    error.value = apiError(exception, 'Nije moguće dohvatiti gostujuće istraživače.')
  } finally {
    loading.value = false
  }
}

watch(periodId, () => {
  realizedPage.value = 1
  plannedPage.value = 1
  selected.value = null
  cancelEdit()
})
onMounted(load)
onUnmounted(() => { if (snackbarTimer) clearTimeout(snackbarTimer) })
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs"><RouterLink to="/medunarodna-suradnja">Međunarodna suradnja</RouterLink><span>›</span><span>Gostujući istraživači</span></nav>
    <h1>Program međunarodnih gostujućih istraživača</h1>

    <p v-if="loading">Učitavanje...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <template v-else>
      <section class="overview">
        <label>Izvještajno razdoblje<select v-model.number="periodId"><option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option></select></label>
        <strong>Ukupan broj realiziranih gostovanja: {{ periodRealized.length }}</strong>
      </section>

      <section class="records">
        <header class="heading"><h2>Realizirana gostovanja ({{ periodRealized.length }})</h2><RouterLink class="action" :to="{ name: 'new-visiting-researcher', query: { type: 'realized' } }">Dodaj realizirano gostovanje</RouterLink></header>
        <div v-if="periodRealized.length" class="list-grid">
          <div><div class="list"><button v-for="item in shownRealized" :key="item.id" :class="{ selected: selectedType === 'realized' && selected?.id === item.id }" @click="choose('realized', item)"><strong>{{ item.researcher_name }}</strong><span>{{ date(item.arrival_date) }} – {{ date(item.departure_date) }}</span></button></div><div v-if="realizedPages > 1" class="pagination"><button v-for="number in realizedPages" :key="number" :class="{ active: realizedPage === number }" @click="realizedPage = number">{{ number }}</button></div></div>
          <dl v-if="selected && selectedType === 'realized'" ref="detailsCard" class="details"><div class="actions"><button v-if="!form" class="action" @click="startEdit">Uredi</button><template v-else><button class="action" :disabled="saving || deleting" @click="save">{{ saving ? 'Spremanje...' : 'Spremi' }}</button><button class="action" :disabled="saving || deleting" @click="cancelEdit">Odustani</button><button class="square minus" :disabled="saving || deleting" @click="remove">−</button></template></div><p v-if="editError" class="error">{{ editError }}</p><div v-for="field in selectedFields" :key="field.key"><dt>{{ field.label }}</dt><dd><select v-if="form && field.kind === 'country'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name_hr || country.name_en }}</option></select><select v-else-if="form && field.kind === 'unit'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select><textarea v-else-if="form && field.kind === 'textarea'" v-model="form[field.key]" class="input" rows="3"></textarea><input v-else-if="form" v-model="form[field.key]" class="input" :type="field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'" :min="field.kind === 'number' ? 0 : undefined"><template v-else>{{ fieldValue(field) }}</template></dd></div></dl>
        </div><p v-else>Nema realiziranih gostovanja.</p>
      </section>

      <section class="records">
        <header class="heading"><h2>Planirana gostovanja ({{ periodPlanned.length }})</h2><RouterLink class="action" :to="{ name: 'new-visiting-researcher', query: { type: 'planned' } }">Dodaj planirano gostovanje</RouterLink></header>
        <div v-if="periodPlanned.length" class="list-grid">
          <div><div class="list"><button v-for="item in shownPlanned" :key="item.id" :class="{ selected: selectedType === 'planned' && selected?.id === item.id }" @click="choose('planned', item)"><strong>{{ item.researcher_name }}</strong><span>{{ display(item.planned_period) }}</span></button></div><div v-if="plannedPages > 1" class="pagination"><button v-for="number in plannedPages" :key="number" :class="{ active: plannedPage === number }" @click="plannedPage = number">{{ number }}</button></div></div>
          <dl v-if="selected && selectedType === 'planned'" ref="detailsCard" class="details"><div class="actions"><button v-if="!form" class="action" @click="startEdit">Uredi</button><template v-else><button class="action" :disabled="saving || deleting" @click="save">{{ saving ? 'Spremanje...' : 'Spremi' }}</button><button class="action" :disabled="saving || deleting" @click="cancelEdit">Odustani</button><button class="square minus" :disabled="saving || deleting" @click="remove">−</button></template></div><p v-if="editError" class="error">{{ editError }}</p><div v-for="field in selectedFields" :key="field.key"><dt>{{ field.label }}</dt><dd><select v-if="form && field.kind === 'country'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name_hr || country.name_en }}</option></select><select v-else-if="form && field.kind === 'unit'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select><textarea v-else-if="form && field.kind === 'textarea'" v-model="form[field.key]" class="input" rows="3"></textarea><input v-else-if="form" v-model="form[field.key]" class="input"><template v-else>{{ fieldValue(field) }}</template></dd></div></dl>
        </div><p v-else>Nema planiranih gostovanja.</p>
      </section>

      <section class="summary"><h2>Analiza po sastavnicama</h2><div class="table"><table><thead><tr><th>Sastavnica</th><th>Broj gostovanja</th><th>Ukupno dana</th><th>Broj predavanja</th><th>Broj publikacija</th><th>Broj projekata</th></tr></thead><tbody><tr v-for="item in periodAnalyses" :key="item.organizational_unit_id"><td>{{ item.organizational_unit_name || unitName(item.organizational_unit_id) }}</td><td>{{ item.visit_count }}</td><td>{{ item.total_days }}</td><td>{{ item.lecture_count }}</td><td>{{ item.publication_count }}</td><td>{{ item.project_count }}</td></tr><tr v-if="!periodAnalyses.length"><td colspan="6">Nema podataka za odabrano razdoblje.</td></tr></tbody></table></div></section>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.overview,.heading,.actions{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}.breadcrumbs a:hover{color:rgb(var(--v-theme-primary))}h1{margin:18px 0 0;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.65vw,2.35rem);font-weight:400}h2{font-weight:400}.overview,.heading{justify-content:space-between}.overview{margin-top:36px}.overview label{display:grid;gap:8px;color:rgb(var(--v-theme-primary));font-weight:700}select,.input{padding:9px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.records,.summary{margin-top:70px}.action{padding:9px 15px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit;text-decoration:none}.action:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.list-grid{display:grid;grid-template-columns:minmax(360px,.8fr) minmax(570px,1.2fr);gap:clamp(32px,5vw,88px);align-items:start;margin-top:32px}.list{display:grid;gap:5px}.list button{display:grid;gap:5px;padding:13px 16px;border:0;border-radius:7px;background:transparent;color:rgb(var(--v-theme-membership-link));cursor:pointer;text-align:left;font:inherit;line-height:1.45}.list button span{color:rgb(var(--v-theme-muted));font-size:.9rem}.list button:hover,.list button.selected{background:rgba(var(--v-theme-primary),.1)}.pagination{display:flex;justify-content:center;gap:5px;margin-top:20px}.pagination button{width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:rgb(var(--v-theme-primary));cursor:pointer}.pagination button.active{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.details{display:grid;gap:14px;margin:0;padding:clamp(28px,3vw,48px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.details>div:not(.actions){display:grid;grid-template-columns:minmax(190px,.85fr) minmax(0,1.15fr);gap:22px}.details dd{margin:0;overflow-wrap:anywhere;white-space:pre-line}.actions{justify-content:flex-end;gap:8px}.input{width:100%;box-sizing:border-box}.square{display:grid;width:38px;height:38px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-on-surface));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font-size:1.2rem}.minus:hover:not(:disabled){background:rgb(var(--v-theme-error));color:#fff}.action:disabled,.square:disabled{cursor:not-allowed;opacity:.5}.table{overflow-x:auto;border-radius:10px}.table table{width:100%;border-collapse:collapse}.table th,.table td{padding:13px 15px;border:1px solid rgb(var(--v-theme-table-border));text-align:left}.table th{border-color:rgb(var(--v-theme-table-header-border));background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.error{color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:1000px){.list-grid{grid-template-columns:1fr}}@media(max-width:650px){.view{padding:28px 20px}.overview,.heading{align-items:stretch;flex-direction:column;gap:20px}.details>div:not(.actions){grid-template-columns:1fr}}
</style>
