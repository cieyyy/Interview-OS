<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Mic, MicOff, Volume2 } from '@lucide/vue';
import type { CoachMode, InterviewQuestionType, TrainingCoachResult, TrainingLanguage, TrainingMode } from '../../shared/domain';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';
import { useUiPreferences } from '../composables/useUiPreferences';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const { store, startTraining, submitTraining, finalizeTraining, coachTraining, saveProject } = useWorkspace();
const { preferences } = useUiPreferences();
const route = useRoute();
const coachMode = ref<CoachMode>('mock-interview');
const jobId = ref('');
const projectId = ref('');
const resumeId = ref('');
const language = ref<TrainingLanguage>(preferences.language);
const practiceMode = ref<TrainingMode>('pressure');
const maxRounds = ref(8);
const answer = ref('');
const submitted = ref(false);
const coachResult = ref<TrainingCoachResult>();
const coachBusy = ref(false);
const showRecommended = ref(false);
const coachMessage = ref('');
const isListening = ref(false);
const speechMessage = ref('');
const setupMessage = ref('');
const syncBusy = ref(false);
let recognition: SpeechRecognitionLike | undefined;

const active = computed(() => store.activeSession);
const currentQuestion = computed(() => active.value?.questions[active.value.currentQuestionIndex]);
const latestAttempt = computed(() => {
  if (!active.value || !currentQuestion.value) return undefined;
  return [...active.value.attempts].reverse().find((item) => item.questionId === currentQuestion.value?.id);
});
const isEnglish = computed(() => (active.value?.language ?? language.value) === 'en-US');
const completedRounds = computed(() => active.value?.attempts.filter((item) => item.isFinal).length ?? 0);
const progressTotal = computed(() => active.value?.mode === 'pressure' ? (active.value.maxRounds ?? 8) : (active.value?.questions.length ?? 0));
const selectedProject = computed(() => store.workspace?.projects.find((item) => item.id === active.value?.projectId));
const cjkPattern = /[\u3400-\u9fff]/u;
const coachModes: Array<{ value: CoachMode; label: string; description: string }> = [
  { value: 'mock-interview', label: '模拟面试', description: '根据目标岗位出题、追问、评分与复盘' },
  { value: 'project-deep-dive', label: '项目深挖', description: '围绕架构、故障、优化和个人贡献追问' },
  { value: 'technical-qa', label: '技术问答', description: 'Kubernetes、Docker、云计算、数据库与网络' },
  { value: 'resume-follow-up', label: '简历追问', description: '从简历陈述中识别证据缺口与高风险表述' },
  { value: 'jd-analysis', label: '岗位分析', description: '拆解技能要求、面试重点和学习建议' },
  { value: 'english-interview', label: '英语面试', description: '全英文问题、表达训练和证据纠错' }
];

watch(() => preferences.language, (value) => { if (!active.value) language.value = value; });

watch(
  () => [route.query.jobId, route.query.projectId, route.query.resumeId, route.query.mode, store.workspace?.jobs.length, store.workspace?.projects.length, store.workspace?.resumeVariants.length] as const,
  ([value, projectValue, resumeValue, modeValue]) => {
    if (typeof value === 'string' && store.workspace?.jobs.some((item) => item.id === value)) jobId.value = value;
    if (typeof projectValue === 'string' && store.workspace?.projects.some((item) => item.id === projectValue)) projectId.value = projectValue;
    if (typeof resumeValue === 'string' && store.workspace?.resumeVariants.some((item) => item.id === resumeValue)) resumeId.value = resumeValue;
    if (typeof modeValue === 'string' && coachModes.some((item) => item.value === modeValue)) selectCoachMode(modeValue as CoachMode);
  },
  { immediate: true }
);

