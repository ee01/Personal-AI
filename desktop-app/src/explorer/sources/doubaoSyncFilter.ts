/**
 * Filters out messages that the desktop app itself pushed into Doubao
 * for memory/briefing/todo/notice synchronization. Without this guard
 * the explorer would happily ingest its own outbound transcripts back
 * into Memory Service, leading to a noisy feedback loop.
 *
 * Detection is keyed on the deterministic Chinese prefixes produced by
 * `bridgeService.render*` and `memoFormatter.smartFormat`. Whenever a
 * `user`-role message matches one of these prefixes, both the message
 * and the assistant turn that immediately follows it are dropped (the
 * assistant turn is just an acknowledgement of the sync push and has
 * no original information value).
 *
 * Detection is also keyed on conversation-level binding metadata: any
 * conversation whose id matches a known sync thread binding is dropped
 * entirely, regardless of message contents.
 */

import type { RawMessageRecord } from '../types.js';

/**
 * Prefixes / patterns that uniquely identify a Personal AI sync message.
 *
 * Keep in sync with:
 * - `bridgeService.MEMORY_SYNC_SEED_MESSAGE`
 * - `bridgeService.renderStableMemory`
 * - `bridgeService.renderBriefing`
 * - `bridgeService.renderReminders`
 * - `bridgeService.renderNotices`
 * - `bridgeService.renderQuery`
 * - `memoFormatter.smartFormat` (stable/reminder/default branches)
 * - `memoFormatter.formatCompactMemoList` (briefing branch)
 * - `memoFormatter.formatMemoBatch` titles
 */
const SYNC_USER_MESSAGE_PATTERNS: RegExp[] = [
  /^建立长期记忆同步线程/,
  /^请把以下(?:来自 Personal AI \(私人 AI\) 的)?长期稳定信息存入随手记/,
  /^请把以下(?:来自 Personal AI \(私人 AI\) 的)?近期记忆重点记录到随手记/,
  /^请把以下(?:来自 Personal AI \(私人 AI\) 的)?近期重点记录到随手记/,
  /^请把以下(?:来自 Personal AI \(私人 AI\) 的)?(?:长期记忆)?信息存入随手记/,
  /^请把以下(?:来自 Personal AI \(私人 AI\) 的)?内容存入随手记/,
  /^请(?:在随手记中记录以下待办事项|把以下来自 Personal AI \(私人 AI\) 的待办事项记录到随手记)/,
  /^下面是一些(?:来自 Personal AI \(私人 AI\) 的)?通知推送/,
  /^问题：[\s\S]+(?:服务端检索结论|Personal AI \(私人 AI\) 检索结论)：/,
  /^📚 长期记忆同步/,
  /^📦 随手记同步/,
  /^📋 随手记概览/,
];

export function isPersonalAiSyncUserMessage(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  return SYNC_USER_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export interface FilterSyncMessagesOptions {
  /**
   * Conversation ids known to be Personal AI sync threads (e.g. the bound
   * `memory_sync` / `mobile_context` thread). Any messages from these
   * conversations are skipped entirely.
   */
  boundConversationIds?: ReadonlySet<string>;
}

export interface FilterSyncMessagesResult {
  kept: RawMessageRecord[];
  /**
   * How many messages were removed by content-based filtering. Useful for
   * status reporting / debug logging.
   */
  filteredCount: number;
  /**
   * True if the entire conversation was dropped because its id matched a
   * known sync-thread binding.
   */
  conversationDropped: boolean;
}

/**
 * Removes any Personal AI sync messages and the assistant ack turns that
 * immediately follow them. Returns the surviving messages in original
 * order, plus stats for observability.
 */
export function filterDoubaoSyncMessages(
  messages: RawMessageRecord[],
  options: FilterSyncMessagesOptions = {},
): FilterSyncMessagesResult {
  const boundIds = options.boundConversationIds;
  const conversationId = messages[0]?.conversationId;
  if (
    boundIds &&
    conversationId &&
    boundIds.has(conversationId) &&
    messages.length > 0
  ) {
    return {
      kept: [],
      filteredCount: messages.length,
      conversationDropped: true,
    };
  }

  const kept: RawMessageRecord[] = [];
  let filteredCount = 0;
  let dropNextAssistant = false;

  for (const message of messages) {
    if (
      message.role === 'user' &&
      isPersonalAiSyncUserMessage(message.content)
    ) {
      filteredCount += 1;
      dropNextAssistant = true;
      continue;
    }

    if (dropNextAssistant && message.role === 'assistant') {
      filteredCount += 1;
      dropNextAssistant = false;
      continue;
    }

    // Any non-assistant turn after a sync push resets the ack expectation.
    dropNextAssistant = false;
    kept.push(message);
  }

  return {
    kept,
    filteredCount,
    conversationDropped: false,
  };
}
