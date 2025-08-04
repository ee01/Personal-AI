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
}

export async function sendBotMessage(messageData: MessageData): Promise<void> {
    console.log("Sending bot message:", messageData);
    const { userinfo } = await chrome.storage.local.get('userinfo');
    const envConfig = await getEnvConfig();
    const formattedMessage = `**监测到一条您可能关注的消息** (AI可能幻觉 仅供参考)

__关注项__：\`${messageData.matched_rule}\`
__在群__：<a class='at_mention_compose' rel='{"id":${messageData.team_id}}'>@${messageData.team_name}</a>
__发送者__：${messageData.sender}
__时间__：${messageData.datetime}
__原文__：${messageData.message_content}
__上下文__：${messageData.summary}
__回复建议__：${messageData.reply_advice}
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