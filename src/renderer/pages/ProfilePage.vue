<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue';
import type { DocumentImportResult, ProfileInput, ProjectExperience, ProjectInput, SkillLevel } from '../../shared/domain';
import DocumentImportButton from '../components/DocumentImportButton.vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, saveProfile, saveProject } = useWorkspace();
const tab = ref<'profile' | 'projects'>('profile');
const targetRolesText = ref('');
const skillsText = ref('');
const importSummary = ref('');
const importWarnings = ref<string[]>([]);
const profile = reactive<ProfileInput>({ nickname: '', currentRole: '', yearsExperience: 0, education: '', targetRoles: [], skills: [] });
const project = reactive<ProjectInput>(emptyProject());
const techText = ref('');

function emptyProject(): ProjectInput {
  return {
    name: '', role: '', background: '', objective: '', architecture: '', responsibilities: '',
    actions: '', challenges: '', results: '', techStack: [], interviewRevisionNotes: ''
  };
}

function normalizeProjectName(value: string): string {
  return value.normalize('NFKC').replace(/[\s_-]+/g, '').toLocaleLowerCase();
}

async function applyProfileImport(result: DocumentImportResult): Promise<void> {
  importWarnings.value = result.warnings;
  const imported = result.profile;
  if (imported) {
    tab.value = 'profile';
    if (imported.nickname) profile.nickname = imported.nickname;
    if (imported.currentRole) profile.currentRole = imported.currentRole;
    if (typeof imported.yearsExperience === 'number') profile.yearsExperience = imported.yearsExperience;
    if (imported.education) profile.education = imported.education;
    if (imported.targetRoles?.length) targetRolesText.value = imported.targetRoles.join(', ');
    if (imported.skills?.length) skillsText.value = imported.skills.map((item) => `${item.name}:${item.level}`).join(', ');
  }

  const importedProjects = result.projects ?? [];
  const known = new Map((store.workspace?.projects ?? []).map((item) => [normalizeProjectName(item.name), item.id]));
  let created = 0;
  let updated = 0;
  let needsReview = 0;
  for (const item of importedProjects) {
    const sourceLabel = result.fileName.replace(/\.[^.]+$/, '');
    const importedName = /^简历项目 \d+（待命名）$/.test(item.name)
      ? `${sourceLabel} - ${item.name}`
      : item.name;
    if (/（待命名）|待补充/.test(`${importedName}${item.background}${item.responsibilities}${item.results}`)) needsReview += 1;
    const key = normalizeProjectName(importedName);
    const existingId = known.get(key);
    const saved = await saveProject({ ...item, name: importedName, id: existingId });
    if (saved) {
      known.set(key, saved.id);
      if (existingId) updated += 1;
      else created += 1;
    }
  }
  const modeText = result.mode === 'ai-vision' ? 'AI 图片/OCR' : '本地规则';
  importSummary.value = importedProjects.length
    ? `${modeText}识别完成：发现 ${importedProjects.length} 段项目经历并自动保存，新增 ${created} 条、更新 ${updated} 条${needsReview ? `，其中 ${needsReview} 条需要补充或核对` : ''}。`
    : `${modeText}识别完成：已提取基础档案，但没有找到包含实际内容的项目经历；可切换到“项目经历”手动补充。`;
}

watchEffect(() => {
  const current = store.workspace?.profile;
  if (current && !profile.nickname && !profile.currentRole) {
    Object.assign(profile, current);
    targetRolesText.value = current.targetRoles.join(', ');
    skillsText.value = current.skills.map((item) => `${item.name}:${item.level}`).join(', ');
  }
});

async function submitProfile(): Promise<void> {
  const levels: SkillLevel[] = ['了解', '熟悉', '掌握', '精通'];
  await saveProfile({
    ...profile,
    targetRoles: targetRolesText.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
    skills: skillsText.value.split(/[,，]/).map((entry) => {
      const [name, rawLevel] = entry.split(/[:：]/).map((item) => item.trim());
      return { name, level: levels.includes(rawLevel as SkillLevel) ? rawLevel as SkillLevel : '熟悉' };
    }).filter((item) => item.name)
  });
}

function resetProject(): void {
  Object.assign(project, emptyProject(), { id: undefined });
  techText.value = '';
}

