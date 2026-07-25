const BRIDGE_URL = 'http://127.0.0.1:19426';
const SUPPORTED_URLS = [
  'https://www.zhipin.com/*',
  'https://www.liepin.com/*',
  'https://www.zhaopin.com/*',
  'https://i.zhaopin.com/*',
  'https://jobs.zhaopin.com/*',
  'https://we.51job.com/*',
  'https://www.51job.com/*',
  'https://jobs.51job.com/*',
  'https://i.51job.com/*',
  'https://www.lagou.com/*'
];
const DETAIL_BATCH_LIMIT = 100;
const LIST_PAGE_LIMIT = 10;
const DETAIL_OPEN_DELAY_MS = 1500;
const LIST_OPEN_DELAY_MS = 900;
const DETAIL_TAB_TIMEOUT_MS = 12000;
const TAB_CREATE_RETRY_LIMIT = 5;
const TAB_CREATE_RETRY_DELAY_MS = 450;
const TAB_MESSAGE_RETRY_LIMIT = 4;
const BATCH_SYNC_STATE_KEY = 'batchSyncState';
let activeBatchSyncPromise;

chrome.runtime.onInstalled.addListener(async () => {
  const { captureMode } = await chrome.storage.local.get('captureMode');
  if (!captureMode) await chrome.storage.local.set({ captureMode: 'manual' });
  chrome.alarms.create('interview-os-sync', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'interview-os-sync') return;
  const { captureMode = 'manual' } = await chrome.storage.local.get('captureMode');
  if (captureMode !== 'auto') return;
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
    void getOrStartBatchSync(message.tabId).then(sendResponse);
    return true;
  }
  if (message?.type === 'GET_BATCH_SYNC_STATE') {
    void chrome.storage.local.get(BATCH_SYNC_STATE_KEY)
      .then((value) => sendResponse({ ok: true, state: value[BATCH_SYNC_STATE_KEY] || null }));
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

function getOrStartBatchSync(tabId) {
  if (activeBatchSyncPromise) return activeBatchSyncPromise;
  activeBatchSyncPromise = syncDetailBatch(tabId).finally(() => {
    activeBatchSyncPromise = undefined;
  });
  return activeBatchSyncPromise;
}

async function syncDetailBatch(tabId) {
  await writeBatchSyncState({
    status: 'running',
    phase: 'list',
    startedAt: new Date().toISOString(),
    processed: 0,
    discovered: 0,
    detailed: 0,
    failed: 0,
    failures: []
  });
  await setSyncBadge('...', '#087cf0');

  let result;
  try {
    result = await performDetailBatch(tabId);
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : '批量同步失败' };
  }

  await updateBatchSyncState({
    ...result,
    status: result.ok ? 'success' : 'error',
    phase: 'complete',
    completedAt: new Date().toISOString()
  });
  const failed = result.failed ?? result.failures?.length ?? 0;
  await setSyncBadge(result.ok ? (failed ? `!${Math.min(failed, 99)}` : 'OK') : 'ERR', result.ok && !failed ? '#138a5b' : '#c24130');
  return result;
}

async function performDetailBatch(tabId) {
  if (!tabId) return { ok: false, error: '未找到当前标签页。' };
  const bridge = await checkBridge();
  if (!bridge.ok) return bridge;

  let listResult;
  try {
    listResult = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_VISIBLE_JOBS' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return {
      ok: false,
      error: /Receiving end does not exist|Could not establish connection/i.test(message)
        ? '扩展内容脚本尚未加载。请在 chrome://extensions 重新加载扩展，然后刷新当前招聘页面。'
        : `无法读取当前招聘列表：${message}`
    };
  }
  if (!listResult?.ok) return { ok: false, error: listResult?.error || '当前页面未识别到岗位列表。' };

  const pagedList = await collectPaginatedListJobs(listResult);
  listResult = {
    ...listResult,
    payload: {
      ...listResult.payload,
      jobs: pagedList.jobs
    }
  };

  const discoveredJobs = uniqueByUrl(listResult.payload.jobs || [])
    .filter((job) => job.sourceUrl && /^https?:\/\//i.test(job.sourceUrl));
  const sourceJobs = discoveredJobs.slice(0, DETAIL_BATCH_LIMIT);
  if (!sourceJobs.length) return { ok: false, error: '当前列表没有可打开的岗位详情链接。' };

  await updateBatchSyncState({
    status: 'running',
    phase: 'details',
    pagesScanned: pagedList.pagesScanned,
    discovered: discoveredJobs.length,
    processed: 0
  });

  const detailJobs = [];
  const failures = [];
  for (const [index, job] of sourceJobs.entries()) {
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
      failures.push({
        externalId: job.externalId || '',
        title: job.title || '未识别岗位名称',
        company: job.company || '未识别公司',
        location: job.location || '',
        salaryRange: job.salaryRange || '',
        url: job.sourceUrl,
        error: result.error || '详情页未识别到岗位。'
      });
    }
    await updateBatchSyncState({
      status: 'running',
      phase: 'details',
      pagesScanned: pagedList.pagesScanned,
      discovered: discoveredJobs.length,
      processed: index + 1,
      detailed: detailJobs.length,
      failed: failures.length,
      failures
    });
  }

  if (!detailJobs.length) {
    return {
      ok: false,
      error: failures.some((item) => /登录|验证|验证码/.test(item.error))
        ? '详情页没有采集到完整岗位。请先在招聘网站完成登录/验证码，再重新执行。'
        : '详情页没有采集到完整岗位，已停止写入职位池，避免把列表页残缺信息当成完整岗位。',
      scanned: sourceJobs.length,
      discovered: discoveredJobs.length,
      pagesScanned: pagedList.pagesScanned,
      detailed: 0,
      fallback: failures.length,
      failed: failures.length,
      failures
    };
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
    discovered: discoveredJobs.length,
    pagesScanned: pagedList.pagesScanned,
    detailed: detailJobs.length,
    fallback: 0,
    failed: failures.length,
    failures
  };
}

