<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const currentUserId = 1
const currentYear = new Date().getFullYear()
const reportingPeriods = ref([])
const newMemberships = ref([])
const activeMemberships = ref([])
const membershipSummaries = ref([])
const organizations = ref([])
const countries = ref([])
const organizationalUnits = ref([])
const staffMembers = ref([])
const recordFiles = ref([])
const selectedPeriodId = ref(null)
const selectedNewMembership = ref(null)
const selectedActiveMembership = ref(null)
const newDetailsCard = ref(null)
const activeDetailsCard = ref(null)
const newMembershipsPage = ref(1)
const activeMembershipsPage = ref(1)
const loading = ref(true)
const errorMessage = ref('')
const newEditForm = ref(null)
const activeEditForm = ref(null)
const newEditError = ref('')
const activeEditError = ref('')
const savingNewMembership = ref(false)
const savingActiveMembership = ref(false)
const successMessage = ref('')
let successMessageTimer = null
const membershipsPerPage = 10

const organizationKindLabels = {
  SCIENTIFIC: 'Znanstvena',
  PROFESSIONAL: 'Stručna',
  ARTISTIC: 'Umjetnička',
}

const organizationLevelLabels = {
  INTERNATIONAL: 'Međunarodna',
  NATIONAL: 'Nacionalna',
  REGIONAL: 'Regionalna',
}

const filteredNewMemberships = computed(() =>
  newMemberships.value.filter(
    (membership) => Number(membership.reporting_period_id) === Number(selectedPeriodId.value),
  ),
)

const filteredActiveMemberships = computed(() =>
  activeMemberships.value.filter(
    (membership) => Number(membership.reporting_period_id) === Number(selectedPeriodId.value),
  ),
)

const newMembershipsPageCount = computed(() =>
  Math.ceil(filteredNewMemberships.value.length / membershipsPerPage),
)

const activeMembershipsPageCount = computed(() =>
  Math.ceil(filteredActiveMemberships.value.length / membershipsPerPage),
)

const paginatedNewMemberships = computed(() => {
  const start = (newMembershipsPage.value - 1) * membershipsPerPage
  return filteredNewMemberships.value.slice(start, start + membershipsPerPage)
})

const paginatedActiveMemberships = computed(() => {
  const start = (activeMembershipsPage.value - 1) * membershipsPerPage
  return filteredActiveMemberships.value.slice(start, start + membershipsPerPage)
})

const filteredSummaries = computed(() =>
  membershipSummaries.value.filter(
    (summary) => Number(summary.reporting_period_id) === Number(selectedPeriodId.value),
  ),
)

const selectedPeriod = computed(() =>
  reportingPeriods.value.find((period) => Number(period.id) === Number(selectedPeriodId.value)),
)

function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

function clearSuccessMessage() {
  successMessage.value = ''

  if (successMessageTimer) {
    window.clearTimeout(successMessageTimer)
    successMessageTimer = null
  }
}

function showSuccessMessage(message) {
  clearSuccessMessage()
  successMessage.value = message
  successMessageTimer = window.setTimeout(clearSuccessMessage, 4000)
}

function getApiError(error, fallback) {
  const backendErrors = error.response?.data?.errors

  return Array.isArray(backendErrors)
    ? backendErrors.join(' ')
    : error.response?.data?.message || fallback
}

function findOrganizationId(name) {
  const normalizedName = name.trim().toLocaleLowerCase('hr')
  const organization = organizations.value.find(
    (entry) => entry.name.trim().toLocaleLowerCase('hr') === normalizedName,
  )

  return organization?.id ?? null
}

function findName(items, id, getLabel) {
  if (id === null || id === undefined) {
    return '—'
  }

  const item = items.find((entry) => Number(entry.id) === Number(id))
  return item ? getLabel(item) : '—'
}

function getCountryName(id) {
  return findName(countries.value, id, (country) => country.name_hr)
}

function getOrganizationalUnitName(id) {
  return findName(organizationalUnits.value, id, (unit) => unit.short_name || unit.name)
}

function getStaffMemberName(id) {
  return findName(
    staffMembers.value,
    id,
    (member) => `${member.first_name} ${member.last_name}`,
  )
}

function getOrganizationKind(value) {
  return organizationKindLabels[value] || value || '—'
}

function getOrganizationLevel(value) {
  return organizationLevelLabels[value] || value || '—'
}

function getSummaryCategory(summary) {
  const kind = getOrganizationKind(summary.organization_kind)
  const level = getOrganizationLevel(summary.organization_level).toLowerCase()

  return `${kind} ${level} članstva`
}

