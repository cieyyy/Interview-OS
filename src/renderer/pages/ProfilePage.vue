<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue';
import type { DocumentImportResult, ProfileInput, ProjectInput, SkillLevel } from '../../shared/domain';
import DocumentImportButton from '../components/DocumentImportButton.vue';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { store, saveProfile, saveProject } = useWorkspace();
const tab = ref<'profile' | 'projects'>('profile');
const targetRolesText = ref('');
const skillsText = ref('');
const profile = reactive<ProfileInput>({ nickname: '', currentRole: '', yearsExperience: 0, education: '', targetRoles: [], skills: [] });
const project = reactive<ProjectInput>({ name: '', role: '', background: '', responsibilities: '', results: '', techStack: [] });
const techText = ref('');

function applyProfileImport(result: DocumentImportResult): void {
  const imported = result.profile;
  if (!imported) return;
  tab.value = 'profile';
  if (imported.nickname) profile.nickname = imported.nickname;
  if (imported.currentRole) profile.currentRole = imported.currentRole;
  if (typeof imported.yearsExperience === 'number') profile.yearsExperience = imported.yearsExperience;
  if (imported.education) profile.education = imported.education;
  if (imported.targetRoles?.length) targetRolesText.value = imported.targetRoles.join(', ');
  if (imported.skills?.length) skillsText.value = imported.skills.map((item) => `${item.name}:${item.level}`).join(', ');
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
      const [name, rawLevel] = entry.split(':').map((item) => item.trim());
      return { name, level: levels.includes(rawLevel as SkillLevel) ? rawLevel as SkillLevel : '熟悉' };
    }).filter((item) => item.name)
  });
}

async function submitProject(): Promise<void> {
  const saved = await saveProject({ ...project, techStack: techText.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) });
  if (saved) {
    Object.assign(project, { id: undefined, name: '', role: '', background: '', responsibilities: '', results: '', objective: '', architecture: '', actions: '', challenges: '', techStack: [] });
    techText.value = '';
  }
}
</script>

<template>
  <section>
    <PageHeader eyebrow="EVIDENCE" title="职业档案" description="只记录真实经历，让每一次回答都有证据可回溯。">
      <DocumentImportButton target="profile" label="上传简历 / 图片" test-id="profile-import-file" @imported="applyProfileImport" />
    </PageHeader>
    <div class="segmented"><button :class="{ active: tab === 'profile' }" @click="tab = 'profile'">基础档案</button><button :class="{ active: tab === 'projects' }" @click="tab = 'projects'">项目经历</button></div>

    <div v-if="tab === 'profile'" class="panel form-card">
      <div class="import-summary"><span>上传简历后自动识别基础档案</span><small>请核对姓名、年限、学历、目标岗位与技能后再保存</small></div>
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
      <div class="panel form-card">
        <h3>新增项目证据</h3>
        <form data-testid="project-form" @submit.prevent="submitProject">
          <div class="form-grid two"><label>项目名称<input v-model="project.name" class="input" required data-testid="project-name" /></label><label>我的角色<input v-model="project.role" class="input" required /></label></div>
          <label>项目背景<textarea v-model="project.background" class="input textarea-small" required data-testid="project-background"></textarea></label>
          <label>个人职责<textarea v-model="project.responsibilities" class="input textarea-small" required data-testid="project-responsibilities"></textarea></label>
          <label>技术栈<input v-model="techText" class="input" placeholder="ACK, Kubernetes, ACR" /></label>
          <label>结果<textarea v-model="project.results" class="input textarea-small" required data-testid="project-results"></textarea></label>
          <button class="button primary full" type="submit" data-testid="project-save">保存项目经历</button>
        </form>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><span class="eyebrow">PROJECTS</span><h3>已沉淀项目</h3></div><strong>{{ store.workspace?.projects.length ?? 0 }}</strong></div>
        <div class="card-stack"><article v-for="item in store.workspace?.projects" :key="item.id" class="project-card"><div><span class="chip">{{ item.role }}</span><h3>{{ item.name }}</h3><p>{{ item.background }}</p></div><div class="tag-row"><span v-for="tech in item.techStack" :key="tech">{{ tech }}</span></div><footer>{{ item.results }}</footer></article></div>
      </div>
    </div>
  </section>
</template>
