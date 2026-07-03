import type { InitializationResult, SheetConfig } from './types';
import { formatConfigSyncTimestamp } from './configSyncFreshness';

export const SCHEDULED_MESSAGES_SETUP_RECEIPT_KEY = 'scheduledMessagesSetupReceipt';

export type SetupReceiptNoticeTone = 'success' | 'info' | 'warning' | 'error';

export interface ScheduledMessagesSetupReceipt {
  createdAt: string;
  sheetId: string;
  sheetUrl: string;
  scriptId: string;
  webAppUrl: string;
  deploymentId?: string;
  messagesSheetId?: number;
  logsSheetId?: number;
  setupWarnings?: string[];
}

export interface SetupReceiptNotice {
  tone: SetupReceiptNoticeTone;
  title: string;
  description: string;
  details: string[];
}

function compactId(value?: string): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return '未记录';
  }

  if (normalizedValue.length <= 20) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 10)}...${normalizedValue.slice(-6)}`;
}

function dedupeWarnings(warnings?: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const warning of warnings || []) {
    const normalizedWarning = warning.trim();
    if (!normalizedWarning || seen.has(normalizedWarning)) {
      continue;
    }

    seen.add(normalizedWarning);
    result.push(normalizedWarning);
  }

  return result;
}

function formatWorksheetReceipt(
  receipt: ScheduledMessagesSetupReceipt,
  config?: Partial<SheetConfig>,
): string {
  const messagesSheetId = receipt.messagesSheetId ?? config?.messagesSheetId;
  const logsSheetId = receipt.logsSheetId ?? config?.logsSheetId;

  if (messagesSheetId !== undefined && logsSheetId !== undefined) {
    return `Messages ${messagesSheetId} / Logs ${logsSheetId}`;
  }

  if (messagesSheetId !== undefined) {
    return `Messages ${messagesSheetId} / Logs 待同步确认`;
  }

  if (logsSheetId !== undefined) {
    return `Messages 待同步确认 / Logs ${logsSheetId}`;
  }

  return '待同步确认';
}

function formatTriggerReceipt(config?: Partial<SheetConfig>): string {
  const hasMinuteTrigger = Boolean(config?.minute_trigger_id);
  const hasDailyTrigger = Boolean(config?.daily_trigger_id);

  if (hasMinuteTrigger && hasDailyTrigger) {
    return '分钟 / 每日触发器已写入 Config';
  }

  if (hasMinuteTrigger) {
    return '分钟触发器已写入 Config';
  }

  if (hasDailyTrigger) {
    return '每日触发器已写入 Config';
  }

  return '已创建，等待 Config 同步确认';
}

export function buildScheduledMessagesSetupReceipt(
  result: InitializationResult,
  createdAt = new Date().toISOString(),
): ScheduledMessagesSetupReceipt {
  return {
    createdAt,
    sheetId: result.sheetId,
    sheetUrl: result.sheetUrl,
    scriptId: result.scriptId,
    webAppUrl: result.webAppUrl,
    deploymentId: result.deploymentId,
    messagesSheetId: result.messagesSheetId,
    logsSheetId: result.logsSheetId,
    setupWarnings: dedupeWarnings(result.setupWarnings),
  };
}

export function buildScheduledMessagesSetupReceiptNotice(
  receipt: ScheduledMessagesSetupReceipt,
  config?: Partial<SheetConfig>,
): SetupReceiptNotice {
  const warnings = dedupeWarnings(receipt.setupWarnings);
  const sheetId = receipt.sheetId || config?.sheetId || '未知';
  const deploymentId = receipt.deploymentId || config?.deploymentId;
  const scriptId = receipt.scriptId || config?.scriptId;
  const completedAt = receipt.createdAt || config?.last_sync_time;

  return {
    tone: warnings.length > 0 ? 'warning' : 'success',
    title: '定时消息系统已初始化',
    description: warnings.length > 0
      ? '维护表、App Script、触发器、测试消息和 Config 已完成；请按注意事项处理协作共享或权限。'
      : '维护表、App Script、触发器、测试消息和 Config 已完成；一分钟后可检查测试推送。',
    details: [
      `Sheet: ${compactId(sheetId)}`,
      `子表: ${formatWorksheetReceipt(receipt, config)}`,
      `Deployment: ${compactId(deploymentId)}`,
      `Script: ${compactId(scriptId)}`,
      `触发器: ${formatTriggerReceipt(config)}`,
      '边界: 初始化不会立即发送正式消息，测试消息只按触发器计划执行；维护表不会静默开放为 anyone-with-link 可编辑。',
      `完成时间: ${formatConfigSyncTimestamp(completedAt)}`,
      ...warnings.slice(0, 2).map((warning) => `注意: ${warning}`),
    ],
  };
}
