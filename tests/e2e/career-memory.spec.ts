import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('career memory keeps one companion conversation and supports local model presets', async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-memory-'));
  const env = { ...process.env, INTERVIEW_OS_DATA_DIR: dataDirectory };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', '--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
    cwd: process.cwd(),
    env
  });

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: '加载演示数据' }).click();
    await page.getByTestId('nav-career-memory').click();

    await expect(page.getByRole('heading', { name: '职业记忆' })).toBeVisible();
    await expect(page.locator('.career-context-panel')).toContainText('AI 大模型技术支持工程师');
    await page.locator('.companion-composer textarea').fill('结合我的项目，给我一个面试准备重点。');
    await page.locator('.companion-composer').getByRole('button', { name: '发送' }).click();
    await expect(page.locator('.companion-message')).toHaveCount(2);
    await expect(page.getByTestId('career-companion-messages')).toContainText('Kubernetes');

    await page.getByTestId('career-context-export').click();
    await expect.poll(async () => readFile(path.join(dataDirectory, 'exports', 'AI_CONTEXT.md'), 'utf8')).toContain('# 我的职业 AI 上下文');

    await mkdir(path.resolve('artifacts'), { recursive: true });
    await page.screenshot({ path: path.resolve('artifacts', 'career-memory.png'), fullPage: true, animations: 'disabled' });

    await page.getByTestId('nav-settings').click();
    await page.getByTestId('provider-preset').selectOption('ollama');
    await expect(page.getByTestId('provider-model')).toHaveValue('qwen2.5:7b');
    await expect(page.getByTestId('provider-auth-mode')).toHaveValue('none');
    await expect(page.getByTestId('provider-api-key')).toHaveCount(0);
    await expect(page.getByTestId('provider-form')).toContainText('本地模型不产生云 API 调用费用');
  } finally {
    await app.close();
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
