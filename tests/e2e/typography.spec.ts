import { test, expect, _electron as electron } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('all product modules use the shared typography scale', async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-type-e2e-'));
  const env = { ...process.env, INTERVIEW_OS_DATA_DIR: dataDirectory };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', '--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
    cwd: process.cwd(),
    env
  });

  const modules = [
    'dashboard',
    'career-agent',
    'knowledge',
    'job-sync',
    'job-insights',
    'companies',
    'applications',
    'resumes',
    'skill-graph',
    'data-center',
    'calendar',
    'training',
    'reports',
    'assistant',
    'settings'
  ];

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: '加载演示数据' }).click();
    await mkdir(path.resolve('artifacts', 'typography'), { recursive: true });

    for (const module of modules) {
      await page.getByTestId(`nav-${module}`).click();
      await page.locator('.content-area > section').waitFor({ state: 'visible' });
      const undersized = await page.evaluate(() => {
        const elements = [...document.querySelectorAll<HTMLElement>('body *')];
        return elements.flatMap((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const ownText = [...element.childNodes].some((node) =>
            node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
          );
          const isTextControl = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
          const size = Number.parseFloat(style.fontSize);
          if (
            (ownText || isTextControl)
            && rect.width > 0
            && rect.height > 0
            && style.visibility !== 'hidden'
            && style.display !== 'none'
            && size < 11
          ) {
            return [{
              tag: element.tagName.toLowerCase(),
              className: element.className,
              text: (element.textContent ?? '').trim().slice(0, 60),
              size
            }];
          }
          return [];
        }).slice(0, 30);
      });
      expect(undersized, `${module} contains text below 11px`).toEqual([]);
      await page.screenshot({ path: path.resolve('artifacts', 'typography', `${module}.png`), fullPage: true });
    }
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
