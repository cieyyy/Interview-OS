<script setup lang="ts">
export interface SelectOption { value: string | number; label: string; disabled?: boolean }
withDefaults(defineProps<{ label: string; options: SelectOption[]; description?: string; error?: string }>(), { description: '', error: '' });
const model = defineModel<string | number>({ required: true });
</script>

<template>
  <label class="ui-field">
    <span>{{ label }}</span>
    <select v-model="model" class="ui-control" :aria-invalid="Boolean(error) || undefined">
      <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
    </select>
    <small v-if="description" class="ui-field__description">{{ description }}</small>
    <small v-if="error" class="ui-field__error" role="alert">{{ error }}</small>
  </label>
</template>
