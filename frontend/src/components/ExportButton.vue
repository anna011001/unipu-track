<script setup>
const props = defineProps({
  records: { type: Array, default: () => [] },
  fileName: { type: String, required: true },
})

function csvValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Da' : 'Ne'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function escapeCsv(value) {
  return `"${csvValue(value).replaceAll('"', '""')}"`
}

function exportRecords() {
  if (!props.records.length) return
  const columns = [...new Set(props.records.flatMap((record) => Object.keys(record)))]
  const rows = [
    columns.map(escapeCsv).join(','),
    ...props.records.map((record) => columns.map((column) => escapeCsv(record[column])).join(',')),
  ]
  const file = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = props.fileName.endsWith('.csv') ? props.fileName : `${props.fileName}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <button class="export-button" type="button" :disabled="!records.length" @click="exportRecords">
    Izvoz
  </button>
</template>

<style scoped>
.export-button {
  flex-shrink: 0;
  margin-left: auto;
  min-height: 38px;
  padding: 8px 20px;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 7px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  cursor: pointer;
}
.export-button:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.1);
}
.export-button:disabled {
  opacity: 0.45;
  cursor: default;
}
:global(.export-row) {
  display: flex;
  align-items: flex-end;
  gap: 24px;
}
:global(.export-row > .delete-report) {
  margin-left: auto;
}
:global(.export-row > .delete-report + .export-button) {
  margin-left: 0;
}
@media (max-width: 650px) {
  .export-button {
    margin-left: 0;
  }
  :global(.export-row) {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
