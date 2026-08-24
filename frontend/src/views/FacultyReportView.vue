<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import api from '../services/api.js'
import EditableReportTable from '../components/EditableReportTable.vue'
import ReadOnlyEvidenceTable from '../components/ReadOnlyEvidenceTable.vue'
import { allTableConfigs, linkedEvidence, reportSections } from '../data/facultyReportConfig.js'

const userId = 1
const periods = ref([])
const units = ref([])
const reports = ref([])
const periodId = ref(null)
const unitId = ref(null)
const report = ref(null)
const draft = ref({})
const tableRows = ref({})
const linkedCounts = ref({})
const linkedRecords = ref({})
const loading = ref(true)
const saving = ref(false)
const syncing = ref(false)
const sidebarOpen = ref(false)
const error = ref('')
const success = ref('')
let toastTimer = null
let scrollFrame = null
const viewStateKey = 'unipu-track-faculty-report-view-state'

const selectedPeriod = computed(() => periods.value.find((item) => Number(item.id) === Number(periodId.value)))
const selectedUnit = computed(() => units.value.find((item) => Number(item.id) === Number(unitId.value)))
const academicYear = computed(() => selectedPeriod.value?.label || '20../20..')
const linkedKeys = computed(() => [...new Set(reportSections.flatMap((section) => section.links || []))])

function toast(message) {
  success.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { success.value = '' }, 4000)
}

function apiError(exception, fallback) {
  const errors = exception.response?.data?.errors
  return Array.isArray(errors) ? errors.join(' ') : exception.response?.data?.message || fallback
}

function dateInput(value) {
  return value ? String(value).slice(0, 10) : ''
}

function makeDraft(item = {}) {
  return {
    dean_name: item.dean_name || '',
    report_date: dateInput(item.report_date),
    ...Object.fromEntries(reportSections.map((section) => [section.narrative, item[section.narrative] || ''])),
  }
}

function readViewState() {
  try {
    return JSON.parse(sessionStorage.getItem(viewStateKey) || '{}')
  } catch {
    return {}
  }
}

function saveViewState() {
  sessionStorage.setItem(viewStateKey, JSON.stringify({
    periodId: periodId.value,
    unitId: unitId.value,
    scrollY: window.scrollY,
  }))
}

function rememberScroll() {
  if (scrollFrame !== null) return
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = null
    saveViewState()
  })
}

async function restoreScroll(scrollY) {
  if (!Number.isFinite(Number(scrollY)) || window.location.hash) return
  await nextTick()
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => window.scrollTo({ top: Number(scrollY), behavior: 'auto' }))
  })
}

async function chooseReport() {
  report.value = reports.value.find((item) =>
    Number(item.reporting_period_id) === Number(periodId.value)
    && Number(item.organizational_unit_id) === Number(unitId.value),
  ) || null
  draft.value = makeDraft(report.value || {})
  tableRows.value = {}
  if (report.value) await loadReportData()
  else await loadLinkedEvidence()
}

async function createReport() {
  if (!periodId.value || !unitId.value) {
    error.value = 'Odaberite izvještajno razdoblje i sastavnicu.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const response = await api.post('/api/faculty/reports', {
      reporting_period_id: Number(periodId.value),
      organizational_unit_id: Number(unitId.value),
      dean_name: draft.value.dean_name.trim() || null,
      report_date: draft.value.report_date || null,
      ...Object.fromEntries(reportSections.map((section) => [section.narrative, null])),
      created_by: userId,
      updated_by: userId,
    })
    reports.value.unshift(response.data)
    report.value = response.data
    draft.value = makeDraft(response.data)
    await loadReportData()
    toast('Glavni obrazac uspješno je napravljen.')
  } catch (exception) {
    error.value = apiError(exception, 'Glavni obrazac nije moguće napraviti.')
  } finally {
    saving.value = false
  }
}

