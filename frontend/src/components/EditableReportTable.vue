<script setup>
import { computed, ref, watch } from 'vue'
import api from '../services/api.js'
import { currentUser } from '../services/auth.js'

const props = defineProps({
  config: { type: Object, required: true },
  reportId: { type: Number, required: true },
  rows: { type: Array, default: () => [] },
})

const emit = defineEmits(['changed', 'deleted'])
const userId = Number(currentUser.value?.id)
const editing = ref(false)
const saving = ref(false)
const error = ref('')
const draft = ref([])
const deletedIds = ref([])
const selectedIndex = ref(null)

watch(
  () => props.rows,
  (rows) => {
    if (!editing.value) draft.value = clone(rows)
  },
  { immediate: true, deep: true },
)

const visibleRows = computed(() => (editing.value ? draft.value : props.rows))
const editableFields = computed(() =>
  props.config.fields.filter((field) => field.type !== 'computed'),
)

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? []))
}

function display(field, row) {
  if (field.type === 'computed') {
    return field.sum.reduce((total, key) => total + Number(row[key] || 0), 0)
  }
  const value = row[field.name]
  if (value === null || value === undefined || value === '') return '—'
  if (field.type === 'date') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('hr-HR').format(date)
  }
  if (field.type === 'select')
    return field.options.find((item) => item.value === value)?.label || value
  return value
}

function beginEdit() {
  if (props.rows.length === 0) return
  draft.value = clone(props.rows)
  deletedIds.value = []
  selectedIndex.value = null
  error.value = ''
  editing.value = true
}

function cancel() {
  editing.value = false
  draft.value = clone(props.rows)
  deletedIds.value = []
  selectedIndex.value = null
  error.value = ''
}

function blankRow() {
  return Object.fromEntries(
    editableFields.value.map((field) => [field.name, field.type === 'number' ? 0 : '']),
  )
}

function addRow() {
  if (!editing.value) {
    draft.value = clone(props.rows)
    deletedIds.value = []
    selectedIndex.value = null
    error.value = ''
    editing.value = true
  }
  draft.value.push(blankRow())
  selectedIndex.value = draft.value.length - 1
}

async function removeRow() {
  if (selectedIndex.value === null) return
  const source = editing.value ? draft.value : props.rows
  const row = source[selectedIndex.value]
  if (!row) return

  if (!row.id) {
    draft.value.splice(selectedIndex.value, 1)
    selectedIndex.value = null
    return
  }

  if (!window.confirm('Želite li izbrisati odabrani zapis?')) return

  saving.value = true
  error.value = ''
  try {
    await api.delete(`/api/faculty/${props.config.endpoint}/${row.id}`)
    const remainingRows = props.rows.filter((item) => Number(item.id) !== Number(row.id))
    if (editing.value)
      draft.value = draft.value.filter((item) => Number(item.id) !== Number(row.id))
    selectedIndex.value = null
    emit('changed', remainingRows)
    emit('deleted')
  } catch (exception) {
    error.value = apiError(exception)
  } finally {
    saving.value = false
  }
}

function normalize(field, value) {
  if (field.type === 'number') return value === '' || value === null ? null : Number(value)
  return String(value ?? '').trim() || null
}

function validate() {
  for (const [index, row] of draft.value.entries()) {
    for (const field of editableFields.value) {
      if (
        field.required &&
        (row[field.name] === null ||
          row[field.name] === undefined ||
          String(row[field.name]).trim() === '')
      ) {
        return `Redak ${index + 1}: polje „${field.label}” je obavezno.`
      }
    }
  }
  return ''
}

function apiError(exception) {
  const errors = exception.response?.data?.errors
  return Array.isArray(errors)
    ? errors.join(' ')
    : exception.response?.data?.message || 'Podatke nije moguće spremiti.'
}

