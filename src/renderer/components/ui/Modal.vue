<script setup lang="ts">
import { X } from '@lucide/vue';
defineProps<{ open: boolean; title: string }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ui-modal-overlay" role="presentation" @click.self="$emit('close')">
      <section class="ui-modal" role="dialog" aria-modal="true" :aria-label="title">
        <header class="ui-modal__header"><h2>{{ title }}</h2><button class="icon-button" type="button" aria-label="关闭" @click="$emit('close')"><X :size="18" /></button></header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
