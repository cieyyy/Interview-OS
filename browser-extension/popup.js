const tokenInput = document.querySelector('#token');
const statusNode = document.querySelector('#status');
const modeHelp = document.querySelector('#mode-help');
const modeInputs = [...document.querySelectorAll('input[name="captureMode"]')];
const failurePanel = document.querySelector('#failure-panel');
const failureList = document.querySelector('#failure-list');
const copyFailuresButton = document.querySelector('#copy-failures');
let lastFailures = [];

function renderBatchState(state) {
  if (!state) return;
  renderFailures(state.failures || []);
  if (state.status === 'running') {
    statusNode.textContent = state.phase === 'list'
      ? '后台同步中：正在遍历岗位列表分页。可以关闭弹窗，重新打开后会继续显示进度。'
      : [
          `后台同步中：已遍历 ${state.pagesScanned ?? 1} 页，发现 ${state.discovered ?? 0} 个岗位。`,
          `已处理 ${state.processed ?? 0}/${state.discovered ?? 0}，成功 ${state.detailed ?? 0}，失败 ${state.failed ?? 0}。`,
          '可以关闭弹窗，同步会在后台继续。'
        ].join('\n');
    return;
  }
  if (state.status === 'success') {
    statusNode.textContent = [
      `同步完成：遍历 ${state.pagesScanned ?? 1} 页，发现 ${state.discovered ?? state.scanned ?? 0} 个岗位。`,
      `详情成功 ${state.detailed ?? 0} 个，失败 ${state.failed ?? 0} 个。`,
      `写入：${state.body?.added ?? 0} 个新增，${state.body?.updated ?? 0} 个更新。`
    ].join('\n');
    return;
  }
  if (state.status === 'error') {
    statusNode.textContent = `后台同步失败：${state.error || '未知错误'}`;
  }
}

function renderFailures(failures = []) {
  lastFailures = failures;
  failureList.replaceChildren();
  failurePanel.hidden = failures.length === 0;
  if (!failures.length) return;

  for (const failure of failures) {
    const item = document.createElement('li');
    item.className = 'failure-item';
    const title = document.createElement('a');
    title.className = 'failure-title';
    title.textContent = failure.title || '未识别岗位名称';
    title.href = failure.url || '#';
    title.target = '_blank';
    title.rel = 'noreferrer';
    const meta = document.createElement('div');
    meta.className = 'failure-meta';
    meta.textContent = [failure.company, failure.location, failure.salaryRange].filter(Boolean).join(' · ');
    const reason = document.createElement('div');
    reason.className = 'failure-reason';
    reason.textContent = failure.error || '未知失败原因';
    item.append(title, meta, reason);
    failureList.append(item);
  }
}

copyFailuresButton.addEventListener('click', async () => {
  const text = lastFailures.map((failure, index) => [
    `${index + 1}. ${failure.title || '未识别岗位名称'}`,
    `公司：${failure.company || '未识别公司'}`,
    `原因：${failure.error || '未知失败原因'}`,
    `链接：${failure.url || '无'}`
  ].join('\n')).join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    copyFailuresButton.textContent = '已复制';
  } catch {
    copyFailuresButton.textContent = '复制失败';
  }
  setTimeout(() => { copyFailuresButton.textContent = '复制清单'; }, 1500);
});

chrome.storage.local.get({ jobSyncToken: '', captureMode: 'manual' }).then(({ jobSyncToken, captureMode }) => {
  tokenInput.value = jobSyncToken;
  renderCaptureMode(captureMode);
});

chrome.runtime.sendMessage({ type: 'GET_BATCH_SYNC_STATE' }).then((result) => {
  renderBatchState(result?.state);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.batchSyncState) {
    renderBatchState(changes.batchSyncState.newValue);
  }
});

function renderCaptureMode(mode) {
  const normalized = mode === 'auto' ? 'auto' : 'manual';
  modeInputs.forEach((input) => { input.checked = input.value === normalized; });
  modeHelp.textContent = normalized === 'auto'
    ? '浏览岗位详情页时自动识别并去重同步；不会自动投递或发送消息。'
    : '仅在点击下方同步按钮时捕获岗位，适合逐条确认。';
}

modeInputs.forEach((input) => input.addEventListener('change', async () => {
  if (!input.checked) return;
  await chrome.storage.local.set({ captureMode: input.value });
  renderCaptureMode(input.value);
  statusNode.textContent = input.value === 'auto' ? '自动捕获已开启。' : '已切换为手动捕获。';
}));

document.querySelector('#save').addEventListener('click', async () => {
  await chrome.storage.local.set({ jobSyncToken: tokenInput.value.trim() });
  statusNode.textContent = '令牌已保存在本机 Chrome 扩展存储中。';
});

document.querySelector('#check').addEventListener('click', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'CHECK_BRIDGE' });
  statusNode.textContent = result?.ok ? 'Interview OS Bridge 已连接。' : `连接失败：${result?.error || '未知错误'}`;
});

document.querySelector('#sync').addEventListener('click', async () => {
  renderFailures();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusNode.textContent = '未找到当前标签页。';
    return;
  }
  try {
    const detailResult = await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_SYNC' });
    if (detailResult?.ok) {
      statusNode.textContent = `详情页同步完成：${detailResult.body?.added ?? 0} 个新增，${detailResult.body?.updated ?? 0} 个更新。`;
      return;
    }

    statusNode.textContent = '当前是岗位列表，正在遍历分页并后台打开详情页……';
    const batchResult = await chrome.runtime.sendMessage({ type: 'SYNC_DETAIL_BATCH', tabId: tab.id });
    renderBatchState({ ...batchResult, status: batchResult?.ok ? 'success' : 'error' });
  } catch (error) {
    statusNode.textContent = /Receiving end does not exist|Could not establish connection/i.test(error.message)
      ? '同步失败：扩展内容脚本尚未加载。请重新加载扩展并刷新当前招聘页面。'
      : `同步失败：${error.message}`;
  }
});

document.querySelector('#sync-details').addEventListener('click', async () => {
  renderFailures();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusNode.textContent = '未找到当前标签页。';
    return;
  }
  statusNode.textContent = '正在遍历列表分页并后台打开岗位详情页，请不要关闭浏览器……';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SYNC_DETAIL_BATCH', tabId: tab.id });
    renderBatchState({ ...result, status: result?.ok ? 'success' : 'error' });
  } catch (error) {
    statusNode.textContent = /Receiving end does not exist|Could not establish connection/i.test(error.message)
      ? '详情补全失败：扩展内容脚本尚未加载。请重新加载扩展并刷新当前招聘页面。'
      : `详情补全失败：${error.message}`;
  }
});
