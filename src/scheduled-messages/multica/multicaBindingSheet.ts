import type { MulticaBindingRecord } from './multicaContract.js';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const BINDING_SHEET = '_AgentBindings';

export async function upsertSpreadsheetConfigKey(options: {
  fetchImpl?: FetchLike;
  token: string;
  spreadsheetId: string;
  key: string;
  value: string;
}): Promise<void> {
  const fetchImpl = options.fetchImpl || fetch;
  const rows = await readValues(fetchImpl, options.token, options.spreadsheetId, 'Config!A:B');
  const header = rows[0] || [];
  if (header[0] !== 'Key') {
    await writeValues(fetchImpl, options.token, options.spreadsheetId, 'Config!A1:B1', [['Key', 'Value']]);
  }
  const body = header[0] === 'Key' ? rows.slice(1) : rows;
  const index = body.findIndex((row) => row[0] === options.key);
  const targetRow = index >= 0 ? index + 2 : body.length + 2;
  await writeValues(
    fetchImpl,
    options.token,
    options.spreadsheetId,
    `Config!A${targetRow}:B${targetRow}`,
    [[options.key, options.value]],
  );
}

export const MULTICA_ROW_BINDING_COLUMNS = ['Agent_Multica_Webhook_URL', 'Agent_Multica_Spreadsheet_ID'] as const;

/** One current binding belongs to its Messages row. Never create a binding table. */
export async function upsertMulticaBinding(options: {
  fetchImpl?: FetchLike; token: string; spreadsheetId: string; record: MulticaBindingRecord;
}): Promise<void> {
  const fetchImpl = options.fetchImpl || fetch;
  const rows = await readValues(fetchImpl, options.token, options.spreadsheetId, 'Messages');
  const headers = rows[0] || [];
  const id = headers.indexOf('ID');
  const binding = headers.indexOf('Agent_Binding_ID');
  const matches = rows.slice(1).map((row, index) => ({ row, number: index + 2 }))
    .filter(item => item.row[id] === options.record.messageId);
  if (matches.length !== 1 || matches[0].row[binding] !== options.record.bindingUuid) throw new Error('Messages 绑定已变化，请刷新后重试');
  if (MULTICA_ROW_BINDING_COLUMNS.some(key => !headers.includes(key))) throw new Error('请先升级 Messages 表结构');
  const item = matches[0];
  const oldUrl = item.row[headers.indexOf(MULTICA_ROW_BINDING_COLUMNS[0])] || '';
  const oldSheet = item.row[headers.indexOf(MULTICA_ROW_BINDING_COLUMNS[1])] || '';
  const webhook = options.record.webhookUrl || (oldSheet === options.spreadsheetId ? oldUrl : '');
  if (!webhook || options.record.spreadsheetId !== options.spreadsheetId) throw new Error('Webhook 不可用，请重新连接 Multica');
  await writeRowBinding(fetchImpl, options.token, options.spreadsheetId, headers, item.number, webhook, options.spreadsheetId);
}

/** Copy only referenced bindings, verify each persisted value, then delete the old
 * table only after the live script understands Messages storage (>=3.5.0). */
