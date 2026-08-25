<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'
import { currentUser } from '../services/auth.js'

const route = useRoute()
const router = useRouter()
const userId = Number(currentUser.value?.id)
const periods = ref([])
const countries = ref([])
const units = ref([])
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const errors = ref([])
const success = ref('')
const type = computed(() => (route.query.type === 'agreement' ? 'agreement' : 'new'))
const isAgreement = computed(() => type.value === 'agreement')

const form = reactive({
  reporting_period_id: null,
  partner_institution: '',
  country_id: '',
  cooperation_kind: '',
  cooperation_field: '',
  start_date: '',
  duration: '',
  agreement_type: '',
  unipu_contact_person: '',
  organizational_unit_id: '',
  planned_activities: '',
  agreement_link: '',
  status: '',
  notes: '',
  signed_on: '',
  valid_until: '',
  responsible_person: '',
  completed_activities: '',
  document_link: '',
})

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
  if (!form.partner_institution.trim()) result.push('Partnerska institucija je obavezna.')
  if (isAgreement.value && form.signed_on && form.valid_until && form.valid_until < form.signed_on)
    result.push('Rok važenja ne smije biti prije datuma potpisivanja.')
  return result
}

async function submit() {
  errors.value = validate()
  if (errors.value.length) return
  saving.value = true
  const common = {
    reporting_period_id: Number(form.reporting_period_id),
    partner_institution: form.partner_institution.trim(),
    country_id: optionalNumber(form.country_id),
    cooperation_kind: optionalText(form.cooperation_kind),
    agreement_type: optionalText(form.agreement_type),
    organizational_unit_id: optionalNumber(form.organizational_unit_id),
    planned_activities: optionalText(form.planned_activities),
    status: optionalText(form.status),
    notes: optionalText(form.notes),
    created_by: userId,
    updated_by: userId,
  }
  try {
    if (isAgreement.value) {
      await api.post('/api/international-cooperations/agreements', {
        ...common,
        signed_on: form.signed_on || null,
        valid_until: form.valid_until || null,
        responsible_person: optionalText(form.responsible_person),
        completed_activities: optionalText(form.completed_activities),
        document_link: optionalText(form.document_link),
      })
      success.value = 'Međunarodni ugovor uspješno je spremljen.'
    } else {
      await api.post('/api/international-cooperations/new', {
        ...common,
        cooperation_field: optionalText(form.cooperation_field),
        start_date: form.start_date || null,
        duration: optionalText(form.duration),
        unipu_contact_person: optionalText(form.unipu_contact_person),
        agreement_link: optionalText(form.agreement_link),
      })
      success.value = 'Novo međunarodno partnerstvo uspješno je spremljeno.'
    }
    saved.value = true
  } catch (exception) {
    errors.value = apiErrors(exception, 'Zapis nije moguće spremiti.')
  } finally {
    saving.value = false
  }
}

async function load() {
  try {
    const [periodResponse, countryResponse, unitResponse] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/countries'),
      api.get('/api/organizational-units'),
    ])
    periods.value = periodResponse.data
    countries.value = countryResponse.data
    units.value = unitResponse.data
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

onMounted(load)
</script>

