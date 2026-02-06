/**
 * 规则文本构建器
 * 
 * 用于根据 TopicItem 的匹配条件生成完整规则文本，
 * 主要用于 LLM prompt 中的规则描述
 */

import { TopicItemWithAutoReply } from '../message-reaction/AutoReplyHandler';

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
    item: TopicItemWithAutoReply, 
    includeId = false, 
    ruleIndex?: number
): string {
    // 🔧 通用前缀构建函数：处理 filterSender 和 filterGroup
    const buildPrefix = (): string => {
        const prefixParts: string[] = [];
        if (item.filterSender) {
            prefixParts.push(item.filterSender);
        }
        if (item.filterGroup) {
            prefixParts.push(`在 ${item.filterGroup} 中`);
        }
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
        const originalDatetime = new Date(original.datetime).toLocaleString('zh-CN');
        
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
    if (includeId && ruleIndex !== undefined) {
        return `[RULE_ID:${ruleIndex}] ${ruleText}`;
    }
    
    return ruleText;
}

/**
 * 从 LLM 返回的 matchedRule 中提取规则 ID
 * 支持格式: "[RULE_ID:0]", "RULE_ID:0", "规则0", "规则1" 等
 * 
 * @param matchedRule LLM 返回的匹配规则文本
 * @returns 提取的规则 ID 数组（作为数字索引）
 */
export function extractRuleIdsFromMatchedRule(matchedRule: string): number[] {
    if (!matchedRule) return [];
    
    const ids: number[] = [];
    let match: RegExpExecArray | null;
    
    // 匹配 [RULE_ID:X] 格式
    const ruleIdRegex = /\[RULE_ID:(\d+)\]/g;
    while ((match = ruleIdRegex.exec(matchedRule)) !== null) {
        ids.push(parseInt(match[1], 10));
    }
    
    // 匹配 RULE_ID:X 格式（无方括号，避免重复匹配带方括号的）
    const ruleIdRegex2 = /(?<!\[)RULE_ID:(\d+)(?!\])/g;
    while ((match = ruleIdRegex2.exec(matchedRule)) !== null) {
        const id = parseInt(match[1], 10);
        if (!ids.includes(id)) ids.push(id);
    }
    
    // 匹配 "规则X" 格式（兼容中文）
    const chineseRuleRegex = /规则(\d+)/g;
    while ((match = chineseRuleRegex.exec(matchedRule)) !== null) {
        // 注意：中文格式通常从 1 开始，需要转换为 0-based index
        const id = parseInt(match[1], 10) - 1;
        if (id >= 0 && !ids.includes(id)) ids.push(id);
    }
    
    return ids;
}