function getPaginationItems(currentPage, pageCount) {
  if (pageCount <= 6) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis-end', pageCount - 1, pageCount]
  }

  if (currentPage >= pageCount - 2) {
    return [1, 2, 'ellipsis-start', pageCount - 2, pageCount - 1, pageCount]
  }

  return [1, 'ellipsis-start', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-end', pageCount]
}

function changeNewMembershipsPage(page) {
  newMembershipsPage.value = page
  selectedNewMembership.value = null
}

function changeActiveMembershipsPage(page) {
  activeMembershipsPage.value = page
  selectedActiveMembership.value = null
}

function cancelNewEdit() {
  newEditForm.value = null
  newEditError.value = ''
}

function cancelActiveEdit() {
  activeEditForm.value = null
  activeEditError.value = ''
}

function selectNewMembership(membership) {
  cancelNewEdit()
  selectedNewMembership.value = membership
}

function selectActiveMembership(membership) {
  cancelActiveEdit()
  selectedActiveMembership.value = membership
}

function startNewEdit() {
  cancelActiveEdit()
  newEditError.value = ''
  newEditForm.value = {
    organization_name: selectedNewMembership.value.organization_name ?? '',
    organization_kind: selectedNewMembership.value.organization_kind ?? '',
    organization_level: selectedNewMembership.value.organization_level ?? '',
    headquarters_country_id: selectedNewMembership.value.headquarters_country_id ?? '',
    joined_on: getDateInputValue(selectedNewMembership.value.joined_on),
    membership_type: selectedNewMembership.value.membership_type ?? '',
    annual_fee_eur: selectedNewMembership.value.annual_fee_eur ?? '',
    unipu_member_id: selectedNewMembership.value.unipu_member_id ?? '',
    organizational_unit_id: selectedNewMembership.value.organizational_unit_id ?? '',
    membership_benefits: selectedNewMembership.value.membership_benefits ?? '',
    evidence_link: selectedNewMembership.value.evidence_link ?? '',
    notes: selectedNewMembership.value.notes ?? '',
  }
}

function startActiveEdit() {
  cancelNewEdit()
  activeEditError.value = ''
  activeEditForm.value = {
    organization_name: selectedActiveMembership.value.organization_name ?? '',
    organization_kind: selectedActiveMembership.value.organization_kind ?? '',
    organization_level: selectedActiveMembership.value.organization_level ?? '',
    country_id: selectedActiveMembership.value.country_id ?? '',
    joined_year: selectedActiveMembership.value.joined_year ?? '',
    membership_type: selectedActiveMembership.value.membership_type ?? '',
    annual_fee_eur: selectedActiveMembership.value.annual_fee_eur ?? '',
    unipu_representative_id: selectedActiveMembership.value.unipu_representative_id ?? '',
    organizational_unit_id: selectedActiveMembership.value.organizational_unit_id ?? '',
    organization_activities: selectedActiveMembership.value.organization_activities ?? '',
    membership_status: selectedActiveMembership.value.membership_status ?? '',
    notes: selectedActiveMembership.value.notes ?? '',
  }
}

async function refreshMembershipSummaries() {
  try {
    const response = await api.get('/api/memberships/summary')
    membershipSummaries.value = Array.isArray(response.data) ? response.data : []
  } catch {
    // Uređeni zapis ostaje spremljen i ako ponovno učitavanje sažetka ne uspije.
  }
}

async function saveNewMembership() {
  newEditError.value = ''

  if (!newEditForm.value.organization_name.trim()) {
    newEditError.value = 'Naziv organizacije je obavezan.'
    return
  }

  savingNewMembership.value = true

  try {
    const form = newEditForm.value
    const response = await api.patch(`/api/memberships/new/${selectedNewMembership.value.id}`, {
      organization_id: findOrganizationId(form.organization_name),
      organization_name: form.organization_name.trim(),
      organization_kind: form.organization_kind,
      organization_level: form.organization_level,
      headquarters_country_id: optionalNumber(form.headquarters_country_id),
      joined_on: form.joined_on || null,
      membership_type: form.membership_type.trim() || null,
      annual_fee_eur: optionalNumber(form.annual_fee_eur),
      unipu_member_id: optionalNumber(form.unipu_member_id),
      organizational_unit_id: optionalNumber(form.organizational_unit_id),
      membership_benefits: form.membership_benefits.trim() || null,
      evidence_link: form.evidence_link.trim() || null,
      notes: form.notes.trim() || null,
      updated_by: currentUserId,
    })

    const index = newMemberships.value.findIndex((membership) => membership.id === response.data.id)
    if (index !== -1) newMemberships.value[index] = response.data
    selectedNewMembership.value = response.data
    newEditForm.value = null
    showSuccessMessage('Novo članstvo uspješno je izmijenjeno.')
    await refreshMembershipSummaries()
  } catch (error) {
    newEditError.value = getApiError(error, 'Novo članstvo nije moguće izmijeniti.')
  } finally {
    savingNewMembership.value = false
  }
}

