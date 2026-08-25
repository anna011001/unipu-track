<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../services/api.js'
import { currentUser } from '../services/auth.js'

const email = ref('')
const entries = ref([])
const selectedId = ref(null)
const loading = ref(false)
const saving = ref(false)
const feedback = ref('')
const feedbackType = ref('success')
const organizationalUnits = ref([])
const selectedUnitIds = ref([])
const savingUnits = ref(false)

const selectedEntry = computed(
  () => entries.value.find((entry) => entry.id === selectedId.value) || null,
)
const canRemove = computed(
  () =>
    selectedEntry.value &&
    selectedEntry.value.email.toLowerCase() !== currentUser.value?.email?.toLowerCase(),
)
const canEditUnits = computed(() => Boolean(selectedEntry.value?.staff_member_id))
const primaryUnitId = computed(
  () => Number(selectedEntry.value?.primary_organizational_unit_id) || null,
)

watch(selectedEntry, (entry) => {
  if (!entry) {
    selectedUnitIds.value = []
    return
  }

  const linkedIds = Array.isArray(entry.organizational_units)
    ? entry.organizational_units.map((unit) => Number(unit.id))
    : []
  const primaryId = Number(entry.primary_organizational_unit_id)
  selectedUnitIds.value = [...new Set([...linkedIds, ...(primaryId ? [primaryId] : [])])]
})

function showFeedback(message, type = 'success') {
  feedback.value = message
  feedbackType.value = type
  window.setTimeout(() => {
    if (feedback.value === message) feedback.value = ''
  }, 4000)
}

async function loadEntries() {
  loading.value = true
  try {
    const response = await api.get('/api/auth/authorized-emails')
    entries.value = response.data
    if (!entries.value.some((entry) => entry.id === selectedId.value)) selectedId.value = null
  } catch (error) {
    showFeedback(error.response?.data?.message || 'Popis korisnika nije moguće učitati.', 'error')
  } finally {
    loading.value = false
  }
}

async function loadOrganizationalUnits() {
  try {
    const response = await api.get('/api/organizational-units')
    organizationalUnits.value = response.data
  } catch (error) {
    showFeedback(error.response?.data?.message || 'Sastavnice nije moguće učitati.', 'error')
  }
}

async function saveOrganizationalUnits() {
  if (!canEditUnits.value) return

  const entryId = selectedEntry.value.id
  savingUnits.value = true
  try {
    const response = await api.put(`/api/auth/authorized-emails/${entryId}/organizational-units`, {
      organizational_unit_ids: selectedUnitIds.value,
    })
    await loadEntries()
    selectedId.value = entryId
    showFeedback(response.data.message)
  } catch (error) {
    showFeedback(error.response?.data?.message || 'Sastavnice nije moguće spremiti.', 'error')
  } finally {
    savingUnits.value = false
  }
}

async function addEmail() {
  const normalizedEmail = email.value.trim().toLowerCase()
  if (!normalizedEmail.endsWith('@unipu.hr')) {
    showFeedback('Unesite ispravnu službenu @unipu.hr adresu.', 'error')
    return
  }

  saving.value = true
  try {
    await api.post('/api/auth/authorized-emails', { email: normalizedEmail })
    email.value = ''
    await loadEntries()
    showFeedback('E-mail je dodan na popis dopuštenih korisnika.')
  } catch (error) {
    showFeedback(error.response?.data?.message || 'E-mail nije moguće dodati.', 'error')
  } finally {
    saving.value = false
  }
}

async function removeSelected() {
  if (!canRemove.value) return
  const entry = selectedEntry.value
  const confirmed = window.confirm(
    `Želite li ukloniti ${entry.email} s popisa dopuštenih korisnika? Povezani račun bit će deaktiviran.`,
  )
  if (!confirmed) return

  saving.value = true
  try {
    const response = await api.delete(`/api/auth/authorized-emails/${entry.id}`)
    selectedId.value = null
    await loadEntries()
    showFeedback(response.data.message)
  } catch (error) {
    showFeedback(error.response?.data?.message || 'E-mail nije moguće ukloniti.', 'error')
  } finally {
    saving.value = false
  }
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium' }).format(new Date(value))
    : '—'
}

onMounted(() => Promise.all([loadEntries(), loadOrganizationalUnits()]))
</script>

