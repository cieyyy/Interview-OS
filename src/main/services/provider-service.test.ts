import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoState } from '../../shared/domain';
import { AtomicWorkspaceRepository } from '../storage/workspace-repository';
import { MemorySecretStore } from '../storage/secret-store';
import { ProviderService } from './provider-service';

let root = '';
let repository: AtomicWorkspaceRepository;
let service: ProviderService;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'interview-provider-'));
  repository = new AtomicWorkspaceRepository(root);
  await repository.initialize();
  await repository.replaceState(createDemoState());
  service = new ProviderService(repository, new MemorySecretStore());
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(root, { recursive: true, force: true });
});

describe('ProviderService career companion', () => {
  it('persists one pinned companion session and returns uncommitted memory suggestions', async () => {
    await service.save({
      kind: 'openai-compatible', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat', authMode: 'api-key', apiKey: 'test-key', enabled: true
    });
    const reply = {
      reply: '先把 Kubernetes 排障经历整理成 STAR，再针对目标岗位练习追问。',
      memorySuggestions: [{
        type: 'preference', content: '优先寻找云原生技术支持岗位', tags: ['方向偏好'], evidenceIds: []
      }]
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(reply) } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const result = await service.careerCompanion({ message: '我该怎么准备下一轮面试？' });
    const state = repository.getState();

    expect(result.source).toBe('ai');
    expect(result.memorySuggestions).toHaveLength(1);
    expect(state.careerMemory).toHaveLength(2);
    expect(state.coachSessions.filter((item) => item.mode === 'career-companion')).toHaveLength(1);
    expect(result.session.pinned).toBe(true);
    expect(result.session.messages.map((item) => item.role)).toEqual(['user', 'coach']);
  });

  it('keeps a useful local companion when no remote model is configured', async () => {
    const result = await service.careerCompanion({ message: '帮我梳理项目亮点' });

    expect(result.source).toBe('local');
    expect(result.reply).toContain('Kubernetes');
    expect(result.session.messages).toHaveLength(2);
  });
});
