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
    'profile',
    'coach',
    'resumes',
    'job-sync',
    'jobs',
    'applications',
    'companies',
    'skill-graph',
    'settings'
  ];

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: '加载演示数据' }).click();
    const notice = page.locator('[aria-label="关闭完成消息"]');
    await notice.waitFor({ state: 'visible' });
    await notice.click();
    await mkdir(path.resolve('artifacts', 'typography'), { recursive: true });

    for (const module of modules) {
      await page.getByTestId(`nav-${module}`).click();
      await page.waitForFunction((id) => document.querySelector(`[data-testid="nav-${id}"]`)?.classList.contains('active'), module);
      await page.locator('.content-area > section').waitFor({ state: 'visible' });
      await page.locator('.content-area').evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
      const typographyIssues = await page.evaluate(() => {
        const allowedFontSizes = new Set([12, 14, 16, 18, 24]);
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
            && !allowedFontSizes.has(size)
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
      expect(typographyIssues, `${module} contains text outside the shared 12/14/16/18/24px scale`).toEqual([]);
      const layout = await page.evaluate(() => {
        const content = document.querySelector<HTMLElement>('.content-area');
        const header = document.querySelector<HTMLElement>('.page-header');
        if (!content || !header) return null;
        const contentStyle = getComputedStyle(content);
        return {
          paddingLeft: Number.parseFloat(contentStyle.paddingLeft),
          paddingRight: Number.parseFloat(contentStyle.paddingRight),
          headerMarginBottom: Number.parseFloat(getComputedStyle(header).marginBottom),
          horizontalOverflow: content.scrollWidth > content.clientWidth + 1
        };
      });
      expect(layout, `${module} is missing the shared page layout`).toEqual({
        paddingLeft: 24,
        paddingRight: 24,
        headerMarginBottom: 24,
        horizontalOverflow: false
      });
      await page.screenshot({ path: path.resolve('artifacts', 'typography', `${module}.png`), fullPage: true });
    }
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