async function saveReport() {
  if (!report.value) return
  saving.value = true
  error.value = ''
  try {
    const payload = {
      dean_name: draft.value.dean_name.trim() || null,
      report_date: draft.value.report_date || null,
      ...Object.fromEntries(reportSections.map((section) => [section.narrative, draft.value[section.narrative].trim() || null])),
      updated_by: userId,
    }
    const response = await api.patch(`/api/faculty/reports/${report.value.id}`, payload)
    report.value = response.data
    const index = reports.value.findIndex((item) => item.id === response.data.id)
    if (index >= 0) reports.value[index] = response.data
    toast('Glavni obrazac uspješno je spremljen.')
  } catch (exception) {
    error.value = apiError(exception, 'Glavni obrazac nije moguće spremiti.')
  } finally {
    saving.value = false
  }
}

async function loadReportData() {
  if (!report.value) return
  syncing.value = true
  const results = await Promise.allSettled(allTableConfigs.map((config) => api.get(`/api/faculty/${config.endpoint}`)))
  const rows = {}
  results.forEach((result, index) => {
    const endpoint = allTableConfigs[index].endpoint
    rows[endpoint] = result.status === 'fulfilled'
      ? result.value.data.filter((item) => Number(item.faculty_report_id) === Number(report.value.id))
      : []
  })
  tableRows.value = rows
  await loadLinkedEvidence()
  syncing.value = false
}

async function loadLinkedEvidence() {
  const results = await Promise.allSettled(linkedKeys.value.map((key) => api.get(linkedEvidence[key].endpoint)))
  const records = Object.fromEntries(results.map((result, index) => {
    const key = linkedKeys.value[index]
    if (result.status !== 'fulfilled') return [key, []]
    const data = Array.isArray(result.value.data) ? result.value.data : []
    const filtered = data.filter((item) => item.reporting_period_id === undefined || Number(item.reporting_period_id) === Number(periodId.value))
    return [key, filtered]
  }))
  linkedRecords.value = records
  linkedCounts.value = Object.fromEntries(linkedKeys.value.map((key) => [key, records[key]?.length ?? 0]))
}

function updateRows(endpoint, rows) {
  tableRows.value = { ...tableRows.value, [endpoint]: rows }
  toast('Tablica je uspješno spremljena.')
}

function exportPdf() {
  document.title = `Izvjesce-${selectedUnit.value?.short_name || 'sastavnica'}-${academicYear.value}`
  window.print()
}

async function load() {
  loading.value = true
  error.value = ''
  let savedScrollY = null
  try {
    const [periodResponse, unitResponse, reportResponse] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/organizational-units'),
      api.get('/api/faculty/reports'),
    ])
    periods.value = periodResponse.data
    units.value = unitResponse.data
    reports.value = reportResponse.data
    const savedState = readViewState()
    savedScrollY = savedState.scrollY
    periodId.value = periods.value.some((item) => Number(item.id) === Number(savedState.periodId))
      ? Number(savedState.periodId)
      : periods.value[0]?.id ?? null
    unitId.value = units.value.some((item) => Number(item.id) === Number(savedState.unitId))
      ? Number(savedState.unitId)
      : units.value[0]?.id ?? null
    await chooseReport()
  } catch (exception) {
    error.value = apiError(exception, 'Glavni obrazac nije moguće učitati.')
  } finally {
    loading.value = false
  }
  if (!error.value) await restoreScroll(savedScrollY)
}

watch([periodId, unitId], () => {
  if (!loading.value) {
    saveViewState()
    chooseReport()
  }
})

onMounted(() => {
  window.addEventListener('scroll', rememberScroll, { passive: true })
  window.addEventListener('beforeunload', saveViewState)
  load()
})

onBeforeUnmount(() => {
  saveViewState()
  window.removeEventListener('scroll', rememberScroll)
  window.removeEventListener('beforeunload', saveViewState)
  if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame)
})
</script>

