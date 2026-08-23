<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../services/api.js'

const userId = 1
const periods = ref([]), units = ref([]), staff = ref([]), reports = ref([]), measures = ref([]), beneficiaries = ref([]), planned = ref([]), effects = ref([])
const periodId = ref(null), unitId = ref(null), selected = ref(null), activeType = ref(''), activeId = ref(null), form = ref(null)
const selectedMeasureType = ref('ALL')
const loading = ref(true), saving = ref(false), error = ref(''), success = ref('')
const measureTypes = [
  { value: 'ALL', label: 'Sve mjere' },
  { value: 'Blok nastava', label: 'Blok nastava' },
  { value: 'Koncentracija nastave u 2-3 dana', label: 'Koncentracija nastave u 2–3 dana' },
  { value: 'Online nastava', label: 'Online nastava' },
  { value: 'Hibridna nastava', label: 'Hibridna nastava' },
  { value: 'Oslobođenje od administrativnih obveza', label: 'Oslobođenje od administrativnih obveza' },
  { value: 'Zamjena nastavnika', label: 'Zamjena nastavnika' },
  { value: 'Slobodni dani za istraživanje', label: 'Slobodni dani za istraživanje' },
]
const configs = {
  measures: { title: 'Primijenjene mjere prilagodbe rasporeda', endpoint: 'measures', source: measures, fields: [['measure_type','Vrsta mjere','measure'],['measure_description','Opis mjere','area'],['beneficiary_count','Broj korisnika','number'],['released_hours_per_week','Oslobođeno vrijeme (sati/tjedno)','number'],['application_period','Razdoblje primjene','text'],['status','Status','text']] },
  beneficiaries: { title: 'Evidencija korisnika mjera prilagodbe', endpoint: 'beneficiaries', source: beneficiaries, fields: [['staff_member_id','Ime i prezime','staff'],['measure_type','Vrsta mjere','measure'],['adjustment_reason','Razlog prilagodbe','area'],['research_project_activity','Istraživački projekt/aktivnost','area'],['released_time','Oslobođeno vrijeme','text'],['application_period','Razdoblje','text'],['results','Rezultati','area'],['status','Status','text']] },
  planned: { title: 'Plan prilagodbe za sljedeću akademsku godinu', endpoint: 'planned', source: planned, fields: [['staff_member_id','Ime i prezime','staff'],['planned_measure','Planirana mjera','measure'],['reason','Razlog','area'],['planned_period','Razdoblje','text'],['expected_results','Očekivani rezultati','area']] },
}
const selectedPeriod = computed(() => periods.value.find((item) => Number(item.id) === Number(periodId.value)))
const selectedEffect = computed(() => effects.value.find((item) => Number(item.report_id) === Number(selected.value?.id)))
const adjustedTeacherCount = computed(() => new Set(
  rows('beneficiaries').map((item) => Number(item.staff_member_id)).filter(Boolean),
).size)
function rows(type) { return configs[type].source.value.filter((item) => Number(item.report_id) === Number(selected.value?.id)) }
function visibleRows(type) {
  const items = rows(type)
  if (selectedMeasureType.value === 'ALL' || type === 'planned') return items
  const field = type === 'measures' ? 'measure_type' : 'measure_type'
  return items.filter((item) => item[field] === selectedMeasureType.value)
}
function measureTypeLabel(value) { return measureTypes.find((item) => item.value === value)?.label || value || '—' }
function staffName(id) { const item = staff.value.find((entry) => Number(entry.id) === Number(id)); return item ? `${item.first_name} ${item.last_name}` : '—' }
function staffTitle(id) { return staff.value.find((entry) => Number(entry.id) === Number(id))?.academic_title || '—' }
function display(field, value) { if (field === 'staff_member_id') return staffName(value); if (field === 'measure_type' || field === 'planned_measure') return measureTypeLabel(value); return value === null || value === undefined || value === '' ? '—' : value }
function optional(value, type) { if (value === '' || value === null || value === undefined) return null; return type === 'number' ? Number(value) : String(value).trim() || null }
function message(exception, fallback) { return exception.response?.data?.errors?.join(' ') || exception.response?.data?.message || fallback }
function toast(text) { success.value = text; setTimeout(() => { success.value = '' }, 3500) }
function selectReport() { selected.value = reports.value.find((item) => Number(item.reporting_period_id) === Number(periodId.value) && Number(item.organizational_unit_id) === Number(unitId.value)) || null; cancel() }
async function createReport() {
  if (!periodId.value || !unitId.value) return
  saving.value = true; error.value = ''
  try { const response = await api.post('/api/schedule-adjustments/reports', { reporting_period_id: Number(periodId.value), organizational_unit_id: Number(unitId.value), academic_year: String(selectedPeriod.value?.label || '').slice(0, 11), created_by: userId, updated_by: userId }); reports.value.unshift(response.data); selected.value = response.data; toast('Izvješće je uspješno kreirano.') } catch (exception) { error.value = message(exception, 'Izvješće nije moguće kreirati.') } finally { saving.value = false }
}
async function deleteReport() { if (!selected.value || !confirm('Želite li izbrisati izvješće i sve povezane zapise?')) return; saving.value = true; try { const id = selected.value.id; await api.delete(`/api/schedule-adjustments/reports/${id}`); reports.value = reports.value.filter((item) => item.id !== id); selected.value = null; toast('Izvješće je uspješno izbrisano.') } catch (exception) { error.value = message(exception, 'Izvješće nije moguće izbrisati.') } finally { saving.value = false } }
function empty(type) { return Object.fromEntries(configs[type].fields.map(([field]) => [field, ''])) }
function add(type) { activeType.value = type; activeId.value = 'new'; form.value = empty(type); if (selectedMeasureType.value !== 'ALL' && (type === 'measures' || type === 'beneficiaries')) form.value.measure_type = selectedMeasureType.value; error.value = '' }
function selectRow(type, id) { activeType.value = type; activeId.value = id; form.value = null; error.value = '' }
function edit(type) { const item = rows(type).find((entry) => entry.id === activeId.value); if (!item) return; activeType.value = type; form.value = { ...item } }
function cancel() { activeType.value = ''; activeId.value = null; form.value = null }
async function save(type) {
  const config = configs[type]
  if ((type === 'measures' && !String(form.value.measure_type).trim()) || (type !== 'measures' && !form.value.staff_member_id)) { error.value = type === 'measures' ? 'Vrsta mjere je obavezna.' : 'Nastavnik je obavezan.'; return }
  saving.value = true; error.value = ''
  const payload = { updated_by: userId }
  for (const [field,,kind] of config.fields) payload[field] = optional(form.value[field], kind)
  try { const response = activeId.value === 'new' ? await api.post(`/api/schedule-adjustments/${config.endpoint}`, { ...payload, report_id: selected.value.id, created_by: userId }) : await api.patch(`/api/schedule-adjustments/${config.endpoint}/${activeId.value}`, payload); const index = config.source.value.findIndex((item) => item.id === response.data.id); if (index >= 0) config.source.value[index] = response.data; else config.source.value.push(response.data); activeId.value = response.data.id; activeType.value = type; form.value = null; toast('Zapis je uspješno spremljen.') } catch (exception) { error.value = message(exception, 'Zapis nije moguće spremiti.') } finally { saving.value = false }
}
async function remove(type) { const config = configs[type], item = rows(type).find((entry) => entry.id === activeId.value); if (!item || !confirm('Želite li izbrisati odabrani zapis?')) return; saving.value = true; try { await api.delete(`/api/schedule-adjustments/${config.endpoint}/${item.id}`); config.source.value = config.source.value.filter((entry) => entry.id !== item.id); cancel(); toast('Zapis je uspješno izbrisan.') } catch (exception) { error.value = message(exception, 'Zapis nije moguće izbrisati.') } finally { saving.value = false } }
function effectForm() { const item = selectedEffect.value; form.value = item ? { ...item, adjusted_teacher_count: adjustedTeacherCount.value } : { adjusted_teacher_count: adjustedTeacherCount.value, released_research_hours: 0, submitted_research_project_count: 0, published_paper_count: 0, q1_q2_paper_count: 0, average_productivity_increase_percent: '' }; activeType.value = 'effect'; activeId.value = item?.id || 'new' }
async function saveEffect() { saving.value = true; error.value = ''; const payload = { adjusted_teacher_count: adjustedTeacherCount.value, released_research_hours: Number(form.value.released_research_hours || 0), submitted_research_project_count: Number(form.value.submitted_research_project_count || 0), published_paper_count: Number(form.value.published_paper_count || 0), q1_q2_paper_count: Number(form.value.q1_q2_paper_count || 0), average_productivity_increase_percent: optional(form.value.average_productivity_increase_percent, 'number'), updated_by: userId }; try { const response = activeId.value === 'new' ? await api.post('/api/schedule-adjustments/effect-analyses', { ...payload, report_id: selected.value.id, created_by: userId }) : await api.patch(`/api/schedule-adjustments/effect-analyses/${activeId.value}`, payload); const index = effects.value.findIndex((item) => item.id === response.data.id); if (index >= 0) effects.value[index] = response.data; else effects.value.push(response.data); cancel(); toast('Analiza učinka uspješno je spremljena.') } catch (exception) { error.value = message(exception, 'Analizu nije moguće spremiti.') } finally { saving.value = false } }
async function load() { try { const responses = await Promise.all([api.get('/api/reporting-periods'), api.get('/api/organizational-units'), api.get('/api/staff-members'), api.get('/api/schedule-adjustments/reports'), api.get('/api/schedule-adjustments/measures'), api.get('/api/schedule-adjustments/beneficiaries'), api.get('/api/schedule-adjustments/planned'), api.get('/api/schedule-adjustments/effect-analyses')]); [periods.value, units.value, staff.value, reports.value, measures.value, beneficiaries.value, planned.value, effects.value] = responses.map((response) => response.data); periodId.value = periods.value[0]?.id ?? null; unitId.value = units.value[0]?.id ?? null; selectReport() } catch (exception) { error.value = message(exception, 'Podatke nije moguće dohvatiti.') } finally { loading.value = false } }
watch([periodId, unitId], selectReport)
watch(selectedMeasureType, cancel)
onMounted(load)
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs"><RouterLink to="/nastava-i-kvaliteta">Nastava i kvaliteta</RouterLink><span>›</span><span>Prilagodbe rasporeda</span></nav>
    <h1>Izvješće o prilagodbi rasporeda nastave</h1>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!loading">
      <section class="selectors">
        <label>Akademska godina<select v-model.number="periodId"><option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option></select></label>
        <label>Sastavnica<select v-model.number="unitId"><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select></label>
      </section>

      <section v-if="!selected" class="empty-report">
        <div><h2>Izvješće još nije kreirano</h2><p>Za odabranu akademsku godinu i sastavnicu nema podataka.</p></div>
        <button @click="createReport">Kreiraj izvješće</button>
      </section>

      <template v-else>
        <div class="report-bar"><span>Izvješće za <strong>{{ selected.academic_year }}</strong> · <strong>{{ selected.organizational_unit_name }}</strong></span><button @click="deleteReport">Izbriši izvješće</button></div>

        <section class="measure-filter" aria-label="Vrsta mjere prilagodbe">
          <button v-for="type in measureTypes" :key="type.value" type="button" :class="{ active: selectedMeasureType === type.value }" @click="selectedMeasureType = type.value">{{ type.label }}</button>
        </section>

        <section v-for="type in ['measures', 'beneficiaries']" :key="type" class="data-section">
          <header>
            <h2>{{ configs[type].title }}<template v-if="selectedMeasureType !== 'ALL'"> · {{ measureTypeLabel(selectedMeasureType) }}</template></h2>
            <div class="toolbar">
              <template v-if="activeType === type && form"><button @click="save(type)">Spremi</button><button @click="cancel">Odustani</button></template>
              <button v-else :disabled="activeType !== type || !activeId" @click="edit(type)">Uredi</button>
              <button class="square" :disabled="Boolean(form)" @click="add(type)">+</button>
              <button class="square" :disabled="activeType !== type || !activeId || Boolean(form)" @click="remove(type)">−</button>
            </div>
          </header>

          <div class="editable-table-wrap">
            <table class="editable-table">
              <thead><tr><template v-for="field in configs[type].fields" :key="field[0]"><th>{{ field[1] }}</th><th v-if="type === 'beneficiaries' && field[0] === 'staff_member_id'">Zvanje</th></template></tr></thead>
              <tbody>
                <tr v-if="activeType === type && activeId === 'new'" class="editing-row">
                  <template v-for="field in configs[type].fields" :key="field[0]">
                    <td>
                      <select v-if="field[2] === 'staff'" v-model="form[field[0]]"><option value="">Odaberite</option><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select>
                      <select v-else-if="field[2] === 'measure'" v-model="form[field[0]]"><option value="">Odaberite mjeru</option><option v-for="measure in measureTypes.slice(1)" :key="measure.value" :value="measure.value">{{ measure.label }}</option></select>
                      <textarea v-else-if="field[2] === 'area'" v-model="form[field[0]]" rows="2"></textarea>
                      <input v-else v-model="form[field[0]]" :type="field[2]">
                    </td>
                    <td v-if="type === 'beneficiaries' && field[0] === 'staff_member_id'" class="derived-cell">{{ staffTitle(form.staff_member_id) }}</td>
                  </template>
                </tr>

                <tr v-for="item in visibleRows(type)" :key="item.id" :class="{ selected: activeType === type && activeId === item.id }" @click="selectRow(type, item.id)">
                  <template v-for="field in configs[type].fields" :key="field[0]">
                    <td v-if="activeType === type && activeId === item.id && form">
                      <select v-if="field[2] === 'staff'" v-model="form[field[0]]" @click.stop><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select>
                      <select v-else-if="field[2] === 'measure'" v-model="form[field[0]]" @click.stop><option v-for="measure in measureTypes.slice(1)" :key="measure.value" :value="measure.value">{{ measure.label }}</option></select>
                      <textarea v-else-if="field[2] === 'area'" v-model="form[field[0]]" rows="2" @click.stop></textarea>
                      <input v-else v-model="form[field[0]]" :type="field[2]" @click.stop>
                    </td>
                    <td v-else>{{ display(field[0], item[field[0]]) }}</td>
                    <td v-if="type === 'beneficiaries' && field[0] === 'staff_member_id'" class="derived-cell">{{ staffTitle(activeType === type && activeId === item.id && form ? form.staff_member_id : item.staff_member_id) }}</td>
                  </template>
                </tr>
                <tr v-if="!visibleRows(type).length && !(activeType === type && activeId === 'new')"><td :colspan="configs[type].fields.length + (type === 'beneficiaries' ? 1 : 0)" class="empty-cell">Nema zapisa za odabranu mjeru.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="selectedMeasureType === 'ALL'" class="data-section">
          <header><h2>Analiza učinka prilagodbe na znanstvenu produktivnost</h2><div class="toolbar"><template v-if="activeType === 'effect'"><button @click="saveEffect">Spremi</button><button @click="cancel">Odustani</button></template><button v-else @click="effectForm">{{ selectedEffect ? 'Uredi' : 'Dodaj' }}</button></div></header>
          <div class="summary"><div v-for="field in [['adjusted_teacher_count','Nastavnici s prilagođenim rasporedom'],['released_research_hours','Oslobođeno vrijeme za istraživanje (sati/ak. god.)'],['submitted_research_project_count','Prijavljeni istraživački projekti'],['published_paper_count','Objavljeni radovi korisnika mjera'],['q1_q2_paper_count','Q1/Q2 radovi korisnika mjera'],['average_productivity_increase_percent','Prosječno povećanje produktivnosti (%)']]" :key="field[0]"><span>{{ field[1] }}</span><strong v-if="field[0] === 'adjusted_teacher_count'">{{ adjustedTeacherCount }}</strong><input v-else-if="activeType === 'effect'" v-model="form[field[0]]" type="number" min="0"><strong v-else>{{ selectedEffect?.[field[0]] ?? 0 }}</strong></div></div>
        </section>

        <section v-if="selectedMeasureType === 'ALL'" class="data-section">
          <header>
            <h2>{{ configs.planned.title }}</h2>
            <div class="toolbar"><template v-if="activeType === 'planned' && form"><button @click="save('planned')">Spremi</button><button @click="cancel">Odustani</button></template><button v-else :disabled="activeType !== 'planned' || !activeId" @click="edit('planned')">Uredi</button><button class="square" :disabled="Boolean(form)" @click="add('planned')">+</button><button class="square" :disabled="activeType !== 'planned' || !activeId || Boolean(form)" @click="remove('planned')">−</button></div>
          </header>
          <div class="editable-table-wrap"><table class="editable-table"><thead><tr><template v-for="field in configs.planned.fields" :key="field[0]"><th>{{ field[1] }}</th><th v-if="field[0] === 'staff_member_id'">Zvanje</th></template></tr></thead><tbody>
            <tr v-if="activeType === 'planned' && activeId === 'new'" class="editing-row"><template v-for="field in configs.planned.fields" :key="field[0]"><td><select v-if="field[2] === 'staff'" v-model="form[field[0]]"><option value="">Odaberite</option><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select><select v-else-if="field[2] === 'measure'" v-model="form[field[0]]"><option value="">Odaberite mjeru</option><option v-for="measure in measureTypes.slice(1)" :key="measure.value" :value="measure.value">{{ measure.label }}</option></select><textarea v-else-if="field[2] === 'area'" v-model="form[field[0]]" rows="2"></textarea><input v-else v-model="form[field[0]]" :type="field[2]"></td><td v-if="field[0] === 'staff_member_id'" class="derived-cell">{{ staffTitle(form.staff_member_id) }}</td></template></tr>
            <tr v-for="item in visibleRows('planned')" :key="item.id" :class="{ selected: activeType === 'planned' && activeId === item.id }" @click="selectRow('planned', item.id)"><template v-for="field in configs.planned.fields" :key="field[0]"><td v-if="activeType === 'planned' && activeId === item.id && form"><select v-if="field[2] === 'staff'" v-model="form[field[0]]" @click.stop><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select><select v-else-if="field[2] === 'measure'" v-model="form[field[0]]" @click.stop><option v-for="measure in measureTypes.slice(1)" :key="measure.value" :value="measure.value">{{ measure.label }}</option></select><textarea v-else-if="field[2] === 'area'" v-model="form[field[0]]" rows="2" @click.stop></textarea><input v-else v-model="form[field[0]]" :type="field[2]" @click.stop></td><td v-else>{{ display(field[0], item[field[0]]) }}</td><td v-if="field[0] === 'staff_member_id'" class="derived-cell">{{ staffTitle(activeType === 'planned' && activeId === item.id && form ? form.staff_member_id : item.staff_member_id) }}</td></template></tr>
            <tr v-if="!visibleRows('planned').length && !(activeType === 'planned' && activeId === 'new')"><td :colspan="configs.planned.fields.length + 1" class="empty-cell">Nema planiranih prilagodbi.</td></tr>
          </tbody></table></div>
        </section>
      </template>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(24px,5vw,110px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.selectors,.report-bar,.data-section header,.toolbar{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}h1{margin:18px 0 0;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.7vw,2.4rem);font-weight:400}.subtitle{margin:5px 0 0;color:rgb(var(--v-theme-muted));font-style:italic}.selectors{gap:24px;margin-top:36px}.selectors label,.form-grid label{display:grid;gap:7px;color:rgb(var(--v-theme-primary));font-weight:700}.selectors select{min-width:240px}.selectors select,input,textarea,.card select{box-sizing:border-box;width:100%;min-height:44px;padding:10px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.empty-report,.report-bar{justify-content:space-between;gap:24px;margin-top:34px;padding:24px;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-surface))}.empty-report{display:flex;align-items:center}.empty-report p{margin:6px 0}.report-bar button,.empty-report button,.toolbar button{height:34px;padding:0 13px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}.data-section{margin-top:58px}.data-section header{justify-content:space-between;gap:22px;margin-bottom:15px}.data-section h2{margin:0;font-size:1.4rem;font-weight:400}.toolbar{gap:7px}.toolbar .square{width:34px;padding:0;font-size:1.1rem}.toolbar button:disabled{cursor:not-allowed;opacity:.45}.cards{display:grid;gap:14px}.card{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 28px;padding:clamp(26px,3vw,42px);border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card));cursor:pointer}.card:hover,.card.selected{background:rgb(var(--v-theme-category-card-hover))}.field{display:grid;align-content:start;gap:6px;min-width:0}.field span,.card label{font-size:.83rem;font-weight:700}.field strong{overflow-wrap:anywhere;font-weight:400;line-height:1.45;white-space:pre-line}.field small{opacity:.78}.wide{grid-column:span 2}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%}.card>.form-grid{grid-column:1/-1}.card textarea{min-height:88px;resize:vertical}.number{position:absolute;top:10px;right:13px;opacity:.7}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;overflow:hidden;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-category-border))}.summary>div{display:grid;gap:10px;padding:22px;background:rgb(var(--v-theme-surface))}.summary span{color:rgb(var(--v-theme-primary));font-weight:700}.summary strong{font-size:1.35rem}.empty{padding:24px;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;color:rgb(var(--v-theme-muted))}.error{color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:850px){.selectors,.data-section header,.report-bar,.empty-report{align-items:stretch;flex-direction:column}.card,.form-grid,.summary{grid-template-columns:1fr}.wide{grid-column:auto}}
