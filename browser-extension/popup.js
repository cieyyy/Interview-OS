const tokenInput = document.querySelector('#token');
const statusNode = document.querySelector('#status');

chrome.storage.local.get('jobSyncToken').then(({ jobSyncToken = '' }) => {
  tokenInput.value = jobSyncToken;
});

document.querySelector('#save').addEventListener('click', async () => {
  await chrome.storage.local.set({ jobSyncToken: tokenInput.value.trim() });
  statusNode.textContent = '令牌已保存在本机 Chrome 扩展存储中。';
});

document.querySelector('#check').addEventListener('click', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'CHECK_BRIDGE' });
  statusNode.textContent = result?.ok ? 'Interview OS Bridge 已连接。' : `连接失败：${result?.error || '未知错误'}`;
});

document.querySelector('#sync').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusNode.textContent = '未找到当前标签页。';
    return;
  }
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SYNC' });
    statusNode.textContent = result?.ok
      ? `同步完成：${result.body?.added ?? 0} 个新增，${result.body?.updated ?? 0} 个更新。`
      : `同步失败：${result?.error || '当前页面未识别到岗位'}`;
  } catch (error) {
    statusNode.textContent = `同步失败：${error.message}`;
  }
});

document.querySelector('#sync-details').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusNode.textContent = '未找到当前标签页。';
    return;
  }
  statusNode.textContent = '正在后台打开岗位详情页补全信息，请不要关闭浏览器……';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SYNC_DETAIL_BATCH', tabId: tab.id });
    if (result?.ok) {
      statusNode.textContent = [
        `详情补全完成：扫描 ${result.scanned ?? 0} 个岗位。`,
        `详情成功 ${result.detailed ?? 0} 个，列表兜底 ${result.fallback ?? 0} 个。`,
        `写入：${result.body?.added ?? 0} 个新增，${result.body?.updated ?? 0} 个更新。`
      ].join('\n');
    } else {
      statusNode.textContent = `详情补全失败：${result?.error || '未知错误'}`;
    }
  } catch (error) {
    statusNode.textContent = `详情补全失败：${error.message}`;
  }
});
