const SITE_CONFIGS = [
  {
    hosts: ['zhipin.com'], site: 'boss', name: 'BOSS 直聘',
    cards: [
      '.job-card-wrapper', '.job-card-box', 'li.job-card-wrapper',
      '.recommend-job-item', '.job-recommend-item', '.interest-job-item',
      '.job-list-item', '[class*="recommend-job"]', '[class*="job-card"]'
    ],
    title: ['.job-name', '.job-title', '.position-name', '[class*="job-name"]', '[class*="job-title"]', 'a.job-card-left'],
    company: ['.company-name', '.company-info h3', '[class*="company-name"]', 'a[href*="/gongsi/"]'],
    location: ['.job-area', '.job-location', '.job-address', '[class*="job-area"]'], salary: ['.salary', '[class*="salary"]'],
    link: ['a[href*="/job_detail/"]', 'a[href*="job_detail"]', '[data-url*="job_detail"]', '[data-href*="job_detail"]'],
    detailTitle: ['.job-banner h1', '.job-title', '.name h1', 'h1'],
    detailCompany: [
      '.company-info h3', '.company-info a[href*="/gongsi/"]',
      '.company-name', '.sider-company h3', 'a[href*="/gongsi/"][href$=".html"]'
    ],
    detailLocation: ['.job-location', '.job-address', '.job-banner .info-primary'],
    detailAddress: ['.job-location .location-address', '.location-address', '.job-address', '.map-container .address', '[class*="address"]'],
    detailSalary: ['.salary', '.job-salary'],
    detailDescription: ['.job-sec-text', '.job-detail-section', '.job-description', '.job-detail']
  },
  {
    hosts: ['liepin.com'], site: 'liepin', name: '猎聘',
    cards: ['.job-card-pc-container', '.job-card-container', '[data-job-id]', '[class*="job-card"]'],
    title: ['.job-title-box', '.job-title', '[class*="job-title"]'], company: ['.company-name', '[class*="company-name"]'],
    location: ['.job-dq-box', '.job-area'], salary: ['.job-salary'],
    link: ['a[href*="/job/"]', 'a[href*="/a/"]', 'a[href$=".shtml"]'],
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
    location: ['.jobinfo__other-info-item', '.iteminfo__line2__jobdesc__demand__item:first-child', '.iteminfo__line2__jobdesc__demand', '.job-address'],
    salary: ['.jobinfo__salary', '.iteminfo__line2__jobdesc__salary', '.salary'],
    link: ['.jobinfo__name[href*="/jobdetail/"]', 'a[href*="/jobdetail/"]', 'a[href*="jobs.zhaopin.com/"]', 'a[href*="/jobs/"]'],
    detailTitle: ['.summary-planes__title', '.summary-plane__title', '.job-detail__title', '.job-name', '.position-title', 'h1'],
    detailCompany: ['.company-info__name', '.company__title', '.company-name', '.com-name', 'a[href*="/company"]'],
    detailLocation: ['.address-info__content', '.summary-planes__info', '.summary-plane__info', '.job-address', '.work-address', '.job-detail__address'],
    detailAddress: ['.address-info__content', '.company-address', '.job-address', '.work-address', '.job-detail__address', '[class*="address"]'],
    detailSalary: ['.summary-planes__salary', '.summary-plane__salary', '.job-salary', '.salary'],
    detailDescription: ['.describtion-card__detail-content', '.describtion-card', '.describtion__detail-content', '.job-detail__description', '.job-description', '.pos-ul', '.job-detail']
  },
  {
    hosts: ['51job.com'], site: '51job', name: '前程无忧',
    cards: ['.joblist-item', '.joblist-item-job', '.joblist .e', '[data-jobid]', '[sensorsdata*="jobId"]'],
    title: ['.jname', '.job-name'], company: ['.cname', '.company-name'],
    location: ['.area', '.d', '.job-area'], salary: ['.sal', '.salary'],
    link: ['a[href*="/job/"]', 'a[href*="jobs.51job.com/"]'],
    detailTitle: ['.cn h1', '.job-name', 'h1'],
    detailCompany: ['.cname a', '.company-name', '.com_name'],
    detailLocation: ['.msg', '.job-address', '.job-area'],
    detailAddress: ['.job-address', '.tmsg', '.bmsg.inbox', '.com_tag', '[class*="address"]'],
    detailSalary: ['.cn strong', '.salary'],
    detailDescription: ['.bmsg.job_msg', '.job-description', '.job-detail']
  },
  {
    hosts: ['lagou.com'], site: 'lagou', name: '拉勾',
    cards: ['.item__10RTO', '.con_list_item', '[data-positionid]', '[class*="position-card"]', '[class*="job-card"]'],
    title: ['.position__21iOS', '.position_link h3', '.job-name', '[class*="position-name"]', '[class*="job-name"]'], company: ['.company__2EsC8', '.company_name', '[class*="company-name"]'],
    location: ['.p-bom__JlNur', '.add'], salary: ['.money__3Lkgq', '.money'],
    link: ['a[href*="/jobs/"]', 'a[href*="/wn/jobs/"]'],
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
    const href = node?.getAttribute?.('href')
      || node?.getAttribute?.('data-url')
      || node?.getAttribute?.('data-href')
      || node?.getAttribute?.('data-link');
    if (href) return new URL(href, location.href).toString();
  }
  return location.href;
}

