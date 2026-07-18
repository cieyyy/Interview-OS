import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu() === null)).toBe(true);
    await expect(page.getByRole('heading', { name: '把经历变成可表达的能力' })).toBeVisible();
    await expect(page.getByTestId('dashboard-empty')).toBeVisible();
    await page.getByRole('button', { name: '加载演示数据' }).click();
    await expect(page.getByTestId('stat-projects')).toHaveText('1');

    const mockFileSelection = async (filePath: string) => {
      await app.evaluate(({ dialog }, selectedPath) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
      }, filePath);
    };

    const resumePath = path.join(dataDirectory, 'resume.txt');
    await writeFile(resumePath, '姓名：E2E用户\n当前岗位：运维工程师\n工作年限：2年\n学历：本科\n目标岗位：AI技术支持\n技能：Kubernetes:熟悉，Docker:掌握', 'utf8');
    await mockFileSelection(resumePath);
    await page.getByTestId('nav-profile').click();
    await page.getByTestId('profile-import-file').click();
    await expect(page.getByTestId('profile-role')).toHaveValue('运维工程师');
    await mkdir(path.resolve('artifacts'), { recursive: true });
    await page.screenshot({ path: path.resolve('artifacts', 'profile-import.png'), fullPage: true });
    await page.getByRole('button', { name: '保存职业档案' }).click();

    await page.getByTestId('nav-knowledge').click();
    const knowledgePath = path.join(dataDirectory, 'knowledge.md');
    await writeFile(knowledgePath, '# E2E 专用知识卡\n这是通过文件导入的 Kubernetes 故障排查内容。', 'utf8');
    await mockFileSelection(knowledgePath);
    await page.getByTestId('knowledge-import-file').click();
    await expect(page.getByTestId('knowledge-title')).toHaveValue('E2E 专用知识卡');
    await expect(page.getByTestId('knowledge-content')).toHaveValue(/Kubernetes/);
    await page.screenshot({ path: path.resolve('artifacts', 'knowledge-import.png'), fullPage: true });
    await page.getByTestId('knowledge-save').click();
    await expect(page.getByRole('button', { name: /E2E 专用知识卡/ })).toBeVisible();

    await page.getByTestId('nav-jobs').click();
    const jobPath = path.join(dataDirectory, 'job.txt');
    await writeFile(jobPath, '岗位名称：E2E 云原生技术支持\n公司名称：示例科技\n要求熟悉 Kubernetes、Docker、Linux、大模型 API，并具备日志排查和客户沟通能力。', 'utf8');
    await mockFileSelection(jobPath);
    await page.getByTestId('job-import-file').click();
    await expect(page.getByTestId('job-title')).toHaveValue('E2E 云原生技术支持');
    await page.screenshot({ path: path.resolve('artifacts', 'job-import.png'), fullPage: true });
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
    await page.getByTestId('knowledge-search').fill('请介绍一下');
    await expect(page.locator('.collection-list .collection-item')).toHaveCount(1);

    await app.close();
    appClosed = true;

    const restarted = await electron.launch({
      args: [
        '.',
        '--disable-gpu',
        '--disable-gpu-compositing',
        '--disable-gpu-sandbox',
        '--in-process-gpu',
        '--use-gl=swiftshader'
      ],
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
