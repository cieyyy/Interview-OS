import { expect, test, _electron as electron } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const executablePath = process.env.INTERVIEW_OS_PACKAGED_EXECUTABLE
  ? path.resolve(process.env.INTERVIEW_OS_PACKAGED_EXECUTABLE)
  : path.resolve('release', 'win-unpacked', 'Interview OS.exe');

test('packaged desktop application starts and can write isolated local data', async () => {
  test.setTimeout(process.platform === 'darwin' ? 90_000 : 45_000);
  test.skip(!existsSync(executablePath), 'Build the packaged application before the packaged smoke test.');

  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-packaged-'));
  const env = { ...process.env, INTERVIEW_OS_DATA_DIR: dataDirectory };
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    executablePath,
    args: process.platform === 'win32'
      ? [
          '--disable-gpu',
          '--disable-gpu-compositing',
          '--disable-gpu-sandbox',
          '--in-process-gpu',
          '--use-gl=swiftshader'
        ]
      : [],
    env
  });

  try {
    const page = await app.firstWindow();
    const hasApplicationMenu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu() !== null);
    expect(hasApplicationMenu).toBe(process.platform === 'darwin');
    await expect(page.getByRole('heading', { name: '今天，推进一件最重要的事' })).toBeVisible();
    await page.getByRole('button', { name: '加载演示数据' }).click();
    await expect(page.getByTestId('stat-projects')).toHaveText('1');
    await page.getByTestId('nav-profile').click();
    await page.getByTestId('profile-role').fill('打包版验证工程师');
    await page.getByRole('button', { name: '保存职业档案' }).click();
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('nav-profile').click();
    await expect(page.getByTestId('profile-role')).toHaveValue('打包版验证工程师');

    const artifacts = path.resolve('artifacts');
    await mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'packaged-dashboard.png'), fullPage: true });
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
