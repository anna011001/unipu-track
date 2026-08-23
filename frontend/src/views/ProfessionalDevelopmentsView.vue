<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const currentUserId = 1
const recordsPerPage = 10

const reportingPeriods = ref([])
const developments = ref([])
const confirmations = ref([])
const mediaRecords = ref([])
const staffMembers = ref([])
const organizationalUnits = ref([])
const organizations = ref([])
const countries = ref([])
const selectedPeriodId = ref(null)
const selectedDevelopment = ref(null)
const selectedType = ref('ALL')
const currentPage = ref(1)
const detailsCard = ref(null)
const editForm = ref(null)
const editError = ref('')
const loading = ref(true)
const saving = ref(false)
const deletingDevelopment = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
let successTimer = null

const developmentTypes = [
  { value: 'ALL', label: 'Sve vrste' },
  { value: 'STUDY_VISIT', label: 'Studijski boravak' },
  { value: 'WORKSHOP', label: 'Radionica' },
  { value: 'CONFERENCE', label: 'Konferencija' },
  { value: 'COURSE_CERTIFICATE', label: 'Tečaj ili certifikat' },
  { value: 'SUMMER_SCHOOL', label: 'Ljetna škola' },
]

const filteredDevelopments = computed(() => {
  return developments.value.filter((development) => {
    const belongsToPeriod =
      Number(development.reporting_period_id) === Number(selectedPeriodId.value)
    const belongsToType =
      selectedType.value === 'ALL' || development.development_type === selectedType.value

    return belongsToPeriod && belongsToType
  })
})

const pageCount = computed(() => Math.ceil(filteredDevelopments.value.length / recordsPerPage))
const paginatedDevelopments = computed(() => {
  const start = (currentPage.value - 1) * recordsPerPage
  return filteredDevelopments.value.slice(start, start + recordsPerPage)
})

const relatedConfirmations = computed(() => {
  if (!selectedDevelopment.value) return []
  return confirmations.value.filter(
    (confirmation) =>
      Number(confirmation.professional_development_id) === Number(selectedDevelopment.value.id),
  )
})

const relatedMedia = computed(() => {
  if (!selectedDevelopment.value) return []
  return mediaRecords.value.filter(
    (media) => Number(media.professional_development_id) === Number(selectedDevelopment.value.id),
  )
})

const periodDevelopmentIds = computed(
  () =>
    new Set(
      developments.value
        .filter(
          (development) =>
            Number(development.reporting_period_id) === Number(selectedPeriodId.value),
        )
        .map((development) => Number(development.id)),
    ),
)

const periodConfirmations = computed(() =>
  confirmations.value.filter((confirmation) =>
    periodDevelopmentIds.value.has(Number(confirmation.professional_development_id)),
  ),
)

const periodMedia = computed(() =>
  mediaRecords.value.filter((media) =>
    periodDevelopmentIds.value.has(Number(media.professional_development_id)),
  ),
)

function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

function getTypeLabel(value) {
  return developmentTypes.find((type) => type.value === value)?.label || value || '—'
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(date)
}

function getDateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getStaffName(development) {
  return `${development.staff_first_name || ''} ${development.staff_last_name || ''}`.trim() || '—'
}

function getStaffMemberName(id) {
  const member = staffMembers.value.find((item) => Number(item.id) === Number(id))
  return member ? `${member.first_name} ${member.last_name}` : '—'
}

function getAcademicTitle(id) {
  return staffMembers.value.find((member) => Number(member.id) === Number(id))?.academic_title || '—'
}

function findName(items, id, getLabel) {
  const item = items.find((entry) => Number(entry.id) === Number(id))
  return item ? getLabel(item) : '—'
}

function getOrganizationId(name) {
  const normalized = name.trim().toLocaleLowerCase('hr')
  return (
    organizations.value.find(
      (organization) => organization.name.trim().toLocaleLowerCase('hr') === normalized,
    )?.id ?? null
  )
}

function getLink(value) {
  if (!value) return null
  if (value.startsWith('/uploads/')) return `${api.defaults.baseURL}${value}`

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function showSuccess(message) {
  successMessage.value = message
  if (successTimer) window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => {
    successMessage.value = ''
    successTimer = null
  }, 4000)
}

function getApiError(error, fallback) {
  const errors = error.response?.data?.errors
  return Array.isArray(errors) ? errors.join(' ') : error.response?.data?.message || fallback
}

function getPaginationItems(page, total) {
  if (total <= 6) return Array.from({ length: total }, (_, index) => index + 1)
  if (page <= 3) return [1, 2, 3, 'ellipsis-end', total - 1, total]
  if (page >= total - 2) return [1, 2, 'ellipsis-start', total - 2, total - 1, total]
  return [1, 'ellipsis-start', page - 1, page, page + 1, 'ellipsis-end', total]
}

