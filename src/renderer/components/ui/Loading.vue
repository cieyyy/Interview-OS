<script setup lang="ts">withDefaults(defineProps<{ label?: string }>(), { label: '正在处理…' });</script>
<template><span class="ui-loading" role="status"><i class="ui-loading__spinner" aria-hidden="true"></i>{{ label }}</span></template>
