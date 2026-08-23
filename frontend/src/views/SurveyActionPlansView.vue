<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api.js'
import ExportButton from '../components/ExportButton.vue'

const userId = 1
const route = useRoute()
const plans = ref([])
const periods = ref([])
const staff = ref([])
const periodId = ref(null)
const selectedId = ref(null)
const staffMemberId = ref('')
const selections = ref({})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

const columns = [
  {
    key: 'inclusion_reasons',
    label: 'Razlog/razlozi uvrštenja',
    options: [
      'Prosječna ocjena nastavnika niža je od 3,00.',
      'Na neko pitanje nastavnik ima prosječnu ocjenu nižu od 3,00.',
      'Komentari iz ankete upućuju na moguće grubo kršenje uobičajenih etičkih normi.',
      'Nastavnik nije preuzeo omotnicu za provođenje studentske evaluacije.',
      'Procjeni nije pristupilo najmanje 33 % studenata upisanih na kolegiju.',
      'Studentska evaluacija nije provedena.',
    ],
    breakAfter: [3],
  },
  {
    key: 'observed_deficiency',
    label: 'Uočeni nedostatak',
    options: [
      'Nastavnik ne postavlja materijale za učenje.',
      'Nastavnik redovito kasni na nastavu.',
      'Izjava „Poštuje studenta” ocijenjena je ocjenom nižom od 3,00.',
      'Nastavnik je uzastopno dvaput ocijenjen prosječnom ocjenom nižom od 3,00.',
      'Nastavnik nije preuzeo omotnicu za provođenje studentske evaluacije.',
      'Studentska evaluacija nije provedena ili joj nije pristupilo najmanje 33 % studenata.',
    ],
    breakAfter: [4],
  },
  {
    key: 'improvement_measures',
    label: 'Mjere unaprjeđenja',
    options: [
      'Razgovor s nastavnikom.',
      'Obveza samovrednovanja nastavnika.',
      'Stručno osposobljavanje i usavršavanje za kvalitetniju izvedbu nastave.',
      'Određivanje sunositelja ili drugog nositelja kolegija za sljedeći semestar.',
      'Hospitiranje kod nastavnika ocijenjenog prosječnom ocjenom višom od 4,00.',
      'Suradnička procjena nastave.',
      'Pisano obrazloženje nastavnika.',
    ],
    breakAfter: [6],
  },
  {
    key: 'executed_measures_report',
    label: 'Izvješće o izvršenim mjerama',
    options: [
      'Razgovor s nastavnikom je obavljen.',
      'Nastavnik je predao samovrednovanje.',
      'Nastavnik je sudjelovao na stručnom osposobljavanju.',
      'Određen je sunositelj ili drugi nositelj kolegija.',
      'Nastavnik je hospitirao kod drugog nastavnika.',
      'Provedena je suradnička procjena nastave.',
      'Nastavnik je predao pisano obrazloženje.',
    ],
    breakAfter: [3],
  },
  {
    key: 'target_value',
    label: 'Ciljna vrijednost',
    options: [
      'Materijali su pravodobno postavljeni i omogućavaju kontinuirani rad studenata.',
      'Nastavnik dolazi na nastavu u skladu s rasporedom, bez kašnjenja.',
      'Izjava „Poštuje studenta” na sljedećoj evaluaciji ocijenjena je ocjenom višom od 3,00.',
      'Prosječna ocjena nastavnika na sljedećoj evaluaciji viša je od 3,00.',
      'Nastavnik je na sljedećoj evaluaciji preuzeo omotnicu.',
      'Na sljedećoj evaluaciji sudjeluje više od 33 % studenata i evaluacija je provedena.',
    ],
    breakAfter: [4],
  },
]

const filteredPlans = computed(() => plans.value.filter((item) => {
  const belongsToPeriod = !periodId.value || Number(item.reporting_period_id) === Number(periodId.value)
  return belongsToPeriod && isSurveyActionPlan(item)
}))
const selectedPlan = computed(() => plans.value.find((item) => Number(item.id) === Number(selectedId.value)))
const selectedStaff = computed(() => staff.value.find((item) => Number(item.id) === Number(staffMemberId.value)))
const reportValues = computed(() => Object.fromEntries(columns.map((column) => [column.key, combinedValues(column.key)])))

function resetAnswers() {
  selections.value = Object.fromEntries(columns.map((column) => [column.key, []]))
}

function combinedValues(key) {
  return [...(selections.value[key] || [])]
}

