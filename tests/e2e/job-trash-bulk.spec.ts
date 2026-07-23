import { expect, test, _electron as electron } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('job trash supports selecting and restoring multiple jobs', async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-trash-e2e-'));
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

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: '加载演示数据' }).click();
    await page.locator('[aria-label="关闭完成消息"]').click();
    await page.getByTestId('nav-job-sync').click();

    await page.getByTitle('移入回收站').first().click();
    await page.getByTitle('移入回收站').first().click();
    await page.getByTestId('job-status-filter').selectOption('trashed');
    await page.getByTestId('job-bulk-toggle').click();
    await page.getByTestId('job-bulk-select-visible').check();

    await expect(page.getByTestId('job-bulk-toolbar')).toContainText('已选择 2 个岗位');
    await expect(page.getByTestId('job-bulk-restore')).toBeEnabled();
    await expect(page.getByTestId('job-bulk-delete-forever')).toBeEnabled();
    await mkdir(path.resolve('artifacts'), { recursive: true });
    await page.screenshot({ path: path.resolve('artifacts', 'job-trash-bulk.png'), animations: 'disabled' });

    await page.getByTestId('job-bulk-restore').click();
    await expect(page.locator('.toast')).toContainText('已恢复 2 个岗位');
    await page.getByTestId('job-status-filter').selectOption('active');
    await expect(page.locator('.synced-job-row')).toHaveCount(3);
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
