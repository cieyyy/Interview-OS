import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AtomicWorkspaceRepository } from '../storage/workspace-repository';
import { WorkspaceService } from './workspace-service';
import { JobSyncService } from './job-sync-service';

let root = '';
let bridge: JobSyncService;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'interview-job-sync-'));
  const repository = new AtomicWorkspaceRepository(root);
  await repository.initialize();
  bridge = new JobSyncService(new WorkspaceService(repository), 0);
});

afterEach(async () => {
  await bridge.stop();
  await rm(root, { recursive: true, force: true });
});

describe('JobSyncService', () => {
  it('accepts an authenticated Chrome extension batch on localhost', async () => {
    const status = await bridge.start();
    expect(status.running).toBe(true);
    const health = await fetch(`http://127.0.0.1:${status.port}/health`);
    expect(health.ok).toBe(true);

    const repository = new AtomicWorkspaceRepository(root);
    await repository.initialize();
    const token = repository.getState().settings.jobSyncToken;
    const response = await fetch(`http://127.0.0.1:${status.port}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Interview-OS-Token': token },
      body: JSON.stringify({
        token,
        sourceSite: 'boss',
        sourceName: 'BOSS 直聘',
        pageUrl: 'https://www.zhipin.com/web/geek/job',
        jobs: [{ sourceUrl: 'https://www.zhipin.com/job_detail/bridge.html', title: 'Bridge 测试岗位' }]
      })
    });
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ ok: true, added: 1, total: 1 });
  });

  it('rejects requests originating from ordinary websites', async () => {
    const status = await bridge.start();
    const response = await fetch(`http://127.0.0.1:${status.port}/jobs`, {
      method: 'POST',
      headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: '{}'
    });
    expect(response.status).toBe(403);
  });
});
