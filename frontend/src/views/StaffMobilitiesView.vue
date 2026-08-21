<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const userId = 1
const perPage = 10
const periods = ref([])
const records = ref([])
const staff = ref([])
const units = ref([])
const countries = ref([])
const unitAnalyses = ref([])
const multipleAnalyses = ref([])
const countryAnalyses = ref([])
const periodId = ref(null)
const page = ref(1)
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

const fields = [
  { key: 'staff_member_id', label: 'Ime i prezime', kind: 'staff', required: true },
  { key: 'organizational_unit_id', label: 'Sastavnica', kind: 'unit' },
  { key: 'mobility_type', label: 'Vrsta mobilnosti', required: true },
  { key: 'program_name', label: 'Program', kind: 'program' },
  { key: 'host_institution', label: 'Institucija domaćin' },
  { key: 'destination_country_id', label: 'Država', kind: 'country' },
  { key: 'start_date', label: 'Datum početka', kind: 'date' },
  { key: 'end_date', label: 'Datum završetka', kind: 'date' },
  { key: 'duration_days', label: 'Trajanje (dana)', kind: 'number' },
  { key: 'mobility_purpose', label: 'Svrha mobilnosti', kind: 'textarea' },
  { key: 'activities', label: 'Aktivnosti', kind: 'textarea' },
  { key: 'results', label: 'Rezultati', kind: 'textarea' },
  { key: 'notes', label: 'Napomena', kind: 'textarea' },
]

const filtered = computed(() => records.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)))
const pageCount = computed(() => Math.ceil(filtered.value.length / perPage))
const shown = computed(() => filtered.value.slice((page.value - 1) * perPage, page.value * perPage))
const peopleCount = computed(() => new Set(filtered.value.map((item) => item.staff_member_id)).size)
const averagePerPerson = computed(() => peopleCount.value ? (filtered.value.length / peopleCount.value).toFixed(2).replace('.', ',') : '0')

function display(value) { return value === null || value === undefined || value === '' ? '—' : value }
function date(value) { if (!value) return '—'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(parsed) }
function dateInput(value) { return value ? String(value).slice(0, 10) : '' }
function staffName(id) { const item = staff.value.find((member) => Number(member.id) === Number(id)); return item ? `${item.first_name} ${item.last_name}` : '—' }
function unitName(id) { const item = units.value.find((unit) => Number(unit.id) === Number(id)); return item?.short_name || item?.name || '—' }
function countryName(id) { const item = countries.value.find((country) => Number(country.id) === Number(id)); return item?.name_hr || item?.name_en || '—' }
function optionalText(value) { return String(value ?? '').trim() || null }
function optionalNumber(value) { return value === '' || value === null || value === undefined ? null : Number(value) }
function apiError(exception, fallback) { const errors = exception.response?.data?.errors; return Array.isArray(errors) ? errors.join(' ') : exception.response?.data?.message || fallback }
function toast(message) { success.value = message; if (snackbarTimer) clearTimeout(snackbarTimer); snackbarTimer = setTimeout(() => { success.value = '' }, 4000) }
function value(field) { const raw = selected.value?.[field.key]; if (field.kind === 'staff') return staffName(raw); if (field.kind === 'unit') return unitName(raw); if (field.kind === 'country') return countryName(raw); if (field.kind === 'date') return date(raw); return display(raw) }

function choose(item) { selected.value = item; form.value = null; editError.value = '' }
function startEdit() {
  form.value = Object.fromEntries(fields.map((field) => [field.key, field.kind === 'date' ? dateInput(selected.value[field.key]) : selected.value[field.key] ?? '']))
  const standardPrograms = ['Erasmus+', 'CEEPUS', 'Bilateralni', 'Ostalo']
  if (selected.value.program_name && !standardPrograms.includes(selected.value.program_name)) {
    form.value.custom_program_name = selected.value.program_name
    form.value.program_name = 'Ostalo'
  } else {
    form.value.custom_program_name = ''
  }
}
function cancelEdit() { form.value = null; editError.value = '' }

