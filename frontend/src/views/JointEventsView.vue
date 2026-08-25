<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'
import CountryAutocomplete from '../components/CountryAutocomplete.vue'
import ExportButton from '../components/ExportButton.vue'
import { currentUser } from '../services/auth.js'

const route = useRoute()
const userId = Number(currentUser.value?.id)
const periods = ref([])
const countries = ref([])
const heldEvents = ref([])
const plannedEvents = ref([])
const periodId = ref(null)
const activeType = ref('')
const activeId = ref(null)
const form = ref(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

const eventTypes = [
  'Međunarodne konferencije',
  'Domaće konferencije',
  'Znanstveni skupovi',
  'Stručni skupovi',
  'Okrugli stolovi',
  'Radionice',
]
const heldFields = [
  { key: 'event_name', label: 'Naziv događanja', required: true },
  { key: 'event_type', label: 'Vrsta događanja', kind: 'type' },
  { key: 'event_date', label: 'Datum', kind: 'date' },
  { key: 'location', label: 'Mjesto održavanja' },
  { key: 'unipu_organizers', label: 'Organizatori s UNIPU-a', kind: 'area' },
  { key: 'partner_organizations', label: 'Partnerske organizacije', kind: 'area' },
  { key: 'partner_country_id', label: 'Država partnera', kind: 'country' },
  { key: 'participant_count', label: 'Broj sudionika', kind: 'integer' },
  { key: 'presentation_count', label: 'Broj izlaganja', kind: 'integer' },
  { key: 'thematic_field', label: 'Tematsko područje' },
  { key: 'program_report_link', label: 'Program / izvješće (poveznica)', kind: 'link' },
  { key: 'media_coverage', label: 'Medijska pokrivenost', kind: 'area' },
  { key: 'cost_eur', label: 'Trošak (€)', kind: 'number' },
  { key: 'notes', label: 'Napomena', kind: 'area' },
]
const plannedFields = [
  { key: 'event_name', label: 'Naziv događanja', required: true },
  { key: 'event_type', label: 'Vrsta događanja', kind: 'type' },
  { key: 'planned_date', label: 'Planirani datum', kind: 'date' },
  { key: 'location', label: 'Mjesto održavanja' },
  { key: 'unipu_organizer', label: 'Organizator s UNIPU-a' },
  { key: 'potential_partners', label: 'Potencijalni partneri', kind: 'area' },
  { key: 'country_id', label: 'Država', kind: 'country' },
  { key: 'expected_participant_count', label: 'Očekivani broj sudionika', kind: 'integer' },
  { key: 'thematic_field', label: 'Tematsko područje' },
  { key: 'preparation_status', label: 'Status pripreme' },
  { key: 'estimated_cost_eur', label: 'Procijenjeni trošak (€)', kind: 'number' },
  { key: 'funding_source', label: 'Izvor financiranja' },
  { key: 'responsible_person', label: 'Odgovorna osoba' },
  { key: 'notes', label: 'Napomena', kind: 'area' },
]
const configs = {
  held: {
    title: 'Održana zajednička događanja',
    source: heldEvents,
    fields: heldFields,
    endpoint: 'held',
  },
  planned: {
    title: 'Planirana zajednička događanja',
    source: plannedEvents,
    fields: plannedFields,
    endpoint: 'planned',
  },
}

const heldRows = computed(() => rows('held'))
const plannedRows = computed(() => rows('planned'))
const metrics = computed(() => ({
  held: heldRows.value.length,
  planned: plannedRows.value.length,
  participants: heldRows.value.reduce((sum, item) => sum + Number(item.participant_count || 0), 0),
  cost: heldRows.value.reduce((sum, item) => sum + Number(item.cost_eur || 0), 0),
}))
const typeAnalysis = computed(() =>
  eventTypes.map((eventType) => {
    const held = heldRows.value.filter((item) => item.event_type === eventType)
    const planned = plannedRows.value.filter((item) => item.event_type === eventType)
    const participants = held.reduce((sum, item) => sum + Number(item.participant_count || 0), 0)
    return {
      eventType,
      held: held.length,
      planned: planned.length,
      participants,
      average: held.length ? Math.round(participants / held.length) : 0,
    }
  }),
)

function rows(type) {
  return configs[type].source.value.filter(
    (item) => Number(item.reporting_period_id) === Number(periodId.value),
  )
}
function selectedItem(type) {
  return activeType.value === type && activeId.value !== 'new'
    ? rows(type).find((item) => item.id === activeId.value) || null
    : null
}
function countryName(id) {
  const item = countries.value.find((country) => Number(country.id) === Number(id))
  return item?.name_hr || item?.name_en || '—'
}
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(date)
}
function formatMoney(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(value)
}
function display(field, value) {
  if (field.kind === 'country') return countryName(value)
  if (field.kind === 'date') return formatDate(value)
  if (field.kind === 'number') return formatMoney(value)
  if (field.kind === 'type') return eventTypes.includes(value) ? value : '—'
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
  activeType.value = type
  activeId.value = 'new'
  form.value = emptyForm(type)
}
function edit(type) {
  const item = rows(type).find((entry) => entry.id === activeId.value)
  if (!item) return
  form.value = Object.fromEntries(
    configs[type].fields.map((field) => [
      field.key,
      field.kind === 'date' ? String(item[field.key] || '').slice(0, 10) : (item[field.key] ?? ''),
    ]),
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
  const data = { updated_by: userId }
  for (const field of configs[type].fields) {
    const value = form.value[field.key]
    data[field.key] = ['country', 'integer', 'number'].includes(field.kind)
      ? optionalNumber(value)
      : field.required
        ? String(value ?? '').trim()
        : optionalText(value)
  }
  return data
}
async function save(type) {
  if (!String(form.value.event_name || '').trim()) {
    error.value = 'Naziv događanja je obavezan.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const data = payload(type)
    const response =
      activeId.value === 'new'
        ? await api.post(`/api/joint-events/${configs[type].endpoint}`, {
            ...data,
            reporting_period_id: periodId.value,
            created_by: userId,
          })
        : await api.patch(`/api/joint-events/${configs[type].endpoint}/${activeId.value}`, data)
    const source = configs[type].source
    const index = source.value.findIndex((item) => item.id === response.data.id)
    if (index >= 0) source.value[index] = response.data
    else source.value.unshift(response.data)
    activeType.value = type
    activeId.value = response.data.id
    form.value = null
    toast('Događanje je uspješno spremljeno.')
  } catch (exception) {
    error.value = apiError(exception, 'Događanje nije moguće spremiti.')
  } finally {
    saving.value = false
  }
}
async function remove(type) {
  const item = rows(type).find((entry) => entry.id === activeId.value)
  if (!item || !confirm('Želite li izbrisati odabrano događanje?')) return
  try {
    await api.delete(`/api/joint-events/${configs[type].endpoint}/${item.id}`)
    configs[type].source.value = configs[type].source.value.filter((entry) => entry.id !== item.id)
    resetSelection()
    toast('Događanje je izbrisano.')
  } catch (exception) {
    error.value = apiError(exception, 'Događanje nije moguće izbrisati.')
  }
}
function selectFromRoute() {
  const type = route.query.type
  const id = Number(route.query.id)
  if (!configs[type] || !id) return
  const item = configs[type].source.value.find((entry) => entry.id === id)
  if (item) {
    periodId.value = item.reporting_period_id
    activeType.value = type
    activeId.value = id
  }
}
async function load() {
  try {
    const responses = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/countries'),
      api.get('/api/joint-events/held'),
      api.get('/api/joint-events/planned'),
    ])
    ;[periods.value, countries.value, heldEvents.value, plannedEvents.value] = responses.map(
      (response) => response.data,
    )
    const routeType = route.query.type
    const routeId = Number(route.query.id)
    const routeItem = configs[routeType]?.source.value.find((entry) => entry.id === routeId)
    periodId.value = routeItem?.reporting_period_id ?? periods.value[0]?.id ?? null
    selectFromRoute()
  } catch (exception) {
    error.value = apiError(exception, 'Podatke o zajedničkim događanjima nije moguće dohvatiti.')
  } finally {
    loading.value = false
  }
}
watch(periodId, (value, previousValue) => {
  if (previousValue !== null) resetSelection()
})
watch(() => route.query, selectFromRoute)
onMounted(load)
</script>

