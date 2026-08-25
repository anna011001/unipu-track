<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'
import { currentUser } from '../services/auth.js'

const router = useRouter()
const userId = Number(currentUser.value?.id)
const periods = ref([])
const staff = ref([])
const units = ref([])
const countries = ref([])
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const success = ref('')

const form = reactive({
  reporting_period_id: null,
  staff_member_id: '',
  organizational_unit_id: '',
  mobility_type: '',
  program_name: '',
  other_program_name: '',
  host_institution: '',
  destination_country_id: '',
  start_date: '',
  end_date: '',
  duration_days: '',
  mobility_purpose: '',
  activities: '',
  results: '',
  notes: '',
})

const selectedStaff = computed(() =>
  staff.value.find((item) => Number(item.id) === Number(form.staff_member_id)),
)

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
  return String(value ?? '').trim() || null
}
function optionalNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}
function apiErrors(exception, fallback) {
  return exception.response?.data?.errors || [exception.response?.data?.message || fallback]
}

function validate() {
  const result = []
  if (!form.reporting_period_id) result.push('Nije pronađeno otvoreno izvještajno razdoblje.')
  if (!form.staff_member_id) result.push('Djelatnik je obavezan.')
  if (!form.mobility_type.trim()) result.push('Vrsta mobilnosti je obavezna.')
  if (form.start_date && form.end_date && form.end_date < form.start_date)
    result.push('Datum završetka ne smije biti prije datuma početka.')
  if (
    form.duration_days !== '' &&
    (!Number.isInteger(Number(form.duration_days)) ||
      Number(form.duration_days) < 0 ||
      Number(form.duration_days) > 999)
  )
    result.push('Trajanje mora biti cijeli broj između 0 i 999 dana.')
  return result
}

async function submit() {
  errors.value = validate()
  if (errors.value.length) return
  saving.value = true
  try {
    await api.post('/api/staff-mobilities', {
      reporting_period_id: Number(form.reporting_period_id),
      staff_member_id: Number(form.staff_member_id),
      organizational_unit_id: optionalNumber(form.organizational_unit_id),
      mobility_type: form.mobility_type.trim(),
      program_name:
        form.program_name === 'Ostalo'
          ? optionalText(form.other_program_name) || 'Ostalo'
          : optionalText(form.program_name),
      host_institution: optionalText(form.host_institution),
      destination_country_id: optionalNumber(form.destination_country_id),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      duration_days: optionalNumber(form.duration_days),
      mobility_purpose: optionalText(form.mobility_purpose),
      activities: optionalText(form.activities),
      results: optionalText(form.results),
      notes: optionalText(form.notes),
      created_by: userId,
      updated_by: userId,
    })
    saved.value = true
    success.value = 'Mobilnost osoblja uspješno je spremljena.'
  } catch (exception) {
    errors.value = apiErrors(exception, 'Mobilnost nije moguće spremiti.')
  } finally {
    saving.value = false
  }
}

async function load() {
  try {
    const [periodResponse, staffResponse, unitResponse, countryResponse] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/staff-members'),
      api.get('/api/organizational-units'),
      api.get('/api/countries'),
    ])
    periods.value = periodResponse.data
    staff.value = staffResponse.data.filter((item) => item.is_active)
    units.value = unitResponse.data
    countries.value = countryResponse.data
    form.reporting_period_id =
      currentPeriod(periods.value)?.id ??
      periods.value.find((period) => !period.is_closed)?.id ??
      null
  } catch (exception) {
    errors.value = apiErrors(exception, 'Nije moguće učitati obrazac.')
  } finally {
    loading.value = false
  }
}

watch(
  () => form.staff_member_id,
  () => {
    if (selectedStaff.value?.organizational_unit_id)
      form.organizational_unit_id = selectedStaff.value.organizational_unit_id
  },
)
watch([() => form.start_date, () => form.end_date], () => {
  if (!form.start_date || !form.end_date || form.end_date < form.start_date) return
  const days =
    Math.round(
      (new Date(`${form.end_date}T00:00:00`) - new Date(`${form.start_date}T00:00:00`)) / 86400000,
    ) + 1
  form.duration_days = days
})
onMounted(load)
</script>

