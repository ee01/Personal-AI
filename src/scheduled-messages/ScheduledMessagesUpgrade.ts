import { AppScriptUpdater } from './AppScriptUpdater';
import { SheetInitializer } from './SheetInitializer';
import { ConfigSyncService } from './ConfigSyncService';
import { JiraAutomationService, JiraRule } from './JiraAutomationService';
import { normalizeSheetConfig } from './botAutomationConfig';
import { SheetConfig, InitializationResult, BotAutomationRule } from './types';
import { formatLocalScheduleDate, formatLocalScheduleTime } from './scheduleDateTime';
import { RuntimeHealth, compatibleRuntime, inspectUpgradeRows, quarantineImportedRows, replaceRuleUrl, ruleContainsUrl } from './upgradeContracts';

export const UPGRADE_DRAFT_KEY = 'scheduledMessagesUpgradeDraft';
export interface UpgradeDraft {
  id: string;
  source: SheetConfig;
  token: string;
  candidate: Partial<InitializationResult>;
  stage: 'create' | 'import' | 'switch' | 'complete';
  retirementWritten?: boolean;
  retired?: boolean;
  manualRetired?: boolean;
  rules?: Array<{ config: BotAutomationRule; original: JiraRule }>;
  originalFiles?: Array<{ name: string; type: string; source: string }>;
  imported?: boolean;
  autoImported?: boolean;
  cutoverAt?: string;
  resolvedPending?: Record<string, string>;
  error?: string;
}

async function jsonResponse(response: Response): Promise<any> {
  if (!response.ok) throw new Error(`远端请求失败 (${response.status})`);
  try { return await response.json(); } catch { throw new Error('远端未返回 JSON，请完成 Google 授权后重试'); }
}

export async function probeRuntime(config: Pick<SheetConfig, 'sheetId' | 'webAppUrl'>): Promise<RuntimeHealth> {
  if (!config.webAppUrl) return { success: false, error: '未配置 Web App' };
  const body = await jsonResponse(await fetch(`${config.webAppUrl}?action=getRuntimeHealth`, { signal: AbortSignal.timeout(20000) }));
  if (typeof body.success !== 'boolean') return { success: false, error: '旧版部署不支持运行检查' };
  return body;
}

/** Append a retirement wrapper to managed HEAD, preserving manifest and fixed deployments. */
export function retirementSource(source: string, sheetId: string, cutoverId: string): string {
  if (source.includes('PERSONAL_AI_RETIREMENT_V1')) return source;
  const handlers = ['minuteTrigger', 'executeScheduledMessages', 'dailyTrigger', 'dailyCleanup'];
  let patched = source;
  for (const name of handlers) patched = patched.replace(new RegExp(`function\\s+${name}\\s*\\(`, 'g'), `function retiredOriginal_${name}(`);
  const body = `
function personalAiRetire() {
  var handlers = ${JSON.stringify(handlers)};
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (handlers.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  var b = SpreadsheetApp.openById(${JSON.stringify(sheetId)});
  var s = b.getSheetByName('_UpgradeRetirement') || b.insertSheet('_UpgradeRetirement');
  s.getRange(1, 1, 2, 2).setValues([['Cutover_ID','Retired_At'], [${JSON.stringify(cutoverId)}, new Date().toISOString()]]);
}
`;
  return `${patched}\n// PERSONAL_AI_RETIREMENT_V1\n${body}\n${handlers.map(name => `function ${name}() { personalAiRetire(); }`).join('\n')}`;
}

export class ScheduledMessagesUpgrade {
  constructor(private token: string, public draft: UpgradeDraft) {}

  async save(patch: Partial<UpgradeDraft> = {}): Promise<void> {
    this.draft = { ...this.draft, ...patch };
    await chrome.storage.local.set({ [UPGRADE_DRAFT_KEY]: this.draft });
  }

  private async api(url: string, body?: unknown, method = 'POST'): Promise<any> {
    return jsonResponse(await fetch(url, {
      method: body === undefined ? 'GET' : method,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    }));
  }

