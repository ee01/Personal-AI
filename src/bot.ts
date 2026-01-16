import { getEnvConfig } from "./utils";

interface MessageData {
    matched_rule: string;
    team_name: string;
    team_id: string;
    sender: string;
    message_content: string;
    summary: string;
    reply_advice: string;
    datetime?: string;
    mention?: boolean;
    post_id?: string;  // 消息 ID，用于生成链接
    // 自动答复相关信息
    autoReplyInfo?: {
        hasAutoReply: boolean;
        replyContent?: string;
        scheduleTime?: string;
        messageId?: string;  // 定时消息 ID
    };
}

export async function sendBotMessage(messageData: MessageData): Promise<void> {
    console.log("Sending bot message:", messageData);
    const { userinfo } = await chrome.storage.local.get('userinfo');
    const envConfig = await getEnvConfig();
    
    // 构建消息链接
    const messageLink = messageData.post_id && messageData.team_id 
        ? `https://app.ringcentral.com/l/messages/${messageData.team_id}/${messageData.post_id}`
        : `https://app.ringcentral.com/messages/${messageData.team_id}`;
    
    // 构建回复建议或自动答复信息
    let replySection: string;
    if (messageData.autoReplyInfo?.hasAutoReply) {
        // 构建 scheduled messages 页面链接（带筛选参数）
        const scheduledMessagesUrl = chrome.runtime.getURL('scheduled-messages.html?filterPendingReview=true');
        
        replySection = `__自动答复__：✅ 已配置自动答复，将于 ${messageData.autoReplyInfo.scheduleTime} 自动发送 [🔗点击审核或取消](${scheduledMessagesUrl}?messageId=${messageData.autoReplyInfo.messageId})
> ${messageData.autoReplyInfo.replyContent?.substring(0, 100)}${(messageData.autoReplyInfo.replyContent?.length || 0) > 100 ? '...' : ''}`;
    } else {
        replySection = `__回复建议__：${messageData.reply_advice}`;
    }
    
    const formattedMessage = `\`${messageData.summary}\`
__关注项__：${messageData.matched_rule}
__在群__：<a class='at_mention_compose' rel='{"id":${messageData.team_id}}'>@${messageData.team_name}</a>
__发送者__：${messageData.sender}
__时间__：${messageData.datetime}
__原文__：${messageData.message_content}
${replySection}

🔗 [点击查看原消息](${messageLink})
*以上是 Personal AI 监测到您可能关注的消息* (AI可能幻觉 仅供参考)
`;

    const shouldMention = messageData.mention !== false; // 默认为true，除非明确设置为false
    
    const payload = envConfig.BOT_TYPE === 'team' ? {
        mentionList: shouldMention ? [userinfo.userEmail] : [],
        isTeamMention: false,
        teamName: messageData.team_name,
        teamId: envConfig.TEAM_ID,
        message: formattedMessage,
        skipMentionCheck: !shouldMention
    } : {
        mention: shouldMention,
        email: userinfo.userEmail,
        emailAutoCorrect: true,
        message: formattedMessage,
    };

    try {
        const response = await fetch(`${envConfig.BOT_API_BASE_URL}/${envConfig.BOT_TYPE}/message`, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${envConfig.BOT_TOKEN}`,
                'bot': envConfig.BOT_ID
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Bot API error: ${response.status}`);
        }
    } catch (error) {
        console.error('Error sending bot message:', error);
        throw error;
    }
} 