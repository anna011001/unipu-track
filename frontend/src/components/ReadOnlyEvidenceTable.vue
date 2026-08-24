<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  records: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  route: { type: String, required: true },
})

const technicalFields = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by',
  'reporting_period_id', 'organizational_unit_id', 'staff_member_id',
  'country_id', 'organization_id', 'host_organization_id', 'record_file_id',
])

const shownColumns = computed(() => {
  const available = new Set(props.records.flatMap((record) => Object.keys(record)))
  const configured = props.columns.filter((column) => available.has(column.key))
  if (configured.length) return configured
  return [...available]
    .filter((key) => !technicalFields.has(key) && !key.endsWith('_id'))
    .slice(0, 7)
    .map((key) => ({ key, label: key.replaceAll('_', ' ') }))
})

function display(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Da' : 'Ne'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat('hr-HR').format(date)
  }
  return value
}
</script>

<template>
  <section class="evidence-table-block">
    <div class="evidence-heading">
      <h4>{{ title }}</h4>
      <RouterLink class="source-link no-print" :to="route" target="_blank" rel="noopener">Otvori evidenciju</RouterLink>
    </div>
    <div class="evidence-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Broj</th>
            <th v-for="column in shownColumns" :key="column.key">{{ column.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="records.length === 0">
            <td :colspan="shownColumns.length + 1" class="empty">Nema zapisa.</td>
          </tr>
          <tr v-for="(record, index) in records" v-else :key="record.id || index">
            <td>{{ index + 1 }}</td>
            <td v-for="column in shownColumns" :key="column.key">{{ display(record[column.key]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.evidence-table-block { margin-top: 22px; break-inside: avoid; }
.evidence-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
h4 { margin: 0; font-size: 1.05rem; font-weight: 500; }
.source-link { color: rgb(var(--v-theme-evidence-link)); text-decoration: underline; }
.evidence-table-wrap { overflow-x: auto; border: 1px solid rgb(var(--v-theme-category-border)); border-radius: 9px; }
table { width: 100%; min-width: 720px; border-collapse: collapse; background: rgb(var(--v-theme-surface)); }
th, td { padding: 10px 12px; border-right: 1px solid rgb(var(--v-theme-table-border)); border-bottom: 1px solid rgb(var(--v-theme-table-border)); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th:last-child, td:last-child { border-right: 0; }
tbody tr:last-child td { border-bottom: 0; }
th { border-color: rgb(var(--v-theme-table-header-border)); background: rgb(var(--v-theme-category-card)); color: rgb(var(--v-theme-on-category-card)); white-space: nowrap; overflow-wrap: normal; }
.empty { padding: 22px; color: rgb(var(--v-theme-muted)); text-align: center; }
@media print {
  .no-print { display: none !important; }
  .evidence-table-block { margin-top: 5mm; }
  .evidence-table-wrap { overflow: visible; border-radius: 0; border-color: #aaa; }
  table { min-width: 0; table-layout: fixed; font-size: 8pt; }
  th, td { padding: 4px 5px; border-color: #bbb; }
  th { background: #eee !important; color: #111 !important; white-space: normal; overflow-wrap: anywhere; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
