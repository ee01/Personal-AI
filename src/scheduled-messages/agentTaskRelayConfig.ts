import { GOOGLE_AUTH_SCOPE_SETS, getGoogleAuthTokenSilently } from '../utils/googleAuth';

/** Use the Sheet's existing capability across devices; never rotate it on a rule upgrade. */
export async function ensureAgentTaskRelayCapability(sheetId: string): Promise<string> {
  if (!sheetId) throw new Error('请先配置定时消息表格，再创建 AgentTask 中转规则');
  const token = await getGoogleAuthTokenSilently({ caller: 'AgentTaskRelay.configure', scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS });
  if (!token) throw new Error('配置 AgentTask 中转需要 Google Sheets 授权，请重新授权后再升级规则');
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const response = await fetch(`${base}Config!A:B`, { headers });
  if (!response.ok) throw new Error(`无法读取调度校验值 (${response.status})`);
  const rows: string[][] = (await response.json()).values || [];
  const index = rows.findIndex(row => row[0] === 'multica_scheduler_capability');
  let capability = index >= 0 ? String(rows[index][1] || '') : '';
  if (!/^[a-f0-9]{64}$/.test(capability)) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    capability = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const url = index >= 0
      ? `${base}Config!A${index + 1}:B${index + 1}?valueInputOption=RAW`
      : `${base}Config!A:B:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const written = await fetch(url, { method: index >= 0 ? 'PUT' : 'POST', headers,
      body: JSON.stringify({ values: [['multica_scheduler_capability', capability]] }) });
    if (!written.ok) throw new Error(`无法保存调度校验值 (${written.status})`);
  }
  await chrome.storage.local.set({ multicaSchedulerCapability: capability });
  return capability;
}
