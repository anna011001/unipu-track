<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const userId = 1
const perPage = 10
const periods = ref([])
const papers = ref([])
const summaries = ref([])
const periodId = ref(null)
const selectedPaper = ref(null)
const paperForm = ref(null)
const page = ref(1)
const detailsCard = ref(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const editError = ref('')
const success = ref('')
let timer = null

const categories = [
  { value: 'WOS_SCOPUS_Q1_Q2', label: 'Radovi u časopisima indeksirani u WoS/Scopus (Q1–Q2)' },
  { value: 'WOS_SCOPUS_Q3_Q4', label: 'Radovi u časopisima indeksirani u WoS/Scopus (Q3–Q4)' },
  { value: 'OTHER_INTERNATIONAL_JOURNALS', label: 'Radovi u ostalim međunarodnim časopisima' },
  { value: 'DOMESTIC_JOURNALS', label: 'Radovi u domaćim časopisima' },
  { value: 'BOOK_CHAPTERS', label: 'Poglavlja u knjigama' },
  { value: 'CONFERENCE_PROCEEDINGS', label: 'Radovi u zbornicima skupova' },
  { value: 'TOTAL', label: 'Ukupno' },
]

const periodPapers = computed(() => papers.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)))
const periodSummaries = computed(() => summaries.value.filter((item) => Number(item.reporting_period_id) === Number(periodId.value)))
const years = computed(() => [...new Set([
  ...periodPapers.value.map((item) => Number(item.publication_year)),
  ...periodSummaries.value.map((item) => Number(item.calendar_year)),
])].filter(Boolean).sort((a, b) => b - a))
const filtered = computed(() => periodPapers.value)
const pages = computed(() => Math.ceil(filtered.value.length / perPage))
const shown = computed(() => filtered.value.slice((page.value - 1) * perPage, page.value * perPage))

function display(value) { return value === null || value === undefined || value === '' ? '—' : value }
function categoryLabel(value) { return categories.find((item) => item.value === value)?.label || value }
function safeLink(value) { if (!value) return null; try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null } }
function apiError(exception, fallback) { const errors = exception.response?.data?.errors; return Array.isArray(errors) ? errors.join(' ') : exception.response?.data?.message || fallback }
function toast(message) { success.value = message; if (timer) clearTimeout(timer); timer = setTimeout(() => { success.value = '' }, 4000) }
function summaryCell(category, year) { return periodSummaries.value.find((item) => item.category === category && Number(item.calendar_year) === Number(year)) || null }
async function refreshSummaries() {
  const response = await api.get('/api/coauthorships/category-summaries')
  summaries.value = response.data
}

function choosePaper(item) { selectedPaper.value = item; paperForm.value = null; editError.value = '' }
function startPaperEdit() { paperForm.value = { authors_and_title: selectedPaper.value.authors_and_title, publication_year: selectedPaper.value.publication_year, category: selectedPaper.value.category || '', publication_link: selectedPaper.value.publication_link || '' } }
function cancelPaperEdit() { paperForm.value = null; editError.value = '' }

async function savePaper() {
  if (!paperForm.value.authors_and_title.trim() || !paperForm.value.category) { editError.value = 'Autori, naslov i kategorija rada su obavezni.'; return }
  saving.value = true
  try {
    const response = await api.patch(`/api/coauthorships/papers/${selectedPaper.value.id}`, {
      authors_and_title: paperForm.value.authors_and_title.trim(),
      publication_year: Number(paperForm.value.publication_year),
      category: paperForm.value.category,
      publication_link: paperForm.value.publication_link.trim() || null,
      updated_by: userId,
    })
    const updated = { ...selectedPaper.value, ...response.data }
    const index = papers.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) papers.value[index] = updated
    selectedPaper.value = updated
    await refreshSummaries()
    paperForm.value = null
    toast('Koautorski rad uspješno je izmijenjen.')
  } catch (exception) {
    editError.value = apiError(exception, 'Koautorski rad nije moguće izmijeniti.')
  } finally { saving.value = false }
}

async function deletePaper() {
  if (!confirm('Želite li izbrisati odabrani koautorski rad?')) return
  saving.value = true
  try {
    await api.delete(`/api/coauthorships/papers/${selectedPaper.value.id}`)
    papers.value = papers.value.filter((item) => item.id !== selectedPaper.value.id)
    await refreshSummaries()
    selectedPaper.value = null
    paperForm.value = null
    page.value = Math.min(page.value, Math.max(1, pages.value))
    toast('Koautorski rad uspješno je izbrisan.')
  } catch (exception) {
    editError.value = apiError(exception, 'Koautorski rad nije moguće izbrisati.')
  } finally { saving.value = false }
}