async function writeBatchSyncState(state) {
  await chrome.storage.local.set({
    [BATCH_SYNC_STATE_KEY]: {
      ...state,
      updatedAt: new Date().toISOString()
    }
  });
}

async function updateBatchSyncState(patch) {
  const stored = await chrome.storage.local.get(BATCH_SYNC_STATE_KEY);
  await writeBatchSyncState({
    ...(stored[BATCH_SYNC_STATE_KEY] || {}),
    ...patch
  });
}

async function setSyncBadge(text, color) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
  } catch {
    // Badge feedback is optional; stored progress remains authoritative.
  }
}

async function collectPaginatedListJobs(listResult) {
  const initialJobs = uniqueByUrl(listResult.payload?.jobs || []);
  const rawPageUrl = listResult.payload?.pageUrl || '';
  let pageUrl;
  try {
    pageUrl = new URL(rawPageUrl);
  } catch {
    return { jobs: initialJobs, pagesScanned: 1 };
  }

  const isBossPersonalList = listResult.payload?.sourceSite === 'boss'
    && /\/web\/geek\/(?:recommend|chat|history)/i.test(pageUrl.pathname)
    && pageUrl.searchParams.has('page');
  if (!isBossPersonalList || !initialJobs.length) {
    return { jobs: initialJobs, pagesScanned: 1 };
  }

  const allJobs = [...initialJobs];
  const seen = new Set(initialJobs.map(jobKey));
  const firstPageSize = initialJobs.length;
  const currentPage = Math.max(1, Number(pageUrl.searchParams.get('page')) || 1);
  let pagesScanned = 1;

  for (let page = currentPage + 1; page <= currentPage + LIST_PAGE_LIMIT - 1; page += 1) {
    pageUrl.searchParams.set('page', String(page));
    const result = await extractOneListPage(pageUrl.toString());
    if (!result.ok || !result.payload?.jobs?.length) break;

    const pageJobs = uniqueByUrl(result.payload.jobs);
    const novelJobs = pageJobs.filter((job) => {
      const key = jobKey(job);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!novelJobs.length) break;

    allJobs.push(...novelJobs);
    pagesScanned += 1;
    if (pageJobs.length < firstPageSize || allJobs.length >= DETAIL_BATCH_LIMIT) break;
  }

  return { jobs: uniqueByUrl(allJobs).slice(0, DETAIL_BATCH_LIMIT), pagesScanned };
}

async function extractOneListPage(url) {
  let tab;
  try {
    tab = await createBackgroundTab(url);
    await waitForTabLoaded(tab.id);
    await delay(LIST_OPEN_DELAY_MS);
    return await sendTabMessageWithRetry(tab.id, { type: 'EXTRACT_VISIBLE_JOBS' });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '岗位列表分页采集失败' };
  } finally {
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch { /* Ignore closed tabs. */ }
    }
  }
}

async function extractOneDetail(url) {
  let tab;
  try {
    tab = await createBackgroundTab(url);
    await waitForTabLoaded(tab.id);
    await delay(DETAIL_OPEN_DELAY_MS);
    return await sendTabMessageWithRetry(tab.id, { type: 'EXTRACT_DETAIL_JOBS' });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '详情页采集失败' };
  } finally {
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch { /* Ignore closed tabs. */ }
    }
  }
}

async function createBackgroundTab(url) {
  let lastError;
  for (let attempt = 0; attempt < TAB_CREATE_RETRY_LIMIT; attempt += 1) {
    try {
      return await chrome.tabs.create({ url, active: false });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error || '');
      if (!/tabs cannot be edited right now|user may be dragging a tab/i.test(message)) throw error;
      await delay(TAB_CREATE_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError || new Error('后台详情页标签创建失败。');
}

async function sendTabMessageWithRetry(tabId, message) {
  let lastError;
  for (let attempt = 0; attempt < TAB_MESSAGE_RETRY_LIMIT; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      lastError = error;
      const text = error instanceof Error ? error.message : String(error || '');
      if (!/receiving end does not exist|could not establish connection/i.test(text)) throw error;
      await delay(500 + attempt * 350);
    }
  }
  throw lastError || new Error('详情页内容脚本尚未就绪。');
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
    const key = jobKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function jobKey(item) {
  return item.externalId || item.sourceUrl || `${item.title}|${item.company}`;
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