function optionGroups(column) {
  const division = column.breakAfter?.[0] || column.options.length
  return [column.options.slice(0, division), column.options.slice(division)]
}

function serialize(key) {
  return combinedValues(key).join('\n') || null
}

function staffName(id) {
  const item = staff.value.find((entry) => Number(entry.id) === Number(id))
  return item ? `${item.first_name} ${item.last_name}` : '—'
}

function splitStored(value) {
  return String(value || '').split(/\n+/).map((item) => item.trim()).filter(Boolean)
}

function isSurveyActionPlan(plan) {
  const reasons = splitStored(plan.inclusion_reasons)
  if (!reasons.length) return false

  return columns.every((column) => (
    splitStored(plan[column.key]).every((answer) => column.options.includes(answer))
  ))
}

function newPlan() {
  selectedId.value = null
  staffMemberId.value = ''
  resetAnswers()
  error.value = ''
}

function loadPlan(plan) {
  selectedId.value = plan.id
  staffMemberId.value = plan.staff_member_id
  periodId.value = plan.reporting_period_id || periodId.value
  for (const column of columns) {
    const stored = splitStored(plan[column.key])
    selections.value[column.key] = stored.filter((answer) => column.options.includes(answer))
  }
  error.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function message(exception, fallback) {
  return exception.response?.data?.errors?.join(' ') || exception.response?.data?.message || fallback
}

function toast(text) {
  success.value = text
  setTimeout(() => { success.value = '' }, 3500)
}

async function save() {
  if (!staffMemberId.value) {
    error.value = 'Odaberite nastavnika.'
    return
  }
  if (!serialize('inclusion_reasons')) {
    error.value = 'Odaberite barem jedan razlog uvrštenja.'
    return
  }

  saving.value = true
  error.value = ''
  const payload = {
    reporting_period_id: periodId.value ? Number(periodId.value) : null,
    staff_member_id: Number(staffMemberId.value),
    inclusion_reasons: serialize('inclusion_reasons'),
    observed_deficiency: serialize('observed_deficiency'),
    improvement_measures: serialize('improvement_measures'),
    executed_measures_report: serialize('executed_measures_report'),
    target_value: serialize('target_value'),
    updated_by: userId,
  }

  try {
    const response = selectedId.value
      ? await api.patch(`/api/survey-action-plans/${selectedId.value}`, payload)
      : await api.post('/api/survey-action-plans', { ...payload, created_by: userId })
    const index = plans.value.findIndex((item) => item.id === response.data.id)
    if (index >= 0) plans.value[index] = response.data
    else plans.value.unshift(response.data)
    selectedId.value = response.data.id
    toast(index >= 0 ? 'Izvješće uspješno je izmijenjeno.' : 'Izvješće uspješno je spremljeno.')
  } catch (exception) {
    error.value = message(exception, 'Izvješće nije moguće spremiti.')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!selectedPlan.value || !confirm(`Želite li izbrisati izvješće za „${staffName(selectedPlan.value.staff_member_id)}”?`)) return
  saving.value = true
  try {
    await api.delete(`/api/survey-action-plans/${selectedPlan.value.id}`)
    plans.value = plans.value.filter((item) => item.id !== selectedPlan.value.id)
    newPlan()
    toast('Izvješće uspješno je izbrisano.')
  } catch (exception) {
    error.value = message(exception, 'Izvješće nije moguće izbrisati.')
  } finally {
    saving.value = false
  }
}

async function load() {
  resetAnswers()
  try {
    const [planResponse, periodResponse, staffResponse] = await Promise.all([
      api.get('/api/survey-action-plans'),
      api.get('/api/reporting-periods'),
      api.get('/api/staff-members'),
    ])
    plans.value = planResponse.data
    periods.value = periodResponse.data
    staff.value = staffResponse.data
    periodId.value = periods.value[0]?.id ?? null
    const requestedPlan = plans.value.find((item) => Number(item.id) === Number(route.query.id))
    if (requestedPlan && isSurveyActionPlan(requestedPlan)) loadPlan(requestedPlan)
  } catch (exception) {
    error.value = message(exception, 'Podatke nije moguće dohvatiti.')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs">
      <RouterLink to="/nastava-i-kvaliteta">Nastava i kvaliteta</RouterLink><span>›</span><span>Studentske ankete</span>
    </nav>
    <h1>Planiranje mjera nakon vrednovanja nastavnog rada studentskim anketama</h1>
    <p class="intro">Odaberite nastavnika i jednu ili više mogućnosti u svakom stupcu. Izvješće se sastavlja automatski ispod tablice.</p>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!loading">
      <div class="topbar">
        <label>Izvještajno razdoblje
          <select v-model.number="periodId">
            <option :value="null">Bez razdoblja</option>
            <option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option>
          </select>
        </label>
        <div class="toolbar">
          <ExportButton :records="filteredPlans" file-name="mjere-nakon-studentskih-anketa" />
          <button :disabled="saving" @click="newPlan">Novi plan</button>
          <button :disabled="saving" @click="save">{{ selectedId ? 'Spremi izmjene' : 'Spremi izvješće' }}</button>
          <button class="delete" :disabled="saving || !selectedId" @click="remove">Izbriši</button>
        </div>
      </div>

      <section class="planner-wrap" aria-label="Plan mjera nakon studentskih anketa">
        <div class="planner-table">
          <div class="table-heading teacher-heading">Ime i prezime nastavnika</div>
          <div v-for="column in columns" :key="column.key" class="table-heading">{{ column.label }}</div>

          <div class="selection-cell teacher-cell">
            <label>Odaberite nastavnika
              <select v-model="staffMemberId">
                <option value="">Odaberite</option>
                <option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option>
              </select>
            </label>
            <p v-if="selectedStaff"><strong>{{ selectedStaff.academic_title || 'Bez zvanja' }}</strong><br>{{ selectedStaff.organizational_unit_short_name || selectedStaff.organizational_unit_name || '' }}</p>
          </div>

          <div v-for="column in columns" :key="`${column.key}-options`" class="selection-cell option-groups">
            <div v-for="(group, groupIndex) in optionGroups(column)" :key="`${column.key}-${groupIndex}`" class="option-group">
              <label v-for="option in group" :key="option" class="choice" :class="{ chosen: selections[column.key]?.includes(option) }">
                <input v-model="selections[column.key]" type="checkbox" :value="option">
                <span>{{ option }}</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section class="report-section">
        <h2>Izvješće prema odabranim stavkama</h2>
        <div class="report-table">
          <div class="report-cell teacher-report">
            <span>Ime i prezime nastavnika</span>
            <strong>{{ selectedStaff ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : 'Nastavnik nije odabran' }}</strong>
          </div>
          <div v-for="column in columns" :key="`${column.key}-report`" class="report-cell">
            <span>{{ column.label }}</span>
            <ul v-if="reportValues[column.key].length">
              <li v-for="answer in reportValues[column.key]" :key="answer">{{ answer }}</li>
            </ul>
            <em v-else>Nije odabrano</em>
          </div>
        </div>
      </section>

      <section class="saved-section">
        <h2>Spremljena izvješća</h2>
        <div class="saved-table-wrap">
          <table>
            <thead><tr><th>Nastavnik</th><th>Razlog uvrštenja</th><th>Uočeni nedostatak</th><th>Mjere unaprjeđenja</th><th>Ciljna vrijednost</th></tr></thead>
            <tbody>
              <tr v-for="plan in filteredPlans" :key="plan.id" :class="{ active: selectedId === plan.id }" @click="loadPlan(plan)">
                <td>{{ staffName(plan.staff_member_id) }}</td><td>{{ plan.inclusion_reasons }}</td><td>{{ plan.observed_deficiency || '—' }}</td><td>{{ plan.improvement_measures || '—' }}</td><td>{{ plan.target_value || '—' }}</td>
              </tr>
              <tr v-if="!filteredPlans.length"><td colspan="5" class="empty">Za odabrano razdoblje nema spremljenih izvješća.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(24px,4vw,90px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.topbar,.toolbar{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}.breadcrumbs a:hover{color:rgb(var(--v-theme-primary))}h1{max-width:1100px;margin:18px 0 8px;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.65vw,2.35rem);font-weight:400;line-height:1.35}.intro{margin:0;color:rgb(var(--v-theme-muted))}.error{color:rgb(var(--v-theme-error))}.topbar{justify-content:space-between;gap:24px;margin:36px 0 20px}.topbar label{display:grid;gap:7px;color:rgb(var(--v-theme-primary));font-weight:700}.topbar select{min-width:230px}.toolbar{gap:8px}button{height:36px;padding:0 14px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}button:hover:not(:disabled){background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}.delete:hover:not(:disabled){background:rgb(var(--v-theme-error));color:#fff}button:disabled{cursor:not-allowed;opacity:.45}select,textarea{box-sizing:border-box;width:100%;padding:10px 11px;border:1px solid rgb(var(--v-theme-category-border));border-radius:5px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.planner-wrap{overflow-x:auto;border:1px solid rgb(var(--v-theme-category-border));border-radius:8px}.planner-table{display:grid;grid-template-columns:220px repeat(5,minmax(245px,1fr));min-width:1460px;background:rgb(var(--v-theme-category-border));gap:1px}.table-heading{display:grid;min-width:0;min-height:74px;padding:15px;place-items:center;background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary));font-weight:700;text-align:center}.selection-cell{display:flex;min-width:0;min-height:510px;padding:0;background:rgb(var(--v-theme-surface));flex-direction:column}.teacher-cell{display:block;padding:18px}.teacher-cell label,.custom-answer{display:grid;gap:7px;color:rgb(var(--v-theme-primary));font-size:.82rem;font-weight:700}.teacher-cell p{margin:18px 0 0;line-height:1.6}.choice{display:flex;align-items:center;justify-content:center;min-width:0;min-height:64px;margin:0;padding:12px 14px;border:0;border-bottom:1px solid rgb(var(--v-theme-category-border));background:rgb(var(--v-theme-surface));cursor:pointer;font-size:.82rem;line-height:1.4;text-align:center;transition:background-color 140ms ease}.choice.group-break{border-bottom-width:3px}.choice:hover{background:rgba(var(--v-theme-primary),.07)}.choice.chosen{background:rgba(var(--v-theme-primary),.2);color:rgb(var(--v-theme-primary));font-weight:700}.choice input{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}.choice span{min-width:0;overflow-wrap:anywhere}.custom-answer{margin-top:auto;padding:12px 14px;border-top:1px solid rgb(var(--v-theme-category-border));background:rgba(var(--v-theme-primary),.06)}.custom-answer textarea{min-height:72px;resize:vertical}.report-section,.saved-section{margin-top:58px}.report-section h2,.saved-section h2{margin:0 0 16px;font-size:1.4rem;font-weight:400}.report-table{display:grid;grid-template-columns:220px repeat(5,minmax(0,1fr));overflow:hidden;border:1px solid rgb(var(--v-theme-category-border));border-radius:8px;background:rgb(var(--v-theme-category-border));gap:1px}.report-cell{min-width:0;padding:20px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card))}.report-cell>span{display:block;margin-bottom:12px;font-size:.78rem;font-weight:700}.report-cell strong{font-weight:600}.report-cell ul{margin:0;padding-left:18px}.report-cell li+li{margin-top:8px}.report-cell em{opacity:.7}.saved-table-wrap{overflow-x:auto;border:1px solid rgb(var(--v-theme-category-border));border-radius:8px}table{width:100%;min-width:1100px;border-collapse:collapse;background:rgb(var(--v-theme-surface))}th,td{padding:14px 16px;border-bottom:1px solid rgb(var(--v-theme-category-border));text-align:left;vertical-align:top;white-space:pre-line}th{background:rgba(var(--v-theme-primary),.12);color:rgb(var(--v-theme-primary));font-size:.82rem}tbody tr{cursor:pointer}tbody tr:hover,tbody tr.active{background:rgba(var(--v-theme-primary),.08)}tbody tr:last-child td{border-bottom:0}.empty{text-align:center;color:rgb(var(--v-theme-muted))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:1050px){.report-table{grid-template-columns:1fr 1fr}.teacher-report{grid-column:1/-1}}@media(max-width:700px){.view{padding:28px 20px 70px}.topbar{align-items:stretch;flex-direction:column}.toolbar{flex-wrap:wrap}.report-table{grid-template-columns:1fr}.teacher-report{grid-column:auto}}
.teacher-cell label{display:grid;gap:7px;color:rgb(var(--v-theme-primary));font-size:.82rem;font-weight:700}
.planner-table{grid-template-columns:180px repeat(5,minmax(210px,1fr));min-width:1235px}
.table-heading{border-right:1px solid rgba(var(--v-theme-on-primary),.55)}
.table-heading:nth-child(6){border-right:0}
.selection-cell.option-groups{display:grid;grid-template-rows:4fr 3fr}
.option-group{display:flex;min-height:0;flex-direction:column}
.option-group:first-child{border-bottom:3px solid rgb(var(--v-theme-category-border))}
.option-group .choice{min-height:0;flex:1}
.option-group .choice:last-child{border-bottom:0}
</style>