function parseCardMetadata(card) {
  const node = card.matches?.('[sensorsdata]') ? card : card.querySelector?.('[sensorsdata]');
  const raw = node?.getAttribute?.('sensorsdata');
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function sourceUrlFromCard(card, config) {
  const metadata = parseCardMetadata(card);
  if (config.site === '51job' && metadata.jobId) {
    return `https://jobs.51job.com/all/${encodeURIComponent(String(metadata.jobId))}.html`;
  }
  return hrefFrom(card, config.link);
}

function linkTextFrom(card, selectors) {
  for (const selector of selectors) {
    const node = card.matches?.(selector) ? card : card.querySelector(selector);
    const text = node?.textContent?.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function titleFromLinkText(value) {
  return String(value || '')
    .replace(/\s*[\[【]\s*[^\]】]{2,80}[\]】]\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function locationFromLinkText(value) {
  return String(value || '').match(/[\[【]\s*([^\]】]{2,80})[\]】]/u)?.[1]?.trim() || '';
}

function salaryFromText(value) {
  return String(value || '').match(/\d+(?:\.\d+)?\s*[-~至]\s*\d+(?:\.\d+)?\s*(?:[kK]|千|万|元)(?:\s*[·x×]\s*\d+薪)?/u)?.[0]?.trim() || '';
}

function looksLikeJobCard(node) {
  const text = node?.textContent?.replace(/\s+/g, ' ').trim() || '';
  if (text.length < 16 || text.length > 1200) return false;
  const hasSalary = /(?:\d+(?:\.\d+)?\s*[-~至]\s*\d+(?:\.\d+)?\s*[kK]|\d+\s*[-~至]\s*\d+\s*(?:千|万|元))/u.test(text);
  const hasJobSignal = /(?:工程师|开发|测试|运维|产品|设计|顾问|经理|招聘|技术支持|技术员|专员|助理|主管|总监|算法|运营|销售|客服|会计|财务|人事|行政|采购|物流|仓储|生产|质量|教师|医生|护士|实习)/u.test(text);
  return hasSalary && hasJobSignal;
}

function closestJobCard(node) {
  let current = node;
  for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
    if (looksLikeJobCard(current)) return current;
  }
  return undefined;
}

function fallbackLinkedJobCards(config) {
  if (config.site === '51job') return [];
  const links = Array.from(document.querySelectorAll(config.link.join(',')));
  return links.map(closestJobCard).filter(Boolean);
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
  const configuredCards = Array.from(document.querySelectorAll(selector));
  const fallbackCards = fallbackLinkedJobCards(config);
  const fallbackSet = new Set(fallbackCards);
  const candidateCards = [...new Set([...configuredCards, ...fallbackCards])].filter((card) => {
    if (!card.parentElement) return true;
    if (fallbackSet.has(card) && !looksLikeJobCard(card)) return false;
    return !config.cards.some((cardSelector) => card.parentElement.matches?.(cardSelector) && looksLikeJobCard(card.parentElement));
  });
  return candidateCards.slice(0, 100).map((card) => {
    const metadata = parseCardMetadata(card);
    const sourceUrl = sourceUrlFromCard(card, config);
    const linkedText = linkTextFrom(card, config.link);
    const title = textFrom(card, config.title) || String(metadata.jobTitle || '').trim() || titleFromLinkText(linkedText) || inferTitleFromCardText(card);
    const company = textFrom(card, config.company);
    const locationText = textFrom(card, config.location) || String(metadata.jobArea || '').trim() || locationFromLinkText(linkedText);
    const explicitId = card.getAttribute('data-job-id') || card.getAttribute('data-jobid') || card.getAttribute('data-positionid') || metadata.jobId;
    const rawCardText = card.textContent?.replace(/\s+/g, ' ').trim() || '';
    return {
      externalId: explicitId || (sourceUrl === location.href ? `${title}|${company}|${locationText}` : externalId(sourceUrl, card)),
      sourceUrl,
      title,
      company,
      location: locationText,
      salaryRange: textFrom(card, config.salary) || String(metadata.jobSalary || '').trim() || salaryFromText(rawCardText),
      description: rawCardText.length > 2500 ? '' : cleanJobDescription(rawCardText, title, company).slice(0, 1000),
      postedAt: metadata.jobTime || undefined
    };
  }).filter((item) => item.title && item.sourceUrl && item.sourceUrl !== location.href);
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

function documentTitleMetadata(config) {
  const title = cleanDetailText(document.title || '');
  if (config.site === 'boss') {
    const match = title.match(/^「(.+?)招聘」_(.+?)招聘-BOSS直聘$/u);
    if (match) return { title: match[1].trim(), company: match[2].trim() };
  }
  return { title: '', company: '' };
}

function isLikelyDetailPage(config) {
  const href = location.href.toLowerCase();
  if (href.includes('jobdetail') || href.includes('job_detail') || /\/job\/|\/jobs\//.test(location.pathname.toLowerCase())) return true;
  if (config.site === '51job' && /^\/(?:all|[a-z0-9-]+)\/\d+\.html/i.test(location.pathname)) return true;
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

function detailDescriptionFromPage(config, title, company) {
  const direct = textFrom(document, config.detailDescription || []);
  if (direct) return cleanJobDescription(direct, title, company);

  const heading = Array.from(document.querySelectorAll('h2,h3,h4'))
    .find((node) => /^(职位描述|岗位职责|工作职责|工作内容|任职要求|岗位要求|职位要求)$/u.test(cleanDetailText(node.textContent || '')));
  const container = heading?.parentElement;
  return cleanJobDescription(container?.textContent || '', title, company);
}

function currentPageJob(config) {
  if (isBlockedPage()) return [];
  if (!isLikelyDetailPage(config)) return [];
  const documentMetadata = documentTitleMetadata(config);
  const title = cleanDetailText(textFrom(document, config.detailTitle || config.title) || documentMetadata.title || metaContent('og:title').split(/[-_|]/)[0]);
  if (!title || title.length > 80 || /登录|注册|首页|访问验证|安全验证|滑动验证|验证码/u.test(title)) return [];
  const company = cleanDetailText(textFrom(document, config.detailCompany || config.company) || documentMetadata.company || metaContent('og:site_name'));
  const description = detailDescriptionFromPage(config, title, company)
    || cleanJobDescription(metaContent('description'), title, company);
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectAllLoadedListJobs() {
  const config = siteConfig();
  if (!config) return { ok: false, error: '当前网站暂未配置岗位适配器。' };
  if (isBlockedPage()) return { ok: false, error: '当前页面是登录或验证页面，请先手动完成登录/验证后再同步。' };

  const scrollingElement = document.scrollingElement || document.documentElement;
  const initialTop = scrollingElement.scrollTop;
  const collected = [];
  let previousHeight = 0;
  let previousCount = 0;
  let stableRounds = 0;

  for (let round = 0; round < 20 && stableRounds < 3; round += 1) {
    collected.push(...collectVisibleJobs(config));
    const currentHeight = scrollingElement.scrollHeight;
    const currentCount = uniqueJobs(collected).length;
    stableRounds = currentHeight === previousHeight && currentCount === previousCount
      ? stableRounds + 1
      : 0;
    previousHeight = currentHeight;
    previousCount = currentCount;
    scrollingElement.scrollTop = currentHeight;
    await delay(350);
  }

  collected.push(...collectVisibleJobs(config));
  scrollingElement.scrollTop = initialTop;
  const jobs = uniqueJobs(collected).slice(0, 100);
  if (!jobs.length) return buildPayload('visible');
  return {
    ok: true,
    payload: {
      sourceSite: config.site,
      sourceName: config.name,
      pageUrl: location.href,
      jobs
    }
  };
}

function collectDetailJobs(config) {
  return uniqueJobs([...currentPageJob(config), ...jsonLdJobs(config)]).slice(0, 5);
}

async function buildDetailPayloadWithRetry() {
  let result = buildPayload('detail');
  for (let attempt = 0; attempt < 4 && !result.ok; attempt += 1) {
    await delay(650 + attempt * 250);
    result = buildPayload('detail');
  }
  return result;
}

function buildPayload(mode = 'visible') {
  const config = siteConfig();
  if (!config) return { ok: false, error: '当前网站暂未配置岗位适配器。' };
  if (isBlockedPage()) return { ok: false, error: '当前页面是登录或验证页面，请先手动完成登录/验证后再同步。' };
  const jobs = mode === 'detail' ? collectDetailJobs(config) : collectVisibleJobs(config);
  if (!jobs.length) {
    const bossPersonalList = config.site === 'boss' && /\/web\/geek\/(?:recommend|chat|history)|tab=4|sub=1/i.test(location.href);
    return {
      ok: false,
      error: mode === 'detail'
        ? '当前页面不是可识别的岗位详情页。'
        : bossPersonalList
          ? '已识别为 BOSS 个人中心岗位列表，但页面没有暴露可打开的岗位详情链接。请点开一条岗位详情后同步，或刷新页面后重试批量同步。'
          : '当前页面未识别到带详情链接的可见岗位。'
    };
  }
  return { ok: true, payload: { sourceSite: config.site, sourceName: config.name, pageUrl: location.href, jobs } };
}

async function syncVisibleJobs(force = false) {
  const built = buildPayload('detail');
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

let pageObserver;

function stopAutoCapture() {
  if (pageObserver) pageObserver.disconnect();
  pageObserver = undefined;
  window.removeEventListener('popstate', scheduleSync);
  window.removeEventListener('hashchange', scheduleSync);
}

function startAutoCapture() {
  if (pageObserver) return;
  pageObserver = new MutationObserver(scheduleSync);
  pageObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', scheduleSync);
  window.addEventListener('hashchange', scheduleSync);
  scheduleSync();
}

function applyCaptureMode(mode) {
  stopAutoCapture();
  if (mode === 'auto') startAutoCapture();
}

chrome.storage.local.get({ captureMode: 'manual' }).then(({ captureMode }) => applyCaptureMode(captureMode));
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.captureMode) applyCaptureMode(changes.captureMode.newValue);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'FORCE_SYNC') {
    void syncVisibleJobs(true).then(sendResponse);
    return true;
  }
  if (message?.type === 'EXTRACT_VISIBLE_JOBS') {
    void collectAllLoadedListJobs().then(sendResponse);
    return true;
  }
  if (message?.type === 'EXTRACT_DETAIL_JOBS') {
    void buildDetailPayloadWithRetry().then(sendResponse);
    return true;
  }
  return false;
});

// 手动模式只响应扩展按钮；自动模式仅对当前已打开的岗位详情页进行去重同步。