function selectCoachMode(value: CoachMode): void {
  coachMode.value = value;
  language.value = value === 'english-interview' ? 'en-US' : 'zh-CN';
  setupMessage.value = '';
  if (value === 'project-deep-dive' || value === 'resume-follow-up' || value === 'mock-interview' || value === 'english-interview') practiceMode.value = 'pressure';
  else practiceMode.value = 'standard';
}

function englishDisplay(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && !cjkPattern.test(normalized) ? normalized : fallback;
}

function englishEvidence(value: string | undefined): string {
  return englishDisplay(value, '[CANDIDATE MUST ADD EVIDENCE]');
}

function englishTech(values: string[]): string {
  const safe = values.filter((value) => value.trim() && !cjkPattern.test(value));
  return safe.join(', ') || 'system operations and troubleshooting';
}

function localRecommendedAnswer(languageValue: TrainingLanguage): string {
  const project = store.workspace?.projects.find((item) => item.id === active.value?.projectId);
  if (!project) {
    return languageValue === 'en-US'
      ? 'Start with the context, explain your responsibility, describe the concrete actions you took, and close with a verifiable result. Replace each part with your own experience.'
      : '可以先说明事情背景，再讲清楚自己的职责和采取的具体行动，最后用可验证的结果收尾。请把每一部分替换成自己的真实经历。';
  }
  return languageValue === 'en-US'
    ? `The selected experience was ${englishDisplay(project.name, 'the selected project')}. The context was ${englishEvidence(project.background)}. My role was ${englishEvidence(project.role)}, and I was responsible for ${englishEvidence(project.responsibilities)}. I took these actions: ${englishEvidence(project.actions)}. The verified result was ${englishEvidence(project.results)}. Relevant skills: ${englishTech(project.techStack)}.`
    : `这个项目的背景是：${project.background}\n我在其中主要负责：${project.responsibilities}${project.actions ? `\n我采取的具体行动包括：${project.actions}` : ''}\n最终结果是：${project.results}`;
}

function resetQuestionState(): void {
  answer.value = '';
  submitted.value = false;
  coachResult.value = undefined;
  showRecommended.value = false;
  coachMessage.value = '';
  speechMessage.value = '';
}

async function start(): Promise<void> {
  setupMessage.value = '';
  if (coachMode.value === 'project-deep-dive' && !projectId.value) {
    setupMessage.value = isEnglish.value ? 'Project deep-dive mode requires one project experience.' : '项目深挖模式需要选择一段项目经历。';
    return;
  }
  if (coachMode.value === 'resume-follow-up' && !resumeId.value) {
    setupMessage.value = isEnglish.value ? 'Resume follow-up mode requires one resume version.' : '简历追问模式需要选择一个简历版本。';
    return;
  }
  if (['mock-interview', 'resume-follow-up', 'english-interview'].includes(coachMode.value) && practiceMode.value === 'pressure' && (!jobId.value || !projectId.value)) {
    setupMessage.value = isEnglish.value
      ? 'Pressure interview mode requires both a target role and a project experience so the coach can verify role fit and resume evidence.'
      : '压力面试需要同时选择目标岗位和一段项目经历，才能校验岗位匹配与简历证据。';
    return;
  }
  const questionType: InterviewQuestionType | 'mixed' = coachMode.value === 'project-deep-dive'
    ? 'project'
    : coachMode.value === 'technical-qa' ? 'technical' : 'mixed';
  const session = await startTraining({
    jobId: jobId.value || undefined,
    projectId: projectId.value || undefined,
    projectIds: projectId.value ? [projectId.value] : [],
    resumeId: resumeId.value || undefined,
    coachMode: coachMode.value,
    type: questionType, difficulty: practiceMode.value === 'pressure' ? 'hard' : 'medium',
    questionCount: practiceMode.value === 'pressure' ? 1 : 5,
    language: language.value,
    mode: practiceMode.value,
    maxRounds: maxRounds.value
  });
  if (session) resetQuestionState();
}

