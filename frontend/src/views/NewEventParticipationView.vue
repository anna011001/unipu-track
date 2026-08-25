<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'
import { currentUser } from '../services/auth.js'

const router = useRouter()
const userId = Number(currentUser.value?.id)
const periods = ref([]),
  staff = ref([]),
  units = ref([]),
  confirmations = ref([]),
  media = ref([])
const loading = ref(true),
  saving = ref(false),
  saved = ref(false),
  errors = ref([]),
  success = ref('')
const form = reactive({
  reporting_period_id: null,
  staff_member_id: null,
  organizational_unit_id: null,
  participation_type: '',
  event_name: '',
  organizer_name: '',
  location: '',
  event_date: '',
  presentation_title: '',
  program_link: '',
  notes: '',
})
const types = [
  { value: 'ORAL_PRESENTATION', label: 'Usmeno izlaganje' },
  { value: 'POSTER_PRESENTATION', label: 'Postersko izlaganje' },
  { value: 'PLENARY_LECTURE', label: 'Plenarno predavanje' },
  { value: 'PANELIST', label: 'Panelist' },
  { value: 'ORGANIZING_COMMITTEE_MEMBER', label: 'Član organizacijskog odbora' },
]
const optionalNumber = (value) => (value === '' || value === null ? null : Number(value))
function currentPeriod(items) {
  const today = new Date().toISOString().slice(0, 10)
  return items
    .filter(
      (p) =>
        !p.is_closed &&
        String(p.start_date).slice(0, 10) <= today &&
        today <= String(p.end_date).slice(0, 10),
    )
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0]
}
function toggleConfirmation() {
  confirmations.value = confirmations.value.length
    ? []
    : [
        {
          key: crypto.randomUUID(),
          event_name: form.event_name,
          committee_president_name: '',
          organizer_institution: form.organizer_name,
          confirmation_date: '',
          impressum_link: '',
        },
      ]
}
function toggleMedia() {
  media.value = media.value.length
    ? []
    : [
        {
          key: crypto.randomUUID(),
          event_name: form.event_name,
          media_type: '',
          media_link: '',
          published_on: '',
        },
      ]
}
function validate() {
  const result = []
  if (!form.reporting_period_id) result.push('Nije pronađeno otvoreno izvještajno razdoblje.')
  if (!form.staff_member_id) result.push('Ime i prezime je obavezno.')
  if (!form.participation_type) result.push('Vrsta sudjelovanja je obavezna.')
  if (!form.event_name.trim()) result.push('Naziv događanja je obavezan.')
  confirmations.value.forEach((item, i) => {
    if (!item.event_name.trim()) result.push(`Naziv događanja obavezan je za potvrdu ${i + 1}.`)
  })
  media.value.forEach((item, i) => {
    if (!item.event_name.trim() || !item.media_link.trim())
      result.push(`Naziv događanja i link obavezni su za medijsku objavu ${i + 1}.`)
  })
  return result
}
async function submit() {
  errors.value = validate()
  if (errors.value.length) return
  saving.value = true
  let recordId = null
  const confirmationIds = [],
    mediaIds = []
  try {
    const response = await api.post('/api/event-participations', {
      ...form,
      reporting_period_id: Number(form.reporting_period_id),
      staff_member_id: Number(form.staff_member_id),
      organizational_unit_id: optionalNumber(form.organizational_unit_id),
      organizer_name: form.organizer_name.trim() || null,
      location: form.location.trim() || null,
      event_date: form.event_date || null,
      presentation_title: form.presentation_title.trim() || null,
      program_link: form.program_link.trim() || null,
      notes: form.notes.trim() || null,
      created_by: userId,
      updated_by: userId,
    })
    recordId = response.data.id
    for (const item of confirmations.value) {
      const created = await api.post('/api/event-participations/confirmations', {
        event_participation_id: recordId,
        event_name: item.event_name.trim(),
        committee_president_name: item.committee_president_name.trim() || null,
        organizer_institution: item.organizer_institution.trim() || null,
        confirmation_date: item.confirmation_date || null,
        impressum_link: item.impressum_link.trim() || null,
        created_by: userId,
        updated_by: userId,
      })
      confirmationIds.push(created.data.id)
    }
    for (const item of media.value) {
      const created = await api.post('/api/event-participations/media', {
        event_participation_id: recordId,
        event_name: item.event_name.trim(),
        media_type: item.media_type.trim() || null,
        media_link: item.media_link.trim(),
        published_on: item.published_on || null,
        created_by: userId,
        updated_by: userId,
      })
      mediaIds.push(created.data.id)
    }
    saved.value = true
    success.value = 'Novo sudjelovanje uspješno je spremljeno.'
  } catch (error) {
    await Promise.allSettled([
      ...confirmationIds.map((id) => api.delete(`/api/event-participations/confirmations/${id}`)),
      ...mediaIds.map((id) => api.delete(`/api/event-participations/media/${id}`)),
    ])
    if (recordId) await api.delete(`/api/event-participations/${recordId}`).catch(() => {})
    errors.value = error.response?.data?.errors || [
      error.response?.data?.message || 'Sudjelovanje nije moguće spremiti.',
    ]
  } finally {
    saving.value = false
  }
}
async function load() {
  try {
    const [p, s, u] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/staff-members'),
      api.get('/api/organizational-units'),
    ])
    periods.value = p.data
    staff.value = s.data
    units.value = u.data
    form.reporting_period_id = currentPeriod(periods.value)?.id ?? null
  } catch (error) {
    errors.value = [error.response?.data?.message || 'Nije moguće učitati obrazac.']
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <main class="new-view">
    <nav>
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink><span>›</span
      ><RouterLink to="/istrazivanje-i-razvoj/sudjelovanja">Sudjelovanja na događanjima</RouterLink
      ><span>›</span><span>Novo sudjelovanje</span>
    </nav>
    <h1>Dodavanje novog sudjelovanja</h1>
    <p class="description">Evidencija sudjelovanja na znanstvenim i stručnim događanjima</p>
    <p v-if="loading">Učitavanje...</p>
    <form v-else @submit.prevent="submit">
      <div v-if="errors.length" class="alert">
        <ul>
          <li v-for="error in errors" :key="error">{{ error }}</li>
        </ul>
      </div>
      <div class="card">
        <div class="grid">
          <label
            >Ime i prezime *<select v-model="form.staff_member_id" :disabled="saved">
              <option :value="null" disabled>Odaberite osobu</option>
              <option v-for="member in staff" :key="member.id" :value="member.id">
                {{ member.first_name }} {{ member.last_name }}
              </option>
            </select></label
          ><label
            >Sastavnica<select v-model="form.organizational_unit_id" :disabled="saved">
              <option :value="null">Nije odabrano</option>
              <option v-for="unit in units" :key="unit.id" :value="unit.id">
                {{ unit.short_name || unit.name }}
              </option>
            </select></label
          >
        </div>
        <div class="grid">
          <label
            >Vrsta sudjelovanja *<select v-model="form.participation_type" :disabled="saved">
              <option value="" disabled>Odaberite vrstu</option>
              <option v-for="type in types" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select></label
          ><label
            >Naziv događanja *<input v-model="form.event_name" maxlength="250" :disabled="saved"
          /></label>
        </div>
        <div class="grid">
          <label
            >Organizator<input
              v-model="form.organizer_name"
              maxlength="200"
              :disabled="saved" /></label
          ><label
            >Mjesto održavanja<input v-model="form.location" maxlength="150" :disabled="saved"
          /></label>
        </div>
        <div class="grid">
          <label
            >Datum održavanja<input
              v-model="form.event_date"
              type="date"
              :disabled="saved" /></label
          ><label
            >Naslov izlaganja<input v-model="form.presentation_title" :disabled="saved"
          /></label>
        </div>
        <label
          >Program<input
            v-model="form.program_link"
            placeholder="https://poveznica.hr"
            :disabled="saved" /></label
        ><label
          >Napomena<textarea v-model="form.notes" rows="3" :disabled="saved"></textarea>
        </label>
        <section>
          <header>
            <h2>Potvrde organizatora</h2>
            <button
              type="button"
              class="small plus"
              :class="{ active: confirmations.length }"
              :aria-pressed="Boolean(confirmations.length)"
              :title="confirmations.length ? 'Isključi potvrdu' : 'Dodaj potvrdu'"
              :disabled="saved"
              @click="toggleConfirmation"
            >
              +
            </button>
          </header>
          <p v-if="!confirmations.length">Potvrde nisu dodane.</p>
          <article v-for="item in confirmations" :key="item.key">
            <div class="grid">
              <label>Naziv događanja *<input v-model="item.event_name" /></label
              ><label
                >Predsjednik odbora<input v-model="item.committee_president_name" maxlength="120"
              /></label>
            </div>
            <div class="grid">
              <label
                >Ustanova organizatora<input
                  v-model="item.organizer_institution"
                  maxlength="200" /></label
              ><label>Datum potvrde<input v-model="item.confirmation_date" type="date" /></label>
            </div>
            <label>Impresum<input v-model="item.impressum_link" /></label>
          </article>
        </section>
        <section>
          <header>
            <h2>Linkovi na medijske objave</h2>
            <button
              type="button"
              class="small plus"
              :class="{ active: media.length }"
              :aria-pressed="Boolean(media.length)"
              :title="media.length ? 'Isključi medijsku objavu' : 'Dodaj medijsku objavu'"
              :disabled="saved"
              @click="toggleMedia"
            >
              +
            </button>
          </header>
          <p v-if="!media.length">Medijske objave nisu dodane.</p>
          <article v-for="item in media" :key="item.key">
            <div class="grid">
              <label>Naziv događanja *<input v-model="item.event_name" /></label
              ><label>Vrsta medija<input v-model="item.media_type" maxlength="80" /></label>
            </div>
            <div class="grid">
              <label>Link *<input v-model="item.media_link" /></label
              ><label>Datum objave<input v-model="item.published_on" type="date" /></label>
            </div>
          </article>
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
        @click="router.push('/istrazivanje-i-razvoj/sudjelovanja')"
      >
        Natrag
      </button>
    </form>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
nav,
header,
.actions {
  display: flex;
  align-items: center;
}
nav {
  gap: 10px;
  color: rgb(var(--v-theme-muted));
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
section {
  display: grid;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid rgb(var(--v-theme-category-border));
}
header {
  gap: 10px;
}
h2 {
  margin: 0;
  font-weight: 400;
}
article {
  display: grid;
  gap: 22px;
  padding: 22px 20px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 9px;
}
.small {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
  border: 1px solid rgb(var(--v-theme-on-surface));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
}
.plus:hover:not(:disabled),
.plus.active {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.small:disabled {
  cursor: not-allowed;
  opacity: 0.55;
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
