import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('removed modules redirect safely and connector verification states are honest', async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-integrity-'));
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
    await page.locator('[aria-label="关闭完成消息"]').click();

    await expect(page.getByTestId('nav-knowledge')).toHaveCount(0);
    await expect(page.getByTestId('nav-projects')).toHaveCount(0);
    await expect(page.getByTestId('nav-data-center')).toHaveCount(0);
    await expect(page.getByTestId('nav-job-insights')).toHaveCount(0);
    await page.evaluate(() => { window.location.hash = '#/projects'; });
    await expect(page.getByTestId('nav-profile')).toHaveClass(/active/);
    await expect(page.getByTestId('profile-project-tab')).toHaveClass(/active/);
    await page.evaluate(() => { window.location.hash = '#/knowledge'; });
    await expect(page.getByTestId('nav-profile')).toHaveClass(/active/);

    await page.getByTestId('nav-job-sync').click();
    await page.getByTestId('job-sync-tab-sources').click();
    const liveCheck = page.getByRole('button', { name: '真实连通测试' });
    await expect(liveCheck).toBeEnabled();
    await expect(page.getByRole('button', { name: '检查页面适配器' }).first()).toBeEnabled();
    await liveCheck.click();
    await expect(page.locator('.toast')).toContainText('真实连通');
    await expect(page.locator('.toast')).toContainText('不代表招聘网站抓取已成功');
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
