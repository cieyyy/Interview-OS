<script setup lang="ts">
import { Layers3 } from '@lucide/vue';

defineProps<{ title: string; description: string; action?: string; testId?: string }>();
defineEmits<{ action: [] }>();
</script>

<template>
  <div class="empty-state" :data-testid="testId">
    <div class="empty-mark"><Layers3 :size="24" :stroke-width="1.7" aria-hidden="true" /></div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <button v-if="action" class="button primary" type="button" @click="$emit('action')">{{ action }}</button>
  </div>
</template>
