<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue';
import { Bot, DatabaseBackup, Download, HardDrive, PlugZap, Save, ShieldCheck } from '@lucide/vue';
import type { ProviderInput } from '../../shared/domain';
import ObsidianSettingsPanel from '../components/ObsidianSettingsPanel.vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, saveProvider, testProvider, createBackup, exportMarkdown } = useWorkspace();
const provider = reactive<ProviderInput>({ kind: 'openai-compatible', name: 'OpenAI Compatible', baseUrl: 'https://api.openai.com/v1', model: '', apiKey: '', enabled: false });
const testMessage = ref('');
const operationPath = ref('');
watchEffect(() => { const current = store.workspace?.settings.provider; if (current) Object.assign(provider, current, { apiKey: '' }); });
async function save(): Promise<void> { await saveProvider(provider); }
async function test(): Promise<void> { const result = await testProvider(); if (result) testMessage.value = result.message + (result.latencyMs ? ` · ${result.latencyMs}ms` : ''); }
async function backup(): Promise<void> { const result = await createBackup(); if (result) operationPath.value = result.path; }
async function exportData(): Promise<void> { const result = await exportMarkdown(); if (result) operationPath.value = result.path; }
</script>

<template>
  <section>
    <PageHeader eyebrow="CONTROL" title="设置与数据" description="你决定数据放在哪里、哪些内容可以发送给外部服务。" />
    <div class="settings-grid">
      <ObsidianSettingsPanel />
      <article class="panel settings-card"><div class="settings-heading"><div><span class="settings-icon"><HardDrive :size="18" aria-hidden="true" /></span><div><h3>本地工作区</h3><p>程序与个人内容分离保存</p></div></div><span class="status-badge completed">正常</span></div><dl><div><dt>数据目录</dt><dd data-testid="settings-data-dir">{{ store.meta?.dataDirectory ?? '读取中…' }}</dd></div><div><dt>应用版本</dt><dd>{{ store.meta?.version ?? '—' }}</dd></div></dl><div class="button-row"><button class="button secondary" type="button" data-testid="settings-backup" @click="backup"><DatabaseBackup :size="15" aria-hidden="true" />创建备份</button><button class="button secondary" type="button" data-testid="settings-export" @click="exportData"><Download :size="15" aria-hidden="true" />导出 Markdown</button></div><p v-if="operationPath" class="path-result">已生成：{{ operationPath }}</p></article>

      <article class="panel settings-card"><div class="settings-heading"><div><span class="settings-icon"><Bot :size="18" aria-hidden="true" /></span><div><h3>AI Provider</h3><p>可选，不影响离线功能</p></div></div><label class="switch"><input v-model="provider.enabled" type="checkbox" aria-label="启用 AI Provider" /><span></span></label></div><form data-testid="provider-form" @submit.prevent="save"><div class="form-grid two"><label>类型<select v-model="provider.kind" class="input"><option value="openai-compatible">OpenAI 兼容</option><option value="dify">远程 Dify</option></select></label><label>名称<input v-model="provider.name" class="input" required /></label></div><label>Base URL<input v-model="provider.baseUrl" class="input" required /></label><label v-if="provider.kind === 'openai-compatible'">模型<input v-model="provider.model" class="input" :required="provider.kind === 'openai-compatible'" /></label><label>API Key<input v-model="provider.apiKey" class="input" type="password" :placeholder="store.workspace?.settings.provider?.hasSecret ? '已安全保存；留空则不修改' : '仅保存到系统安全存储'" /></label><small class="provider-test-hint">测试会使用已保存配置发起一次最小生成请求，不再只检查接口地址。</small><div class="button-row"><button class="button secondary" type="button" @click="test"><PlugZap :size="15" aria-hidden="true" />测试模型调用</button><button class="button primary" type="submit"><Save :size="15" aria-hidden="true" />安全保存</button></div><p v-if="testMessage" class="path-result">{{ testMessage }}</p></form></article>

      <article class="panel settings-card"><div class="settings-heading"><div><span class="settings-icon"><ShieldCheck :size="18" aria-hidden="true" /></span><div><h3>无需 Docker 的调试模式</h3><p>当前开发环境已启用</p></div></div><span class="status-badge completed">离线可用</span></div><ul class="check-list"><li>原子文件数据仓库</li><li>离线岗位分析</li><li>离线题目与基础评分</li><li>Mock Provider 自动化测试</li><li>远程 Dify 连接器预留</li></ul></article>
    </div>
  </section>
</template>
