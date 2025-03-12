import { sendBotMessage } from './bot';
import { handleLLMRequest } from './llm';
import { getEnvConfig, showToast } from './utils';
import { storeMessage } from './vectorStore';
import { v4 as uuidv4 } from 'uuid';
import { extractEntities } from './entityExtraction';

// 整理所有消息，发送给 LLM 分析，然后推送给 bot
export async function analyzeMessages (data: any[], username: string) {
    const envConfig = await getEnvConfig();
	const concernedItems: {text: string}[] = (await chrome.storage.local.get('concernedItems')).concernedItems || [
		{text:'recording 项目在 RCV mobile 中的相关信息，特别是 BE 依赖部分的完成情况（关键词：recording/RCV mobile/BE dependencies，必须同时包含"recording"和"BE"相关关键词）'},
		{text:'聊到关于公司政策，也可以是政策相关的八卦消息'},
		{text:'Sophia (Jinmei) Lin 发送的所有消息（只需要检查发送者是否完全匹配）'},
		{text:'任何明确 @我 的消息，或者提到我的名字的消息'},
	];

	const system_prompt = `
你是一个很细心的项目经理，请认真阅读并分析以上消息，并按照以下要求返回数据。
${envConfig.LLM_GROUP_ANALYSIS === 'true' ? '' : '每条 <message_group> 都是同一个群组的消息集合，其中可能包含了多条不同人发的 <message_content>，不同的 <message_group> 不相关联。'}	

---- 以下是我的需求和你需要返回的内容定义 ----
${envConfig.LLM_GROUP_ANALYSIS === 'true' ? '针对消息内容' : '让我们来一个一个查看 <message_group>，并且针对每个 <message_group> 都' }执行以下三步的任务：
1. 请仔细阅读 <message_group> 里的每条聊天消息，判断里面的 <message_content> 是否有符合以下规则其中一条${envConfig.LLM_GROUP_ANALYSIS === 'true' ? '' : '。如果没有则跳过并查看下一个 message_group'}：
	${concernedItems.map((item:any, i:number) => `- 规则${i+1}: ${item.text}`).join('\n	')}
2. 对 <message_group> 中有符合规则的消息，请提取以下字段：
	- <message_content> 标签内的消息原文（只提取原文，即便文字很多，不做删减不做修改不做翻译，并保留原有格式包括<a>标签、换行等）
	- <message_content> properties中的发送者sender和发送时间datetime, 还有<message_group> properties 中的 team_name, team_id, 以及符合的规则x
3. 对 <message_group> 中刚有符合规则的消息，每条生成对应的这 4 个新字段：
	- matched_rule: 上面第一步的符合到的规则x的原文内容
	- filter_reason: 选择这条消息过滤出来的原因，可以用中文表达
	- summary: 对这条消息所在的 message_group 的其他消息的上下文做出总结并适当的推理为什么sender会发出这个消息。请不要留空，这里可以用中文
	- reply_advice: 针对这条消息的上下文，给出回复建议，回复用的语言跟随上下文聊天语言。如果觉得这条消息不需要回复，请回复空字符串
	- entities: 提取消息中的实体信息，包括人物、项目、话题、行动项、情感和类别
${envConfig.LLM_GROUP_ANALYSIS === 'true' ? '' : '结束当前 <message_group> 的三步任务后，开始遍历下一个 <message_group>，直到所有 <message_group> 都遍历完成。'}

将任务输出的数据进行如下验证：
1. 以严格JSON格式输出，仅包含匹配的消息。如果没有匹配任何规则，输出空[]数组：
[{
	"message_content": "{message_content}",
	"sender": "{sender}",
	"matched_rule": "所符合的规则的内容",
	"filter_reason": "",
	"team_name": "{team_name}",
	"team_id": "{team_id}",
	"team_url": "https://app.ringcentral.com/messages/{team_id}",
	"summary": "请总结上下文到这里",
	"reply_advice": "建议的回复填入此",
	"datetime": "{datetime}",
	"entities": {
      "people": ["消息中提到的人物"],
      "projects": ["消息中提到的项目"],
      "topics": ["消息中提到的话题"],
      "actions": ["消息中需要执行的动作"]
      "sentiment": "整体情感(positive/negative/neutral)",
      "category": [消息类别，如"决策"、"讨论"、"公告"等]
    }
}]
2. 再次检查 message_content，是否是 <message_content> 标签内的消息原文，如果发现不是，找到对应的 <message_content> 标签，并返回对应的 message_content
3. 再次检查下即将输出的内容，是否有重复记录，如果发现重复记录（message_content、team_id 和 datetime 都相同），保留时间较新的那条记录，删除重复的记录
`
	console.log(data, concernedItems, username);
	// 插入调试数据
	// data.unshift({
	//   groupName: 'Recording Test',
	//   groupId: '123',
	//   posts: [
	//     { creator: 'Sophia (Jinmei) Lin', time: '2025-02-13 00:00:00', text: 'Recording project BE dependencies completed' }
	//   ]
	// });
	// data.unshift({
	//   groupName: '大群',
	//   groupId: '2578219014',
	//   posts: [
	//     { creator: 'Colin Liu', time: '2025-02-14 00:00:00', text: '@Team 应要求，大家注意一下到公司时候的上下班时间，至少保持8个小时在公司的时间，无特殊情况不要中场离开，谢谢各位 。' }
	//   ]
	// });
	// data.splice(2);
	// console.log(data);

	if (envConfig.LLM_GROUP_ANALYSIS === 'true') {
		// 拆分单条发送 LLM
		let countAnalyzed = 0;
		chrome.storage.local.set({
			ollamaAnalysisProgress: {
				total: data.length,
				lastAnalyzedIndex: countAnalyzed,
				lastAnalyzedTime: new Date().toISOString()
			}
		});
		const { scheduleActive } = await chrome.storage.local.get('scheduleActive');
		const isScheduledTask = typeof window === 'undefined'; // background script 环境中代表是定时任务
		data.forEach(async (item: any, index: number) => await setTimeout(async () => {
			console.log(`--开始分析第 ${index+1}/${data.length} 条消息--`);
			// 检查是否需要继续分析
			if (!scheduleActive && isScheduledTask) {
				console.log('分析任务已被终止');
				return;
			}
			const message = `<message_group team_name="${item.groupName}" team_id="${item.groupId}">${item.posts.map((post:any) => `
	<message_content sender="${post.creator}" datetime="${post.time}">${post.text}</message_content>`).join('')}
</message_group>`
			const user_prompt = `
我的名字是：<current_user_name>${username}</current_user_name> （如果过滤规则中消息的内容 message_content 有提到我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及，排除 sender 是我的消息）

---- 这是我收到的最近聊条消息开始 ----
${message}
---- 这是我收到的最近聊条消息结束 ----
`

			await sendMessageToLLM(user_prompt, system_prompt, item);
			chrome.storage.local.set({
			ollamaAnalysisProgress: {
				total: data.length,
				lastAnalyzedIndex: ++countAnalyzed,
				lastAnalyzedTime: new Date().toISOString()
			}
			});
		}, (envConfig.LLM_TYPE === 'local' ? 3 * 60 : 10) * 1000 * index + 1));
	} else {
		// 合并发送 LLM
		const messages = data.reduce((acc, item) => `${acc}\n
<message_group team_name="${item.groupName}" team_id="${item.groupId}">${item.posts.map((post:any) => `
	<message_content sender="${post.creator}" datetime="${post.time}">${post.text}</message_content>`).join('')}
</message_group>`, '<messages>') + '\n</messages>';

		const user_prompt = `
我的名字是：<current_user_name>${username}</current_user_name> （如果过滤规则中消息的内容 message_content 有提到我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及，排除 sender 是我的消息）

---- 这是我收到的最近聊条消息开始 ----
${messages}
---- 这是我收到的最近聊条消息结束 ----
`
		chrome.storage.local.set({
			ollamaAnalysisProgress: {
				total: 1,
				lastAnalyzedIndex: 0,
				lastAnalyzedTime: new Date().toISOString()
			}
		});
		await sendMessageToLLM(user_prompt, system_prompt);
		chrome.storage.local.set({
			ollamaAnalysisProgress: {
				total: 1,
				lastAnalyzedIndex: 1,
				lastAnalyzedTime: new Date().toISOString()
			}
		});
	}
}

