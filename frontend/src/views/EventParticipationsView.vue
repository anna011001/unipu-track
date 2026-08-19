<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const currentUserId = 1
const perPage = 10
const periods = ref([])
const records = ref([])
const confirmations = ref([])
const mediaRecords = ref([])
const staff = ref([])
const units = ref([])
const selectedPeriodId = ref(null)
const selectedType = ref('ALL')
const selected = ref(null)
const editForm = ref(null)
const currentPage = ref(1)
const detailsCard = ref(null)
const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const errorMessage = ref('')
const editError = ref('')
const successMessage = ref('')
const editingConfirmationId = ref(null)
const selectedConfirmationId = ref(null)
const confirmationTableForm = ref(null)
const editingMediaId = ref(null)
const selectedMediaId = ref(null)
const mediaTableForm = ref(null)
const tableSaving = ref(false)
let successTimer = null

const types = [
  { value: 'ALL', label: 'Sve vrste' },
  { value: 'ORAL_PRESENTATION', label: 'Usmeno izlaganje' },
  { value: 'POSTER_PRESENTATION', label: 'Postersko izlaganje' },
  { value: 'PLENARY_LECTURE', label: 'Plenarno predavanje' },
  { value: 'PANELIST', label: 'Panelist' },
  { value: 'ORGANIZING_COMMITTEE_MEMBER', label: 'Član organizacijskog odbora' },
]

const filtered = computed(() => records.value.filter((record) =>
  Number(record.reporting_period_id) === Number(selectedPeriodId.value) &&
  (selectedType.value === 'ALL' || record.participation_type === selectedType.value),
))
const pageCount = computed(() => Math.ceil(filtered.value.length / perPage))
const paginated = computed(() => filtered.value.slice((currentPage.value - 1) * perPage, currentPage.value * perPage))
const periodIds = computed(() => new Set(records.value.filter((record) => Number(record.reporting_period_id) === Number(selectedPeriodId.value)).map((record) => Number(record.id))))
const periodConfirmations = computed(() => confirmations.value.filter((item) => periodIds.value.has(Number(item.event_participation_id))))
const periodMedia = computed(() => mediaRecords.value.filter((item) => periodIds.value.has(Number(item.event_participation_id))))
const relatedConfirmations = computed(() => confirmations.value.filter((item) => Number(item.event_participation_id) === Number(selected.value?.id)))
const relatedMedia = computed(() => mediaRecords.value.filter((item) => Number(item.event_participation_id) === Number(selected.value?.id)))

function optionalNumber(value) { return value === '' || value === null || value === undefined ? null : Number(value) }
function display(value) { return value === null || value === undefined || value === '' ? '—' : value }
function typeLabel(value) { return types.find((type) => type.value === value)?.label || value || '—' }
function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(date) }
function dateInput(value) { return value ? String(value).slice(0, 10) : '' }
function staffName(record) { return `${record.staff_first_name || ''} ${record.staff_last_name || ''}`.trim() || '—' }
function selectedStaffName(id) { const member = staff.value.find((item) => Number(item.id) === Number(id)); return member ? `${member.first_name} ${member.last_name}` : '—' }
function academicTitle(id) { return staff.value.find((item) => Number(item.id) === Number(id))?.academic_title || '—' }
function unitName(id) { const unit = units.value.find((item) => Number(item.id) === Number(id)); return unit ? unit.short_name || unit.name : '—' }
function link(value) { if (!value) return null; try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null } }
function apiError(error, fallback) { const errors = error.response?.data?.errors; return Array.isArray(errors) ? errors.join(' ') : error.response?.data?.message || fallback }
function showSuccess(message) { successMessage.value = message; if (successTimer) clearTimeout(successTimer); successTimer = setTimeout(() => { successMessage.value = '' }, 4000) }

