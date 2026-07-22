<script setup lang="ts">
import UiPageHeader from './ui/PageHeader.vue';
defineProps<{ title: string; description: string; eyebrow?: string }>();
</script>

<template><UiPageHeader :title="title" :description="description" :eyebrow="eyebrow"><slot /></UiPageHeader></template>
