<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue';

withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'default' | 'small';
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
}>(), { type: 'button', variant: 'primary', size: 'default', block: false, disabled: false, loading: false });
</script>

<template>
  <button
    class="ui-button"
    :class="[`ui-button--${variant}`, { 'ui-button--small': size === 'small', 'ui-button--block': block }]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle v-if="loading" class="spin" :size="16" aria-hidden="true" />
    <slot />
  </button>
</template>