async function openFromRoute() {
  const id = Number(route.query.id)
  if (!id) return
  const item = papers.value.find((entry) => Number(entry.id) === id)
  if (!item) return
  periodId.value = item.reporting_period_id
  await nextTick()
  page.value = Math.floor(filtered.value.findIndex((entry) => entry.id === id) / perPage) + 1
  selectedPaper.value = item
  await nextTick()
  detailsCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function load() {
  try {
    const [periodResponse, paperResponse, summaryResponse] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/coauthorships/papers'),
      api.get('/api/coauthorships/category-summaries'),
    ])
    periods.value = periodResponse.data
    papers.value = paperResponse.data
    summaries.value = summaryResponse.data
    periodId.value = periods.value[0]?.id ?? null
    await openFromRoute()
  } catch (exception) { error.value = apiError(exception, 'Nije moguće dohvatiti koautorstva.') } finally { loading.value = false }
}

watch(periodId, () => { page.value = 1; selectedPaper.value = null; paperForm.value = null })
onMounted(load)
onUnmounted(() => { if (timer) clearTimeout(timer) })
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs"><RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink><span>›</span><span>Koautorstva</span></nav>
    <h1>Evidencija koautorstva na znanstvenim radovima</h1>
    <p v-if="loading">Učitavanje...</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <template v-else>
      <section class="overview">
        <label>Izvještajno razdoblje<select v-model.number="periodId"><option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option></select></label>
        <strong>Ukupno radova: {{ periodPapers.length }}</strong>
      </section>

      <section class="records">
        <header class="heading"><h2>Popis radova u koautorstvu ({{ filtered.length }})</h2><RouterLink class="action" to="/istrazivanje-i-razvoj/koautorstva/novo">Dodaj novi rad</RouterLink></header>
        <div v-if="filtered.length" class="layout">
          <div><div class="list"><button v-for="item in shown" :key="item.id" :class="{ selected: selectedPaper?.id === item.id }" @click="choosePaper(item)"><strong>{{ item.authors_and_title }}</strong></button></div><div v-if="pages > 1" class="pagination"><button v-for="number in pages" :key="number" :class="{ active: page === number }" @click="page = number">{{ number }}</button></div></div>
          <dl v-if="selectedPaper" ref="detailsCard" class="details">
            <div class="actions"><button v-if="!paperForm" class="action" @click="startPaperEdit">Uredi</button><template v-else><button class="action" :disabled="saving" @click="savePaper">{{ saving ? 'Spremanje...' : 'Spremi' }}</button><button class="action" :disabled="saving" @click="cancelPaperEdit">Odustani</button><button class="square minus" :disabled="saving" @click="deletePaper">−</button></template></div>
            <p v-if="editError" class="error">{{ editError }}</p>
            <div><dt>Autori i naslov rada</dt><dd><textarea v-if="paperForm" v-model="paperForm.authors_and_title" class="input" rows="5"></textarea><template v-else>{{ selectedPaper.authors_and_title }}</template></dd></div>
            <div><dt>Godina objave</dt><dd><input v-if="paperForm" v-model="paperForm.publication_year" class="input" type="number" min="2000" :max="new Date().getFullYear() + 1"><template v-else>{{ selectedPaper.publication_year }}.</template></dd></div>
            <div><dt>Kategorija rada</dt><dd><select v-if="paperForm" v-model="paperForm.category" class="input"><option value="" disabled>Odaberite kategoriju</option><option v-for="category in categories.slice(0, -1)" :key="category.value" :value="category.value">{{ category.label }}</option></select><template v-else>{{ selectedPaper.category ? categoryLabel(selectedPaper.category) : 'Nije određena' }}</template></dd></div>
            <div><dt>Link na objavljeni rad</dt><dd><input v-if="paperForm" v-model="paperForm.publication_link" class="input"><a v-else-if="safeLink(selectedPaper.publication_link)" :href="safeLink(selectedPaper.publication_link)" target="_blank">{{ selectedPaper.publication_link }}</a><template v-else>{{ display(selectedPaper.publication_link) }}</template></dd></div>
          </dl>
        </div>
        <p v-else>Nema koautorskih radova.</p>
      </section>

      <section class="summary-section">
        <h2>Pregled po kategorijama radova</h2>
        <div class="table category-table"><table><thead><tr><th>Kategorija rada</th><th v-for="year in years" :key="year">{{ year }}.</th><th v-if="!years.length">Broj radova</th></tr></thead><tbody><tr v-for="category in categories" :key="category.value" :class="{ total: category.value === 'TOTAL' }"><td>{{ category.label }}</td><td v-for="year in years" :key="year">{{ summaryCell(category.value, year)?.paper_count ?? '—' }}</td><td v-if="!years.length">—</td></tr></tbody></table></div>
      </section>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.overview,.heading,.filters,.actions,.toolbar{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}.breadcrumbs a:hover{color:rgb(var(--v-theme-primary))}