<template>
  <div class="faculty-report-view">
    <div v-if="loading" class="state-message">Učitavanje glavnog obrasca…</div>
    <template v-else>
      <div class="report-toolbar no-print">
        <div class="selector-field">
          <label for="report-period">Izvještajno razdoblje</label>
          <select id="report-period" v-model="periodId">
            <option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option>
          </select>
        </div>
        <div class="selector-field unit-selector">
          <label for="report-unit">Sastavnica</label>
          <select id="report-unit" v-model="unitId">
            <option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
          </select>
        </div>
        <div class="toolbar-actions">
          <button v-if="report" type="button" :disabled="saving" @click="saveReport">{{ saving ? 'Spremanje…' : 'Spremi obrazac' }}</button>
          <button v-if="report" type="button" :disabled="syncing" @click="loadReportData">{{ syncing ? 'Osvježavanje…' : 'Osvježi povezane podatke' }}</button>
          <button v-if="report" type="button" @click="exportPdf">Izvoz PDF</button>
          <button v-else type="button" :disabled="saving" @click="createReport">Napravi obrazac</button>
        </div>
      </div>

      <p v-if="error" class="error-message no-print">{{ error }}</p>

      <div v-if="!report" class="empty-report no-print">
        <h1>Glavni obrazac</h1>
        <p>Za odabrano razdoblje i sastavnicu još nema izvještaja. Napravite ga kako biste mogli unositi tekst, uređivati tablice i povlačiti povezane evidencije.</p>
      </div>

      <div v-else class="report-workspace">
        <aside :class="['report-sidebar', 'no-print', { 'is-open': sidebarOpen }]">
          <div class="sidebar-panel">
            <h2>Glavni obrazac</h2>
            <nav aria-label="Navigacija kroz glavni obrazac">
              <a href="#report-cover" @click="sidebarOpen = false">Naslovnica</a>
              <a href="#report-intro" @click="sidebarOpen = false">Uvodne napomene</a>
              <a href="#report-contents" @click="sidebarOpen = false">Sadržaj</a>
              <span class="sidebar-divider" aria-hidden="true" />
              <a
                v-for="section in reportSections"
                :key="section.number"
                :href="`#section-${section.narrative}`"
                @click="sidebarOpen = false"
              >
                <strong>{{ section.number }}</strong>
                <span>{{ section.title }}</span>
              </a>
            </nav>
          </div>
          <button
            type="button"
            class="sidebar-handle"
            :aria-expanded="sidebarOpen"
            aria-label="Otvori navigaciju kroz obrazac"
            @click="sidebarOpen = !sidebarOpen"
          >
            <svg class="sidebar-wave" viewBox="0 0 36 74" preserveAspectRatio="none" aria-hidden="true">
              <path class="sidebar-wave-fill" d="M 1 0 L 1 12 C 1 25 18 25 18 37 C 18 49 1 49 1 62 L 1 74 L 0 74 L 0 0 Z" />
              <path class="sidebar-wave-line" d="M 1 0 L 1 12 C 1 25 18 25 18 37 C 18 49 1 49 1 62 L 1 74" />
            </svg>
            <span aria-hidden="true">›</span>
          </button>
        </aside>

        <article class="report-document">
        <section id="report-cover" class="report-cover print-page">
          <div class="cover-top">
            <p class="university-name">SVEUČILIŠTE JURJA DOBRILE U PULI</p>
            <p class="unit-name">{{ selectedUnit?.name || 'Naziv sastavnice' }}</p>
          </div>
          <div class="cover-title">
            <h1>IZVJEŠĆE O RADU I POSLOVANJU FAKULTETA</h1>
            <p>Za akademsku godinu {{ academicYear }}</p>
            <strong class="dean-print-name print-only">{{ draft.dean_name || 'Ime i prezime dekana' }}</strong>
          </div>
          <div class="cover-fields no-print">
            <label>
              <span>Ime i prezime dekana</span>
              <input v-model="draft.dean_name" type="text" />
            </label>
            <label>
              <span>Datum izvješća</span>
              <input v-model="draft.report_date" type="date" />
            </label>
          </div>
          <p class="cover-date">Pula, {{ draft.report_date ? new Intl.DateTimeFormat('hr-HR').format(new Date(draft.report_date)) : '__. __. 20__.' }}</p>
        </section>

        <section class="submission-page print-page">
          <p>Sukladno čl. 42. st. 5. Statuta Sveučilišta podnosim Senatu izvješće o radu i poslovanju fakulteta.</p>
          <div class="signature-block">
            <p>{{ draft.dean_name || 'Ime i prezime dekana' }}</p>
            <span aria-hidden="true">________________________</span>
            <p>Potpis</p>
          </div>
        </section>

        <section id="report-intro" class="intro-page print-page">
          <h2>Uvodne napomene</h2>
          <p>Ovo Izvješće o radu i poslovanju fakulteta odnosno akademije izrađeno je u svrhu sustavnog praćenja provedbe strateških ciljeva Sveučilišta Jurja Dobrile u Puli te objedinjuje pokazatelje i aktivnosti koji proizlaze iz:</p>
          <ul>
            <li>Strategije razvoja Sveučilišta,</li>
            <li>važećeg Programskog ugovora,</li>
            <li>preporuka iz postupka reakreditacije te pripadajućeg Akcijskog plana.</li>
          </ul>
          <p>Cilj ovako strukturiranog obrasca jest objediniti podatke na jednom mjestu kako bi se izbjeglo višestruko traženje istih informacija tijekom akademske godine te osigurala usporedivost i preglednost podataka između sastavnica.</p>
          <p>Izvješće o radu i poslovanju fakulteta odnosno akademije za prethodnu akademsku godinu potrebno je dostaviti najkasnije do <strong>30. listopada tekuće godine.</strong></p>
          <p>Nakon podnošenja pisanog Izvješća, dekan je obvezan isto prezentirati Senatu Sveučilišta, s posebnim naglaskom na ključne rezultate, izazove i planirane aktivnosti za naredno razdoblje.</p>
        </section>

        <section id="report-contents" class="contents-page print-page">
          <h2>Sadržaj</h2>
          <ul class="contents-list">
            <li v-for="section in reportSections" :key="section.number">
              <a :href="`#section-${section.narrative}`"><span>{{ section.number }}</span> {{ section.title }}</a>
            </li>
          </ul>
        </section>

        <section
          v-for="section in reportSections"
          :id="`section-${section.narrative}`"
          :key="section.number"
          class="report-section print-page"
        >
          <p v-if="section.groupTitle" class="section-group-title">{{ section.groupTitle }}</p>
          <h2><span>{{ section.number }}</span> {{ section.title }}</h2>
          <div class="instruction no-print">
            <p>{{ section.hint }}</p>
          </div>
          <label class="narrative-field">
            <textarea v-model="draft[section.narrative]" class="no-print" :maxlength="section.limit" rows="8" />
            <small class="no-print">{{ draft[section.narrative]?.length || 0 }} / {{ section.limit }}</small>
            <p class="narrative-print print-only">{{ draft[section.narrative] || 'Nije uneseno.' }}</p>
          </label>

          <div v-if="section.links?.length" class="linked-evidence">
            <h3 class="no-print">Povezane evidencije iz aplikacije</h3>
            <div class="linked-grid no-print">
              <RouterLink
                v-for="key in section.links"
                :key="key"
                :to="linkedEvidence[key].route"
                class="linked-card"
                target="_blank"
                rel="noopener"
              >
                <span>{{ linkedEvidence[key].label }}</span>
                <strong>{{ linkedCounts[key] === null || linkedCounts[key] === undefined ? '—' : linkedCounts[key] }}</strong>
              </RouterLink>
            </div>
            <ReadOnlyEvidenceTable
              v-for="key in section.links"
              :key="`${key}-table`"
              :title="linkedEvidence[key].label"
              :records="linkedRecords[key] || []"
              :columns="linkedEvidence[key].columns || []"
              :route="linkedEvidence[key].route"
            />
          </div>

          <EditableReportTable
            v-for="table in section.tables"
            :key="table.endpoint"
            :config="table"
            :report-id="report.id"
            :rows="tableRows[table.endpoint] || []"
            @changed="updateRows(table.endpoint, $event)"
            @deleted="toast('Zapis je uspješno izbrisan.')"
          />
        </section>
        </article>
      </div>
    </template>

    <div v-if="success" class="success-snackbar no-print">{{ success }}</div>
  </div>