function selectRecord(record) { selected.value = record; editForm.value = null; editError.value = '' }
function startEdit() {
  const record = selected.value
  editForm.value = {
    staff_member_id: record.staff_member_id,
    organizational_unit_id: record.organizational_unit_id ?? '',
    participation_type: record.participation_type,
    event_name: record.event_name,
    organizer_name: record.organizer_name ?? '',
    location: record.location ?? '',
    event_date: dateInput(record.event_date),
    presentation_title: record.presentation_title ?? '',
    program_link: record.program_link ?? '',
    notes: record.notes ?? '',
    confirmations: relatedConfirmations.value.map((item) => ({ ...item, confirmation_date: dateInput(item.confirmation_date) })),
    media: relatedMedia.value.map((item) => ({ ...item, published_on: dateInput(item.published_on) })),
    deletedConfirmationIds: [],
    deletedMediaIds: [],
  }
}
function cancelEdit() { editForm.value = null; editError.value = '' }
function addConfirmation() { editForm.value.confirmations.push({ temporaryId: crypto.randomUUID(), event_name: editForm.value.event_name, committee_president_name: '', organizer_institution: editForm.value.organizer_name, confirmation_date: '', impressum_link: '' }) }
function addMedia() { editForm.value.media.push({ temporaryId: crypto.randomUUID(), event_name: editForm.value.event_name, media_type: '', media_link: '', published_on: '' }) }
function removeConfirmation(item) { if (!item.id) { editForm.value.confirmations = editForm.value.confirmations.filter((entry) => entry.temporaryId !== item.temporaryId); return } if (confirm(`Želite li ukloniti potvrdu za „${item.event_name}”?`)) { editForm.value.deletedConfirmationIds.push(item.id); editForm.value.confirmations = editForm.value.confirmations.filter((entry) => entry.id !== item.id) } }
function removeMedia(item) { if (!item.id) { editForm.value.media = editForm.value.media.filter((entry) => entry.temporaryId !== item.temporaryId); return } if (confirm(`Želite li ukloniti medijsku objavu za „${item.event_name}”?`)) { editForm.value.deletedMediaIds.push(item.id); editForm.value.media = editForm.value.media.filter((entry) => entry.id !== item.id) } }

async function saveEdit() {
  const form = editForm.value
  editError.value = ''
  if (!form.staff_member_id || !form.participation_type || !form.event_name.trim()) { editError.value = 'Ime i prezime, vrsta sudjelovanja i naziv događanja su obavezni.'; return }
  if (form.confirmations.some((item) => !item.event_name.trim()) || form.media.some((item) => !item.event_name.trim() || !item.media_link.trim())) { editError.value = 'Popunite obavezna polja povezanih zapisa.'; return }
  saving.value = true
  try {
    const confirmationResponses = await Promise.all(form.confirmations.map((item) => item.id
      ? api.patch(`/api/event-participations/confirmations/${item.id}`, { event_name: item.event_name.trim(), committee_president_name: item.committee_president_name.trim() || null, organizer_institution: item.organizer_institution.trim() || null, confirmation_date: item.confirmation_date || null, impressum_link: item.impressum_link.trim() || null, updated_by: currentUserId })
      : api.post('/api/event-participations/confirmations', { event_participation_id: selected.value.id, event_name: item.event_name.trim(), committee_president_name: item.committee_president_name.trim() || null, organizer_institution: item.organizer_institution.trim() || null, confirmation_date: item.confirmation_date || null, impressum_link: item.impressum_link.trim() || null, created_by: currentUserId, updated_by: currentUserId })))
    const mediaResponses = await Promise.all(form.media.map((item) => item.id
      ? api.patch(`/api/event-participations/media/${item.id}`, { event_name: item.event_name.trim(), media_type: item.media_type.trim() || null, media_link: item.media_link.trim(), published_on: item.published_on || null, updated_by: currentUserId })
      : api.post('/api/event-participations/media', { event_participation_id: selected.value.id, event_name: item.event_name.trim(), media_type: item.media_type.trim() || null, media_link: item.media_link.trim(), published_on: item.published_on || null, created_by: currentUserId, updated_by: currentUserId })))
    const response = await api.patch(`/api/event-participations/${selected.value.id}`, { staff_member_id: Number(form.staff_member_id), organizational_unit_id: optionalNumber(form.organizational_unit_id), participation_type: form.participation_type, event_name: form.event_name.trim(), organizer_name: form.organizer_name.trim() || null, location: form.location.trim() || null, event_date: form.event_date || null, presentation_title: form.presentation_title.trim() || null, program_link: form.program_link.trim() || null, notes: form.notes.trim() || null, updated_by: currentUserId })
    await Promise.all([...form.deletedConfirmationIds.map((id) => api.delete(`/api/event-participations/confirmations/${id}`)), ...form.deletedMediaIds.map((id) => api.delete(`/api/event-participations/media/${id}`))])
    confirmations.value = confirmations.value.filter((item) => !form.deletedConfirmationIds.includes(item.id))
    mediaRecords.value = mediaRecords.value.filter((item) => !form.deletedMediaIds.includes(item.id))
    for (const result of confirmationResponses) { const index = confirmations.value.findIndex((item) => item.id === result.data.id); index < 0 ? confirmations.value.push(result.data) : confirmations.value[index] = result.data }
    for (const result of mediaResponses) { const index = mediaRecords.value.findIndex((item) => item.id === result.data.id); index < 0 ? mediaRecords.value.push(result.data) : mediaRecords.value[index] = result.data }
    const member = staff.value.find((item) => Number(item.id) === Number(response.data.staff_member_id))
    const updated = { ...selected.value, ...response.data, staff_first_name: member?.first_name || '', staff_last_name: member?.last_name || '' }
    const index = records.value.findIndex((item) => item.id === updated.id); if (index >= 0) records.value[index] = updated
    selected.value = updated; editForm.value = null; showSuccess('Sudjelovanje uspješno je izmijenjeno.')
  } catch (error) { editError.value = apiError(error, 'Sudjelovanje nije moguće izmijeniti.') } finally { saving.value = false }
}