<template>
  <main class="authorized-users-view">
    <div class="page-heading">
      <div>
        <p class="breadcrumb">Administracija</p>
        <h1>Korisnici aplikacije</h1>
        <p>
          Registrirati se mogu samo profesori čija se službena e-mail adresa nalazi na ovom popisu.
        </p>
      </div>
    </div>

    <section class="add-user-card">
      <label for="authorized-email">Dodaj službenu e-mail adresu</label>
      <div class="add-user-row">
        <input
          id="authorized-email"
          v-model="email"
          type="email"
          placeholder="ime.prezime@unipu.hr"
          :disabled="saving"
          @keyup.enter="addEmail"
        />
        <button type="button" :disabled="saving" @click="addEmail">Dodaj</button>
      </div>
      <p>
        Nakon dodavanja korisnik se može odmah registrirati. Ponovno dodavanje ranije uklonjene
        adrese aktivira postojeći račun.
      </p>
    </section>

    <section class="users-section">
      <div class="section-heading">
        <h2>Dopuštene e-mail adrese ({{ entries.length }})</h2>
        <button
          class="remove-button"
          type="button"
          :disabled="!canRemove || saving"
          title="Ukloni odabranu adresu"
          @click="removeSelected"
        >
          −
        </button>
      </div>

      <div class="users-table">
        <div class="table-row table-header">
          <span>E-mail</span>
          <span>Korisnik</span>
          <span>Status</span>
          <span>Dodano</span>
        </div>
        <button
          v-for="entry in entries"
          :key="entry.id"
          class="table-row data-row"
          :class="{ selected: selectedId === entry.id }"
          type="button"
          @click="selectedId = selectedId === entry.id ? null : entry.id"
        >
          <span data-label="E-mail">{{ entry.email }}</span>
          <span data-label="Korisnik">{{
            entry.is_registered ? `${entry.first_name} ${entry.last_name}` : '—'
          }}</span>
          <span
            data-label="Status"
            class="status"
            :class="entry.is_registered ? 'active' : 'waiting'"
          >
            {{ entry.is_registered ? 'Aktivan račun' : 'Čeka registraciju' }}
          </span>
          <span data-label="Dodano">{{ formatDate(entry.created_at) }}</span>
        </button>
        <p v-if="loading" class="empty-state">Učitavanje...</p>
        <p v-else-if="!entries.length" class="empty-state">Nema dopuštenih e-mail adresa.</p>
      </div>
      <p class="selection-help">
        Odaberite redak i pritisnite − za uklanjanje. Uklanjanjem se postojeći račun deaktivira, a
        uneseni podaci ostaju sačuvani.
      </p>
    </section>

    <section v-if="selectedEntry" class="units-card">
      <div class="units-heading">
        <div>
          <h2>Sastavnice nastavnika</h2>
          <p v-if="canEditUnits">
            Matična sastavnica ostaje osnova za izvještaje, a nastavniku možete dodijeliti i druge
            sastavnice na kojima predaje.
          </p>
          <p v-else>Dodatne sastavnice moći ćete odabrati nakon što se korisnik registrira.</p>
        </div>
        <button
          type="button"
          :disabled="!canEditUnits || savingUnits"
          @click="saveOrganizationalUnits"
        >
          {{ savingUnits ? 'Spremanje...' : 'Spremi sastavnice' }}
        </button>
      </div>

      <div v-if="canEditUnits" class="units-grid">
        <label v-for="unit in organizationalUnits" :key="unit.id" class="unit-option">
          <input
            v-model="selectedUnitIds"
            type="checkbox"
            :value="Number(unit.id)"
            :disabled="Number(unit.id) === primaryUnitId || savingUnits"
          />
          <span>
            <strong>{{ unit.short_name }}</strong>
            {{ unit.name }}
            <small v-if="Number(unit.id) === primaryUnitId">Matična sastavnica</small>
          </span>
        </label>
      </div>
    </section>

    <div v-if="feedback" class="feedback" :class="feedbackType" role="status">{{ feedback }}</div>
  </main>
</template>