.measure-filter{display:flex;flex-wrap:wrap;gap:10px;margin-top:34px}
.measure-filter button{min-height:42px;padding:8px 16px;border:1px solid rgb(var(--v-theme-category-border));border-radius:8px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}
.measure-filter button:hover,.measure-filter button.active{background:rgb(var(--v-theme-primary));color:rgb(var(--v-theme-on-primary))}
.editable-table-wrap{overflow:hidden;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px}
.editable-table{width:100%;border-collapse:collapse;table-layout:fixed;background:rgb(var(--v-theme-surface))}
.editable-table th,.editable-table td{min-width:0;padding:12px 10px;border-right:1px solid rgb(var(--v-theme-category-border));border-bottom:1px solid rgb(var(--v-theme-category-border));overflow:hidden;overflow-wrap:anywhere;text-align:left;vertical-align:top;white-space:pre-line}
.editable-table th{background:rgba(var(--v-theme-primary),.14);color:rgb(var(--v-theme-primary));font-size:.76rem;line-height:1.3}
.editable-table td{font-size:.8rem;line-height:1.4}
.editable-table th:last-child,.editable-table td:last-child{border-right:0}
.editable-table tbody tr:last-child td{border-bottom:0}
.editable-table tbody tr:not(.editing-row){cursor:pointer}
.editable-table tbody tr:hover td,.editable-table tbody tr.selected td{background:rgba(var(--v-theme-primary),.08)}
.editable-table input,.editable-table select,.editable-table textarea{box-sizing:border-box;display:block;width:100%;max-width:100%;min-width:0;min-height:38px;margin:0;padding:8px 10px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit;font-size:.78rem}
.editable-table select{padding-right:28px;text-overflow:ellipsis;white-space:nowrap}
.editable-table input:focus,.editable-table select:focus,.editable-table textarea:focus{border-color:rgb(var(--v-theme-primary));outline:0;box-shadow:0 0 0 2px rgba(var(--v-theme-primary),.14)}
.editable-table textarea{resize:vertical}
.derived-cell{color:rgb(var(--v-theme-muted))}
.empty-cell{padding:24px!important;color:rgb(var(--v-theme-muted));text-align:center!important}
@media(max-width:900px){.editable-table-wrap{overflow-x:auto}.editable-table{min-width:1050px}.measure-filter{align-items:stretch;flex-direction:column}}
</style>