async function deleteRecord() {
  if (!confirm(`Želite li izbrisati sudjelovanje „${selected.value.event_name}”?`)) return
  deleting.value = true
  try { await api.delete(`/api/event-participations/${selected.value.id}`); records.value = records.value.filter((item) => item.id !== selected.value.id); selected.value = null; editForm.value = null; currentPage.value = Math.min(currentPage.value, Math.max(1, pageCount.value)); showSuccess('Sudjelovanje uspješno je izbrisano.') } catch (error) { editError.value = apiError(error, 'Sudjelovanje nije moguće izbrisati.') } finally { deleting.value = false }
}

function startConfirmationTableEdit(item) {
  editingConfirmationId.value = item.id
  confirmationTableForm.value = { ...item, confirmation_date: dateInput(item.confirmation_date) }
}
function startNewConfirmationTableRow() {
  const record = selected.value && Number(selected.value.reporting_period_id) === Number(selectedPeriodId.value)
    ? selected.value
    : records.value.find((item) => Number(item.reporting_period_id) === Number(selectedPeriodId.value))
  editingConfirmationId.value = 'new'
  selectedConfirmationId.value = null
  confirmationTableForm.value = { id: null, event_participation_id: record?.id ?? null, event_name: record?.event_name ?? '', committee_president_name: '', organizer_institution: record?.organizer_name ?? '', confirmation_date: '', impressum_link: '' }
}
function cancelConfirmationTableEdit() { editingConfirmationId.value = null; confirmationTableForm.value = null }
function startMediaTableEdit(item) { editingMediaId.value = item.id; mediaTableForm.value = { ...item, published_on: dateInput(item.published_on) } }
function startNewMediaTableRow() {
  const record = selected.value && Number(selected.value.reporting_period_id) === Number(selectedPeriodId.value)
    ? selected.value
    : records.value.find((item) => Number(item.reporting_period_id) === Number(selectedPeriodId.value))
  editingMediaId.value = 'new'
  selectedMediaId.value = null
  mediaTableForm.value = { id: null, event_participation_id: record?.id ?? null, event_name: record?.event_name ?? '', media_type: '', media_link: '', published_on: '' }
}
function cancelMediaTableEdit() { editingMediaId.value = null; mediaTableForm.value = null }
function useConfirmationEvent() { const record = records.value.find((item) => Number(item.id) === Number(confirmationTableForm.value.event_participation_id)); confirmationTableForm.value.event_name = record?.event_name ?? '' }
function useMediaEvent() { const record = records.value.find((item) => Number(item.id) === Number(mediaTableForm.value.event_participation_id)); mediaTableForm.value.event_name = record?.event_name ?? '' }

