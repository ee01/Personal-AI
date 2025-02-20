interface MessageData {
    matched_rule: string;
    team_name: string;
    team_id: string;
    sender: string;
    message_content: string;
    summary: string;
}

const BOT_API_BASE_URL = 'https://botman.int.rclabenv.com/v2';
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_TYPE = process.env.BOT_TYPE;
const TEAM_ID = process.env.TEAM_ID;

export async function sendBotMessage(messageData: MessageData): Promise<void> {
    console.log("Sending bot message:", messageData);
    const username = (await chrome.storage.local.get('config')).config.username;
    const userEmail = username.trim().split(' ').join('.') + '@ringcentral.com';
    const formattedMessage = `**监测到一条您可能关注的消息** (AI可能幻觉 仅供参考)

__关注项__：\`${messageData.matched_rule}\`
__在群__：<a class='at_mention_compose' rel='{"id":${messageData.team_id}}'>@${messageData.team_name}</a>
__发送者__：${messageData.sender}
__原文__：${messageData.message_content}
__上下文__：${messageData.summary}`;

    const payload = BOT_TYPE === 'team' ? {
        mentionList: [userEmail],
        isTeamMention: false,
        teamName: messageData.team_name,
        teamId: TEAM_ID,
        message: formattedMessage,
        skipMentionCheck: true
    } : {
        mention: true,
        email: userEmail,
        emailAutoCorrect: true,
        message: formattedMessage,
    };

    try {
        const response = await fetch(`${BOT_API_BASE_URL}/${BOT_TYPE}/message`, {
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