async function saveActiveMembership() {
  activeEditError.value = ''

  if (!activeEditForm.value.organization_name.trim()) {
    activeEditError.value = 'Naziv organizacije je obavezan.'
    return
  }

  savingActiveMembership.value = true

  try {
    const form = activeEditForm.value
    const response = await api.patch(`/api/memberships/active/${selectedActiveMembership.value.id}`, {
      organization_id: findOrganizationId(form.organization_name),
      organization_name: form.organization_name.trim(),
      organization_kind: form.organization_kind,
      organization_level: form.organization_level,
      country_id: optionalNumber(form.country_id),
      joined_year: optionalNumber(form.joined_year),
      membership_type: form.membership_type.trim() || null,
      annual_fee_eur: optionalNumber(form.annual_fee_eur),
      unipu_representative_id: optionalNumber(form.unipu_representative_id),
      organizational_unit_id: optionalNumber(form.organizational_unit_id),
      organization_activities: form.organization_activities.trim() || null,
      membership_status: form.membership_status.trim() || null,
      notes: form.notes.trim() || null,
      updated_by: currentUserId,
    })

    const index = activeMemberships.value.findIndex((membership) => membership.id === response.data.id)
    if (index !== -1) activeMemberships.value[index] = response.data
    selectedActiveMembership.value = response.data
    activeEditForm.value = null
    showSuccessMessage('Aktivno članstvo uspješno je izmijenjeno.')
    await refreshMembershipSummaries()
  } catch (error) {
    activeEditError.value = getApiError(error, 'Aktivno članstvo nije moguće izmijeniti.')
  } finally {
    savingActiveMembership.value = false
  }
}

function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(date)
}

function formatFee(value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value))
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

