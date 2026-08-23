<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'
import ExportButton from '../components/ExportButton.vue'

const route = useRoute()
const userId = 1
const perPage = 10

const periods = ref([])
const applications = ref([])
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

const projectTypes = [
  { value: 'DOMESTIC', label: 'Domaći' },
  { value: 'INTERNATIONAL', label: 'Međunarodni' },
]

const statuses = [
  { value: 'APPROVED', label: 'Odobren' },
  { value: 'REJECTED', label: 'Odbijen' },
]

const filtered = computed(() =>
  applications.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)),
)
const pageCount = computed(() => Math.ceil(filtered.value.length / perPage))
const shown = computed(() => filtered.value.slice((page.value - 1) * perPage, page.value * perPage))

function display(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

function labelFor(items, value) {
  return items.find((item) => item.value === value)?.label || display(value)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(date)
}

function dateInput(value) {
  return value ? String(value).slice(0, 10) : ''
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(Number(value))
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
  snackbarTimer = setTimeout(() => { success.value = '' }, 4000)
}

function choose(item) {
  selected.value = item
  form.value = null
  editError.value = ''
}

function startEdit() {
  form.value = {
    proposal_name: selected.value.proposal_name,
    funding_source: selected.value.funding_source ?? '',
    call_name: selected.value.call_name ?? '',
    call_link: selected.value.call_link ?? '',
    unipu_role: selected.value.unipu_role ?? '',
    involved_units: selected.value.involved_units ?? '',
    partner_institutions: selected.value.partner_institutions ?? '',
    total_project_amount_eur: selected.value.total_project_amount_eur ?? '',
    unipu_share_eur: selected.value.unipu_share_eur ?? '',
    implementation_duration: selected.value.implementation_duration ?? '',
    project_type: selected.value.project_type ?? '',
    planned_activities: selected.value.planned_activities ?? '',
    unipu_project_team: selected.value.unipu_project_team ?? '',
    submission_deadline: dateInput(selected.value.submission_deadline),
    application_status: selected.value.application_status ?? '',
    contract_or_partnership_reference: selected.value.contract_or_partnership_reference ?? '',
    contract_project_code: selected.value.contract_project_code ?? '',
    notes: selected.value.notes ?? '',
  }
}

function cancelEdit() {
  form.value = null
  editError.value = ''
}

async function save() {
  editError.value = ''
  if (!form.value.proposal_name.trim()) {
    editError.value = 'Naziv projektnog prijedloga je obavezan.'
    return
  }

  saving.value = true
  try {
    const response = await api.patch(`/api/project-applications/${selected.value.id}`, {
      proposal_name: form.value.proposal_name.trim(),
      funding_source: optionalText(form.value.funding_source),
      call_name: optionalText(form.value.call_name),
      call_link: optionalText(form.value.call_link),
      unipu_role: optionalText(form.value.unipu_role),
      involved_units: optionalText(form.value.involved_units),
      partner_institutions: optionalText(form.value.partner_institutions),
      total_project_amount_eur: optionalNumber(form.value.total_project_amount_eur),
      unipu_share_eur: optionalNumber(form.value.unipu_share_eur),
      implementation_duration: optionalText(form.value.implementation_duration),
      project_type: form.value.project_type || null,
      planned_activities: optionalText(form.value.planned_activities),
      unipu_project_team: optionalText(form.value.unipu_project_team),
      submission_deadline: form.value.submission_deadline || null,
      application_status: form.value.application_status || null,
      contract_or_partnership_reference: optionalText(form.value.contract_or_partnership_reference),
      contract_project_code: optionalText(form.value.contract_project_code),
      notes: optionalText(form.value.notes),
      updated_by: userId,
    })

    const updated = { ...selected.value, ...response.data }
    const index = applications.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) applications.value[index] = updated
    selected.value = updated
    form.value = null
    toast('Projektna prijava uspješno je izmijenjena.')
  } catch (exception) {
    editError.value = apiError(exception, 'Projektnu prijavu nije moguće izmijeniti.')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm(`Želite li izbrisati projektnu prijavu „${selected.value.proposal_name}”?`)) return
  deleting.value = true
  try {
    await api.delete(`/api/project-applications/${selected.value.id}`)
    applications.value = applications.value.filter((item) => item.id !== selected.value.id)
    selected.value = null
    form.value = null
    page.value = Math.min(page.value, Math.max(1, pageCount.value))
    toast('Projektna prijava uspješno je izbrisana.')
  } catch (exception) {
    editError.value = apiError(exception, 'Projektnu prijavu nije moguće izbrisati.')
  } finally {
    deleting.value = false
  }
}

