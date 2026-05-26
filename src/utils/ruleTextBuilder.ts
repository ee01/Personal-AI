/**
 * 规则文本构建器
 *
 * 用于根据 TopicItem 的匹配条件生成完整规则文本，
 * 主要用于 LLM prompt 中的规则描述
 */

import { TopicItemWithAutoReply } from '../message-reaction/AutoReplyHandler';
import type { WatchRule } from '../watchRules';

const splitScopeValues = (value?: string): string[] =>
  (value || '')
    .split(/[\n,，、;；]+/)
    .map((part) => part.trim())
    .filter(Boolean);

const formatScopeValuesForPrompt = (
  value: string | undefined,
  singleFormatter: (value: string) => string,
  multiFormatter: (values: string) => string,
): string | undefined => {
  const values = splitScopeValues(value);
  if (values.length === 0) return undefined;
  if (values.length === 1) return singleFormatter(values[0]);
  return multiFormatter(values.join(' 或 '));
};

/**
 * 根据 TopicItem 的匹配条件生成完整规则文本
 *
 * @param item TopicItem 对象
 * @param includeId 是否包含规则 ID 前缀（用于 LLM 精确匹配）
 * @param ruleIndex 规则索引（从 0 开始）
 * @returns 完整的规则文本描述
 *
 * @example
 * // 普通规则
 * buildRuleText({ text: '关于项目进度的讨论', filterSender: 'John' })
 * // => "John 发送的 关于项目进度的讨论"
 *
 * @example
 * // 关注后续规则
 * buildRuleText({
 *   text: '关注后续讨论：原消息 "过年什么时候放假？"',
 *   followThread: true,
 *   followConfig: { originalMessage: {...} }
 * })
 * // => "关注后续讨论：原消息 "过年什么时候放假？"。【匹配细节】..."
 */
export function buildRuleText(
  item: TopicItemWithAutoReply | WatchRule,
  includeId = false,
  ruleIndex?: number,
  ruleRef?: string,
): string {
  if ('source' in item) {
    if (item.source === 'outreach') {
      let prefix = '';
      if (ruleRef) {
        prefix += `[RULE_REF:${ruleRef}] `;
      }
      return `${prefix}${item.text}`.trim();
    }

    return buildRuleText(
      item.manualItem,
      includeId,
      ruleIndex,
      ruleRef || item.ruleRef,
    );
  }

  // 🔧 通用前缀构建函数：处理 filterSender 和 filterGroup
  const buildPrefix = (): string => {
    const prefixParts: string[] = [];
    const senderScope = formatScopeValuesForPrompt(
      item.filterSender,
      (value) => value,
      (values) => `任一发送人（${values}）`,
    );
    const groupScope = formatScopeValuesForPrompt(
      item.filterGroup,
      (value) => `在 ${value} 中`,
      (values) => `在任一群组（${values}）中`,
    );
    if (senderScope) prefixParts.push(senderScope);
    if (groupScope) prefixParts.push(groupScope);
    if (item.filterSender) {
      prefixParts.push(`发送的`);
    }
    return prefixParts.join(' ');
  };

  let ruleText = '';

  // 🆕 关注后续类型：使用预先生成的主体文本 + 补充匹配细节
  if (item.followThread && item.followConfig) {
    const config = item.followConfig;
    const original = config.originalMessage;
    const originalDatetime = new Date(original.datetime).toLocaleString(
      'zh-CN',
    );

    // 1️⃣ 添加通用前缀（如果有 filterSender 或 filterGroup）
    const prefix = buildPrefix();
    if (prefix) {
      ruleText = prefix + ' ';
    }

    // 2️⃣ 使用 item.text 作为主体（已在创建时预先生成）
    // 例如："关注后续讨论：原消息 \"过年什么时候放假？\""
    ruleText += item.text || `关于以下内容的后续讨论："${original.content}"`;

    // 3️⃣ 补充匹配细节和技术说明
    ruleText += `。【匹配细节】在 ${original.teamName} 群组中，`;
    ruleText += `检测所有与 post_id="${original.postId}" 相关的后续讨论。`;
    ruleText += `原消息由 "${original.sender}" 在 ${originalDatetime} 发送。`;
    ruleText += `匹配条件（满足任一）：`;
    ruleText += `(1) reply_to 属性指向 "${original.postId}" 的直接回复；`;
    ruleText += `(2) 在同一 <thread> 中且时间在原消息之后的消息；`;
    ruleText += `(3) 虽然不在同一 thread，但语义上是在讨论或回应原消息内容的消息；`;
    ruleText += `(4) @提及原消息发送者 "${original.sender}" 且内容与原话题相关的消息。`;
    ruleText += `【注意】排除原消息本身（post_id="${original.postId}"），只识别后续的讨论消息。`;
  }
  // 📋 普通规则类型：使用通用前缀 + 规则文本
  else {
    const prefix = buildPrefix();
    const mainText = item.text || '';

    if (prefix && mainText) {
      ruleText = `${prefix} ${mainText}`;
    } else {
      ruleText = prefix || mainText;
    }
  }

  // 如果需要包含 ID 前缀，用于帮助 LLM 精确返回匹配的规则
  if (includeId) {
    const prefixParts: string[] = [];
    if (ruleRef) {
      prefixParts.push(`[RULE_REF:${ruleRef}]`);
    }
    if (ruleIndex !== undefined) {
      prefixParts.push(`[RULE_ID:${ruleIndex}]`);
    }
    if (prefixParts.length > 0) {
      return `${prefixParts.join(' ')} ${ruleText}`;
    }
  }

  return ruleText;
}