function payload() {
  const result = { updated_by: userId }
  for (const field of fields) {
    const raw = form.value[field.key]
    if (field.kind === 'program') result[field.key] = raw === 'Ostalo' ? optionalText(form.value.custom_program_name) || 'Ostalo' : optionalText(raw)
    else if (field.required && field.kind !== 'staff') result[field.key] = String(raw ?? '').trim()
    else if (['staff', 'unit', 'country', 'number'].includes(field.kind)) result[field.key] = optionalNumber(raw)
    else if (field.kind === 'date') result[field.key] = raw || null
    else result[field.key] = optionalText(raw)
  }
  return result
}

async function loadAnalyses() {
  if (!periodId.value) return
  const params = { reporting_period_id: periodId.value }
  const [unitResponse, multipleResponse, countryResponse] = await Promise.all([
    api.get('/api/staff-mobilities/analyses/units', { params }),
    api.get('/api/staff-mobilities/analyses/multiple', { params }),
    api.get('/api/staff-mobilities/analyses/countries', { params }),
  ])
  unitAnalyses.value = unitResponse.data
  multipleAnalyses.value = multipleResponse.data
  countryAnalyses.value = countryResponse.data
}

async function save() {
  editError.value = ''
  if (!form.value.staff_member_id || !String(form.value.mobility_type).trim()) { editError.value = 'Djelatnik i vrsta mobilnosti su obavezni.'; return }
  if (form.value.start_date && form.value.end_date && form.value.end_date < form.value.start_date) { editError.value = 'Datum završetka ne smije biti prije datuma početka.'; return }
  saving.value = true
  try {
    const response = await api.patch(`/api/staff-mobilities/${selected.value.id}`, payload())
    const staffMember = staff.value.find((item) => Number(item.id) === Number(response.data.staff_member_id))
    const updated = { ...selected.value, ...response.data, staff_first_name: staffMember?.first_name, staff_last_name: staffMember?.last_name }
    const index = records.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) records.value[index] = updated
    selected.value = updated
    form.value = null
    await loadAnalyses()
    toast('Mobilnost osoblja uspješno je izmijenjena.')
  } catch (exception) { editError.value = apiError(exception, 'Mobilnost nije moguće izmijeniti.') } finally { saving.value = false }
}

async function remove() {
  if (!confirm('Želite li izbrisati odabranu mobilnost osoblja?')) return
  deleting.value = true
  try {
    await api.delete(`/api/staff-mobilities/${selected.value.id}`)
    records.value = records.value.filter((item) => item.id !== selected.value.id)
    selected.value = null; form.value = null
    page.value = Math.min(page.value, Math.max(1, pageCount.value))
    await loadAnalyses()
    toast('Mobilnost osoblja uspješno je izbrisana.')
  } catch (exception) { editError.value = apiError(exception, 'Mobilnost nije moguće izbrisati.') } finally { deleting.value = false }
}

async function openFromRoute() {
  const id = Number(route.query.id)
  if (!id) return
  const item = records.value.find((entry) => Number(entry.id) === id)
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
    const [periodResponse, recordResponse, staffResponse, unitResponse, countryResponse] = await Promise.all([
      api.get('/api/reporting-periods'), api.get('/api/staff-mobilities'), api.get('/api/staff-members'), api.get('/api/organizational-units'), api.get('/api/countries'),
    ])
    periods.value = periodResponse.data; records.value = recordResponse.data; staff.value = staffResponse.data; units.value = unitResponse.data; countries.value = countryResponse.data
    periodId.value = periods.value[0]?.id ?? null
    await loadAnalyses()
    await openFromRoute()
  } catch (exception) { error.value = apiError(exception, 'Nije moguće dohvatiti mobilnosti osoblja.') } finally { loading.value = false }
}