function selectDevelopment(development) {
  editForm.value = null
  editError.value = ''
  selectedDevelopment.value = development
}

function startEdit() {
  const development = selectedDevelopment.value
  editError.value = ''
  editForm.value = {
    staff_member_id: development.staff_member_id,
    organizational_unit_id: development.organizational_unit_id ?? '',
    development_type: development.development_type,
    program_name: development.program_name,
    host_organization_name:
      development.host_organization_name || development.host_organization_database_name || '',
    country_id: development.country_id ?? '',
    start_date: getDateInputValue(development.start_date),
    end_date: getDateInputValue(development.end_date),
    media_link: development.media_link ?? '',
    notes: development.notes ?? '',
    confirmations: relatedConfirmations.value.map((confirmation) => ({
      id: confirmation.id,
      institution_name: confirmation.institution_name ?? '',
      signer_name: confirmation.signer_name ?? '',
      signer_function: confirmation.signer_function ?? '',
      confirmation_date: getDateInputValue(confirmation.confirmation_date),
      seal_present: confirmation.seal_present,
    })),
    mediaRecords: relatedMedia.value.map((media) => ({
      id: media.id,
      development_name: media.development_name ?? '',
      media_type: media.media_type ?? '',
      media_link: media.media_link ?? '',
      published_on: getDateInputValue(media.published_on),
    })),
    deletedConfirmationIds: [],
    deletedMediaIds: [],
  }
}

function cancelEdit() {
  editForm.value = null
  editError.value = ''
}

function addConfirmation() {
  editForm.value.confirmations.push({
    temporaryId: crypto.randomUUID(),
    institution_name: editForm.value.host_organization_name.trim(),
    signer_name: '',
    signer_function: '',
    confirmation_date: '',
    seal_present: null,
  })
}

function addMediaRecord() {
  editForm.value.mediaRecords.push({
    temporaryId: crypto.randomUUID(),
    development_name: editForm.value.program_name.trim(),
    media_type: '',
    media_link: '',
    published_on: '',
  })
}

async function saveEdit() {
  editError.value = ''
  const form = editForm.value

  if (!form.staff_member_id || !form.development_type || !form.program_name.trim()) {
    editError.value = 'Ime i prezime, vrsta usavršavanja i naziv programa su obavezni.'
    return
  }

  if (form.start_date && form.end_date && form.end_date < form.start_date) {
    editError.value = 'Završni datum ne smije biti prije početnog datuma.'
    return
  }

  if (form.confirmations.some((confirmation) => !confirmation.institution_name.trim())) {
    editError.value = 'Naziv institucije obavezan je za svaku potvrdu.'
    return
  }

  if (
    form.mediaRecords.some(
      (media) => !media.development_name.trim() || !media.media_link.trim(),
    )
  ) {
    editError.value = 'Naziv usavršavanja i link obavezni su za svaku medijsku objavu.'
    return
  }

  saving.value = true

  try {
    const confirmationResponses = await Promise.all(
      form.confirmations.map((confirmation) =>
        confirmation.id
          ? api.patch(`/api/professional-developments/confirmations/${confirmation.id}`, {
              institution_name: confirmation.institution_name.trim(),
              signer_name: confirmation.signer_name.trim() || null,
              signer_function: confirmation.signer_function.trim() || null,
              confirmation_date: confirmation.confirmation_date || null,
              seal_present: confirmation.seal_present,
              updated_by: currentUserId,
            })
          : api.post('/api/professional-developments/confirmations', {
              professional_development_id: selectedDevelopment.value.id,
              institution_name: confirmation.institution_name.trim(),
              signer_name: confirmation.signer_name.trim() || null,
              signer_function: confirmation.signer_function.trim() || null,
              confirmation_date: confirmation.confirmation_date || null,
              seal_present: confirmation.seal_present,
              created_by: currentUserId,
              updated_by: currentUserId,
            }),
      ),
    )
    const mediaResponses = await Promise.all(
      form.mediaRecords.map((media) =>
        media.id
          ? api.patch(`/api/professional-developments/media/${media.id}`, {
              development_name: media.development_name.trim(),
              media_type: media.media_type.trim() || null,
              media_link: media.media_link.trim(),
              published_on: media.published_on || null,
              updated_by: currentUserId,
            })
          : api.post('/api/professional-developments/media', {
              professional_development_id: selectedDevelopment.value.id,
              development_name: media.development_name.trim(),
              media_type: media.media_type.trim() || null,
              media_link: media.media_link.trim(),
              published_on: media.published_on || null,
              created_by: currentUserId,
              updated_by: currentUserId,
            }),
      ),
    )
    const response = await api.patch(
      `/api/professional-developments/${selectedDevelopment.value.id}`,
      {
        staff_member_id: Number(form.staff_member_id),
        organizational_unit_id: optionalNumber(form.organizational_unit_id),
        development_type: form.development_type,
        program_name: form.program_name.trim(),
        host_organization_id: getOrganizationId(form.host_organization_name),
        host_organization_name: form.host_organization_name.trim() || null,
        country_id: optionalNumber(form.country_id),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        media_link: form.media_link.trim() || null,
        notes: form.notes.trim() || null,
        updated_by: currentUserId,
      },
    )

    await Promise.all([
      ...form.deletedConfirmationIds.map((id) =>
        api.delete(`/api/professional-developments/confirmations/${id}`),
      ),
      ...form.deletedMediaIds.map((id) =>
        api.delete(`/api/professional-developments/media/${id}`),
      ),
    ])

    const updated = {
      ...selectedDevelopment.value,
      ...response.data,
      staff_first_name:
        staffMembers.value.find((member) => Number(member.id) === Number(response.data.staff_member_id))
          ?.first_name || '',
      staff_last_name:
        staffMembers.value.find((member) => Number(member.id) === Number(response.data.staff_member_id))
          ?.last_name || '',
    }
    const index = developments.value.findIndex((item) => item.id === updated.id)
    if (index !== -1) developments.value[index] = updated
    for (const confirmationResponse of confirmationResponses) {
      const confirmationIndex = confirmations.value.findIndex(
        (confirmation) => confirmation.id === confirmationResponse.data.id,
      )
      if (confirmationIndex !== -1) {
        confirmations.value[confirmationIndex] = confirmationResponse.data
      } else {
        confirmations.value.push(confirmationResponse.data)
      }
    }
    for (const mediaResponse of mediaResponses) {
      const mediaIndex = mediaRecords.value.findIndex((media) => media.id === mediaResponse.data.id)
      if (mediaIndex !== -1) {
        mediaRecords.value[mediaIndex] = mediaResponse.data
      } else {
        mediaRecords.value.push(mediaResponse.data)
      }
    }
    confirmations.value = confirmations.value.filter(
      (confirmation) => !form.deletedConfirmationIds.includes(confirmation.id),
    )
    mediaRecords.value = mediaRecords.value.filter(
      (media) => !form.deletedMediaIds.includes(media.id),
    )
    selectedDevelopment.value = updated
    editForm.value = null
    showSuccess('Stručno usavršavanje uspješno je izmijenjeno.')
  } catch (error) {
    editError.value = getApiError(error, 'Stručno usavršavanje nije moguće izmijeniti.')
  } finally {
    saving.value = false
  }
}

