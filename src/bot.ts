import { BotPushScenario, getBotPushTarget, getEnvConfig } from "./utils";
import { buildScheduledMessagesReviewUrl } from "./scheduled-messages/scheduledMessagesFilters";

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
    // 关注后续相关信息
    originalMessageInfo?: {
        sender: string;
        content: string;
        datetime: string;
        messageUrl: string;
    };
    pushScenario?: BotPushScenario;
}

interface PlainBotMessageOptions {
    message: string;
    mention?: boolean;
    teamName?: string;
    pushScenario?: BotPushScenario;
}

export async function sendPlainBotMessage(options: PlainBotMessageOptions): Promise<void> {
    const { userinfo } = await chrome.storage.local.get('userinfo');
    const envConfig = await getEnvConfig();
    const pushTarget = getBotPushTarget(envConfig, options.pushScenario);
    const shouldMention = options.mention !== false;
    const userEmail = userinfo?.userEmail || '';

    if (!pushTarget.apiType) {
        console.log(`Skipping bot push for scenario ${options.pushScenario || 'default'} because target is none`);
        return;
    }

    if (pushTarget.apiType === 'team' && !pushTarget.teamId) {
        throw new Error(`Missing group ID for bot push scenario: ${options.pushScenario || 'default'}`);
    }

    const payload = pushTarget.apiType === 'team' ? {
        mentionList: shouldMention && userEmail ? [userEmail] : [],
        isTeamMention: false,
        teamName: options.teamName || 'Personal AI',
        teamId: pushTarget.teamId,
        message: options.message,
        skipMentionCheck: !shouldMention
    } : {
        mention: shouldMention,
        email: userEmail,
        emailAutoCorrect: true,
        message: options.message,
    };

    const response = await fetch(`${envConfig.BOT_API_BASE_URL}/${pushTarget.apiType}/message`, {
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
}

export async function sendBotMessage(messageData: MessageData): Promise<void> {
    console.log("Sending bot message:", messageData);
    
    // 构建消息链接
    const messageLink = messageData.post_id && messageData.team_id 
        ? `https://app.ringcentral.com/messages/${messageData.team_id}/${messageData.post_id}`
        : `https://app.ringcentral.com/messages/${messageData.team_id}`;
    
    // 构建关注后续的原消息预览（如果有）
    let originalMessageSection = '';
    if (messageData.originalMessageInfo) {
        originalMessageSection = `__原消息__（来自 ${messageData.originalMessageInfo.sender}）：
> ${messageData.originalMessageInfo.content.substring(0, 150)}${messageData.originalMessageInfo.content.length > 150 ? '...' : ''}
🔗 [查看原消息](${messageData.originalMessageInfo.messageUrl})

__后续回复__：
`;
    }

    // 构建回复建议或自动答复信息
    let replySection: string;
    if (messageData.autoReplyInfo?.hasAutoReply) {
        const scheduledMessagesUrl = buildScheduledMessagesReviewUrl(messageData.autoReplyInfo.messageId);

        replySection = `__自动答复__：✅ 已配置自动答复，将于 ${messageData.autoReplyInfo.scheduleTime} 自动发送 [🔗点击审核或取消](${scheduledMessagesUrl})
> ${messageData.autoReplyInfo.replyContent?.substring(0, 100)}${(messageData.autoReplyInfo.replyContent?.length || 0) > 100 ? '...' : ''}`;
    } else {
        replySection = `__回复建议__：${messageData.reply_advice}`;
    }

    const formattedMessage = `\`${messageData.summary}\`
${originalMessageSection}__关注项__：${messageData.matched_rule}
__在群__：<a class='at_mention_compose' rel='{"id":${messageData.team_id}}'>@${messageData.team_name}</a>
__发送者__：${messageData.sender}
__时间__：${messageData.datetime}
__原文__：${messageData.message_content}
${replySection}

🔗 [点击查看原消息](${messageLink})
*以上是 Personal AI 监测到您可能关注的消息* (AI可能幻觉 仅供参考)
`;

    const shouldMention = messageData.mention !== false; // 默认为true，除非明确设置为false

    try {
        await sendPlainBotMessage({
            message: formattedMessage,
            mention: shouldMention,
            teamName: messageData.team_name,
            pushScenario: messageData.pushScenario
        });
    } catch (error) {
        console.error('Error sending bot message:', error);
        throw error;
    }
} 
