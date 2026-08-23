<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'
import ExportButton from '../components/ExportButton.vue'

const route = useRoute()
const userId = 1
const periods = ref([])
const reports = ref([])
const overloads = ref([])
const promotions = ref([])
const summaries = ref([])
const staff = ref([])
const units = ref([])
const periodId = ref(null)
const unitId = ref(null)
const selected = ref(null)
const selectedOverloadId = ref(null)
const editingOverloadId = ref(null)
const overloadForm = ref(null)
const selectedPromotionId = ref(null)
const editingPromotionId = ref(null)
const promotionForm = ref(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
let snackbarTimer = null

const selectedPeriod = computed(() => periods.value.find((item) => Number(item.id) === Number(periodId.value)))
const relatedOverloads = computed(() => overloads.value.filter((item) => Number(item.report_id) === Number(selected.value?.id)))
const relatedPromotions = computed(() => promotions.value.filter((item) => Number(item.report_id) === Number(selected.value?.id)))
const selectedSummary = computed(() => summaries.value.find((item) => Number(item.report_id) === Number(selected.value?.id)))
function countListedCourses(value) {
  return String(value ?? '')
    .split(/[\n;]+/)
    .filter((course) => course.trim()).length
}
function uniqueStaffCount(items) {
  return new Set(items.map((item) => Number(item.staff_member_id)).filter(Boolean)).size
}
function uniqueHolderCount() {
  const holders = [
    ...relatedOverloads.value.map((item) => item.proposed_course_holder),
    ...relatedPromotions.value.map((item) => item.replacement_course_holder),
  ].map((holder) => String(holder ?? '').trim().toLocaleLowerCase('hr')).filter(Boolean)
  return new Set(holders).size
}
function researchHours(value) {
  const match = String(value ?? '').match(/\d+/)
  return match ? Number(match[0]) : 0
}
const derivedSummary = computed(() => ({
  teachers_over_norm_count: uniqueStaffCount(relatedOverloads.value),
  teachers_in_reelection_count: uniqueStaffCount(relatedPromotions.value),
  redistribution_hours:
    relatedOverloads.value.reduce((sum, item) => sum + Number(item.planned_reduction || 0), 0) +
    relatedPromotions.value.reduce((sum, item) => sum + Math.max(Number(item.current_load || 0) - Number(item.proposed_load || 0), 0), 0),
  courses_for_redistribution_count: [...relatedOverloads.value, ...relatedPromotions.value]
    .reduce((sum, item) => sum + countListedCourses(item.courses_to_reassign), 0),
  replacement_holders_needed: uniqueHolderCount(),
  estimated_research_time_hours: relatedPromotions.value.reduce((sum, item) => sum + researchHours(item.research_time), 0),
}))

function display(value) { return value === null || value === undefined || value === '' ? '—' : value }
function optionalText(value) { return String(value ?? '').trim() || null }
function optionalNumber(value) { return value === '' || value === null || value === undefined ? null : Number(value) }
function dateInput(value) { return value ? String(value).slice(0, 10) : '' }
function formatDate(value) { if (!value) return '—'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(parsed) }
function staffMember(id) { return staff.value.find((item) => Number(item.id) === Number(id)) }
function staffName(id) { const item = staffMember(id); return item ? `${item.first_name} ${item.last_name}` : '—' }
function apiError(exception, fallback) { const errors = exception.response?.data?.errors; return Array.isArray(errors) ? errors.join(' ') : exception.response?.data?.message || fallback }
function toast(message) { success.value = message; if (snackbarTimer) clearTimeout(snackbarTimer); snackbarTimer = setTimeout(() => { success.value = '' }, 4000) }

function resetRecordSelection() {
  selectedOverloadId.value = null
  selectedPromotionId.value = null
  editingOverloadId.value = null
  editingPromotionId.value = null
  overloadForm.value = null
  promotionForm.value = null
  error.value = ''
}

function selectCurrentReport() {
  selected.value = reports.value.find((item) =>
    Number(item.reporting_period_id) === Number(periodId.value) &&
    Number(item.organizational_unit_id) === Number(unitId.value)
  ) || null
  resetRecordSelection()
}

async function createReport() {
  if (!periodId.value || !unitId.value) { error.value = 'Odaberite akademsku godinu i sastavnicu.'; return }
  saving.value = true
  error.value = ''
  let reportId = null
  try {
    const response = await api.post('/api/schedule-optimizations/reports', {
      reporting_period_id: Number(periodId.value),
      organizational_unit_id: Number(unitId.value),
      academic_year: String(selectedPeriod.value?.label || '').slice(0, 11),
      created_by: userId,
      updated_by: userId,
    })
    reportId = response.data.id
    const summaryResponse = await api.post('/api/schedule-optimizations/summaries', {
      report_id: reportId,
      teachers_over_norm_count: 0,
      teachers_in_reelection_count: 0,
      redistribution_hours: 0,
      courses_for_redistribution_count: 0,
      replacement_holders_needed: 0,
      estimated_research_time_hours: 0,
      created_by: userId,
      updated_by: userId,
    })
    reports.value.push(response.data)
    summaries.value.push(summaryResponse.data)
    selected.value = response.data
    toast('Izvješće uspješno je kreirano.')
  } catch (exception) {
    if (reportId) await api.delete(`/api/schedule-optimizations/reports/${reportId}`).catch(() => {})
    error.value = apiError(exception, 'Izvješće nije moguće kreirati.')
  } finally { saving.value = false }
}

async function deleteReport() {
  if (!selected.value || !confirm('Želite li izbrisati izvješće i sve njegove povezane zapise?')) return
  saving.value = true
  error.value = ''
  const reportId = selected.value.id
  try {
    await api.delete(`/api/schedule-optimizations/reports/${reportId}`)
    reports.value = reports.value.filter((item) => item.id !== reportId)
    overloads.value = overloads.value.filter((item) => item.report_id !== reportId)
    promotions.value = promotions.value.filter((item) => item.report_id !== reportId)
    summaries.value = summaries.value.filter((item) => item.report_id !== reportId)
    selected.value = null
    resetRecordSelection()
    toast('Izvješće uspješno je izbrisano.')
  } catch (exception) { error.value = apiError(exception, 'Izvješće nije moguće izbrisati.') } finally { saving.value = false }
}

function emptyOverload() { return { staff_member_id: '', teaching_norm: '', current_load: '', overload_percent: '', courses_to_reassign: '', relief_proposal: '', proposed_course_holder: '', planned_reduction: '', status: '', notes: '' } }
function startNewOverload() { editingOverloadId.value = 'new'; selectedOverloadId.value = null; overloadForm.value = emptyOverload() }
function startOverloadEdit() { const item = relatedOverloads.value.find((entry) => entry.id === selectedOverloadId.value); if (!item) return; editingOverloadId.value = item.id; overloadForm.value = { ...item } }
function cancelOverloadEdit() { editingOverloadId.value = null; overloadForm.value = null }
async function saveOverload() {
  if (!overloadForm.value.staff_member_id) { error.value = 'Nastavnik je obavezan.'; return }
  saving.value = true
  error.value = ''
  try {
    const payload = { staff_member_id: Number(overloadForm.value.staff_member_id), teaching_norm: optionalNumber(overloadForm.value.teaching_norm), current_load: optionalNumber(overloadForm.value.current_load), overload_percent: optionalNumber(overloadForm.value.overload_percent), courses_to_reassign: optionalText(overloadForm.value.courses_to_reassign), relief_proposal: optionalText(overloadForm.value.relief_proposal), proposed_course_holder: optionalText(overloadForm.value.proposed_course_holder), planned_reduction: optionalNumber(overloadForm.value.planned_reduction), status: optionalText(overloadForm.value.status), notes: optionalText(overloadForm.value.notes), updated_by: userId }
    const response = editingOverloadId.value === 'new' ? await api.post('/api/schedule-optimizations/overload-cases', { ...payload, report_id: selected.value.id, created_by: userId }) : await api.patch(`/api/schedule-optimizations/overload-cases/${editingOverloadId.value}`, payload)
    const index = overloads.value.findIndex((item) => item.id === response.data.id)
    if (index >= 0) overloads.value[index] = response.data; else overloads.value.push(response.data)
    selectedOverloadId.value = response.data.id
    cancelOverloadEdit()
    await syncSummary()
    toast(index >= 0 ? 'Prekoračenje norme uspješno je izmijenjeno.' : 'Prekoračenje norme uspješno je dodano.')
  } catch (exception) { error.value = apiError(exception, 'Zapis nije moguće spremiti.') } finally { saving.value = false }
}
async function deleteOverload() {
  const item = relatedOverloads.value.find((entry) => entry.id === selectedOverloadId.value)
  if (!item || !confirm(`Želite li izbrisati zapis za „${staffName(item.staff_member_id)}”?`)) return
  saving.value = true
  try { await api.delete(`/api/schedule-optimizations/overload-cases/${item.id}`); overloads.value = overloads.value.filter((entry) => entry.id !== item.id); selectedOverloadId.value = null; cancelOverloadEdit(); await syncSummary(); toast('Prekoračenje norme uspješno je izbrisano.') } catch (exception) { error.value = apiError(exception, 'Zapis nije moguće izbrisati.') } finally { saving.value = false }
}

function emptyPromotion() { return { staff_member_id: '', current_title: '', candidate_title: '', election_deadline: '', current_load: '', proposed_load: '', courses_to_reassign: '', replacement_course_holder: '', research_time: '', procedure_status: '', notes: '' } }
function startNewPromotion() { editingPromotionId.value = 'new'; selectedPromotionId.value = null; promotionForm.value = emptyPromotion() }
function startPromotionEdit() { const item = relatedPromotions.value.find((entry) => entry.id === selectedPromotionId.value); if (!item) return; editingPromotionId.value = item.id; promotionForm.value = { ...item, election_deadline: dateInput(item.election_deadline) } }
function cancelPromotionEdit() { editingPromotionId.value = null; promotionForm.value = null }
function useStaffTitle() { if (editingPromotionId.value === 'new') promotionForm.value.current_title = staffMember(promotionForm.value.staff_member_id)?.academic_title || '' }
async function savePromotion() {
  if (!promotionForm.value.staff_member_id) { error.value = 'Nastavnik je obavezan.'; return }
  saving.value = true
  error.value = ''
  try {
    const payload = { staff_member_id: Number(promotionForm.value.staff_member_id), current_title: optionalText(promotionForm.value.current_title), candidate_title: optionalText(promotionForm.value.candidate_title), election_deadline: promotionForm.value.election_deadline || null, current_load: optionalNumber(promotionForm.value.current_load), proposed_load: optionalNumber(promotionForm.value.proposed_load), courses_to_reassign: optionalText(promotionForm.value.courses_to_reassign), replacement_course_holder: optionalText(promotionForm.value.replacement_course_holder), research_time: optionalNumber(promotionForm.value.research_time), procedure_status: optionalText(promotionForm.value.procedure_status), notes: optionalText(promotionForm.value.notes), updated_by: userId }
    const response = editingPromotionId.value === 'new' ? await api.post('/api/schedule-optimizations/promotion-cases', { ...payload, report_id: selected.value.id, created_by: userId }) : await api.patch(`/api/schedule-optimizations/promotion-cases/${editingPromotionId.value}`, payload)
    const index = promotions.value.findIndex((item) => item.id === response.data.id)
    if (index >= 0) promotions.value[index] = response.data; else promotions.value.push(response.data)
    selectedPromotionId.value = response.data.id
    cancelPromotionEdit()
    await syncSummary()
    toast(index >= 0 ? 'Postupak izbora uspješno je izmijenjen.' : 'Postupak izbora uspješno je dodan.')
  } catch (exception) { error.value = apiError(exception, 'Zapis nije moguće spremiti.') } finally { saving.value = false }
}
async function deletePromotion() {
  const item = relatedPromotions.value.find((entry) => entry.id === selectedPromotionId.value)
  if (!item || !confirm(`Želite li izbrisati zapis za „${staffName(item.staff_member_id)}”?`)) return
  saving.value = true
  try { await api.delete(`/api/schedule-optimizations/promotion-cases/${item.id}`); promotions.value = promotions.value.filter((entry) => entry.id !== item.id); selectedPromotionId.value = null; cancelPromotionEdit(); await syncSummary(); toast('Postupak izbora uspješno je izbrisan.') } catch (exception) { error.value = apiError(exception, 'Zapis nije moguće izbrisati.') } finally { saving.value = false }
}

async function syncSummary() {
  await nextTick()
  const current = selectedSummary.value
  const payload = { ...derivedSummary.value, updated_by: userId }
  const response = current ? await api.patch(`/api/schedule-optimizations/summaries/${current.id}`, payload) : await api.post('/api/schedule-optimizations/summaries', { ...payload, report_id: selected.value.id, created_by: userId })
  const index = summaries.value.findIndex((item) => item.id === response.data.id)
  if (index >= 0) summaries.value[index] = response.data; else summaries.value.push(response.data)
}
async function openFromRoute() {
  const id = Number(route.query.id)
  if (!id) return false
  const item = reports.value.find((entry) => Number(entry.id) === id)
  if (!item) return false
  periodId.value = item.reporting_period_id
  unitId.value = item.organizational_unit_id
  await nextTick()
  selected.value = item
  return true
}
async function load() {
  try {
    const [periodResponse, reportResponse, overloadResponse, promotionResponse, summaryResponse, staffResponse, unitResponse] = await Promise.all([api.get('/api/reporting-periods'), api.get('/api/schedule-optimizations/reports'), api.get('/api/schedule-optimizations/overload-cases'), api.get('/api/schedule-optimizations/promotion-cases'), api.get('/api/schedule-optimizations/summaries'), api.get('/api/staff-members'), api.get('/api/organizational-units')])
    periods.value = periodResponse.data
    reports.value = reportResponse.data
    overloads.value = overloadResponse.data
    promotions.value = promotionResponse.data
    summaries.value = summaryResponse.data
    staff.value = staffResponse.data
    units.value = unitResponse.data
    const openedFromRoute = await openFromRoute()
    if (!openedFromRoute) {
      periodId.value = periods.value[0]?.id ?? null
      unitId.value = units.value[0]?.id ?? null
      selectCurrentReport()
    }
  } catch (exception) { error.value = apiError(exception, 'Nije moguće dohvatiti prijedloge optimiziranog rasporeda.') } finally { loading.value = false }
}
watch([periodId, unitId], selectCurrentReport)
onMounted(load)
onUnmounted(() => { if (snackbarTimer) clearTimeout(snackbarTimer) })
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs">
      <RouterLink to="/nastava-i-kvaliteta">Nastava i kvaliteta</RouterLink><span>›</span><span>Optimizacija rasporeda nastavnika</span>
    </nav>
    <h1>Prijedlog optimiziranog rasporeda nastavnika</h1>
    <p v-if="loading">Učitavanje...</p>
    <template v-else>
      <p v-if="error" class="error">{{ error }}</p>
      <section class="selectors export-row">
        <label>Akademska godina
          <select v-model.number="periodId"><option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option></select>
        </label>
        <label>Sastavnica
          <select v-model.number="unitId"><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select>
        </label>
        <ExportButton :records="[...relatedOverloads.map((item) => ({ vrsta_zapisa: 'Prekoračenje norme', ...item })), ...relatedPromotions.map((item) => ({ vrsta_zapisa: 'Izbor ili reizbor', ...item }))]" file-name="optimizacija-rasporeda" />
      </section>

      <section v-if="!selected" class="empty-report">
        <div><h2>Izvješće još nije kreirano</h2><p>Za odabranu akademsku godinu i sastavnicu nema podataka.</p></div>
        <button class="action" :disabled="saving || !periodId || !unitId" @click="createReport">Kreiraj izvješće</button>
      </section>

      <template v-else>
        <div class="report-bar">
          <p>Prikazani su podaci za <strong>{{ selected.academic_year }}</strong> i sastavnicu <strong>{{ selected.organizational_unit_name }}</strong>.</p>
          <button class="delete-report" :disabled="saving" @click="deleteReport">Izbriši izvješće</button>
        </div>

        <section class="data-section">
          <div class="section-title"><h2>Nastavnici s prekoračenjem norme (&gt;15%)</h2><div class="toolbar"><template v-if="editingOverloadId"><button class="table-button" :disabled="saving" @click="saveOverload">Spremi</button><button class="table-button" :disabled="saving" @click="cancelOverloadEdit">Odustani</button></template><button v-else class="table-button" :disabled="!selectedOverloadId" @click="startOverloadEdit">Uredi</button><button class="plus" :disabled="Boolean(editingOverloadId)" @click="startNewOverload">+</button><button class="minus" :disabled="!selectedOverloadId || Boolean(editingOverloadId)" @click="deleteOverload">−</button></div></div>
          <div class="records">
            <article v-if="editingOverloadId === 'new'" class="record selected-record form-grid">
              <label>Ime i prezime<select v-model="overloadForm.staff_member_id"><option value="">Odaberite</option><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select></label>
              <div class="field"><span>Zvanje</span><strong>{{ staffMember(overloadForm.staff_member_id)?.academic_title || '—' }}</strong></div>
              <label>Nastavna norma<input v-model="overloadForm.teaching_norm" type="number" min="0"></label><label>Trenutno opterećenje<input v-model="overloadForm.current_load" type="number" min="0"></label><label>Prekoračenje (%)<input v-model="overloadForm.overload_percent" type="number" min="0" step="0.01"></label><label>Planirano smanjenje<input v-model="overloadForm.planned_reduction" type="number" min="0"></label><label>Status<input v-model="overloadForm.status"></label><label>Predloženi nositelj<input v-model="overloadForm.proposed_course_holder"></label><label class="wide">Kolegiji za preraspodjelu<textarea v-model="overloadForm.courses_to_reassign" placeholder="Jedan kolegij u svaki red"></textarea><small>Svaki kolegij upišite u novi red.</small></label><label class="wide">Prijedlog rasterećenja<textarea v-model="overloadForm.relief_proposal"></textarea></label><label class="wide">Napomena<textarea v-model="overloadForm.notes"></textarea></label>
            </article>
            <article v-for="(item, index) in relatedOverloads" :key="item.id" class="record" :class="{ 'selected-record': selectedOverloadId === item.id }" @click="selectedOverloadId = item.id">
              <template v-if="editingOverloadId === item.id">
                <div class="form-grid">
                  <label>Ime i prezime<select v-model="overloadForm.staff_member_id" @click.stop><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select></label><div class="field"><span>Zvanje</span><strong>{{ staffMember(overloadForm.staff_member_id)?.academic_title || '—' }}</strong></div><label>Nastavna norma<input v-model="overloadForm.teaching_norm" type="number" min="0" @click.stop></label><label>Trenutno opterećenje<input v-model="overloadForm.current_load" type="number" min="0" @click.stop></label><label>Prekoračenje (%)<input v-model="overloadForm.overload_percent" type="number" min="0" step="0.01" @click.stop></label><label>Planirano smanjenje<input v-model="overloadForm.planned_reduction" type="number" min="0" @click.stop></label><label>Status<input v-model="overloadForm.status" @click.stop></label><label>Predloženi nositelj<input v-model="overloadForm.proposed_course_holder" @click.stop></label><label class="wide">Kolegiji za preraspodjelu<textarea v-model="overloadForm.courses_to_reassign" placeholder="Jedan kolegij u svaki red" @click.stop></textarea><small>Svaki kolegij upišite u novi red.</small></label><label class="wide">Prijedlog rasterećenja<textarea v-model="overloadForm.relief_proposal" @click.stop></textarea></label><label class="wide">Napomena<textarea v-model="overloadForm.notes" @click.stop></textarea></label>
                </div>
              </template>
              <template v-else>
                <div class="record-number">{{ index + 1 }}</div><div class="field"><span>Ime i prezime</span><strong>{{ staffName(item.staff_member_id) }}</strong></div><div class="field"><span>Zvanje</span><strong>{{ staffMember(item.staff_member_id)?.academic_title || '—' }}</strong></div><div class="field"><span>Nastavna norma</span><strong>{{ display(item.teaching_norm) }}</strong></div><div class="field"><span>Trenutno opterećenje</span><strong>{{ display(item.current_load) }}</strong></div><div class="field"><span>Prekoračenje (%)</span><strong>{{ display(item.overload_percent) }}</strong></div><div class="field"><span>Planirano smanjenje</span><strong>{{ display(item.planned_reduction) }}</strong></div><div class="field"><span>Status</span><strong>{{ display(item.status) }}</strong></div><div class="field"><span>Predloženi nositelj</span><strong>{{ display(item.proposed_course_holder) }}</strong></div><div class="field wide"><span>Kolegiji za preraspodjelu</span><strong>{{ display(item.courses_to_reassign) }}</strong></div><div class="field wide"><span>Prijedlog rasterećenja</span><strong>{{ display(item.relief_proposal) }}</strong></div><div class="field wide"><span>Napomena</span><strong>{{ display(item.notes) }}</strong></div>
              </template>
            </article>
            <p v-if="!relatedOverloads.length && editingOverloadId !== 'new'" class="empty-row">Nema nastavnika s prekoračenjem norme.</p>
          </div>
        </section>

        <section class="data-section">
          <div class="section-title"><h2>Nastavnici u postupku izbora ili reizbora</h2><div class="toolbar"><template v-if="editingPromotionId"><button class="table-button" :disabled="saving" @click="savePromotion">Spremi</button><button class="table-button" :disabled="saving" @click="cancelPromotionEdit">Odustani</button></template><button v-else class="table-button" :disabled="!selectedPromotionId" @click="startPromotionEdit">Uredi</button><button class="plus" :disabled="Boolean(editingPromotionId)" @click="startNewPromotion">+</button><button class="minus" :disabled="!selectedPromotionId || Boolean(editingPromotionId)" @click="deletePromotion">−</button></div></div>
          <div class="records">
            <article v-if="editingPromotionId === 'new'" class="record selected-record form-grid">
              <label>Ime i prezime<select v-model="promotionForm.staff_member_id" @change="useStaffTitle"><option value="">Odaberite</option><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select></label><label>Trenutno zvanje<input v-model="promotionForm.current_title"></label><label>Kandidira za zvanje<input v-model="promotionForm.candidate_title"></label><label>Rok za izbor<input v-model="promotionForm.election_deadline" type="date"></label><label>Trenutno opterećenje<input v-model="promotionForm.current_load" type="number" min="0"></label><label>Predloženo opterećenje<input v-model="promotionForm.proposed_load" type="number" min="0"></label><label>Zamjenski nositelj<input v-model="promotionForm.replacement_course_holder"></label><label>Vrijeme za istraživanje (sati)<input v-model="promotionForm.research_time" type="number" min="0"></label><label>Status postupka<input v-model="promotionForm.procedure_status"></label><label class="courses-field">Kolegiji za preraspodjelu<textarea v-model="promotionForm.courses_to_reassign" placeholder="Jedan kolegij u svaki red"></textarea><small>Svaki kolegij upišite u novi red.</small></label><label class="notes-field">Napomena<textarea v-model="promotionForm.notes"></textarea></label>
            </article>
            <article v-for="(item, index) in relatedPromotions" :key="item.id" class="record" :class="{ 'selected-record': selectedPromotionId === item.id }" @click="selectedPromotionId = item.id">
              <template v-if="editingPromotionId === item.id">
                <div class="form-grid"><label>Ime i prezime<select v-model="promotionForm.staff_member_id" @click.stop><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select></label><label>Trenutno zvanje<input v-model="promotionForm.current_title" @click.stop></label><label>Kandidira za zvanje<input v-model="promotionForm.candidate_title" @click.stop></label><label>Rok za izbor<input v-model="promotionForm.election_deadline" type="date" @click.stop></label><label>Trenutno opterećenje<input v-model="promotionForm.current_load" type="number" min="0" @click.stop></label><label>Predloženo opterećenje<input v-model="promotionForm.proposed_load" type="number" min="0" @click.stop></label><label>Zamjenski nositelj<input v-model="promotionForm.replacement_course_holder" @click.stop></label><label>Vrijeme za istraživanje (sati)<input v-model="promotionForm.research_time" type="number" min="0" @click.stop></label><label>Status postupka<input v-model="promotionForm.procedure_status" @click.stop></label><label class="courses-field">Kolegiji za preraspodjelu<textarea v-model="promotionForm.courses_to_reassign" placeholder="Jedan kolegij u svaki red" @click.stop></textarea><small>Svaki kolegij upišite u novi red.</small></label><label class="notes-field">Napomena<textarea v-model="promotionForm.notes" @click.stop></textarea></label></div>
              </template>
              <template v-else>
                <div class="record-number">{{ index + 1 }}</div><div class="field"><span>Ime i prezime</span><strong>{{ staffName(item.staff_member_id) }}</strong></div><div class="field"><span>Trenutno zvanje</span><strong>{{ display(item.current_title) }}</strong></div><div class="field"><span>Kandidira za zvanje</span><strong>{{ display(item.candidate_title) }}</strong></div><div class="field"><span>Rok za izbor</span><strong>{{ formatDate(item.election_deadline) }}</strong></div><div class="field"><span>Trenutno opterećenje</span><strong>{{ display(item.current_load) }}</strong></div><div class="field"><span>Predloženo opterećenje</span><strong>{{ display(item.proposed_load) }}</strong></div><div class="field"><span>Zamjenski nositelj</span><strong>{{ display(item.replacement_course_holder) }}</strong></div><div class="field"><span>Vrijeme za istraživanje (sati)</span><strong>{{ display(item.research_time) }}</strong></div><div class="field"><span>Status postupka</span><strong>{{ display(item.procedure_status) }}</strong></div><div class="field wide"><span>Kolegiji za preraspodjelu</span><strong>{{ display(item.courses_to_reassign) }}</strong></div><div class="field wide"><span>Napomena</span><strong>{{ display(item.notes) }}</strong></div>
              </template>
            </article>
            <p v-if="!relatedPromotions.length && editingPromotionId !== 'new'" class="empty-row">Nema nastavnika u postupku izbora ili reizbora.</p>
          </div>
        </section>

        <section class="summary"><div class="section-title"><h2>Sažetak prijedloga optimizacije</h2></div><div class="summary-box"><div><span>Nastavnici s prekoračenjem norme</span><strong>{{ derivedSummary.teachers_over_norm_count }}</strong></div><div><span>Nastavnici u postupku izbora/reizbora</span><strong>{{ derivedSummary.teachers_in_reelection_count }}</strong></div><div><span>Ukupno sati za preraspodjelu</span><strong>{{ derivedSummary.redistribution_hours }}</strong></div><div><span>Broj kolegija za preraspodjelu</span><strong>{{ derivedSummary.courses_for_redistribution_count }}</strong></div><div><span>Potreban broj zamjenskih nositelja</span><strong>{{ derivedSummary.replacement_holders_needed }}</strong></div><div><span>Procijenjeno oslobođeno vrijeme za istraživanje (sati)</span><strong>{{ derivedSummary.estimated_research_time_hours }}</strong></div></div></section>
      </template>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(24px,5vw,110px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.selectors,.section-title,.toolbar,.report-bar{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}.breadcrumbs a:hover{color:rgb(var(--v-theme-primary))}h1{margin:18px 0 0;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.65vw,2.35rem);font-weight:400}h2{margin:0;font-weight:400}.selectors{gap:24px;margin-top:38px}.selectors label,.form-grid label{display:grid;gap:7px;color:rgb(var(--v-theme-primary));font-weight:700}.selectors select{min-width:240px}select,input,textarea{box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.form-grid small{color:rgb(var(--v-theme-muted));font-size:.75rem;font-weight:400}.empty-report,.report-bar{justify-content:space-between;gap:28px;margin-top:46px;padding:25px 28px;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-surface))}.empty-report{display:flex;align-items:center}.empty-report p,.report-bar p{margin:7px 0 0}.action,.delete-report,.table-button{padding:9px 15px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}.action:hover:not(:disabled),.table-button:hover:not(:disabled),.plus:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.delete-report:hover:not(:disabled),.minus:hover:not(:disabled){background:rgb(var(--v-theme-error));color:#fff}.report-bar{margin-top:34px}.report-bar p{margin:0}.data-section,.summary{margin-top:64px}.section-title{justify-content:space-between;gap:24px;margin-bottom:16px}.toolbar{flex-shrink:0;gap:7px}.table-button{height:32px;padding:0 12px}.plus,.minus{display:grid;width:32px;height:32px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-category-border));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font-size:1.2rem}button:disabled{cursor:not-allowed;opacity:.5}.records{display:grid;gap:14px}.record{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px 24px;padding:24px 26px;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-surface));cursor:pointer}.record:hover,.selected-record{background:rgba(var(--v-theme-primary),.08);box-shadow:inset 4px 0 0 rgb(var(--v-theme-primary))}.record-number{position:absolute;top:10px;right:13px;color:rgb(var(--v-theme-muted));font-size:.85rem}.field{display:grid;align-content:start;gap:6px;min-width:0}.field span{color:rgb(var(--v-theme-primary));font-size:.82rem;font-weight:700}.field strong{overflow-wrap:anywhere;font-weight:400;white-space:pre-line}.wide{grid-column:span 2}.form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%}.record>.form-grid{grid-column:1/-1}.form-grid label{min-width:0}.form-grid textarea{min-height:78px;resize:vertical}.empty-row{margin:0;padding:24px 26px;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;color:rgb(var(--v-theme-muted))}.summary-box{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;overflow:hidden;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-border))}.summary-box>div{display:grid;gap:10px;padding:22px;background:rgb(var(--v-theme-surface))}.summary-box strong{font-size:1.35rem;color:rgb(var(--v-theme-primary))}.error{margin-top:24px;color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:1100px){.record,.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.summary-box{grid-template-columns:1fr 1fr}}@media(max-width:700px){.view{padding:28px 20px}.selectors,.section-title,.report-bar,.empty-report{align-items:stretch;flex-direction:column}.selectors select{min-width:0}.record,.form-grid,.summary-box{grid-template-columns:1fr}.wide{grid-column:auto}}

/* Zapisi su oblikovani poput žutih kartica s detaljima na ostalim stranicama. */
.record {
  gap: 22px 26px;
  padding: clamp(28px, 3vw, 46px);
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
  cursor: pointer;
}

.record:hover,
.record.selected-record {
  background: rgb(var(--v-theme-category-card-hover));
  box-shadow: none;
}

.record .form-grid,
.record.form-grid {
  gap: 22px 26px;
  align-items: start;
}

.record label,
.record .field span {
  color: rgb(var(--v-theme-on-category-card));
}

.record label {
  align-self: start;
  align-content: start;
}

.record .field strong {
  line-height: 1.45;
}

.record input,
.record select,
.record textarea {
  border-color: rgb(var(--v-theme-on-category-card));
  outline: none;
}

.record input,
.record select {
  min-height: 44px;
}

.record textarea {
  min-height: 90px;
}

.record input:focus,
.record select:focus,
.record textarea:focus {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-on-category-card), .2);
}

.record .form-grid small {
  color: rgb(var(--v-theme-on-category-card));
  opacity: .78;
}

.record .courses-field {
  grid-column: span 3;
}

.record .notes-field {
  grid-column: 1 / -1;
}

.record-number {
  color: rgb(var(--v-theme-on-category-card));
  opacity: .75;
}

@media(max-width:1100px) {
  .record .form-grid,
  .record.form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .record .courses-field {
    grid-column: auto;
  }
}

@media(max-width:700px) {
  .record .form-grid,
  .record.form-grid {
    grid-template-columns: 1fr;
  }

  .record .notes-field {
    grid-column: auto;
  }
}
</style>
