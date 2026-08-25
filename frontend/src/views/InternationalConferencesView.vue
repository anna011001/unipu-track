<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'
import ExportButton from '../components/ExportButton.vue'
import { currentUser } from '../services/auth.js'

const route = useRoute()
const userId = Number(currentUser.value?.id)
const perPage = 10
const periods = ref([])
const conferences = ref([])
const details = ref([])
const statistics = ref([])
const units = ref([])
const countries = ref([])
const periodId = ref(null)
const selected = ref(null)
const form = ref(null)
const page = ref(1)
const detailsCard = ref(null)
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')
const editError = ref('')
const success = ref('')
let snackbarTimer = null

const mainFields = [
  { key: 'conference_name', label: 'Naziv konferencije', required: true },
  { key: 'held_on', label: 'Datum održavanja', kind: 'date' },
  { key: 'location', label: 'Mjesto' },
  { key: 'organizer_unit_id', label: 'Organizator (sastavnica)', kind: 'unit' },
  { key: 'coorganizers', label: 'Suorganizatori', kind: 'textarea' },
  { key: 'scientific_field', label: 'Znanstveno područje' },
  { key: 'total_participants', label: 'Ukupan broj sudionika', kind: 'number' },
  { key: 'foreign_participants', label: 'Broj stranih sudionika', kind: 'number' },
  { key: 'country_count', label: 'Broj država', kind: 'number' },
  { key: 'presentation_count', label: 'Broj izlaganja', kind: 'number' },
  { key: 'published_paper_count', label: 'Broj objavljenih radova', kind: 'number' },
  { key: 'web_or_proceedings_link', label: 'Link na web / zbornik', kind: 'link' },
  { key: 'notes', label: 'Napomena', kind: 'textarea' },
]

const detailFields = [
  { key: 'english_name', label: 'Puni naziv na engleskom' },
  { key: 'organizing_committee_chair', label: 'Predsjednik organizacijskog odbora' },
  { key: 'program_committee_chair', label: 'Predsjednik programskog odbora' },
  { key: 'unipu_program_members', label: 'Članovi programskog odbora – UNIPU', kind: 'textarea' },
  { key: 'foreign_program_members', label: 'Strani članovi programskog odbora', kind: 'textarea' },
  { key: 'submitted_abstract_count', label: 'Broj prijavljenih sažetaka', kind: 'number' },
  { key: 'accepted_abstract_count', label: 'Broj prihvaćenih sažetaka', kind: 'number' },
  { key: 'plenary_lecture_count', label: 'Broj plenarnih predavanja', kind: 'number' },
  { key: 'section_count', label: 'Broj sekcija', kind: 'number' },
  { key: 'proceedings_indexing', label: 'Indeksacija zbornika' },
  { key: 'conference_website', label: 'Web stranica konferencije', kind: 'link' },
  { key: 'media_coverage', label: 'Medijska pokrivenost', kind: 'textarea' },
  { key: 'organization_cost_eur', label: 'Ukupni troškovi organizacije', kind: 'money' },
  { key: 'funding_sources', label: 'Izvori financiranja', kind: 'textarea' },
]

const filtered = computed(() =>
  conferences.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)),
)
const pageCount = computed(() => Math.ceil(filtered.value.length / perPage))
const shown = computed(() => filtered.value.slice((page.value - 1) * perPage, page.value * perPage))
const selectedDetail = computed(
  () =>
    details.value.find((item) => Number(item.conference_id) === Number(selected.value?.id)) || null,
)
const selectedStatistics = computed(() =>
  statistics.value.filter((item) => Number(item.conference_id) === Number(selected.value?.id)),
)

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
function money(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(Number(value))
}
function unitName(id) {
  const item = units.value.find((unit) => Number(unit.id) === Number(id))
  return item?.short_name || item?.name || '—'
}
function safeLink(value) {
  if (!value) return null
  try {
    const link = new URL(value)
    return ['http:', 'https:'].includes(link.protocol) ? link.href : null
  } catch {
    return null
  }
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
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => {
    success.value = ''
  }, 4000)
}
function detailValue(field) {
  const value = selectedDetail.value?.[field.key]
  if (field.kind === 'money') return money(value)
  return display(value)
}
function mainValue(field) {
  const value = selected.value?.[field.key]
  if (field.kind === 'date') return date(value)
  if (field.kind === 'unit') return unitName(value)
  return display(value)
}