<template>
  <main class="page">
    <nav class="breadcrumbs">
      <RouterLink to="/suradnja-i-dogadanja">Suradnja i događanja</RouterLink><span>›</span
      ><span>Zajednička događanja</span>
    </nav>
    <h1>Evidencija zajedničkih događanja</h1>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!loading">
      <section class="period-row export-row">
        <label
          >Izvještajno razdoblje<select v-model.number="periodId" :disabled="Boolean(form)">
            <option v-for="period in periods" :key="period.id" :value="period.id">
              {{ period.label }}
            </option>
          </select></label
        ><ExportButton
          :records="[
            ...heldRows.map((item) => ({ vrsta_zapisa: 'Održano događanje', ...item })),
            ...plannedRows.map((item) => ({ vrsta_zapisa: 'Planirano događanje', ...item })),
          ]"
          file-name="zajednicka-dogadanja"
        />
      </section>
      <section class="metrics">
        <div>
          <span>Održana događanja</span><strong>{{ metrics.held }}</strong>
        </div>
        <div>
          <span>Planirana događanja</span><strong>{{ metrics.planned }}</strong>
        </div>
        <div>
          <span>Ukupno sudionika</span><strong>{{ metrics.participants }}</strong>
        </div>
        <div>
          <span>Trošak održanih događanja</span><strong>{{ formatMoney(metrics.cost) }}</strong>
        </div>
      </section>

      <section v-for="(config, type) in configs" :key="type" class="data-section">
        <header>
          <h2>{{ config.title }} ({{ rows(type).length }})</h2>
          <button class="add-button" :disabled="Boolean(form) || !periodId" @click="add(type)">
            Dodaj događanje
          </button>
        </header>
        <div v-if="rows(type).length || (activeType === type && form)" class="records-layout">
          <div class="event-list">
            <button
              v-for="item in rows(type)"
              :key="item.id"
              class="event-row"
              :class="{ selected: activeType === type && activeId === item.id }"
              :disabled="Boolean(form)"
              @click="selectRow(type, item.id)"
            >
              {{ item.event_name }}
            </button>
          </div>

          <dl v-if="activeType === type && (form || selectedItem(type))" class="details-card">
            <div class="details-actions">
              <template v-if="form">
                <button :disabled="saving" @click="save(type)">
                  {{ saving ? 'Spremanje...' : 'Spremi' }}
                </button>
                <button :disabled="saving" @click="cancelEdit">Odustani</button>
                <button
                  v-if="activeId !== 'new'"
                  class="square"
                  :disabled="saving"
                  aria-label="Izbriši događanje"
                  title="Izbriši događanje"
                  @click="remove(type)"
                >
                  −
                </button>
              </template>
              <button v-else @click="edit(type)">Uredi</button>
            </div>
            <div>
              <dt>Broj</dt>
              <dd>{{ activeId === 'new' ? 'Novi' : selectedItem(type).id }}</dd>
            </div>
            <div v-for="field in config.fields" :key="field.key">
              <dt>{{ field.label }}</dt>
              <dd>
                <template v-if="form">
                  <div v-if="field.kind === 'country'" class="country-control">
                    <CountryAutocomplete
                      v-model="form[field.key]"
                      :countries="countries"
                      placeholder="Odaberite"
                    />
                  </div>
                  <select
                    v-else-if="field.kind === 'type'"
                    v-model="form[field.key]"
                    class="detail-input"
                  >
                    <option value="">Odaberite</option>
                    <option v-for="eventType in eventTypes" :key="eventType" :value="eventType">
                      {{ eventType }}
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
                    :type="
                      field.kind === 'date'
                        ? 'date'
                        : ['integer', 'number'].includes(field.kind)
                          ? 'number'
                          : 'text'
                    "
                    :step="field.kind === 'number' ? '0.01' : undefined"
                    :min="['integer', 'number'].includes(field.kind) ? 0 : undefined"
                  />
                </template>
                <a
                  v-else-if="field.kind === 'link' && selectedItem(type)[field.key]"
                  :href="selectedItem(type)[field.key]"
                  target="_blank"
                  rel="noopener"
                  >{{ selectedItem(type)[field.key] }}</a
                >
                <template v-else>{{ display(field, selectedItem(type)[field.key]) }}</template>
              </dd>
            </div>
          </dl>
          <div v-else class="selection-hint">Odaberite događanje za prikaz detalja.</div>
        </div>
        <p v-else class="empty">Nema zapisa za odabrano izvještajno razdoblje.</p>
      </section>

      <section class="analysis">
        <h2>Analiza prema vrsti događanja</h2>
        <div class="analysis-wrap">
          <table>
            <thead>
              <tr>
                <th>Vrsta događanja</th>
                <th>Održano</th>
                <th>Planirano</th>
                <th>Ukupno sudionika</th>
                <th>Prosječno sudionika</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in typeAnalysis" :key="item.eventType">
                <td>{{ item.eventType }}</td>
                <td>{{ item.held }}</td>
                <td>{{ item.planned }}</td>
                <td>{{ item.participants }}</td>
                <td>{{ item.average }}</td>
              </tr>
              <tr class="total">
                <td>Ukupno</td>
                <td>{{ metrics.held }}</td>
                <td>{{ metrics.planned }}</td>
                <td>{{ metrics.participants }}</td>
                <td>{{ metrics.held ? Math.round(metrics.participants / metrics.held) : 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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
.period-row {
  margin-top: 34px;
}
.period-row label {
  display: grid;
  width: 280px;
  gap: 7px;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
button,
select,
input,
textarea {
  box-sizing: border-box;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
}
.period-row select,
button {
  min-height: 40px;
  padding: 8px 12px;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px;
  margin-top: 38px;
}
.metrics div {
  display: grid;
  gap: 7px;
}
.metrics span {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.metrics strong {
  font-size: 1.3rem;
}
.data-section {
  margin-top: 62px;
}
.data-section header {
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}
.data-section h2,
.analysis h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 400;
}
.add-button {
  min-width: 150px;
}
.records-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(520px, 1.1fr);
  gap: clamp(44px, 8vw, 150px);
  align-items: start;
  margin-top: 34px;
}
.event-list {
  display: grid;
  grid-template-rows: repeat(5, auto);
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  width: calc(100% + clamp(24px, 4vw, 64px));
  column-gap: clamp(32px, 4vw, 64px);
  gap: 4px;
}
.event-row {
  display: grid;
  width: 100%;
  min-height: 0;
  padding: 14px 18px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--v-theme-membership-link));
  font-size: clamp(1rem, 1.05vw, 1.35rem);
  text-align: left;
  transition:
    color 160ms ease,
    background-color 160ms ease;
}
.event-row:hover,
.event-row.selected {
  background: rgba(var(--v-theme-primary), 0.1);
}
.event-row.selected {
  color: rgb(var(--v-theme-on-background));
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
  grid-template-columns: minmax(190px, 0.85fr) minmax(0, 1.15fr);
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
.details-card a {
  color: rgb(var(--v-theme-evidence-link));
  text-decoration: none;
}
.details-card a:hover {
  opacity: 0.72;
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
.selection-hint,
.empty {
  padding: 38px;
  text-align: center;
  color: rgb(var(--v-theme-muted));
}
.analysis {
  margin-top: 70px;
}
.analysis-wrap {
  max-width: 950px;
  margin-top: 18px;
  overflow: hidden;
  border-radius: 10px;
}
.analysis table {
  width: 100%;
  border-collapse: collapse;
}
.analysis th,
.analysis td {
  padding: 11px 10px;
  border: 1px solid rgb(var(--v-theme-table-border));
  text-align: center;
}
.analysis th {
  border-color: rgb(var(--v-theme-table-header-border));
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
  font-size: 0.76rem;
}
.analysis td:first-child,
.analysis th:first-child {
  text-align: left;
}
.analysis .total {
  font-weight: 700;
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
  .event-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: none;
    grid-auto-flow: row;
    width: 100%;
  }
}
@media (max-width: 850px) {
  .metrics {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 600px) {
  .page {
    padding: 28px 20px 56px;
  }
  .metrics,
  .event-list {
    grid-template-columns: 1fr;
  }
  .period-row label {
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

<style scoped>
.country-control {
  width: 100%;
  min-width: 0;
}
</style>
