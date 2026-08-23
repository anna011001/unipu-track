<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'
import ExportButton from '../components/ExportButton.vue'

const route = useRoute()
const userId = 1
const perPage = 10
const periods = ref([])
const newRecords = ref([])
const agreements = ref([])
const countries = ref([])
const units = ref([])
const periodId = ref(null)
const newPage = ref(1)
const agreementPage = ref(1)
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

const kindLabels = { SCIENTIFIC: 'Znanstvena', ARTISTIC: 'Umjetnička', PROFESSIONAL: 'Profesionalna' }
const regionLabels = { EU: 'EU zemlje', OTHER_EUROPE: 'Ostala Europa', NORTH_AMERICA: 'Sjeverna Amerika', SOUTH_AMERICA: 'Južna Amerika', ASIA: 'Azija', AFRICA: 'Afrika', OCEANIA: 'Oceanija' }

const newFields = [
  { key: 'partner_institution', label: 'Partnerska institucija', required: true },
  { key: 'country_id', label: 'Država', kind: 'country' },
  { key: 'cooperation_kind', label: 'Vrsta suradnje', kind: 'kind' },
  { key: 'cooperation_field', label: 'Područje suradnje' },
  { key: 'start_date', label: 'Datum početka', kind: 'date' },
  { key: 'duration', label: 'Trajanje' },
  { key: 'agreement_type', label: 'Vrsta ugovora ili sporazuma' },
  { key: 'unipu_contact_person', label: 'Kontakt osoba UNIPU-a' },
  { key: 'organizational_unit_id', label: 'Sastavnica', kind: 'unit' },
  { key: 'planned_activities', label: 'Planirane aktivnosti', kind: 'textarea' },
  { key: 'agreement_link', label: 'Poveznica na ugovor', kind: 'link' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Napomena', kind: 'textarea' },
]
const agreementFields = [
  { key: 'partner_institution', label: 'Partnerska institucija', required: true },
  { key: 'country_id', label: 'Država', kind: 'country' },
  { key: 'cooperation_kind', label: 'Vrsta suradnje', kind: 'kind' },
  { key: 'agreement_type', label: 'Vrsta ugovora ili sporazuma' },
  { key: 'signed_on', label: 'Datum potpisivanja', kind: 'date' },
  { key: 'valid_until', label: 'Rok važenja', kind: 'date' },
  { key: 'responsible_person', label: 'Odgovorna osoba' },
  { key: 'organizational_unit_id', label: 'Sastavnica', kind: 'unit' },
  { key: 'completed_activities', label: 'Realizirane aktivnosti', kind: 'textarea' },
  { key: 'planned_activities', label: 'Planirane aktivnosti', kind: 'textarea' },
  { key: 'status', label: 'Status' },
  { key: 'document_link', label: 'Dokument', kind: 'link' },
  { key: 'notes', label: 'Napomena', kind: 'textarea' },
]

const filteredNew = computed(() => newRecords.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)))
const filteredAgreements = computed(() => agreements.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)))
const newPageCount = computed(() => Math.ceil(filteredNew.value.length / perPage))
const agreementPageCount = computed(() => Math.ceil(filteredAgreements.value.length / perPage))
const shownNew = computed(() => filteredNew.value.slice((newPage.value - 1) * perPage, newPage.value * perPage))
const shownAgreements = computed(() => filteredAgreements.value.slice((agreementPage.value - 1) * perPage, agreementPage.value * perPage))
const currentFields = computed(() => selected.value?.type === 'agreement' ? agreementFields : newFields)