watch(periodId, async () => { page.value = 1; selected.value = null; cancelEdit(); try { await loadAnalyses() } catch (exception) { error.value = apiError(exception, 'Nije moguće dohvatiti analize mobilnosti.') } })
onMounted(load)
onUnmounted(() => { if (snackbarTimer) clearTimeout(snackbarTimer) })
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs"><RouterLink to="/medunarodna-suradnja">Međunarodna suradnja</RouterLink><span>›</span><span>Mobilnost osoblja</span></nav>
    <h1>Evidencija međunarodne mobilnosti osoblja</h1>
    <p v-if="loading">Učitavanje...</p><p v-else-if="error" class="error">{{ error }}</p>
    <template v-else>
      <section class="overview"><label>Izvještajno razdoblje<select v-model.number="periodId"><option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option></select></label><div class="metrics"><strong>Ukupno mobilnosti: {{ filtered.length }}</strong><strong>Osoba u mobilnosti: {{ peopleCount }}</strong><strong>Prosječno po osobi: {{ averagePerPerson }}</strong></div></section>
      <section class="records"><header class="heading"><h2>Pojedinačne mobilnosti ({{ filtered.length }})</h2><RouterLink class="action" to="/medunarodna-suradnja/mobilnost-osoblja/nova">Dodaj mobilnost</RouterLink></header>
        <div v-if="filtered.length" class="layout"><div><div class="list"><button v-for="item in shown" :key="item.id" :class="{ selected: selected?.id === item.id }" @click="choose(item)"><strong>{{ item.staff_first_name }} {{ item.staff_last_name }}</strong><span>{{ item.host_institution || item.mobility_type }} · {{ date(item.start_date) }}</span></button></div><div v-if="pageCount > 1" class="pagination"><button v-for="number in pageCount" :key="number" :class="{ active: page === number }" @click="page = number">{{ number }}</button></div></div>
          <div v-if="selected" ref="detailsCard" class="details"><div class="actions"><button v-if="!form" class="action" @click="startEdit">Uredi</button><template v-else><button class="action" :disabled="saving || deleting" @click="save">{{ saving ? 'Spremanje...' : 'Spremi' }}</button><button class="action" :disabled="saving || deleting" @click="cancelEdit">Odustani</button><button class="square minus" :disabled="saving || deleting" @click="remove">−</button></template></div><p v-if="editError" class="error">{{ editError }}</p>
            <dl><div><dt>Zvanje</dt><dd>{{ selected.staff_academic_title || '—' }}</dd></div><div v-for="field in fields" :key="field.key"><dt>{{ field.label }}</dt><dd><select v-if="form && field.kind === 'staff'" v-model="form[field.key]" class="input"><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select><select v-else-if="form && field.kind === 'unit'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select><select v-else-if="form && field.kind === 'country'" v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name_hr || country.name_en }}</option></select><template v-else-if="form && field.kind === 'program'"><select v-model="form[field.key]" class="input"><option value="">Nije odabrano</option><option>Erasmus+</option><option>CEEPUS</option><option>Bilateralni</option><option>Ostalo</option></select><input v-if="form[field.key] === 'Ostalo'" v-model="form.custom_program_name" class="input custom-program" maxlength="100" placeholder="Naziv drugog programa"></template><textarea v-else-if="form && field.kind === 'textarea'" v-model="form[field.key]" class="input" rows="3"></textarea><input v-else-if="form" v-model="form[field.key]" class="input" :type="field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'" :min="field.kind === 'number' ? 0 : undefined"><template v-else>{{ value(field) }}</template></dd></div></dl>
          </div>
        </div><p v-else>Nema mobilnosti za odabrano razdoblje.</p>
      </section>

      <section class="summary"><h2>Analiza po sastavnicama</h2><div class="table"><table><thead><tr><th>Sastavnica</th><th>Broj zaposlenika</th><th>Osobe u mobilnosti</th><th>Ukupno mobilnosti</th><th>Prosječno po osobi</th><th>Erasmus+ nastava</th><th>Erasmus+ usavršavanje</th><th>CEEPUS</th><th>Bilateralni</th><th>Ostalo</th><th>Ukupno dana</th></tr></thead><tbody><tr v-for="row in unitAnalyses" :key="row.organizational_unit_id"><td>{{ row.organizational_unit_short_name || row.organizational_unit_name }}</td><td>{{ row.employee_count }}</td><td>{{ row.people_in_mobility_count }}</td><td>{{ row.mobility_count }}</td><td>{{ row.average_per_person }}</td><td>{{ row.erasmus_teaching_count }}</td><td>{{ row.erasmus_training_count }}</td><td>{{ row.ceepus_count }}</td><td>{{ row.bilateral_count }}</td><td>{{ row.other_count }}</td><td>{{ row.total_days }}</td></tr></tbody></table></div></section>
      <section class="summary"><h2>Osoblje s višestrukim mobilnostima</h2><div class="table"><table><thead><tr><th>Ime i prezime</th><th>Sastavnica</th><th>Broj mobilnosti</th><th>Ukupno dana</th><th>Države</th><th>Programi</th></tr></thead><tbody><tr v-for="row in multipleAnalyses" :key="row.staff_member_id"><td>{{ row.first_name }} {{ row.last_name }}</td><td>{{ row.organizational_unit_short_name || row.organizational_unit_name || '—' }}</td><td>{{ row.mobility_count }}</td><td>{{ row.total_days }}</td><td>{{ row.countries || '—' }}</td><td>{{ row.programs || '—' }}</td></tr><tr v-if="!multipleAnalyses.length"><td colspan="6">Nema osoba s višestrukim mobilnostima.</td></tr></tbody></table></div></section>
      <section class="summary"><h2>Analiza po državama odredišta</h2><div class="table compact"><table><thead><tr><th>Država</th><th>Broj mobilnosti</th><th>Broj osoba</th><th>Ukupno dana</th><th>Najčešći program</th></tr></thead><tbody><tr v-for="row in countryAnalyses" :key="row.country_id"><td>{{ row.country_name }}</td><td>{{ row.mobility_count }}</td><td>{{ row.people_count }}</td><td>{{ row.total_days }}</td><td>{{ row.most_common_program || '—' }}</td></tr><tr v-if="!countryAnalyses.length"><td colspan="5">Nema podataka po državama.</td></tr></tbody></table></div></section>
    </template><div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.overview,.heading,.actions,.metrics{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}.breadcrumbs a:hover{color:rgb(var(--v-theme-primary))}h1{margin:18px 0 0;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.65vw,2.35rem);font-weight:400}h2{font-weight:400}.overview,.heading{justify-content:space-between}.overview{margin-top:36px}.overview label{display:grid;gap:8px;color:rgb(var(--v-theme-primary));font-weight:700}.metrics{gap:28px;flex-wrap:wrap}select,.input{padding:9px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.records,.summary{margin-top:70px}.action{padding:9px 15px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit;text-decoration:none}.action:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.layout{display:grid;grid-template-columns:minmax(320px,.7fr) minmax(620px,1.3fr);gap:clamp(32px,5vw,88px);align-items:start;margin-top:32px}.list{display:grid;gap:5px}.list button{display:grid;gap:5px;padding:13px 16px;border:0;border-radius:7px;background:transparent;color:rgb(var(--v-theme-membership-link));cursor:pointer;text-align:left;font:inherit}.list button span{color:rgb(var(--v-theme-muted));font-size:.9rem}.list button:hover,.list button.selected{background:rgba(var(--v-theme-primary),.1)}.pagination{display:flex;justify-content:center;gap:5px;margin-top:20px}.pagination button{width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:rgb(var(--v-theme-primary));cursor:pointer}.pagination button.active{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.details{display:grid;gap:18px;padding:clamp(28px,3vw,48px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.actions{justify-content:flex-end;gap:8px}dl{display:grid;gap:14px;margin:0}dl>div{display:grid;grid-template-columns:minmax(200px,.85fr) minmax(0,1.15fr);gap:22px}dd{margin:0;overflow-wrap:anywhere;white-space:pre-line}.input{width:100%;box-sizing:border-box}.custom-program{margin-top:7px}.square{display:grid;width:38px;height:38px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-on-surface));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font-size:1.2rem}.minus:hover:not(:disabled){background:rgb(var(--v-theme-error));color:#fff}.table{overflow-x:auto;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px}.table.compact{max-width:900px}.table table{width:100%;border-collapse:collapse}.table th,.table td{padding:11px 12px;border-right:1px solid rgb(var(--v-theme-table-border));border-bottom:1px solid rgb(var(--v-theme-table-border));text-align:left}.table th{border-color:rgb(var(--v-theme-table-header-border));background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.table tr:last-child td{border-bottom:0}.table th:last-child,.table td:last-child{border-right:0}.error{color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:1050px){.layout{grid-template-columns:1fr}}@media(max-width:720px){.view{padding:28px 20px}.overview,.heading{align-items:stretch;flex-direction:column;gap:20px}dl>div{grid-template-columns:1fr}}
</style>
