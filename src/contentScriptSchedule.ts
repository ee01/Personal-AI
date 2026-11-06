/** Isolated-world UI: receiver credentials never cross into the website. */
const scheduleChannel = 'personal-schedule-extension-v1';
const shareToken = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
if (/^\/share\/shr_[A-Za-z0-9_-]+\/?$/.test(location.pathname) && !document.getElementById('personal-schedule-extension')) {
  const mount = document.createElement('div');
  mount.id = 'personal-schedule-extension';
  const root = mount.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host{display:block;margin:20px auto;max-width:920px;font:14px/1.6 system-ui}section{padding:20px;border:1px solid #c7ccf5;border-radius:12px;background:#fff;color:#172033}button{margin:8px 8px 0 0;padding:8px 14px;cursor:pointer}label{display:block;padding:6px}pre{white-space:pre-wrap}';
  const section = document.createElement('section');
  const heading = document.createElement('strong'); heading.textContent = 'Personal AI · 导入到我的账户';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const rows = document.createElement('div');
  const button = document.createElement('button'); button.textContent = '导入勾选任务'; button.disabled = true;
  const setup = document.createElement('button'); setup.textContent = '配置 / 切换 Schedule 账户';
  setup.onclick = () => { void chrome.runtime.sendMessage({ type: 'OPEN_SCHEDULE_SETUP' }); };
  const retry = document.createElement('button'); retry.textContent = '重试失败项'; retry.hidden = true;
  section.append(heading, status, rows, button, retry, setup); root.append(style, section);
  document.body.prepend(mount);
  let requestId = '';
  let priorSelected = '';
  let importId = '';
  let confirmDuplicates = false;
  let working = false;
  let account = '';
  const call = async (action: string, extra: any = {}) => {
    const response = await chrome.runtime.sendMessage({ type: 'PERSONAL_SCHEDULE_BRIDGE', action, shareToken, schemaVersion: 1, ...extra });
    if (!response?.success) throw new Error(response?.error || '连接失败');
    return response.result;
  };
  const showResult = (result: any) => {
    if (result.needConfirm) {
      status.textContent = `以下任务已导入：${result.duplicates.map((t: any) => t.title).join('、')}。再次点击会创建独立副本。`;
      confirmDuplicates = true; button.textContent = '确认再次导入（创建副本）'; return;
    }
    importId = result.importId;
    status.textContent = (result.results || []).map((r: any) => `${r.refKey}: ${r.status}${r.reason ? ` (${r.reason})` : ''}`).join('\n') + '\n导入副本默认未启用。请到新版“需要补全”确认时区，绑定自己的收件人、凭证与执行器。';
    retry.hidden = !(result.results || []).some((r: any) => r.status === 'failed');
    button.textContent = '查看 / 重放本次导入结果';
  };
  button.onclick = async () => {
    if (working) return;
    const selected = [...rows.querySelectorAll<HTMLInputElement>('input:checked')].map(el => el.value);
    if (!selected.length) { status.textContent = '请至少选择一个任务'; return; }
    const signature = JSON.stringify(selected);
    if (signature !== priorSelected) { priorSelected = signature; requestId = ''; confirmDuplicates = false; }
    working = true; button.disabled = true;
    try {
      const storageKey = `scheduleImport:${location.origin}:${account}:${shareToken}:${priorSelected}`;
      if (!requestId) requestId = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, requestId);
      showResult(await call('import', { selected, requestId, confirmDuplicates }));
    } catch(e) { status.textContent = e instanceof Error ? e.message : String(e); }
    finally { working = false; button.disabled = false; }
  };
  retry.onclick = async () => {
    if (working) return; working = true; retry.disabled = true;
    try { showResult(await call('retry', { importId })); }
    catch(e) { status.textContent = e instanceof Error ? e.message : String(e); }
    finally { working = false; retry.disabled = false; }
  };
  void (async () => {
    try {
      const hello = await call('hello');
      account = hello.account;
      const preview = await call('preview');
      if (preview.schemaVersion !== 1) throw new Error('分享格式不兼容，请升级扩展');
      status.textContent = `将导入到 ${hello.account}；当前分组 ${preview.tasks.length} 个任务。默认全选，可取消勾选。`;
      for (const task of preview.tasks) {
        const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.value = task.refKey;
        label.append(input, document.createTextNode(` ${task.title} · ${task.type} · ${task.scheduleSpec?.timezone || '请确认时区'}`)); rows.append(label);
      }
      button.disabled = false;
      window.postMessage({ channel: scheduleChannel, type: 'ready', version: hello.version, schemaVersion: 1 }, location.origin);
    } catch(e) { status.textContent = e instanceof Error ? e.message : String(e); }
  })();
}