<template>
  <main class="new-view">
    <nav>
      <RouterLink to="/medunarodna-suradnja">Međunarodna suradnja</RouterLink><span>›</span
      ><RouterLink to="/medunarodna-suradnja/partnerstva">Partnerstva</RouterLink><span>›</span
      ><span>{{ isAgreement ? 'Novi ugovor' : 'Novo partnerstvo' }}</span>
    </nav>
    <h1>
      {{
        isAgreement
          ? 'Dodavanje aktivnog međunarodnog ugovora'
          : 'Dodavanje novog međunarodnog partnerstva'
      }}
    </h1>
    <p v-if="loading">Učitavanje...</p>
    <form v-else @submit.prevent="submit">
      <div v-if="errors.length" class="alert">
        <ul>
          <li v-for="error in errors" :key="error">{{ error }}</li>
        </ul>
      </div>
      <div class="card">
        <section>
          <h2>Partnerska institucija i vrsta suradnje</h2>
          <div class="grid">
            <label
              >Partnerska institucija *<input
                v-model="form.partner_institution"
                maxlength="100"
                :disabled="saved"
            /></label>
            <label
              >Država<CountryAutocomplete
                v-model="form.country_id"
                :countries="countries"
                :disabled="saved"
            /></label>
            <label
              >Vrsta suradnje<select v-model="form.cooperation_kind" :disabled="saved">
                <option value="">Odaberite vrstu</option>
                <option value="SCIENTIFIC">Znanstvena</option>
                <option value="ARTISTIC">Umjetnička</option>
                <option value="PROFESSIONAL">Profesionalna</option>
              </select></label
            >
            <label
              >Vrsta ugovora ili sporazuma<input
                v-model="form.agreement_type"
                maxlength="100"
                :disabled="saved"
            /></label>
            <label
              >Sastavnica<select v-model="form.organizational_unit_id" :disabled="saved">
                <option value="">Odaberite sastavnicu</option>
                <option v-for="unit in units" :key="unit.id" :value="unit.id">
                  {{ unit.short_name || unit.name }}
                </option>
              </select></label
            >
            <label>Status<input v-model="form.status" maxlength="40" :disabled="saved" /></label>
          </div>
        </section>

        <section v-if="!isAgreement">
          <h2>Podaci o novom partnerstvu</h2>
          <div class="grid">
            <label
              >Područje suradnje<input
                v-model="form.cooperation_field"
                maxlength="150"
                :disabled="saved"
            /></label>
            <label
              >Kontakt osoba UNIPU-a<input
                v-model="form.unipu_contact_person"
                maxlength="120"
                :disabled="saved"
            /></label>
            <label
              >Datum početka<input v-model="form.start_date" type="date" :disabled="saved"
            /></label>
            <label
              >Trajanje<input
                v-model="form.duration"
                maxlength="80"
                placeholder="npr. 5 godina"
                :disabled="saved"
            /></label>
          </div>
          <label
            >Poveznica na ugovor<input
              v-model="form.agreement_link"
              type="url"
              placeholder="https://"
              :disabled="saved"
          /></label>
        </section>

        <section v-else>
          <h2>Podaci o ugovoru</h2>
          <div class="grid">
            <label
              >Datum potpisivanja<input v-model="form.signed_on" type="date" :disabled="saved"
            /></label>
            <label
              >Rok važenja<input v-model="form.valid_until" type="date" :disabled="saved"
            /></label>
            <label
              >Odgovorna osoba<input
                v-model="form.responsible_person"
                maxlength="120"
                :disabled="saved"
            /></label>
            <label
              >Dokument<input
                v-model="form.document_link"
                type="url"
                placeholder="https://"
                :disabled="saved"
            /></label>
          </div>
          <label
            >Realizirane aktivnosti<textarea
              v-model="form.completed_activities"
              rows="4"
              :disabled="saved"
            ></textarea>
          </label>
        </section>

        <section>
          <h2>Aktivnosti i napomena</h2>
          <label
            >Planirane aktivnosti<textarea
              v-model="form.planned_activities"
              rows="4"
              :disabled="saved"
            ></textarea>
          </label>
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
        @click="router.push('/medunarodna-suradnja/partnerstva')"
      >
        Natrag
      </button>
    </form>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.new-view {
  min-height: calc(100vh - 112px);
  padding: 34px clamp(32px, 5vw, 128px) 90px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}
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
.button {
  padding: 10px 18px;
  border: 1px solid rgb(var(--v-theme-on-surface));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
.button:hover:not(:disabled) {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.back {
  margin-top: 20px;
}
.snackbar {
  position: fixed;
  right: 28px;
  bottom: 28px;
  padding: 14px 18px;
  border: 1px solid #62a957;
  border-radius: 7px;
  background: #b8f5ae;
  color: #1f5525;
}
@media (max-width: 760px) {
  .new-view {
    padding: 28px 20px;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
