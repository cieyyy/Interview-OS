import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
// jsdom is already a test dependency through Vitest; this project does not ship its optional type package.
// @ts-expect-error Missing optional @types/jsdom declaration.
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const source = readFileSync(path.resolve(process.cwd(), 'browser-extension/content.js'), 'utf8');

function loadContentScript(html: string, pageTitle: string) {
  const dom = new JSDOM(html, {
    url: 'https://www.zhipin.com/job_detail/9394e3d97a6586120nFz2ti-GVtS.html'
  });
  dom.window.document.title = pageTitle;

  const context = vm.createContext({
    document: dom.window.document,
    location: dom.window.location,
    window: dom.window,
    MutationObserver: dom.window.MutationObserver,
    URL,
    setTimeout,
    clearTimeout,
    chrome: {
      storage: {
        local: { get: async () => ({ captureMode: 'manual' }) },
        onChanged: { addListener: () => undefined }
      },
      runtime: {
        onMessage: { addListener: () => undefined },
        sendMessage: async () => ({ ok: true })
      }
    }
  });
  vm.runInContext(source, context);
  return context as typeof context & {
    siteConfig: () => unknown;
    currentPageJob: (config: unknown) => Array<Record<string, string>>;
  };
}

describe('browser extension BOSS detail parser', () => {
  it('accepts job titles containing 招聘 and reads the company detail link', () => {
    const context = loadContentScript(`
      <main>
        <div class="job-banner"><h1>招聘顾问 （IT方向 双休）</h1><span class="salary">8-9K</span></div>
        <a href="/gongsi/b54929ae39691d9733143965EQ~~.html">成功人力资源集团</a>
        <section class="job-detail"><h3>职位描述</h3><p>负责 IT 技术岗位招聘，完成需求分析、人才寻访和全流程交付。</p></section>
        <div class="job-address">成都金牛区紫金乐章写字楼-1号楼</div>
      </main>
    `, '「招聘顾问 （IT方向 双休）招聘」_成功人力资源集团招聘-BOSS直聘');

    const [job] = context.currentPageJob(context.siteConfig());
    expect(job.title).toBe('招聘顾问 （IT方向 双休）');
    expect(job.company).toBe('成功人力资源集团');
    expect(job.description).toContain('负责 IT 技术岗位招聘');
  });

  it('falls back to the BOSS document title while dynamic fields are rendering', () => {
    const context = loadContentScript(`
      <main>
        <section><h3>职位描述</h3><p>负责 AI 方向技术人才招聘与候选人沟通，推进面试流程。</p></section>
      </main>
    `, '「IT招聘顾问(AI方向)(7-8k底薪1500提成/人)招聘」_成都示例科技招聘-BOSS直聘');

    const [job] = context.currentPageJob(context.siteConfig());
    expect(job.title).toBe('IT招聘顾问(AI方向)(7-8k底薪1500提成/人)');
    expect(job.company).toBe('成都示例科技');
    expect(job.description).toContain('负责 AI 方向技术人才招聘');
  });
});
