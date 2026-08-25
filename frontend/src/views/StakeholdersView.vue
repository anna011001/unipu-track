<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../services/api.js'
import ExportButton from '../components/ExportButton.vue'
import { currentUser } from '../services/auth.js'

const userId = Number(currentUser.value?.id)
const analyses = ref([])
const units = ref([])
const countries = ref([])
const summaries = ref([])
const science = ref([])
const artistic = ref([])
const professional = ref([])
const analysisId = ref(null)
const analysisForm = ref(null)
const analysisMode = ref('')
const selectedType = ref('science')
const activeType = ref('')
const activeId = ref(null)
const form = ref(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

const academicFields = [
  { key: 'organization_name', label: 'Naziv organizacije', required: true },
  { key: 'stakeholder_type', label: 'Vrsta organizacije' },
  { key: 'country_id', label: 'Država', kind: 'country' },
  { key: 'scientific_field', label: 'Područje djelovanja' },
  { key: 'contact_name', label: 'Kontakt osoba' },
  { key: 'contact_email', label: 'E-mail', kind: 'email' },
  { key: 'existing_cooperation', label: 'Povezanost s UNIPU-om', kind: 'boolean' },
  { key: 'cooperation_type', label: 'Vrsta suradnje' },
  { key: 'cooperation_potential', label: 'Potencijal suradnje', kind: 'area' },
  { key: 'priority', label: 'Prioritet (1–5)', kind: 'priority' },
  { key: 'planned_new_cooperation', label: 'Planirana nova suradnja', kind: 'boolean' },
  { key: 'planned_activities', label: 'Planirane aktivnosti', kind: 'area' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Napomena', kind: 'area' },
]
const professionalFields = [
  { key: 'organization_name', label: 'Naziv organizacije', required: true },
  { key: 'organization_kind', label: 'Vrsta organizacije' },
  { key: 'country_id', label: 'Država', kind: 'country' },
  { key: 'activity_field', label: 'Područje djelovanja' },
  { key: 'contact_name', label: 'Kontakt osoba' },
  { key: 'contact_email', label: 'E-mail', kind: 'email' },
  { key: 'unipu_membership', label: 'Povezanost s UNIPU-om', kind: 'boolean' },
  { key: 'cooperation_type', label: 'Vrsta suradnje' },
  { key: 'cooperation_potential', label: 'Potencijal', kind: 'area' },
  { key: 'priority', label: 'Prioritet (1–5)', kind: 'priority' },
  { key: 'planned_new_cooperation', label: 'Planirana nova suradnja', kind: 'boolean' },
  { key: 'planned_activities', label: 'Planirane aktivnosti', kind: 'area' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Napomena', kind: 'area' },
]
const configs = {
  science: { title: 'Znanstveno područje', source: science, fields: academicFields },
  artistic: { title: 'Umjetničko područje', source: artistic, fields: academicFields },
  professional: { title: 'Strukovno područje', source: professional, fields: professionalFields },
}

const selectedAnalysis = computed(
  () => analyses.value.find((item) => Number(item.id) === Number(analysisId.value)) || null,
)
const selectedConfig = computed(() => configs[selectedType.value])
const selectedItem = computed(() =>
  activeType.value === selectedType.value && activeId.value !== 'new'
    ? rows(selectedType.value).find((item) => item.id === activeId.value) || null
    : null,
)
const summary = computed(() => {
  const scienceRows = rows('science')
  const artisticRows = rows('artistic')
  const professionalRows = rows('professional')
  const all = [...scienceRows, ...artisticRows, ...professionalRows]
  return {
    science: scienceRows.length,
    artistic: artisticRows.length,
    professional: professionalRows.length,
    total: all.length,
    existing: [...scienceRows, ...artisticRows].filter((item) => item.existing_cooperation === true)
      .length,
    highPotential: all.filter((item) => [1, 2].includes(Number(item.priority))).length,
    planned: all.filter((item) => item.planned_new_cooperation === true).length,
  }
})

function rows(type) {
  return configs[type].source.value.filter(
    (item) => Number(item.stakeholder_analysis_id) === Number(analysisId.value),
  )
}
function unitName(id) {
  const item = units.value.find((unit) => Number(unit.id) === Number(id))
  return item?.short_name || item?.name || 'Sveučilište'
}
function countryName(id) {
  const item = countries.value.find((country) => Number(country.id) === Number(id))
  return item?.name_hr || item?.name_en || '—'
}
function formatDate(value) {
  if (!value) return 'Bez datuma'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(date)
}
function analysisLabel(item) {
  return `${formatDate(item.analysis_date)} · ${unitName(item.organizational_unit_id)}`
}
function display(field, value) {
  if (field.kind === 'country') return countryName(value)
  if (field.kind === 'boolean') return value === true ? 'Da' : value === false ? 'Ne' : '—'
  return value === null || value === undefined || value === '' ? '—' : value
}
function optionalText(value) {
  return String(value ?? '').trim() || null
}
function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}
function apiError(exception, fallback) {
  const errors = exception.response?.data?.errors
  return Array.isArray(errors) ? errors.join(' ') : exception.response?.data?.message || fallback
}
function toast(message) {
  success.value = message
  setTimeout(() => {
    success.value = ''
  }, 3500)
}

function newAnalysis() {
  analysisMode.value = 'new'
  analysisForm.value = {
    analysis_date: new Date().toISOString().slice(0, 10),
    organizational_unit_id: '',
    responsible_person: '',
  }
}
function editAnalysis() {
  if (!selectedAnalysis.value) return
  analysisMode.value = 'edit'
  analysisForm.value = {
    analysis_date: String(selectedAnalysis.value.analysis_date || '').slice(0, 10),
    organizational_unit_id: selectedAnalysis.value.organizational_unit_id ?? '',
    responsible_person: selectedAnalysis.value.responsible_person ?? '',
  }
}
function cancelAnalysis() {
  analysisMode.value = ''
  analysisForm.value = null
}
async function saveAnalysis() {
  saving.value = true
  error.value = ''
  const payload = {
    analysis_date: analysisForm.value.analysis_date || null,
    organizational_unit_id: optionalNumber(analysisForm.value.organizational_unit_id),
    responsible_person: optionalText(analysisForm.value.responsible_person),
    updated_by: userId,
  }
  try {
    const response =
      analysisMode.value === 'new'
        ? await api.post('/api/stakeholders/analyses', { ...payload, created_by: userId })
        : await api.patch(`/api/stakeholders/analyses/${analysisId.value}`, payload)
    const updated = { ...response.data }
    const index = analyses.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) analyses.value[index] = updated
    else analyses.value.unshift(updated)
    analysisId.value = updated.id
    cancelAnalysis()
    toast('Analiza dionika uspješno je spremljena.')
  } catch (exception) {
    error.value = apiError(exception, 'Analizu nije moguće spremiti.')
  } finally {
    saving.value = false
  }
}
async function deleteAnalysis() {
  if (!selectedAnalysis.value || !confirm('Želite li izbrisati analizu i sve povezane dionike?'))
    return
  try {
    const id = selectedAnalysis.value.id
    await api.delete(`/api/stakeholders/analyses/${id}`)
    analyses.value = analyses.value.filter((item) => item.id !== id)
    for (const config of Object.values(configs))
      config.source.value = config.source.value.filter(
        (item) => Number(item.stakeholder_analysis_id) !== Number(id),
      )
    summaries.value = summaries.value.filter(
      (item) => Number(item.stakeholder_analysis_id) !== Number(id),
    )
    analysisId.value = analyses.value[0]?.id ?? null
    toast('Analiza je izbrisana.')
  } catch (exception) {
    error.value = apiError(exception, 'Analizu nije moguće izbrisati.')
  }
}

function emptyForm(type) {
  return Object.fromEntries(configs[type].fields.map((field) => [field.key, '']))
}
function selectRow(type, id) {
  if (form.value) return
  activeType.value = type
  activeId.value = id
  error.value = ''
}
function add(type) {
  if (!analysisId.value) return
  activeType.value = type
  activeId.value = 'new'
  form.value = { ...emptyForm(type), planned_new_cooperation: false }
}
function edit(type) {
  const item = rows(type).find((entry) => entry.id === activeId.value)
  if (!item) return
  form.value = Object.fromEntries(
    configs[type].fields.map((field) => [field.key, item[field.key] ?? '']),
  )
}
function cancelEdit() {
  form.value = null
}
function resetSelection() {
  activeType.value = ''
  activeId.value = null
  form.value = null
}
function payload(type) {
  const result = { updated_by: userId }
  for (const field of configs[type].fields) {
    const value = form.value[field.key]
    if (['country', 'priority'].includes(field.kind)) result[field.key] = optionalNumber(value)
    else if (field.kind === 'boolean')
      result[field.key] = value === '' ? null : value === true || value === 'true'
    else result[field.key] = field.required ? String(value ?? '').trim() : optionalText(value)
  }
  return result
}
async function syncSummary() {
  if (!analysisId.value) return
  const current = summaries.value.find(
    (item) => Number(item.stakeholder_analysis_id) === Number(analysisId.value),
  )
  const values = summary.value
  const data = {
    science_stakeholder_count: values.science,
    art_stakeholder_count: values.artistic,
    profession_stakeholder_count: values.professional,
    total_stakeholder_count: values.total,
    existing_cooperation_count: values.existing,
    high_potential_count: values.highPotential,
    planned_new_cooperation_count: values.planned,
    updated_by: userId,
  }
  try {
    const response = current
      ? await api.patch(`/api/stakeholders/summaries/${current.id}`, data)
      : await api.post('/api/stakeholders/summaries', {
          ...data,
          stakeholder_analysis_id: analysisId.value,
          created_by: userId,
        })
    const index = summaries.value.findIndex((item) => item.id === response.data.id)
    if (index >= 0) summaries.value[index] = response.data
    else summaries.value.push(response.data)
  } catch {
    return undefined
  }
}
async function save(type) {
  if (!String(form.value.organization_name || '').trim()) {
    error.value = 'Naziv organizacije je obavezan.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const data = payload(type)
    const response =
      activeId.value === 'new'
        ? await api.post(`/api/stakeholders/${type}`, {
            ...data,
            stakeholder_analysis_id: analysisId.value,
            created_by: userId,
          })
        : await api.patch(`/api/stakeholders/${type}/${activeId.value}`, data)
    const source = configs[type].source
    const updated = { ...response.data }
    const index = source.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) source.value[index] = updated
    else source.value.push(updated)
    activeType.value = type
    activeId.value = updated.id
    form.value = null
    await syncSummary()
    toast('Dionik uspješno je spremljen.')
  } catch (exception) {
    error.value = apiError(exception, 'Dionika nije moguće spremiti.')
  } finally {
    saving.value = false
  }
}
async function remove(type) {
  const item = rows(type).find((entry) => entry.id === activeId.value)
  if (!item || !confirm('Želite li izbrisati odabranog dionika?')) return
  try {
    await api.delete(`/api/stakeholders/${type}/${item.id}`)
    configs[type].source.value = configs[type].source.value.filter((entry) => entry.id !== item.id)
    resetSelection()
    await syncSummary()
    toast('Dionik je izbrisan.')
  } catch (exception) {
    error.value = apiError(exception, 'Dionika nije moguće izbrisati.')
  }
}

