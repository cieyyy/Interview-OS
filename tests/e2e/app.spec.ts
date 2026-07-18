import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('desktop MVP completes the offline interview workflow and persists data', async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-e2e-'));
  const env = { ...process.env, INTERVIEW_OS_DATA_DIR: dataDirectory };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: [
      '.',
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-gpu-sandbox',
      '--in-process-gpu',
      '--use-gl=swiftshader',
      '--enable-logging=stderr'
    ],
    cwd: process.cwd(),
    env
  });
  const stderr: string[] = [];
  app.process().stderr?.on('data', (chunk) => stderr.push(String(chunk)));
  let appClosed = false;

  try {
    const page = await app.firstWindow();
    page.on('pageerror', (error) => console.log(`Renderer page error: ${error.message}`));
    page.on('console', (message) => console.log(`Renderer console ${message.type()}: ${message.text()}`));
    page.on('crash', () => console.log(`Renderer crashed. Electron stderr:\n${stderr.join('')}`));
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: '把经历变成可表达的能力' })).toBeVisible();
    await expect(page.getByTestId('dashboard-empty')).toBeVisible();
    await page.getByRole('button', { name: '加载演示数据' }).click();
    await expect(page.getByTestId('stat-projects')).toHaveText('1');

    await page.getByTestId('nav-knowledge').click();
    await page.getByTestId('knowledge-title').fill('E2E 专用知识卡');
    await page.getByTestId('knowledge-content').fill('Kubernetes 故障排查需要先查看 Events 和容器日志。');
    await page.getByTestId('knowledge-save').click();
    await expect(page.getByRole('button', { name: /E2E 专用知识卡/ })).toBeVisible();

    await page.getByTestId('nav-jobs').click();
    await page.getByTestId('job-add').click();
    await page.getByTestId('job-title').fill('E2E 云原生技术支持');
    await page.getByTestId('job-raw').fill('要求熟悉 Kubernetes、Docker、Linux、大模型 API，并具备日志排查和客户沟通能力。');
    await page.getByTestId('job-analyze').click();
    await expect(page.getByTestId('job-detail')).toContainText('Kubernetes');

    await page.getByTestId('nav-training').click();
    const jobOptionValue = await page
      .getByTestId('training-job')
      .locator('option', { hasText: 'E2E 云原生技术支持' })
      .getAttribute('value');
    expect(jobOptionValue).toBeTruthy();
    await page.getByTestId('training-job').selectOption(jobOptionValue!);
    await page.getByTestId('training-project').selectOption({ label: 'AI 漫剧算力平台' });
    await page.getByTestId('training-start').click();
    await expect(page.getByTestId('training-stage')).toBeVisible();
    await page.getByTestId('training-answer').fill(
      '背景是画布调用算力平台失败。我负责接口联调和日志排查。我通过平台日志、接口测试和配置对比发现模型映射不一致，协调开发修复后重新部署，并通过业务接口验证最终恢复。'
    );
    await page.getByTestId('training-submit').click();
    await expect(page.getByTestId('training-score')).toBeVisible();
    await page.getByTestId('training-finalize').click();

    await page.getByTestId('nav-knowledge').click();
    await expect(page.locator('.collection-list .collection-item')).toHaveCount(3);

    await app.close();
    appClosed = true;

    const restarted = await electron.launch({
      args: ['.', '--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-sandbox', '--in-process-gpu', '--use-gl=swiftshader'],
      cwd: process.cwd(),
      env
    });
    try {
      const restartedPage = await restarted.firstWindow();
      await expect(restartedPage.getByTestId('stat-knowledge')).toHaveText('3');
      await expect(restartedPage.getByTestId('stat-jobs')).toHaveText('1');
    } finally {
      await restarted.close();
    }
  } finally {
    if (!appClosed) await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
