<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'
import { currentUser } from '../services/auth.js'

const router = useRouter()
const userId = Number(currentUser.value?.id)
const periods = ref([])
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const success = ref('')

const form = reactive({
  reporting_period_id: null,
  proposal_name: '',
  funding_source: '',
  call_name: '',
  call_link: '',
  unipu_role: '',
  involved_units: '',
  partner_institutions: '',
  total_project_amount_eur: '',
  unipu_share_eur: '',
  implementation_duration: '',
  project_type: '',
  planned_activities: '',
  unipu_project_team: '',
  submission_deadline: '',
  application_status: '',
  contract_or_partnership_reference: '',
  contract_project_code: '',
  notes: '',
})

const projectTypes = [
  { value: 'DOMESTIC', label: 'Domaći' },
  { value: 'INTERNATIONAL', label: 'Međunarodni' },
]
const statuses = [
  { value: 'APPROVED', label: 'Odobren' },
  { value: 'REJECTED', label: 'Odbijen' },
]

function currentPeriod(items) {
  const today = new Date().toISOString().slice(0, 10)
  return items
    .filter(
      (period) =>
        !period.is_closed &&
        String(period.start_date).slice(0, 10) <= today &&
        today <= String(period.end_date).slice(0, 10),
    )
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0]
}

function optionalText(value) {
  return value.trim() || null
}

function optionalNumber(value) {
  return value === '' || value === null ? null : Number(value)
}

function validate() {
  const result = []
  if (!form.reporting_period_id) result.push('Nije pronađeno otvoreno izvještajno razdoblje.')
  if (!form.proposal_name.trim()) result.push('Naziv projektnog prijedloga je obavezan.')
  if (
    form.total_project_amount_eur !== '' &&
    (Number(form.total_project_amount_eur) < 0 || Number(form.total_project_amount_eur) > 999999.99)
  )
    result.push('Ukupni iznos projekta mora biti između 0 i 999999,99 eura.')
  if (
    form.unipu_share_eur !== '' &&
    (Number(form.unipu_share_eur) < 0 || Number(form.unipu_share_eur) > 999999.99)
  )
    result.push('Udio UNIPU-a mora biti između 0 i 999999,99 eura.')
  return result
}

async function submit() {
  errors.value = validate()
  if (errors.value.length) return
  saving.value = true
  try {
    await api.post('/api/project-applications', {
      reporting_period_id: Number(form.reporting_period_id),
      proposal_name: form.proposal_name.trim(),
      funding_source: optionalText(form.funding_source),
      call_name: optionalText(form.call_name),
      call_link: optionalText(form.call_link),
      unipu_role: optionalText(form.unipu_role),
      involved_units: optionalText(form.involved_units),
      partner_institutions: optionalText(form.partner_institutions),
      total_project_amount_eur: optionalNumber(form.total_project_amount_eur),
      unipu_share_eur: optionalNumber(form.unipu_share_eur),
      implementation_duration: optionalText(form.implementation_duration),
      project_type: form.project_type || null,
      planned_activities: optionalText(form.planned_activities),
      unipu_project_team: optionalText(form.unipu_project_team),
      submission_deadline: form.submission_deadline || null,
      application_status: form.application_status || null,
      contract_or_partnership_reference: optionalText(form.contract_or_partnership_reference),
      contract_project_code: optionalText(form.contract_project_code),
      notes: optionalText(form.notes),
      created_by: userId,
      updated_by: userId,
    })
    saved.value = true
    success.value = 'Projektna prijava uspješno je spremljena.'
  } catch (exception) {
    errors.value = exception.response?.data?.errors || [
      exception.response?.data?.message || 'Projektnu prijavu nije moguće spremiti.',
    ]
  } finally {
    saving.value = false
  }
}

