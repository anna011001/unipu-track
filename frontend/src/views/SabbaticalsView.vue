<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../services/api.js'
import ExportButton from '../components/ExportButton.vue'

const userId = 1
const reports = ref([]), periods = ref([]), staff = ref([]), units = ref([]), users = ref([]), papers = ref([]), monographs = ref([]), summaries = ref([])
const periodId = ref(null), selected = ref(null), activeType = ref(''), activeId = ref(null), form = ref(null)
const loading = ref(true), saving = ref(false), error = ref(''), success = ref('')
const configs = {
  users: { title: 'Evidencija korisnika slobodne studijske godine', endpoint: 'users', source: users, fields: [['staff_member_id','Ime i prezime','staff'],['organizational_unit_id','Sastavnica','unit'],['usage_period','Razdoblje korištenja','text'],['q1_paper_count','Q1 radovi','number'],['q2_paper_count','Q2 radovi','number'],['other_paper_count','Ostali radovi','number'],['monograph_count','Monografije','number'],['status','Status','text'],['notes','Napomena','area']] },
  papers: { title: 'Popis objavljenih radova u Q1/Q2 časopisima', endpoint: 'papers', source: papers, fields: [['authors','Autor/i','area'],['paper_title','Naslov rada','area'],['journal','Časopis','text'],['quartile','Kvartil','quartile'],['publication_year','Godina','number'],['doi_or_link','DOI / Link','text'],['notes','Napomena','area']] },
  monographs: { title: 'Popis objavljenih znanstvenih monografija', endpoint: 'monographs', source: monographs, fields: [['authors','Autor/i','area'],['monograph_title','Naslov monografije','area'],['publisher','Izdavač','text'],['publication_year','Godina','number'],['isbn','ISBN','text'],['page_count','Broj stranica','number'],['link_or_reviews','Link / Recenzije','area']] },
}
const selectedSummary = computed(() => summaries.value.find((item) => Number(item.report_id) === Number(selected.value?.id)))
function rows(type) { return configs[type].source.value.filter((item) => Number(item.report_id) === Number(selected.value?.id)) }
function staffName(id) { const item = staff.value.find((entry) => Number(entry.id) === Number(id)); return item ? `${item.first_name} ${item.last_name}` : '—' }
function staffTitle(id) { return staff.value.find((entry) => Number(entry.id) === Number(id))?.academic_title || '—' }
function unitName(id) { const item = units.value.find((entry) => Number(entry.id) === Number(id)); return item?.short_name || item?.name || '—' }
function display(field, value) { if (field === 'staff_member_id') return staffName(value); if (field === 'organizational_unit_id') return unitName(value); return value === null || value === undefined || value === '' ? '—' : value }
function formatPercent(value) { const number = Number(value); return Number.isFinite(number) ? Math.round(number) : 0 }
function optional(value, kind) { if (value === '' || value === null || value === undefined) return null; return kind === 'number' ? Number(value) : String(value).trim() || null }
function message(exception, fallback) { return exception.response?.data?.errors?.join(' ') || exception.response?.data?.message || fallback }
function toast(text) { success.value = text; setTimeout(() => { success.value = '' }, 3500) }
function selectReport() { selected.value = reports.value.find((item) => Number(item.reporting_period_id) === Number(periodId.value)) || null; cancel() }
async function createReport() { if (!periodId.value) return; saving.value = true; try { const response = await api.post('/api/sabbaticals/reports', { reporting_period_id: Number(periodId.value), monitoring_period: periods.value.find((item) => Number(item.id) === Number(periodId.value))?.label || null, created_by: userId, updated_by: userId }); reports.value.unshift(response.data); selected.value = response.data; toast('Izvješće uspješno je kreirano.') } catch (exception) { error.value = message(exception, 'Izvješće nije moguće kreirati.') } finally { saving.value = false } }
async function deleteReport() { if (!selected.value || !confirm('Želite li izbrisati izvješće i sve povezane zapise?')) return; saving.value = true; try { const id = selected.value.id; await api.delete(`/api/sabbaticals/reports/${id}`); reports.value = reports.value.filter((item) => item.id !== id); selected.value = null; toast('Izvješće uspješno je izbrisano.') } catch (exception) { error.value = message(exception, 'Izvješće nije moguće izbrisati.') } finally { saving.value = false } }
function empty(type) { const result = Object.fromEntries(configs[type].fields.map(([field,,kind]) => [field, kind === 'number' && type === 'users' ? 0 : ''])); return result }
function add(type) { activeType.value = type; activeId.value = 'new'; form.value = empty(type); error.value = '' }
function selectRow(type, id) { activeType.value = type; activeId.value = id; form.value = null; error.value = '' }
function edit(type) { const item = rows(type).find((entry) => entry.id === activeId.value); if (!item) return; activeType.value = type; form.value = { ...item } }
function cancel() { activeType.value = ''; activeId.value = null; form.value = null }
async function save(type) {
  const config = configs[type]
  if ((type === 'users' && !form.value.staff_member_id) || (type === 'papers' && (!String(form.value.authors).trim() || !String(form.value.paper_title).trim())) || (type === 'monographs' && (!String(form.value.authors).trim() || !String(form.value.monograph_title).trim()))) { error.value = 'Popunite obavezna polja.'; return }
  saving.value = true; error.value = ''; const payload = { updated_by: userId }
  for (const [field,,kind] of config.fields) payload[field] = optional(form.value[field], kind)
  if (type === 'users') { for (const field of ['q1_paper_count','q2_paper_count','other_paper_count','monograph_count']) payload[field] = Number(payload[field] || 0); payload.total_paper_count = payload.q1_paper_count + payload.q2_paper_count + payload.other_paper_count }
  try { const response = activeId.value === 'new' ? await api.post(`/api/sabbaticals/${config.endpoint}`, { ...payload, report_id: selected.value.id, created_by: userId }) : await api.patch(`/api/sabbaticals/${config.endpoint}/${activeId.value}`, payload); const index = config.source.value.findIndex((item) => item.id === response.data.id); if (index >= 0) config.source.value[index] = response.data; else config.source.value.push(response.data); await refreshSummary(); activeType.value = type; activeId.value = response.data.id; form.value = null; toast('Zapis uspješno je spremljen.') } catch (exception) { error.value = message(exception, 'Zapis nije moguće spremiti.') } finally { saving.value = false }
}
async function remove(type) { const config = configs[type], item = rows(type).find((entry) => entry.id === activeId.value); if (!item || !confirm('Želite li izbrisati odabrani zapis?')) return; saving.value = true; try { await api.delete(`/api/sabbaticals/${config.endpoint}/${item.id}`); config.source.value = config.source.value.filter((entry) => entry.id !== item.id); cancel(); await refreshSummary(); toast('Zapis uspješno je izbrisan.') } catch (exception) { error.value = message(exception, 'Zapis nije moguće izbrisati.') } finally { saving.value = false } }
async function refreshSummary() { if (!selected.value) return; try { const response = await api.get(`/api/sabbaticals/summary/${selected.value.id}`); const index = summaries.value.findIndex((item) => Number(item.report_id) === Number(selected.value.id)); if (index >= 0) summaries.value[index] = response.data; else summaries.value.push(response.data) } catch (exception) { if (exception.response?.status !== 404) throw exception } }
async function load() { try { const responses = await Promise.all([api.get('/api/sabbaticals/reports'), api.get('/api/reporting-periods'), api.get('/api/staff-members'), api.get('/api/organizational-units'), api.get('/api/sabbaticals/users'), api.get('/api/sabbaticals/papers'), api.get('/api/sabbaticals/monographs'), api.get('/api/sabbaticals/summary')]); [reports.value, periods.value, staff.value, units.value, users.value, papers.value, monographs.value, summaries.value] = responses.map((response) => response.data); periodId.value = periods.value[0]?.id ?? null; selectReport() } catch (exception) { error.value = message(exception, 'Podatke nije moguće dohvatiti.') } finally { loading.value = false } }
watch(periodId, selectReport); onMounted(load)
</script>

