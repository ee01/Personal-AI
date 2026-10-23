/** Deterministic contracts shared by upgrade UI, coordinator and tests. */
export type RuntimeHealth = {
  success: boolean;
  spreadsheetId?: string;
  scriptVersion?: string;
  executionStoreSchemaVersion?: number;
  mode?: string;
  ready?: boolean;
  freshCandidate?: boolean;
  firstPollAt?: string;
  activatedAt?: string;
  error?: string;
};

export function compatibleRuntime(health: RuntimeHealth, sheetId: string): boolean {
  return health.success === true && health.spreadsheetId === sheetId &&
    health.executionStoreSchemaVersion === 1 && health.ready === true && health.mode === 'sheet_primary';
}

/** Replace string values recursively, preserving custom rule fields and expressions. */
export function replaceRuleUrl<T>(value: T, oldUrl: string, newUrl: string): T {
  if (!oldUrl || oldUrl === newUrl) throw new Error('新旧部署地址必须不同');
  if (typeof value === 'string') {
    return value.split(oldUrl).join(newUrl)
      .split(encodeURIComponent(oldUrl)).join(encodeURIComponent(newUrl)) as T;
  }
  if (Array.isArray(value)) return value.map(item => replaceRuleUrl(item, oldUrl, newUrl)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceRuleUrl(item, oldUrl, newUrl)]),
  ) as T;
  return value;
}

export function ruleContainsUrl(value: unknown, url: string): boolean {
  const serialized = JSON.stringify(value);
  return serialized.includes(url) || serialized.includes(encodeURIComponent(url));
}

/** Jira regenerates structural node IDs on PUT. Keep business IDs inside value intact. */
export function jiraRuleContentMatches(expected: unknown, actual: unknown): boolean {
  const canonical = (value: any, node = false): any => {
    if (Array.isArray(value)) return value.map(item => canonical(item, node));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => !node || !['id', 'parentId', 'conditionParentId'].includes(key))
      .map(key => [key, canonical(value[key], node && ['children', 'conditions'].includes(key))]));
  };
  return JSON.stringify(canonical(expected, true)) === JSON.stringify(canonical(actual, true));
}

export interface ImportPreview {
  rows: string[][];
  pending: string[];
  sent: string[];
  errors: string[];
  warnings: string[];
}

/** Whole rows retain counts and same-day receipts; unknown deliveries are quarantined. */
export function inspectUpgradeRows(values: unknown[][]): ImportPreview {
  const rows = values.map(row => row.map(cell => String(cell ?? '')));
  const headers = rows[0] || [];
  const errors: string[] = [];
  for (const column of ['ID', 'Topic', 'Content', 'Status', 'Last_Exec', 'Exec_Count', 'Exec_Log', 'Push_Method', 'Schedule_Date', 'Schedule_Time']) {
    if (headers.filter(h => h === column).length !== 1) errors.push(`缺少或重复列：${column}`);
  }
  const get = (row: string[], column: string) => row[headers.indexOf(column)] || '';
  const pending: string[] = [];
  const sent: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  rows.slice(1).forEach((row, i) => {
    if (!row.some(Boolean)) return;
    const id = get(row, 'ID');
    if (!id || ids.has(id)) errors.push(`第 ${i + 2} 行 ID 为空或重复`);
    ids.add(id);
    if (!['Active', 'Paused', 'Completed', 'Done', 'PendingReview'].includes(get(row, 'Status'))) errors.push(`${id}：无效 Status`);
    if (!['AsMe', 'Bot', 'AI', 'AgentTask', 'JiraAutomation', 'Email'].includes(get(row, 'Push_Method'))) errors.push(`${id}：无效推送方式`);
    if (!Number.isFinite(Number(get(row, 'Exec_Count'))) || Number(get(row, 'Exec_Count')) < 0) errors.push(`${id}：执行次数无效`);
    const log = get(row, 'Exec_Log');
    if (/⏳|UNKNOWN|待确认|trigger_delivery_failed/i.test(log)) pending.push(id);
    if (/✅/.test(log) && get(row, 'Last_Exec')) sent.push(id);
    if (!get(row, 'Schedule_Time') && get(row, 'Status') === 'Active') warnings.push(`${id} 未设置时间：若当日执行字段未复制，可能当天再次发送`);
    if (get(row, 'Timeline_Milestone') && get(row, 'Status') === 'Active') warnings.push(`${id} 为 Timeline：需等待新表缓存同步后匹配`);
  });
  return { rows, pending, sent, errors, warnings };
}

export function quarantineImportedRows(values: string[][]): string[][] {
  const preview = inspectUpgradeRows(values);
  if (preview.errors.length) throw new Error(preview.errors.join('；'));
  const headers = values[0];
  return values.map((row, index) => {
    const copy = [...row];
    if (index && preview.pending.includes(copy[headers.indexOf('ID')])) copy[headers.indexOf('Status')] = 'Paused';
    return copy;
  });
}
