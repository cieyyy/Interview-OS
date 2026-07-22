const SITE_CONFIGS = [
  {
    hosts: ['zhipin.com'], site: 'boss', name: 'BOSS 直聘',
    cards: ['.job-card-wrapper', '.job-card-box', 'li.job-card-wrapper'],
    title: ['.job-name', '.job-title', 'a.job-card-left'],
    company: ['.company-name', '.company-info h3'],
    location: ['.job-area', '.job-location'], salary: ['.salary'],
    link: ['a[href*="/job_detail/"]'],
    detailTitle: ['.job-banner h1', '.job-title', '.name h1', 'h1'],
    detailCompany: ['.company-info h3', '.company-name', '.sider-company h3'],
    detailLocation: ['.job-location', '.job-address', '.job-banner .info-primary'],
    detailAddress: ['.job-location .location-address', '.location-address', '.job-address', '.map-container .address', '[class*="address"]'],
    detailSalary: ['.salary', '.job-salary'],
    detailDescription: ['.job-sec-text', '.job-detail-section', '.job-description', '.job-detail']
  },
  {
    hosts: ['liepin.com'], site: 'liepin', name: '猎聘',
    cards: ['.job-card-pc-container', '.job-card-container', '[data-job-id]'],
    title: ['.job-title-box', '.job-title'], company: ['.company-name'],
    location: ['.job-dq-box', '.job-area'], salary: ['.job-salary'],
    link: ['a[href*="/job/"]', 'a[href*="/a/"]'],
    detailTitle: ['.job-title', '.name-box h1', 'h1'],
    detailCompany: ['.company-name', '.company-card h3', 'a[href*="/company/"]'],
    detailLocation: ['.job-properties', '.job-dq-box', '.job-area'],
    detailAddress: ['.job-address', '.work-address', '.company-address', '.map-address', '[class*="address"]'],
    detailSalary: ['.job-salary', '.salary'],
    detailDescription: ['.job-description', '.paragraph-box', '.job-detail-container']
  },
  {
    hosts: ['zhaopin.com'], site: 'zhaopin', name: '智联招聘',
    cards: ['.joblist-box__item', '[data-jobid]', '.joblist-box__iteminfo'],
    title: ['.jobinfo__name', '.iteminfo__line1__jobname', '.job-name'],
    company: ['.companyinfo__name', '.iteminfo__line1__compname', '.company-name'],
    location: ['.jobinfo__other-info-item', '.iteminfo__line2__jobdesc__demand', '.job-address'],
    salary: ['.jobinfo__salary', '.iteminfo__line2__jobdesc__salary', '.salary'],
    link: ['.jobinfo__name[href*="/jobdetail/"]', 'a[href*="/jobdetail/"]', 'a[href*="/jobs/"]'],
    detailTitle: ['.summary-planes__title', '.summary-plane__title', '.job-detail__title', '.job-name', '.position-title', 'h1'],
    detailCompany: ['.company-info__name', '.company__title', '.company-name', '.com-name', 'a[href*="/company"]'],
    detailLocation: ['.address-info__content', '.summary-planes__info', '.summary-plane__info', '.job-address', '.work-address', '.job-detail__address'],
    detailAddress: ['.address-info__content', '.company-address', '.job-address', '.work-address', '.job-detail__address', '[class*="address"]'],
    detailSalary: ['.summary-planes__salary', '.summary-plane__salary', '.job-salary', '.salary'],
    detailDescription: ['.describtion-card__detail-content', '.describtion-card', '.describtion__detail-content', '.job-detail__description', '.job-description', '.pos-ul', '.job-detail']
  },
  {
    hosts: ['51job.com'], site: '51job', name: '前程无忧',
    cards: ['.joblist-item', '.joblist .e', '[data-jobid]'],
    title: ['.jname', '.job-name'], company: ['.cname', '.company-name'],
    location: ['.area', '.d', '.job-area'], salary: ['.sal', '.salary'],
    link: ['a[href*="/job/"]', 'a[href*="jobs.51job.com"]'],
    detailTitle: ['.cn h1', '.job-name', 'h1'],
    detailCompany: ['.cname a', '.company-name', '.com_name'],
    detailLocation: ['.msg', '.job-address', '.job-area'],
    detailAddress: ['.job-address', '.tmsg', '.bmsg.inbox', '.com_tag', '[class*="address"]'],
    detailSalary: ['.cn strong', '.salary'],
    detailDescription: ['.bmsg.job_msg', '.job-description', '.job-detail']
  },
  {
    hosts: ['lagou.com'], site: 'lagou', name: '拉勾',
    cards: ['.item__10RTO', '.con_list_item', '[data-positionid]'],
    title: ['.position__21iOS', '.position_link h3', '.job-name'], company: ['.company__2EsC8', '.company_name'],
    location: ['.p-bom__JlNur', '.add'], salary: ['.money__3Lkgq', '.money'],
    link: ['a[href*="/jobs/"]'],
    detailTitle: ['.position-head h1', '.job-name', 'h1'],
    detailCompany: ['.company', '.company-name', '.company_name'],
    detailLocation: ['.job_request', '.job-address', '.add'],
    detailAddress: ['.work_addr', '.job-address', '.address', '.add', '[class*="address"]'],
    detailSalary: ['.salary', '.money'],
    detailDescription: ['.job-detail', '.job_bt', '.job-description']
  }
];

