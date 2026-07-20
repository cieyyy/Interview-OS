<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TrainingCoachResult, TrainingLanguage } from '../../shared/domain';
import PageHeader from '../components/PageHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

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

const { store, startTraining, submitTraining, finalizeTraining, coachTraining } = useWorkspace();
const jobId = ref('');
const projectId = ref('');
const language = ref<TrainingLanguage>('zh-CN');
const practiceMode = ref<'standard' | 'ai-coach'>('ai-coach');
const answer = ref('');
const submitted = ref(false);
const coachResult = ref<TrainingCoachResult>();
const coachBusy = ref(false);
const showRecommended = ref(false);
const coachMessage = ref('');
const isListening = ref(false);
const speechMessage = ref('');
let recognition: SpeechRecognitionLike | undefined;

const active = computed(() => store.activeSession);
const currentQuestion = computed(() => active.value?.questions[active.value.currentQuestionIndex]);
const latestAttempt = computed(() => {
  if (!active.value || !currentQuestion.value) return undefined;
  return [...active.value.attempts].reverse().find((item) => item.questionId === currentQuestion.value?.id);
});
const isEnglish = computed(() => (active.value?.language ?? language.value) === 'en-US');

function localRecommendedAnswer(languageValue: TrainingLanguage): string {
  const project = store.workspace?.projects.find((item) => item.id === active.value?.projectId);
  if (!project) {
    return languageValue === 'en-US'
      ? 'Start with the context, explain your responsibility, describe the concrete actions you took, and close with a verifiable result. Replace each part with your own experience.'
      : '可以先说明事情背景，再讲清楚自己的职责和采取的具体行动，最后用可验证的结果收尾。请把每一部分替换成自己的真实经历。';
  }
  return languageValue === 'en-US'
    ? `The context was ${project.background} My responsibility was ${project.responsibilities} ${project.actions ? `I took the following actions: ${project.actions}` : ''} The result was ${project.results}`
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
  const session = await startTraining({
    jobId: jobId.value || undefined,
    projectId: projectId.value || undefined,
    type: 'mixed', difficulty: 'medium', questionCount: 5, language: language.value
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
        feedback: `远程陪练请求未完成，已显示本地推荐结构。${store.error ? `原因：${store.error}` : ''}`,
        recommendedAnswer: localRecommendedAnswer(languageValue),
        followUpQuestion: languageValue === 'en-US'
          ? 'Which part of this answer can you support with a concrete action and result?'
          : '这段回答中，哪一部分可以补充你亲自完成的动作和可验证结果？',
        source: 'local'
      };
      coachMessage.value = '远程 AI 未返回可显示内容，已自动切换到本地推荐回答。';
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
    if (practiceMode.value === 'ai-coach') await requestCoach(true, submittedAnswer);
  }
}