const regionRows = computed(() => {
  const rows = Object.keys(regionLabels).map((region) => ({ region, scientific: 0, artistic: 0, professional: 0, total: 0, new: 0 }))
  const countryRegion = new Map(countries.value.map((country) => [Number(country.id), country.region]))
  for (const item of filteredAgreements.value) {
    const row = rows.find((entry) => entry.region === countryRegion.get(Number(item.country_id)))
    if (!row) continue
    if (item.cooperation_kind === 'SCIENTIFIC') row.scientific += 1
    if (item.cooperation_kind === 'ARTISTIC') row.artistic += 1
    if (item.cooperation_kind === 'PROFESSIONAL') row.professional += 1
    row.total += 1
  }
  for (const item of filteredNew.value) {
    const row = rows.find((entry) => entry.region === countryRegion.get(Number(item.country_id)))
    if (row) row.new += 1
  }
  return rows
})
const regionTotals = computed(() => regionRows.value.reduce((total, row) => ({
  scientific: total.scientific + row.scientific,
  artistic: total.artistic + row.artistic,
  professional: total.professional + row.professional,
  total: total.total + row.total,
  new: total.new + row.new,
}), { scientific: 0, artistic: 0, professional: 0, total: 0, new: 0 }))

function display(value) { return value === null || value === undefined || value === '' ? '—' : value }
function date(value) { if (!value) return '—'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(parsed) }
function dateInput(value) { return value ? String(value).slice(0, 10) : '' }
function countryName(id) { const item = countries.value.find((country) => Number(country.id) === Number(id)); return item?.name_hr || item?.name_en || '—' }
function unitName(id) { const item = units.value.find((unit) => Number(unit.id) === Number(id)); return item?.short_name || item?.name || '—' }
function isUrl(value) { return /^https?:\/\//i.test(String(value || '')) }
function optionalText(value) { return String(value ?? '').trim() || null }
function optionalNumber(value) { return value === '' || value === null || value === undefined ? null : Number(value) }
function apiError(exception, fallback) { const errors = exception.response?.data?.errors; return Array.isArray(errors) ? errors.join(' ') : exception.response?.data?.message || fallback }
function toast(message) { success.value = message; if (snackbarTimer) clearTimeout(snackbarTimer); snackbarTimer = setTimeout(() => { success.value = '' }, 4000) }
function fieldValue(field) {
  const raw = selected.value?.record[field.key]
  if (field.kind === 'country') return countryName(raw)
  if (field.kind === 'unit') return unitName(raw)
  if (field.kind === 'kind') return kindLabels[raw] || '—'
  if (field.kind === 'date') return date(raw)
  return display(raw)
}

function choose(type, record) { selected.value = { type, record }; form.value = null; editError.value = '' }
function startEdit() { form.value = Object.fromEntries(currentFields.value.map((field) => [field.key, field.kind === 'date' ? dateInput(selected.value.record[field.key]) : selected.value.record[field.key] ?? ''])) }
function cancelEdit() { form.value = null; editError.value = '' }
function editPayload() {
  const payload = { updated_by: userId }
  for (const field of currentFields.value) {
    const raw = form.value[field.key]
    if (['country', 'unit'].includes(field.kind)) payload[field.key] = optionalNumber(raw)
    else if (field.kind === 'date') payload[field.key] = raw || null
    else if (field.required) payload[field.key] = String(raw ?? '').trim()
    else payload[field.key] = optionalText(raw)
  }
  return payload
}

async function save() {
  editError.value = ''
  if (!String(form.value.partner_institution || '').trim()) { editError.value = 'Partnerska institucija je obavezna.'; return }
  if (selected.value.type === 'agreement' && form.value.signed_on && form.value.valid_until && form.value.valid_until < form.value.signed_on) { editError.value = 'Rok važenja ne smije biti prije datuma potpisivanja.'; return }
  saving.value = true
  try {
    const path = selected.value.type === 'agreement' ? 'agreements' : 'new'
    const response = await api.patch(`/api/international-cooperations/${path}/${selected.value.record.id}`, editPayload())
    const collection = selected.value.type === 'agreement' ? agreements : newRecords
    const updated = { ...selected.value.record, ...response.data }
    const index = collection.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) collection.value[index] = updated
    selected.value = { ...selected.value, record: updated }
    form.value = null
    toast(selected.value.type === 'agreement' ? 'Međunarodni ugovor uspješno je izmijenjen.' : 'Partnerstvo uspješno je izmijenjeno.')
  } catch (exception) { editError.value = apiError(exception, 'Zapis nije moguće izmijeniti.') } finally { saving.value = false }
}