function choose(item) {
  selected.value = item
  form.value = null
  editError.value = ''
}

function blankDetail() {
  return Object.fromEntries(detailFields.map((field) => [field.key, '']))
}

function startEdit() {
  form.value = {
    main: Object.fromEntries(
      mainFields.map((field) => [
        field.key,
        field.kind === 'date'
          ? dateInput(selected.value[field.key])
          : (selected.value[field.key] ?? ''),
      ]),
    ),
    detail: { ...blankDetail(), ...(selectedDetail.value || {}) },
    statistics: selectedStatistics.value.map((item) => ({ ...item })),
    deletedStatisticIds: [],
  }
}

function cancelEdit() {
  form.value = null
  editError.value = ''
}

function addStatistic() {
  form.value.statistics.push({
    temporaryId: crypto.randomUUID(),
    country_id: '',
    country_name: '',
    participant_count: '',
    presentation_count: '',
    share_percent: '',
  })
}

function updateCountryName(row) {
  const country = countries.value.find((item) => Number(item.id) === Number(row.country_id))
  if (country) row.country_name = country.name_hr || country.name_en
}

function removeStatistic(row) {
  if (row.id) form.value.deletedStatisticIds.push(row.id)
  form.value.statistics = form.value.statistics.filter((item) => item !== row)
}

function mainPayload() {
  const payload = { updated_by: userId }
  for (const field of mainFields) {
    const value = form.value.main[field.key]
    if (field.required) payload[field.key] = String(value ?? '').trim()
    else if (field.kind === 'number' || field.kind === 'unit')
      payload[field.key] = optionalNumber(value)
    else if (field.kind === 'date') payload[field.key] = value || null
    else payload[field.key] = optionalText(value)
  }
  return payload
}

function detailPayload() {
  const payload = { updated_by: userId }
  for (const field of detailFields) {
    const value = form.value.detail[field.key]
    payload[field.key] =
      field.kind === 'number' || field.kind === 'money'
        ? optionalNumber(value)
        : optionalText(value)
  }
  return payload
}

async function refreshRelated() {
  const [detailResponse, statisticResponse] = await Promise.all([
    api.get('/api/international-conferences/details/all'),
    api.get('/api/international-conferences/countries/all'),
  ])
  details.value = detailResponse.data
  statistics.value = statisticResponse.data
}

async function save() {
  editError.value = ''
  if (!String(form.value.main.conference_name ?? '').trim()) {
    editError.value = 'Naziv konferencije je obavezan.'
    return
  }
  if (form.value.statistics.some((item) => !String(item.country_name ?? '').trim())) {
    editError.value = 'Država je obavezna za svaki redak strukture sudionika.'
    return
  }
  saving.value = true
  try {
    const response = await api.patch(
      `/api/international-conferences/${selected.value.id}`,
      mainPayload(),
    )
    const detailBody = detailPayload()
    if (selectedDetail.value)
      await api.patch(
        `/api/international-conferences/details/${selectedDetail.value.id}`,
        detailBody,
      )
    else if (detailFields.some((field) => detailBody[field.key] !== null))
      await api.post('/api/international-conferences/details', {
        ...detailBody,
        conference_id: selected.value.id,
        created_by: userId,
      })

    const total = Number(form.value.main.total_participants) || 0
    await Promise.all(
      form.value.statistics.map((item) => {
        const participantCount = optionalNumber(item.participant_count)
        const body = {
          country_id: optionalNumber(item.country_id),
          country_name: item.country_name.trim(),
          participant_count: participantCount,
          presentation_count: optionalNumber(item.presentation_count),
          share_percent:
            total > 0 && participantCount !== null
              ? Number(((participantCount / total) * 100).toFixed(2))
              : null,
          updated_by: userId,
        }
        return item.id
          ? api.patch(`/api/international-conferences/countries/${item.id}`, body)
          : api.post('/api/international-conferences/countries', {
              ...body,
              conference_id: selected.value.id,
              created_by: userId,
            })
      }),
    )
    await Promise.all(
      form.value.deletedStatisticIds.map((id) =>
        api.delete(`/api/international-conferences/countries/${id}`),
      ),
    )

    const updated = { ...selected.value, ...response.data }
    const index = conferences.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) conferences.value[index] = updated
    selected.value = updated
    await refreshRelated()
    form.value = null
    toast('Međunarodna konferencija uspješno je izmijenjena.')
  } catch (exception) {
    editError.value = apiError(exception, 'Konferenciju nije moguće izmijeniti.')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm(`Želite li izbrisati konferenciju „${selected.value.conference_name}”?`)) return
  deleting.value = true
  try {
    await api.delete(`/api/international-conferences/${selected.value.id}`)
    conferences.value = conferences.value.filter((item) => item.id !== selected.value.id)
    selected.value = null
    form.value = null
    page.value = Math.min(page.value, Math.max(1, pageCount.value))
    toast('Međunarodna konferencija uspješno je izbrisana.')
  } catch (exception) {
    editError.value = apiError(exception, 'Konferenciju nije moguće izbrisati.')
  } finally {
    deleting.value = false
  }
}

