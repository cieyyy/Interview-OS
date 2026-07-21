const BRIDGE_URL = 'http://127.0.0.1:19426';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('interview-os-sync', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'interview-os-sync') return;
  const tabs = await chrome.tabs.query({
    url: [
      'https://www.zhipin.com/*',
      'https://www.liepin.com/*',
      'https://www.zhaopin.com/*',
      'https://we.51job.com/*',
      'https://www.51job.com/*',
      'https://www.lagou.com/*'
    ]
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
  if (message?.type === 'CHECK_BRIDGE') {
    void fetch(`${BRIDGE_URL}/health`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((body) => sendResponse({ ok: true, body }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

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
