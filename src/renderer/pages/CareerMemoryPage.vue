<script setup lang="ts">
import { computed, ref } from 'vue';
import { BrainCog, Check, Download, Pin, Send, Sparkles } from '@lucide/vue';
import type { CareerMemorySuggestion } from '../../shared/domain';
import { buildCareerContextOverview } from '../../shared/career-context';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, careerCompanion, exportCareerContext, saveCareerMemory } = useWorkspace();
const message = ref('');
const suggestions = ref<CareerMemorySuggestion[]>([]);
const overview = computed(() => store.workspace ? buildCareerContextOverview(store.workspace) : undefined);
const session = computed(() => store.workspace?.coachSessions.find((item) => item.mode === 'career-companion' && item.pinned)
  ?? store.workspace?.coachSessions.find((item) => item.mode === 'career-companion'));
const providerName = computed(() => {
  const provider = store.workspace?.settings.provider;
  return provider?.enabled ? provider.name : '本地模式';
});

async function sendMessage(): Promise<void> {
  const content = message.value.trim();
  if (!content) return;
  message.value = '';
  const result = await careerCompanion({ message: content });
  if (!result) {
    message.value = content;
    return;
  }
  suggestions.value = result.memorySuggestions;
}

async function acceptSuggestion(item: CareerMemorySuggestion): Promise<void> {
  const saved = await saveCareerMemory({
    ...item,
    sourceSessionId: session.value?.id
  });
  if (saved) suggestions.value = suggestions.value.filter((candidate) => candidate !== item);
}

function displayTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <section>
    <PageHeader eyebrow="CAREER MEMORY" title="职业记忆" description="把职业事实、项目证据和面试复盘组织成可持续更新的个人上下文。" />

    <div v-if="overview" class="career-memory-workspace">
      <article class="panel career-context-panel">
        <header class="career-memory-heading">
          <div><span class="settings-icon"><BrainCog :size="18" aria-hidden="true" /></span><div><h2>职业总览</h2><p>{{ overview.headline }}</p></div></div>
          <button class="button secondary" type="button" data-testid="career-context-export" @click="exportCareerContext"><Download :size="15" aria-hidden="true" />导出 AI_CONTEXT.md</button>
        </header>

        <dl class="career-context-counts">
          <div><dt>项目</dt><dd>{{ overview.counts.projects }}</dd></div>
          <div><dt>知识</dt><dd>{{ overview.counts.knowledge }}</dd></div>
          <div><dt>简历</dt><dd>{{ overview.counts.resumes }}</dd></div>
          <div><dt>训练</dt><dd>{{ overview.counts.trainingSessions }}</dd></div>
          <div><dt>记忆</dt><dd>{{ overview.counts.memories }}</dd></div>
        </dl>

        <div class="career-context-sections">
          <section><h3>目标方向</h3><div class="tag-row"><span v-for="item in overview.targetRoles" :key="item" class="chip accent">{{ item }}</span><span v-if="!overview.targetRoles.length" class="empty-inline">待完善</span></div></section>
          <section><h3>核心能力</h3><ul><li v-for="item in overview.strengths" :key="item">{{ item }}</li><li v-if="!overview.strengths.length">待完善</li></ul></section>
          <section><h3>职业偏好</h3><ul><li v-for="item in overview.preferences" :key="item">{{ item }}</li><li v-if="!overview.preferences.length">尚未记录</li></ul></section>
          <section><h3>待补强</h3><ul><li v-for="item in overview.gaps" :key="item">{{ item }}</li><li v-if="!overview.gaps.length">尚未从训练中识别</li></ul></section>
        </div>

        <section class="career-evidence-list">
          <h3>事实与证据</h3>
          <article v-for="item in overview.evidence" :key="item.id">
            <span class="status-badge">{{ item.kind }}</span><div><strong>{{ item.title }}</strong><p>{{ item.summary || '待补充可验证说明' }}</p></div>
          </article>
          <p v-if="!overview.evidence.length" class="empty-inline">先在职业档案、项目资产库或知识空间中补充真实经历。</p>
        </section>
      </article>

      <article class="panel career-companion-panel">
        <header class="career-memory-heading companion-heading">
          <div><span class="settings-icon"><Sparkles :size="18" aria-hidden="true" /></span><div><h2>我的职业陪练</h2><p>{{ providerName }}</p></div></div>
          <span class="status-badge completed"><Pin :size="13" aria-hidden="true" />固定会话</span>
        </header>

        <div class="companion-messages" data-testid="career-companion-messages">
          <div v-if="!session?.messages.length" class="companion-empty"><BrainCog :size="28" aria-hidden="true" /><strong>开始长期职业对话</strong><span>可以从目标岗位、经历复盘、简历表达或模拟追问开始。</span></div>
          <article v-for="item in session?.messages ?? []" :key="item.id" class="companion-message" :class="item.role">
            <div><strong>{{ item.role === 'user' ? '我' : '职业陪练' }}</strong><time>{{ displayTime(item.createdAt) }}</time></div>
            <p>{{ item.content }}</p>
          </article>
        </div>

        <section v-if="suggestions.length" class="memory-suggestions" data-testid="memory-suggestions">
          <h3>待确认记忆</h3>
          <article v-for="item in suggestions" :key="`${item.type}-${item.content}`">
            <div><span class="status-badge">{{ item.type }}</span><p>{{ item.content }}</p></div>
            <button class="button secondary" type="button" @click="acceptSuggestion(item)"><Check :size="14" aria-hidden="true" />保存</button>
          </article>
        </section>

        <form class="companion-composer" data-testid="career-companion-form" @submit.prevent="sendMessage">
          <textarea v-model="message" class="input" rows="3" maxlength="20000" placeholder="输入你现在要讨论的求职或面试问题" />
          <button class="button primary" type="submit" :disabled="!message.trim() || store.loading" title="发送"><Send :size="17" aria-hidden="true" /><span>发送</span></button>
        </form>
      </article>
    </div>
  </section>
</template>