<style scoped>
.authorized-users-view {
  width: min(1500px, calc(100% - 80px));
  margin: 0 auto;
  padding: 58px 0 100px;
  color: rgb(var(--v-theme-on-background));
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  margin-bottom: 44px;
}
.breadcrumb {
  margin: 0 0 10px;
  color: rgb(var(--v-theme-muted));
  font-size: 1rem;
}
.page-heading h1 {
  margin: 0 0 14px;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(2rem, 3vw, 3.2rem);
  font-weight: 500;
}
.page-heading p:last-child {
  max-width: 750px;
  margin: 0;
  color: rgb(var(--v-theme-muted));
  font-size: 1.05rem;
}
.add-user-card,
.units-card {
  padding: 30px 34px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
}
.add-user-card label {
  display: block;
  margin-bottom: 10px;
  font-weight: 700;
}
.add-user-row {
  display: flex;
  gap: 14px;
  max-width: 780px;
}
.add-user-row input {
  flex: 1;
  min-width: 0;
  height: 52px;
  padding: 0 16px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 8px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
  font: inherit;
  outline: none;
}
.add-user-row input:focus {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.12);
}
.add-user-row button,
.remove-button,
.units-heading button {
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--v-theme-on-background));
  cursor: pointer;
  font: inherit;
}
.add-user-row button {
  min-width: 120px;
  padding: 0 24px;
}
.add-user-row button:hover:not(:disabled),
.remove-button:hover:not(:disabled),
.units-heading button:hover:not(:disabled) {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.add-user-card > p {
  margin: 12px 0 0;
  color: rgb(var(--v-theme-muted));
  font-size: 0.9rem;
}
.users-section {
  margin-top: 62px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.section-heading h2,
.units-heading h2 {
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 2.2rem);
  font-weight: 400;
}
.remove-button {
  width: 44px;
  height: 42px;
  font-size: 1.5rem;
}
.remove-button:disabled,
.add-user-row button:disabled,
.units-heading button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}
.users-table {
  overflow: hidden;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 12px;
}
.table-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 0.8fr;
  gap: 0;
  width: 100%;
}
.table-row > span {
  padding: 17px 20px;
  border-right: 1px solid rgb(var(--v-theme-category-border));
  text-align: left;
}
.table-row > span:last-child {
  border-right: 0;
}
.table-header {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-weight: 800;
}
.data-row {
  border: 0;
  border-top: 1px solid rgb(var(--v-theme-category-border));
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
}
.data-row:first-of-type {
  border-top: 0;
}
.data-row:hover,
.data-row.selected {
  background: rgba(var(--v-theme-primary), 0.12);
}
.data-row.selected {
  box-shadow: inset 4px 0 rgb(var(--v-theme-primary));
}
.status {
  font-weight: 700;
}
.status.active {
  color: #27853b;
}
.status.waiting {
  color: rgb(var(--v-theme-muted));
}
.empty-state {
  margin: 0;
  padding: 34px;
  text-align: center;
  color: rgb(var(--v-theme-muted));
}
.selection-help {
  margin: 11px 0 0;
  color: rgb(var(--v-theme-muted));
  font-size: 0.88rem;
}
.units-card {
  margin-top: 36px;
}
.units-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 28px;
}
.units-heading p {
  max-width: 850px;
  margin: 9px 0 0;
  color: rgb(var(--v-theme-muted));
  line-height: 1.5;
}
.units-heading button {
  min-height: 44px;
  padding: 0 20px;
  white-space: nowrap;
}
.units-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 28px;
}
.unit-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 8px;
  cursor: pointer;
}
.unit-option:has(input:checked) {
  background: rgba(var(--v-theme-primary), 0.12);
}
.unit-option input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: rgb(var(--v-theme-primary));
}
.unit-option span {
  display: grid;
  gap: 3px;
}
.unit-option small {
  color: rgb(var(--v-theme-muted));
  font-size: 0.78rem;
}
.feedback {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 1000;
  max-width: 440px;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.22);
}
.feedback.success {
  background: #baf3bf;
  color: #173d1c;
}
.feedback.error {
  background: #ffd5d5;
  color: #6d1111;
}
@media (max-width: 1000px) {
  .units-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 850px) {
  .authorized-users-view {
    width: calc(100% - 32px);
    padding-top: 32px;
  }
  .add-user-row,
  .units-heading {
    flex-direction: column;
  }
  .add-user-row button {
    height: 48px;
  }
  .units-heading button {
    width: 100%;
  }
  .units-grid {
    grid-template-columns: 1fr;
  }
  .table-header {
    display: none;
  }
  .data-row {
    grid-template-columns: 1fr;
  }
  .data-row > span {
    display: grid;
    grid-template-columns: 110px 1fr;
    border-right: 0;
    border-bottom: 1px solid rgba(var(--v-theme-category-border), 0.5);
  }
  .data-row > span::before {
    content: attr(data-label);
    font-weight: 800;
  }
  .data-row > span:last-child {
    border-bottom: 0;
  }
}
</style>