export async function migrateMulticaBindingsToMessages(options: {
  fetchImpl?: FetchLike; token: string; spreadsheetId: string; webAppUrl?: string;
}): Promise<{ migrated: number; deleted: boolean }> {
  const fetchImpl = options.fetchImpl || fetch;
  const metadata = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${options.spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${options.token}` },
  });
  if (!metadata.ok) throw new Error('读取绑定迁移结构失败');
  const legacy = (await metadata.json()).sheets?.find((s: any) => s.properties?.title === BINDING_SHEET);
  if (!legacy) return { migrated: 0, deleted: false };
  const rows = await readValues(fetchImpl, options.token, options.spreadsheetId, 'Messages');
  const headers = rows[0] || [];
  if (MULTICA_ROW_BINDING_COLUMNS.some(key => !headers.includes(key))) throw new Error('绑定迁移缺少 Messages 列');
  const old = await readValues(fetchImpl, options.token, options.spreadsheetId, `${BINDING_SHEET}!A:R`);
  const oldHeaders = old[0] || [];
  let migrated = 0;
  for (let i = 1; i < rows.length; i++) {
    const get = (key: string) => rows[i][headers.indexOf(key)] || '';
    if (get('Agent_Provider') !== 'multica') continue;
    let webhook = get(MULTICA_ROW_BINDING_COLUMNS[0]);
    let owner = get(MULTICA_ROW_BINDING_COLUMNS[1]);
    if (!owner) {
      const matching = old.slice(1).filter(row => row[oldHeaders.indexOf('bindingUuid')] === get('Agent_Binding_ID')
        && row[oldHeaders.indexOf('messageId')] === get('ID'));
      if (matching.length !== 1) throw new Error('旧绑定缺失或重复，未删除绑定表；请重新保存 Multica 任务');
      const record = matching[0];
      owner = record[oldHeaders.indexOf('spreadsheetId')] || '';
      webhook = owner === options.spreadsheetId ? record[oldHeaders.indexOf('webhookUrl')] || '' : '';
      await writeRowBinding(fetchImpl, options.token, options.spreadsheetId, headers, i + 1, webhook, owner);
      migrated++;
    }
    const persisted = await readValues(fetchImpl, options.token, options.spreadsheetId, `Messages!${i + 1}:${i + 1}`);
    if ((persisted[0]?.[headers.indexOf('ID')] || '') !== get('ID')
      || (persisted[0]?.[headers.indexOf('Agent_Binding_ID')] || '') !== get('Agent_Binding_ID')
      || (persisted[0]?.[headers.indexOf(MULTICA_ROW_BINDING_COLUMNS[0])] || '') !== webhook
      || (persisted[0]?.[headers.indexOf(MULTICA_ROW_BINDING_COLUMNS[1])] || '') !== owner) {
      throw new Error('Messages 绑定迁移回读不一致，未删除旧表');
    }
  }
  if (!options.webAppUrl) return { migrated, deleted: false };
  const versionResponse = await fetchImpl(options.webAppUrl + '?action=getVersion', { credentials: 'omit' });
  if (!versionResponse.ok) return { migrated, deleted: false };
  const version = String((await versionResponse.json()).version || '').split('.').map(Number);
  if (!(version[0] > 3 || (version[0] === 3 && version[1] >= 5))) return { migrated, deleted: false };
  const latestLegacy = await readValues(fetchImpl, options.token, options.spreadsheetId, `${BINDING_SHEET}!A:R`);
  if (JSON.stringify(latestLegacy) !== JSON.stringify(old)) throw new Error('旧绑定在迁移期间发生变化，未删除旧表；请重新同步');
  const removed = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${options.spreadsheetId}:batchUpdate`, {
    method: 'POST', headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: legacy.properties.sheetId } }] }),
  });
  if (!removed.ok) throw new Error('绑定已迁移，删除旧绑定表失败');
  return { migrated, deleted: true };
}

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

async function writeRowBinding(fetchImpl: FetchLike, token: string, spreadsheetId: string, headers: string[], row: number, webhook: string, owner: string): Promise<void> {
  const data = [webhook, owner].map((value, i) => ({
    range: `Messages!${columnName(headers.indexOf(MULTICA_ROW_BINDING_COLUMNS[i]))}${row}`, values: [[value]],
  }));
  const response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
  if (!response.ok) throw new Error('写入 Messages 绑定失败');
}

async function readValues(fetchImpl: FetchLike, token: string, spreadsheetId: string, range: string): Promise<string[][]> {
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (response.status === 400) return [];
  if (!response.ok) throw new Error(`读取 ${range} 失败 (${response.status})`);
  const body = await response.json() as { values?: string[][] };
  return body.values || [];
}

async function writeValues(
  fetchImpl: FetchLike,
  token: string,
  spreadsheetId: string,
  range: string,
  values: string[][],
): Promise<void> {
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    },
  );
  if (!response.ok) throw new Error(`写入表格失败 (${response.status})`);
}
