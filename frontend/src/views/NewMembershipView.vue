<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'

const router = useRouter()
const currentUserId = 1
const maxFileSize = 10 * 1024 * 1024
const allowedFileTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]

const organizations = ref([])
const countries = ref([])
const staffMembers = ref([])
const organizationalUnits = ref([])
const selectedFile = ref(null)
const fileInput = ref(null)
const loading = ref(true)
const submitting = ref(false)
const saved = ref(false)
const errorMessages = ref([])
const successMessage = ref('')
let successMessageTimer = null

const form = reactive({
  reporting_period_id: null,
  organization_name: '',
  organization_kind: '',
  organization_level: '',
  headquarters_country_id: null,
  joined_day: '',
  joined_month: '',
  joined_year: '',
  membership_type: '',
  annual_fee_eur: '',
  has_unipu_member: false,
  unipu_member_id: null,
  has_organizational_unit: false,
  organizational_unit_id: null,
  membership_benefits: '',
  evidence_link: '',
  notes: '',
})

const selectedFileName = computed(() => selectedFile.value?.name || 'Nije odabrana datoteka')

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

function findCurrentReportingPeriod(periods) {
  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  return periods
    .filter((period) => {
      const startDate = String(period.start_date || '').slice(0, 10)
      const endDate = String(period.end_date || '').slice(0, 10)

      return !period.is_closed && startDate <= today && today <= endDate
    })
    .sort((first, second) => String(second.start_date).localeCompare(String(first.start_date)))[0]
}

function findOrganization() {
  const name = form.organization_name.trim().toLocaleLowerCase('hr')
  return organizations.value.find(
    (organization) => organization.name.trim().toLocaleLowerCase('hr') === name,
  )
}

function useKnownOrganizationData() {
  const organization = findOrganization()

  if (organization?.country_id && !form.headquarters_country_id) {
    form.headquarters_country_id = organization.country_id
  }
}

function sanitizeDatePart(field, maxLength) {
  form[field] = form[field].replace(/\D/g, '').slice(0, maxLength)
}

