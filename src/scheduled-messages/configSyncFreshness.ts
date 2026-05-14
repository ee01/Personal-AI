import type { SheetConfig } from './types';

export type ConfigSyncFreshness = 'local-newer' | 'sheet-newer' | 'same' | 'unknown';

export function parseConfigSyncTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function compareConfigSyncFreshness(
  localConfig?: Partial<SheetConfig> | null,
  sheetConfig?: Partial<SheetConfig> | null
): ConfigSyncFreshness {
  if (!localConfig?.sheetId || !sheetConfig?.sheetId || localConfig.sheetId !== sheetConfig.sheetId) {
    return 'unknown';
  }

  const localTimestamp = parseConfigSyncTimestamp(localConfig.last_sync_time);
  const sheetTimestamp = parseConfigSyncTimestamp(sheetConfig.last_sync_time);

  if (localTimestamp === null && sheetTimestamp === null) {
    return 'unknown';
  }
  if (localTimestamp !== null && sheetTimestamp === null) {
    return 'local-newer';
  }
  if (localTimestamp === null && sheetTimestamp !== null) {
    return 'sheet-newer';
  }
  if (localTimestamp! > sheetTimestamp!) {
    return 'local-newer';
  }
  if (sheetTimestamp! > localTimestamp!) {
    return 'sheet-newer';
  }

  return 'same';
}

export function formatConfigSyncTimestamp(value?: string): string {
  const timestamp = parseConfigSyncTimestamp(value);
  if (timestamp === null) {
    return '未知';
  }

  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
  });
}
