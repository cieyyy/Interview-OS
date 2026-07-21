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
