import {
  getRingCentralSenderConfig,
  hasRingCentralSenderCredentials,
} from '../scheduled-messages/botAutomationConfig';
import type { RingCentralSenderConfig, SheetConfig } from '../scheduled-messages/types';
import type {
  RuntimeConfigResponse,
  UpdateRuntimeConfigPayload,
} from '../services/MemoryServiceClient';
import type { TaskCenterRuntimeProbe } from './taskCenterLevels';

export type RingCentralAdoptDecision =
  | { adopt: false; reason: 'already_configured' | 'sheet_empty' | 'incomplete' }
  | { adopt: true; payload: UpdateRuntimeConfigPayload };

/**
 * One-time import of Sheet AsMe sender into memory-service runtime config.
 * Only when the server has no JWT yet — never overwrite a newer Options value.
 */
export function decideRingCentralAdoptFromSheet(input: {
  runtime?: TaskCenterRuntimeProbe | null;
  scheduledMessagesConfig?: Partial<SheetConfig> | null;
  ringCentralServerUrl?: string;
}): RingCentralAdoptDecision {
  if (input.runtime?.ringCentralJwtConfigured) {
    return { adopt: false, reason: 'already_configured' };
  }
  const sender = getRingCentralSenderConfig(input.scheduledMessagesConfig);
  if (!hasRingCentralSenderCredentials(input.scheduledMessagesConfig)) {
    return { adopt: false, reason: sender ? 'incomplete' : 'sheet_empty' };
  }
  const complete = sender as RingCentralSenderConfig;
  const payload: UpdateRuntimeConfigPayload = {
    ringCentralClientId: complete.clientId?.trim(),
    ringCentralClientSecret: complete.clientSecret?.trim(),
    ringCentralJwt: complete.jwt?.trim(),
  };
  const serverUrl = input.ringCentralServerUrl?.trim();
  if (serverUrl) {
    payload.ringCentralServerUrl = serverUrl;
  }
  if (!payload.ringCentralClientId || !payload.ringCentralClientSecret || !payload.ringCentralJwt) {
    return { adopt: false, reason: 'incomplete' };
  }
  return { adopt: true, payload };
}

export function hydrateL1BotDraft(runtime: RuntimeConfigResponse | null | undefined) {
  return {
    botApiBaseUrl:
      runtime?.botApiBaseUrl?.trim() || 'https://botman.int.rclabenv.com/v2',
    botId: runtime?.botId?.trim() || '',
    botToken: '',
    botTokenConfigured: Boolean(runtime?.botTokenConfigured),
  };
}

export function hydrateL1AsmeDraft(runtime: RuntimeConfigResponse | null | undefined) {
  return {
    ringCentralServerUrl:
      runtime?.ringCentralServerUrl?.trim() || 'https://platform.ringcentral.com',
    ringCentralClientId: runtime?.ringCentralClientId?.trim() || '',
    ringCentralClientSecret: '',
    ringCentralJwt: '',
    clientSecretConfigured: Boolean(runtime?.ringCentralClientSecretConfigured),
    jwtConfigured: Boolean(runtime?.ringCentralJwtConfigured),
  };
}

export function buildL1BotSavePayload(draft: {
  botApiBaseUrl: string;
  botId: string;
  botToken: string;
  botTokenConfigured: boolean;
}): UpdateRuntimeConfigPayload {
  const payload: UpdateRuntimeConfigPayload = {
    botApiBaseUrl: draft.botApiBaseUrl.trim(),
    botId: draft.botId.trim(),
  };
  const token = draft.botToken.trim();
  if (token) {
    payload.botToken = token;
  }
  return payload;
}

export function buildL1AsmeSavePayload(draft: {
  ringCentralServerUrl: string;
  ringCentralClientId: string;
  ringCentralClientSecret: string;
  ringCentralJwt: string;
}): UpdateRuntimeConfigPayload {
  const payload: UpdateRuntimeConfigPayload = {
    ringCentralServerUrl: draft.ringCentralServerUrl.trim(),
    ringCentralClientId: draft.ringCentralClientId.trim(),
  };
  const secret = draft.ringCentralClientSecret.trim();
  const jwt = draft.ringCentralJwt.trim();
  if (secret) payload.ringCentralClientSecret = secret;
  if (jwt) payload.ringCentralJwt = jwt;
  return payload;
}

export type AsmeSheetMerge =
  | { kind: 'skip'; reason: 'no_sheet' | 'incomplete' }
  | { kind: 'ready'; config: SheetConfig };

export function mergeAsmePayloadIntoSheetConfig(
  config: Partial<SheetConfig> | null | undefined,
  payload: UpdateRuntimeConfigPayload,
): AsmeSheetMerge {
  const sheetId = config?.sheetId?.trim();
  if (!sheetId) return { kind: 'skip', reason: 'no_sheet' };
  const existing = config.ringCentralSender;
  const clientId = payload.ringCentralClientId?.trim() || existing?.clientId?.trim() || '';
  const clientSecret =
    payload.ringCentralClientSecret?.trim() || existing?.clientSecret?.trim() || '';
  const jwt = payload.ringCentralJwt?.trim() || existing?.jwt?.trim() || '';
  if (!clientId || !clientSecret || !jwt) {
    return { kind: 'skip', reason: 'incomplete' };
  }
  return {
    kind: 'ready',
    config: {
      ...(config as SheetConfig),
      sheetId,
      ringCentralSender: {
        enabled: true,
        clientId,
        clientSecret,
        jwt,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export type AsmeSheetPushResult = {
  pushed: boolean;
  reason?: 'no_sheet' | 'incomplete' | 'write_failed' | 'ok';
  error?: string;
};

export function asmePushReceipt(result: AsmeSheetPushResult): string {
  if (result.pushed) {
    return 'Sheet Config 已更新。☁️ AsMe 仍用 Jira 规则快照，当前域策略无法重新部署规则';
  }
  if (result.reason === 'no_sheet') return '未找到 L2 Sheet，只写了 memory-service';
  if (result.reason === 'incomplete') {
    return 'Sheet 未写：缺少完整 Client Secret / JWT';
  }
  if (result.error) return `Sheet 未更新：${result.error}`;
  return 'Sheet 未更新';
}