function getDateInputValue(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getEvidenceUrl(value) {
  if (!value) {
    return null
  }

  if (value.startsWith('/uploads/')) {
    return `${api.defaults.baseURL}${value}`
  }

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function getEvidenceLabel(value) {
  if (!value?.startsWith('/uploads/')) {
    return displayValue(value)
  }

  return recordFiles.value.find((file) => file.storage_path === value)?.file_name || value
}

function escapeCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function exportMemberships() {
  const records = [
    ...filteredNewMemberships.value.map((membership) => ({
      vrsta_zapisa: 'Novo članstvo',
      ...membership,
    })),
    ...filteredActiveMemberships.value.map((membership) => ({
      vrsta_zapisa: 'Aktivno članstvo',
      ...membership,
    })),
  ]

  if (!records.length) {
    return
  }

  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]
  const rows = [
    columns.map(escapeCsv).join(','),
    ...records.map((record) => columns.map((column) => escapeCsv(record[column])).join(',')),
  ]
  const file = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(file)

  link.href = url
  link.download = `clanstva-${selectedPeriod.value?.label || 'izvoz'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function printPage() {
  window.print()
}

async function openRecordFromRoute() {
  const recordId = Number(route.query.id)
  const recordType = route.query.type

  if (!Number.isInteger(recordId) || recordId <= 0) {
    return
  }

  const isNewMembership = recordType === 'new'
  const records = isNewMembership ? newMemberships.value : activeMemberships.value
  const record = records.find((membership) => Number(membership.id) === recordId)

  if (!record || (!isNewMembership && recordType !== 'active')) {
    return
  }

  selectedPeriodId.value = record.reporting_period_id
  await nextTick()

  if (isNewMembership) {
    const index = filteredNewMemberships.value.findIndex((membership) => membership.id === record.id)
    newMembershipsPage.value = Math.floor(index / membershipsPerPage) + 1
    selectedNewMembership.value = record
  } else {
    const index = filteredActiveMemberships.value.findIndex((membership) => membership.id === record.id)
    activeMembershipsPage.value = Math.floor(index / membershipsPerPage) + 1
    selectedActiveMembership.value = record
  }

  await nextTick()
  const detailsCard = isNewMembership ? newDetailsCard.value : activeDetailsCard.value
  detailsCard?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function loadMemberships() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [
      periodsResponse,
      newResponse,
      activeResponse,
      summariesResponse,
      organizationsResponse,
      countriesResponse,
      unitsResponse,
      staffResponse,
      filesResponse,
    ] =
      await Promise.all([
        api.get('/api/reporting-periods'),
        api.get('/api/memberships/new'),
        api.get('/api/memberships/active'),
        api.get('/api/memberships/summary'),
        api.get('/api/organizations'),
        api.get('/api/countries'),
        api.get('/api/organizational-units'),
        api.get('/api/staff-members'),
        api.get('/api/record-files/files'),
      ])

    reportingPeriods.value = Array.isArray(periodsResponse.data) ? periodsResponse.data : []
    newMemberships.value = Array.isArray(newResponse.data) ? newResponse.data : []
    activeMemberships.value = Array.isArray(activeResponse.data) ? activeResponse.data : []
    membershipSummaries.value = Array.isArray(summariesResponse.data) ? summariesResponse.data : []
    organizations.value = Array.isArray(organizationsResponse.data) ? organizationsResponse.data : []
    countries.value = Array.isArray(countriesResponse.data) ? countriesResponse.data : []
    organizationalUnits.value = Array.isArray(unitsResponse.data) ? unitsResponse.data : []
    staffMembers.value = Array.isArray(staffResponse.data) ? staffResponse.data : []
    recordFiles.value = Array.isArray(filesResponse.data) ? filesResponse.data : []
    selectedPeriodId.value = reportingPeriods.value[0]?.id ?? null
    await openRecordFromRoute()
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message || 'Nije moguće dohvatiti podatke o članstvima.'
  } finally {
    loading.value = false
  }
}

watch(selectedPeriodId, () => {
  cancelNewEdit()
  cancelActiveEdit()
  selectedNewMembership.value = null
  selectedActiveMembership.value = null
  newMembershipsPage.value = 1
  activeMembershipsPage.value = 1
})

onMounted(loadMemberships)
onUnmounted(clearSuccessMessage)
</script>

<template>
  <main class="memberships-view">
    <nav class="breadcrumbs" aria-label="Putanja stranice">
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink>
      <span aria-hidden="true">›</span>
      <span>Članstva</span>
    </nav>

    <div class="title-row">
      <h1>Evidencija članstva u znanstvenim, stručnim i umjetničkim organizacijama</h1>
    </div>

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

          <dl class="membership-counts">
            <div><dt>Aktivna članstva</dt><dd>{{ filteredActiveMemberships.length }}</dd></div>
            <div><dt>Nova članstva</dt><dd>{{ filteredNewMemberships.length }}</dd></div>
          </dl>
        </div>

        <div class="page-actions">
          <button
            class="action-button"
            type="button"
            :disabled="!filteredNewMemberships.length && !filteredActiveMemberships.length"
            @click="exportMemberships"
          >
            Izvoz
          </button>
          <button class="action-button" type="button" @click="printPage">Ispis</button>
        </div>
      </section>

      <section class="membership-section">
        <div class="section-heading">
          <h2>Nova članstva ({{ filteredNewMemberships.length }})</h2>
          <RouterLink
            class="action-button wide-button"
            to="/istrazivanje-i-razvoj/clanstva/novo"
          >
            Dodaj novo članstvo
          </RouterLink>
        </div>

        <div v-if="filteredNewMemberships.length" class="records-layout">
          <div class="membership-list-column">
            <div class="membership-list">
              <button
                v-for="membership in paginatedNewMemberships"
                :key="membership.id"
                class="membership-row name-only"
                :class="{ selected: selectedNewMembership?.id === membership.id }"
                type="button"
                @click="selectNewMembership(membership)"
              >
                <span>{{ membership.organization_name }}</span>
              </button>
            </div>

            <nav
              v-if="newMembershipsPageCount > 1"
              class="pagination"
              aria-label="Stranice novih članstava"
            >
              <template
                v-for="item in getPaginationItems(newMembershipsPage, newMembershipsPageCount)"
                :key="item"
              >
                <span v-if="typeof item === 'string'" class="pagination-ellipsis">…</span>
                <button
                  v-else
                  class="pagination-button"
                  :class="{ active: item === newMembershipsPage }"
                  type="button"
                  :aria-current="item === newMembershipsPage ? 'page' : undefined"
                  :aria-label="`Stranica ${item}`"
                  @click="changeNewMembershipsPage(item)"
                >
                  {{ item }}
                </button>
              </template>
            </nav>
          </div>

          <dl v-if="selectedNewMembership" ref="newDetailsCard" class="details-card">
            <div class="details-actions">
              <button
                v-if="!newEditForm"
                class="action-button edit-button"
                type="button"
                @click="startNewEdit"
              >
                Uredi
              </button>
              <template v-else>
                <button
                  class="action-button save-edit-button"
                  type="button"
                  :disabled="savingNewMembership"
                  @click="saveNewMembership"
                >
                  {{ savingNewMembership ? 'Spremanje...' : 'Spremi' }}
                </button>
                <button
                  class="action-button cancel-edit-button"
                  type="button"
                  :disabled="savingNewMembership"
                  @click="cancelNewEdit"
                >
                  Odustani
                </button>
              </template>
            </div>
            <p v-if="newEditError" class="edit-error" role="alert">{{ newEditError }}</p>
            <div><dt>Broj</dt><dd>{{ selectedNewMembership.id }}</dd></div>
            <div>
              <dt>Organizacija</dt>
              <dd><input v-if="newEditForm" v-model="newEditForm.organization_name" class="detail-input" maxlength="200" /><template v-else>{{ selectedNewMembership.organization_name }}</template></dd>
            </div>
            <div>
              <dt>Vrsta organizacije</dt>
              <dd>
                <select v-if="newEditForm" v-model="newEditForm.organization_kind" class="detail-input">
                  <option value="SCIENTIFIC">Znanstvena</option>
                  <option value="PROFESSIONAL">Stručna</option>
                  <option value="ARTISTIC">Umjetnička</option>
                </select>
                <template v-else>{{ getOrganizationKind(selectedNewMembership.organization_kind) }}</template>
              </dd>
            </div>
            <div>
              <dt>Razina</dt>
              <dd>
                <select v-if="newEditForm" v-model="newEditForm.organization_level" class="detail-input">
                  <option value="INTERNATIONAL">Međunarodna</option>
                  <option value="NATIONAL">Nacionalna</option>
                  <option value="REGIONAL">Regionalna</option>
                </select>
                <template v-else>{{ getOrganizationLevel(selectedNewMembership.organization_level) }}</template>
              </dd>
            </div>
            <div>
              <dt>Država sjedišta</dt>
              <dd>
                <select v-if="newEditForm" v-model="newEditForm.headquarters_country_id" class="detail-input">
                  <option value="">—</option>
                  <option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name_hr }}</option>
                </select>
                <template v-else>{{ getCountryName(selectedNewMembership.headquarters_country_id) }}</template>
              </dd>
            </div>
            <div>
              <dt>Datum učlanjenja</dt>
              <dd><input v-if="newEditForm" v-model="newEditForm.joined_on" class="detail-input" type="date" /><template v-else>{{ formatDate(selectedNewMembership.joined_on) }}</template></dd>
            </div>
            <div>
              <dt>Vrsta članstva</dt>
              <dd><input v-if="newEditForm" v-model="newEditForm.membership_type" class="detail-input" maxlength="40" /><template v-else>{{ displayValue(selectedNewMembership.membership_type) }}</template></dd>
            </div>
            <div>
              <dt>Godišnja članarina</dt>
              <dd><input v-if="newEditForm" v-model="newEditForm.annual_fee_eur" class="detail-input" type="number" min="0" max="999.99" step="0.01" /><template v-else>{{ formatFee(selectedNewMembership.annual_fee_eur) }}</template></dd>
            </div>
            <div>
              <dt>Član Sveučilišta</dt>
              <dd>
                <select v-if="newEditForm" v-model="newEditForm.unipu_member_id" class="detail-input">
                  <option value="">—</option>
                  <option v-for="member in staffMembers" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option>
                </select>
                <template v-else>{{ getStaffMemberName(selectedNewMembership.unipu_member_id) }}</template>
              </dd>
            </div>
            <div>
              <dt>Sastavnica</dt>
              <dd>
                <select v-if="newEditForm" v-model="newEditForm.organizational_unit_id" class="detail-input">
                  <option value="">—</option>
                  <option v-for="unit in organizationalUnits" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option>
                </select>
                <template v-else>{{ getOrganizationalUnitName(selectedNewMembership.organizational_unit_id) }}</template>
              </dd>
            </div>
            <div>
              <dt>Koristi članstva</dt>
              <dd><textarea v-if="newEditForm" v-model="newEditForm.membership_benefits" class="detail-input" rows="2"></textarea><template v-else>{{ displayValue(selectedNewMembership.membership_benefits) }}</template></dd>
            </div>
            <div>
              <dt>Dokaz</dt>
              <dd class="evidence-value">
                <input v-if="newEditForm" v-model="newEditForm.evidence_link" class="detail-input" />
                <a
                  v-else-if="getEvidenceUrl(selectedNewMembership.evidence_link)"
                  class="evidence-link"
                  :href="getEvidenceUrl(selectedNewMembership.evidence_link)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ getEvidenceLabel(selectedNewMembership.evidence_link) }}
                </a>
                <span v-else>{{ displayValue(selectedNewMembership.evidence_link) }}</span>
              </dd>
            </div>
            <div>
              <dt>Napomena</dt>
              <dd><textarea v-if="newEditForm" v-model="newEditForm.notes" class="detail-input" rows="2"></textarea><template v-else>{{ displayValue(selectedNewMembership.notes) }}</template></dd>
            </div>
          </dl>
        </div>

        <p v-else class="empty-message">Nema novih članstava za odabrano razdoblje.</p>
      </section>

      <section class="membership-section">
        <h2>Aktivna članstva ({{ filteredActiveMemberships.length }})</h2>

        <div v-if="filteredActiveMemberships.length" class="records-layout">
          <div class="membership-list-column">
            <div class="membership-list">
              <button
                v-for="membership in paginatedActiveMemberships"
                :key="membership.id"
                class="membership-row name-only"
                :class="{ selected: selectedActiveMembership?.id === membership.id }"
                type="button"
                @click="selectActiveMembership(membership)"
              >
                <span>{{ membership.organization_name }}</span>
              </button>
            </div>

            <nav
              v-if="activeMembershipsPageCount > 1"
              class="pagination"
              aria-label="Stranice aktivnih članstava"
            >
              <template
                v-for="item in getPaginationItems(activeMembershipsPage, activeMembershipsPageCount)"
                :key="item"
              >
                <span v-if="typeof item === 'string'" class="pagination-ellipsis">…</span>
                <button
                  v-else
                  class="pagination-button"
                  :class="{ active: item === activeMembershipsPage }"
                  type="button"
                  :aria-current="item === activeMembershipsPage ? 'page' : undefined"
                  :aria-label="`Stranica ${item}`"
                  @click="changeActiveMembershipsPage(item)"
                >
                  {{ item }}
                </button>
              </template>
            </nav>
          </div>

          <dl v-if="selectedActiveMembership" ref="activeDetailsCard" class="details-card">
            <div class="details-actions">
              <button
                v-if="!activeEditForm"
                class="action-button edit-button"
                type="button"
                @click="startActiveEdit"
              >
                Uredi
              </button>
              <template v-else>
                <button
                  class="action-button save-edit-button"
                  type="button"
                  :disabled="savingActiveMembership"
                  @click="saveActiveMembership"
                >
                  {{ savingActiveMembership ? 'Spremanje...' : 'Spremi' }}
                </button>
                <button
                  class="action-button cancel-edit-button"
                  type="button"
                  :disabled="savingActiveMembership"
                  @click="cancelActiveEdit"
                >
                  Odustani
                </button>
              </template>
            </div>
            <p v-if="activeEditError" class="edit-error" role="alert">{{ activeEditError }}</p>
            <div><dt>Broj</dt><dd>{{ selectedActiveMembership.id }}</dd></div>
            <div><dt>Organizacija</dt><dd><input v-if="activeEditForm" v-model="activeEditForm.organization_name" class="detail-input" maxlength="200" /><template v-else>{{ selectedActiveMembership.organization_name }}</template></dd></div>
            <div>
              <dt>Vrsta organizacije</dt>
              <dd><select v-if="activeEditForm" v-model="activeEditForm.organization_kind" class="detail-input"><option value="SCIENTIFIC">Znanstvena</option><option value="PROFESSIONAL">Stručna</option><option value="ARTISTIC">Umjetnička</option></select><template v-else>{{ getOrganizationKind(selectedActiveMembership.organization_kind) }}</template></dd>
            </div>
            <div>
              <dt>Razina</dt>
              <dd><select v-if="activeEditForm" v-model="activeEditForm.organization_level" class="detail-input"><option value="INTERNATIONAL">Međunarodna</option><option value="NATIONAL">Nacionalna</option><option value="REGIONAL">Regionalna</option></select><template v-else>{{ getOrganizationLevel(selectedActiveMembership.organization_level) }}</template></dd>
            </div>
            <div>
              <dt>Država</dt>
              <dd><select v-if="activeEditForm" v-model="activeEditForm.country_id" class="detail-input"><option value="">—</option><option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name_hr }}</option></select><template v-else>{{ getCountryName(selectedActiveMembership.country_id) }}</template></dd>
            </div>
            <div><dt>Godina učlanjenja</dt><dd><input v-if="activeEditForm" v-model="activeEditForm.joined_year" class="detail-input" type="number" min="1950" :max="currentYear" /><template v-else>{{ displayValue(selectedActiveMembership.joined_year) }}</template></dd></div>
            <div><dt>Vrsta članstva</dt><dd><input v-if="activeEditForm" v-model="activeEditForm.membership_type" class="detail-input" maxlength="40" /><template v-else>{{ displayValue(selectedActiveMembership.membership_type) }}</template></dd></div>
            <div><dt>Godišnja članarina</dt><dd><input v-if="activeEditForm" v-model="activeEditForm.annual_fee_eur" class="detail-input" type="number" min="0" max="999.99" step="0.01" /><template v-else>{{ formatFee(selectedActiveMembership.annual_fee_eur) }}</template></dd></div>
            <div>
              <dt>Predstavnik Sveučilišta</dt>
              <dd><select v-if="activeEditForm" v-model="activeEditForm.unipu_representative_id" class="detail-input"><option value="">—</option><option v-for="member in staffMembers" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select><template v-else>{{ getStaffMemberName(selectedActiveMembership.unipu_representative_id) }}</template></dd>
            </div>
            <div>
              <dt>Sastavnica</dt>
              <dd><select v-if="activeEditForm" v-model="activeEditForm.organizational_unit_id" class="detail-input"><option value="">—</option><option v-for="unit in organizationalUnits" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select><template v-else>{{ getOrganizationalUnitName(selectedActiveMembership.organizational_unit_id) }}</template></dd>
            </div>
            <div><dt>Aktivnosti organizacije</dt><dd><textarea v-if="activeEditForm" v-model="activeEditForm.organization_activities" class="detail-input" rows="2"></textarea><template v-else>{{ displayValue(selectedActiveMembership.organization_activities) }}</template></dd></div>
            <div><dt>Status članstva</dt><dd><input v-if="activeEditForm" v-model="activeEditForm.membership_status" class="detail-input" maxlength="20" /><template v-else>{{ displayValue(selectedActiveMembership.membership_status) }}</template></dd></div>
            <div><dt>Napomena</dt><dd><textarea v-if="activeEditForm" v-model="activeEditForm.notes" class="detail-input" rows="2"></textarea><template v-else>{{ displayValue(selectedActiveMembership.notes) }}</template></dd></div>
          </dl>
        </div>

        <p v-else class="empty-message">Nema aktivnih članstava za odabrano razdoblje.</p>
      </section>

      <section class="membership-section summary-section">
        <h2>Sažetak po kategorijama</h2>

        <div v-if="filteredSummaries.length" class="summary-table-wrapper">
          <table class="summary-table">
            <thead>
              <tr>
                <th>Kategorija</th>
                <th>Aktivna članstva</th>
                <th>Nova članstva</th>
                <th>Ukupno</th>
                <th>Udio</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="summary in filteredSummaries"
                :key="`${summary.reporting_period_id}-${summary.organization_kind}-${summary.organization_level}`"
              >
                <td>{{ getSummaryCategory(summary) }}</td>
                <td>{{ summary.existing_memberships }}</td>
                <td>{{ summary.new_memberships }}</td>
                <td>{{ summary.total_memberships }}</td>
                <td>{{ summary.share_percent === null ? '—' : `${summary.share_percent} %` }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="empty-message">Nema sažetaka za odabrano razdoblje.</p>
      </section>
    </template>

    <Transition name="snackbar">
      <div v-if="successMessage" class="success-snackbar" role="status" aria-live="polite">
        {{ successMessage }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.memberships-view {
  min-height: calc(100vh - 112px);
  padding: 34px clamp(32px, 5vw, 128px) 90px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgb(var(--v-theme-muted));
  font-size: clamp(1rem, 1.1vw, 1.45rem);
}

.breadcrumbs a,
.membership-row {
  transition: color 160ms ease;
}

.breadcrumbs a:hover {
  color: rgb(var(--v-theme-primary));
}

.memberships-view h1 {
  margin: 0;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(1.5rem, 1.65vw, 2.35rem);
  font-weight: 400;
  line-height: 1.35;
}

.title-row {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 40px;
  margin-top: 18px;
}

.page-actions,
.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-actions {
  flex-shrink: 0;
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  padding: 9px 18px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
  transition: background-color 160ms ease, color 160ms ease;
}

.action-button:hover:not(:disabled) {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.action-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.wide-button {
  min-width: 210px;
}

.wide-button:disabled {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  opacity: 1;
}

.page-message {
  margin-top: 40px;
  color: rgb(var(--v-theme-muted));
}

.error-message {
  color: rgb(var(--v-theme-error));
}

.overview-section {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 40px;
  margin-top: 36px;
}

.overview-content {
  display: flex;
  align-items: end;
  gap: clamp(28px, 4vw, 68px);
}

.period-field {
  display: grid;
  gap: 9px;
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}

.period-field select {
  min-width: 220px;
  padding: 10px 36px 10px 12px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
}

.membership-counts {
  display: flex;
  align-items: end;
  gap: clamp(28px, 4vw, 68px);
  margin: 0;
}

.membership-counts div {
  display: grid;
  gap: 9px;
}

.membership-counts dt {
  color: rgb(var(--v-theme-muted));
  font-size: 0.9rem;
}

.membership-counts dd {
  margin: 0;
  color: rgb(var(--v-theme-primary));
  font-size: 1.15rem;
  font-weight: 700;
}

.membership-section {
  margin-top: clamp(64px, 8vh, 110px);
}

.membership-section h2 {
  margin: 0;
  font-size: clamp(1.55rem, 1.7vw, 2.5rem);
  font-weight: 400;
}

.section-heading {
  justify-content: space-between;
}

.records-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.1fr);
  gap: clamp(44px, 8vw, 150px);
  align-items: start;
  margin-top: 34px;
}

.membership-list {
  display: grid;
  grid-template-rows: repeat(5, auto);
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  width: calc(100% + clamp(24px, 4vw, 64px));
  column-gap: clamp(32px, 4vw, 64px);
  gap: 4px;
}

.membership-list-column {
  min-width: 0;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 22px;
}

.pagination-button,
.pagination-ellipsis {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: rgb(var(--v-theme-primary));
  font: inherit;
  font-size: 0.95rem;
}

.pagination-button {
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.pagination-button:hover {
  background: rgba(var(--v-theme-primary), 0.12);
}

.pagination-button.active {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.membership-row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(120px, 1fr);
  gap: 24px;
  width: 100%;
  padding: 14px 18px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--v-theme-membership-link));
  cursor: pointer;
  font: inherit;
  font-size: clamp(1rem, 1.05vw, 1.35rem);
  text-align: left;
}

.membership-row.name-only {
  grid-template-columns: minmax(0, 1fr);
}

.membership-row:hover,
.membership-row.selected {
  background: rgba(var(--v-theme-primary), 0.1);
}

.membership-row.selected {
  color: rgb(var(--v-theme-on-background));
}

.details-card {
  display: grid;
  gap: 9px;
  margin: 0;
  padding: clamp(28px, 3vw, 48px);
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
}

.details-card div {
  display: grid;
  grid-template-columns: minmax(150px, 0.9fr) minmax(0, 1.1fr);
  gap: 24px;
}

.details-card .details-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.edit-button {
  min-width: 78px;
  border-color: rgb(var(--v-theme-on-surface));
  background: rgb(var(--v-theme-surface));
}

.edit-button:disabled {
  opacity: 0.7;
}

.details-card dt {
  font-weight: 500;
}

.details-card dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.detail-input {
  width: 100%;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid rgb(var(--v-theme-on-category-card));
  border-radius: 6px;
  outline: none;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
}

textarea.detail-input {
  resize: vertical;
}

.detail-input:focus {
  box-shadow: 0 0 0 2px rgba(var(--v-theme-on-category-card), 0.18);
}

.details-card .edit-error {
  margin: 0 0 8px;
  color: rgb(var(--v-theme-error));
}

.details-actions .save-edit-button,
.details-actions .cancel-edit-button {
  min-width: 92px;
  border-color: rgb(var(--v-theme-on-surface));
}

.evidence-value {
  color: rgb(var(--v-theme-evidence-link));
}

.evidence-link {
  color: inherit;
  cursor: pointer;
  text-decoration: none;
  transition: color 160ms ease, opacity 160ms ease;
}

.evidence-link:hover {
  opacity: 0.72;
  text-decoration: underline;
}

.success-snackbar {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 1000;
  min-width: min(360px, calc(100vw - 40px));
  padding: 14px 18px;
  border: 1px solid #62a957;
  border-radius: 7px;
  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.2);
  background: #b8f5ae;
  color: #1f5525;
}

.snackbar-enter-active,
.snackbar-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.empty-message {
  margin-top: 28px;
  color: rgb(var(--v-theme-muted));
}

.summary-table-wrapper {
  margin-top: 34px;
  border-radius: 10px;
  overflow-x: auto;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.summary-table th,
.summary-table td {
  padding: 14px 18px;
  border: 1px solid rgb(var(--v-theme-table-border));
}

.summary-table th {
  border-color: rgb(var(--v-theme-table-header-border));
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
}

.summary-table td:not(:first-child),
.summary-table th:not(:first-child) {
  text-align: center;
}

@media (max-width: 900px) {
  .title-row {
    flex-direction: column;
  }

  .overview-section {
    align-items: start;
    flex-direction: column;
  }

  .overview-content {
    flex-wrap: wrap;
  }

  .records-layout {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}

@media (max-width: 600px) {
  .memberships-view {
    padding: 28px 20px 56px;
  }

  .membership-counts {
    flex-wrap: wrap;
  }

  .section-heading {
    align-items: start;
    flex-direction: column;
  }

  .wide-button {
    width: 100%;
  }

  .membership-row,
  .details-card div {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .membership-list {
    width: 100%;
    grid-template-rows: none;
    grid-auto-flow: row;
    grid-auto-columns: auto;
    grid-template-columns: 1fr;
  }

  .period-field,
  .period-field select {
    width: 100%;
  }

  .success-snackbar {
    right: 20px;
    bottom: 20px;
  }
}

@media print {
  .page-actions,
  .wide-button,
  .edit-button,
  .theme-toggle {
    display: none;
  }
}
</style>