async function save() {
  error.value = validate()
  if (error.value) return
  saving.value = true
  try {
    for (const id of deletedIds.value)
      await api.delete(`/api/faculty/${props.config.endpoint}/${id}`)
    const saved = []
    for (const row of draft.value) {
      const payload = Object.fromEntries(
        editableFields.value.map((field) => [field.name, normalize(field, row[field.name])]),
      )
      payload.faculty_report_id = props.reportId
      payload.updated_by = userId
      if (row.id) {
        const response = await api.patch(`/api/faculty/${props.config.endpoint}/${row.id}`, payload)
        saved.push(response.data)
      } else {
        payload.created_by = userId
        const response = await api.post(`/api/faculty/${props.config.endpoint}`, payload)
        saved.push(response.data)
      }
    }
    editing.value = false
    selectedIndex.value = null
    deletedIds.value = []
    emit('changed', saved)
  } catch (exception) {
    error.value = apiError(exception)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="report-table-block">
    <div class="report-table-heading no-print">
      <h3>{{ config.title }}</h3>
      <div class="table-actions">
        <template v-if="editing">
          <button type="button" :disabled="saving" @click="save">
            {{ saving ? 'Spremanje…' : 'Spremi' }}
          </button>
          <button type="button" :disabled="saving" @click="cancel">Odustani</button>
        </template>
        <button v-else type="button" :disabled="rows.length === 0" @click="beginEdit">Uredi</button>
        <button type="button" aria-label="Dodaj redak" title="Dodaj redak" @click="addRow">
          +
        </button>
        <button
          type="button"
          aria-label="Ukloni odabrani redak"
          title="Ukloni odabrani redak"
          :disabled="selectedIndex === null || saving"
          @click="removeRow"
        >
          −
        </button>
      </div>
    </div>

    <h3 class="print-only">{{ config.title }}</h3>
    <div class="report-table-wrap">
      <table class="report-data-table">
        <thead>
          <tr>
            <th class="number-column">Broj</th>
            <th v-for="field in config.fields" :key="field.name">{{ field.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="visibleRows.length === 0">
            <td :colspan="config.fields.length + 1" class="empty-row">Nema unesenih podataka.</td>
          </tr>
          <tr
            v-for="(row, index) in visibleRows"
            v-else
            :key="row.id || `new-${index}`"
            :class="{ selected: selectedIndex === index }"
            @click="selectedIndex = index"
          >
            <td class="number-column">{{ index + 1 }}</td>
            <td v-for="field in config.fields" :key="field.name">
              <template v-if="editing && field.type !== 'computed'">
                <select
                  v-if="field.type === 'select'"
                  v-model="row[field.name]"
                  class="table-control"
                >
                  <option value="">Odaberite</option>
                  <option v-for="option in field.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <textarea
                  v-else-if="field.type === 'textarea'"
                  v-model="row[field.name]"
                  class="table-control table-textarea"
                  rows="2"
                />
                <input
                  v-else
                  v-model="row[field.name]"
                  class="table-control"
                  :type="field.type === 'url' ? 'url' : field.type"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                />
              </template>
              <a
                v-else-if="field.type === 'url' && row[field.name]"
                :href="row[field.name]"
                target="_blank"
                rel="noopener"
                >{{ row[field.name] }}</a
              >
              <span v-else>{{ display(field, row) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="error" class="table-error no-print">{{ error }}</p>
  </section>
</template>

<style scoped>
.report-table-block {
  margin-top: 34px;
  break-inside: avoid;
}
.report-table-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 12px;
}
h3 {
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
  font-size: 1.15rem;
  font-weight: 500;
}
.table-actions {
  display: flex;
  gap: 8px;
}
.table-actions button {
  min-height: 38px;
  padding: 7px 15px;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 7px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  font: inherit;
}
.table-actions button:last-child,
.table-actions button:nth-last-child(2) {
  min-width: 38px;
  padding-inline: 10px;
}
.table-actions button:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.1);
}
.table-actions button:disabled {
  cursor: default;
  opacity: 0.4;
}
.report-table-wrap {
  overflow-x: auto;
  border: 1px solid rgb(var(--v-theme-category-border));
  border-radius: 9px;
}
.report-data-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  table-layout: auto;
  background: rgb(var(--v-theme-surface));
}
th,
td {
  min-width: 120px;
  padding: 12px 14px;
  border-right: 1px solid rgb(var(--v-theme-table-border));
  border-bottom: 1px solid rgb(var(--v-theme-table-border));
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}
th:last-child,
td:last-child {
  border-right: 0;
}
tbody tr:last-child td {
  border-bottom: 0;
}
th {
  border-color: rgb(var(--v-theme-table-header-border));
  background: rgb(var(--v-theme-category-card));
  color: rgb(var(--v-theme-on-category-card));
  font-weight: 700;
  white-space: nowrap;
  overflow-wrap: normal;
}
.number-column {
  width: 58px;
  min-width: 58px;
}
tbody tr.selected td {
  background: rgba(var(--v-theme-primary), 0.12);
}
tbody tr:not(.editing-row) {
  cursor: pointer;
}
.empty-row {
  padding: 26px;
  color: rgb(var(--v-theme-muted));
  text-align: center;
}
.table-control {
  width: 100%;
  min-width: 90px;
  min-height: 42px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
}
.table-textarea {
  min-height: 70px;
  resize: vertical;
}
a {
  color: rgb(var(--v-theme-evidence-link));
  text-decoration: underline;
}
.table-error {
  margin: 9px 0 0;
  color: rgb(var(--v-theme-error));
}
.print-only {
  display: none;
}
@media print {
  .no-print {
    display: none !important;
  }
  .print-only {
    display: block;
    margin-bottom: 8px;
  }
  .report-table-block {
    margin-top: 18px;
  }
  .report-table-wrap {
    overflow: visible;
    border-color: #aaa;
    border-radius: 0;
  }
  .report-data-table {
    min-width: 0;
    table-layout: fixed;
    font-size: 8.5pt;
  }
  th,
  td {
    min-width: 0;
    padding: 5px 6px;
    border-color: #bbb;
  }
  th {
    background: #eee !important;
    color: #111 !important;
    white-space: normal;
    overflow-wrap: anywhere;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .number-column {
    width: 28px;
    min-width: 28px;
  }
  a {
    color: #111;
  }
}
</style>
