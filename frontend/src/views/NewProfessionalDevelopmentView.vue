<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'

const router = useRouter()
const currentUserId = 1
const staffMembers = ref([])
const organizationalUnits = ref([])
const organizations = ref([])
const countries = ref([])
const loading = ref(true)
const submitting = ref(false)
const saved = ref(false)
const errorMessages = ref([])
const successMessage = ref('')
let successTimer = null

const form = reactive({
  reporting_period_id: null,
  staff_member_id: null,
  organizational_unit_id: null,
  development_type: '',
  program_name: '',
  host_organization_name: '',
  country_id: null,
  start_date: '',
  end_date: '',
  media_link: '',
  notes: '',
})

function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
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
      const start = String(period.start_date || '').slice(0, 10)
      const end = String(period.end_date || '').slice(0, 10)
      return !period.is_closed && start <= today && today <= end
    })
    .sort((first, second) => String(second.start_date).localeCompare(String(first.start_date)))[0]
}

function findHostOrganization() {
  const normalized = form.host_organization_name.trim().toLocaleLowerCase('hr')
  return organizations.value.find(
    (organization) => organization.name.trim().toLocaleLowerCase('hr') === normalized,
  )
}

function useHostOrganizationData() {
  const organization = findHostOrganization()
  if (organization?.country_id && !form.country_id) form.country_id = organization.country_id
}

function validateForm() {
  const errors = []
  if (!form.reporting_period_id) errors.push('Trenutno otvoreno izvještajno razdoblje nije pronađeno.')
  if (!form.staff_member_id) errors.push('Ime i prezime je obavezno.')
  if (!form.development_type) errors.push('Vrsta usavršavanja je obavezna.')
  if (!form.program_name.trim()) errors.push('Naziv programa je obavezan.')
  if (form.program_name.trim().length > 250) errors.push('Naziv programa smije imati najviše 250 znakova.')
  if (form.start_date && form.end_date && form.end_date < form.start_date) {
    errors.push('Završni datum ne smije biti prije početnog datuma.')
  }

  if (form.media_link.trim()) {
    try {
      const url = new URL(form.media_link.trim())
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      errors.push('Medijska poveznica mora biti ispravan http:// ili https:// URL.')
    }
  }

  return errors
}

function showSuccess(message) {
  successMessage.value = message
  if (successTimer) window.clearTimeout(successTimer)
  successTimer = window.setTimeout(() => {
    successMessage.value = ''
    successTimer = null
  }, 4000)
}

async function submitForm() {
  errorMessages.value = validateForm()
  if (errorMessages.value.length) return

  submitting.value = true
  try {
    const hostOrganization = findHostOrganization()
    await api.post('/api/professional-developments', {
      reporting_period_id: Number(form.reporting_period_id),
      staff_member_id: Number(form.staff_member_id),
      organizational_unit_id: optionalNumber(form.organizational_unit_id),
      development_type: form.development_type,
      program_name: form.program_name.trim(),
      host_organization_id: hostOrganization?.id ?? null,
      host_organization_name: form.host_organization_name.trim() || null,
      country_id: optionalNumber(form.country_id),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      media_link: form.media_link.trim() || null,
      notes: form.notes.trim() || null,
      created_by: currentUserId,
      updated_by: currentUserId,
    })
    saved.value = true
    showSuccess('Novo stručno usavršavanje uspješno je spremljeno.')
  } catch (error) {
    const backendErrors = error.response?.data?.errors
    errorMessages.value = Array.isArray(backendErrors)
      ? backendErrors
      : [error.response?.data?.message || 'Stručno usavršavanje nije moguće spremiti.']
  } finally {
    submitting.value = false
  }
}

