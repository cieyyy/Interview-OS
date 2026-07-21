const SITE_CONFIGS = [
  {
    hosts: ['zhipin.com'], site: 'boss', name: 'BOSS 直聘',
    cards: ['.job-card-wrapper', '.job-card-box', 'li.job-card-wrapper'],
    title: ['.job-name', '.job-title', 'a.job-card-left'],
    company: ['.company-name', '.company-info h3'],
    location: ['.job-area', '.job-location'], salary: ['.salary'],
    link: ['a[href*="/job_detail/"]']
  },
  {
    hosts: ['liepin.com'], site: 'liepin', name: '猎聘',
    cards: ['.job-card-pc-container', '.job-card-container', '[data-job-id]'],
    title: ['.job-title-box', '.job-title'], company: ['.company-name'],
    location: ['.job-dq-box', '.job-area'], salary: ['.job-salary'],
    link: ['a[href*="/job/"]', 'a[href*="/a/"]']
  },
  {
    hosts: ['zhaopin.com'], site: 'zhaopin', name: '智联招聘',
    cards: ['.joblist-box__item', '.joblist-box__iteminfo', '[data-jobid]'],
    title: ['.iteminfo__line1__jobname', '.job-name'], company: ['.iteminfo__line1__compname', '.company-name'],
    location: ['.iteminfo__line2__jobdesc__demand', '.job-address'], salary: ['.iteminfo__line2__jobdesc__salary', '.salary'],
    link: ['a[href*="/jobdetail/"]', 'a[href*="/jobs/"]']
  },
  {
    hosts: ['51job.com'], site: '51job', name: '前程无忧',
    cards: ['.joblist-item', '.joblist .e', '[data-jobid]'],
    title: ['.jname', '.job-name'], company: ['.cname', '.company-name'],
    location: ['.d', '.job-area'], salary: ['.sal', '.salary'],
    link: ['a[href*="/job/"]', 'a[href*="jobs.51job.com"]']
  },
  {
    hosts: ['lagou.com'], site: 'lagou', name: '拉勾',
    cards: ['.item__10RTO', '.con_list_item', '[data-positionid]'],
    title: ['.position__21iOS', '.position_link h3', '.job-name'], company: ['.company__2EsC8', '.company_name'],
    location: ['.p-bom__JlNur', '.add'], salary: ['.money__3Lkgq', '.money'],
    link: ['a[href*="/jobs/"]']
  }
];

function siteConfig() {
  return SITE_CONFIGS.find((config) => config.hosts.some((host) => location.hostname.endsWith(host)));
}

function textFrom(root, selectors) {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    const value = node?.textContent?.replace(/\s+/g, ' ').trim();
    if (value) return value;
  }
  return '';
}

function hrefFrom(root, selectors) {
  for (const selector of selectors) {
    const node = root.matches?.(selector) ? root : root.querySelector(selector);
    const href = node?.getAttribute?.('href');
    if (href) return new URL(href, location.href).toString();
  }
  return location.href;
}

function externalId(url, card) {
  const explicit = card.getAttribute('data-job-id') || card.getAttribute('data-jobid') || card.getAttribute('data-positionid');
  if (explicit) return explicit;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('jobId') || parsed.searchParams.get('positionId') || parsed.pathname.split('/').filter(Boolean).pop() || url;
  } catch {
    return url;
  }
}

function jsonLdJobs(config) {
  const rows = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent || 'null');
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        if (value?.['@type'] !== 'JobPosting') continue;
        const url = value.url || location.href;
        rows.push({
          externalId: String(value.identifier?.value || externalId(url, document.documentElement)),
          sourceUrl: new URL(url, location.href).toString(),
          title: String(value.title || '').trim(),
          company: String(value.hiringOrganization?.name || '').trim(),
          location: String(value.jobLocation?.address?.addressLocality || value.jobLocationType || '').trim(),
          salaryRange: String(value.baseSalary?.value?.value || value.baseSalary?.value || '').trim(),
          description: String(value.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
          postedAt: value.datePosted || undefined
        });
      }
    } catch {
      // Ignore malformed third-party metadata.
    }
  }
  return rows.filter((item) => item.title && item.sourceUrl);
}

function visibleCardJobs(config) {
  const selector = config.cards.join(',');
  return Array.from(document.querySelectorAll(selector)).slice(0, 100).map((card) => {
    const sourceUrl = hrefFrom(card, config.link);
    const title = textFrom(card, config.title);
    const company = textFrom(card, config.company);
    const locationText = textFrom(card, config.location);
    const explicitId = card.getAttribute('data-job-id') || card.getAttribute('data-jobid') || card.getAttribute('data-positionid');
    return {
      externalId: explicitId || (sourceUrl === location.href ? `${title}|${company}|${locationText}` : externalId(sourceUrl, card)),
      sourceUrl,
      title,
      company,
      location: locationText,
      salaryRange: textFrom(card, config.salary),
      description: card.textContent?.replace(/\s+/g, ' ').trim().slice(0, 5000) || ''
    };
  }).filter((item) => item.title && item.sourceUrl);
}

function uniqueJobs(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.externalId}|${item.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let syncTimer;
let lastSignature = '';

async function syncVisibleJobs(force = false) {
  const config = siteConfig();
  if (!config) return { ok: false, error: '当前网站暂未配置岗位适配器。' };
  const jobs = uniqueJobs([...jsonLdJobs(config), ...visibleCardJobs(config)]).slice(0, 100);
  if (!jobs.length) return { ok: false, error: '当前页面未识别到可见岗位。' };
  const signature = jobs.map((item) => `${item.externalId}:${item.title}`).join('|');
  if (!force && signature === lastSignature) return { ok: true, skipped: true, count: jobs.length };
  lastSignature = signature;
  return chrome.runtime.sendMessage({
    type: 'SYNC_JOBS',
    payload: { sourceSite: config.site, sourceName: config.name, pageUrl: location.href, jobs }
  });
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { void syncVisibleJobs(false); }, 1500);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'FORCE_SYNC') return false;
  void syncVisibleJobs(true).then(sendResponse);
  return true;
});

new MutationObserver(scheduleSync).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('popstate', scheduleSync);
scheduleSync();