async function openFromRoute() {
  const id = Number(route.query.id)
  if (!id) return
  const item = applications.value.find((entry) => Number(entry.id) === id)
  if (!item) return
  periodId.value = item.reporting_period_id
  await nextTick()
  page.value = Math.floor(filtered.value.findIndex((entry) => entry.id === id) / perPage) + 1
  selected.value = item
  await nextTick()
  detailsCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function load() {
  loading.value = true
  try {
    const [periodResponse, applicationResponse] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/project-applications'),
    ])
    periods.value = periodResponse.data
    applications.value = applicationResponse.data
    periodId.value = periods.value[0]?.id ?? null
    await openFromRoute()
  } catch (exception) {
    error.value = apiError(exception, 'Nije moguće dohvatiti projektne prijave.')
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
onUnmounted(() => { if (snackbarTimer) clearTimeout(snackbarTimer) })
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs">
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink>
      <span>›</span><span>Projektne prijave</span>
    </nav>
    <h1>Evidencija projektnih prijava i realizacije</h1>

    <p v-if="loading">Učitavanje...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <template v-else>
      <section class="overview">
        <label>
          Izvještajno razdoblje
          <select v-model.number="periodId">
            <option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option>
          </select>
        </label>
        <strong>Broj novih projektnih prijava: {{ filtered.length }}</strong>
        <ExportButton :records="filtered" file-name="projektne-prijave" />
      </section>

      <section class="records">
        <header class="heading">
          <h2>Podneseni projektni prijedlozi ({{ filtered.length }})</h2>
          <RouterLink class="action" to="/istrazivanje-i-razvoj/projektne-prijave/nova">Dodaj novu prijavu</RouterLink>
        </header>

        <div v-if="filtered.length" class="layout">
          <div>
            <div class="list">
              <button v-for="item in shown" :key="item.id" :class="{ selected: selected?.id === item.id }" @click="choose(item)">
                <strong>{{ item.proposal_name }}</strong>
                <span>{{ labelFor(statuses, item.application_status) }}</span>
              </button>
            </div>
            <div v-if="pageCount > 1" class="pagination">
              <button v-for="number in pageCount" :key="number" :class="{ active: page === number }" @click="page = number">{{ number }}</button>
            </div>
          </div>

          <dl v-if="selected" ref="detailsCard" class="details">
            <div class="actions">
              <button v-if="!form" class="action" @click="startEdit">Uredi</button>
              <template v-else>
                <button class="action" :disabled="saving || deleting" @click="save">{{ saving ? 'Spremanje...' : 'Spremi' }}</button>
                <button class="action" :disabled="saving || deleting" @click="cancelEdit">Odustani</button>
                <button class="square minus" :disabled="saving || deleting" @click="remove">−</button>
              </template>
            </div>
            <p v-if="editError" class="error">{{ editError }}</p>

            <div><dt>Naziv projektnog prijedloga</dt><dd><textarea v-if="form" v-model="form.proposal_name" class="input" rows="3"></textarea><template v-else>{{ selected.proposal_name }}</template></dd></div>
            <div><dt>Izvor financiranja</dt><dd><input v-if="form" v-model="form.funding_source" class="input"><template v-else>{{ display(selected.funding_source) }}</template></dd></div>
            <div><dt>Poziv / natječaj</dt><dd><input v-if="form" v-model="form.call_name" class="input"><template v-else>{{ display(selected.call_name) }}</template></dd></div>
            <div><dt>Poveznica na poziv</dt><dd><input v-if="form" v-model="form.call_link" class="input" type="url"><a v-else-if="safeLink(selected.call_link)" :href="safeLink(selected.call_link)" target="_blank" rel="noopener">{{ selected.call_link }}</a><template v-else>{{ display(selected.call_link) }}</template></dd></div>
            <div><dt>Uloga UNIPU-a</dt><dd><input v-if="form" v-model="form.unipu_role" class="input"><template v-else>{{ display(selected.unipu_role) }}</template></dd></div>
            <div><dt>Uključene sastavnice</dt><dd><textarea v-if="form" v-model="form.involved_units" class="input" rows="3"></textarea><template v-else>{{ display(selected.involved_units) }}</template></dd></div>
            <div><dt>Partnerske institucije</dt><dd><textarea v-if="form" v-model="form.partner_institutions" class="input" rows="3"></textarea><template v-else>{{ display(selected.partner_institutions) }}</template></dd></div>
            <div><dt>Ukupni iznos projekta</dt><dd><input v-if="form" v-model="form.total_project_amount_eur" class="input" type="number" min="0" max="999999.99" step="0.01"><template v-else>{{ formatMoney(selected.total_project_amount_eur) }}</template></dd></div>
            <div><dt>Udio UNIPU-a</dt><dd><input v-if="form" v-model="form.unipu_share_eur" class="input" type="number" min="0" max="999999.99" step="0.01"><template v-else>{{ formatMoney(selected.unipu_share_eur) }}</template></dd></div>
            <div><dt>Trajanje provedbe</dt><dd><input v-if="form" v-model="form.implementation_duration" class="input"><template v-else>{{ display(selected.implementation_duration) }}</template></dd></div>
            <div><dt>Vrsta projekta</dt><dd><select v-if="form" v-model="form.project_type" class="input"><option value="">Nije odabrano</option><option v-for="item in projectTypes" :key="item.value" :value="item.value">{{ item.label }}</option></select><template v-else>{{ labelFor(projectTypes, selected.project_type) }}</template></dd></div>
            <div><dt>Planirane aktivnosti</dt><dd><textarea v-if="form" v-model="form.planned_activities" class="input" rows="4"></textarea><template v-else>{{ display(selected.planned_activities) }}</template></dd></div>
            <div><dt>Projektni tim UNIPU-a</dt><dd><textarea v-if="form" v-model="form.unipu_project_team" class="input" rows="3"></textarea><template v-else>{{ display(selected.unipu_project_team) }}</template></dd></div>
            <div><dt>Rok za prijavu</dt><dd><input v-if="form" v-model="form.submission_deadline" class="input" type="date"><template v-else>{{ formatDate(selected.submission_deadline) }}</template></dd></div>
            <div><dt>Status prijave</dt><dd><select v-if="form" v-model="form.application_status" class="input"><option value="">Nije odabrano</option><option v-for="item in statuses" :key="item.value" :value="item.value">{{ item.label }}</option></select><template v-else>{{ labelFor(statuses, selected.application_status) }}</template></dd></div>
            <div><dt>Ugovor ili sporazum o partnerstvu</dt><dd><input v-if="form" v-model="form.contract_or_partnership_reference" class="input"><template v-else>{{ display(selected.contract_or_partnership_reference) }}</template></dd></div>
            <div><dt>Šifra projekta po ugovoru</dt><dd><input v-if="form" v-model="form.contract_project_code" class="input"><template v-else>{{ display(selected.contract_project_code) }}</template></dd></div>
            <div><dt>Napomena</dt><dd><textarea v-if="form" v-model="form.notes" class="input" rows="4"></textarea><template v-else>{{ display(selected.notes) }}</template></dd></div>
          </dl>
        </div>
        <p v-else>Nema projektnih prijava za odabrano izvještajno razdoblje.</p>
      </section>
    </template>

    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.overview,.heading,.actions{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}.breadcrumbs a:hover{color:rgb(var(--v-theme-primary))}h1{margin:18px 0 0;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.65vw,2.35rem);font-weight:400}h2{font-weight:400}.overview,.heading{justify-content:space-between}.overview{margin-top:36px}.overview label{display:grid;gap:8px;color:rgb(var(--v-theme-primary));font-weight:700}select,.input{padding:9px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.records{margin-top:70px}.action{padding:9px 15px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit;text-decoration:none}.action:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.layout{display:grid;grid-template-columns:minmax(360px,.8fr) minmax(570px,1.2fr);gap:clamp(32px,5vw,88px);align-items:start;margin-top:32px}.list{display:grid;gap:5px}.list button{display:grid;gap:5px;padding:13px 16px;border:0;border-radius:7px;background:transparent;color:rgb(var(--v-theme-membership-link));cursor:pointer;text-align:left;font:inherit;line-height:1.45}.list button span{color:rgb(var(--v-theme-muted));font-size:.9rem}.list button:hover,.list button.selected{background:rgba(var(--v-theme-primary),.1)}.pagination{display:flex;justify-content:center;gap:5px;margin-top:20px}.pagination button{width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:rgb(var(--v-theme-primary));cursor:pointer}.pagination button.active{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.details{display:grid;gap:14px;margin:0;padding:clamp(28px,3vw,48px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.details>div:not(.actions){display:grid;grid-template-columns:minmax(190px,.85fr) minmax(0,1.15fr);gap:22px}.details dd{margin:0;overflow-wrap:anywhere;white-space:pre-line}.actions{justify-content:flex-end;gap:8px}.input{width:100%;box-sizing:border-box}.square{display:grid;width:38px;height:38px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-on-surface));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font-size:1.2rem}.minus:hover:not(:disabled){background:rgb(var(--v-theme-error));color:#fff}.action:disabled,.square:disabled{cursor:not-allowed;opacity:.5}a{color:rgb(var(--v-theme-evidence-link))}.error{color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:1000px){.layout{grid-template-columns:1fr}}@media(max-width:650px){.view{padding:28px 20px}.overview,.heading{align-items:stretch;flex-direction:column;gap:20px}.details>div:not(.actions){grid-template-columns:1fr}}
</style>
