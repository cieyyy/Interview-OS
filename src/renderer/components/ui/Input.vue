<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  type?: string;
  placeholder?: string;
  description?: string;
  error?: string;
  required?: boolean;
}>(), { type: 'text', placeholder: '', description: '', error: '', required: false });
const model = defineModel<string | number>({ required: true });
</script>

<template>
  <label class="ui-field">
    <span>{{ label }}</span>
    <input v-model="model" class="ui-control" :type="type" :placeholder="placeholder" :required="required" :aria-invalid="Boolean(error) || undefined" />
    <small v-if="description" class="ui-field__description">{{ description }}</small>
    <small v-if="error" class="ui-field__error" role="alert">{{ error }}</small>
  </label>
</template>