async function deleteDevelopment() {
  const development = selectedDevelopment.value
  if (!development) return
  if (!window.confirm(`Želite li izbrisati stručno usavršavanje „${development.program_name}”?`)) {
    return
  }

  deletingDevelopment.value = true
  editError.value = ''

  try {
    await api.delete(`/api/professional-developments/${development.id}`)
    developments.value = developments.value.filter((item) => item.id !== development.id)
    selectedDevelopment.value = null
    editForm.value = null
    currentPage.value = Math.min(currentPage.value, Math.max(1, pageCount.value))
    showSuccess('Stručno usavršavanje uspješno je izbrisano.')
  } catch (error) {
    editError.value = getApiError(error, 'Stručno usavršavanje nije moguće izbrisati.')
  } finally {
    deletingDevelopment.value = false
  }
}

function deleteConfirmation(confirmation) {
  if (!confirmation.id) {
    editForm.value.confirmations = editForm.value.confirmations.filter(
      (item) => item.temporaryId !== confirmation.temporaryId,
    )
    return
  }

  if (!window.confirm(`Želite li izbrisati potvrdu ustanove „${confirmation.institution_name}”?`)) {
    return
  }

  editForm.value.deletedConfirmationIds.push(confirmation.id)
  editForm.value.confirmations = editForm.value.confirmations.filter(
    (item) => item.id !== confirmation.id,
  )
}

function deleteMediaRecord(media) {
  if (!media.id) {
    editForm.value.mediaRecords = editForm.value.mediaRecords.filter(
      (item) => item.temporaryId !== media.temporaryId,
    )
    return
  }

  if (!window.confirm(`Želite li izbrisati medijsku objavu „${media.development_name}”?`)) {
    return
  }

  editForm.value.deletedMediaIds.push(media.id)
  editForm.value.mediaRecords = editForm.value.mediaRecords.filter(
    (item) => item.id !== media.id,
  )
}

function exportRecords() {
  if (!filteredDevelopments.value.length) return
  const columns = Object.keys(filteredDevelopments.value[0])
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const rows = [
    columns.map(escape).join(','),
    ...filteredDevelopments.value.map((record) =>
      columns.map((column) => escape(record[column])).join(','),
    ),
  ]
  const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = 'strucna-usavrsavanja.csv'
  link.click()
  URL.revokeObjectURL(url)
}

