<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '../services/api.js'
import { currentUser } from '../services/auth.js'

const form = reactive({
  current_password: '',
  new_password: '',
  password_confirmation: '',
})
const saving = ref(false)
const error = ref('')
const success = ref('')
const staffProfile = ref(null)

const organizationalUnits = computed(() => {
  const profile = staffProfile.value
  if (!profile) return []

  if (Array.isArray(profile.organizational_units) && profile.organizational_units.length) {
    return profile.organizational_units.map((unit) => ({
      ...unit,
      label:
        unit.short_name && unit.name
          ? `${unit.short_name} — ${unit.name}`
          : unit.short_name || unit.name,
    }))
  }

  if (profile.organizational_unit_short_name && profile.organizational_unit_name) {
    return [
      {
        label: `${profile.organizational_unit_short_name} — ${profile.organizational_unit_name}`,
        is_primary: true,
      },
    ]
  }

  const label = profile.organizational_unit_short_name || profile.organizational_unit_name
  return label ? [{ label, is_primary: true }] : []
})

async function loadStaffProfile() {
  try {
    const response = await api.get('/api/staff-members')
    const currentEmail = currentUser.value?.email?.toLowerCase()

    staffProfile.value =
      response.data.find(
        (member) =>
          Number(member.user_id) === Number(currentUser.value?.id) ||
          (currentEmail && member.email?.toLowerCase() === currentEmail),
      ) || null
  } catch {
    staffProfile.value = null
  }
}

async function changePassword() {
  error.value = ''
  success.value = ''

  if (!form.current_password || !form.new_password || !form.password_confirmation) {
    error.value = 'Popunite sva polja.'
    return
  }

  saving.value = true
  try {
    const response = await api.post('/api/auth/change-password', form)
    success.value = response.data.message
    form.current_password = ''
    form.new_password = ''
    form.password_confirmation = ''
  } catch (exception) {
    error.value = exception.response?.data?.message || 'Lozinku trenutačno nije moguće promijeniti.'
  } finally {
    saving.value = false
  }
}

onMounted(loadStaffProfile)
</script>

<template>
  <main class="profile-view">
    <p class="breadcrumb">Korisnički profil</p>
    <h1>{{ currentUser?.first_name }} {{ currentUser?.last_name }}</h1>

    <section class="profile-card">
      <div class="account-details">
        <div>
          <span>E-mail</span><strong>{{ currentUser?.email }}</strong>
        </div>
        <div>
          <span>Uloga</span
          ><strong>{{ currentUser?.role === 'ADMIN' ? 'Administrator' : 'Nastavnik' }}</strong>
        </div>
        <div>
          <span>Sastavnice</span>
          <strong v-if="!organizationalUnits.length">—</strong>
          <ul v-else class="organizational-units">
            <li v-for="unit in organizationalUnits" :key="unit.id || unit.label">
              <strong>{{ unit.label }}</strong>
              <small v-if="unit.is_primary">Matična</small>
            </li>
          </ul>
        </div>
        <div>
          <span>Nastavna titula</span><strong>{{ staffProfile?.academic_title || '—' }}</strong>
        </div>
      </div>

      <form @submit.prevent="changePassword">
        <h2>Promjena lozinke</h2>
        <p>Privremenu lozinku zamijenite vlastitom lozinkom od najmanje osam znakova.</p>

        <label>
          <span>Trenutačna lozinka</span>
          <input
            v-model="form.current_password"
            type="password"
            autocomplete="current-password"
            :disabled="saving"
          />
        </label>
        <label>
          <span>Nova lozinka</span>
          <input
            v-model="form.new_password"
            type="password"
            autocomplete="new-password"
            :disabled="saving"
          />
        </label>
        <label>
          <span>Ponovite novu lozinku</span>
          <input
            v-model="form.password_confirmation"
            type="password"
            autocomplete="new-password"
            :disabled="saving"
          />
        </label>

        <p v-if="error" class="message error" role="alert">{{ error }}</p>
        <p v-if="success" class="message success" role="status">{{ success }}</p>
        <button type="submit" :disabled="saving">
          {{ saving ? 'Spremanje...' : 'Promijeni lozinku' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.profile-view {
  width: min(1050px, calc(100% - 64px));
  margin: 0 auto;
  padding: 58px 0 100px;
  color: rgb(var(--v-theme-on-background));
}
.breadcrumb {
  margin: 0 0 10px;
  color: rgb(var(--v-theme-muted));
}
.profile-view h1 {
  margin: 0 0 38px;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(2.1rem, 3.5vw, 3.5rem);
  font-weight: 500;
}
.profile-card {
  display: grid;
  grid-template-columns: minmax(240px, 0.8fr) minmax(360px, 1.2fr);
  gap: 60px;
  padding: clamp(30px, 5vw, 64px);
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 14px;
  background: rgb(var(--v-theme-surface));
}
.account-details {
  display: grid;
  align-content: start;
  gap: 24px;
}
.account-details div {
  display: grid;
  gap: 7px;
  padding-bottom: 22px;
  border-bottom: 1px solid rgb(var(--v-theme-category-border));
}
.account-details span {
  color: rgb(var(--v-theme-muted));
  font-size: 0.9rem;
}
.account-details strong {
  font-size: 1.05rem;
}
.organizational-units {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.organizational-units li {
  display: grid;
  gap: 2px;
}
.organizational-units small {
  color: rgb(var(--v-theme-muted));
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.profile-card form {
  display: grid;
  gap: 18px;
}
.profile-card h2 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 500;
}
.profile-card form > p {
  margin: -8px 0 5px;
  color: rgb(var(--v-theme-muted));
  line-height: 1.5;
}
.profile-card label {
  display: grid;
  gap: 8px;
  font-weight: 700;
}
.profile-card input {
  height: 50px;
  padding: 0 14px;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 8px;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
  font: inherit;
  outline: none;
}
.profile-card input:focus {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.12);
}
.profile-card button {
  height: 48px;
  margin-top: 4px;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 8px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}
.profile-card button:disabled {
  cursor: wait;
  opacity: 0.55;
}
.message {
  margin: 0 !important;
}
.message.error {
  color: rgb(var(--v-theme-error));
}
.message.success {
  color: #29853d;
}
@media (max-width: 760px) {
  .profile-view {
    width: calc(100% - 32px);
    padding-top: 32px;
  }
  .profile-card {
    grid-template-columns: 1fr;
    gap: 38px;
  }
}
</style>
