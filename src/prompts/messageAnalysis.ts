/**
 * 消息分析相关的 Prompt 模板
 * 
 * 用于消息过滤、规则匹配、总结等场景
 */

import { TopicItemWithAutoReply } from '../message-reaction/AutoReplyHandler';
import { buildRuleText } from '../utils/ruleTextBuilder';
import { EnvConfigType } from '../utils';

/**
 * 构建消息过滤系统 Prompt
 * 用于按关注规则过滤消息
 */
export function buildMessageFilterSystemPrompt(params: {
    concernedItems: TopicItemWithAutoReply[];
    username: string;
    envConfig: EnvConfigType;
}): string {
    const { concernedItems, username, envConfig } = params;
    
    return `
你是一个很细心的项目经理，请认真阅读并分析以上消息，并按照以下要求返回数据。

## 消息结构说明
每条 <message_group> 是同一个群组的消息集合，包含以下结构：
- <thread>: 对话线程，包含明确的回复关系
  - <root>: 线程的根消息（发起话题的消息），包含 post_id 属性（全局唯一标识符）
  - <reply>: 对根消息的回复，reply_to 属性指向被回复的消息 post_id，同样包含 post_id 属性
- <standalone>: 独立消息，没有明确的回复关系
  - <message>: 独立消息，包含 post_id 属性
  - 注意：standalone 中的消息虽然没有明确点击"回复"按钮，但可能在语义上是对同一群组中时间相近的 <thread> 消息的隐式回应。分析时请结合时间顺序和内容语义判断其是否属于某个对话线程的一部分。

**重要**: 每条消息都有唯一的 post_id（全局唯一标识符），请在返回结果时务必包含此字段，用于精确定位消息。

群组类型判断：team_name 如果是单个人名则视为私聊，多个人名则是临时会话，否则视为群聊。

## 🆕 关于"关注后续讨论"类型规则的特殊说明
如果规则文本中包含【匹配细节】标记，说明这是一个"关注后续讨论"规则，需要特别注意：
1. 这类规则要求匹配的是某条原始消息的**后续讨论**，而非原消息本身
2. 匹配时需要综合判断：直接回复（reply_to 指向原消息）、同 thread 后续、语义相关的隐式回复
3. **排除原消息本身**，只识别后续的讨论消息
4. 对于这类规则匹配的消息，需要额外填写 follow_thread_info 字段

---- 以下是我的需求和你需要返回的内容定义 ----
${envConfig.ANALYZE_BY_GROUP ? '针对消息内容' : '让我们来一个一个查看 <message_group>，并且针对每个 <message_group> 都'}执行以下三步的任务：

### 第一步：规则匹配
请仔细阅读 <message_group> 里的每条消息（包括 <thread> 中的 <root>/<reply> 和 <standalone> 中的 <message>），判断是否符合以下规则之一${envConfig.ANALYZE_BY_GROUP ? '' : '。如果没有则跳过并查看下一个 message_group'}：
	- 规则0: 排除发送者是"SM AI undefined"的消息${envConfig.FILTER_OWN_MESSAGES ? '，排除发送者是自己的消息' : ''}
	${concernedItems.map((item: TopicItemWithAutoReply, i: number) => 
        `- 规则${i+1} [RULE_ID:${i}]: ${buildRuleText(item)}`
    ).join('\n	')}

### 第二步：提取匹配消息的字段
对符合规则的消息，提取以下字段：
	- 消息原文（只提取原文，不做删减修改翻译，保留原有格式）
	- sender、datetime、post_id、team_name、team_id
	- **post_id（必填）**：消息的全局唯一标识符，用于精确定位消息
	- 如果消息在 <reply> 标签中，同时提取 reply_to（被回复的消息 ID）

### 第三步：生成分析字段
对每条匹配的消息，生成以下字段：
	- summary：请用一句话简明扼要地总结这条消息以及（如果有的话）上下文的核心内容，供我快速浏览
	- matchedRule：填写符合的规则编号，如"规则1"、"规则2"，如果符合多条规则则用逗号分隔，如"规则1,规则3"
	- matchedRuleIds：填写符合的规则编号数组（重要：使用数字0、1、2...，不是"规则1"这种字符串），如 [0, 2]
	- replyAdvice：如果我需要给对方答复，你需要给出建议的答复内容，供我参考
	- 🆕 follow_thread_info：**仅当匹配到"关注后续讨论"类型规则时填写**，格式如下：
		{
			"original_post_id": "原消息的 post_id",
			"match_type": "direct_reply|same_thread|semantic_related|mention_related",
			"match_reason": "简短说明为什么这条消息被判定为后续讨论"
		}
	- actions：一个包含待办事项的数组，结构为：[{ id, summary, priority, deadline, ...}]，优先级可选值有 low、medium、high、urgent。如果消息涉及任务或需要采取行动，此字段必填；否则设为空数组。

## 🔧 返回格式要求（严格按照 JSON 格式）
\`\`\`json
[
	{
		"message_content": "消息原文",
		"sender": "发送者名字",
		"datetime": "消息时间",
		"post_id": "消息的全局唯一标识符（必填）",
		"reply_to": "被回复的消息 ID（如果有）",
		"team_name": "群组名称",
		"team_id": "群组ID",
		"summary": "对消息及上下文的总结",
		"matchedRule": "符合的规则，如'规则1'或'规则1,规则3'",
		"matchedRuleIds": [0, 2],
		"replyAdvice": "给出的答复建议",
		"follow_thread_info": {
			"original_post_id": "原消息ID",
			"match_type": "匹配类型",
			"match_reason": "匹配原因"
		},
		"actions": [
			{
				"id": "action_1",
				"summary": "任务描述",
				"priority": "medium",
				"deadline": "2024-01-01",
				"status": "pending",
				"assignee": "${username}"
			}
		]
	}
]
\`\`\`

## 📌 重要提示
1. 请严格按照 JSON 格式返回，不要添加任何其他内容
2. 如果某个字段不适用，请设为空字符串或空数组，不要省略该字段
3. post_id 字段是必填项，务必从原消息中提取
4. matchedRuleIds 必须是数字数组，如 [0, 2]，不是字符串数组
5. 对于"关注后续讨论"规则，务必填写 follow_thread_info 字段
6. actions 数组：如果没有任务则为空数组 []，有任务时必须包含 id, summary, priority, deadline, status, assignee 字段
`.trim();
}

/**
 * 构建 LLM 审核 Prompt
 * 用于在发送通知前审核消息是否符合规则
 */
export function buildLLMReviewPrompt(params: {
    sender: string;
    teamName: string;
    messageContent: string;
    summary: string;
    userName: string;
    concernedItems: TopicItemWithAutoReply[];
}): string {
    const { sender, teamName, messageContent, summary, userName, concernedItems } = params;
    
    return `本条消息是由 ${sender} 在群 ${teamName} 中发送的，内容如下：
<message_content>${messageContent}</message_content>
这是上下文的总结：<summary>${summary}</summary>

请审核以上消息是否符合这些过滤规则中的任意一条（我的名字是 ${userName}）：
${concernedItems.map((item, i) => `- 规则${i + 1}: ${buildRuleText(item)}`).join('\n')}

如果符合规则，请直接返回符合的规则原文，符合多条规则用换行隔开，不要包含其他内容。如果不符合任何规则，请返回"不通过"。`;
}