<template>
  <main class="view">
    <nav class="breadcrumbs"><RouterLink to="/nastava-i-kvaliteta">Nastava i kvaliteta</RouterLink><span>›</span><span>Znanstvena produktivnost</span></nav>
    <h1>Izvješće o znanstvenoj produktivnosti tijekom slobodne studijske godine</h1>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!loading">
      <section class="selectors export-row">
        <label>Razdoblje praćenja<select v-model.number="periodId"><option v-for="period in periods" :key="period.id" :value="period.id">{{ period.label }}</option></select></label>
        <button v-if="selected" class="delete-report" @click="deleteReport">Izbriši izvješće</button>
        <ExportButton :records="[...rows('users').map((item) => ({ vrsta_zapisa: 'Korisnik slobodne studijske godine', ...item })), ...rows('papers').map((item) => ({ vrsta_zapisa: 'Q1/Q2 rad', ...item })), ...rows('monographs').map((item) => ({ vrsta_zapisa: 'Monografija', ...item }))]" file-name="znanstvena-produktivnost" />
      </section>
      <section v-if="!selected" class="empty-report"><div><h2>Izvješće još nije kreirano</h2><p>Za odabrano razdoblje nema podataka.</p></div><button @click="createReport">Kreiraj izvješće</button></section>

      <template v-else>
        <section class="summary">
          <div><span>Ukupan broj korisnika</span><strong>{{ selectedSummary?.sabbatical_user_count ?? 0 }}</strong></div>
          <div><span>Korisnici s Q1/Q2 radom</span><strong>{{ selectedSummary?.users_with_q1_q2 ?? 0 }}</strong></div>
          <div><span>Uspješnost (Q1/Q2)</span><strong>{{ formatPercent(selectedSummary?.success_percent) }} %</strong></div>
          <div><span>Objavljene znanstvene monografije</span><strong>{{ selectedSummary?.monograph_count ?? 0 }}</strong></div>
        </section>

        <section v-for="(config,type) in configs" :key="type" class="data-section">
          <header>
            <h2>{{ config.title }}</h2>
            <div class="toolbar">
              <template v-if="activeType === type && form"><button @click="save(type)">Spremi</button><button @click="cancel">Odustani</button></template>
              <button v-else :disabled="activeType !== type || !activeId" @click="edit(type)">Uredi</button>
              <button class="square" :disabled="Boolean(form)" @click="add(type)">+</button>
              <button class="square" :disabled="activeType !== type || !activeId || Boolean(form)" @click="remove(type)">−</button>
            </div>
          </header>

          <div class="editable-table-wrap">
            <table class="editable-table" :class="`table-${type}`">
              <thead><tr><th>Broj</th><template v-for="field in config.fields" :key="field[0]"><th>{{ field[1] }}</th><th v-if="type === 'users' && field[0] === 'staff_member_id'">Zvanje</th></template><th v-if="type === 'users'">Ukupno radova</th></tr></thead>
              <tbody>
                <tr v-if="activeType === type && activeId === 'new'" class="editing-row">
                  <td>Novi</td>
                  <template v-for="field in config.fields" :key="field[0]">
                    <td>
                      <select v-if="field[2] === 'staff'" v-model="form[field[0]]"><option value="">Odaberite</option><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select>
                      <select v-else-if="field[2] === 'unit'" v-model="form[field[0]]"><option value="">Bez sastavnice</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select>
                      <select v-else-if="field[2] === 'quartile'" v-model="form[field[0]]"><option value="">Odaberite</option><option>Q1</option><option>Q2</option></select>
                      <textarea v-else-if="field[2] === 'area'" v-model="form[field[0]]" rows="2"></textarea>
                      <input v-else v-model="form[field[0]]" :type="field[2]">
                    </td>
                    <td v-if="type === 'users' && field[0] === 'staff_member_id'" class="derived-cell">{{ staffTitle(form.staff_member_id) }}</td>
                  </template>
                  <td v-if="type === 'users'" class="derived-cell">{{ Number(form.q1_paper_count || 0) + Number(form.q2_paper_count || 0) + Number(form.other_paper_count || 0) }}</td>
                </tr>

                <tr v-for="(item,index) in rows(type)" :key="item.id" :class="{ selected: activeType === type && activeId === item.id }" @click="selectRow(type, item.id)">
                  <td>{{ index + 1 }}</td>
                  <template v-for="field in config.fields" :key="field[0]">
                    <td v-if="activeType === type && activeId === item.id && form">
                      <select v-if="field[2] === 'staff'" v-model="form[field[0]]" @click.stop><option v-for="member in staff" :key="member.id" :value="member.id">{{ member.first_name }} {{ member.last_name }}</option></select>
                      <select v-else-if="field[2] === 'unit'" v-model="form[field[0]]" @click.stop><option value="">Bez sastavnice</option><option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.short_name || unit.name }}</option></select>
                      <select v-else-if="field[2] === 'quartile'" v-model="form[field[0]]" @click.stop><option value="">Odaberite</option><option>Q1</option><option>Q2</option></select>
                      <textarea v-else-if="field[2] === 'area'" v-model="form[field[0]]" rows="2" @click.stop></textarea>
                      <input v-else v-model="form[field[0]]" :type="field[2]" @click.stop>
                    </td>
                    <td v-else><a v-if="['doi_or_link','link_or_reviews'].includes(field[0]) && item[field[0]]" :href="item[field[0]]" target="_blank" rel="noopener" @click.stop>{{ item[field[0]] }}</a><template v-else>{{ display(field[0], item[field[0]]) }}</template></td>
                    <td v-if="type === 'users' && field[0] === 'staff_member_id'" class="derived-cell">{{ staffTitle(activeType === type && activeId === item.id && form ? form.staff_member_id : item.staff_member_id) }}</td>
                  </template>
                  <td v-if="type === 'users'" class="derived-cell">{{ activeType === type && activeId === item.id && form ? Number(form.q1_paper_count || 0) + Number(form.q2_paper_count || 0) + Number(form.other_paper_count || 0) : item.total_paper_count }}</td>
                </tr>
                <tr v-if="!rows(type).length && !(activeType === type && activeId === 'new')"><td :colspan="config.fields.length + 1 + (type === 'users' ? 2 : 0)" class="empty-cell">Nema zapisa.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
    <div v-if="success" class="snackbar">{{ success }}</div>
  </main>
