interface BotMessagePayload {
    mentionList: string[];
    isTeamMention: boolean;
    teamName: string;
    teamId: string;
    message: string;
    skipMentionCheck: boolean;
}

interface MessageData {
    matched_rule: string;
    team_name: string;
    sender: string;
    message_content: string;
    summary: string;
}

const BOT_API_URL = 'https://botman.int.rclabenv.com/v2/team/message';
const BOT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImVzb25lLnFpdUByaW5nY2VudHJhbC5jb20iLCJzZXJ2aWNlIjoiU01fYm90LnNlcnZpY2UiLCJyb2xlIjoiUk9MRV9VU0VSIiwiaWF0IjoxNzM5OTQyMjUyLCJleHAiOjIwNTUzMDIyNTJ9.ieSb3zGIwVhUTqZpkgJipK8ktH4FVJr3vDF0kyQ-4DI';
const TEAM_ID = '1497300893698';

export async function sendBotMessage(messageData: MessageData): Promise<void> {
    console.log("Sending bot message:", messageData);
    const formattedMessage = `**监测到一条您可能关注的消息** (AI可能幻觉 仅供参考)

__关注项__：\`${messageData.matched_rule}\`
__在群__：${messageData.team_name}
__发送者__：${messageData.sender}
__原文__：${messageData.message_content}
__上下文__：${messageData.summary}`;

    const payload: BotMessagePayload = {
        mentionList: ["esone.qiu"],
        isTeamMention: false,
        teamName: messageData.team_name,
        teamId: TEAM_ID,
        message: formattedMessage,
        skipMentionCheck: true
    };

    try {
        const response = await fetch(BOT_API_URL, {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BOT_TOKEN}`,
                'bot': '4700372020@37439510.bot.glip.net'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Bot API error: ${response.status}`);
        }
    } catch (error) {
        console.error('Failed to send bot message:', error);
        throw error;
    }
} 