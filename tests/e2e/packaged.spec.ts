import { expect, test, _electron as electron } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
    await expect(page.getByTestId('stat-knowledge')).toHaveText('1');

    const knowledgePath = path.join(dataDirectory, 'packaged-import.md');
    await writeFile(knowledgePath, '# 打包版导入验证\nKubernetes 发布与日志排查。', 'utf8');
    await app.evaluate(({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
    }, knowledgePath);
    await page.getByTestId('nav-knowledge').click();
    await page.getByTestId('knowledge-import-file').click();
    await expect(page.getByTestId('knowledge-title')).toHaveValue('打包版导入验证');
    await expect(page.getByTestId('knowledge-content')).toHaveValue(/Kubernetes/);

    const artifacts = path.resolve('artifacts');
    await mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'packaged-dashboard.png'), fullPage: true });
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
