const { _electron: electron } = require('@playwright/test');
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const modules = [
  ['01-dashboard', 'dashboard', '工作台'],
  ['02-ai-career-coach', 'coach', 'AI 职业教练'],
  ['03-resume-studio', 'resumes', '简历工坊'],
  ['04-job-center', 'job-sync', '岗位中心'],
  ['05-jd-analysis', 'jobs', 'JD 分析'],
  ['06-knowledge-space', 'knowledge', '知识空间'],
  ['07-project-assets', 'projects', '项目资产库'],
  ['08-application-pipeline', 'applications', '求职管道'],
  ['09-company-watch', 'companies', '公司关注'],
  ['10-capability-growth', 'skill-graph', '能力成长'],
  ['11-data-center', 'data-center', '数据中心'],
  ['12-settings', 'settings', '设置']
];

async function main() {
  const outputDirectory = path.resolve('docs', 'screenshots', 'v0.6.0');
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), 'interview-os-ui-capture-'));
  const env = { ...process.env, INTERVIEW_OS_DATA_DIR: dataDirectory };
  delete env.ELECTRON_RUN_AS_NODE;
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const app = await electron.launch({
    args: ['.', '--disable-gpu', '--disable-gpu-compositing', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
    cwd: process.cwd(),
    env
  });

  const report = [];
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: '加载演示数据' }).click();
    const notice = page.locator('[aria-label="关闭完成消息"]');
    await notice.waitFor({ state: 'visible' });
    await notice.click();

    for (const [fileName, testId, label] of modules) {
      const link = page.getByTestId(`nav-${testId}`);
      await link.click();
      await page.waitForFunction((id) => document.querySelector(`[data-testid="nav-${id}"]`)?.classList.contains('active'), testId);
      await page.locator('.content-area > section').waitFor({ state: 'visible' });
      await page.locator('.content-area').evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(120);

      const audit = await page.evaluate(() => {
        const allowedFontSizes = new Set([12, 14, 16, 18, 24]);
        const invalidFontSizes = [...document.querySelectorAll('body *')].flatMap((element) => {
          const node = /** @type {HTMLElement} */ (element);
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          const hasOwnText = [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
          const isTextControl = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName);
          const size = Number.parseFloat(style.fontSize);
          if ((hasOwnText || isTextControl) && rect.width > 0 && rect.height > 0 && !allowedFontSizes.has(size)) {
            return [{ tag: node.tagName.toLowerCase(), className: node.className, text: (node.textContent || '').trim().slice(0, 50), size }];
          }
          return [];
        }).slice(0, 20);
        const content = /** @type {HTMLElement} */ (document.querySelector('.content-area'));
        const contentStyle = window.getComputedStyle(content);
        const header = /** @type {HTMLElement | null} */ (document.querySelector('.page-header'));
        return {
          invalidFontSizes,
          paddingLeft: Number.parseFloat(contentStyle.paddingLeft),
          paddingRight: Number.parseFloat(contentStyle.paddingRight),
          headerMarginBottom: header ? Number.parseFloat(window.getComputedStyle(header).marginBottom) : null,
          horizontalOverflow: content.scrollWidth > content.clientWidth + 1,
          viewport: { width: window.innerWidth, height: window.innerHeight }
        };
      });

      if (audit.invalidFontSizes.length || audit.paddingLeft !== 24 || audit.paddingRight !== 24 || audit.headerMarginBottom !== 24 || audit.horizontalOverflow) {
        throw new Error(`${label} UI audit failed: ${JSON.stringify(audit)}`);
      }

      await page.screenshot({
        path: path.join(outputDirectory, `${fileName}.png`),
        animations: 'disabled'
      });
      report.push({ module: label, file: `${fileName}.png`, ...audit });
      console.log(`captured ${label} -> ${fileName}.png`);
    }

    await writeFile(path.join(outputDirectory, 'audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } finally {
    await app.close().catch(() => undefined);
    await rm(dataDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
