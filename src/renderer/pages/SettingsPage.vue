<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue';
import { AlertTriangle, Bot, DatabaseBackup, Download, HardDrive, Languages, MapPin, Moon, PlugZap, Save, ShieldCheck, Sparkles, Sun, Trash2 } from '@lucide/vue';
import type { ProviderInput } from '../../shared/domain';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';
import { useUiPreferences } from '../composables/useUiPreferences';

const { store, saveProvider, testProvider, createBackup, exportMarkdown, clearWorkspaceData } = useWorkspace();
const { preferences } = useUiPreferences();
const provider = reactive<ProviderInput>({ kind: 'openai-compatible', name: 'Sub2API', baseUrl: 'https://your-sub2api.example.com/v1', model: 'gpt-5.4', apiKey: '', enabled: false });
const testMessage = ref('');
const operationPath = ref('');
const cleanupOpen = ref(false);
const cleanupText = ref('');
const cleanupBackupPath = ref('');
watchEffect(() => { const current = store.workspace?.settings.provider; if (current) Object.assign(provider, current, { apiKey: '' }); });
function normalizeOpenAiBaseUrl(value: string): string {
  if (provider.kind !== 'openai-compatible') return value;
  try {
    const url = new URL(value);
    if (!url.pathname || url.pathname === '/') url.pathname = '/v1';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}
async function save(): Promise<void> {
  provider.baseUrl = normalizeOpenAiBaseUrl(provider.baseUrl);
  await saveProvider(provider);
}
async function test(): Promise<void> { const result = await testProvider(); if (result) testMessage.value = result.message + (result.latencyMs ? ` · ${result.latencyMs}ms` : ''); }
function applySub2ApiTemplate(): void {
  Object.assign(provider, {
    kind: 'openai-compatible',
    name: 'Sub2API',
    baseUrl: 'https://your-sub2api.example.com/v1',
    model: 'gpt-5.4',
    enabled: true
  });
  testMessage.value = '';
}
async function backup(): Promise<void> { const result = await createBackup(); if (result) operationPath.value = result.path; }
async function exportData(): Promise<void> { const result = await exportMarkdown(); if (result) operationPath.value = result.path; }
async function cleanupData(): Promise<void> {
  if (cleanupText.value !== '清空本地数据') return;
  const result = await clearWorkspaceData();
  if (!result) return;
  cleanupBackupPath.value = result.backup.path;
  cleanupText.value = '';
  cleanupOpen.value = false;
}
</script>

<template>
  <section>
    <PageHeader eyebrow="CONTROL" :title="preferences.language === 'en-US' ? 'Settings' : '设置'" :description="preferences.language === 'en-US' ? 'Control interface preferences, map services, local data, and optional AI connections.' : '管理界面偏好、地图服务、本地数据和可选 AI 连接。'" />
    <div class="settings-grid">
      <article class="panel settings-card preference-card">
        <div class="settings-heading"><div><span class="settings-icon"><Languages :size="18" /></span><div><h3>{{ preferences.language === 'en-US' ? 'Interface preferences' : '界面偏好' }}</h3><p>{{ preferences.language === 'en-US' ? 'Applied immediately and saved on this device' : '立即生效并保存在本机' }}</p></div></div></div>
        <div class="form-grid two">
          <label>{{ preferences.language === 'en-US' ? 'Language' : '界面语言' }}<select v-model="preferences.language" class="input" data-testid="settings-language"><option value="zh-CN">中文</option><option value="en-US">English</option></select></label>
          <label>{{ preferences.language === 'en-US' ? 'Theme' : '界面主题' }}<span class="theme-segmented"><button type="button" :class="{ active: preferences.theme === 'light' }" @click="preferences.theme = 'light'"><Sun :size="15" />{{ preferences.language === 'en-US' ? 'Light' : '白色' }}</button><button type="button" :class="{ active: preferences.theme === 'dark' }" @click="preferences.theme = 'dark'"><Moon :size="15" />{{ preferences.language === 'en-US' ? 'Dark' : '黑色' }}</button></span></label>
        </div>
      </article>

      <article class="panel settings-card">
        <div class="settings-heading"><div><span class="settings-icon"><MapPin :size="18" /></span><div><h3>{{ preferences.language === 'en-US' ? 'Map service' : '地图服务' }}</h3><p>{{ preferences.language === 'en-US' ? 'Used for accurate job distance calculation' : '用于准确计算岗位距离' }}</p></div></div><span class="status-badge" :class="preferences.mapApiKey ? 'completed' : 'warning'">{{ preferences.mapApiKey ? (preferences.language === 'en-US' ? 'Configured' : '已配置') : (preferences.language === 'en-US' ? 'Key required' : '需要 Key') }}</span></div>
        <label>{{ preferences.language === 'en-US' ? 'Provider' : '地图供应商' }}<select v-model="preferences.mapProvider" class="input"><option value="amap">高德地图 AMap</option></select></label>
        <label>{{ preferences.language === 'en-US' ? 'Web service key' : 'Web 服务 Key' }}<input v-model="preferences.mapApiKey" class="input" type="password" autocomplete="off" placeholder="AMap Web Service Key" /></label>
        <small>{{ preferences.language === 'en-US' ? 'The key is stored only in local application preferences. Configure domain/IP restrictions in the map console.' : 'Key 仅保存在本机应用偏好中；请在地图控制台配置域名或 IP 限制。' }}</small>
      </article>
      <article class="panel settings-card"><div class="settings-heading"><div><span class="settings-icon"><HardDrive :size="18" aria-hidden="true" /></span><div><h3>本地工作区</h3><p>程序与个人内容分离保存</p></div></div><span class="status-badge completed">正常</span></div><dl><div><dt>数据目录</dt><dd data-testid="settings-data-dir">{{ store.meta?.dataDirectory ?? '读取中…' }}</dd></div><div><dt>应用版本</dt><dd>{{ store.meta?.version ?? '—' }}</dd></div></dl><div class="button-row"><button class="button secondary" type="button" data-testid="settings-backup" @click="backup"><DatabaseBackup :size="15" aria-hidden="true" />创建备份</button><button class="button secondary" type="button" data-testid="settings-export" @click="exportData"><Download :size="15" aria-hidden="true" />导出 Markdown</button></div><p v-if="operationPath" class="path-result">已生成：{{ operationPath }}</p></article>

      <article class="panel settings-card"><div class="settings-heading"><div><span class="settings-icon"><Bot :size="18" aria-hidden="true" /></span><div><h3>AI Provider</h3><p>可选，不影响离线功能</p></div></div><label class="switch"><input v-model="provider.enabled" type="checkbox" aria-label="启用 AI Provider" /><span></span></label></div><form data-testid="provider-form" @submit.prevent="save"><div class="provider-template"><div><span class="settings-icon"><Sparkles :size="18" aria-hidden="true" /></span><span><strong>Sub2API 模板</strong><small>OpenAI 兼容接口，地址以 /v1 结尾</small></span></div><button class="button secondary compact" type="button" data-testid="provider-apply-sub2api" @click="applySub2ApiTemplate">应用模板</button></div><div class="form-grid two"><label>类型<select v-model="provider.kind" class="input" data-testid="provider-kind"><option value="openai-compatible">OpenAI 兼容</option><option value="dify">远程 Dify</option></select></label><label>名称<input v-model="provider.name" class="input" data-testid="provider-name" required /></label></div><label>Base URL<input v-model="provider.baseUrl" class="input" data-testid="provider-base-url" placeholder="https://your-sub2api.example.com/v1" required /></label><small class="provider-test-hint">请替换为你的 Sub2API 地址并保留 /v1；生产环境请使用 HTTPS。</small><label v-if="provider.kind === 'openai-compatible'">模型<input v-model="provider.model" class="input" data-testid="provider-model" placeholder="例如：gpt-5.4" :required="provider.kind === 'openai-compatible'" /></label><label>API Key<input v-model="provider.apiKey" class="input" type="password" :placeholder="store.workspace?.settings.provider?.hasSecret ? '已安全保存；留空则不修改' : '仅保存到系统安全存储'" /></label><small class="provider-test-hint">测试会使用已保存配置发起一次最小生成请求，不再只检查接口地址。</small><div class="button-row"><button class="button secondary" type="button" @click="test"><PlugZap :size="15" aria-hidden="true" />测试模型调用</button><button class="button primary" type="submit"><Save :size="15" aria-hidden="true" />安全保存</button></div><p v-if="testMessage" class="path-result">{{ testMessage }}</p></form></article>

      <article class="panel settings-card"><div class="settings-heading"><div><span class="settings-icon"><ShieldCheck :size="18" aria-hidden="true" /></span><div><h3>无需 Docker 的调试模式</h3><p>当前开发环境已启用</p></div></div><span class="status-badge completed">离线可用</span></div><ul class="check-list"><li>原子文件数据仓库</li><li>离线岗位分析</li><li>离线题目与基础评分</li><li>Mock Provider 自动化测试</li><li>远程 Dify 连接器预留</li></ul></article>

      <article class="panel settings-card danger-zone" data-testid="settings-cleanup-card">
        <div class="settings-heading"><div><span class="settings-icon danger"><Trash2 :size="18" aria-hidden="true" /></span><div><h3>清理本地业务数据</h3><p>用于重新开始或交付设备前清除个人求职内容</p></div></div><span class="status-badge warning">高风险操作</span></div>
        <ul class="cleanup-scope"><li>清空职业档案、项目、岗位、简历、训练和求职记录</li><li>执行前自动创建完整 JSON 备份</li><li>保留数据源配置、插件同步令牌、AI、地图和界面偏好</li><li>不会删除工作区之外的文件</li></ul>
        <button v-if="!cleanupOpen" class="button danger" type="button" data-testid="settings-cleanup-open" @click="cleanupOpen = true"><Trash2 :size="15" />开始清理</button>
        <div v-else class="cleanup-confirm" data-testid="settings-cleanup-confirm">
          <div class="cleanup-warning"><AlertTriangle :size="18" /><span><strong>清理后当前界面的业务数据会立即消失。</strong><small>如需撤销，请使用下方显示的自动备份文件恢复。</small></span></div>
          <label>输入“清空本地数据”确认<input v-model="cleanupText" class="input" autocomplete="off" data-testid="settings-cleanup-input" /></label>
          <div class="button-row"><button class="button ghost" type="button" @click="cleanupOpen = false; cleanupText = ''">取消</button><button class="button danger" type="button" :disabled="cleanupText !== '清空本地数据'" data-testid="settings-cleanup-submit" @click="cleanupData"><Trash2 :size="15" />确认清理</button></div>
        </div>
        <p v-if="cleanupBackupPath" class="path-result cleanup-backup">清理前备份：{{ cleanupBackupPath }}</p>
      </article>
    </div>
  </section>
</template>