async function remove() {
  if (!confirm('Želite li izbrisati odabrani zapis?')) return
  deleting.value = true
  try {
    const path = selected.value.type === 'agreement' ? 'agreements' : 'new'
    await api.delete(`/api/international-cooperations/${path}/${selected.value.record.id}`)
    if (selected.value.type === 'agreement') agreements.value = agreements.value.filter((item) => item.id !== selected.value.record.id)
    else newRecords.value = newRecords.value.filter((item) => item.id !== selected.value.record.id)
    selected.value = null; form.value = null
    toast('Zapis je uspješno izbrisan.')
  } catch (exception) { editError.value = apiError(exception, 'Zapis nije moguće izbrisati.') } finally { deleting.value = false }
}

async function openFromRoute() {
  const type = route.query.type === 'agreement' ? 'agreement' : 'new'
  const id = Number(route.query.id)
  if (!id) return
  const source = type === 'agreement' ? agreements.value : newRecords.value
  const item = source.find((entry) => Number(entry.id) === id)
  if (!item) return
  periodId.value = item.reporting_period_id
  await nextTick()
  const filtered = type === 'agreement' ? filteredAgreements.value : filteredNew.value
  const page = Math.floor(filtered.findIndex((entry) => entry.id === id) / perPage) + 1
  if (type === 'agreement') agreementPage.value = page; else newPage.value = page
  choose(type, item)
  await nextTick(); detailsCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function load() {
  try {
    const [periodResponse, newResponse, agreementResponse, countryResponse, unitResponse] = await Promise.all([
      api.get('/api/reporting-periods'), api.get('/api/international-cooperations/new'), api.get('/api/international-cooperations/agreements'), api.get('/api/countries'), api.get('/api/organizational-units'),
    ])
    periods.value = periodResponse.data; newRecords.value = newResponse.data; agreements.value = agreementResponse.data; countries.value = countryResponse.data; units.value = unitResponse.data
    periodId.value = periods.value[0]?.id ?? null
    await openFromRoute()
  } catch (exception) { error.value = apiError(exception, 'Nije moguće dohvatiti međunarodna partnerstva.') } finally { loading.value = false }
}

watch(periodId, () => { newPage.value = 1; agreementPage.value = 1; selected.value = null; cancelEdit() })
onMounted(load)
onUnmounted(() => { if (snackbarTimer) clearTimeout(snackbarTimer) })
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs"><RouterLink to="/medunarodna-suradnja">Međunarodna suradnja</RouterLink><span>›</span><span>Partnerstva</span></nav>
    <h1>Evidencija međunarodne suradnje</h1>
    <p v-if="loading">Učitavanje...</p><p v-else-if="error" class="error">{{ error }}</p>
    <template v-else>
      <section class="overview"><label>Izvještajno razdoblje<select v-model.number="periodId"><option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option></select></label><div class="metrics"><strong>Aktivna partnerstva: {{ filteredAgreements.length }}</strong><strong>Nova partnerstva: {{ filteredNew.length }}</strong><strong>Novi ugovori: {{ filteredNew.filter((item) => item.agreement_type).length }}</strong></div><ExportButton :records="[...filteredNew.map((item) => ({ vrsta_zapisa: 'Novo partnerstvo', ...item })), ...filteredAgreements.map((item) => ({ vrsta_zapisa: 'Aktivno partnerstvo', ...item }))]" file-name="medunarodna-partnerstva" /></section>

      <section class="records"><header class="heading"><h2>Nova međunarodna partnerstva ({{ filteredNew.length }})</h2><RouterLink class="action" :to="{ name: 'new-international-partnership', query: { type: 'new' } }">Dodaj partnerstvo</RouterLink></header>
        <div v-if="filteredNew.length" class="layout"><div><div class="list"><button v-for="item in shownNew" :key="item.id" :class="{ selected: selected?.type === 'new' && selected.record.id === item.id }" @click="choose('new', item)"><strong>{{ item.partner_institution }}</strong><span>{{ item.country_name_hr || item.country_name_en || 'Država nije navedena' }} · {{ kindLabels[item.cooperation_kind] || 'Vrsta nije navedena' }}</span></button></div><div v-if="newPageCount > 1" class="pagination"><button v-for="number in newPageCount" :key="number" :class="{ active: newPage === number }" @click="newPage = number">{{ number }}</button></div></div>
          <div v-if="selected?.type === 'new'" ref="detailsCard" class="details"><div class="actions"><button v-if="!form" class="action" @click="startEdit">Uredi</button><template v-else><button class="action" :disabled="saving || deleting" @click="save">{{ saving ? 'Spremanje...' : 'Spremi' }}</button><button class="action" :disabled="saving || deleting" @click="cancelEdit">Odustani</button><button class="square minus" :disabled="saving || deleting" @click="remove">−</button></template></div><p v-if="editError" class="error">{{ editError }}</p><dl><div v-for="field in currentFields" :key="field.key"><dt>{{ field.label }}</dt><dd><select v-if="form && field.kind === 'country'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name_hr || country.name_en }}</option></select><select v-else-if="form && field.kind === 'unit'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select><select v-else-if="form && field.kind === 'kind'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="(label, key) in kindLabels" :key="key" :value="key">{{ label }}</option></select><textarea v-else-if="form && field.kind === 'textarea'" v-model="form[field.key]" class="input" rows="3"></textarea><input v-else-if="form" v-model="form[field.key]" class="input" :type="field.kind === 'date' ? 'date' : 'text'"><a v-else-if="field.kind === 'link' && isUrl(selected.record[field.key])" :href="selected.record[field.key]" target="_blank" rel="noopener">{{ selected.record[field.key] }}</a><template v-else>{{ fieldValue(field) }}</template></dd></div></dl></div>
        </div><p v-else>Nema novih partnerstava za odabrano razdoblje.</p>
      </section>

      <section class="records"><header class="heading"><h2>Aktivni međunarodni ugovori ({{ filteredAgreements.length }})</h2><RouterLink class="action" :to="{ name: 'new-international-partnership', query: { type: 'agreement' } }">Dodaj ugovor</RouterLink></header>
        <div v-if="filteredAgreements.length" class="layout"><div><div class="list"><button v-for="item in shownAgreements" :key="item.id" :class="{ selected: selected?.type === 'agreement' && selected.record.id === item.id }" @click="choose('agreement', item)"><strong>{{ item.partner_institution }}</strong><span>{{ item.agreement_type || 'Vrsta ugovora nije navedena' }} · {{ date(item.signed_on) }}</span></button></div><div v-if="agreementPageCount > 1" class="pagination"><button v-for="number in agreementPageCount" :key="number" :class="{ active: agreementPage === number }" @click="agreementPage = number">{{ number }}</button></div></div>
          <div v-if="selected?.type === 'agreement'" ref="detailsCard" class="details"><div class="actions"><button v-if="!form" class="action" @click="startEdit">Uredi</button><template v-else><button class="action" :disabled="saving || deleting" @click="save">{{ saving ? 'Spremanje...' : 'Spremi' }}</button><button class="action" :disabled="saving || deleting" @click="cancelEdit">Odustani</button><button class="square minus" :disabled="saving || deleting" @click="remove">−</button></template></div><p v-if="editError" class="error">{{ editError }}</p><dl><div v-for="field in currentFields" :key="field.key"><dt>{{ field.label }}</dt><dd><select v-if="form && field.kind === 'country'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name_hr || country.name_en }}</option></select><select v-else-if="form && field.kind === 'unit'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select><select v-else-if="form && field.kind === 'kind'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="(label, key) in kindLabels" :key="key" :value="key">{{ label }}</option></select><textarea v-else-if="form && field.kind === 'textarea'" v-model="form[field.key]" class="input" rows="3"></textarea><input v-else-if="form" v-model="form[field.key]" class="input" :type="field.kind === 'date' ? 'date' : 'text'"><a v-else-if="field.kind === 'link' && isUrl(selected.record[field.key])" :href="selected.record[field.key]" target="_blank" rel="noopener">{{ selected.record[field.key] }}</a><template v-else>{{ fieldValue(field) }}</template></dd></div></dl></div>
        </div><p v-else>Nema aktivnih ugovora za odabrano razdoblje.</p>
      </section>

      <section class="summary"><h2>Analiza međunarodne suradnje po regijama</h2><div class="table"><table><thead><tr><th>Regija</th><th>Znanstvena</th><th>Umjetnička</th><th>Profesionalna</th><th>Ukupno aktivnih</th><th>Nova partnerstva</th></tr></thead><tbody><tr v-for="row in regionRows" :key="row.region"><td>{{ regionLabels[row.region] }}</td><td>{{ row.scientific }}</td><td>{{ row.artistic }}</td><td>{{ row.professional }}</td><td>{{ row.total }}</td><td>{{ row.new }}</td></tr><tr class="total"><td>Ukupno</td><td>{{ regionTotals.scientific }}</td><td>{{ regionTotals.artistic }}</td><td>{{ regionTotals.professional }}</td><td>{{ regionTotals.total }}</td><td>{{ regionTotals.new }}</td></tr></tbody></table></div></section>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.overview,.heading,.actions,.metrics{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}.breadcrumbs a:hover,a{color:rgb(var(--v-theme-primary))}h1{margin:18px 0 0;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.65vw,2.35rem);font-weight:400}h2{font-weight:400}.overview,.heading{justify-content:space-between}.overview{margin-top:36px}.overview label{display:grid;gap:8px;color:rgb(var(--v-theme-primary));font-weight:700}.metrics{gap:28px;flex-wrap:wrap}select,.input{padding:9px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.records,.summary{margin-top:70px}.action{padding:9px 15px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit;text-decoration:none}.action:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.layout{display:grid;grid-template-columns:minmax(320px,.7fr) minmax(620px,1.3fr);gap:clamp(32px,5vw,88px);align-items:start;margin-top:32px}.list{display:grid;gap:5px}.list button{display:grid;gap:5px;padding:13px 16px;border:0;border-radius:7px;background:transparent;color:rgb(var(--v-theme-membership-link));cursor:pointer;text-align:left;font:inherit}.list button span{color:rgb(var(--v-theme-muted));font-size:.9rem}.list button:hover,.list button.selected{background:rgba(var(--v-theme-primary),.1)}.pagination{display:flex;justify-content:center;gap:5px;margin-top:20px}.pagination button{width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:rgb(var(--v-theme-primary));cursor:pointer}.pagination button.active{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.details{display:grid;gap:18px;padding:clamp(28px,3vw,48px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.actions{justify-content:flex-end;gap:8px}dl{display:grid;gap:14px;margin:0}dl>div{display:grid;grid-template-columns:minmax(210px,.85fr) minmax(0,1.15fr);gap:22px}dd{margin:0;overflow-wrap:anywhere;white-space:pre-line}.input{width:100%;box-sizing:border-box}.square{display:grid;width:38px;height:38px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-on-surface));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font-size:1.2rem}.minus:hover:not(:disabled){background:rgb(var(--v-theme-error));color:#fff}.table{overflow-x:auto;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px}.table table{width:100%;border-collapse:collapse}.table th,.table td{padding:11px 14px;border-right:1px solid rgb(var(--v-theme-table-border));border-bottom:1px solid rgb(var(--v-theme-table-border));text-align:left}.table th{border-color:rgb(var(--v-theme-table-header-border));background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.table tr:last-child td{border-bottom:0}.table th:last-child,.table td:last-child{border-right:0}.total{font-weight:700;background:rgba(var(--v-theme-primary),.08)}.error{color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:1050px){.layout{grid-template-columns:1fr}}@media(max-width:720px){.view{padding:28px 20px}.overview,.heading{align-items:stretch;flex-direction:column;gap:20px}dl>div{grid-template-columns:1fr}}
</style>
