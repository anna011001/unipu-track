<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api.js'
import { currentUser } from '../services/auth.js'
const router = useRouter(),
  userId = Number(currentUser.value?.id)
const periods = ref([]),
  units = ref([]),
  detail = ref(null),
  media = ref(null),
  file = ref(null),
  fileInput = ref(null),
  loading = ref(true),
  saving = ref(false),
  saved = ref(false),
  errors = ref([]),
  success = ref('')
const form = reactive({
  reporting_period_id: null,
  workshop_name: '',
  workshop_leaders: '',
  organizational_unit_id: null,
  target_group: '',
  participant_count: '',
  location: '',
  held_on: '',
  duration_hours: '',
  content_description: '',
  media_link: '',
  notes: '',
})
const groups = [
  { value: 'STUDENTS', label: 'Studenti' },
  { value: 'TEACHERS', label: 'Nastavnici' },
  { value: 'PUBLIC', label: 'Javnost' },
  { value: 'EMPLOYEES', label: 'Zaposlenici' },
  { value: 'DOCTORAL_STUDENTS', label: 'Doktorandi' },
]
const optionalNumber = (v) => (v === '' || v === null ? null : Number(v))
function currentPeriod(a) {
  const n = new Date(),
    today = [
      n.getFullYear(),
      String(n.getMonth() + 1).padStart(2, '0'),
      String(n.getDate()).padStart(2, '0'),
    ].join('-')
  return a
    .filter(
      (p) =>
        !p.is_closed &&
        String(p.start_date).slice(0, 10) <= today &&
        today <= String(p.end_date).slice(0, 10),
    )
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0]
}
function toggleDetail() {
  detail.value = detail.value
    ? null
    : {
        goals: '',
        learning_outcomes: '',
        work_methods: '',
        materials_resources: '',
        evaluation: '',
      }
}
function toggleMedia() {
  media.value = media.value
    ? null
    : { workshop_name: form.workshop_name, media_type: '', media_link: '', published_on: '' }
}
function chooseFile(e) {
  const f = e.target.files?.[0] || null
  errors.value = []
  if (f && f.size > 10 * 1024 * 1024) {
    errors.value = ['Datoteka smije imati najviše 10 MB.']
    e.target.value = ''
    file.value = null
    return
  }
  file.value = f
}
function validate() {
  const e = []
  if (!form.reporting_period_id) e.push('Nije pronađeno otvoreno izvještajno razdoblje.')
  if (!form.workshop_name.trim()) e.push('Naziv radionice je obavezan.')
  if (!form.target_group) e.push('Ciljana skupina je obavezna.')
  if (media.value && (!media.value.workshop_name.trim() || !media.value.media_link.trim()))
    e.push('Naziv radionice i link obavezni su za medijsku objavu.')
  return e
}
async function submit() {
  errors.value = validate()
  if (errors.value.length) return
  saving.value = true
  let workshopId = null,
    detailId = null,
    mediaId = null,
    fileId = null
  try {
    const response = await api.post('/api/workshops', {
      reporting_period_id: Number(form.reporting_period_id),
      workshop_name: form.workshop_name.trim(),
      workshop_leaders: form.workshop_leaders.trim() || null,
      organizational_unit_id: optionalNumber(form.organizational_unit_id),
      target_group: form.target_group,
      participant_count: optionalNumber(form.participant_count),
      location: form.location.trim() || null,
      held_on: form.held_on || null,
      duration_hours: optionalNumber(form.duration_hours),
      content_description: form.content_description.trim() || null,
      leader_signature_file_id: null,
      media_link: form.media_link.trim() || null,
      notes: form.notes.trim() || null,
      created_by: userId,
      updated_by: userId,
    })
    workshopId = response.data.id
    if (file.value) {
      const data = new FormData()
      data.append('file', file.value)
      data.append('record_type', 'WORKSHOP')
      data.append('record_id', String(workshopId))
      data.append('file_role', 'LEADER_SIGNATURE')
      data.append('uploaded_by', String(userId))
      const uploaded = await api.post('/api/record-files/files/upload', data)
      fileId = uploaded.data.id
      await api.patch(`/api/workshops/${workshopId}`, {
        leader_signature_file_id: fileId,
        updated_by: userId,
      })
    }
    if (detail.value) {
      const d = await api.post('/api/workshops/details', {
        workshop_id: workshopId,
        goals: detail.value.goals.trim() || null,
        learning_outcomes: detail.value.learning_outcomes.trim() || null,
        work_methods: detail.value.work_methods.trim() || null,
        materials_resources: detail.value.materials_resources.trim() || null,
        evaluation: detail.value.evaluation.trim() || null,
        created_by: userId,
        updated_by: userId,
      })
      detailId = d.data.id
    }
    if (media.value) {
      const m = await api.post('/api/workshops/media', {
        workshop_id: workshopId,
        workshop_name: media.value.workshop_name.trim(),
        media_type: media.value.media_type.trim() || null,
        media_link: media.value.media_link.trim(),
        published_on: media.value.published_on || null,
        created_by: userId,
        updated_by: userId,
      })
      mediaId = m.data.id
    }
    saved.value = true
    success.value = 'Nova radionica uspješno je spremljena.'
  } catch (e) {
    if (mediaId) await api.delete(`/api/workshops/media/${mediaId}`).catch(() => {})
    if (detailId) await api.delete(`/api/workshops/details/${detailId}`).catch(() => {})
    if (fileId) await api.delete(`/api/record-files/files/${fileId}`).catch(() => {})
    if (workshopId) await api.delete(`/api/workshops/${workshopId}`).catch(() => {})
    errors.value = e.response?.data?.errors || [
      e.response?.data?.message || 'Radionicu nije moguće spremiti.',
    ]
  } finally {
    saving.value = false
  }
}
async function load() {
  try {
    const [p, u] = await Promise.all([
      api.get('/api/reporting-periods'),
      api.get('/api/organizational-units'),
    ])
    periods.value = p.data
    units.value = u.data
    form.reporting_period_id = currentPeriod(periods.value)?.id ?? null
  } catch (e) {
    errors.value = [e.response?.data?.message || 'Nije moguće učitati obrazac.']
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<template>
  <main class="view">
    <nav>
      <RouterLink to="/istrazivanje-i-razvoj">Istraživanje i razvoj</RouterLink><span>›</span
      ><RouterLink to="/istrazivanje-i-razvoj/radionice">Radionice</RouterLink><span>›</span
      ><span>Nova radionica</span>
    </nav>
    <h1>Dodavanje nove radionice</h1>
    <p class="description">Evidencija održanih radionica</p>
    <p v-if="loading">Učitavanje...</p>
    <form v-else @submit.prevent="submit">
      <div v-if="errors.length" class="alert">
        <ul>
          <li v-for="e in errors" :key="e">{{ e }}</li>
        </ul>
      </div>
      <div class="card">
        <div class="grid">
          <label>Naziv radionice *<input v-model="form.workshop_name" :disabled="saved" /></label
          ><label
            >Voditelj/i radionice<input v-model="form.workshop_leaders" :disabled="saved"
          /></label>
        </div>
        <div class="grid">
          <label
            >Sastavnica<select v-model="form.organizational_unit_id" :disabled="saved">
              <option :value="null">Nije odabrano</option>
              <option v-for="u in units" :key="u.id" :value="u.id">
                {{ u.short_name || u.name }}
              </option>
            </select></label
          ><label
            >Ciljana skupina *<select v-model="form.target_group" :disabled="saved">
              <option value="" disabled>Odaberite skupinu</option>
              <option v-for="g in groups" :key="g.value" :value="g.value">{{ g.label }}</option>
            </select></label
          >
        </div>
        <div class="grid">
          <label
            >Broj sudionika<input
              v-model="form.participant_count"
              type="number"
              min="0"
              max="9999"
              :disabled="saved" /></label
          ><label>Mjesto održavanja<input v-model="form.location" :disabled="saved" /></label>
        </div>
        <div class="grid">
          <label>Datum<input v-model="form.held_on" type="date" :disabled="saved" /></label
          ><label
            >Trajanje (sati)<input
              v-model="form.duration_hours"
              type="number"
              min="0"
              max="999"
              :disabled="saved"
          /></label>
        </div>
        <label
          >Opis sadržaja<textarea
            v-model="form.content_description"
            rows="3"
            :disabled="saved"
          ></textarea></label
        ><label
          >Link na medijske objave<input
            v-model="form.media_link"
            placeholder="https://poveznica.hr"
            :disabled="saved" /></label
        ><label
          >Potpis voditelja
          <div class="file">
            <input
              ref="fileInput"
              class="hidden-file"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              :disabled="saved"
              @change="chooseFile"
            /><button
              type="button"
              class="file-button"
              :disabled="saved"
              @click="fileInput?.click()"
            >
              Odaberi datoteku</button
            ><span class="file-name">{{ file?.name || 'Nije odabrana datoteka' }}</span>
          </div></label
        ><label
          >Napomena<textarea v-model="form.notes" rows="3" :disabled="saved"></textarea>
        </label>
        <section>
          <header>
            <h2>Detaljni opis radionice</h2>
            <button
              type="button"
              class="square plus"
              :class="{ active: detail }"
              :disabled="saved"
              @click="toggleDetail"
            >
              +
            </button>
          </header>
          <p v-if="!detail">Detaljni opis nije dodan.</p>
          <article v-else>
            <div class="grid">
              <label>Ciljevi<textarea v-model="detail.goals"></textarea></label
              ><label>Ishodi učenja<textarea v-model="detail.learning_outcomes"></textarea></label>
            </div>
            <div class="grid">
              <label>Metode rada<textarea v-model="detail.work_methods"></textarea></label
              ><label
                >Materijali i resursi<textarea v-model="detail.materials_resources"></textarea>
              </label>
            </div>
            <label>Evaluacija<textarea v-model="detail.evaluation"></textarea></label>
          </article>
        </section>
        <section>
          <header>
            <h2>Linkovi na medijske objave</h2>
            <button
              type="button"
              class="square plus"
              :class="{ active: media }"
              :disabled="saved"
              @click="toggleMedia"
            >
              +
            </button>
          </header>
          <p v-if="!media">Medijska objava nije dodana.</p>
          <article v-else>
            <div class="grid">
              <label>Naziv radionice *<input v-model="media.workshop_name" /></label
              ><label>Vrsta medija<input v-model="media.media_type" /></label>
            </div>
            <div class="grid">
              <label>Link *<input v-model="media.media_link" /></label
              ><label>Datum objave<input v-model="media.published_on" type="date" /></label>
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
        @click="router.push('/istrazivanje-i-razvoj/radionice')"
      >
        Natrag
      </button>
    </form>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>
<style scoped>
.view {
  min-height: calc(100vh - 112px);
  padding: 34px clamp(32px, 5vw, 128px) 90px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}
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
nav a {
  color: inherit;
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
.file {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.hidden-file {
  display: none;
}
.file-button {
  flex: 0 0 auto;
  padding: 10px 16px;
  border: 1px solid rgb(var(--v-theme-on-surface));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s,
    border-color 0.2s;
}
.file-button:hover:not(:disabled) {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.file-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.file-name {
  min-width: 0;
  overflow: hidden;
  color: rgb(var(--v-theme-muted));
  text-overflow: ellipsis;
  white-space: nowrap;
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
.square {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
  border: 1px solid rgb(var(--v-theme-on-surface));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-size: 1.2rem;
}
.plus:hover,
.plus.active {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
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
@media (max-width: 650px) {
  .view {
    padding: 28px 20px;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