<template>
  <main class="new-view">
    <nav>
      <RouterLink to="/medunarodna-suradnja">Međunarodna suradnja</RouterLink><span>›</span
      ><RouterLink to="/medunarodna-suradnja/mobilnost-osoblja">Mobilnost osoblja</RouterLink
      ><span>›</span><span>Nova mobilnost</span>
    </nav>
    <h1>Dodavanje mobilnosti osoblja</h1>
    <p v-if="loading">Učitavanje...</p>
    <form v-else @submit.prevent="submit">
      <div v-if="errors.length" class="alert">
        <ul>
          <li v-for="error in errors" :key="error">{{ error }}</li>
        </ul>
      </div>
      <div class="card">
        <section>
          <h2>Podaci o djelatniku i mobilnosti</h2>
          <div class="grid">
            <label
              >Ime i prezime *<select v-model="form.staff_member_id" :disabled="saved">
                <option value="">Odaberite djelatnika</option>
                <option v-for="member in staff" :key="member.id" :value="member.id">
                  {{ member.first_name }} {{ member.last_name }}
                </option>
              </select></label
            >
            <label>Zvanje<input :value="selectedStaff?.academic_title || ''" disabled /></label>
            <label
              >Sastavnica<select v-model="form.organizational_unit_id" :disabled="saved">
                <option value="">Odaberite sastavnicu</option>
                <option v-for="unit in units" :key="unit.id" :value="unit.id">
                  {{ unit.short_name || unit.name }}
                </option>
              </select></label
            >
            <label
              >Vrsta mobilnosti *<select v-model="form.mobility_type" :disabled="saved">
                <option value="">Odaberite vrstu</option>
                <option>Nastava</option>
                <option>Stručno usavršavanje</option>
                <option>Istraživački boravak</option>
                <option>Ostalo</option>
              </select></label
            >
            <label
              >Program<select v-model="form.program_name" :disabled="saved">
                <option value="">Odaberite program</option>
                <option>Erasmus+</option>
                <option>CEEPUS</option>
                <option>Bilateralni</option>
                <option>Ostalo</option>
              </select></label
            >
            <label v-if="form.program_name === 'Ostalo'"
              >Naziv drugog programa<input
                v-model="form.other_program_name"
                maxlength="100"
                :disabled="saved"
            /></label>
            <label
              >Institucija domaćin<input
                v-model="form.host_institution"
                maxlength="200"
                :disabled="saved"
            /></label>
            <label
              >Država<CountryAutocomplete
                v-model="form.destination_country_id"
                :countries="countries"
                :disabled="saved"
            /></label>
          </div>
        </section>
        <section>
          <h2>Trajanje mobilnosti</h2>
          <div class="grid three">
            <label
              >Datum početka<input v-model="form.start_date" type="date" :disabled="saved"
            /></label>
            <label
              >Datum završetka<input v-model="form.end_date" type="date" :disabled="saved"
            /></label>
            <label
              >Trajanje (dana)<input
                v-model="form.duration_days"
                type="number"
                min="0"
                max="999"
                :disabled="saved"
            /></label>
          </div>
        </section>
        <section>
          <h2>Svrha i rezultati</h2>
          <label
            >Svrha mobilnosti<textarea
              v-model="form.mobility_purpose"
              rows="3"
              :disabled="saved"
            ></textarea>
          </label>
          <div class="grid">
            <label
              >Aktivnosti<textarea v-model="form.activities" rows="4" :disabled="saved"></textarea>
            </label>
            <label
              >Rezultati<textarea v-model="form.results" rows="4" :disabled="saved"></textarea>
            </label>
          </div>
          <label
            >Napomena<textarea v-model="form.notes" rows="3" :disabled="saved"></textarea>
          </label>
        </section>
        <div class="actions">
          <button class="button" :disabled="saving || saved">
            {{ saving ? 'Spremanje...' : 'Spremi' }}
          </button>
        </div>
      </div>
      <button
        type="button"
        class="button back"
        @click="router.push('/medunarodna-suradnja/mobilnost-osoblja')"
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
  gap: 38px;
  padding: clamp(34px, 5vw, 76px);
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 10px;
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
}
.card section {
  display: grid;
  gap: 24px;
  padding-top: 28px;
  border-top: 1px solid rgb(var(--v-theme-category-border));
}
.card section:first-child {
  padding-top: 0;
  border-top: 0;
}
h2 {
  margin: 0;
  font-weight: 400;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 54px;
}
.grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
@media (max-width: 760px) {
  .new-view {
    padding: 28px 20px;
  }
  .grid,
  .grid.three {
    grid-template-columns: 1fr;
  }
}
</style>