async function openFromRoute() {
  const id = Number(route.query.id)
  if (!id) return
  const item = conferences.value.find((entry) => Number(entry.id) === id)
  if (!item) return
  periodId.value = item.reporting_period_id
  await nextTick()
  page.value = Math.floor(filtered.value.findIndex((entry) => entry.id === id) / perPage) + 1
  selected.value = item
  await nextTick()
  detailsCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function load() {
  try {
    const [
      periodResponse,
      conferenceResponse,
      detailResponse,
      statisticResponse,
      unitResponse,
      countryResponse,
    ] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/international-conferences'),
      api.get('/api/international-conferences/details/all'),
      api.get('/api/international-conferences/countries/all'),
      api.get('/api/organizational-units'),
      api.get('/api/countries'),
    ])
    periods.value = periodResponse.data
    conferences.value = conferenceResponse.data
    details.value = detailResponse.data
    statistics.value = statisticResponse.data
    units.value = unitResponse.data
    countries.value = countryResponse.data
    periodId.value = periods.value[0]?.id ?? null
    await openFromRoute()
  } catch (exception) {
    error.value = apiError(exception, 'Nije moguće dohvatiti međunarodne konferencije.')
  } finally {
    loading.value = false
  }
}

watch(periodId, () => {
  page.value = 1
  selected.value = null
  cancelEdit()
})
onMounted(load)
onUnmounted(() => {
  if (snackbarTimer) clearTimeout(snackbarTimer)
})
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs">
      <RouterLink to="/medunarodna-suradnja">Međunarodna suradnja</RouterLink><span>›</span
      ><span>Međunarodne konferencije</span>
    </nav>
    <h1>Izvješće o organizaciji i suorganizaciji međunarodnih konferencija</h1>
    <p v-if="loading">Učitavanje...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <template v-else>
      <section class="overview">
        <label
          >Izvještajno razdoblje<select v-model.number="periodId">
            <option v-for="period in periods" :key="period.id" :value="period.id">
              {{ period.label }}
            </option>
          </select></label
        ><strong>Broj održanih međunarodnih konferencija: {{ filtered.length }}</strong
        ><ExportButton :records="filtered" file-name="medunarodne-konferencije" />
      </section>
      <section class="records">
        <header class="heading">
          <h2>Održane međunarodne znanstvene i umjetničke konferencije ({{ filtered.length }})</h2>
          <RouterLink class="action" to="/medunarodna-suradnja/medunarodne-konferencije/nova"
            >Dodaj konferenciju</RouterLink
          >
        </header>
        <div v-if="filtered.length" class="layout">
          <div>
            <div class="list">
              <button
                v-for="item in shown"
                :key="item.id"
                :class="{ selected: selected?.id === item.id }"
                @click="choose(item)"
              >
                <strong>{{ item.conference_name }}</strong
                ><span>{{ date(item.held_on) }} · {{ display(item.location) }}</span>
              </button>
            </div>
            <div v-if="pageCount > 1" class="pagination">
              <button
                v-for="number in pageCount"
                :key="number"
                :class="{ active: page === number }"
                @click="page = number"
              >
                {{ number }}
              </button>
            </div>
          </div>
          <div v-if="selected" ref="detailsCard" class="details">
            <div class="actions">
              <button v-if="!form" class="action" @click="startEdit">Uredi</button
              ><template v-else
                ><button class="action" :disabled="saving || deleting" @click="save">
                  {{ saving ? 'Spremanje...' : 'Spremi' }}</button
                ><button class="action" :disabled="saving || deleting" @click="cancelEdit">
                  Odustani</button
                ><button class="square minus" :disabled="saving || deleting" @click="remove">
                  −
                </button></template
              >
            </div>
            <p v-if="editError" class="error">{{ editError }}</p>
            <dl>
              <div v-for="field in mainFields" :key="field.key">
                <dt>{{ field.label }}</dt>
                <dd>
                  <select
                    v-if="form && field.kind === 'unit'"
                    v-model="form.main[field.key]"
                    class="input"
                  >
                    <option value="">Nije odabrano</option>
                    <option v-for="unit in units" :key="unit.id" :value="unit.id">
                      {{ unit.short_name || unit.name }}
                    </option></select
                  ><textarea
                    v-else-if="form && field.kind === 'textarea'"
                    v-model="form.main[field.key]"
                    class="input"
                    rows="3"
                  ></textarea
                  ><input
                    v-else-if="form"
                    v-model="form.main[field.key]"
                    class="input"
                    :type="
                      field.kind === 'date'
                        ? 'date'
                        : field.kind === 'number'
                          ? 'number'
                          : field.kind === 'link'
                            ? 'url'
                            : 'text'
                    "
                    min="0"
                  /><a
                    v-else-if="field.kind === 'link' && safeLink(selected[field.key])"
                    :href="safeLink(selected[field.key])"
                    target="_blank"
                    rel="noopener"
                    >{{ selected[field.key] }}</a
                  ><template v-else>{{ mainValue(field) }}</template>
                </dd>
              </div>
            </dl>
            <section class="inside">
              <h3>Detaljni podaci o konferenciji</h3>
              <dl>
                <div v-for="field in detailFields" :key="field.key">
                  <dt>{{ field.label }}</dt>
                  <dd>
                    <textarea
                      v-if="form && field.kind === 'textarea'"
                      v-model="form.detail[field.key]"
                      class="input"
                      rows="3"
                    ></textarea
                    ><input
                      v-else-if="form"
                      v-model="form.detail[field.key]"
                      class="input"
                      :type="
                        field.kind === 'number' || field.kind === 'money'
                          ? 'number'
                          : field.kind === 'link'
                            ? 'url'
                            : 'text'
                      "
                      min="0"
                      :step="field.kind === 'money' ? '0.01' : undefined"
                    /><a
                      v-else-if="field.kind === 'link' && safeLink(selectedDetail?.[field.key])"
                      :href="safeLink(selectedDetail[field.key])"
                      target="_blank"
                      rel="noopener"
                      >{{ selectedDetail[field.key] }}</a
                    ><template v-else>{{ detailValue(field) }}</template>
                  </dd>
                </div>
              </dl>
            </section>
            <section class="inside">
              <header class="country-heading">
                <h3>Struktura sudionika po državama</h3>
                <button v-if="form" class="square plus" @click="addStatistic">+</button>
              </header>
              <div class="table">
                <table>
                  <thead>
                    <tr>
                      <th>Država</th>
                      <th>Broj sudionika</th>
                      <th>Broj izlaganja</th>
                      <th>Udio (%)</th>
                      <th v-if="form"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in form ? form.statistics : selectedStatistics"
                      :key="row.id || row.temporaryId"
                    >
                      <td>
                        <template v-if="form"
                          ><CountryAutocomplete
                            v-model="row.country_id"
                            :countries="countries"
                            class="table-input"
                            placeholder="Druga država"
                            @change="updateCountryName(row)" /><input
                            v-if="!row.country_id"
                            v-model="row.country_name"
                            class="table-input custom-country"
                            placeholder="Naziv države" /></template
                        ><template v-else>{{ row.country_name }}</template>
                      </td>
                      <td>
                        <input
                          v-if="form"
                          v-model="row.participant_count"
                          class="table-input"
                          type="number"
                          min="0"
                        /><template v-else>{{ display(row.participant_count) }}</template>
                      </td>
                      <td>
                        <input
                          v-if="form"
                          v-model="row.presentation_count"
                          class="table-input"
                          type="number"
                          min="0"
                        /><template v-else>{{ display(row.presentation_count) }}</template>
                      </td>
                      <td>{{ form ? 'Automatski' : display(row.share_percent) }}</td>
                      <td v-if="form">
                        <button class="square minus" @click="removeStatistic(row)">−</button>
                      </td>
                    </tr>
                    <tr v-if="!(form ? form.statistics : selectedStatistics).length">
                      <td :colspan="form ? 5 : 4">Nema podataka o državama.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
        <p v-else>Nema međunarodnih konferencija za odabrano razdoblje.</p>
      </section>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view {
  min-height: calc(100vh - 112px);
  padding: 34px clamp(32px, 5vw, 128px) 90px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}