async function openRecordFromRoute() {
  const id = Number(route.query.id)
  if (!Number.isInteger(id) || id <= 0) return
  const development = developments.value.find((record) => Number(record.id) === id)
  if (!development) return

  selectedPeriodId.value = development.reporting_period_id
  selectedType.value = 'ALL'
  await nextTick()
  const index = filteredDevelopments.value.findIndex((record) => record.id === development.id)
  currentPage.value = Math.floor(index / recordsPerPage) + 1
  selectedDevelopment.value = development
  await nextTick()
  detailsCard.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [periods, records, confirmationsResponse, media, staff, units, orgs, countryData] =
      await Promise.all([
        api.get('/api/reporting-periods'),
        api.get('/api/professional-developments'),
        api.get('/api/professional-developments/confirmations'),
        api.get('/api/professional-developments/media'),
        api.get('/api/staff-members'),
        api.get('/api/organizational-units'),
        api.get('/api/organizations'),
        api.get('/api/countries'),
      ])

    reportingPeriods.value = Array.isArray(periods.data) ? periods.data : []
    developments.value = Array.isArray(records.data) ? records.data : []
    confirmations.value = Array.isArray(confirmationsResponse.data) ? confirmationsResponse.data : []
    mediaRecords.value = Array.isArray(media.data) ? media.data : []
    staffMembers.value = Array.isArray(staff.data) ? staff.data : []
    organizationalUnits.value = Array.isArray(units.data) ? units.data : []
    organizations.value = Array.isArray(orgs.data) ? orgs.data : []
    countries.value = Array.isArray(countryData.data) ? countryData.data : []
    selectedPeriodId.value = reportingPeriods.value[0]?.id ?? null
    await openRecordFromRoute()
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message || 'Nije moguće dohvatiti stručna usavršavanja.'
  } finally {
    loading.value = false
  }
}

watch([selectedPeriodId, selectedType], () => {
  currentPage.value = 1
  selectedDevelopment.value = null
  cancelEdit()
})

onMounted(loadData)
onUnmounted(() => {
  if (successTimer) window.clearTimeout(successTimer)
})
</script>

