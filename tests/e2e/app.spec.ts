import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('desktop MVP completes the offline interview workflow and persists data', async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-e2e-'));
  const browserDataDirectory = path.join(dataDirectory, 'chromium');
  const browserCacheDirectory = path.join(dataDirectory, 'chromium-cache');
  const env = { ...process.env, INTERVIEW_OS_DATA_DIR: dataDirectory };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: [
      '.',
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--disable-gpu-sandbox',
      '--use-gl=swiftshader',
      `--user-data-dir=${browserDataDirectory}`,
      `--disk-cache-dir=${browserCacheDirectory}`,
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
    await writeFile(resumePath, [
      '姓名：E2E用户',
      '当前岗位：运维工程师',
      '工作年限：2年',
      '学历：本科',
      '目标岗位：AI技术支持',
      '技能：Kubernetes:熟悉，Docker:掌握',
      '项目经历',
      '项目名称：E2E 算力平台',
      '项目角色：平台运维',
      '项目背景：负责画布与模型中转平台。',
      '个人职责：负责 ACK 发布和 API 联调。',
      '技术栈：Kubernetes，ACK，ACR',
      '项目结果：完成版本上线。',
      '项目名称：E2E 成本系统',
      '项目角色：运维工程师',
      '项目背景：内部成本管理。',
      '个人职责：负责自动部署和运行维护。',
      '项目结果：系统稳定运行。',
      '教育背景',
      '本科'
    ].join('\n'), 'utf8');
    await mockFileSelection(resumePath);
    await page.getByTestId('nav-profile').click();
    await page.getByTestId('profile-import-file').click();
    await expect(page.getByTestId('profile-role')).toHaveValue('运维工程师');
    await expect(page.getByTestId('profile-import-summary')).toContainText('2 段项目经历');
    await expect(page.getByText('识别方式说明')).toBeVisible();
    await mkdir(path.resolve('artifacts'), { recursive: true });
    await page.screenshot({ path: path.resolve('artifacts', 'profile-import.png'), fullPage: true });
    await page.getByRole('button', { name: '保存职业档案' }).click();
    await page.getByTestId('profile-project-tab').click();
    await expect(page.locator('.project-card')).toHaveCount(3);
    const importedProject = page.locator('.project-card', { hasText: 'E2E 算力平台' });
    await importedProject.getByRole('button', { name: '编辑' }).click();
    await expect(page.getByTestId('project-name')).toHaveValue('E2E 算力平台');
    await page.getByTestId('project-results').fill('完成版本上线并通过接口验证。');
    await page.getByTestId('project-save').click();
    await expect(importedProject).toContainText('完成版本上线并通过接口验证');

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
    await page.getByTestId('training-language').selectOption('en-US');
    await page.getByTestId('training-max-rounds').selectOption('2');
    await page.getByTestId('training-start').click();
    await expect(page.getByTestId('training-stage')).toBeVisible();
    await expect(page.getByTestId('training-question')).toContainText('Please introduce');
    expect(await page.getByTestId('training-stage').innerText()).not.toMatch(/[\u3400-\u9fff]/u);
    await expect(page.getByTestId('training-microphone')).toBeVisible();
    await page.getByTestId('training-recommended').click();
    await expect(page.getByTestId('training-recommended-answer')).toContainText('[CANDIDATE MUST ADD EVIDENCE]');
    expect(await page.getByTestId('training-stage').innerText()).not.toMatch(/[\u3400-\u9fff]/u);
    await page.screenshot({ path: path.resolve('artifacts', 'training-v0.4.png'), fullPage: true });
    await page.getByTestId('training-answer').fill(
      'The background was a failed canvas request. I was responsible for API integration and log diagnosis. I checked the service logs and configuration, found an inconsistent model mapping, coordinated the fix, redeployed it, and verified that the API recovered.'
    );
    const firstPressureQuestion = await page.getByTestId('training-question').innerText();
    await page.getByTestId('training-submit').click();
    await expect(page.getByTestId('training-score')).toBeVisible();
    await expect(page.locator('.coach-panel')).toContainText('Evidence gaps');
    await expect(page.locator('.coach-panel')).toContainText('Structure / expression issues');
    expect(await page.getByTestId('training-stage').innerText()).not.toMatch(/[\u3400-\u9fff]/u);
    await page.getByTestId('sync-resume-advice').click();
    await page.getByTestId('training-finalize').click();
    await expect(page.getByTestId('training-question')).not.toHaveText(firstPressureQuestion);
    await expect(page.locator('.question-meta')).toContainText('Round 2 / 2');
    await page.getByTestId('training-answer').fill('I personally checked the logs, corrected the Deployment configuration, and used the API test record to verify that the service recovered.');
    await page.getByTestId('training-submit').click();
    await expect(page.locator('.coach-panel')).toContainText('Next dynamic follow-up');
    await page.screenshot({ path: path.resolve('artifacts', 'training-pressure-diagnosis.png'), fullPage: true });
    await page.getByTestId('training-finalize').click();
    await expect(page.getByTestId('pressure-summary')).toBeVisible();
    await expect(page.getByTestId('pressure-summary')).toContainText('Core strengths');
    expect(await page.getByTestId('pressure-summary').innerText()).not.toMatch(/[\u3400-\u9fff]/u);
    await page.screenshot({ path: path.resolve('artifacts', 'training-pressure-summary.png'), fullPage: true });

    await page.getByTestId('nav-profile').click();
    await page.getByTestId('profile-project-tab').click();
    const calibratedProject = page.locator('.project-card').filter({ hasText: /AI/ }).first();
    await expect(calibratedProject.locator('.project-calibration')).toHaveText(/\S{10,}/);

    await page.getByTestId('nav-reports').click();
    await page.locator('.session-row').first().click();
    await expect(page.getByTestId('training-history-detail')).toBeVisible();
    await expect(page.getByTestId('history-answer').first()).toContainText('failed canvas request');
    await expect(page.locator('.history-diagnosis').first()).toContainText('简历同步建议');
    await expect(page.getByTestId('history-pressure-summary')).toBeVisible();
    await page.screenshot({ path: path.resolve('artifacts', 'reports-v0.4.png'), fullPage: true });

    await page.getByTestId('nav-assistant').click();
    await expect(page.locator('.assistant-card')).toHaveCount(1);
    await expect(page.getByTestId('assistant-enter-training')).toBeVisible();
    await page.screenshot({ path: path.resolve('artifacts', 'assistant-v0.4.png'), fullPage: true });

    await page.getByTestId('nav-settings').click();
    await expect(page.locator('.settings-card')).toHaveCount(4);
    await mockFileSelection(dataDirectory);
    await page.getByTestId('obsidian-create-vault').click();
    await expect(page.getByTestId('obsidian-settings')).toContainText('Interview-OS-Vault');
    await page.getByTestId('obsidian-preview').click();
    await expect(page.getByTestId('obsidian-preview-list')).toBeVisible();
    await page.getByTestId('obsidian-run-sync').click();
    await expect(page.getByTestId('obsidian-feedback')).toContainText('同步完成');
    await expect(page.getByTestId('obsidian-feedback')).toContainText('失败 0');
    const persistedWorkspace = JSON.parse(await readFile(path.join(dataDirectory, 'database', 'state.json'), 'utf8')) as {
      obsidianSyncIndex: Array<{ entityType: string; title: string; filePath: string }>;
    };
    const projectEntry = persistedWorkspace.obsidianSyncIndex.find((item) =>
      item.entityType === 'project' && item.title === 'AI 漫剧算力平台'
    );
    expect(projectEntry).toBeTruthy();
    const obsidianProjectPath = path.join(dataDirectory, 'Interview-OS-Vault', projectEntry!.filePath);
    const obsidianProject = await readFile(obsidianProjectPath, 'utf8');
    expect(obsidianProject).toContain('interview_os_id:');
    expect(obsidianProject).toContain('<!-- interview-os:managed:start -->');
    await page.screenshot({ path: path.resolve('artifacts', 'settings-v0.5-obsidian.png'), fullPage: true });

    await page.getByTestId('nav-knowledge').click();
    await page.getByTestId('knowledge-search').fill('Please introduce');
    await expect(page.locator('.collection-list .collection-item')).toHaveCount(1);
    await page.getByTestId('nav-settings').click();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByTestId('obsidian-disconnect').click();
    await expect(page.getByTestId('obsidian-settings')).toContainText('未启用');
    await page.getByTestId('nav-knowledge').click();
    await expect(page.getByRole('button', { name: /E2E 专用知识卡/ })).toBeVisible();

    await app.close();
    appClosed = true;

    const restarted = await electron.launch({
      args: [
        '.',
        '--disable-gpu',
        '--disable-gpu-compositing',
        '--disable-gpu-sandbox',
        '--use-gl=swiftshader',
        `--user-data-dir=${browserDataDirectory}`,
        `--disk-cache-dir=${browserCacheDirectory}`
      ],
      cwd: process.cwd(),
      env
    });
    try {
      const restartedPage = await restarted.firstWindow();
      await expect(restartedPage.getByTestId('stat-knowledge')).toHaveText('4');
      await expect(restartedPage.getByTestId('stat-jobs')).toHaveText('1');
    } finally {
      await restarted.close();
    }
  } finally {
    if (!appClosed) await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