function getJoinedOn(errors = []) {
  const hasAnyDatePart = form.joined_day || form.joined_month || form.joined_year

  if (!hasAnyDatePart) {
    return null
  }

  if (!form.joined_day || !form.joined_month || form.joined_year.length !== 4) {
    errors.push('Datum učlanjenja mora sadržavati dan, mjesec i četveroznamenkastu godinu.')
    return null
  }

  const day = Number(form.joined_day)
  const month = Number(form.joined_month)
  const year = Number(form.joined_year)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    errors.push('Datum učlanjenja nije ispravan.')
    return null
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function clearUnipuMember() {
  if (!form.has_unipu_member) {
    form.unipu_member_id = null
  }
}

function clearOrganizationalUnit() {
  if (!form.has_organizational_unit) {
    form.organizational_unit_id = null
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function clearFile() {
  selectedFile.value = null

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function selectFile(event) {
  const file = event.target.files?.[0] || null
  selectedFile.value = file
  errorMessages.value = []

  if (!file) {
    return
  }

  if (!allowedFileTypes.includes(file.type)) {
    errorMessages.value = ['Dopuštene su PDF, Word, PNG i JPG datoteke.']
    clearFile()
  } else if (file.size > maxFileSize) {
    errorMessages.value = ['Datoteka smije imati najviše 10 MB.']
    clearFile()
  } else if (file.name.length > 50) {
    errorMessages.value = ['Naziv datoteke smije imati najviše 50 znakova.']
    clearFile()
  }
}

function validateForm() {
  const errors = []

  if (!form.reporting_period_id) {
    errors.push('Trenutno otvoreno izvještajno razdoblje nije pronađeno.')
  }
  if (!form.organization_name.trim()) errors.push('Naziv organizacije je obavezan.')
  if (form.organization_name.trim().length > 200) {
    errors.push('Naziv organizacije smije imati najviše 200 znakova.')
  }
  if (!form.organization_kind) errors.push('Vrsta organizacije je obavezna.')
  if (!form.organization_level) errors.push('Razina organizacije je obavezna.')
  getJoinedOn(errors)
  if (form.membership_type.length > 40) {
    errors.push('Vrsta članstva smije imati najviše 40 znakova.')
  }
  if (form.has_unipu_member && !form.unipu_member_id) {
    errors.push('Odaberite člana Sveučilišta.')
  }
  if (form.has_organizational_unit && !form.organizational_unit_id) {
    errors.push('Odaberite sastavnicu Sveučilišta.')
  }

  if (form.evidence_link.trim()) {
    try {
      const evidenceUrl = new URL(form.evidence_link.trim())

      if (!['http:', 'https:'].includes(evidenceUrl.protocol)) {
        errors.push('Poveznica dokaza mora započeti s http:// ili https://.')
      }
    } catch {
      errors.push('Poveznica dokaza nije ispravna.')
    }
  }

  if (form.annual_fee_eur !== '') {
    const fee = Number(form.annual_fee_eur)

    if (!Number.isFinite(fee) || fee < 0 || fee > 999.99) {
      errors.push('Godišnja članarina mora biti između 0 i 999,99 eura.')
    }
  }

  return errors
}

async function rollbackMembership(membershipId, fileId) {
  if (fileId) {
    await api.delete(`/api/record-files/files/${fileId}`).catch(() => {})
  }

  if (membershipId) {
    await api.delete(`/api/memberships/new/${membershipId}`).catch(() => {})
  }
}

async function submitForm() {
  errorMessages.value = validateForm()
  clearSuccessMessage()

  if (errorMessages.value.length) {
    return
  }

  submitting.value = true
  let membershipId = null
  let uploadedFileId = null

  try {
    const knownOrganization = findOrganization()
    const response = await api.post('/api/memberships/new', {
      reporting_period_id: Number(form.reporting_period_id),
      organization_id: knownOrganization?.id || null,
      organization_name: form.organization_name.trim(),
      organization_kind: form.organization_kind,
      organization_level: form.organization_level,
      headquarters_country_id: optionalNumber(form.headquarters_country_id),
      joined_on: getJoinedOn(),
      membership_type: form.membership_type.trim() || null,
      annual_fee_eur: optionalNumber(form.annual_fee_eur),
      unipu_member_id: form.has_unipu_member ? optionalNumber(form.unipu_member_id) : null,
      organizational_unit_id: form.has_organizational_unit
        ? optionalNumber(form.organizational_unit_id)
        : null,
      membership_benefits: form.membership_benefits.trim() || null,
      evidence_link: form.evidence_link.trim() || null,
      notes: form.notes.trim() || null,
      created_by: currentUserId,
      updated_by: currentUserId,
    })

    membershipId = response.data.id

    if (selectedFile.value) {
      const uploadData = new FormData()
      uploadData.append('file', selectedFile.value)
      uploadData.append('record_type', 'MEMBERSHIP')
      uploadData.append('record_id', String(membershipId))
      uploadData.append('file_role', 'EVIDENCE')
      uploadData.append('uploaded_by', String(currentUserId))

      const uploadResponse = await api.post('/api/record-files/files/upload', uploadData)
      uploadedFileId = uploadResponse.data.id

      await api.patch(`/api/memberships/new/${membershipId}`, {
        evidence_link: uploadResponse.data.storage_path,
        updated_by: currentUserId,
      })
    }

    saved.value = true
    showSuccessMessage('Novo članstvo uspješno je spremljeno.')
  } catch (error) {
    await rollbackMembership(membershipId, uploadedFileId)

    const backendErrors = error.response?.data?.errors
    errorMessages.value = Array.isArray(backendErrors)
      ? backendErrors
      : [error.response?.data?.message || 'Novo članstvo nije moguće spremiti.']
  } finally {
    submitting.value = false
  }
}

async function loadOptions() {
  loading.value = true
  errorMessages.value = []

  try {
    const [
      periodsResponse,
      organizationsResponse,
      countriesResponse,
      staffResponse,
      unitsResponse,
    ] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/organizations'),
      api.get('/api/countries'),
      api.get('/api/staff-members'),
      api.get('/api/organizational-units'),
    ])

    const reportingPeriods = Array.isArray(periodsResponse.data) ? periodsResponse.data : []
    organizations.value = Array.isArray(organizationsResponse.data)
      ? organizationsResponse.data
      : []
    countries.value = Array.isArray(countriesResponse.data) ? countriesResponse.data : []
    staffMembers.value = Array.isArray(staffResponse.data) ? staffResponse.data : []
    organizationalUnits.value = Array.isArray(unitsResponse.data) ? unitsResponse.data : []
    form.reporting_period_id = findCurrentReportingPeriod(reportingPeriods)?.id ?? null

    if (!form.reporting_period_id) {
      errorMessages.value = [
        'Trenutno otvoreno izvještajno razdoblje nije pronađeno. Novo članstvo nije moguće spremiti.',
      ]
    }
  } catch (error) {
    errorMessages.value = [
      error.response?.data?.message || 'Nije moguće učitati podatke potrebne za obrazac.',
    ]
  } finally {
    loading.value = false
  }
}

onMounted(loadOptions)
onUnmounted(clearSuccessMessage)
</script>

<template>
  <main class="new-membership-view">
    <nav class="breadcrumbs" aria-label="Putanja stranice">
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink>
      <span aria-hidden="true">›</span>
      <RouterLink to="/istrazivanje-i-razvoj/clanstva">Članstva</RouterLink>
      <span aria-hidden="true">›</span>
      <span>Novo članstvo</span>
    </nav>

    <h1>Dodavanje novog članstva</h1>
    <p class="page-description">
      Evidencija članstva u znanstvenim, stručnim i umjetničkim organizacijama
    </p>

    <p v-if="loading" class="page-message">Učitavanje obrasca...</p>

    <form v-else class="membership-form" @submit.prevent="submitForm">
      <div v-if="errorMessages.length" class="form-alert error-alert" role="alert">
        <p>Provjerite unesene podatke:</p>
        <ul>
          <li v-for="message in errorMessages" :key="message">{{ message }}</li>
        </ul>
      </div>

      <div class="form-card">
        <div class="form-grid top-grid">
          <label class="form-field organization-field">
            <span>Organizacija *</span>
            <input
              v-model="form.organization_name"
              list="organizations"
              maxlength="200"
              placeholder="Naziv organizacije"
              :disabled="saved"
              @change="useKnownOrganizationData"
            />
            <datalist id="organizations">
              <option v-for="organization in organizations" :key="organization.id">
                {{ organization.name }}
              </option>
            </datalist>
          </label>

          <fieldset class="form-field date-field">
            <span>Datum učlanjenja</span>
            <div class="date-inputs">
              <input
                v-model="form.joined_day"
                aria-label="Dan učlanjenja"
                inputmode="numeric"
                maxlength="2"
                placeholder="DD"
                :disabled="saved"
                @input="sanitizeDatePart('joined_day', 2)"
              />
              <input
                v-model="form.joined_month"
                aria-label="Mjesec učlanjenja"
                inputmode="numeric"
                maxlength="2"
                placeholder="MM"
                :disabled="saved"
                @input="sanitizeDatePart('joined_month', 2)"
              />
              <input
                v-model="form.joined_year"
                aria-label="Godina učlanjenja"
                inputmode="numeric"
                maxlength="4"
                placeholder="YYYY"
                :disabled="saved"
                @input="sanitizeDatePart('joined_year', 4)"
              />
            </div>
          </fieldset>
        </div>

        <div class="form-grid four-column-grid">
          <label class="form-field country-style-select">
            <span>Vrsta organizacije *</span>
            <select v-model="form.organization_kind" :disabled="saved">
              <option value="" disabled>Odaberite vrstu</option>
              <option value="SCIENTIFIC">Znanstvena</option>
              <option value="PROFESSIONAL">Stručna</option>
              <option value="ARTISTIC">Umjetnička</option>
            </select>
          </label>

          <label class="form-field country-style-select">
            <span>Razina *</span>
            <select v-model="form.organization_level" :disabled="saved">
              <option value="" disabled>Odaberite razinu</option>
              <option value="INTERNATIONAL">Međunarodna</option>
              <option value="NATIONAL">Nacionalna</option>
              <option value="REGIONAL">Regionalna</option>
            </select>
          </label>

          <label class="form-field pill-field">
            <span>Država sjedišta</span>
            <CountryAutocomplete
              v-model="form.headquarters_country_id"
              :countries="countries"
              :disabled="saved"
              placeholder="Nije odabrano"
            />
          </label>

          <label class="form-field country-style-select">
            <span>Vrsta članstva</span>
            <input
              v-model="form.membership_type"
              maxlength="40"
              placeholder="Npr. redovno članstvo"
              :disabled="saved"
            />
          </label>
        </div>

        <div class="form-grid fee-grid">
          <label class="form-field fee-field">
            <span>Godišnja članarina (EUR)</span>
            <input
              v-model="form.annual_fee_eur"
              type="number"
              min="0"
              max="999.99"
              step="0.01"
              placeholder="0,00"
              :disabled="saved"
            />
          </label>
        </div>

        <div class="checkbox-options">
          <div class="checkbox-option">
            <label class="checkbox-label">
              <input
                v-model="form.has_unipu_member"
                type="checkbox"
                :disabled="saved"
                @change="clearUnipuMember"
              />
              <span>Član Sveučilišta</span>
            </label>
            <label v-if="form.has_unipu_member" class="form-field checkbox-select">
              <span>Odaberite člana</span>
              <select v-model.number="form.unipu_member_id" :disabled="saved">
                <option :value="null">Nije odabrano</option>
                <option v-for="member in staffMembers" :key="member.id" :value="member.id">
                  {{ member.first_name }} {{ member.last_name }}
                </option>
              </select>
            </label>
          </div>

          <div class="checkbox-option">
            <label class="checkbox-label">
              <input
                v-model="form.has_organizational_unit"
                type="checkbox"
                :disabled="saved"
                @change="clearOrganizationalUnit"
              />
              <span>Sastavnica Sveučilišta</span>
            </label>
            <label v-if="form.has_organizational_unit" class="form-field checkbox-select">
              <span>Odaberite sastavnicu</span>
              <select v-model.number="form.organizational_unit_id" :disabled="saved">
                <option :value="null">Nije odabrano</option>
                <option v-for="unit in organizationalUnits" :key="unit.id" :value="unit.id">
                  {{ unit.short_name || unit.name }}
                </option>
              </select>
            </label>
          </div>
        </div>

        <label class="form-field wide-field">
          <span>Koristi članstva</span>
          <textarea
            v-model="form.membership_benefits"
            rows="3"
            placeholder="Opišite koristi članstva"
            :disabled="saved"
          ></textarea>
        </label>

        <div class="form-field wide-field evidence-field">
          <span>Dokaz</span>
          <input
            v-model="form.evidence_link"
            type="url"
            placeholder="https://poveznica-na-dokaz.hr"
            :disabled="saved"
          />
          <small
            >Poveznica ili datoteka. Ako unesete oboje, spremljena datoteka ima prednost.</small
          >
          <div class="file-picker">
            <input
              ref="fileInput"
              class="visually-hidden"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              :disabled="saved"
              @change="selectFile"
            />
            <button class="file-button" type="button" :disabled="saved" @click="openFilePicker">
              Odaberi datoteku
            </button>
            <span class="file-name">{{ selectedFileName }}</span>
            <button
              v-if="selectedFile && !saved"
              class="remove-file-button"
              type="button"
              aria-label="Ukloni odabranu datoteku"
              @click="clearFile"
            >
              Ukloni
            </button>
          </div>
        </div>

        <label class="form-field wide-field">
          <span>Napomena</span>
          <textarea
            v-model="form.notes"
            rows="3"
            placeholder="Dodatna napomena"
            :disabled="saved"
          ></textarea>
        </label>

        <div class="form-actions">
          <button
            class="save-button"
            type="submit"
            :disabled="submitting || saved || !form.reporting_period_id"
          >
            {{ submitting ? 'Spremanje...' : 'Spremi' }}
          </button>
        </div>
      </div>

      <div class="bottom-actions">
        <button
          type="button"
          class="back-button"
          @click="router.push('/istrazivanje-i-razvoj/clanstva')"
        >
          Natrag
        </button>
      </div>
    </form>

    <Transition name="snackbar">
      <div v-if="successMessage" class="success-snackbar" role="status" aria-live="polite">
        {{ successMessage }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.new-membership-view {
  min-height: calc(100vh - 112px);
  padding: 34px clamp(32px, 5vw, 128px) 90px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.breadcrumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: rgb(var(--v-theme-muted));
  font-size: clamp(1rem, 1.1vw, 1.45rem);
}

.breadcrumbs a {
  transition: color 160ms ease;
}

.breadcrumbs a:hover {
  color: rgb(var(--v-theme-primary));
}

h1 {
  margin: 26px 0 8px;
  font-size: clamp(1.8rem, 2vw, 3rem);
  font-weight: 400;
}

.page-description {
  margin: 0;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(1rem, 1.1vw, 1.35rem);
}

.page-message {
  margin-top: 48px;
  color: rgb(var(--v-theme-muted));
}

.membership-form {
  margin-top: 48px;
}

.form-alert {
  margin-bottom: 18px;
  padding: 14px 18px;
  border-radius: 8px;
}

.form-alert p,
.form-alert ul {
  margin: 0;
}

.form-alert ul {
  margin-top: 6px;
  padding-left: 20px;
}

.error-alert {
  border: 1px solid rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-error));
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
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.form-card {
  display: grid;
  gap: clamp(34px, 4vw, 62px);
  padding: clamp(34px, 5vw, 76px);
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
}

.form-grid {
  display: grid;
  gap: clamp(24px, 3vw, 48px);
}

.top-grid {
  grid-template-columns: minmax(280px, 1.4fr) minmax(190px, 0.8fr);
}

.four-column-grid {
  grid-template-columns: repeat(4, minmax(170px, 1fr));
}

.fee-grid {
  grid-template-columns: minmax(240px, 0.48fr) minmax(0, 0.52fr);
}

.form-field {
  display: grid;
  align-content: start;
  gap: 9px;
  min-width: 0;
}

.form-field > span {
  font-weight: 500;
}

.date-field {
  padding: 0;
  border: 0;
  margin: 0;
}

.date-inputs {
  display: grid;
  grid-template-columns: 64px 64px 92px;
  gap: 8px;
}

.date-inputs input {
  padding-inline: 8px;
  text-align: center;
}

.form-field input,
.form-field select,
.form-field textarea {
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 7px;
  outline: none;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
}

.form-field select {
  border-color: #000;
}

.form-field input,
.form-field select {
  min-height: 46px;
}

.form-field textarea {
  resize: vertical;
}

.pill-field input,
.pill-field select {
  padding-inline: 18px;
  border-color: rgb(var(--v-theme-on-category-card));
  border-radius: 999px;
  background: transparent;
  color: rgb(var(--v-theme-on-category-card));
}

.pill-field input::placeholder {
  color: currentColor;
  opacity: 0.72;
}

.country-style-select input,
.country-style-select select {
  padding: 12px 14px;
  border-color: rgb(var(--v-theme-category-border));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.checkbox-options {
  display: grid;
  gap: 24px;
  max-width: min(720px, 100%);
}

.checkbox-option {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(280px, 1.3fr);
  align-items: start;
  gap: 28px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  accent-color: rgb(var(--v-theme-primary));
  cursor: pointer;
}

.checkbox-select {
  min-width: 0;
}

.evidence-field small {
  opacity: 0.82;
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  border-color: rgb(var(--v-theme-on-category-card));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-on-category-card), 0.2);
}

.form-field input:disabled,
.form-field select:disabled,
.form-field textarea:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.wide-field {
  max-width: min(720px, 100%);
}

.file-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.file-button,
.remove-file-button,
.save-button,
.back-button {
  padding: 10px 18px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.file-button:hover:not(:disabled),
.remove-file-button:hover:not(:disabled),
.save-button:hover:not(:disabled),
.back-button:hover {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.file-button:disabled,
.save-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.file-name {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-file-button {
  padding-inline: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.save-button {
  min-width: 110px;
  border-color: rgb(var(--v-theme-on-surface));
}

.bottom-actions {
  margin-top: 20px;
}

.back-button {
  min-width: 100px;
  border-color: #000;
}

@media (max-width: 1050px) {
  .top-grid,
  .four-column-grid,
  .fee-grid {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}

@media (max-width: 600px) {
  .new-membership-view {
    padding: 28px 20px 56px;
  }

  .membership-form {
    margin-top: 34px;
  }

  .form-card {
    padding: 24px 18px;
  }

  .top-grid,
  .four-column-grid,
  .fee-grid,
  .checkbox-option {
    grid-template-columns: 1fr;
  }

  .date-inputs {
    grid-template-columns: 1fr 1fr 1.35fr;
  }

  .file-picker {
    align-items: stretch;
    flex-direction: column;
  }

  .file-name {
    max-width: 100%;
  }

  .success-snackbar {
    right: 20px;
    bottom: 20px;
  }
}
</style>