<template>
  <main class="developments-view">
    <nav class="breadcrumbs" aria-label="Putanja stranice">
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink>
      <span aria-hidden="true">›</span>
      <span>Stručna usavršavanja</span>
    </nav>

    <h1>Evidencija stručnog usavršavanja nastavnika i suradnika</h1>

    <p v-if="loading" class="page-message">Učitavanje...</p>
    <p v-else-if="errorMessage" class="page-message error-message">{{ errorMessage }}</p>

    <template v-else>
      <section class="overview-section">
        <div class="overview-content">
          <label class="period-field">
            <span>Izvještajno razdoblje</span>
            <select v-model.number="selectedPeriodId">
              <option v-for="period in reportingPeriods" :key="period.id" :value="period.id">
                {{ period.label }}
              </option>
            </select>
          </label>
          <dl class="record-count"><dt>Ukupno usavršavanja</dt><dd>{{ filteredDevelopments.length }}</dd></dl>
        </div>
        <div class="page-actions">
          <button class="action-button" type="button" :disabled="!filteredDevelopments.length" @click="exportRecords">Izvoz</button>
        </div>
      </section>

      <section class="filters-section">
        <div class="type-filters" aria-label="Vrsta stručnog usavršavanja">
          <button
            v-for="type in developmentTypes"
            :key="type.value"
            class="type-button"
            :class="{ active: selectedType === type.value }"
            type="button"
            @click="selectedType = type.value"
          >
            {{ type.label }}
          </button>
        </div>
      </section>

      <section class="records-section">
        <div class="section-heading">
          <h2>Stručna usavršavanja ({{ filteredDevelopments.length }})</h2>
          <RouterLink class="action-button wide-button" to="/istrazivanje-i-razvoj/strucna-usavrsavanja/novo">Dodaj novo usavršavanje</RouterLink>
        </div>

        <div v-if="filteredDevelopments.length" class="records-layout">
          <div>
            <div class="record-list">
              <button
                v-for="development in paginatedDevelopments"
                :key="development.id"
                class="record-row"
                :class="{ selected: selectedDevelopment?.id === development.id }"
                type="button"
                @click="selectDevelopment(development)"
              >
                <strong>{{ getStaffName(development) }}</strong>
                <span>{{ development.program_name }}</span>
              </button>
            </div>
            <nav v-if="pageCount > 1" class="pagination" aria-label="Stranice stručnih usavršavanja">
              <template v-for="item in getPaginationItems(currentPage, pageCount)" :key="item">
                <span v-if="typeof item === 'string'" class="pagination-item">…</span>
                <button v-else class="pagination-item pagination-button" :class="{ active: item === currentPage }" type="button" @click="currentPage = item">{{ item }}</button>
              </template>
            </nav>
          </div>

          <dl v-if="selectedDevelopment" ref="detailsCard" class="details-card">
            <div class="details-actions">
              <button v-if="!editForm" class="action-button edit-button" type="button" @click="startEdit">Uredi</button>
              <template v-else>
                <button class="action-button edit-button" type="button" :disabled="saving || deletingDevelopment" @click="saveEdit">{{ saving ? 'Spremanje...' : 'Spremi' }}</button>
                <button class="action-button edit-button" type="button" :disabled="saving || deletingDevelopment" @click="cancelEdit">Odustani</button>
                <button class="minus-button" type="button" aria-label="Izbriši stručno usavršavanje" title="Izbriši stručno usavršavanje" :disabled="saving || deletingDevelopment" @click="deleteDevelopment">−</button>
              </template>
            </div>
            <p v-if="editError" class="edit-error" role="alert">{{ editError }}</p>
            <div><dt>Broj</dt><dd>{{ selectedDevelopment.id }}</dd></div>
            <div><dt>Ime i prezime</dt><dd><select v-if="editForm" v-model="editForm.staff_member_id" class="detail-input"><option v-for="member in staffMembers" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select><template v-else>{{ getStaffName(selectedDevelopment) }}</template></dd></div>
            <div><dt>Zvanje</dt><dd>{{ getAcademicTitle(editForm ? editForm.staff_member_id : selectedDevelopment.staff_member_id) }}</dd></div>
            <div><dt>Sastavnica</dt><dd><select v-if="editForm" v-model="editForm.organizational_unit_id" class="detail-input"><option value="">—</option><option v-for="unit in organizationalUnits" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select><template v-else>{{ findName(organizationalUnits, selectedDevelopment.organizational_unit_id, (unit) => unit.short_name || unit.name) }}</template></dd></div>
            <div><dt>Vrsta usavršavanja</dt><dd><select v-if="editForm" v-model="editForm.development_type" class="detail-input"><option v-for="type in developmentTypes.slice(1)" :key="type.value" :value="type.value">{{ type.label }}</option></select><template v-else>{{ getTypeLabel(selectedDevelopment.development_type) }}</template></dd></div>
            <div><dt>Naziv programa</dt><dd><input v-if="editForm" v-model="editForm.program_name" class="detail-input" maxlength="250" /><template v-else>{{ selectedDevelopment.program_name }}</template></dd></div>
            <div><dt>Ustanova domaćin</dt><dd><input v-if="editForm" v-model="editForm.host_organization_name" class="detail-input" maxlength="200" /><template v-else>{{ displayValue(selectedDevelopment.host_organization_name || selectedDevelopment.host_organization_database_name) }}</template></dd></div>
            <div><dt>Država</dt><dd><select v-if="editForm" v-model="editForm.country_id" class="detail-input"><option value="">—</option><option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name_hr }}</option></select><template v-else>{{ findName(countries, selectedDevelopment.country_id, (country) => country.name_hr) }}</template></dd></div>
            <div><dt>Početni datum</dt><dd><input v-if="editForm" v-model="editForm.start_date" class="detail-input" type="date" /><template v-else>{{ formatDate(selectedDevelopment.start_date) }}</template></dd></div>
            <div><dt>Završni datum</dt><dd><input v-if="editForm" v-model="editForm.end_date" class="detail-input" type="date" /><template v-else>{{ formatDate(selectedDevelopment.end_date) }}</template></dd></div>
            <div><dt>Medijska poveznica</dt><dd><input v-if="editForm" v-model="editForm.media_link" class="detail-input" /><a v-else-if="getLink(selectedDevelopment.media_link)" class="record-link" :href="getLink(selectedDevelopment.media_link)" target="_blank" rel="noopener noreferrer">{{ selectedDevelopment.media_link }}</a><template v-else>{{ displayValue(selectedDevelopment.media_link) }}</template></dd></div>
            <div><dt>Napomena</dt><dd><textarea v-if="editForm" v-model="editForm.notes" class="detail-input" rows="2"></textarea><template v-else>{{ displayValue(selectedDevelopment.notes) }}</template></dd></div>

            <div class="details-subsection">
              <div class="subsection-heading">
                <h3>Potvrde ustanova domaćina</h3>
                <button v-if="editForm" class="plus-button" type="button" aria-label="Dodaj potvrdu ustanove domaćina" title="Dodaj potvrdu" :disabled="saving" @click="addConfirmation">+</button>
              </div>
              <template v-if="editForm">
                <article v-for="confirmation in editForm.confirmations" :key="confirmation.id || confirmation.temporaryId" class="related-edit-card">
                  <button class="minus-button related-delete-button" type="button" :aria-label="`Izbriši potvrdu ustanove ${confirmation.institution_name}`" title="Izbriši potvrdu" :disabled="saving" @click="deleteConfirmation(confirmation)">−</button>
                  <label>Naziv institucije<input v-model="confirmation.institution_name" class="detail-input" maxlength="200" /></label>
                  <label>Ime i prezime potpisnika<input v-model="confirmation.signer_name" class="detail-input" maxlength="40" /></label>
                  <label>Funkcija<input v-model="confirmation.signer_function" class="detail-input" maxlength="40" /></label>
                  <label>Datum<input v-model="confirmation.confirmation_date" class="detail-input" type="date" /></label>
                  <label>Pečat<select v-model="confirmation.seal_present" class="detail-input"><option :value="null">—</option><option :value="true">Da</option><option :value="false">Ne</option></select></label>
                </article>
                <p v-if="!editForm.confirmations.length" class="subsection-empty">Nema povezanih potvrda.</p>
              </template>
              <template v-else>
                <article v-for="confirmation in relatedConfirmations" :key="confirmation.id" class="related-card">
                  <strong>{{ confirmation.institution_name }}</strong>
                  <span>{{ displayValue(confirmation.signer_name) }}</span>
                  <span>{{ displayValue(confirmation.signer_function) }}</span>
                  <span>{{ formatDate(confirmation.confirmation_date) }}</span>
                  <span>Pečat: {{ confirmation.seal_present === null ? '—' : confirmation.seal_present ? 'da' : 'ne' }}</span>
                </article>
                <p v-if="!relatedConfirmations.length" class="subsection-empty">Nema povezanih potvrda.</p>
              </template>
            </div>

            <div class="details-subsection">
              <div class="subsection-heading">
                <h3>Linkovi na medijske objave</h3>
                <button v-if="editForm" class="plus-button" type="button" aria-label="Dodaj link na medijsku objavu" title="Dodaj medijsku objavu" :disabled="saving" @click="addMediaRecord">+</button>
              </div>
              <template v-if="editForm">
                <article v-for="media in editForm.mediaRecords" :key="media.id || media.temporaryId" class="related-edit-card">
                  <button class="minus-button related-delete-button" type="button" :aria-label="`Izbriši medijsku objavu ${media.development_name}`" title="Izbriši medijsku objavu" :disabled="saving" @click="deleteMediaRecord(media)">−</button>
                  <label>Naziv usavršavanja<input v-model="media.development_name" class="detail-input" maxlength="250" /></label>
                  <label>Vrsta medija<input v-model="media.media_type" class="detail-input" maxlength="80" /></label>
                  <label>Link<input v-model="media.media_link" class="detail-input" /></label>
                  <label>Datum objave<input v-model="media.published_on" class="detail-input" type="date" /></label>
                </article>
                <p v-if="!editForm.mediaRecords.length" class="subsection-empty">Nema povezanih medijskih objava.</p>
              </template>
              <template v-else>
                <article v-for="media in relatedMedia" :key="media.id" class="related-card">
                  <a class="record-link" :href="getLink(media.media_link)" target="_blank" rel="noopener noreferrer">{{ media.development_name }}</a>
                  <span>{{ displayValue(media.media_type) }}</span>
                  <span>{{ formatDate(media.published_on) }}</span>
                </article>
                <p v-if="!relatedMedia.length" class="subsection-empty">Nema povezanih medijskih objava.</p>
              </template>
            </div>
          </dl>
        </div>
        <p v-else class="empty-message">Nema stručnih usavršavanja za odabrane kriterije.</p>
      </section>

      <section class="summary-section">
        <h2>Sažetak potvrda ustanova domaćina</h2>
        <div v-if="periodConfirmations.length" class="summary-table-wrapper">
          <table class="summary-table">
            <thead><tr><th>Broj</th><th>Naziv institucije</th><th>Ime i prezime potpisnika</th><th>Funkcija</th><th>Datum</th><th>Pečat</th></tr></thead>
            <tbody><tr v-for="(confirmation, index) in periodConfirmations" :key="confirmation.id"><td>{{ index + 1 }}</td><td>{{ confirmation.institution_name }}</td><td>{{ displayValue(confirmation.signer_name) }}</td><td>{{ displayValue(confirmation.signer_function) }}</td><td>{{ formatDate(confirmation.confirmation_date) }}</td><td>{{ confirmation.seal_present === null ? '—' : confirmation.seal_present ? 'Da' : 'Ne' }}</td></tr></tbody>
          </table>
        </div>
        <p v-else class="empty-message">Nema potvrda za odabrano izvještajno razdoblje.</p>

        <h2 class="second-summary-heading">Sažetak medijskih objava</h2>
        <div v-if="periodMedia.length" class="summary-table-wrapper">
          <table class="summary-table">
            <thead><tr><th>Broj</th><th>Naziv usavršavanja</th><th>Vrsta medija</th><th>Link</th><th>Datum objave</th></tr></thead>
            <tbody><tr v-for="(media, index) in periodMedia" :key="media.id"><td>{{ index + 1 }}</td><td>{{ media.development_name }}</td><td>{{ displayValue(media.media_type) }}</td><td><a class="record-link" :href="getLink(media.media_link)" target="_blank" rel="noopener noreferrer">{{ media.media_link }}</a></td><td>{{ formatDate(media.published_on) }}</td></tr></tbody>
          </table>
        </div>
        <p v-else class="empty-message">Nema medijskih objava za odabrano izvještajno razdoblje.</p>
      </section>
    </template>

    <Transition name="snackbar"><div v-if="successMessage" class="success-snackbar" role="status" aria-live="polite">{{ successMessage }}</div></Transition>
  </main>
