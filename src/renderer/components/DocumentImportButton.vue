<script setup lang="ts">
import { ref } from 'vue';
import { LoaderCircle, Upload } from '@lucide/vue';
import type { DocumentImportResult, DocumentImportTarget } from '../../shared/domain';
import { useWorkspace } from '../composables/useWorkspace';

const props = withDefaults(defineProps<{
  target: DocumentImportTarget;
  label?: string;
  testId?: string;
}>(), { label: '上传图片 / 文件', testId: 'document-import' });
const emit = defineEmits<{ imported: [result: DocumentImportResult] }>();
const { importDocument } = useWorkspace();
const busy = ref(false);

async function choose(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    const result = await importDocument(props.target);
    if (result) emit('imported', result);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <button
    class="button secondary import-button"
    type="button"
    :disabled="busy"
    :data-testid="testId"
    @click="choose"
  >
    <LoaderCircle v-if="busy" class="spin" :size="15" aria-hidden="true" />
    <Upload v-else :size="15" aria-hidden="true" />
    {{ busy ? '正在识别…' : label }}
  </button>
</template>