async function load() {
  try {
    const responses = await Promise.all([
      api.get('/api/stakeholders/analyses'),
      api.get('/api/stakeholders/science'),
      api.get('/api/stakeholders/artistic'),
      api.get('/api/stakeholders/professional'),
      api.get('/api/stakeholders/summaries'),
      api.get('/api/organizational-units'),
      api.get('/api/countries'),
    ])
    ;[
      analyses.value,
      science.value,
      artistic.value,
      professional.value,
      summaries.value,
      units.value,
      countries.value,
    ] = responses.map((response) => response.data)
    analysisId.value = analyses.value[0]?.id ?? null
  } catch (exception) {
    error.value = apiError(exception, 'Podatke o dionicima nije moguće dohvatiti.')
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(analysisId, (value, previousValue) => {
  if (previousValue !== null) resetSelection()
})
watch(selectedType, resetSelection)
</script>

<template>
  <main class="page">
    <nav class="breadcrumbs">
      <RouterLink to="/suradnja-i-dogadanja">Suradnja i događanja</RouterLink><span>›</span
      ><span>Dionici</span>
    </nav>
    <h1>Analiza mapiranja ključnih dionika</h1>
    <p class="description">Znanost, umjetničko područje i strukovne organizacije</p>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!loading">
      <section class="topbar">
        <label
          >Analiza<select v-model.number="analysisId" :disabled="Boolean(analysisForm)">
            <option v-for="item in analyses" :key="item.id" :value="item.id">
              {{ analysisLabel(item) }}
            </option>
          </select></label
        >
        <div class="top-actions">
          <ExportButton
            :records="[
              ...rows('science').map((item) => ({ podrucje: 'Znanstveno', ...item })),
              ...rows('artistic').map((item) => ({ podrucje: 'Umjetničko', ...item })),
              ...rows('professional').map((item) => ({ podrucje: 'Strukovno', ...item })),
            ]"
            file-name="kljucni-dionici"
          /><button v-if="!analysisForm" @click="newAnalysis">Nova analiza</button
          ><button v-if="selectedAnalysis && !analysisForm" @click="editAnalysis">
            Uredi analizu</button
          ><button v-if="selectedAnalysis && !analysisForm" @click="deleteAnalysis">
            Izbriši analizu
          </button>
        </div>
      </section>

      <section v-if="analysisForm" class="analysis-form">
        <label
          >Datum izrade analize<input v-model="analysisForm.analysis_date" type="date"
        /></label>
        <label
          >Sastavnica/Sveučilište<select v-model="analysisForm.organizational_unit_id">
            <option value="">Sveučilište</option>
            <option v-for="unit in units" :key="unit.id" :value="unit.id">
              {{ unit.short_name || unit.name }}
            </option>
          </select></label
        >
        <label>Odgovorna osoba<input v-model="analysisForm.responsible_person" /></label>
        <div>
          <button :disabled="saving" @click="saveAnalysis">Spremi</button
          ><button @click="cancelAnalysis">Odustani</button>
        </div>
      </section>

      <template v-if="selectedAnalysis">
        <section class="metadata">
          <div>
            <span>Datum izrade analize</span
            ><strong>{{ formatDate(selectedAnalysis.analysis_date) }}</strong>
          </div>
          <div>
            <span>Sastavnica/Sveučilište</span
            ><strong>{{ unitName(selectedAnalysis.organizational_unit_id) }}</strong>
          </div>
          <div>
            <span>Odgovorna osoba</span
            ><strong>{{ selectedAnalysis.responsible_person || '—' }}</strong>
          </div>
        </section>

        <section class="data-section">
          <div class="area-selector">
            <label
              >Područje dionika<select v-model="selectedType" :disabled="Boolean(form)">
                <option v-for="(config, type) in configs" :key="type" :value="type">
                  {{ config.title }}
                </option>
              </select></label
            >
          </div>
          <header>
            <h2>{{ selectedConfig.title }} ({{ rows(selectedType).length }})</h2>
            <button class="add-button" :disabled="Boolean(form)" @click="add(selectedType)">
              Dodaj dionika
            </button>
          </header>

          <div v-if="rows(selectedType).length || form" class="records-layout">
            <div class="stakeholder-list">
              <button
                v-for="item in rows(selectedType)"
                :key="item.id"
                class="stakeholder-row"
                :class="{ selected: activeType === selectedType && activeId === item.id }"
                :disabled="Boolean(form)"
                @click="selectRow(selectedType, item.id)"
              >
                {{ item.organization_name }}
              </button>
            </div>

            <dl v-if="form || selectedItem" class="details-card">
              <div class="details-actions">
                <template v-if="form">
                  <button :disabled="saving" @click="save(selectedType)">
                    {{ saving ? 'Spremanje...' : 'Spremi' }}
                  </button>
                  <button :disabled="saving" @click="cancelEdit">Odustani</button>
                  <button
                    v-if="activeId !== 'new'"
                    class="square"
                    :disabled="saving"
                    aria-label="Izbriši dionika"
                    title="Izbriši dionika"
                    @click="remove(selectedType)"
                  >
                    −
                  </button>
                </template>
                <button v-else @click="edit(selectedType)">Uredi</button>
              </div>
              <div>
                <dt>Broj</dt>
                <dd>{{ activeId === 'new' ? 'Novi' : selectedItem.id }}</dd>
              </div>
              <div v-for="field in selectedConfig.fields" :key="field.key">
                <dt>{{ field.label }}</dt>
                <dd>
                  <template v-if="form">
                    <CountryAutocomplete
                      v-if="field.kind === 'country'"
                      v-model="form[field.key]"
                      :countries="countries"
                      class="detail-input"
                      placeholder="Odaberite"
                    />
                    <input
                      v-else-if="field.kind === 'boolean'"
                      v-model="form[field.key]"
                      class="boolean-checkbox"
                      type="checkbox"
                    />
                    <select
                      v-else-if="field.kind === 'priority'"
                      v-model="form[field.key]"
                      class="detail-input"
                    >
                      <option value="">—</option>
                      <option v-for="priority in 5" :key="priority" :value="priority">
                        {{ priority }}
                      </option>
                    </select>
                    <textarea
                      v-else-if="field.kind === 'area'"
                      v-model="form[field.key]"
                      class="detail-input"
                      rows="2"
                    ></textarea>
                    <input
                      v-else
                      v-model="form[field.key]"
                      class="detail-input"
                      :type="field.kind === 'email' ? 'email' : 'text'"
                    />
                  </template>
                  <input
                    v-else-if="field.kind === 'boolean'"
                    class="boolean-checkbox"
                    type="checkbox"
                    :checked="selectedItem[field.key] === true"
                    disabled
                  />
                  <template v-else>{{ display(field, selectedItem[field.key]) }}</template>
                </dd>
              </div>
            </dl>
            <div v-else class="selection-hint">Odaberite organizaciju za prikaz detalja.</div>
          </div>
          <p v-else class="empty">Nema zapisa za odabrano područje.</p>
        </section>

        <section class="summary">
          <h2>Sažetak analize dionika</h2>
          <div class="summary-grid">
            <div>
              <span>Dionici – znanost</span><strong>{{ summary.science }}</strong>
            </div>
            <div>
              <span>Dionici – umjetnost</span><strong>{{ summary.artistic }}</strong>
            </div>
            <div>
              <span>Dionici – struka</span><strong>{{ summary.professional }}</strong>
            </div>
            <div>
              <span>Ukupno dionika</span><strong>{{ summary.total }}</strong>
            </div>
            <div>
              <span>S postojećom suradnjom</span><strong>{{ summary.existing }}</strong>
            </div>
            <div>
              <span>Visoki potencijal (prioritet 1–2)</span
              ><strong>{{ summary.highPotential }}</strong>
            </div>
            <div>
              <span>Planirane nove suradnje</span><strong>{{ summary.planned }}</strong>
            </div>
          </div>
        </section>
      </template>
      <section v-else-if="!analysisForm" class="empty-state">
        <p>Još nema izrađene analize dionika.</p>
        <button @click="newAnalysis">Kreiraj analizu</button>
      </section>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.page {
  min-height: calc(100vh - 112px);
  padding: 34px clamp(24px, 5vw, 110px) 90px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}
.breadcrumbs,
.topbar,
.top-actions,
.data-section header {
  display: flex;
  align-items: center;
}
.breadcrumbs {
  gap: 10px;
  color: rgb(var(--v-theme-muted));
}
.breadcrumbs a {
  color: inherit;
  text-decoration: none;
}
h1 {
  margin: 18px 0 4px;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(1.6rem, 2vw, 2.8rem);
  font-weight: 400;
}
.description {
  margin: 0;
  color: rgb(var(--v-theme-muted));
}
.topbar {
  justify-content: space-between;
  gap: 20px;
  margin-top: 34px;
}
.topbar label,
.analysis-form label,
.area-selector label {
  display: grid;
  gap: 7px;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.topbar select,
.area-selector select {
  width: 280px;
}
.top-actions {
  display: flex;
  gap: 7px;
}
button,
.topbar select,
.area-selector select,
.analysis-form input,
.analysis-form select {
  box-sizing: border-box;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.analysis-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 26px;
  padding: 24px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
}
.analysis-form > div {
  display: flex;
  align-items: end;
  gap: 7px;
}
.metadata,
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  margin-top: 34px;
}
.metadata div,
.summary-grid div {
  display: grid;
  gap: 7px;
}
.metadata span,
.summary-grid span {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.data-section {
  margin-top: 60px;
}
.area-selector {
  margin-bottom: 26px;
}
.data-section header {
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}
.data-section h2,
.summary h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 400;
}
.add-button {
  min-width: 130px;
}
.records-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(520px, 1.1fr);
  gap: clamp(44px, 8vw, 150px);
  align-items: start;
  margin-top: 34px;
}
.stakeholder-list {
  display: grid;
  grid-template-rows: repeat(5, auto);
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  width: calc(100% + clamp(24px, 4vw, 64px));
  column-gap: clamp(32px, 4vw, 64px);
  gap: 4px;
}
.stakeholder-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  width: 100%;
  min-height: 0;
  padding: 14px 18px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--v-theme-membership-link));
  cursor: pointer;
  font: inherit;
  font-size: clamp(1rem, 1.05vw, 1.35rem);
  text-align: left;
  transition:
    color 160ms ease,
    background-color 160ms ease;
}
.stakeholder-row:hover,
.stakeholder-row.selected {
  background: rgba(var(--v-theme-primary), 0.1);
}
.stakeholder-row.selected {
  color: rgb(var(--v-theme-on-background));
}
.stakeholder-row:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
.details-card {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: clamp(26px, 3vw, 46px);
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
}
.details-card > div {
  display: grid;
  grid-template-columns: minmax(175px, 0.85fr) minmax(0, 1.15fr);
  gap: 24px;
}
.details-card .details-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-bottom: 8px;
}
.details-card dt {
  font-weight: 500;
}
.details-card dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.square {
  width: 40px;
  padding: 0;
}
.detail-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgb(var(--v-theme-on-category-card));
  border-radius: 6px;
  outline: none;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
}
.detail-input:focus {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-on-category-card), 0.18);
}
textarea.detail-input {
  resize: vertical;
}
.boolean-checkbox {
  width: 18px;
  height: 18px;
  margin: 4px 0;
  accent-color: rgb(var(--v-theme-primary));
  cursor: pointer;
}
.boolean-checkbox:disabled {
  cursor: default;
  opacity: 1;
}
.selection-hint,
.empty {
  padding: 38px;
  text-align: center;
  color: rgb(var(--v-theme-muted));
}
.summary {
  margin-top: 62px;
}
.summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 24px;
}
.summary-grid strong {
  font-size: 1.35rem;
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 34px;
  padding: 24px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
}
.error {
  color: rgb(var(--v-theme-error));
}
.snackbar {
  position: fixed;
  right: 28px;
  bottom: 28px;
  padding: 14px 18px;
  border: 1px solid #62a957;
  border-radius: 7px;
  background: #b8f5ae;
  color: #1f5525;
}
@media (max-width: 1000px) {
  .records-layout {
    grid-template-columns: 1fr;
  }
  .stakeholder-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: none;
    grid-auto-flow: row;
    width: 100%;
  }
}
@media (max-width: 850px) {
  .analysis-form,
  .metadata,
  .summary-grid {
    grid-template-columns: 1fr 1fr;
  }
  .topbar {
    align-items: stretch;
    flex-direction: column;
  }
  .top-actions {
    flex-wrap: wrap;
  }
}
@media (max-width: 600px) {
  .page {
    padding: 28px 20px 56px;
  }
  .analysis-form,
  .metadata,
  .summary-grid,
  .stakeholder-list {
    grid-template-columns: 1fr;
  }
  .topbar select,
  .area-selector select {
    width: 100%;
  }
  .data-section header {
    align-items: stretch;
    flex-direction: column;
  }
  .details-card > div {
    grid-template-columns: 1fr;
    gap: 5px;
  }
}
</style>