.breadcrumbs,
.overview,
.heading,
.actions,
.country-heading {
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
.breadcrumbs a:hover {
  color: rgb(var(--v-theme-primary));
}
h1 {
  margin: 18px 0 0;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(1.5rem, 1.65vw, 2.35rem);
  font-weight: 400;
}
h2,
h3 {
  font-weight: 400;
}
.overview,
.heading,
.country-heading {
  justify-content: space-between;
}
.overview {
  margin-top: 36px;
}
.overview label {
  display: grid;
  gap: 8px;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
select,
.input,
.table-input {
  padding: 9px 12px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
}
.records {
  margin-top: 70px;
}
.action {
  padding: 9px 15px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
  text-decoration: none;
}
.action:hover:not(:disabled),
.plus:hover {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.layout {
  display: grid;
  grid-template-columns: minmax(340px, 0.7fr) minmax(650px, 1.3fr);
  gap: clamp(32px, 5vw, 88px);
  align-items: start;
  margin-top: 32px;
}
.list {
  display: grid;
  gap: 5px;
}
.list button {
  display: grid;
  gap: 5px;
  padding: 13px 16px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: rgb(var(--v-theme-membership-link));
  cursor: pointer;
  text-align: left;
  font: inherit;
  line-height: 1.45;
}
.list button span {
  color: rgb(var(--v-theme-muted));
  font-size: 0.9rem;
}
.list button:hover,
.list button.selected {
  background: rgba(var(--v-theme-primary), 0.1);
}
.pagination {
  display: flex;
  justify-content: center;
  gap: 5px;
  margin-top: 20px;
}
.pagination button {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
}
.pagination button.active {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.details {
  display: grid;
  gap: 18px;
  padding: clamp(28px, 3vw, 48px);
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
}
dl {
  display: grid;
  gap: 14px;
  margin: 0;
}
dl > div {
  display: grid;
  grid-template-columns: minmax(210px, 0.85fr) minmax(0, 1.15fr);
  gap: 22px;
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.actions {
  justify-content: flex-end;
  gap: 8px;
}
.input {
  width: 100%;
  box-sizing: border-box;
}
.inside {
  padding-top: 24px;
  border-top: 1px solid rgb(var(--v-theme-category-border));
}
.inside h3 {
  margin: 0 0 18px;
}
.square {
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  place-items: center;
  border: 1px solid rgb(var(--v-theme-on-surface));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font-size: 1.2rem;
}
.minus:hover:not(:disabled) {
  background: rgb(var(--v-theme-error));
  color: #fff;
}
.table {
  overflow-x: auto;
  border-radius: 10px;
}
.table table {
  width: 100%;
  border-collapse: collapse;
}
.table th,
.table td {
  padding: 11px 12px;
  border: 1px solid rgb(var(--v-theme-table-border));
  text-align: left;
}
.table th {
  border-color: rgb(var(--v-theme-table-header-border));
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
}
.table-input {
  width: 100%;
  min-width: 110px;
  box-sizing: border-box;
}
.custom-country {
  margin-top: 7px;
}
a {
  color: rgb(var(--v-theme-evidence-link));
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
@media (max-width: 1050px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 650px) {
  .view {
    padding: 28px 20px;
  }
  .overview,
  .heading {
    align-items: stretch;
    flex-direction: column;
    gap: 20px;
  }
  dl > div {
    grid-template-columns: 1fr;
  }
}
</style>
