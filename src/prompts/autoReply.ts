/**
 * 自动答复相关的 Prompt 模板
 * 
 * 用于生成自动答复内容
 */

/**
 * 构建自动答复生成 Prompt
 * 根据消息上下文生成合适的自动答复
 */
export function buildAutoReplyPrompt(params: {
    messageContent: string;
    sender: string;
    groupName?: string;
    summary?: string;
    replyTemplate?: string;  // 用户填写的答复模板，用于风格参考
}): string {
    const { messageContent, sender, groupName, summary, replyTemplate } = params;
    
    // 如果有用户模板，生成风格参考提示
    const templateHint = replyTemplate 
        ? `\n用户期望的答复风格参考："${replyTemplate}"\n请保持这个风格和内容目的，但换一种表达方式，让每次答复略有不同。`
        : '';
    
    return `请根据以下消息生成一个简短的自动答复：

消息内容：${messageContent}
发送者：${sender}
群组：${groupName || '私聊'}
上下文总结：${summary || '无'}
${templateHint}

要求：
1. 简短（1-2句话）
2. ${replyTemplate ? '保持用户的答复风格，但措辞略有变化' : '礼貌且专业'}
3. 使用与原消息相同的语言

只返回答复内容，不要包含其他解释。`;
}