function editProject(item: ProjectExperience): void {
  Object.assign(project, {
    id: item.id,
    name: item.name,
    role: item.role,
    background: item.background,
    objective: item.objective,
    architecture: item.architecture,
    responsibilities: item.responsibilities,
    actions: item.actions,
    challenges: item.challenges,
    results: item.results,
    techStack: [...item.techStack],
    relatedKnowledgeIds: [...item.relatedKnowledgeIds],
    pitch30: item.pitch30,
    pitch90: item.pitch90,
    deepDive: item.deepDive,
    interviewRevisionNotes: item.interviewRevisionNotes
  });
  techText.value = item.techStack.join(', ');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitProject(): Promise<void> {
  const saved = await saveProject({
    ...project,
    techStack: techText.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
  });
  if (saved) resetProject();
}
</script>

<template>
  <section>
    <PageHeader eyebrow="EVIDENCE" title="职业档案" description="只记录真实经历，让每一次回答都有证据可回溯。">
      <DocumentImportButton target="profile" label="上传简历 / 图片" test-id="profile-import-file" @imported="applyProfileImport" />
    </PageHeader>
    <p v-if="importSummary" class="import-result" data-testid="profile-import-summary">{{ importSummary }}</p>
    <ul v-if="importWarnings.length" class="import-warnings" aria-label="导入提醒">
      <li v-for="warning in importWarnings" :key="warning">{{ warning }}</li>
    </ul>
    <div class="segmented">
      <button :class="{ active: tab === 'profile' }" @click="tab = 'profile'">基础档案</button>
      <button :class="{ active: tab === 'projects' }" data-testid="profile-project-tab" @click="tab = 'projects'">项目经历</button>
    </div>

    <div v-if="tab === 'profile'" class="panel form-card">
      <div class="import-summary"><span>上传完整简历后自动识别基础档案与项目经历</span><small>项目经历会自动保存；基础字段请核对后再保存</small></div>
      <details class="recognition-explainer">
        <summary>识别方式说明</summary>
        <ol>
          <li><strong>读取文件：</strong>PDF、DOC、DOCX 和文本文件在本机提取文字；图片或扫描版 PDF 仅在启用 AI Provider 后发送给该 Provider 做 OCR。</li>
          <li><strong>还原结构：</strong>统一空格、制表符和中英文标签，并兼容表格、双栏 PDF、项目名与项目详情读取顺序错位等情况。</li>
          <li><strong>提取项目：</strong>根据“项目经验”、时间段、项目描述、职责、成果和技术环境分段，再把项目名与对应详情重新匹配。</li>
          <li><strong>安全落库：</strong>只有简历中有依据的内容才自动保存；缺少名称或结果时标记“待命名 / 待补充”，不会由系统编造。</li>
        </ol>
      </details>
      <form data-testid="profile-form" @submit.prevent="submitProfile">
        <div class="form-grid two">
          <label>昵称<input v-model="profile.nickname" class="input" placeholder="可使用昵称" /></label>
          <label>当前岗位<input v-model="profile.currentRole" class="input" data-testid="profile-role" placeholder="例如：运维工程师" /></label>
          <label>工作年限<input v-model.number="profile.yearsExperience" class="input" type="number" min="0" max="60" /></label>
          <label>学历<input v-model="profile.education" class="input" placeholder="例如：本科" /></label>
        </div>
        <label>目标岗位<input v-model="targetRolesText" class="input" placeholder="多个岗位用逗号分隔" /></label>
        <label>技能与程度<input v-model="skillsText" class="input" placeholder="Kubernetes:熟悉, Docker:掌握" /></label>
        <div class="form-actions"><span></span><span></span><button class="button primary" type="submit">保存职业档案</button></div>
      </form>
    </div>

    <div v-else class="profile-project-layout">
      <div class="panel form-card project-form-card">
        <div class="project-form-title">
          <h3>{{ project.id ? '编辑项目经历' : '新增项目经历' }}</h3>
          <button v-if="project.id" class="button ghost compact" type="button" @click="resetProject">取消编辑</button>
        </div>
        <form data-testid="project-form" @submit.prevent="submitProject">
          <div class="form-grid two"><label>项目名称<input v-model="project.name" class="input" required data-testid="project-name" /></label><label>我的角色<input v-model="project.role" class="input" required /></label></div>
          <label>项目背景<textarea v-model="project.background" class="input textarea-small" required data-testid="project-background"></textarea></label>
          <label>项目目标<textarea v-model="project.objective" class="input textarea-small"></textarea></label>
          <label>系统架构<textarea v-model="project.architecture" class="input textarea-small"></textarea></label>
          <label>个人职责<textarea v-model="project.responsibilities" class="input textarea-small" required data-testid="project-responsibilities"></textarea></label>
          <label>具体行动<textarea v-model="project.actions" class="input textarea-small"></textarea></label>
          <label>问题难点<textarea v-model="project.challenges" class="input textarea-small"></textarea></label>
          <label>技术栈<input v-model="techText" class="input" placeholder="ACK, Kubernetes, ACR" /></label>
          <label>项目结果<textarea v-model="project.results" class="input textarea-small" required data-testid="project-results"></textarea></label>
          <label>面试校准记录<textarea v-model="project.interviewRevisionNotes" class="input textarea-small" placeholder="压力面试中发现的证据缺口、修改建议和待补充信息会同步到这里"></textarea></label>
          <button class="button primary full" type="submit" data-testid="project-save">{{ project.id ? '保存修改' : '保存项目经历' }}</button>
        </form>
      </div>
      <div class="panel recorded-projects">
        <div class="panel-heading"><div><span class="eyebrow">PROJECTS</span><h3>已记录项目</h3></div><strong>{{ store.workspace?.projects.length ?? 0 }}</strong></div>
        <div class="card-stack">
          <article v-for="item in store.workspace?.projects" :key="item.id" class="project-card" :data-testid="`project-card-${item.id}`">
            <div class="project-card-heading"><div><span class="chip">{{ item.role }}</span><h3>{{ item.name }}</h3></div><button class="button secondary compact" type="button" :data-testid="`project-edit-${item.id}`" @click="editProject(item)">编辑</button></div>
            <p>{{ item.background }}</p>
            <div class="tag-row"><span v-for="tech in item.techStack" :key="tech">{{ tech }}</span></div>
            <footer>{{ item.results }}</footer>
            <details v-if="item.interviewRevisionNotes" class="project-calibration"><summary>查看面试校准记录</summary><p>{{ item.interviewRevisionNotes }}</p></details>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