async function requestCoach(showAnswer = true, answerOverride?: string): Promise<void> {
  if (!active.value || !currentQuestion.value) return;
  coachBusy.value = true;
  coachMessage.value = '';
  showRecommended.value = showAnswer;
  try {
    const result = await coachTraining({
      sessionId: active.value.id,
      questionId: currentQuestion.value.id,
      answer: answerOverride ?? answer.value,
      language: active.value.language ?? language.value
    });
    if (result) {
      coachResult.value = result;
    } else {
      const languageValue = active.value.language ?? language.value;
      coachResult.value = {
        feedback: languageValue === 'en-US'
          ? 'The remote coaching request did not complete. A local answer structure is shown instead.'
          : `远程陪练请求未完成，已显示本地推荐结构。${store.error ? `原因：${store.error}` : ''}`,
        recommendedAnswer: localRecommendedAnswer(languageValue),
        followUpQuestion: languageValue === 'en-US'
          ? 'Which part of this answer can you support with a concrete action and result?'
          : '这段回答中，哪一部分可以补充你亲自完成的动作和可验证结果？',
        diagnosis: {
          evidenceGaps: [languageValue === 'en-US' ? 'Remote diagnosis was unavailable. Verify every claim with your own evidence.' : '远程诊断暂不可用，请逐项补充本人能够证明的事实。'],
          logicIssues: [languageValue === 'en-US' ? 'Use a clear situation-task-action-result sequence.' : '请按“背景—任务—行动—结果”重新校准结构。'],
          interviewerChallenge: languageValue === 'en-US' ? 'What evidence proves this result?' : '这个结果由什么证据证明？',
          starAnswer: localRecommendedAnswer(languageValue),
          resumeUpdateNeeded: true,
          resumeSuggestion: languageValue === 'en-US' ? 'Add ownership, concrete actions, verification, and data sources to the selected project.' : '在所选项目中补充个人责任边界、具体动作、验证方式和数据来源。'
        },
        source: 'local'
      };
      coachMessage.value = languageValue === 'en-US'
        ? 'The remote AI returned no usable English content. The local English coach is now active.'
        : '远程 AI 未返回可显示内容，已自动切换到本地推荐回答。';
    }
  } finally {
    coachBusy.value = false;
  }
}

async function submit(): Promise<void> {
  if (!active.value || !currentQuestion.value) return;
  const sessionId = active.value.id;
  const questionId = currentQuestion.value.id;
  const submittedAnswer = answer.value;
  const value = await submitTraining({ sessionId, questionId, answer: submittedAnswer });
  if (value) {
    submitted.value = true;
    if (practiceMode.value === 'pressure') await requestCoach(true, submittedAnswer);
  }
}

async function finalize(): Promise<void> {
  if (!active.value || !currentQuestion.value) return;
  const previousQuestionId = currentQuestion.value.id;
  const value = await finalizeTraining({
    sessionId: active.value.id,
    questionId: previousQuestionId,
    answer: answer.value,
    coach: coachResult.value
  });
  if (value) resetQuestionState();
}

async function syncResumeSuggestion(): Promise<void> {
  const item = selectedProject.value;
  const suggestion = coachResult.value?.diagnosis.resumeSuggestion.trim();
  if (!item || !suggestion || syncBusy.value) return;
  syncBusy.value = true;
  const marker = isEnglish.value ? `Round ${completedRounds.value + 1} calibration` : `第 ${completedRounds.value + 1} 轮校准`;
  const existing = item.interviewRevisionNotes?.trim() ?? '';
  const saved = await saveProject({
    ...item,
    interviewRevisionNotes: [existing, `${marker}: ${suggestion}`].filter(Boolean).join('\n\n')
  });
  if (saved) coachMessage.value = isEnglish.value
    ? 'The recommendation was synced to the selected project calibration notes.'
    : `修改建议已同步到“${item.name}”的面试校准记录。`;
  syncBusy.value = false;
}

