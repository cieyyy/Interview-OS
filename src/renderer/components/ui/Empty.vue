<script setup lang="ts">
import { Layers3 } from '@lucide/vue';
defineProps<{ title: string; description: string }>();
</script>
<template><div class="ui-empty"><slot name="icon"><Layers3 :size="28" aria-hidden="true" /></slot><h3>{{ title }}</h3><p>{{ description }}</p><slot /></div></template>