async function finalize(): Promise<void> {
  if (!active.value || !currentQuestion.value) return;
  const previousQuestionId = currentQuestion.value.id;
  const value = await finalizeTraining({ sessionId: active.value.id, questionId: previousQuestionId, answer: answer.value });
  if (value) resetQuestionState();
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
    speechMessage.value = '当前系统不支持语音识别，请使用文字输入或更新系统语音组件。';
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
    speechMessage.value = `语音识别未完成：${event.error}`;
    isListening.value = false;
  };
  recognition.onend = () => { isListening.value = false; };
  try {
    recognition.start();
    isListening.value = true;
    speechMessage.value = isEnglish.value ? 'Listening… Speak naturally.' : '正在听取，请自然作答…';
  } catch (error) {
    speechMessage.value = error instanceof Error ? error.message : '麦克风启动失败';
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
    <PageHeader eyebrow="PRACTICE" title="面试训练" description="支持中英文、麦克风作答、AI 1V1 陪练与可追溯的推荐回答。">
      <button v-if="active" class="button ghost" type="button" @click="leaveSession">结束本次训练</button>
    </PageHeader>

    <div v-if="!active" class="training-setup">
      <div class="setup-copy"><span class="eyebrow">1V1 PRACTICE</span><h2>先说真实答案，再获得教练建议</h2><p>AI 已配置时调用远程模型；未配置或接口暂时不可用时自动使用本地教练，不会阻塞训练。</p><ul><li>中文与 English 两种训练语言</li><li>文字输入与麦克风语音识别</li><li>评分、教练反馈、推荐回答与追问</li></ul></div>
      <form class="panel setup-form" data-testid="training-setup" @submit.prevent="start">
        <h3>设置训练范围</h3>
        <label>目标 JD<select v-model="jobId" class="input" data-testid="training-job"><option value="">综合训练</option><option v-for="job in store.workspace?.jobs" :key="job.id" :value="job.id">{{ job.company }} · {{ job.title }}</option></select></label>
        <label>项目经历<select v-model="projectId" class="input" data-testid="training-project"><option value="">不指定项目</option><option v-for="item in store.workspace?.projects" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <div class="form-grid two">
          <label>训练语言<select v-model="language" class="input" data-testid="training-language"><option value="zh-CN">中文</option><option value="en-US">English</option></select></label>
          <label>陪练模式<select v-model="practiceMode" class="input" data-testid="training-mode"><option value="ai-coach">AI 1V1 陪练</option><option value="standard">基础评分</option></select></label>
        </div>
        <div class="info-box"><strong>本次模式</strong><span>综合问题 · 中等难度 · 5 题 · 支持文字与语音</span></div>
        <button class="button primary full" type="submit" data-testid="training-start">开始训练</button>
      </form>
    </div>

    <div v-else-if="currentQuestion" class="training-stage" data-testid="training-stage">
      <article class="question-card">
        <div class="question-meta"><span>第 {{ active.currentQuestionIndex + 1 }} / {{ active.questions.length }} 题</span><span>{{ currentQuestion.type }} · {{ currentQuestion.difficulty }} · {{ isEnglish ? 'EN' : '中文' }}</span></div>
        <h2 data-testid="training-question">{{ currentQuestion.text }}</h2>
        <p class="rationale">{{ isEnglish ? 'Why this question: ' : '提问依据：' }}{{ currentQuestion.rationale }}</p>
        <div class="question-tools"><div class="tag-row"><span v-for="keyword in currentQuestion.targetKeywords" :key="keyword">{{ keyword }}</span></div><button class="button light compact" type="button" data-testid="training-read-question" @click="readQuestion">🔊 {{ isEnglish ? 'Read aloud' : '朗读题目' }}</button></div>
      </article>

      <div class="answer-layout">
        <form class="panel answer-panel" @submit.prevent="submit">
          <div class="answer-label-row"><strong>{{ isEnglish ? 'Your answer' : '你的回答' }}</strong><button class="button secondary compact microphone-button" :class="{ recording: isListening }" type="button" data-testid="training-microphone" @click="toggleListening">🎙 {{ isListening ? (isEnglish ? 'Stop' : '停止录音') : (isEnglish ? 'Answer by voice' : '语音作答') }}</button></div>
          <textarea v-model="answer" class="input answer-textarea" required data-testid="training-answer" :placeholder="isEnglish ? 'Answer naturally as if this were a real interview.' : '像真实面试一样直接回答。可以卡顿，但不要背标准答案。'"></textarea>
          <p v-if="speechMessage" class="speech-message">{{ speechMessage }}</p>
          <div class="answer-footer"><small>{{ answer.length }} {{ isEnglish ? 'characters' : '字' }}</small><div class="button-row inline"><button class="button secondary" type="button" data-testid="training-recommended" :disabled="coachBusy" @click="requestCoach(true)">{{ coachBusy ? '生成中…' : (coachResult && showRecommended ? (isEnglish ? 'Regenerate' : '重新生成') : (isEnglish ? 'Recommended answer' : '查看推荐回答')) }}</button><button class="button primary" type="submit" data-testid="training-submit">{{ isEnglish ? 'Analyze answer' : '分析回答' }}</button></div></div>
          <p v-if="coachMessage" class="speech-message" role="status">{{ coachMessage }}</p>
        </form>

        <article class="panel feedback-panel" aria-live="polite">
          <div v-if="coachBusy && !submitted" class="feedback-placeholder"><div>AI</div><h3>{{ isEnglish ? 'Generating…' : '正在生成推荐回答…' }}</h3><p>{{ isEnglish ? 'The result will appear in this panel.' : '生成完成后会直接显示在当前区域，不需要向下滚动。' }}</p></div>
          <div v-else-if="coachResult && showRecommended && !submitted" class="coach-inline-result" data-testid="training-coach-result">
            <div class="coach-inline-heading"><div><span class="eyebrow">{{ coachResult.source === 'ai' ? 'AI 1V1 COACH' : 'LOCAL COACH' }}</span><h3>{{ isEnglish ? 'Recommended answer' : '推荐回答' }}</h3></div><span class="status-badge completed">{{ coachResult.source === 'ai' ? '远程 AI' : '本地降级' }}</span></div>
            <p class="recommended-answer" data-testid="training-recommended-answer">{{ coachResult.recommendedAnswer }}</p>
            <h4>{{ isEnglish ? 'Coach guidance' : '教练建议' }}</h4><p>{{ coachResult.feedback }}</p>
            <h4>{{ isEnglish ? 'Likely follow-up' : '可能追问' }}</h4><p>{{ coachResult.followUpQuestion }}</p>
            <small>{{ isEnglish ? 'Use the structure, not as a script. Keep every detail truthful.' : '只参考结构，不要背稿；所有细节必须来自真实经历。' }}</small>
          </div>
          <template v-else-if="submitted && latestAttempt">
            <div class="score-orbit"><strong data-testid="training-score">{{ latestAttempt.totalScore }}</strong><span>{{ isEnglish ? 'Overall score' : '综合得分' }}</span></div>
            <div class="dimension-list"><div v-for="item in latestAttempt.dimensions" :key="item.key" class="dimension-row"><span>{{ item.label }}</span><div><i :style="{ width: `${item.score}%` }"></i></div><b>{{ item.score }}</b></div></div>
            <div class="feedback-copy"><h4>{{ isEnglish ? 'Actionable feedback' : '具体建议' }}</h4><p v-for="item in latestAttempt.feedback" :key="item">{{ item }}</p><h4 v-if="latestAttempt.clarifyingQuestions.length">{{ isEnglish ? 'Before you retry' : '重答前想清楚' }}</h4><p v-for="item in latestAttempt.clarifyingQuestions" :key="item">• {{ item }}</p></div>
            <button class="button secondary full" type="button" data-testid="training-finalize" @click="finalize">{{ isEnglish ? 'Save final answer and continue' : '保存本题最终回答并继续' }}</button>
          </template>
          <div v-else class="feedback-placeholder"><div>1V1</div><h3>{{ isEnglish ? 'Feedback appears after submission' : '提交后显示评分与反馈' }}</h3><p>{{ isEnglish ? 'You can also preview a recommended structure before answering.' : '也可以先查看推荐回答的结构，但请用自己的真实经历作答。' }}</p></div>
        </article>
      </div>

      <article v-if="coachResult && showRecommended && submitted" class="panel coach-panel" data-testid="training-coach-result">
        <div class="coach-heading"><div><span class="eyebrow">{{ coachResult.source === 'ai' ? 'AI 1V1 COACH' : 'LOCAL COACH' }}</span><h3>{{ isEnglish ? 'Coach guidance and recommended answer' : '陪练建议与推荐回答' }}</h3></div><span class="status-badge completed">{{ coachResult.source === 'ai' ? '远程 AI' : '本地降级' }}</span></div>
        <div class="coach-grid"><div><h4>{{ isEnglish ? 'Coach feedback' : '教练建议' }}</h4><p>{{ coachResult.feedback }}</p><h4>{{ isEnglish ? 'Likely follow-up' : '可能追问' }}</h4><p>{{ coachResult.followUpQuestion }}</p></div><div><h4>{{ isEnglish ? 'Recommended answer' : '推荐回答' }}</h4><p class="recommended-answer" data-testid="training-recommended-answer">{{ coachResult.recommendedAnswer }}</p><small>{{ isEnglish ? 'Use the structure, not as a script. Keep every detail truthful.' : '只参考结构，不要背稿；所有细节必须来自真实经历。' }}</small></div></div>
      </article>
    </div>
  </section>
</template>