function speechConstructor(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function toggleListening(): void {
  if (isListening.value && recognition) {
    recognition.stop();
    return;
  }
  const Constructor = speechConstructor();
  if (!Constructor) {
    speechMessage.value = isEnglish.value
      ? 'Speech recognition is unavailable on this system. Use text input or update the system speech components.'
      : '当前系统不支持语音识别，请使用文字输入或更新系统语音组件。';
    return;
  }
  recognition = new Constructor();
  recognition.lang = active.value?.language ?? language.value;
  recognition.continuous = true;
  recognition.interimResults = true;
  const original = answer.value.trim();
  let finalTranscript = '';
  recognition.onresult = (event) => {
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal) finalTranscript += result[0].transcript;
      else interim += result[0].transcript;
    }
    answer.value = [original, `${finalTranscript}${interim}`.trim()].filter(Boolean).join(original ? '\n' : '');
  };
  recognition.onerror = (event) => {
    speechMessage.value = isEnglish.value ? `Speech recognition failed: ${event.error}` : `语音识别未完成：${event.error}`;
    isListening.value = false;
  };
  recognition.onend = () => { isListening.value = false; };
  try {
    recognition.start();
    isListening.value = true;
    speechMessage.value = isEnglish.value ? 'Listening… Speak naturally.' : '正在听取，请自然作答…';
  } catch (error) {
    speechMessage.value = error instanceof Error
      ? error.message
      : (isEnglish.value ? 'Unable to start the microphone.' : '麦克风启动失败');
    isListening.value = false;
  }
}

function readQuestion(): void {
  if (!currentQuestion.value || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentQuestion.value.text);
  utterance.lang = active.value?.language ?? language.value;
  window.speechSynthesis.speak(utterance);
}

function leaveSession(): void {
  recognition?.stop();
  store.activeSession = undefined;
  resetQuestionState();
}
</script>

