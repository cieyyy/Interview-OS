<script setup lang="ts">
import { computed, ref } from 'vue';
import { Code2, Eye, PencilLine } from '@lucide/vue';

withDefaults(defineProps<{ label?: string; placeholder?: string; minHeight?: number; testId?: string }>(), {
  label: 'Markdown 内容', placeholder: '使用 Markdown 记录内容，输入 [[知识标题]] 建立双向链接。', minHeight: 320, testId: undefined
});
const model = defineModel<string>({ required: true });
const mode = ref<'write' | 'preview'>('write');

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function inline(value: string): string {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gu, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gu, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/gu, (_match, title: string, alias?: string) => `<mark class="markdown-wikilink">${alias ?? title}</mark>`)
    .replace(/`([^`]+)`/gu, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/gu, '<em>$1</em>');
}

function renderMarkdown(value: string): string {
  const lines = String(value ?? '').replace(/\r/g, '').split('\n');
  const output: string[] = [];
  let inCode = false;
  let code: string[] = [];
  let list: 'ul' | 'ol' | undefined;
  const closeList = (): void => { if (list) output.push(`</${list}>`); list = undefined; };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^```/.test(line.trim())) {
      closeList();
      if (inCode) { output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = []; }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const tableHeader = line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1]);
    if (tableHeader) {
      closeList();
      const rows: string[][] = [];
      const header = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      index += 2;
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(lines[index].split('|').map((cell) => cell.trim()).filter(Boolean));
        index += 1;
      }
      index -= 1;
      output.push(`<div class="markdown-table-wrap"><table><thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/u);
    if (heading) { closeList(); const level = heading[1].length; output.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/u);
    if (unordered) { if (list !== 'ul') { closeList(); list = 'ul'; output.push('<ul>'); } output.push(`<li>${inline(unordered[1])}</li>`); continue; }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/u);
    if (ordered) { if (list !== 'ol') { closeList(); list = 'ol'; output.push('<ol>'); } output.push(`<li>${inline(ordered[1])}</li>`); continue; }
    closeList();
    if (!line.trim()) output.push('<br>');
    else output.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (inCode) output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return output.join('');
}

const rendered = computed(() => renderMarkdown(model.value));
</script>

<template>
  <div class="markdown-editor">
    <div class="markdown-editor__toolbar"><strong><Code2 :size="16" />{{ label }}</strong><div class="segmented"><button type="button" :class="{ active: mode === 'write' }" @click="mode = 'write'"><PencilLine :size="14" />编辑</button><button type="button" :class="{ active: mode === 'preview' }" @click="mode = 'preview'"><Eye :size="14" />预览</button></div></div>
    <textarea v-if="mode === 'write'" v-model="model" class="ui-control markdown-editor__input" :style="{ minHeight: `${minHeight}px` }" :placeholder="placeholder" :data-testid="testId"></textarea>
    <div v-else class="markdown-preview" :style="{ minHeight: `${minHeight}px` }" v-html="rendered"></div>
  </div>
</template>