function siteConfig() {
  return SITE_CONFIGS.find((config) => config.hosts.some((host) => location.hostname.endsWith(host)));
}

function isBlockedPage() {
  const text = `${document.title || ''} ${(document.body?.innerText || '').slice(0, 1000)}`;
  return /滑动验证|访问验证|安全验证|验证码|人机验证|请完成验证/u.test(text);
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
        const title = String(value.title || '').trim();
        const company = String(value.hiringOrganization?.name || '').trim();
        const rawDescription = String(value.description || '').replace(/<[^>]+>/g, ' ');
        rows.push({
          externalId: String(value.identifier?.value || externalId(url, document.documentElement)),
          sourceUrl: new URL(url, location.href).toString(),
          title,
          company,
          location: jsonLdLocation(value.jobLocation) || String(value.jobLocationType || '').trim(),
          salaryRange: String(value.baseSalary?.value?.value || value.baseSalary?.value || '').trim(),
          description: cleanJobDescription(rawDescription, title, company),
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
  const candidateCards = Array.from(document.querySelectorAll(selector)).filter((card) => {
    if (!card.parentElement) return true;
    return !config.cards.some((cardSelector) => card.parentElement.matches?.(cardSelector));
  });
  return candidateCards.slice(0, 100).map((card) => {
    const sourceUrl = hrefFrom(card, config.link);
    const title = textFrom(card, config.title) || inferTitleFromCardText(card);
    const company = textFrom(card, config.company);
    const locationText = textFrom(card, config.location);
    const explicitId = card.getAttribute('data-job-id') || card.getAttribute('data-jobid') || card.getAttribute('data-positionid');
    const rawCardText = card.textContent?.replace(/\s+/g, ' ').trim() || '';
    return {
      externalId: explicitId || (sourceUrl === location.href ? `${title}|${company}|${locationText}` : externalId(sourceUrl, card)),
      sourceUrl,
      title,
      company,
      location: locationText,
      salaryRange: textFrom(card, config.salary),
      description: rawCardText.length > 2500 ? '' : cleanJobDescription(rawCardText, title, company).slice(0, 1000)
    };
  }).filter((item) => item.title && item.sourceUrl);
}

function inferTitleFromCardText(card) {
  const text = card.textContent?.replace(/\s+/g, ' ').trim() || '';
  if (!text) return '';
  const salaryIndex = text.search(/\d+(?:\.\d+)?\s*(?:[-~至]\s*\d+(?:\.\d+)?)?\s*(?:k|K|千|万|元)/u);
  const title = salaryIndex > 0 ? text.slice(0, salaryIndex).trim() : text.split(/[，,。]/u)[0]?.trim();
  if (!title || title.length > 60 || /登录|注册|APP|立即投递|收藏/u.test(title)) return '';
  return title;
}

function metaContent(name) {
  return document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute('content')?.replace(/\s+/g, ' ').trim() || '';
}

function isLikelyDetailPage(config) {
  const href = location.href.toLowerCase();
  if (href.includes('jobdetail') || href.includes('job_detail') || /\/job\/|\/jobs\//.test(location.pathname.toLowerCase())) return true;
  return Boolean(textFrom(document, config.detailTitle || []));
}

function cleanDetailText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/登录\/注册|获取验证码|用户服务协议|隐私政策/g, ' ')
    .trim();
}

function cleanJobDescription(value, title = '', company = '') {
  let text = cleanDetailText(value);
  if (!text) return '';

  for (const token of [title, company]) {
    if (token && text.startsWith(token)) text = text.slice(token.length).trim();
  }

  text = text
    .replace(/首页|职位|成都站|找副业|政企|校招|高薪|海归|驻外|测评|职Q|消息|APP/g, ' ')
    .replace(/验证码登录\/注册|国家网络身份认证登录|已阅读并同意|手机号|短信验证码/g, ' ')
    .replace(/立即沟通|收藏|投递|查看地图|微信扫码与我聊聊/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sectionMatch = text.match(/(?:职位描述|岗位职责|工作职责|工作内容|任职要求|岗位要求|职位要求)[:：\s]*(.{80,2400})/u);
  if (sectionMatch?.[1]) text = sectionMatch[1].trim();

  const stopIndex = text.search(/(?:工作地址|公司地址|职位发布者|公司基本信息|看过该职位的人还看了|相似职位|推荐职位|展开更多|查看更多|为你推荐)/u);
  if (stopIndex > 120) text = text.slice(0, stopIndex).trim();

  const noiseHits = (text.match(/投递|收藏|立即沟通|招聘|登录|注册|验证码|查看地图/g) || []).length;
  const salaryHits = (text.match(/\d+(?:\.\d+)?\s*(?:[-~至]\s*\d+(?:\.\d+)?)?\s*(?:k|K|千|万|元)/g) || []).length;
  const repeatedCompanyHits = company ? (text.match(new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;
  if (text.length > 1800 && (noiseHits > 8 || salaryHits > 10 || repeatedCompanyHits > 6)) return '';

  return text.slice(0, 2400);
}

function jsonLdLocation(value) {
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry) => {
    const address = entry?.address || entry;
    if (!address || typeof address !== 'object') return '';
    return [
      address.addressRegion,
      address.addressLocality,
      address.streetAddress,
      address.addressCountry
    ].filter(Boolean).map(String).join(' ');
  }).filter(Boolean).join(' / ').trim();
}

function normalizeAddressCandidate(value) {
  const text = cleanDetailText(value)
    .replace(/^(工作地址|公司地址|上班地址|办公地址|地址|工作地点|详细地址)[:：\s]*/u, '')
    .replace(/查看地图|地图|导航/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length < 4 || text.length > 140) return '';
  if (/登录|注册|验证码|立即沟通|收藏|投递|职位描述|岗位职责|任职要求/u.test(text)) return '';
  return text;
}

function detailAddressFromPage(config) {
  const direct = normalizeAddressCandidate(textFrom(document, config.detailAddress || []));
  if (direct) return direct;

  const candidates = Array.from(document.querySelectorAll([
    '[class*="address"]',
    '[class*="addr"]',
    '[class*="location"]',
    '[class*="map"]',
    '[class*="place"]'
  ].join(',')));
  for (const node of candidates) {
    const text = normalizeAddressCandidate(node.textContent || '');
    if (text && /路|街|区|号|园|座|楼|室|大厦|中心|广场|基地|产业园|写字楼|park|road|street/i.test(text)) return text;
  }

  const bodyText = document.body?.innerText?.replace(/\r/g, '') || '';
  const match = bodyText.match(/(?:工作地址|公司地址|上班地址|办公地址|地址|工作地点)[:：\s]*([^\n]{4,100})/u);
  return normalizeAddressCandidate(match?.[1] || '');
}

function currentPageJob(config) {
  if (isBlockedPage()) return [];
  if (!isLikelyDetailPage(config)) return [];
  const title = cleanDetailText(textFrom(document, config.detailTitle || config.title) || metaContent('og:title').split(/[-_|]/)[0]);
  if (!title || title.length > 80 || /登录|注册|招聘|首页|访问验证|安全验证|滑动验证|验证码/u.test(title)) return [];
  const company = cleanDetailText(textFrom(document, config.detailCompany || config.company) || metaContent('og:site_name'));
  const description = cleanJobDescription(textFrom(document, config.detailDescription || []) || metaContent('description'), title, company);
  return [{
    externalId: externalId(location.href, document.documentElement),
    sourceUrl: location.href,
    title,
    company,
    location: detailAddressFromPage(config) || cleanDetailText(textFrom(document, config.detailLocation || config.location)),
    salaryRange: cleanDetailText(textFrom(document, config.detailSalary || config.salary)),
    description
  }];
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

function collectVisibleJobs(config) {
  return uniqueJobs([...jsonLdJobs(config), ...visibleCardJobs(config), ...currentPageJob(config)]).slice(0, 100);
}

function collectDetailJobs(config) {
  return uniqueJobs([...currentPageJob(config), ...jsonLdJobs(config)]).slice(0, 5);
}

function buildPayload(mode = 'visible') {
  const config = siteConfig();
  if (!config) return { ok: false, error: '当前网站暂未配置岗位适配器。' };
  if (isBlockedPage()) return { ok: false, error: '当前页面是登录或验证页面，请先手动完成登录/验证后再同步。' };
  const jobs = mode === 'detail' ? collectDetailJobs(config) : collectVisibleJobs(config);
  if (!jobs.length) return { ok: false, error: mode === 'detail' ? '当前详情页未识别到岗位详情。' : '当前页面未识别到可见岗位。' };
  return { ok: true, payload: { sourceSite: config.site, sourceName: config.name, pageUrl: location.href, jobs } };
}

async function syncVisibleJobs(force = false) {
  const built = buildPayload('visible');
  if (!built.ok) return built;
  const jobs = built.payload.jobs;
  const signature = jobs.map((item) => `${item.externalId}:${item.title}`).join('|');
  if (!force && signature === lastSignature) return { ok: true, skipped: true, count: jobs.length };
  lastSignature = signature;
  return chrome.runtime.sendMessage({
    type: 'SYNC_JOBS',
    payload: built.payload
  });
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { void syncVisibleJobs(false); }, 1500);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'FORCE_SYNC') {
    void syncVisibleJobs(true).then(sendResponse);
    return true;
  }
  if (message?.type === 'EXTRACT_VISIBLE_JOBS') {
    sendResponse(buildPayload('visible'));
    return true;
  }
  if (message?.type === 'EXTRACT_DETAIL_JOBS') {
    sendResponse(buildPayload('detail'));
    return true;
  }
  return false;
});

new MutationObserver(scheduleSync).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('popstate', scheduleSync);
scheduleSync();
