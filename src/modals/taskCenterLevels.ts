import {
  hasExecutorRule,
  hasRingCentralSenderCredentials,
  hasTimelineSyncRule,
} from '../scheduled-messages/botAutomationConfig';
import type { SheetConfig } from '../scheduled-messages/types';

export interface TaskCenterRuntimeProbe {
  botId?: string;
  botTokenConfigured?: boolean;
  ringCentralClientId?: string;
  ringCentralJwtConfigured?: boolean;
}

export interface TaskCenterLevelProbe {
  /** Same bar the scheduled-messages page uses: a Sheet id means L2 exists. */
  cloudLaneAvailable: boolean;
  sheetId: string;
  webAppUrl: string;
  cloudBotConfigured: boolean;
  cloudTimelineConfigured: boolean;
  cloudAsmeConfigured: boolean;
  /** Home-lane Glip Bot (SM AI in memory-service / Options). */
  botConfigured: boolean;
  /** Home-lane AsMe (RingCentral JWT in runtime config). */
  asmeConfigured: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Read Level 1 / Level 2 from the extension's local cache plus memory-service
 * runtime config. Does not copy secrets to the server — Google tokens and
 * Jira rule payloads stay in chrome.storage / the Sheet.
 */
export function probeTaskCenterLevels(input: {
  scheduledMessagesConfig?: unknown;
  botConfig?: unknown;
  runtime?: TaskCenterRuntimeProbe | null;
}): TaskCenterLevelProbe {
  const config = asRecord(input.scheduledMessagesConfig) as Partial<SheetConfig> & {
    spreadsheetId?: string;
    botId?: string;
  };
  const localBot = asRecord(input.botConfig);
  const runtime = input.runtime ?? {};

  const sheetId = nonEmpty(config.sheetId) || nonEmpty(config.spreadsheetId);
  const webAppUrl = nonEmpty(config.webAppUrl);

  return {
    cloudLaneAvailable: Boolean(sheetId),
    sheetId,
    webAppUrl,
    cloudBotConfigured: hasExecutorRule(config),
    cloudTimelineConfigured: hasTimelineSyncRule(config),
    cloudAsmeConfigured: hasRingCentralSenderCredentials(config),
    botConfigured: Boolean(
      (runtime.botTokenConfigured && nonEmpty(runtime.botId)) ||
        nonEmpty(localBot.botId) ||
        nonEmpty(config.botId),
    ),
    asmeConfigured: Boolean(
      runtime.ringCentralJwtConfigured && nonEmpty(runtime.ringCentralClientId),
    ),
  };
}