async function saveConfirmationTableEdit() {
  const form = confirmationTableForm.value
  if (!form.event_name.trim()) return
  tableSaving.value = true
  try {
    const payload = { event_name: form.event_name.trim(), committee_president_name: form.committee_president_name?.trim() || null, organizer_institution: form.organizer_institution?.trim() || null, confirmation_date: form.confirmation_date || null, impressum_link: form.impressum_link?.trim() || null, updated_by: currentUserId }
    const response = form.id
      ? await api.patch(`/api/event-participations/confirmations/${form.id}`, payload)
      : await api.post('/api/event-participations/confirmations', { ...payload, event_participation_id: Number(form.event_participation_id), created_by: currentUserId })
    const index = confirmations.value.findIndex((item) => item.id === form.id); if (index >= 0) confirmations.value[index] = response.data; else confirmations.value.push(response.data)
    if (editForm.value) { const editIndex = editForm.value.confirmations.findIndex((item) => item.id === form.id); if (editIndex >= 0) editForm.value.confirmations[editIndex] = { ...response.data, confirmation_date: dateInput(response.data.confirmation_date) } }
    selectedConfirmationId.value = response.data.id; cancelConfirmationTableEdit(); showSuccess(form.id ? 'Potvrda organizatora uspješno je izmijenjena.' : 'Potvrda organizatora uspješno je dodana.')
  } catch (error) { errorMessage.value = apiError(error, 'Potvrdu nije moguće izmijeniti.') } finally { tableSaving.value = false }
}

async function saveMediaTableEdit() {
  const form = mediaTableForm.value
  if (!form.event_name.trim() || !form.media_link.trim()) return
  tableSaving.value = true
  try {
    const payload = { event_name: form.event_name.trim(), media_type: form.media_type?.trim() || null, media_link: form.media_link.trim(), published_on: form.published_on || null, updated_by: currentUserId }
    const response = form.id
      ? await api.patch(`/api/event-participations/media/${form.id}`, payload)
      : await api.post('/api/event-participations/media', { ...payload, event_participation_id: Number(form.event_participation_id), created_by: currentUserId })
    const index = mediaRecords.value.findIndex((item) => item.id === form.id); if (index >= 0) mediaRecords.value[index] = response.data; else mediaRecords.value.push(response.data)
    if (editForm.value) { const editIndex = editForm.value.media.findIndex((item) => item.id === form.id); if (editIndex >= 0) editForm.value.media[editIndex] = { ...response.data, published_on: dateInput(response.data.published_on) } }
    selectedMediaId.value = response.data.id; cancelMediaTableEdit(); showSuccess(form.id ? 'Medijska objava uspješno je izmijenjena.' : 'Medijska objava uspješno je dodana.')
  } catch (error) { errorMessage.value = apiError(error, 'Medijsku objavu nije moguće izmijeniti.') } finally { tableSaving.value = false }
}

async function deleteConfirmationFromTable(item) {
  if (!confirm(`Želite li izbrisati potvrdu za „${item.event_name}”?`)) return
  tableSaving.value = true
  try { await api.delete(`/api/event-participations/confirmations/${item.id}`); confirmations.value = confirmations.value.filter((entry) => entry.id !== item.id); if (editForm.value) editForm.value.confirmations = editForm.value.confirmations.filter((entry) => entry.id !== item.id); selectedConfirmationId.value = null; cancelConfirmationTableEdit(); showSuccess('Potvrda organizatora uspješno je izbrisana.') } catch (error) { errorMessage.value = apiError(error, 'Potvrdu nije moguće izbrisati.') } finally { tableSaving.value = false }
}

async function deleteMediaFromTable(item) {
  if (!confirm(`Želite li izbrisati medijsku objavu za „${item.event_name}”?`)) return
  tableSaving.value = true
  try { await api.delete(`/api/event-participations/media/${item.id}`); mediaRecords.value = mediaRecords.value.filter((entry) => entry.id !== item.id); if (editForm.value) editForm.value.media = editForm.value.media.filter((entry) => entry.id !== item.id); selectedMediaId.value = null; cancelMediaTableEdit(); showSuccess('Medijska objava uspješno je izbrisana.') } catch (error) { errorMessage.value = apiError(error, 'Medijsku objavu nije moguće izbrisati.') } finally { tableSaving.value = false }
}