h1{margin:18px 0 0;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.65vw,2.35rem);font-weight:400}h2{font-weight:400}.overview,.heading{justify-content:space-between}.overview{margin-top:36px}.overview label{display:grid;gap:8px;color:rgb(var(--v-theme-primary));font-weight:700}
select,.input,.table-input{padding:9px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.filters{flex-wrap:wrap;gap:10px;margin-top:44px}.filters button,.action,.table-button{padding:9px 15px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}.filters button{border-radius:999px}.filters .active,.filters button:hover,.action:hover,.table-button:hover:not(:disabled),.plus:hover{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}
.records,.summary-section{margin-top:70px}.layout{display:grid;grid-template-columns:minmax(380px,1.1fr) minmax(440px,.9fr);gap:clamp(32px,5vw,88px);align-items:start;margin-top:32px}.list{display:grid;gap:5px}.list button{display:grid;gap:5px;padding:13px 16px;border:0;border-radius:7px;background:transparent;color:rgb(var(--v-theme-membership-link));cursor:pointer;text-align:left;font:inherit;line-height:1.45}.list button span{color:rgb(var(--v-theme-muted))}.list button:hover,.list button.selected{background:rgba(var(--v-theme-primary),.1)}.pagination{display:flex;justify-content:center;gap:5px;margin-top:20px}.pagination button{width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:rgb(var(--v-theme-primary))}.pagination button.active{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}
.details{display:grid;gap:14px;margin:0;padding:clamp(28px,3vw,48px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.details>div:not(.actions){display:grid;grid-template-columns:minmax(160px,.9fr) minmax(0,1.1fr);gap:22px}.details dd{margin:0;overflow-wrap:anywhere}.actions{justify-content:flex-end;gap:8px}.input{width:100%;box-sizing:border-box}
.square{display:grid;width:30px;height:30px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-on-surface));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font-size:1.2rem}.minus:hover:not(:disabled){background:rgb(var(--v-theme-error));color:#fff}.square:disabled,.table-button:disabled{cursor:not-allowed;opacity:.5}
.summary-section h2{margin-top:54px}.toolbar{justify-content:flex-end;gap:7px;margin-bottom:10px}.toolbar .table-button{height:30px;padding:0 12px}.table-input{width:100%;min-width:110px;box-sizing:border-box}.new-summary-fields{display:grid;grid-template-columns:repeat(2,minmax(130px,1fr));gap:10px}
.table{overflow-x:auto;border-radius:10px}.table table{width:100%;border-collapse:collapse}.table th,.table td{padding:13px 15px;border:1px solid rgb(var(--v-theme-table-border));text-align:left}.table th{border-color:rgb(var(--v-theme-table-header-border));background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.table tr.total{font-weight:700;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.table tr.total td{border-color:rgb(var(--v-theme-table-header-border))}
.category-table{width:fit-content;max-width:100%}.category-table table{width:auto;min-width:680px}.category-table th:first-child,.category-table td:first-child{width:500px}.category-table th:not(:first-child),.category-table td:not(:first-child){min-width:110px;text-align:center}
a{color:rgb(var(--v-theme-evidence-link))}.error{color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}
@media(max-width:900px){.layout{grid-template-columns:1fr}}
@media(max-width:650px){.view{padding:28px 20px}.overview,.heading{align-items:stretch;flex-direction:column;gap:20px}.details>div:not(.actions){grid-template-columns:1fr}.new-summary-fields{grid-template-columns:1fr}}
</style>