async function loadOptions() {
  loading.value = true
  errorMessages.value = []

  try {
    const [periods, staff, units, orgs, countryData] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/staff-members'),
      api.get('/api/organizational-units'),
      api.get('/api/organizations'),
      api.get('/api/countries'),
    ])
    const reportingPeriods = Array.isArray(periods.data) ? periods.data : []
    staffMembers.value = Array.isArray(staff.data) ? staff.data : []
    organizationalUnits.value = Array.isArray(units.data) ? units.data : []
    organizations.value = Array.isArray(orgs.data) ? orgs.data : []
    countries.value = Array.isArray(countryData.data) ? countryData.data : []
    form.reporting_period_id = findCurrentReportingPeriod(reportingPeriods)?.id ?? null

    if (!form.reporting_period_id) {
      errorMessages.value = ['Trenutno otvoreno izvještajno razdoblje nije pronađeno. Novo usavršavanje nije moguće spremiti.']
    }
  } catch (error) {
    errorMessages.value = [error.response?.data?.message || 'Nije moguće učitati podatke potrebne za obrazac.']
  } finally {
    loading.value = false
  }
}

onMounted(loadOptions)
onUnmounted(() => {
  if (successTimer) window.clearTimeout(successTimer)
})
</script>

<template>
  <main class="new-development-view">
    <nav class="breadcrumbs" aria-label="Putanja stranice">
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink><span>›</span>
      <RouterLink to="/istrazivanje-i-razvoj/strucna-usavrsavanja">Stručna usavršavanja</RouterLink><span>›</span>
      <span>Novo usavršavanje</span>
    </nav>
    <h1>Dodavanje novog stručnog usavršavanja</h1>
    <p class="page-description">Evidencija stručnog usavršavanja nastavnika i suradnika</p>

    <p v-if="loading" class="page-message">Učitavanje obrasca...</p>
    <form v-else class="development-form" @submit.prevent="submitForm">
      <div v-if="errorMessages.length" class="form-alert" role="alert">
        <p>Provjerite unesene podatke:</p><ul><li v-for="message in errorMessages" :key="message">{{ message }}</li></ul>
      </div>

      <div class="form-card">
        <div class="form-grid two-columns">
          <label class="form-field"><span>Ime i prezime *</span><select v-model="form.staff_member_id" :disabled="saved"><option :value="null" disabled>Odaberite osobu</option><option v-for="member in staffMembers" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select></label>
          <label class="form-field"><span>Sastavnica</span><select v-model="form.organizational_unit_id" :disabled="saved"><option :value="null">Nije odabrano</option><option v-for="unit in organizationalUnits" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select></label>
        </div>

        <div class="form-grid two-columns">
          <label class="form-field"><span>Vrsta usavršavanja *</span><select v-model="form.development_type" :disabled="saved"><option value="" disabled>Odaberite vrstu</option><option value="STUDY_VISIT">Studijski boravak</option><option value="WORKSHOP">Radionica</option><option value="CONFERENCE">Konferencija</option><option value="COURSE_CERTIFICATE">Tečaj ili certifikat</option><option value="SUMMER_SCHOOL">Ljetna škola</option></select></label>
          <label class="form-field"><span>Naziv programa *</span><input v-model="form.program_name" maxlength="250" placeholder="Naziv usavršavanja ili programa" :disabled="saved" /></label>
        </div>

        <div class="form-grid two-columns">
          <label class="form-field"><span>Ustanova domaćin</span><input v-model="form.host_organization_name" list="host-organizations" maxlength="200" placeholder="Naziv ustanove" :disabled="saved" @change="useHostOrganizationData" /><datalist id="host-organizations"><option v-for="organization in organizations" :key="organization.id">{{ organization.name }}</option></datalist></label>
          <label class="form-field"><span>Država</span><CountryAutocomplete v-model="form.country_id" :countries="countries" :disabled="saved" placeholder="Nije odabrano" /></label>
        </div>

        <div class="form-grid two-columns">
          <label class="form-field"><span>Početni datum</span><input v-model="form.start_date" type="date" :disabled="saved" /></label>
          <label class="form-field"><span>Završni datum</span><input v-model="form.end_date" type="date" :disabled="saved" /></label>
        </div>

        <label class="form-field wide-field"><span>Medijska poveznica</span><input v-model="form.media_link" type="url" placeholder="https://poveznica.hr" :disabled="saved" /></label>

        <label class="form-field wide-field"><span>Napomena</span><textarea v-model="form.notes" rows="3" placeholder="Dodatna napomena" :disabled="saved"></textarea></label>

        <div class="form-actions"><button class="form-button save-button" type="submit" :disabled="submitting || saved || !form.reporting_period_id">{{ submitting ? 'Spremanje...' : 'Spremi' }}</button></div>
      </div>

      <button class="form-button back-button" type="button" @click="router.push('/istrazivanje-i-razvoj/strucna-usavrsavanja')">Natrag</button>
    </form>

    <Transition name="snackbar"><div v-if="successMessage" class="success-snackbar" role="status" aria-live="polite">{{ successMessage }}</div></Transition>
  </main>