<template>
  <section>
    <PageHeader eyebrow="AI CAREER COACH" :title="isEnglish ? 'AI Career Coach' : 'AI 职业教练'" :description="isEnglish ? 'One workspace for mock interviews, project deep dives, technical questions, resume follow-ups, job analysis, and English practice.' : '统一模拟面试、项目深挖、技术问答、简历追问、岗位分析和英语训练，并关联岗位、简历与项目上下文。'">
      <button v-if="active" class="button ghost" type="button" @click="leaveSession">{{ isEnglish ? 'End session' : '结束本次训练' }}</button>
      <template v-else><RouterLink class="button ghost" to="/reports">训练报告</RouterLink><RouterLink class="button secondary" to="/career-agent">求职 Agent</RouterLink></template>
    </PageHeader>

    <div v-if="!active" class="training-setup">
      <div class="setup-copy"><span class="eyebrow">CLOSED LOOP PRACTICE</span><h2>{{ isEnglish ? 'Build answers that survive follow-up questions' : '走完闭环，简历才经得起追问' }}</h2><p>{{ isEnglish ? 'Use realistic pressure interviews to turn every resume claim into evidence you can explain and defend.' : '不是让 AI 替你写简历，而是通过真实压力面试，把每一句简历变成能够当场证明的能力。' }}</p><div class="loop-flow" :aria-label="isEnglish ? 'Interview practice loop' : '求职训练闭环'"><span>{{ isEnglish ? 'Role research' : '岗位研究' }}</span><i>→</i><span>{{ isEnglish ? 'Resume evidence' : '简历证据' }}</span><i>→</i><span>{{ isEnglish ? 'Pressure interview' : '压力面试' }}</span><i>→</i><span>{{ isEnglish ? 'Revise evidence' : '回写修正' }}</span><i>→</i><span>{{ isEnglish ? 'Final checklist' : '面试清单' }}</span></div><ul><li>{{ isEnglish ? 'Up to 8 rounds, with one question at a time' : '最多 8 轮，一次只问一个问题' }}</li><li>{{ isEnglish ? 'Dynamic follow-ups based on the previous answer, without repetition' : '根据上一轮回答动态追问，自动避开重复问题' }}</li><li>{{ isEnglish ? 'Identify evidence gaps, structural issues, delivery risks, and resume updates' : '拆出证据缺口、结构断点、表达漏洞和简历修改建议' }}</li></ul></div>
      <form class="panel setup-form" data-testid="training-setup" @submit.prevent="start">
        <h3>{{ isEnglish ? 'Set the coaching context' : `设置${coachModes.find((item) => item.value === coachMode)?.label ?? '训练'}上下文` }}</h3>
        <label>{{ isEnglish ? 'Coaching mode' : '陪练类型' }}<select v-model="coachMode" class="input" data-testid="training-coach-mode" @change="selectCoachMode(coachMode)"><option v-for="item in coachModes" :key="item.value" :value="item.value">{{ item.label }} · {{ item.description }}</option></select></label>
        <label>{{ isEnglish ? 'Target role' : '目标岗位' }}<select v-model="jobId" class="input" data-testid="training-job"><option value="">{{ isEnglish ? 'General practice' : '综合训练' }}</option><option v-for="(job, index) in store.workspace?.jobs" :key="job.id" :value="job.id">{{ isEnglish ? `${englishDisplay(job.company, 'Company')} · ${englishDisplay(job.title, `Target role ${index + 1}`)}` : `${job.company} · ${job.title}` }}</option></select></label>
        <label>{{ isEnglish ? 'Project experience' : '项目经历' }}<select v-model="projectId" class="input" data-testid="training-project"><option value="">{{ isEnglish ? 'No specific project' : '不指定项目' }}</option><option v-for="(item, index) in store.workspace?.projects" :key="item.id" :value="item.id">{{ isEnglish ? englishDisplay(item.name, `Project ${index + 1}`) : item.name }}</option></select></label>
        <label>{{ isEnglish ? 'Resume version' : '简历版本' }}<select v-model="resumeId" class="input" data-testid="training-resume"><option value="">{{ isEnglish ? 'No specific resume' : '不指定简历' }}</option><option v-for="(item, index) in store.workspace?.resumeVariants" :key="item.id" :value="item.id">{{ isEnglish ? englishDisplay(item.name, `Resume ${index + 1}`) : item.name }}</option></select></label>
        <div class="form-grid two">
          <label>{{ isEnglish ? 'Practice language' : '训练语言' }}<select v-model="language" class="input" data-testid="training-language" :disabled="coachMode === 'english-interview'"><option value="zh-CN">中文</option><option value="en-US">English</option></select></label>
          <label>{{ isEnglish ? 'Practice mode' : '陪练模式' }}<select v-model="practiceMode" class="input" data-testid="training-mode"><option value="pressure">{{ isEnglish ? 'Pressure interview loop' : '压力面试闭环' }}</option><option value="standard">{{ isEnglish ? 'Standard mock interview' : '基础模拟面试' }}</option></select></label>
        </div>
        <label v-if="practiceMode === 'pressure'">{{ isEnglish ? 'Pressure interview rounds' : '压力面试轮数' }}<select v-model.number="maxRounds" class="input" data-testid="training-max-rounds"><option :value="2">{{ isEnglish ? '2 rounds · Quick calibration' : '2 轮快速校准' }}</option><option :value="4">{{ isEnglish ? '4 rounds · Core follow-ups' : '4 轮核心追问' }}</option><option :value="6">{{ isEnglish ? '6 rounds · Full practice' : '6 轮完整训练' }}</option><option :value="8">{{ isEnglish ? '8 rounds · Deep pressure interview' : '8 轮深度压力面试' }}</option></select></label>
        <div class="info-box"><strong>{{ isEnglish ? 'Current mode' : '本次模式' }}</strong><span>{{ practiceMode === 'pressure' ? (isEnglish ? `Strict follow-ups · ${maxRounds} rounds · Dynamic questions · Resume calibration` : `严格追问 · ${maxRounds} 轮 · 动态生成 · 回写项目经历`) : (isEnglish ? 'Mixed questions · Medium difficulty · 5 questions · Core scoring' : '综合问题 · 中等难度 · 5 题 · 基础评分') }}</span></div>
        <p v-if="setupMessage" class="form-error" role="alert">{{ setupMessage }}</p>
        <button class="button primary full" type="submit" data-testid="training-start">{{ isEnglish ? 'Start practice' : '开始训练' }}</button>
      </form>
    </div>

    <div v-else-if="active.status === 'completed' && active.summary" class="pressure-complete" data-testid="pressure-summary">
      <div class="pressure-complete-heading"><div><span class="eyebrow">CLOSED LOOP COMPLETE</span><h2>{{ isEnglish ? 'Pressure interview loop completed' : '压力面试闭环已完成' }}</h2><p>{{ isEnglish ? 'This is an evidence-based interview risk and resume calibration summary from the completed session.' : '下面不是泛化评分，而是基于本次问答形成的面试风险与简历校准清单。' }}</p></div><button class="button primary" type="button" @click="leaveSession">{{ isEnglish ? 'Back to practice setup' : '返回训练入口' }}</button></div>
      <div class="summary-grid">
        <section class="panel"><h3>{{ isEnglish ? 'Core strengths' : '核心竞争力' }}</h3><ul><li v-for="item in active.summary.coreStrengths" :key="item">{{ item }}</li></ul></section>
        <section class="panel risk"><h3>{{ isEnglish ? 'Three high-risk gaps' : '三个高风险漏洞' }}</h3><ul><li v-for="item in active.summary.highRiskGaps" :key="item">{{ item }}</li></ul></section>
        <section class="panel"><h3>{{ isEnglish ? 'Questions to practice' : '最需要练习的问题' }}</h3><ol><li v-for="item in active.summary.practiceQuestions" :key="item">{{ item }}</li></ol></section>
        <section class="panel"><h3>{{ isEnglish ? 'Resume updates' : '简历修改建议' }}</h3><ul><li v-for="item in active.summary.resumeSuggestions" :key="item">{{ item }}</li></ul></section>
        <section class="panel checklist"><h3>{{ isEnglish ? 'Final pre-interview checklist' : '面试前最终检查清单' }}</h3><label v-for="item in active.summary.checklist" :key="item"><input type="checkbox" />{{ item }}</label></section>
      </div>
    </div>

    <div v-else-if="currentQuestion" class="training-stage" data-testid="training-stage">
      <article class="question-card">
        <div class="question-meta"><span>{{ isEnglish ? `Round ${active.currentQuestionIndex + 1} / ${progressTotal}` : `第 ${active.currentQuestionIndex + 1} / ${progressTotal} ${active.mode === 'pressure' ? '轮' : '题'}` }}</span><span>{{ active.mode === 'pressure' ? 'PRESSURE' : currentQuestion.type }} · {{ currentQuestion.difficulty }} · {{ isEnglish ? 'EN' : '中文' }}</span></div>
        <h2 data-testid="training-question">{{ currentQuestion.text }}</h2>
        <p class="rationale">{{ isEnglish ? 'Why this question: ' : '提问依据：' }}{{ currentQuestion.rationale }}</p>
        <div class="question-tools"><div class="tag-row"><span v-for="keyword in currentQuestion.targetKeywords" :key="keyword">{{ keyword }}</span></div><button class="button light compact" type="button" data-testid="training-read-question" @click="readQuestion"><Volume2 :size="15" />{{ isEnglish ? 'Read aloud' : '朗读题目' }}</button></div>
      </article>

      <div class="answer-layout">
        <form class="panel answer-panel" @submit.prevent="submit">
          <div class="answer-label-row"><strong>{{ isEnglish ? 'Your answer' : '你的回答' }}</strong><button class="button secondary compact microphone-button" :class="{ recording: isListening }" type="button" data-testid="training-microphone" @click="toggleListening"><MicOff v-if="isListening" :size="15" /><Mic v-else :size="15" />{{ isListening ? (isEnglish ? 'Stop' : '停止录音') : (isEnglish ? 'Answer by voice' : '语音作答') }}</button></div>
          <textarea v-model="answer" class="input answer-textarea" required data-testid="training-answer" :placeholder="isEnglish ? 'Answer naturally as if this were a real interview.' : '像真实面试一样直接回答。可以卡顿，但不要背标准答案。'"></textarea>
          <p v-if="speechMessage" class="speech-message">{{ speechMessage }}</p>
          <div class="answer-footer"><small>{{ answer.length }} {{ isEnglish ? 'characters' : '字' }}</small><div class="button-row inline"><button class="button secondary" type="button" data-testid="training-recommended" :disabled="coachBusy" @click="requestCoach(true)">{{ coachBusy ? (isEnglish ? 'Generating…' : '生成中…') : (coachResult && showRecommended ? (isEnglish ? 'Regenerate' : '重新生成') : (isEnglish ? 'Recommended answer' : '查看推荐回答')) }}</button><button class="button primary" type="submit" data-testid="training-submit">{{ isEnglish ? 'Analyze answer' : '分析回答' }}</button></div></div>
          <p v-if="coachMessage" class="speech-message" role="status">{{ coachMessage }}</p>
        </form>

        <article class="panel feedback-panel" aria-live="polite">
          <div v-if="coachBusy && !submitted" class="feedback-placeholder"><div>AI</div><h3>{{ isEnglish ? 'Generating…' : '正在生成推荐回答…' }}</h3><p>{{ isEnglish ? 'The result will appear in this panel.' : '生成完成后会直接显示在当前区域，不需要向下滚动。' }}</p></div>
          <div v-else-if="coachResult && showRecommended && !submitted" class="coach-inline-result" data-testid="training-coach-result">
            <div class="coach-inline-heading"><div><span class="eyebrow">{{ coachResult.source === 'ai' ? 'AI 1V1 COACH' : 'LOCAL COACH' }}</span><h3>{{ isEnglish ? 'Recommended answer' : '推荐回答' }}</h3></div><span class="status-badge completed">{{ coachResult.source === 'ai' ? (isEnglish ? 'Remote AI' : '远程 AI') : (isEnglish ? 'Local fallback' : '本地降级') }}</span></div>
            <p class="recommended-answer" data-testid="training-recommended-answer">{{ coachResult.recommendedAnswer }}</p>
            <h4>{{ isEnglish ? 'Coach guidance' : '教练建议' }}</h4><p>{{ coachResult.feedback }}</p>
            <h4>{{ isEnglish ? 'Likely follow-up' : '可能追问' }}</h4><p>{{ coachResult.followUpQuestion }}</p>
            <small>{{ isEnglish ? 'Use the structure, not as a script. Keep every detail truthful.' : '只参考结构，不要背稿；所有细节必须来自真实经历。' }}</small>
          </div>
          <template v-else-if="submitted && latestAttempt">
            <div class="score-orbit"><strong data-testid="training-score">{{ latestAttempt.totalScore }}</strong><span>{{ isEnglish ? 'Overall score' : '综合得分' }}</span></div>
            <div class="dimension-list"><div v-for="item in latestAttempt.dimensions" :key="item.key" class="dimension-row"><span>{{ item.label }}</span><div><i :style="{ width: `${item.score}%` }"></i></div><b>{{ item.score }}</b></div></div>
            <div class="feedback-copy"><h4>{{ isEnglish ? 'Actionable feedback' : '具体建议' }}</h4><p v-for="item in latestAttempt.feedback" :key="item">{{ item }}</p><h4 v-if="latestAttempt.clarifyingQuestions.length">{{ isEnglish ? 'Before you retry' : '重答前想清楚' }}</h4><p v-for="item in latestAttempt.clarifyingQuestions" :key="item">• {{ item }}</p></div>
            <button class="button secondary full" type="button" data-testid="training-finalize" @click="finalize">{{ active.mode === 'pressure' ? (isEnglish ? 'Confirm and accept the follow-up' : '确认本轮并接受追问') : (isEnglish ? 'Save final answer and continue' : '保存本题最终回答并继续') }}</button>
          </template>
          <div v-else class="feedback-placeholder"><div>1V1</div><h3>{{ isEnglish ? 'Feedback appears after submission' : '提交后显示评分与反馈' }}</h3><p>{{ isEnglish ? 'You can also preview a recommended structure before answering.' : '也可以先查看推荐回答的结构，但请用自己的真实经历作答。' }}</p></div>
        </article>
      </div>

      <article v-if="coachResult && showRecommended && submitted" class="panel coach-panel" data-testid="training-coach-result">
        <div class="coach-heading"><div><span class="eyebrow">{{ coachResult.source === 'ai' ? 'AI PRESSURE INTERVIEWER' : 'LOCAL PRESSURE COACH' }}</span><h3>{{ isEnglish ? 'Answer diagnosis and resume calibration' : '回答拆解与简历同步校准' }}</h3></div><span class="status-badge completed">{{ coachResult.source === 'ai' ? (isEnglish ? 'Remote AI' : '远程 AI') : (isEnglish ? 'Local fallback' : '本地降级') }}</span></div>
        <div class="diagnosis-grid">
          <section><h4>{{ isEnglish ? 'Evidence gaps' : '证据不足' }}</h4><ul><li v-for="item in coachResult.diagnosis.evidenceGaps" :key="item">{{ item }}</li></ul></section>
          <section><h4>{{ isEnglish ? 'Structure / expression issues' : '结构 / 表达漏洞' }}</h4><ul><li v-for="item in coachResult.diagnosis.logicIssues" :key="item">{{ item }}</li></ul></section>
          <section class="challenge"><h4>{{ isEnglish ? 'Most likely interviewer challenge' : '面试官最可能继续质疑' }}</h4><p>{{ coachResult.diagnosis.interviewerChallenge }}</p></section>
        </div>
        <div class="coach-grid"><div><h4>{{ isEnglish ? 'Coach feedback' : '教练建议' }}</h4><p>{{ coachResult.feedback }}</p><h4>{{ isEnglish ? 'Next dynamic follow-up' : '下一轮动态追问' }}</h4><p>{{ coachResult.followUpQuestion }}</p></div><div><h4>{{ isEnglish ? 'Evidence-based STAR answer' : '基于真实证据整理的 STAR 回答' }}</h4><p class="recommended-answer" data-testid="training-recommended-answer">{{ coachResult.diagnosis.starAnswer || coachResult.recommendedAnswer }}</p><small>{{ isEnglish ? 'Keep missing facts marked as [CANDIDATE MUST ADD EVIDENCE]. Never invent data to make the answer sound stronger.' : '缺失信息必须保留“【需要本人补充】”，不要为让回答好看而编造数据。' }}</small></div></div>
        <div class="resume-sync"><div><h4>{{ isEnglish ? 'Resume update' : '是否需要同步修改简历' }}</h4><p>{{ coachResult.diagnosis.resumeSuggestion }}</p></div><button v-if="selectedProject && coachResult.diagnosis.resumeUpdateNeeded" class="button primary" type="button" data-testid="sync-resume-advice" :disabled="syncBusy" @click="syncResumeSuggestion">{{ syncBusy ? (isEnglish ? 'Syncing…' : '同步中…') : (isEnglish ? 'Sync to project' : '同步到项目经历') }}</button><span v-else class="status-badge completed">{{ isEnglish ? 'No structural update needed' : '无需结构性修改' }}</span></div>
      </article>
    </div>
  </section>
</template>
