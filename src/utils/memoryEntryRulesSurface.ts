/**
 * Shared surface contract for the Memory Entry Rules page.
 *
 * The same rules surface is reached two ways:
 * - `hub`: the user browses in from the Memory Explorer sidebar to manage all rules.
 * - `task`: the user configures one specific message from the RingCentral message
 *   toolbar (Watch / Reply / Openclaw).
 *
 * Task entries must not expose the explorer sidebar or the list-management
 * toolbar. Navigating away unmounts the prefilled form, and the pending config is
 * already consumed from `chrome.storage.local`, so the draft cannot be recovered
 * without going back to the original message.
 */

export type MemoryEntryRulesSurface = 'hub' | 'task';

export type MemoryEntryRulesIntent =
  | 'follow-thread'
  | 'auto-reply'
  | 'linked-action'
  | 'manual';

export const MEMORY_ENTRY_RULES_TASK_DONE_MESSAGE =
  'personal-ai:memory-entry-rules-task-done';

export type MemoryEntryRulesTaskDoneReason = 'saved' | 'cancelled';

export type MemoryEntryRulesTaskDoneMessage = {
  type: typeof MEMORY_ENTRY_RULES_TASK_DONE_MESSAGE;
  reason: MemoryEntryRulesTaskDoneReason;
};

export type MemoryEntryRulesIntentCopy = {
  eyebrow: string;
  title: string;
  summary: string;
  formTitle: string;
  formHint: string;
};

const INTENT_COPY: Record<MemoryEntryRulesIntent, MemoryEntryRulesIntentCopy> = {
  'follow-thread': {
    eyebrow: '记忆入口规则 · 关注后续',
    title: '为这条消息配置关注后续',
    summary:
      '只有保存后才会创建本地关注规则并索引原消息。现在关闭不会开始关注、不会发送通知，也不会回扫历史消息。',
    formTitle: '关注后续配置',
    formHint: '命中后默认写入记忆，下面是这条关注规则的匹配范围和通知口径。',
  },
  'auto-reply': {
    eyebrow: '记忆入口规则 · 自动答复',
    title: '为这条消息配置自动答复',
    summary:
      '只有保存后才会创建本地规则。现在关闭不会发送任何消息，也不会把草稿加入答复队列。',
    formTitle: '自动答复配置',
    formHint: '命中后默认写入记忆，下面是答复文本、审核模式和匹配范围。',
  },
  'linked-action': {
    eyebrow: '记忆入口规则 · 联动操作',
    title: '为这条消息配置联动操作',
    summary:
      '只有保存后才会创建本地规则。现在关闭不会创建 RuntimeAction，也不会调用 OpenClaw 执行任何动作。',
    formTitle: '联动操作配置',
    formHint: '命中后默认写入记忆，下面是动作描述、批准口径和匹配范围。',
  },
  manual: {
    eyebrow: 'Manual memory rules',
    title: '记忆入口规则',
    summary: '配置你希望系统持续观察并写入记忆的消息模式。',
    formTitle: '新建记忆入口规则',
    formHint: '命中后默认写入记忆，下面勾选的是可叠加的用户动作。',
  },
};

export function parseMemoryEntryRulesSurface(
  raw: unknown,
): MemoryEntryRulesSurface {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'task' ? 'task' : 'hub';
}

export function parseMemoryEntryRulesIntent(
  raw: unknown,
): MemoryEntryRulesIntent {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === 'follow-thread' ||
    value === 'auto-reply' ||
    value === 'linked-action'
  ) {
    return value;
  }
  return 'manual';
}

export function getMemoryEntryRulesIntentCopy(
  intent: MemoryEntryRulesIntent,
): MemoryEntryRulesIntentCopy {
  return INTENT_COPY[intent];
}

export function readMemoryEntryRulesSurfaceParams(search: string): {
  surface: MemoryEntryRulesSurface;
  intent: MemoryEntryRulesIntent;
} {
  const params = new URLSearchParams(search);
  return {
    surface: parseMemoryEntryRulesSurface(params.get('surface')),
    intent: parseMemoryEntryRulesIntent(params.get('intent')),
  };
}

export function buildMemoryEntryRulesTaskDoneMessage(
  reason: MemoryEntryRulesTaskDoneReason,
): MemoryEntryRulesTaskDoneMessage {
  return { type: MEMORY_ENTRY_RULES_TASK_DONE_MESSAGE, reason };
}

export function isMemoryEntryRulesTaskDoneMessage(
  data: unknown,
): data is MemoryEntryRulesTaskDoneMessage {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as { type?: unknown; reason?: unknown };
  return (
    candidate.type === MEMORY_ENTRY_RULES_TASK_DONE_MESSAGE &&
    (candidate.reason === 'saved' || candidate.reason === 'cancelled')
  );
}
