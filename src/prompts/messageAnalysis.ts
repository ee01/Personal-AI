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
    const { concernedItems, envConfig } = params;
    
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

## 特殊规则说明：关注后续讨论
规则中带有【关注后续讨论】标记的是"关注后续"类型规则，需要特别注意：
1. 这类规则关注的是**某条特定消息的后续讨论**，规则中会提供原消息的 post_id 和内容
2. 匹配时需要综合判断：直接回复（reply_to 指向原消息）、同 thread 后续、语义相关的隐式回复
3. **排除原消息本身**，只识别后续的讨论消息
4. 对于这类规则匹配的消息，需要额外填写 follow_thread_info 字段

---- 以下是我的需求和你需要返回的内容定义 ----
${envConfig.ANALYZE_BY_GROUP ? '针对消息内容' : '让我们来一个一个查看 <message_group>，并且针对每个 <message_group> 都'}执行以下三步的任务：

### 第一步：规则匹配
请仔细阅读 <message_group> 里的每条消息（包括 <thread> 中的 <root>/<reply> 和 <standalone> 中的 <message>），判断是否符合以下规则之一${envConfig.ANALYZE_BY_GROUP ? '' : '。如果没有则跳过并查看下一个 message_group'}：
    - 规则0: 排除发送者是"SM AI undefined"的消息，排除发送者是自己的消息
    ${concernedItems.map((item:any, i:number) => `- 规则${i+1} [RULE_ID:${i}]: ${buildRuleText(item as TopicItemWithAutoReply)}`).join('\n  ')}

### 第二步：提取匹配消息的字段
对符合规则的消息，提取以下字段：
    - 消息原文（只提取原文，不做删减修改翻译，保留原有格式）
    - sender、datetime、post_id、team_name、team_id
    - **post_id（必填）**：消息的全局唯一标识符，用于精确定位消息
    - 如果消息在 <reply> 标签中，同时提取 reply_to（被回复的消息 ID）

### 第三步：生成分析字段
对每条匹配的消息，生成以下字段：
    - matched_rule_ids: 【重要】符合的规则 ID 数组，使用 [RULE_ID:X] 中的 X 值
    - matched_rule: 符合的规则原文内容（备用参考）
    - filter_reason: 选择这条消息的原因（中文）
    - summary: 结合 <thread> 的上下文（包括 root 和其他 reply）总结为什么 sender 会发出这个消息。如果是 <standalone> 消息，分析它是否可能是对附近 <thread> 的隐式回应
    - reply_advice: 回复建议，语言跟随上下文。不需要回复则返回空字符串
    - entities: 提取实体信息（人物、项目、话题、行动项、情感、类别）
    - user_relation_type: 与我的关系类型（mention_me/mention_team/project_related/policy_related/person_tracking/general_interest）
    - thread_context: 如果消息属于某个 <thread>，记录该线程的 root_id；如果是 standalone 但判断为隐式回复，也记录相关的 thread root_id
    - follow_thread_info: 【仅当匹配"关注后续讨论"规则时填写】记录与原消息的关系类型
${envConfig.ANALYZE_BY_GROUP ? '' : '结束当前 <message_group> 的三步任务后，继续下一个 <message_group>。'}

## 输出格式
以严格 JSON 格式输出。如果没有匹配任何规则，输出 {success: false, message: "No messages matched any rules", data: []}：
\`\`\`json
{
    "success": true,
    "message": "消息过滤完成: 共处理 {total} 个群组",
    "data": [{
        "message_content": "{消息原文}",
        "sender": "{sender}",
        "post_id": "{post_id}",  // 必填：消息的全局唯一标识符
        "matched_rule_ids": [0],
        "matched_rule": "符合的规则内容",
        "filter_reason": "过滤原因",
        "user_relation_type": "mention_me|mention_team|project_related|policy_related|person_tracking|general_interest",
        "reply_to": "{被回复消息的post_id，如果是回复消息}",
        "thread_context": {
            "root_id": "{所属线程的根消息ID}",
            "is_implicit_reply": false
        },
        "follow_thread_info": {  // 仅当匹配"关注后续讨论"规则时填写
            "original_post_id": "{被关注的原消息post_id}",
            "relation_type": "direct_reply|same_thread|semantic_related|mention",
            "relevance_score": 0.9  // 0-1 之间的相关度评分
        },
        "team_name": "{team_name}",
        "team_id": "{team_id}",
        "team_url": "https://app.ringcentral.com/messages/{team_id}",
        "summary": "上下文总结",
        "reply_advice": "回复建议",
        "datetime": "{datetime}",
        "entities": {
            "people": ["人物"],
            "projects": ["项目"],
            "topics": ["话题"],
            "actions": ["行动项"],
            "documents": [{"name": "文档名称", "url": "链接", "type": "文档类型"}],
            "technologies": [{"name": "技术名称", "category": "技术分类", "version": "版本号"}],
            "sentiment": "positive|negative|neutral",
            "category": ["决策", "讨论", "公告"等]
        },
        "contextMessages": [{
            "id": "{post_id}",
            "sender": "{发送者}",
            "content": "{消息原文}",
            "datetime": "{发送时间}",
            "isMainMessage": false,
            "messageType": "root|reply|standalone"
        }]
    }]
}
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
