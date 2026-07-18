import { expect, test, _electron as electron } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const executablePath = path.resolve('release', 'win-unpacked', 'Interview OS.exe');

test('packaged Windows application starts and can write isolated local data', async () => {
  test.skip(!existsSync(executablePath), 'Run npm run package:win before the packaged smoke test.');

  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-packaged-'));
  const env = { ...process.env, INTERVIEW_OS_DATA_DIR: dataDirectory };
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    executablePath,
    args: ['--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-sandbox', '--in-process-gpu', '--use-gl=swiftshader'],
    env
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: '把经历变成可表达的能力' })).toBeVisible();
    await page.getByRole('button', { name: '加载演示数据' }).click();
    await expect(page.getByTestId('stat-projects')).toHaveText('1');
    await expect(page.getByTestId('stat-knowledge')).toHaveText('1');

    const artifacts = path.resolve('artifacts');
    await mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'packaged-dashboard.png'), fullPage: true });
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