</template>

<style scoped>
.faculty-report-view { min-height: calc(100vh - 112px); padding: 42px clamp(24px, 5vw, 96px) 90px; background: rgb(var(--v-theme-background)); color: rgb(var(--v-theme-on-background)); }
.state-message, .empty-report { max-width: 920px; margin: 70px auto; text-align: center; }
.report-toolbar { position: sticky; top: 112px; z-index: 5; display: flex; align-items: flex-end; gap: 18px; margin-bottom: 38px; padding: 18px; border: 1px solid rgb(var(--v-theme-table-border)); border-radius: 10px; background: rgba(var(--v-theme-surface), .96); backdrop-filter: blur(10px); }
.selector-field { display: grid; gap: 7px; width: 220px; }
.unit-selector { width: min(420px, 32vw); }
.selector-field label { color: rgb(var(--v-theme-primary)); font-weight: 700; }
.selector-field select, .cover-fields input { min-height: 44px; padding: 9px 12px; border: 1px solid rgb(var(--v-theme-primary)); border-radius: 7px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); font: inherit; }
.toolbar-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; margin-left: auto; }
.toolbar-actions button { min-height: 44px; padding: 9px 17px; border: 1px solid rgb(var(--v-theme-primary)); border-radius: 7px; background: transparent; color: rgb(var(--v-theme-on-surface)); cursor: pointer; font: inherit; }
.toolbar-actions button:hover:not(:disabled) { background: rgba(var(--v-theme-primary), .12); }
.toolbar-actions button:disabled { opacity: .5; }
.error-message { margin: -22px 0 24px; color: rgb(var(--v-theme-error)); }
.report-workspace { max-width: 1760px; margin: 0 auto; }
.report-document { max-width: 1460px; margin: 0 auto; }
.report-sidebar { display: none; }
.sidebar-panel { width: 272px; max-height: calc(100vh - 180px); box-sizing: border-box; overflow-y: auto; padding: 18px 12px; border: 1px solid rgb(var(--v-theme-primary)); border-left: 0; border-radius: 0 12px 12px 0; background: rgb(var(--v-theme-surface)); box-shadow: 7px 5px 24px rgba(0, 0, 0, .14); }
.report-sidebar h2 { margin: 0 10px 14px; font-size: 1.15rem; }
.report-sidebar nav { display: grid; gap: 3px; }
.report-sidebar a { display: flex; gap: 9px; padding: 8px 10px; border-radius: 7px; color: rgb(var(--v-theme-on-surface)); font-size: .88rem; line-height: 1.3; text-decoration: none; transition: background-color 150ms ease, color 150ms ease; }
.report-sidebar a:hover { background: rgba(var(--v-theme-primary), .12); color: rgb(var(--v-theme-primary)); }
.report-sidebar a strong { flex: 0 0 24px; color: rgb(var(--v-theme-primary)); }
.sidebar-divider { height: 1px; margin: 8px 10px; background: rgb(var(--v-theme-table-border)); }
.sidebar-handle { position: absolute; top: 50%; left: 271px; z-index: 1; width: 36px; height: 74px; box-sizing: border-box; padding: 0; border: 0; background: transparent; color: rgb(var(--v-theme-primary)); cursor: pointer; font: inherit; transform: translateY(-50%); }
.sidebar-handle::before { position: absolute; top: 0; bottom: 0; left: -2px; width: 4px; background: rgb(var(--v-theme-surface)); content: ''; }
.sidebar-wave { position: absolute; inset: 0; width: 36px; height: 74px; overflow: visible; filter: drop-shadow(2px 1px 4px rgba(0, 0, 0, .1)); }
.sidebar-wave-fill { fill: rgb(var(--v-theme-surface)); stroke: none; }
.sidebar-wave-line { fill: none; stroke: rgb(var(--v-theme-primary)); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.sidebar-handle span { position: absolute; top: 50%; left: 9px; z-index: 1; display: block; font-size: 1rem; line-height: 1; transform: translate(-50%, -50%); transition: transform 180ms ease; }
.report-cover { min-height: 680px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.cover-top { margin-top: 40px; }
.university-name { margin-bottom: 4px; font-weight: 700; }
.unit-name { margin-top: 0; }
.cover-title { margin-top: 180px; }
.report-cover h1 { max-width: 850px; margin: 0 0 34px; font-size: clamp(2rem, 3.4vw, 4.2rem); line-height: 1.2; }
.cover-title > p { font-size: 1.2rem; font-weight: 700; }
.dean-print-name { display: block; margin-top: 32px; }
.cover-fields { width: min(620px, 100%); display: grid; gap: 18px; margin-top: 70px; }
.cover-fields label { display: grid; grid-template-columns: 210px 1fr; align-items: center; gap: 16px; text-align: left; }
.cover-date { margin-top: auto; margin-bottom: 40px; font-weight: 700; }
.submission-page, .intro-page, .contents-page, .report-section { margin-top: 64px; }
.submission-page { min-height: 680px; padding-top: 70px; }
.signature-block { width: 380px; margin: 90px 0 0 auto; text-align: center; }
.signature-block p { margin: 8px 0; }
.intro-page { max-width: 900px; margin-inline: auto; }
.intro-page h2, .contents-page h2 { text-align: center; }
.intro-page p { text-align: justify; line-height: 1.55; }
.intro-page li { margin-bottom: 8px; }
.contents-page { min-height: 680px; }
.contents-list { display: grid; gap: 11px; padding: 0; list-style: none; }
.contents-list a { display: inline-flex; gap: 7px; color: inherit; text-decoration: none; }
.contents-list a:hover { color: rgb(var(--v-theme-primary)); text-decoration: underline; }
.contents-list a span { min-width: 24px; }
.report-section { scroll-margin-top: 150px; }
.report-cover, .intro-page, .contents-page { scroll-margin-top: 150px; }
.section-group-title { margin: 0 0 10px; color: rgb(var(--v-theme-primary)); font-size: clamp(1rem, 1.4vw, 1.2rem); font-weight: 700; letter-spacing: .01em; }
.report-section > h2 { margin: 0 0 24px; font-size: clamp(1.6rem, 2.2vw, 2.4rem); }
.report-section > h2 span { display: inline-block; min-width: 32px; color: rgb(var(--v-theme-primary)); }
.instruction { margin-bottom: 20px; padding: 18px 20px; border: 1px solid rgb(var(--v-theme-table-border)); border-radius: 9px; background: rgba(var(--v-theme-primary), .08); }
.instruction p { margin: 0; white-space: pre-line; }
.narrative-field { display: grid; gap: 8px; }
.narrative-field > span { color: rgb(var(--v-theme-primary)); font-weight: 700; }
.narrative-field textarea { width: 100%; min-height: 200px; box-sizing: border-box; padding: 16px; border: 1px solid rgb(var(--v-theme-primary)); border-radius: 9px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); font: inherit; line-height: 1.55; resize: vertical; }
.narrative-field small { justify-self: end; color: rgb(var(--v-theme-muted)); }
.linked-evidence { margin-top: 32px; }
.linked-evidence h3 { margin: 0 0 12px; font-size: 1.15rem; font-weight: 500; }
.linked-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.linked-card { display: flex; align-items: center; justify-content: space-between; gap: 15px; min-height: 58px; padding: 12px 15px; border: 1px solid rgb(var(--v-theme-table-border)); border-radius: 8px; color: rgb(var(--v-theme-on-surface)); transition: background-color 160ms ease; }
.linked-card:hover { background: rgba(var(--v-theme-primary), .1); }
.linked-card strong { color: rgb(var(--v-theme-primary)); font-size: 1.2rem; }
.success-snackbar { position: fixed; right: 28px; bottom: 28px; z-index: 20; padding: 14px 18px; border-radius: 7px; background: #b7f5b4; color: #173a17; box-shadow: 0 5px 18px rgba(0,0,0,.18); }
.print-only { display: none; }
@media (max-width: 900px) {
  .report-toolbar { position: static; flex-wrap: wrap; }
  .selector-field, .unit-selector { width: 100%; }
  .toolbar-actions { width: 100%; justify-content: flex-start; margin-left: 0; }
}
@media (min-width: 600px) {
  .report-sidebar { position: fixed; top: 50%; left: 0; z-index: 12; display: block; width: 310px; transform: translate(-272px, -50%); transition: transform 190ms ease; }
  .report-sidebar:hover, .report-sidebar:focus-within, .report-sidebar.is-open { transform: translate(0, -50%); }
  .report-sidebar:hover .sidebar-handle span, .report-sidebar:focus-within .sidebar-handle span, .report-sidebar.is-open .sidebar-handle span { transform: translate(-50%, -50%) rotate(180deg); }
}
@media print {
  :global(.v-app-bar) { display: none !important; }
  :global(.v-main) { padding-top: 0 !important; }
  .faculty-report-view { padding: 0; background: #fff !important; color: #111 !important; }
  .no-print { display: none !important; }
  .print-only { display: block; }
  .report-workspace, .report-document { display: block; max-width: none; }
  .report-document { font-family: Arial, Calibri, sans-serif; font-size: 11pt; }
  .print-page { min-height: 228.6mm; margin: 0; padding: 0; break-before: page; }
  .report-cover { min-height: 228.6mm; break-before: auto; }
  .cover-top { margin-top: 12mm; }
  .cover-title { margin-top: 63mm; }
  .report-cover h1 { margin: 0 0 9mm; font-size: 18pt; }
  .cover-title > p { font-size: 14pt; }
  .dean-print-name { margin-top: 9mm; font-size: 12pt; }
  .cover-date { margin-bottom: 0; }
  .submission-page { padding-top: 22mm; }
  .signature-block { margin-top: 25mm; }
  .intro-page, .contents-page { max-width: none; min-height: 228.6mm; }
  .intro-page h2, .contents-page h2 { margin: 0 0 14mm; font-size: 20pt; }
  .intro-page p { line-height: 1.5; }
  .contents-list { gap: 5mm; }
  .contents-list a { color: #111; text-decoration: none; }
  .report-section > h2 { font-size: 16pt; }
  .section-group-title { margin-bottom: 3mm; color: #111; font-size: 13pt; }
  .report-section > h2 span { min-width: 7mm; color: #111; }
  .narrative-print { min-height: 35mm; margin: 0 0 6mm; white-space: pre-wrap; line-height: 1.45; }
  .linked-grid { display: block; }
  .linked-card { min-height: 0; margin: 0 0 2mm; padding: 0; border: 0; color: #111; }
  .linked-card::before { content: '• '; }
  .linked-card strong { margin-left: 4mm; color: #111; }
  @page { size: Letter portrait; margin: 25.4mm; }
}
</style>
