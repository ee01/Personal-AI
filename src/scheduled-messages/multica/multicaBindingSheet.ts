import {
  MULTICA_BINDING_HEADERS,
  type MulticaBindingRecord,
} from './multicaContract.js';

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

export async function upsertMulticaBinding(options: {
  fetchImpl?: FetchLike;
  token: string;
  spreadsheetId: string;
  record: MulticaBindingRecord;
}): Promise<void> {
  const fetchImpl = options.fetchImpl || fetch;
  await ensureBindingSheet(fetchImpl, options.token, options.spreadsheetId);
  const rows = await readValues(fetchImpl, options.token, options.spreadsheetId, `${BINDING_SHEET}!A:R`);
  if (!rows.length || rows[0][0] !== 'bindingUuid') {
    await writeValues(
      fetchImpl,
      options.token,
      options.spreadsheetId,
      `${BINDING_SHEET}!A1:R1`,
      [MULTICA_BINDING_HEADERS.slice()],
    );
  }
  const body = rows[0]?.[0] === 'bindingUuid' ? rows.slice(1) : [];
  const index = body.findIndex((row) => row[0] === options.record.bindingUuid);
  const targetRow = index >= 0 ? index + 2 : body.length + 2;
  const values = MULTICA_BINDING_HEADERS.map((key) => options.record[key] || '');
  const webhookIndex = MULTICA_BINDING_HEADERS.indexOf('webhookUrl');
  if (!options.record.webhookUrl && index >= 0 && body[index]?.[webhookIndex]) {
    values[webhookIndex] = body[index][webhookIndex];
  }
  await writeValues(
    fetchImpl,
    options.token,
    options.spreadsheetId,
    `${BINDING_SHEET}!A${targetRow}:R${targetRow}`,
    [values],
  );
}

async function ensureBindingSheet(fetchImpl: FetchLike, token: string, spreadsheetId: string): Promise<void> {
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`读取表格结构失败 (${response.status})`);
  const metadata = await response.json() as { sheets?: Array<{ properties?: { title?: string } }> };
  const exists = (metadata.sheets || []).some((sheet) => sheet.properties?.title === BINDING_SHEET);
  if (exists) return;
  const created = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: BINDING_SHEET } } }] }),
    },
  );
  if (!created.ok) throw new Error(`创建绑定表失败 (${created.status})`);
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