</template>

<style scoped>
.developments-view { min-height: calc(100vh - 112px); padding: 34px clamp(32px, 5vw, 128px) 90px; background: rgb(var(--v-theme-background)); color: rgb(var(--v-theme-on-background)); }
.breadcrumbs { display: flex; gap: 10px; color: rgb(var(--v-theme-muted)); font-size: clamp(1rem, 1.1vw, 1.45rem); }
.breadcrumbs a:hover { color: rgb(var(--v-theme-primary)); }
h1 { margin: 18px 0 0; color: rgb(var(--v-theme-primary)); font-size: clamp(1.5rem, 1.65vw, 2.35rem); font-weight: 400; }
h2 { margin: 0; font-size: clamp(1.5rem, 1.7vw, 2.35rem); font-weight: 400; }
.page-message, .empty-message { margin-top: 32px; color: rgb(var(--v-theme-muted)); }
.error-message, .edit-error { color: rgb(var(--v-theme-error)); }
.overview-section, .overview-content, .page-actions, .section-heading, .filters-section, .type-filters, .details-actions { display: flex; align-items: center; }
.overview-section, .section-heading { justify-content: space-between; }
.overview-section { align-items: end; gap: 36px; margin-top: 36px; }
.overview-content { align-items: end; gap: clamp(30px, 5vw, 76px); }
.period-field { display: grid; gap: 8px; color: rgb(var(--v-theme-primary)); font-weight: 700; }
.period-field select { min-height: 43px; padding: 9px 14px; border: 1px solid rgb(var(--v-theme-category-border)); border-radius: 7px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); font: inherit; }
.record-count { margin: 0; }
.record-count dt { color: rgb(var(--v-theme-muted)); font-size: .9rem; }
.record-count dd { margin: 8px 0 0; color: rgb(var(--v-theme-primary)); font-size: 1.15rem; font-weight: 700; }
.page-actions, .details-actions { gap: 10px; }
.action-button { display: inline-flex; align-items: center; justify-content: center; min-width: 96px; padding: 9px 18px; border: 1px solid rgb(var(--v-theme-on-surface)); border-radius: 6px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); cursor: pointer; font: inherit; transition: background-color 160ms ease, color 160ms ease; }
.action-button:hover:not(:disabled) { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.action-button:disabled { cursor: not-allowed; opacity: .5; }
.minus-button { display: inline-grid; width: 30px; height: 30px; padding: 0; place-items: center; border: 1px solid rgb(var(--v-theme-on-surface)); border-radius: 6px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); cursor: pointer; font: inherit; font-size: 1.25rem; line-height: 1; }
.minus-button:hover:not(:disabled) { border-color: rgb(var(--v-theme-error)); background: rgb(var(--v-theme-error)); color: #fff; }
.minus-button:disabled { cursor: not-allowed; opacity: .5; }
.plus-button { display: inline-grid; width: 30px; height: 30px; padding: 0; place-items: center; border: 1px solid rgb(var(--v-theme-on-surface)); border-radius: 6px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); cursor: pointer; font: inherit; font-size: 1.2rem; line-height: 1; }
.plus-button:hover:not(:disabled) { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.plus-button:disabled { cursor: not-allowed; opacity: .5; }
.wide-button { min-width: 230px; }
.filters-section { align-items: stretch; gap: 24px; margin-top: 48px; }
.type-filters { flex-wrap: wrap; gap: 10px; }
.type-button { padding: 9px 15px; border: 1px solid rgb(var(--v-theme-category-border)); border-radius: 999px; background: transparent; color: rgb(var(--v-theme-on-background)); cursor: pointer; font: inherit; }
.type-button:hover, .type-button.active { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.records-section, .summary-section { margin-top: clamp(60px, 8vh, 100px); }
.records-layout { display: grid; grid-template-columns: minmax(300px, .9fr) minmax(460px, 1.1fr); align-items: start; gap: clamp(44px, 8vw, 150px); margin-top: 34px; }
.record-list { display: grid; grid-template-rows: repeat(5, auto); grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 5px clamp(28px, 4vw, 58px); width: calc(100% + clamp(20px, 3vw, 50px)); }
.record-row { display: grid; gap: 4px; padding: 13px 16px; border: 0; border-radius: 7px; background: transparent; color: rgb(var(--v-theme-membership-link)); cursor: pointer; font: inherit; text-align: left; }
.record-row:hover, .record-row.selected { background: rgba(var(--v-theme-primary), .1); }
.record-row.selected { color: rgb(var(--v-theme-on-background)); }
.record-row strong { font-weight: 500; }
.record-row span { color: rgb(var(--v-theme-muted)); font-size: .9rem; }
.pagination { display: flex; justify-content: center; gap: 6px; margin-top: 22px; }
.pagination-item { display: grid; width: 30px; height: 30px; place-items: center; color: rgb(var(--v-theme-primary)); }
.pagination-button { padding: 0; border: 0; border-radius: 7px; background: transparent; cursor: pointer; font: inherit; }
.pagination-button.active { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.details-card { display: grid; gap: 9px; margin: 0; padding: clamp(28px, 3vw, 48px); border: 1px solid rgb(var(--v-theme-category-border)); border-radius: 10px; background: rgb(var(--v-theme-category-card)); color: rgb(var(--v-theme-on-category-card)); }
.details-card > div:not(.details-actions):not(.details-subsection) { display: grid; grid-template-columns: minmax(160px, .9fr) minmax(0, 1.1fr); gap: 24px; }
.details-actions { justify-content: flex-end; }
.details-card dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.details-card dt { font-weight: 500; }
.edit-error { margin: 0 0 8px; }
.detail-input { width: 100%; min-width: 0; padding: 7px 9px; border: 1px solid rgb(var(--v-theme-on-category-card)); border-radius: 6px; outline: none; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); font: inherit; }
textarea.detail-input { resize: vertical; }
.record-link { color: rgb(var(--v-theme-evidence-link)); cursor: pointer; text-decoration: none; }
.record-link:hover { opacity: .75; text-decoration: underline; }
.details-subsection { display: grid; gap: 14px; margin-top: 18px; padding-top: 22px; border-top: 1px solid rgb(var(--v-theme-category-border)); }
.details-subsection h3 { margin: 0 0 4px; font-size: 1.08rem; font-weight: 600; }
.subsection-heading { display: flex; align-items: center; gap: 10px; }
.related-card { display: grid; gap: 7px; padding: 22px; border: 1px solid rgb(var(--v-theme-category-border)); border-radius: 10px; background: rgb(var(--v-theme-category-card)); color: rgb(var(--v-theme-on-category-card)); }
.related-edit-card { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 18px; padding: 52px 18px 18px; border: 1px solid rgb(var(--v-theme-category-border)); border-radius: 9px; }
.related-delete-button { position: absolute; top: 12px; right: 12px; }
.related-edit-card label { display: grid; gap: 6px; font-size: .88rem; }
.subsection-empty { margin: 0; color: rgb(var(--v-theme-muted)); }
.summary-table-wrapper { margin-top: 28px; overflow-x: auto; border-radius: 10px; }
.summary-table { width: 100%; border-collapse: collapse; text-align: left; }
.summary-table th, .summary-table td { padding: 13px 16px; border: 1px solid rgb(var(--v-theme-table-border)); }
.summary-table th { border-color: rgb(var(--v-theme-table-header-border)); background: rgb(var(--v-theme-category-card)); color: rgb(var(--v-theme-on-category-card)); }
.second-summary-heading { margin-top: 58px; }
.success-snackbar { position: fixed; right: 28px; bottom: 28px; z-index: 1000; min-width: min(360px, calc(100vw - 40px)); padding: 14px 18px; border: 1px solid #62a957; border-radius: 7px; box-shadow: 0 5px 18px rgba(0,0,0,.2); background: #b8f5ae; color: #1f5525; }
.snackbar-enter-active, .snackbar-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.snackbar-enter-from, .snackbar-leave-to { opacity: 0; transform: translateY(12px); }
@media (max-width: 950px) { .records-layout { grid-template-columns: 1fr; } }
@media (max-width: 650px) { .developments-view { padding: 28px 20px 56px; } .overview-section, .filters-section, .section-heading { align-items: stretch; flex-direction: column; } .overview-content { align-items: start; flex-direction: column; } .type-filters { align-items: stretch; flex-direction: column; } .wide-button { width: 100%; } .record-list { width: 100%; grid-template-rows: none; grid-auto-flow: row; grid-template-columns: 1fr; } .details-card > div:not(.details-actions):not(.details-subsection), .related-edit-card { grid-template-columns: 1fr; } .success-snackbar { right: 20px; bottom: 20px; } }
@media print { .page-actions, .filters-section, .wide-button, .details-actions, .pagination { display: none; } }
</style>