async function openFromRoute() { const id = Number(route.query.id); if (!id) return; const record = records.value.find((item) => Number(item.id) === id); if (!record) return; selectedPeriodId.value = record.reporting_period_id; await nextTick(); currentPage.value = Math.floor(filtered.value.findIndex((item) => item.id === id) / perPage) + 1; selected.value = record; await nextTick(); detailsCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
async function loadData() {
  loading.value = true
  try { const [periodData, recordData, confirmationData, mediaData, staffData, unitData] = await Promise.all([api.get('/api/reporting-periods'), api.get('/api/event-participations'), api.get('/api/event-participations/confirmations'), api.get('/api/event-participations/media'), api.get('/api/staff-members'), api.get('/api/organizational-units')]); periods.value = periodData.data; records.value = recordData.data; confirmations.value = confirmationData.data; mediaRecords.value = mediaData.data; staff.value = staffData.data; units.value = unitData.data; selectedPeriodId.value = periods.value[0]?.id ?? null; await openFromRoute() } catch (error) { errorMessage.value = apiError(error, 'Nije moguće dohvatiti sudjelovanja.') } finally { loading.value = false }
}
watch([selectedPeriodId, selectedType], () => { currentPage.value = 1; selected.value = null; selectedConfirmationId.value = null; selectedMediaId.value = null; cancelConfirmationTableEdit(); cancelMediaTableEdit(); cancelEdit() })
onMounted(loadData)
onUnmounted(() => { if (successTimer) clearTimeout(successTimer) })
</script>

<template>
  <main class="events-view">
    <nav class="breadcrumbs"><RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink><span>›</span><span>Sudjelovanja na događanjima</span></nav>
    <h1>Evidencija sudjelovanja na znanstvenim i stručnim događanjima</h1>
    <p v-if="loading" class="message">Učitavanje...</p><p v-else-if="errorMessage" class="message error">{{ errorMessage }}</p>
    <template v-else>
      <section class="overview"><label><span>Izvještajno razdoblje</span><select v-model.number="selectedPeriodId"><option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option></select></label><strong>Ukupno sudjelovanja: {{ filtered.length }}</strong></section>
      <div class="filters"><button v-for="type in types" :key="type.value" :class="{ active: selectedType === type.value }" @click="selectedType = type.value">{{ type.label }}</button></div>
      <section class="records-section"><div class="heading"><h2>Sudjelovanja ({{ filtered.length }})</h2><RouterLink class="action" to="/istrazivanje-i-razvoj/sudjelovanja/novo">Dodaj novo sudjelovanje</RouterLink></div>
        <div v-if="filtered.length" class="layout"><div><div class="list"><button v-for="record in paginated" :key="record.id" :class="{ selected: selected?.id === record.id }" @click="selectRecord(record)"><strong>{{ staffName(record) }}</strong><span>{{ record.event_name }}</span></button></div><nav v-if="pageCount > 1" class="pagination"><button v-for="page in pageCount" :key="page" :class="{ active: currentPage === page }" @click="currentPage = page">{{ page }}</button></nav></div>
          <dl v-if="selected" ref="detailsCard" class="details">
            <div class="actions"><button v-if="!editForm" class="action" @click="startEdit">Uredi</button><template v-else><button class="action" :disabled="saving" @click="saveEdit">{{ saving ? 'Spremanje...' : 'Spremi' }}</button><button class="action" :disabled="saving" @click="cancelEdit">Odustani</button><button class="minus" :disabled="saving || deleting" title="Izbriši sudjelovanje" @click="deleteRecord">−</button></template></div>
            <p v-if="editError" class="error">{{ editError }}</p>
            <div><dt>Ime i prezime</dt><dd><select v-if="editForm" v-model="editForm.staff_member_id" class="input"><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select><template v-else>{{ staffName(selected) }}</template></dd></div>
            <div><dt>Zvanje</dt><dd>{{ academicTitle(editForm ? editForm.staff_member_id : selected.staff_member_id) }}</dd></div>
            <div><dt>Sastavnica</dt><dd><select v-if="editForm" v-model="editForm.organizational_unit_id" class="input"><option value="">—</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select><template v-else>{{ unitName(selected.organizational_unit_id) }}</template></dd></div>
            <div><dt>Vrsta sudjelovanja</dt><dd><select v-if="editForm" v-model="editForm.participation_type" class="input"><option v-for="type in types.slice(1)" :key="type.value" :value="type.value">{{ type.label }}</option></select><template v-else>{{ typeLabel(selected.participation_type) }}</template></dd></div>
            <div><dt>Naziv događanja</dt><dd><input v-if="editForm" v-model="editForm.event_name" class="input" maxlength="250"><template v-else>{{ selected.event_name }}</template></dd></div>
            <div><dt>Organizator</dt><dd><input v-if="editForm" v-model="editForm.organizer_name" class="input" maxlength="200"><template v-else>{{ display(selected.organizer_name) }}</template></dd></div>
            <div><dt>Mjesto održavanja</dt><dd><input v-if="editForm" v-model="editForm.location" class="input" maxlength="150"><template v-else>{{ display(selected.location) }}</template></dd></div>
            <div><dt>Datum održavanja</dt><dd><input v-if="editForm" v-model="editForm.event_date" class="input" type="date"><template v-else>{{ formatDate(selected.event_date) }}</template></dd></div>
            <div><dt>Naslov izlaganja</dt><dd><textarea v-if="editForm" v-model="editForm.presentation_title" class="input"></textarea><template v-else>{{ display(selected.presentation_title) }}</template></dd></div>
            <div><dt>Program</dt><dd><input v-if="editForm" v-model="editForm.program_link" class="input"><a v-else-if="link(selected.program_link)" :href="link(selected.program_link)" target="_blank">{{ selected.program_link }}</a><template v-else>{{ display(selected.program_link) }}</template></dd></div>
            <div><dt>Napomena</dt><dd><textarea v-if="editForm" v-model="editForm.notes" class="input"></textarea><template v-else>{{ display(selected.notes) }}</template></dd></div>
            <section class="related"><header><h3>Potvrde organizatora</h3><button v-if="editForm" class="plus" @click="addConfirmation">+</button></header><p v-if="!(editForm ? editForm.confirmations : relatedConfirmations).length">Nema povezanih potvrda.</p><article v-for="item in editForm ? editForm.confirmations : relatedConfirmations" :key="item.id || item.temporaryId"><button v-if="editForm" class="minus floating" @click="removeConfirmation(item)">−</button><template v-if="editForm"><label>Naziv događanja<input v-model="item.event_name" class="input"></label><label>Predsjednik odbora<input v-model="item.committee_president_name" class="input"></label><label>Ustanova organizatora<input v-model="item.organizer_institution" class="input"></label><label>Datum<input v-model="item.confirmation_date" class="input" type="date"></label><label>Impresum<input v-model="item.impressum_link" class="input"></label></template><template v-else><strong>{{ item.event_name }}</strong><span>{{ display(item.committee_president_name) }}</span><span>{{ display(item.organizer_institution) }}</span><span>{{ formatDate(item.confirmation_date) }}</span><a v-if="link(item.impressum_link)" :href="link(item.impressum_link)" target="_blank">{{ item.impressum_link }}</a></template></article></section>
            <section class="related"><header><h3>Linkovi na medijske objave</h3><button v-if="editForm" class="plus" @click="addMedia">+</button></header><p v-if="!(editForm ? editForm.media : relatedMedia).length">Nema povezanih medijskih objava.</p><article v-for="item in editForm ? editForm.media : relatedMedia" :key="item.id || item.temporaryId"><button v-if="editForm" class="minus floating" @click="removeMedia(item)">−</button><template v-if="editForm"><label>Naziv događanja<input v-model="item.event_name" class="input"></label><label>Vrsta medija<input v-model="item.media_type" class="input"></label><label>Link<input v-model="item.media_link" class="input"></label><label>Datum objave<input v-model="item.published_on" class="input" type="date"></label></template><template v-else><strong>{{ item.event_name }}</strong><span>{{ display(item.media_type) }}</span><a :href="link(item.media_link)" target="_blank">{{ item.media_link }}</a><span>{{ formatDate(item.published_on) }}</span></template></article></section>
          </dl>
        </div><p v-else class="message">Nema sudjelovanja za odabrane kriterije.</p>
      </section>
      <section class="summaries"><h2>Sažetak potvrda organizatora</h2><div v-if="periodConfirmations.length || filtered.length" class="table-toolbar"><template v-if="editingConfirmationId"><button class="table-button" :disabled="tableSaving" @click="saveConfirmationTableEdit">Spremi</button><button class="table-button" :disabled="tableSaving" @click="cancelConfirmationTableEdit">Odustani</button></template><template v-else><button class="table-button" :disabled="!selectedConfirmationId" @click="startConfirmationTableEdit(periodConfirmations.find((item) => item.id === selectedConfirmationId))">Uredi</button></template><button class="plus" :disabled="Boolean(editingConfirmationId) || tableSaving || !filtered.length" title="Dodaj potvrdu" @click="startNewConfirmationTableRow">+</button><button class="minus" :disabled="!selectedConfirmationId || tableSaving" @click="deleteConfirmationFromTable(periodConfirmations.find((item) => item.id === selectedConfirmationId))">−</button></div><div class="table"><table><thead><tr><th>Broj</th><th>Naziv događanja</th><th>Predsjednik odbora</th><th>Ustanova organizatora</th><th>Datum</th><th>Impresum</th></tr></thead><tbody><tr v-if="editingConfirmationId === 'new'" class="selected-table-row"><td>Novi</td><td><select v-model="confirmationTableForm.event_participation_id" class="table-input" @change="useConfirmationEvent"><option v-for="record in filtered" :key="record.id" :value="record.id">{{ record.event_name }}</option></select></td><td><input v-model="confirmationTableForm.committee_president_name" class="table-input"></td><td><input v-model="confirmationTableForm.organizer_institution" class="table-input"></td><td><input v-model="confirmationTableForm.confirmation_date" class="table-input" type="date"></td><td><input v-model="confirmationTableForm.impressum_link" class="table-input"></td></tr><tr v-for="(item, index) in periodConfirmations" :key="item.id" :class="{ 'selected-table-row': selectedConfirmationId === item.id }" @click="selectedConfirmationId = item.id"><td>{{ index + 1 }}</td><template v-if="editingConfirmationId === item.id"><td><input v-model="confirmationTableForm.event_name" class="table-input" @click.stop></td><td><input v-model="confirmationTableForm.committee_president_name" class="table-input" @click.stop></td><td><input v-model="confirmationTableForm.organizer_institution" class="table-input" @click.stop></td><td><input v-model="confirmationTableForm.confirmation_date" class="table-input" type="date" @click.stop></td><td><input v-model="confirmationTableForm.impressum_link" class="table-input" @click.stop></td></template><template v-else><td>{{ item.event_name }}</td><td>{{ display(item.committee_president_name) }}</td><td>{{ display(item.organizer_institution) }}</td><td>{{ formatDate(item.confirmation_date) }}</td><td><a v-if="link(item.impressum_link)" :href="link(item.impressum_link)" target="_blank" @click.stop>Poveznica</a><span v-else>—</span></td></template></tr></tbody></table></div><p v-if="!periodConfirmations.length" class="message">Nema potvrda.</p>
        <h2>Sažetak medijskih objava</h2><div v-if="periodMedia.length || filtered.length" class="table-toolbar"><template v-if="editingMediaId"><button class="table-button" :disabled="tableSaving" @click="saveMediaTableEdit">Spremi</button><button class="table-button" :disabled="tableSaving" @click="cancelMediaTableEdit">Odustani</button></template><template v-else><button class="table-button" :disabled="!selectedMediaId" @click="startMediaTableEdit(periodMedia.find((item) => item.id === selectedMediaId))">Uredi</button></template><button class="plus" :disabled="Boolean(editingMediaId) || tableSaving || !filtered.length" title="Dodaj medijsku objavu" @click="startNewMediaTableRow">+</button><button class="minus" :disabled="!selectedMediaId || tableSaving" @click="deleteMediaFromTable(periodMedia.find((item) => item.id === selectedMediaId))">−</button></div><div class="table"><table><thead><tr><th>Broj</th><th>Naziv događanja</th><th>Vrsta medija</th><th>Link</th><th>Datum objave</th></tr></thead><tbody><tr v-if="editingMediaId === 'new'" class="selected-table-row"><td>Novi</td><td><select v-model="mediaTableForm.event_participation_id" class="table-input" @change="useMediaEvent"><option v-for="record in filtered" :key="record.id" :value="record.id">{{ record.event_name }}</option></select></td><td><input v-model="mediaTableForm.media_type" class="table-input"></td><td><input v-model="mediaTableForm.media_link" class="table-input"></td><td><input v-model="mediaTableForm.published_on" class="table-input" type="date"></td></tr><tr v-for="(item, index) in periodMedia" :key="item.id" :class="{ 'selected-table-row': selectedMediaId === item.id }" @click="selectedMediaId = item.id"><td>{{ index + 1 }}</td><template v-if="editingMediaId === item.id"><td><input v-model="mediaTableForm.event_name" class="table-input" @click.stop></td><td><input v-model="mediaTableForm.media_type" class="table-input" @click.stop></td><td><input v-model="mediaTableForm.media_link" class="table-input" @click.stop></td><td><input v-model="mediaTableForm.published_on" class="table-input" type="date" @click.stop></td></template><template v-else><td>{{ item.event_name }}</td><td>{{ display(item.media_type) }}</td><td><a :href="link(item.media_link)" target="_blank" @click.stop>{{ item.media_link }}</a></td><td>{{ formatDate(item.published_on) }}</td></template></tr></tbody></table></div><p v-if="!periodMedia.length" class="message">Nema medijskih objava.</p></section>
    </template>
    <Transition name="snackbar"><div v-if="successMessage" class="snackbar">{{ successMessage }}</div></Transition>
  </main>
</template>

<style scoped>
.breadcrumbs a{color:inherit;text-decoration:none}.breadcrumbs a:hover{color:rgb(var(--v-theme-primary))}
.table-input{width:100%;min-width:130px;box-sizing:border-box;padding:8px 9px;border:1px solid rgb(var(--v-theme-table-border));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}
.table-actions{display:flex;align-items:center;gap:7px;white-space:nowrap}
.table-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin:0 0 10px}
.table-button{padding:7px 10px;border:1px solid rgb(var(--v-theme-category-border));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}
.table-toolbar .table-button{height:30px;padding:0 12px}
.table-button:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}
.table-button:disabled{cursor:not-allowed;opacity:.55}
.table tbody tr{cursor:pointer}.table tbody tr:hover,.selected-table-row{background:rgba(var(--v-theme-primary),.1)}
.events-view{min-height:calc(100vh - 112px);padding:34px clamp(32px,5vw,128px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.overview,.heading,.filters,.actions,.related header{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}h1{margin:18px 0 0;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.65vw,2.35rem);font-weight:400}h2{font-weight:400}.overview,.heading{justify-content:space-between}.overview{margin-top:36px}.overview label{display:grid;gap:8px;color:rgb(var(--v-theme-primary));font-weight:700}.overview select,.input{padding:9px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.filters{flex-wrap:wrap;gap:10px;margin-top:44px}.filters button,.action{padding:9px 15px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}.filters button{border-radius:999px}.filters button.active,.filters button:hover,.action:hover,.plus:hover{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.records-section,.summaries{margin-top:70px}.layout{display:grid;grid-template-columns:minmax(280px,.85fr) minmax(500px,1.15fr);gap:clamp(44px,8vw,140px);align-items:start;margin-top:32px}.list{display:grid;gap:5px}.list button{display:grid;gap:4px;padding:13px 16px;border:0;border-radius:7px;background:transparent;color:rgb(var(--v-theme-membership-link));cursor:pointer;text-align:left;font:inherit}.list button span{color:rgb(var(--v-theme-muted))}.list button:hover,.list button.selected{background:rgba(var(--v-theme-primary),.1)}.pagination{display:flex;justify-content:center;gap:5px;margin-top:20px}.pagination button{width:30px;height:30px;border:0;border-radius:6px;background:transparent;color:rgb(var(--v-theme-primary))}.pagination button.active{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.details{display:grid;gap:10px;margin:0;padding:clamp(28px,3vw,48px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.details>div:not(.actions){display:grid;grid-template-columns:minmax(160px,.9fr) minmax(0,1.1fr);gap:22px}.details dd{margin:0;overflow-wrap:anywhere}.details .actions{justify-content:flex-end;gap:9px}.input{width:100%;min-width:0;box-sizing:border-box}.minus,.plus{display:grid;width:30px;height:30px;padding:0;place-items:center;border:1px solid rgb(var(--v-theme-on-surface));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font-size:1.2rem}.minus:hover{background:rgb(var(--v-theme-error));color:#fff}.related{display:grid;gap:14px;margin-top:18px;padding-top:20px;border-top:1px solid rgb(var(--v-theme-category-border))}.related header{gap:10px}.related h3{margin:0}.related article{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px;padding:20px;border:1px solid rgb(var(--v-theme-category-border));border-radius:9px}.related article:has(.floating){padding-top:52px}.related label{display:grid;gap:6px}.floating{position:absolute;top:10px;right:10px}.summaries h2{margin-top:54px}.table{overflow-x:auto;border-radius:10px}.table table{width:100%;border-collapse:collapse}.table th,.table td{padding:13px 15px;border:1px solid rgb(var(--v-theme-table-border));text-align:left}.table th{background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}a{color:rgb(var(--v-theme-evidence-link))}.message{margin-top:28px;color:rgb(var(--v-theme-muted))}.error{color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:900px){.layout{grid-template-columns:1fr}}@media(max-width:650px){.events-view{padding:28px 20px 56px}.overview,.heading{align-items:stretch;flex-direction:column;gap:20px}.details>div:not(.actions),.related article{grid-template-columns:1fr}}
</style>
