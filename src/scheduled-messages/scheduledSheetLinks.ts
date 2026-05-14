import type { SheetConfig } from './types';

export type ScheduledMessagesSheetTab = 'messages' | 'logs';

function getSheetBaseUrl(sheetUrl: string): string {
  const withoutHash = sheetUrl.split('#')[0];
  const editIndex = withoutHash.indexOf('/edit');

  if (editIndex >= 0) {
    return `${withoutHash.slice(0, editIndex)}/edit`;
  }

  return withoutHash;
}

export function getScheduledMessagesSheetTabId(
  config: Pick<SheetConfig, 'messagesSheetId' | 'logsSheetId'>,
  tab: ScheduledMessagesSheetTab,
): number | undefined {
  return tab === 'messages' ? config.messagesSheetId : config.logsSheetId;
}

export function buildScheduledMessagesSheetTabUrl(
  config: Pick<SheetConfig, 'sheetUrl' | 'messagesSheetId' | 'logsSheetId'>,
  tab: ScheduledMessagesSheetTab,
): string {
  const baseUrl = getSheetBaseUrl(config.sheetUrl);
  const sheetId = getScheduledMessagesSheetTabId(config, tab);

  if (sheetId === undefined || sheetId === null) {
    return baseUrl;
  }

  return `${baseUrl}#gid=${sheetId}`;
}