</template>

<style scoped>
.new-development-view { min-height: calc(100vh - 112px); padding: 34px clamp(32px, 5vw, 128px) 90px; background: rgb(var(--v-theme-background)); color: rgb(var(--v-theme-on-background)); }
.breadcrumbs { display: flex; flex-wrap: wrap; gap: 10px; color: rgb(var(--v-theme-muted)); font-size: clamp(1rem, 1.1vw, 1.45rem); }
.breadcrumbs a:hover { color: rgb(var(--v-theme-primary)); }
h1 { margin: 26px 0 8px; font-size: clamp(1.8rem, 2vw, 3rem); font-weight: 400; }
.page-description { margin: 0; color: rgb(var(--v-theme-primary)); font-size: clamp(1rem, 1.1vw, 1.35rem); }
.page-message { margin-top: 48px; color: rgb(var(--v-theme-muted)); }
.development-form { margin-top: 48px; }
.form-alert { margin-bottom: 18px; padding: 14px 18px; border: 1px solid rgb(var(--v-theme-error)); border-radius: 8px; color: rgb(var(--v-theme-error)); }
.form-alert p, .form-alert ul { margin: 0; } .form-alert ul { margin-top: 6px; padding-left: 20px; }
.form-card { display: grid; gap: clamp(30px, 4vw, 58px); padding: clamp(34px, 5vw, 76px); border: 1px solid rgb(var(--v-theme-category-border)); border-radius: 10px; background: rgb(var(--v-theme-category-card)); color: rgb(var(--v-theme-on-category-card)); }
.form-grid { display: grid; gap: clamp(24px, 4vw, 64px); }
.two-columns { grid-template-columns: repeat(2, minmax(240px, 1fr)); }
.form-field { display: grid; align-content: start; gap: 9px; min-width: 0; }
.form-field input, .form-field select, .form-field textarea { width: 100%; min-width: 0; padding: 12px 14px; border: 1px solid rgb(var(--v-theme-category-border)); border-radius: 7px; outline: none; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); font: inherit; }
.form-field input, .form-field select { min-height: 46px; }
.form-field textarea { resize: vertical; }
.form-field input:focus, .form-field select:focus, .form-field textarea:focus { border-color: rgb(var(--v-theme-on-category-card)); box-shadow: 0 0 0 2px rgba(var(--v-theme-on-category-card), .2); }
.wide-field { max-width: min(760px, 100%); }
.form-button { padding: 10px 18px; border: 1px solid rgb(var(--v-theme-on-surface)); border-radius: 7px; background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface)); cursor: pointer; font: inherit; }
.form-button:hover:not(:disabled) { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.form-button:disabled { cursor: not-allowed; opacity: .55; }
.form-actions { display: flex; justify-content: flex-end; }
.save-button { min-width: 110px; }
.back-button { min-width: 100px; margin-top: 20px; border-color: #000; }
.success-snackbar { position: fixed; right: 28px; bottom: 28px; z-index: 1000; min-width: min(360px, calc(100vw - 40px)); padding: 14px 18px; border: 1px solid #62a957; border-radius: 7px; box-shadow: 0 5px 18px rgba(0,0,0,.2); background: #b8f5ae; color: #1f5525; }
.snackbar-enter-active, .snackbar-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.snackbar-enter-from, .snackbar-leave-to { opacity: 0; transform: translateY(12px); }
@media (max-width: 700px) { .new-development-view { padding: 28px 20px 56px; } .form-card { padding: 24px 18px; } .two-columns { grid-template-columns: 1fr; } .success-snackbar { right: 20px; bottom: 20px; } }
</style>