  async readRows(sheetId: string, range = 'Messages'): Promise<string[][]> {
    const result = await this.api(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
    return result.values || [];
  }

  async create(): Promise<void> {
    const initializer = new SheetInitializer(this.token);
    const candidate = await initializer.prepareUpgradeCandidate(this.draft.candidate, this.draft.token, async candidate => {
      await this.save({ candidate });
    }, this.draft.id);
    await this.save({ candidate });
  }

  async reconcileCreation(resourceId: string): Promise<void> {
    const pending = this.draft.candidate.pendingCreation;
    if (!pending || !/^[A-Za-z0-9_-]+$/.test(resourceId)) throw new Error('请输入待恢复的资源 ID');
    const metadata = await this.api(pending === 'spreadsheet'
      ? `https://sheets.googleapis.com/v4/spreadsheets/${resourceId}?fields=spreadsheetId,spreadsheetUrl,properties,sheets.properties`
      : `https://script.googleapis.com/v1/projects/${resourceId}`);
    const title = pending === 'spreadsheet' ? metadata.properties?.title : metadata.title;
    if (!title?.includes(`[Upgrade ${this.draft.id}]`)) throw new Error('资源名称不匹配本次升级，拒绝覆盖');
    if (pending === 'script' && metadata.parentId !== this.draft.candidate.sheetId) throw new Error('项目未绑定候选新表，拒绝覆盖');
    await this.save({ candidate: { ...this.draft.candidate, pendingCreation: undefined,
      ...(pending === 'spreadsheet' ? { sheetId: resourceId, sheetUrl: metadata.spreadsheetUrl } : { scriptId: resourceId }) } });
  }

  async prepare(): Promise<void> {
    const health = await this.fresh('prepare');
    if (!health.success || health.spreadsheetId !== this.draft.candidate.sheetId || health.mode !== 'paused') throw new Error('候选表未进入待接管状态');
    await this.save({ stage: 'import' });
  }

  private async fresh(operation: 'prepare' | 'activate' | 'pause'): Promise<RuntimeHealth> {
    const result = await jsonResponse(await fetch(this.draft.candidate.webAppUrl!, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'freshSetup', operation, token: this.draft.token }),
      signal: AbortSignal.timeout(45000),
    }));
    if (!result.success) {
      // Apps Script's doPost catch-all returns {status:'ERROR', message}; read
      // it so the operator sees the server-side reason instead of a fallback.
      throw new Error(result.error || result.message || '新表准备失败');
    }
    return result;
  }

  async importFromSource(): Promise<void> {
    const rows = quarantineImportedRows(await this.readRows(this.draft.source.sheetId));
    const health = await probeRuntime(this.draft.candidate as SheetConfig);
    if (health.mode !== 'paused' || health.spreadsheetId !== this.draft.candidate.sheetId) throw new Error('只能导入待接管的新表');
    const metadata = await this.api(`https://sheets.googleapis.com/v4/spreadsheets/${this.draft.candidate.sheetId}?fields=sheets.properties`);
    const id = metadata.sheets.find((s: { properties: { title: string; sheetId: number } }) => s.properties.title === 'Messages')?.properties.sheetId;
    if (id == null) throw new Error('新表缺少 Messages');
    // One atomic batch clears obsolete cells and imports literal values (never formulas).
    await this.api(`https://sheets.googleapis.com/v4/spreadsheets/${this.draft.candidate.sheetId}:batchUpdate`, {
      requests: [{ updateSheetProperties: { properties: { sheetId: id, gridProperties: {
        rowCount: Math.max(rows.length + 10, 1000), columnCount: Math.max(...rows.map(r => r.length), 50),
      } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } }, {
        updateCells: { range: { sheetId: id }, fields: 'userEnteredValue', rows: rows.map(row => ({
          values: row.map(value => ({ userEnteredValue: { stringValue: value } })),
        })) },
      }],
    });
    await this.save({ imported: true, autoImported: true });
  }

  async inspect() {
    const preview = inspectUpgradeRows(await this.readRows(this.draft.candidate.sheetId!));
    if (preview.errors.length) throw new Error(preview.errors.join('；'));
    const status = preview.rows[0].indexOf('Status');
    const id = preview.rows[0].indexOf('ID');
    const unpaused = preview.rows.slice(1).filter(row => preview.pending.includes(row[id]) && row[status] !== 'Paused');
    if (unpaused.length) throw new Error('待确认消息必须在新表设为 Paused，再重新检查');
    await this.save({ stage: 'switch', imported: true });
    return preview;
  }

  /** Explicit operator decision, never an inferred delivery or an automatic replay. */
  async resolvePending(id: string, decision: 'sent' | 'resend'): Promise<void> {
    if (this.draft.stage !== 'complete') throw new Error('切换完成后才能处理隔离任务');
    if (this.draft.resolvedPending?.[id]) return;
    const rows = await this.readRows(this.draft.candidate.sheetId!);
    const errors = inspectUpgradeRows(rows).errors;
    if (errors.length) throw new Error(errors.join('；'));
    const headers = rows[0];
    const index = rows.findIndex((row, i) => i > 0 && row[headers.indexOf('ID')] === id);
    if (index < 0) throw new Error('消息不存在');
    const row = [...rows[index]];
    const get = (name: string) => row[headers.indexOf(name)] || '';
    const set = (name: string, value: string) => { const col = headers.indexOf(name); if (col >= 0) row[col] = value; };
    if (decision === 'sent' && get('Exec_Log') === `✅ 人工核对旧表已发出 [${this.draft.id}]`) {
      await this.save({ resolvedPending: { ...this.draft.resolvedPending, [id]: '已人工确认发出' } });
      return;
    }
    if (get('Status') !== 'Paused' || !/⏳|UNKNOWN|待确认|trigger_delivery_failed/i.test(get('Exec_Log'))) throw new Error('消息状态已改变，请刷新后核对');
    const now = new Date();
    let append = false;
    const replayId = `${id}_upgrade_${this.draft.id}`;
    if (decision === 'resend') {
      if (rows.some(r => r[headers.indexOf('ID')] === replayId)) {
        await this.save({ resolvedPending: { ...this.draft.resolvedPending, [id]: '已创建补发任务' } });
        return;
      }
      set('ID', replayId); set('Topic', `${get('Topic')}（人工补发）`);
      set('Schedule_Date', formatLocalScheduleDate(now)); set('Schedule_Time', formatLocalScheduleTime(now));
      for (const name of ['End_Date', 'Repeat_Every', 'Repeat_Unit', 'Repeat_Count', 'Repeat_Days', 'Timeline_Project', 'Timeline_Milestone', 'Timeline_Offset', 'Last_Exec', 'Next_Exec']) set(name, '');
      set('Exec_Count', '0'); set('Exec_Log', '待执行（人工选择补发）'); set('Status', 'Active');
      append = true;
    } else {
      const source = await this.readRows(this.draft.source.sheetId);
      const old = source.slice(1).find(r => r[source[0].indexOf('ID')] === id);
      const oldCount = Number(old?.[source[0].indexOf('Exec_Count')] || 0);
      if (!Number.isFinite(oldCount) || oldCount < 0) throw new Error('旧表执行次数异常，请先核对');
      set('Exec_Count', String(Math.max(oldCount, Number(get('Exec_Count')) + 1)));
      set('Last_Exec', `${formatLocalScheduleDate(now)} ${formatLocalScheduleTime(now)}`);
      set('Exec_Log', `✅ 人工核对旧表已发出 [${this.draft.id}]`);
      set('Status', get('Repeat_Every') && get('Repeat_Unit') || get('Timeline_Milestone') ? 'Active' : 'Done');
      set('Next_Exec', '');
    }
    const metadata = await this.api(`https://sheets.googleapis.com/v4/spreadsheets/${this.draft.candidate.sheetId}?fields=sheets.properties`);
    const sheetId = metadata.sheets.find((s: any) => s.properties.title === 'Messages')?.properties.sheetId;
    if (sheetId == null) throw new Error('Messages 工作表不存在');
    const cells = { values: row.map(value => ({ userEnteredValue: { stringValue: String(value ?? '') } })) };
    await this.api(`https://sheets.googleapis.com/v4/spreadsheets/${this.draft.candidate.sheetId}:batchUpdate`, { requests: [append
      ? { appendCells: { sheetId, rows: [cells], fields: 'userEnteredValue' } }
      : { updateCells: { start: { sheetId, rowIndex: index, columnIndex: 0 }, rows: [cells], fields: 'userEnteredValue' } }],
    });
    await this.save({ resolvedPending: { ...this.draft.resolvedPending, [id]: decision === 'sent' ? '已人工确认发出' : '已创建补发任务（原行保持暂停）' } });
  }

  async retire(): Promise<boolean> {
    if (this.draft.manualRetired) { await this.save({ retired: true }); return true; }
    const scriptId = this.draft.source.scriptId;
    if (!scriptId) throw new Error('旧配置缺少 scriptId，请按页面说明手动停用触发器');
    if (!this.draft.retirementWritten) {
      const content = await this.api(`https://script.googleapis.com/v1/projects/${scriptId}/content`);
      if (!content.files?.some((f: { source: string }) => /APP_SCRIPT_VERSION|Personal AI.*定时消息|executeScheduledMessages/.test(f.source))) throw new Error('无法识别旧项目，请手动停用触发器');
      const originals: NonNullable<UpgradeDraft['originalFiles']> = this.draft.originalFiles || content.files;
      await this.save({ originalFiles: originals });
      const files = originals.map(f => ({ ...f }));
      // Rename entry points across all source files; append wrappers exactly once.
      let combined = files.filter(f => f.type === 'SERVER_JS').map(f => f.source).join('\n');
      combined = retirementSource(combined, this.draft.source.sheetId, this.draft.id);
      await this.api(`https://script.googleapis.com/v1/projects/${scriptId}/content`, {
        files: [...files.filter(f => f.type !== 'SERVER_JS'), { name: 'Code', type: 'SERVER_JS', source: combined }],
      }, 'PUT');
      await this.save({ retirementWritten: true });
    }
    // A missing tab is expected until the next trigger; never infer retirement from silence.
    try {
      const rows = await this.readRows(this.draft.source.sheetId, "'_UpgradeRetirement'!A1:B2");
      if (rows[1]?.[0] !== this.draft.id || !rows[1]?.[1]) return false;
    } catch { return false; }
    await this.save({ retired: true });
    return true;
  }

  async cutover(): Promise<void> {
    if (!this.draft.retired) throw new Error('先核验旧触发器已停用');
    // Lease spans tabs and is released by the browser on crash. Persisted draft handles retries.
    await navigator.locks.request('scheduled-messages-upgrade', { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('另一个窗口正在切换，请稍后重试');
      try {
        await this.performCutover();
      } catch (error) {
        const failures: string[] = [];
        try { await this.fresh('pause'); } catch { failures.push('新表暂停未确认'); }
        const jira = new JiraAutomationService();
        for (const { config } of this.draft.rules || []) {
          try {
            await jira.updateRule(config, config.ruleId, { state: 'DISABLED' });
            if ((await jira.getRuleById(config, config.ruleId))?.state !== 'DISABLED') throw new Error();
          } catch { failures.push(`规则 ${config.ruleId} 暂停未确认`); }
        }
        throw new Error(`${error.message}。已尝试暂停新表及 Jira；${failures.length ? failures.join('；') + '，请立即核对远端状态' : '暂停已确认，可从本步骤继续'}`);
      }
    });
  }

  private async performCutover(): Promise<void> {
    const source = normalizeSheetConfig(this.draft.source);
    const candidate = this.draft.candidate;
    if (!candidate.sheetId || !candidate.webAppUrl || !source.webAppUrl) throw new Error('缺少部署配置');
    const jira = new JiraAutomationService();
    if (!this.draft.rules) {
      const configs = [source.botAutomation?.executorRule, source.botAutomation?.timelineSyncRule].filter(Boolean) as BotAutomationRule[];
      const rules: NonNullable<UpgradeDraft['rules']> = [];
      if (!configs.length) throw new Error('未绑定 Jira 执行规则，请先核实原规则配置');
      for (const config of configs) {
        const original = await jira.getRuleById(config, config.ruleId);
        if (!original || !ruleContainsUrl(original, source.webAppUrl)) throw new Error('Jira 原规则不存在或未指向旧表，请核对配置');
        if (!['ENABLED', 'DISABLED'].includes(original.state)) throw new Error('无法识别 Jira 规则状态');
        rules.push({ config, original });
      }
      // Back up every rule before the first remote mutation.
      await this.save({ rules });
    }
    const expectedRule = (original: JiraRule, state: string) => ({
      ...replaceRuleUrl(original, source.webAppUrl!, candidate.webAppUrl!), state,
    });
    const verifyRule = async (config: BotAutomationRule, expected: JiraRule) => {
      const read = await jira.getRuleById(config, config.ruleId);
      if (!read || read.state !== expected.state ||
          JSON.stringify(read.trigger) !== JSON.stringify(expected.trigger) ||
          JSON.stringify(read.components) !== JSON.stringify(expected.components)) throw new Error('Jira 规则回读不一致，保持暂停并重试切换');
    };
    // First pause every rule; never leave a new URL enabled during partial cutover.
    for (const { config } of this.draft.rules!) {
      await jira.updateRule(config, config.ruleId, { state: 'DISABLED' });
      const read = await jira.getRuleById(config, config.ruleId);
      if (read?.state !== 'DISABLED') throw new Error('Jira 停领未确认');
    }
    // Refresh source after stopping new polling. Pending copied rows remain quarantined.
    // Automatic imports are refreshed; manual edits must be rechecked by the user.
    if (this.draft.autoImported && !this.draft.cutoverAt) await this.importFromSource();
    await this.inspect();
    for (const { config, original } of this.draft.rules!) {
      const expected = expectedRule(original, 'DISABLED');
      await jira.updateRule(config, config.ruleId, expected);
      await verifyRule(config, expected);
    }
    const version = await AppScriptUpdater.getLatestVersionInfo();
    const next: SheetConfig = { ...source, sheetId: candidate.sheetId,
      messagesSheetId: candidate.messagesSheetId, logsSheetId: candidate.logsSheetId, deploymentId: candidate.deploymentId,
      sheetUrl: candidate.sheetUrl!, scriptId: candidate.scriptId, webAppUrl: candidate.webAppUrl,
      appScriptVersion: version.version, appScriptLastUpdated: version.lastUpdated,
      minute_trigger_id: undefined, daily_trigger_id: undefined,
      last_sync_time: undefined, created_at: new Date().toISOString() };
    // Persist target Config before activation, but keep the local active config untouched.
    const sync = new ConfigSyncService(this.token);
    if (!this.draft.cutoverAt) {
      await sync.saveConfigToSheet(next, new Date().toISOString(), { syncAction: 'new_sheet_upgrade' });
      await this.save({ cutoverAt: new Date().toISOString() });
    }
    const health = await this.fresh('activate');
    if (!compatibleRuntime(health, candidate.sheetId)) throw new Error('新表未就绪，Jira 保持暂停');
    for (const { config, original } of this.draft.rules!) {
      const expected = expectedRule(original, original.state);
      await jira.updateRule(config, config.ruleId, expected);
      await verifyRule(config, expected);
    }
    await sync.saveConfigToStorage(next);
    await this.save({ stage: 'complete', error: undefined });
  }
}
