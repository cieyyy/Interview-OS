import { test, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function expectParentActive(page: Page, parent: string): Promise<void> {
  await expect(page.getByTestId(`nav-${parent}`)).toHaveClass(/active/);
  await expect(page.locator('.nav-item.active')).toHaveCount(1);
}

async function expectSharedLayout(page: Page, name: string): Promise<void> {
  const audit = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('.content-area');
    if (!content) return null;
    const invalidFontSizes = [...document.querySelectorAll<HTMLElement>('body *')].flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
      const isTextControl = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
      const size = Number.parseFloat(style.fontSize);
      return (ownText || isTextControl) && rect.width > 0 && rect.height > 0 && ![12, 14, 16, 18, 24].includes(size)
        ? [{ tag: element.tagName, size, text: (element.textContent ?? '').trim().slice(0, 30) }]
        : [];
    }).slice(0, 10);
    return {
      invalidFontSizes,
      horizontalOverflow: content.scrollWidth > content.clientWidth + 1,
      edgeControlIssues: [...document.querySelectorAll<HTMLElement>('.panel')].flatMap((panel) => {
        const panelRect = panel.getBoundingClientRect();
        if (panelRect.width <= 0 || panelRect.height <= 0) return [];
        const control = panel.querySelector<HTMLElement>('input:not([type="checkbox"]), select, textarea');
        if (!control || control.getBoundingClientRect().width <= 0) return [];
        const inset = Math.round(control.getBoundingClientRect().left - panelRect.left);
        return inset < 16 ? [{ className: panel.className, inset }] : [];
      })
    };
  });
  expect(audit, `${name} shared layout audit`).toEqual({ invalidFontSizes: [], horizontalOverflow: false, edgeControlIssues: [] });
}

async function expectDarkSurfaces(page: Page, selectors: string[]): Promise<void> {
  const surfaces = await page.evaluate((targets) => targets.flatMap((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return [];
    const color = getComputedStyle(element).backgroundColor;
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    return [{ selector, color, maximumChannel: channels.length === 3 ? Math.max(...channels) : 255 }];
  }), selectors);
  expect(surfaces).toHaveLength(selectors.length);
  for (const surface of surfaces) expect(surface.maximumChannel, `${surface.selector} uses ${surface.color}`).toBeLessThan(64);
}

test('all child views preserve parent navigation and shared layout', async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-subviews-'));
  const env = { ...process.env, INTERVIEW_OS_DATA_DIR: dataDirectory };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.', '--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
    cwd: process.cwd(),
    env
  });
  const output = path.resolve('artifacts', 'subviews');

  try {
    await mkdir(output, { recursive: true });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: '加载演示数据' }).click();
    await page.locator('[aria-label="关闭完成消息"]').click();

    const capture = async (name: string, parent: string) => {
      await page.locator('.content-area > section').waitFor({ state: 'visible' });
      await page.locator('.content-area').evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
      await expectParentActive(page, parent);
      await expectSharedLayout(page, name);
      await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
    };

    await page.getByTestId('nav-coach').click();
    for (const mode of ['mock-interview', 'project-deep-dive', 'technical-qa', 'resume-follow-up', 'jd-analysis', 'english-interview']) {
      await page.getByTestId('training-coach-mode').selectOption(mode);
      await capture(`coach-${mode}`, 'coach');
    }
    for (const [route, name, parent] of [
      ['#/career-agent', 'career-agent', 'career-agent'],
      ['#/reports', 'coach-reports', 'coach']
    ] as const) {
      await page.evaluate((hash) => { window.location.hash = hash; }, route);
      await capture(name, parent);
    }

    await page.evaluate(() => { window.location.hash = '#/profile'; });
    await capture('profile', 'profile');
    await page.getByTestId('profile-project-tab').click();
    await capture('projects-editor-tab', 'profile');
    await page.evaluate(() => { window.location.hash = '#/profile?tab=projects'; });
    await capture('projects-deep-link', 'profile');
    await expect(page.locator('.project-form-card')).toHaveCSS('overflow-y', 'visible');

    await page.getByTestId('nav-resumes').click();
    await page.getByTestId('resume-add').click();
    await capture('resume-new-version', 'resumes');
    await page.getByTestId('resume-copy-markdown').click();
    await expect(page.locator('.resume-sheet')).toContainText('Markdown 已复制');
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toContain('#');

    await page.getByTestId('nav-job-sync').click();
    for (const tab of ['pool', 'sources', 'filters', 'logs']) {
      await page.getByTestId(`job-sync-tab-${tab}`).click();
      await capture(`job-center-${tab}`, 'job-sync');
      if (tab === 'sources') {
        const tokenValue = await page.getByTestId('job-sync-token').inputValue();
        expect(tokenValue).toMatch(/^[0-9a-f-]{36}$/i);
        await page.getByTestId('job-sync-copy-token').click();
        await expect(page.locator('.sync-token')).toContainText('令牌已复制');
        expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(tokenValue);

        const extensionPath = await page.getByTestId('job-sync-extension-path').inputValue();
        expect(extensionPath).toContain('browser-extension');
        await page.getByTestId('job-sync-copy-extension-path').click();
        await expect(page.locator('.sync-setup')).toContainText('扩展目录已复制');
        expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(extensionPath);
      }
    }
    await page.getByTestId('nav-jobs').click();
    await page.getByTestId('job-add').click();
    await capture('jd-import', 'jobs');

    await page.getByTestId('nav-applications').click();
    await page.getByTestId('application-add').click();
    await capture('applications-new', 'applications');
    await page.getByTestId('application-greeting').fill('这是一段用于复制测试的沟通话术。');
    await page.getByTestId('application-copy-greeting').click();
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe('这是一段用于复制测试的沟通话术。');
    const formPadding = await page.getByTestId('application-form').evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingLeft));
    expect(formPadding).toBe(20);
    await page.evaluate(() => { window.location.hash = '#/calendar'; });
    await capture('applications-calendar', 'applications');

    await page.getByTestId('nav-companies').click();
    await page.getByTestId('company-add').click();
    await capture('companies-new', 'companies');

    await page.getByTestId('nav-settings').click();
    await page.getByRole('button', { name: '黑色', exact: true }).click();
    await page.getByTestId('provider-apply-sub2api').click();
    await expect(page.getByTestId('provider-kind')).toHaveValue('openai-compatible');
    await expect(page.getByTestId('provider-name')).toHaveValue('Sub2API');
    await expect(page.getByTestId('provider-base-url')).toHaveValue('https://your-sub2api.example.com/v1');
    await expect(page.getByTestId('provider-model')).toHaveValue('gpt-5.4');
    await capture('settings-dark', 'settings');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectDarkSurfaces(page, ['.content-area', '.settings-card', '.provider-template', '.cleanup-scope']);

    await page.getByTestId('nav-companies').click();
    await capture('companies-dark', 'companies');
    await expectDarkSurfaces(page, ['.content-area', '.career-metrics', '.company-watch-list', '.recruitment-calendar', '.site-directory']);
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
