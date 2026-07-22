const BRIDGE_URL = 'http://127.0.0.1:19426';
const SUPPORTED_URLS = [
  'https://www.zhipin.com/*',
  'https://www.liepin.com/*',
  'https://www.zhaopin.com/*',
  'https://we.51job.com/*',
  'https://www.51job.com/*',
  'https://www.lagou.com/*'
];
const DETAIL_BATCH_LIMIT = 30;
const DETAIL_OPEN_DELAY_MS = 1500;
const DETAIL_TAB_TIMEOUT_MS = 12000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('interview-os-sync', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'interview-os-sync') return;
  const tabs = await chrome.tabs.query({
    url: SUPPORTED_URLS
  });
  for (const tab of tabs) {
    if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SYNC' }).catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SYNC_JOBS') {
    void syncJobs(message.payload).then(sendResponse);
    return true;
  }
  if (message?.type === 'SYNC_DETAIL_BATCH') {
    void syncDetailBatch(message.tabId).then(sendResponse);
    return true;
  }
  if (message?.type === 'CHECK_BRIDGE') {
    void fetch(`${BRIDGE_URL}/health`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((body) => sendResponse({ ok: true, body }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

async function syncDetailBatch(tabId) {
  if (!tabId) return { ok: false, error: '未找到当前标签页。' };
  const bridge = await checkBridge();
  if (!bridge.ok) return bridge;

  let listResult;
  try {
    listResult = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_VISIBLE_JOBS' });
  } catch (error) {
    return { ok: false, error: `无法读取当前招聘列表：${error instanceof Error ? error.message : '未知错误'}` };
  }
  if (!listResult?.ok) return { ok: false, error: listResult?.error || '当前页面未识别到岗位列表。' };

  const sourceJobs = uniqueByUrl(listResult.payload.jobs || [])
    .filter((job) => job.sourceUrl && /^https?:\/\//i.test(job.sourceUrl))
    .slice(0, DETAIL_BATCH_LIMIT);
  if (!sourceJobs.length) return { ok: false, error: '当前列表没有可打开的岗位详情链接。' };

  const detailJobs = [];
  const failures = [];
  for (const job of sourceJobs) {
    const result = await extractOneDetail(job.sourceUrl);
    if (result.ok && result.payload?.jobs?.length) {
      detailJobs.push(...result.payload.jobs.map((detail) => ({
        ...job,
        ...detail,
        sourceUrl: detail.sourceUrl || job.sourceUrl,
        title: detail.title || job.title,
        company: detail.company || job.company,
        location: detail.location || job.location,
        salaryRange: detail.salaryRange || job.salaryRange,
        sourceTrace: {
          capturedFrom: 'detail-background-tab',
          listUrl: listResult.payload.pageUrl,
          detailUrl: detail.sourceUrl || job.sourceUrl,
          detailCompleted: Boolean(detail.description),
          loginRequired: false,
          capturedAt: new Date().toISOString()
        }
      })));
    } else {
      failures.push({ url: job.sourceUrl, error: result.error || '详情页未识别到岗位。' });
      detailJobs.push({
        ...job,
        sourceTrace: {
          capturedFrom: 'list-fallback',
          listUrl: listResult.payload.pageUrl,
          detailUrl: job.sourceUrl,
          detailCompleted: false,
          loginRequired: /登录|验证|验证码/.test(result.error || ''),
          capturedAt: new Date().toISOString()
        }
      });
    }
  }

  const syncResult = await syncJobs({
    ...listResult.payload,
    jobs: uniqueByUrl(detailJobs)
  });
  if (!syncResult.ok) return syncResult;
  return {
    ok: true,
    body: syncResult.body,
    scanned: sourceJobs.length,
    detailed: detailJobs.length - failures.length,
    fallback: failures.length,
    failures: failures.slice(0, 5)
  };
}

async function extractOneDetail(url) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoaded(tab.id);
    await delay(DETAIL_OPEN_DELAY_MS);
    return await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_DETAIL_JOBS' });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '详情页采集失败' };
  } finally {
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch { /* Ignore closed tabs. */ }
    }
  }
}

function waitForTabLoaded(tabId) {
  if (!tabId) return Promise.reject(new Error('详情页标签创建失败'));
  return new Promise(async (resolve, reject) => {
    let done = false;
    let timeout;
    const finish = (callback) => {
      if (done) return;
      done = true;
      if (timeout) clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      callback();
    };
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      finish(resolve);
    };
    chrome.tabs.onUpdated.addListener(listener);
    timeout = setTimeout(() => {
      finish(() => reject(new Error('详情页加载超时，可能需要登录或验证。')));
    }, DETAIL_TAB_TIMEOUT_MS);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') finish(resolve);
    } catch {
      finish(() => reject(new Error('详情页标签读取失败。')));
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.sourceUrl || item.externalId || `${item.title}|${item.company}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function checkBridge() {
  const { jobSyncToken = '' } = await chrome.storage.local.get('jobSyncToken');
  if (!jobSyncToken) return { ok: false, error: '请先在扩展中填写 Interview OS 同步令牌。' };
  try {
    const response = await fetch(`${BRIDGE_URL}/health`, { cache: 'no-store' });
    await response.json();
    return response.ok ? { ok: true } : { ok: false, error: 'Interview OS Bridge 健康检查失败。' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '无法连接 Interview OS Bridge' };
  }
}

async function syncJobs(payload) {
  const { jobSyncToken = '' } = await chrome.storage.local.get('jobSyncToken');
  if (!jobSyncToken) return { ok: false, error: '请先在扩展中填写 Interview OS 同步令牌。' };
  try {
    const response = await fetch(`${BRIDGE_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Interview-OS-Token': jobSyncToken
      },
      body: JSON.stringify({ ...payload, token: jobSyncToken })
    });
    const body = await response.json();
    return response.ok ? { ok: true, body } : { ok: false, error: body.error || '同步失败' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '无法连接 Interview OS' };
  }
}