const sendMessageToLLM = async (user_prompt: string, system_prompt: string, messageData?: any) => {
	console.log(`Sending prompt to LLM:`, user_prompt, system_prompt, messageData);
	try {
		// 检查是否在 background script 环境中
		const isBackground = typeof window === 'undefined';
		if (isBackground) {
			// 在 background script 中直接调用处理函数
			const response = await reviewMessageByLLMAndSendToBot({ user_prompt, system_prompt, messageData });
			return response;
		} else {
			// 在 content script 或其他环境中使用 message passing
			const response = await chrome.runtime.sendMessage({
				type: 'MESSAGE_DEALING',
				data: {
					body: {
						user_prompt,
						system_prompt,
						messageData
					}
				}
			});
			
			if (response.data) {
				console.log("LLM's response:", response.data, {user_prompt, messageData});
				// Todo: Toast 方法在 popup 中无法调用
				showToast('Analysis complete, please check the console', 'success');
				return response.data;
			} else {
				const error = new Error('Received invalid response format from LLM');
				console.error("Unexpected response format:", response);
				showToast(error.message, 'error');
				throw error;
			}
		}
	} catch (error) {
		console.error("Error in sendMessageToLLM:", error);
		showToast(`Error: ${error.message}`, 'error');
	}
};

// 整合处理请求以及推送 bot 消息
export async function reviewMessageByLLMAndSendToBot(body: any) {
	const envConfig = await getEnvConfig();
	try {
		const { concernedItems } = await chrome.storage.local.get('concernedItems');
		const { userinfo } = await chrome.storage.local.get('userinfo');
		if (!body.prompt) body.prompt = body.user_prompt + '\n\n' + body.system_prompt;
		const [raw, jsonArray] = await handleLLMRequest(body);
		console.log('LLM response:', raw);
		console.log('LLM jsonArray:', jsonArray);
		
		if (jsonArray && jsonArray.length > 0) {
			jsonArray.forEach(async json => {
				let matched_rule = json.matched_rule;
				if (envConfig.LLM_REVIEW_BEFORE_SEND === 'true') {
				  // 先进行 LLM 审核
				  const reviewPrompt = `本条消息是由 ${json.sender} 在群 ${json.team_name} 中发送的，内容如下：
<message_content>${json.message_content}</message_content>
这是上下文的总结：<summary>${json.summary}</summary>
请审核以上消息是否符合这些过滤规则中的任意一条（我的名字是 ${userinfo.fullName}）：
${concernedItems.map((item:any, i:number) => `- 规则${i+1}: ${item.text}`).join('\n')}

如果符合规则，请直接返回符合的规则原文，不要包含其他内容。如果不符合任何规则，请返回"不通过"。
				  `;
				  console.log('reviewPrompt:', reviewPrompt);
				  const [reviewResponseRaw] = await handleLLMRequest({ prompt: reviewPrompt, type: 'review' });
				  console.log('reviewResponseRaw:', reviewResponseRaw);
				  const reviewResponse = reviewResponseRaw.replace(/<think>[\s\S]*?<\/think>/g, '').replace('\n', '').trim()
				  if (reviewResponse.includes('不通过')) {
					return; // 审核不通过直接跳过
				  }
				  matched_rule = reviewResponse.length < 100 ? reviewResponse : matched_rule;
				}
				if (envConfig.ENABLE_BOT === 'true') {
					sendBotMessage({
						matched_rule,
						team_name: body.messageData ? body.messageData.groupName : json.team_name,
						team_id: body.messageData ? body.messageData.groupId : json.team_id,
						sender: json.sender,
						message_content: json.message_content,
						summary: json.summary,
						reply_advice: json.reply_advice
					}).catch(console.error);
				}
				
				// 将匹配的消息存储到向量数据库
				const messageId = uuidv4();
				const entities = await extractEntities(json.message_content);
				await storeMessage(
					messageId,
					json.message_content,
					{
						source: json.sender || 'unknown',
						timestamp: Date.now(),
						matchedRules: json.matched_rule ? [json.matched_rule] : [],
						summary: json.summary || '',
						teamName: json.team_name,
						teamId: json.team_id,
						entities: entities,
						sentiment: entities.sentiment,
						category: entities.category,
						reply_advice: json.reply_advice
					}
				);
			});
		}
		return raw
	} catch (error) {
		console.error('LLM error:', error);
		return { 
			error: error.message,
			details: `Failed to connect to ${envConfig.LLM_TYPE} service`
		}
	}
}