async function load() {
  try {
    const response = await api.get('/api/reporting-periods')
    periods.value = response.data
    form.reporting_period_id =
      currentPeriod(periods.value)?.id ??
      periods.value.find((period) => !period.is_closed)?.id ??
      null
  } catch (exception) {
    errors.value = [exception.response?.data?.message || 'Nije moguće učitati obrazac.']
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="new-view">
    <nav>
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink><span>›</span>
      <RouterLink to="/istrazivanje-i-razvoj/projektne-prijave">Projektne prijave</RouterLink
      ><span>›</span>
      <span>Nova projektna prijava</span>
    </nav>
    <h1>Dodavanje nove projektne prijave</h1>
    <p class="description">Evidencija projektnih prijava i realizacije</p>

    <p v-if="loading">Učitavanje...</p>
    <form v-else @submit.prevent="submit">
      <div v-if="errors.length" class="alert">
        <ul>
          <li v-for="error in errors" :key="error">{{ error }}</li>
        </ul>
      </div>
      <div class="card">
        <label
          >Naziv projektnog prijedloga *<textarea
            v-model="form.proposal_name"
            rows="3"
            :disabled="saved"
          ></textarea>
        </label>

        <div class="grid">
          <label>Izvor financiranja<input v-model="form.funding_source" :disabled="saved" /></label>
          <label
            >Uloga UNIPU-a<input
              v-model="form.unipu_role"
              placeholder="Vodeći partner, nositelj projekta ili partner"
              :disabled="saved"
          /></label>
          <label>Poziv / natječaj<input v-model="form.call_name" :disabled="saved" /></label>
          <label
            >Poveznica na poziv<input
              v-model="form.call_link"
              type="url"
              placeholder="https://..."
              :disabled="saved"
          /></label>
        </div>

        <div class="grid">
          <label
            >Uključene sastavnice<textarea
              v-model="form.involved_units"
              rows="3"
              :disabled="saved"
            ></textarea>
          </label>
          <label
            >Partnerske institucije<textarea
              v-model="form.partner_institutions"
              rows="3"
              :disabled="saved"
            ></textarea>
          </label>
        </div>

        <div class="grid">
          <label
            >Ukupni iznos projekta (€)<input
              v-model="form.total_project_amount_eur"
              type="number"
              min="0"
              max="999999.99"
              step="0.01"
              :disabled="saved"
          /></label>
          <label
            >Udio UNIPU-a (€)<input
              v-model="form.unipu_share_eur"
              type="number"
              min="0"
              max="999999.99"
              step="0.01"
              :disabled="saved"
          /></label>
          <label
            >Trajanje provedbe projekta<input
              v-model="form.implementation_duration"
              placeholder="npr. 24 mjeseca"
              :disabled="saved"
          /></label>
          <label
            >Vrsta projekta<select v-model="form.project_type" :disabled="saved">
              <option value="">Odaberite vrstu</option>
              <option v-for="item in projectTypes" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select></label
          >
        </div>

        <div class="grid">
          <label
            >Planirane aktivnosti<textarea
              v-model="form.planned_activities"
              rows="4"
              :disabled="saved"
            ></textarea>
          </label>
          <label
            >Projektni tim UNIPU-a<textarea
              v-model="form.unipu_project_team"
              rows="4"
              :disabled="saved"
            ></textarea>
          </label>
        </div>

        <div class="grid">
          <label
            >Rok za prijavu<input v-model="form.submission_deadline" type="date" :disabled="saved"
          /></label>
          <label
            >Status prijave<select v-model="form.application_status" :disabled="saved">
              <option value="">Odaberite status</option>
              <option v-for="item in statuses" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select></label
          >
          <label
            >Ugovor ili sporazum o partnerstvu<input
              v-model="form.contract_or_partnership_reference"
              placeholder="Klasa i urudžbeni broj"
              :disabled="saved"
          /></label>
          <label
            >Šifra projekta po ugovoru<input v-model="form.contract_project_code" :disabled="saved"
          /></label>
        </div>

        <label>Napomena<textarea v-model="form.notes" rows="4" :disabled="saved"></textarea></label>
        <div class="actions">
          <button class="button" :disabled="saving || saved">
            {{ saving ? 'Spremanje...' : 'Spremi' }}
          </button>
        </div>
      </div>
      <button
        type="button"
        class="button back"
        @click="router.push('/istrazivanje-i-razvoj/projektne-prijave')"
      >
        Natrag
      </button>
    </form>

    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
nav,
.actions {
  display: flex;
  align-items: center;
}
nav {
  gap: 10px;
  color: rgb(var(--v-theme-muted));
}
nav a {
  color: inherit;
  text-decoration: none;
}
nav a:hover {
  color: rgb(var(--v-theme-primary));
}
h1 {
  margin: 26px 0 8px;
  font-weight: 400;
}
.description {
  color: rgb(var(--v-theme-primary));
}
form {
  margin-top: 45px;
}
.alert {
  margin-bottom: 18px;
  padding: 12px;
  border: 1px solid rgb(var(--v-theme-error));
  border-radius: 8px;
  color: rgb(var(--v-theme-error));
}
.card {
  display: grid;
  gap: 34px;
  padding: clamp(34px, 5vw, 76px);
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 54px;
}
label {
  display: grid;
  gap: 8px;
}
input,
select,
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
}
.actions {
  justify-content: flex-end;
}
.back {
  margin-top: 20px;
}
@media (max-width: 650px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
