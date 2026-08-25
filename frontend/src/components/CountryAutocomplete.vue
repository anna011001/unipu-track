<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [Number, String], default: '' },
  countries: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Odaberite državu' },
})

const emit = defineEmits(['update:modelValue', 'change'])

const items = computed(() => props.countries.map((country) => ({
  value: country.id,
  title: country.name_hr || country.name_en,
})))

function update(value) {
  emit('update:modelValue', value ?? '')
  emit('change', value ?? '')
}
</script>

<template>
  <v-autocomplete
    class="country-autocomplete"
    :model-value="modelValue"
    :items="items"
    item-title="title"
    item-value="value"
    :disabled="disabled"
    :placeholder="placeholder"
    variant="outlined"
    density="compact"
    hide-details
    clearable
    autocomplete="off"
    :menu-props="{ maxHeight: 320 }"
    @update:model-value="update"
  />
</template>

<style scoped>
.country-autocomplete {
  box-sizing: border-box;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100%;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}

:deep(.v-field) {
  min-height: 44px;
  border-radius: 7px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

:deep(.v-field__outline) {
  color: rgb(var(--v-theme-category-border));
  --v-field-border-opacity: 1;
}

:deep(.v-field--focused .v-field__outline) {
  color: rgb(var(--v-theme-category-border));
  --v-field-border-opacity: 1;
}

:deep(.v-field__input) {
  min-height: 44px;
  padding-right: 12px;
  padding-left: 14px;
  padding-top: 7px;
  padding-bottom: 7px;
}

:deep(.v-field__input input::placeholder) {
  color: rgb(var(--v-theme-muted));
  opacity: 1;
}

:deep(.v-autocomplete__selection),
:deep(.v-field__append-inner) {
  color: rgb(var(--v-theme-on-surface));
}
</style>