</template>

<style scoped>
.view{min-height:calc(100vh - 112px);padding:34px clamp(24px,5vw,110px) 90px;background:rgb(var(--v-theme-background));color:rgb(var(--v-theme-on-background))}.breadcrumbs,.report-bar,.data-section header,.toolbar{display:flex;align-items:center}.breadcrumbs{gap:10px;color:rgb(var(--v-theme-muted))}.breadcrumbs a{color:inherit;text-decoration:none}h1{max-width:1050px;margin:18px 0 36px;color:rgb(var(--v-theme-primary));font-size:clamp(1.5rem,1.7vw,2.4rem);font-weight:400;line-height:1.35}.selectors{display:flex;align-items:flex-start}.selectors label,.form-grid label{display:grid;gap:7px;color:rgb(var(--v-theme-primary));font-weight:700}.selectors label,.selectors select{width:240px}.selectors select{min-width:0}.selectors select,input,textarea,.card select{box-sizing:border-box;width:100%;min-height:44px;padding:10px 12px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit}.empty-report,.report-bar{justify-content:space-between;gap:24px;margin-top:30px;padding:24px;border:1px solid rgb(var(--v-theme-category-border));border-radius:10px;background:rgb(var(--v-theme-surface))}.empty-report{display:flex;align-items:center}.empty-report p{margin:6px 0}.empty-report button,.report-bar button,.report-actions button,.toolbar button{height:34px;padding:0 13px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}.report-actions{display:flex;justify-content:flex-end;margin-top:18px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(20px,3vw,48px);overflow:visible;margin-top:38px;border:0;border-radius:0;background:transparent}.summary>div{display:grid;gap:10px;padding:0;background:transparent}.summary span{color:rgb(var(--v-theme-primary));font-weight:700}.summary strong{font-size:1.35rem}.data-section{margin-top:58px}.data-section header{justify-content:space-between;gap:22px;margin-bottom:15px}.data-section h2{margin:0;font-size:1.4rem;font-weight:400}.toolbar{gap:7px}.toolbar .square{width:34px;padding:0;font-size:1.1rem}.toolbar button:disabled{cursor:not-allowed;opacity:.45}.editable-table-wrap{overflow-x:auto;border-radius:10px}.editable-table{width:100%;min-width:1100px;border-collapse:collapse}.editable-table th,.editable-table td{padding:12px 10px;border:1px solid rgb(var(--v-theme-table-border));overflow-wrap:break-word;text-align:left;vertical-align:top;white-space:pre-line}.editable-table th:first-child,.editable-table td:first-child{width:52px;min-width:52px;white-space:nowrap}.table-users th:nth-child(3),.table-users td:nth-child(3){min-width:105px}.table-users th:last-child,.table-users td:last-child{min-width:105px}.table-papers th:nth-child(5),.table-papers td:nth-child(5),.table-papers th:nth-child(6),.table-papers td:nth-child(6){min-width:72px;white-space:nowrap}.editable-table th{background:rgb(var(--v-theme-category-card));color:rgb(var(--v-theme-on-category-card));font-size:.78rem}.editable-table td{font-size:.8rem}.editable-table tbody tr:not(.editing-row){cursor:pointer}.editable-table tbody tr:hover,.editable-table tbody tr.selected{background:rgba(var(--v-theme-primary),.1)}.editable-table input,.editable-table select,.editable-table textarea{box-sizing:border-box;display:block;width:100%;min-width:120px;max-width:100%;min-height:38px;padding:8px 9px;border:1px solid rgb(var(--v-theme-table-border));border-radius:6px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));font:inherit;font-size:.78rem}.editable-table textarea{resize:vertical}.derived-cell{color:rgb(var(--v-theme-muted))}.empty-cell{text-align:center!important;color:rgb(var(--v-theme-muted))}.error{color:rgb(var(--v-theme-error))}.snackbar{position:fixed;right:28px;bottom:28px;padding:14px 18px;border:1px solid #62a957;border-radius:7px;background:#b8f5ae;color:#1f5525}@media(max-width:1000px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.report-bar,.empty-report,.data-section header{align-items:stretch;flex-direction:column}.selectors label,.selectors select{width:100%}.summary{grid-template-columns:1fr}}
.selectors{align-items:flex-end;justify-content:space-between}.selectors .delete-report{height:44px;padding:0 13px;border:1px solid rgb(var(--v-theme-category-border));border-radius:7px;background:rgb(var(--v-theme-surface));color:rgb(var(--v-theme-on-surface));cursor:pointer;font:inherit}.editable-table th{border-color:rgb(var(--v-theme-table-header-border))}.table-users{min-width:1050px;table-layout:fixed}.table-users th:nth-child(1),.table-users td:nth-child(1){width:42px}.table-users th:nth-child(2),.table-users td:nth-child(2){width:125px}.table-users th:nth-child(3),.table-users td:nth-child(3){width:90px;min-width:90px}.table-users th:nth-child(4),.table-users td:nth-child(4){width:90px}.table-users th:nth-child(5),.table-users td:nth-child(5){width:115px}.table-users th:nth-child(6),.table-users td:nth-child(6),.table-users th:nth-child(7),.table-users td:nth-child(7){width:65px}.table-users th:nth-child(8),.table-users td:nth-child(8),.table-users th:nth-child(9),.table-users td:nth-child(9){width:75px}.table-users th:nth-child(10),.table-users td:nth-child(10){width:90px}.table-users th:nth-child(11),.table-users td:nth-child(11){width:145px}.table-users th:nth-child(12),.table-users td:nth-child(12){width:85px;min-width:85px}.table-users input,.table-users select,.table-users textarea{min-width:0;padding-right:7px;padding-left:7px}@media(max-width:650px){.selectors{align-items:stretch;flex-direction:column;gap:14px}.selectors .delete-report{align-self:flex-start}}
</style>
