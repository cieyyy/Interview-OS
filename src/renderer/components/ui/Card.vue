<script setup lang="ts">
withDefaults(defineProps<{ flat?: boolean }>(), { flat: false });
</script>

<template><article class="ui-card" :class="{ 'ui-card--flat': flat }"><slot /></article></template>
