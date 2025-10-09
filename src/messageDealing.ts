import { sendBotMessage } from './bot';
import { callLLMJsonAPI, handleLLMRequest } from './llm';
import { getEnvConfig, showToast } from './utils';
import { storeMessage } from './vectorStore';
import { v4 as uuidv4 } from 'uuid';
import { extractEntitiesFromMessage } from './services/entityExtraction';
import { processNewMessage } from './agentWorkflow';
import { IntelligentAgent } from './agentThinking';
import { MessageAnalysisResult } from './types';
import { memorySystem, StoreResult } from './memory';

// 整理所有消息，发送给 LLM 分析，然后推送给 bot
export async function analyzeMessages (data: any[], username: string, isScheduledTask = false) {
	try {
		// 检查是否在 background script 环境中
		const isBackground = typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
		if (isBackground) {
			// 在 background script 中直接调用处理函数
			const response = await analyzeMessagesInBackground(data, username, isScheduledTask);
			return response;
		} else {
			// 在 content script 或其他环境中使用 message passing
			const response = await chrome.runtime.sendMessage({
				type: 'MESSAGE_DEALING',
				data: {
					body: {
						data,
						username,
						isScheduledTask
					}
				}
			});
			
			// 检查响应格式 - 支持新的统一响应格式
			if (response && response.success) {
				console.log("LLM's response:", response, {data, isScheduledTask});
				// Todo: Toast 方法在 popup 中无法调用
				// showToast(response.message || 'Analysis complete', 'success');
				return response;
			} else {
				const error = new Error(response.message || 'Analysis failed');
				// showToast(error.message, 'error');
				throw error;
			}
		}
	} catch (error) {
		console.error("Error in sendMessageToLLM:", error);
		showToast(`Error: ${error.message}`, 'error');
	}
}

// 统一使用 background script 处理，防止跨域和权限问题
export async function analyzeMessagesInBackground (data: any[], username: string, isScheduledTask = false) {
    // 获取环境配置
    const envConfig = await getEnvConfig();
		
	// 检查是否定时任务被终止
	const scheduleActive = (await chrome.storage.local.get('scheduleActive')).scheduleActive || false;
	if (!scheduleActive && isScheduledTask) {
		console.log('定时分析任务已被终止，跳过处理');
		return { 
			success: false, 
			message: '定时分析任务已被终止', 
			data: [] as any[]
		};
	}

	const concernedItems: {text: string, pushToGlip?: boolean, mentionMe?: boolean}[] = (await chrome.storage.local.get('concernedItems')).concernedItems || [
		{text:'recording 项目在 RCV mobile 中的相关信息，特别是 BE 依赖部分的完成情况（关键词：recording/RCV mobile/BE dependencies，必须同时包含"recording"和"BE"相关关键词）'},
		{text:'聊到关于公司政策，也可以是政策相关的八卦消息'},
		{text:'Sophia (Jinmei) Lin 发送的所有消息（只需要检查发送者是否完全匹配）'},
		{text:'任何明确 @我 的消息，或者提到我的名字的消息'},
	];

	data = data.filter(item => item.type === 'message')
	// 插入调试数据
	// data.unshift({
	//   groupName: 'Recording Test',
	//   groupId: '123',
	//   posts: [
	//     { id: '1231', creator: 'Ada', time: '2025-02-13 00:00:00', text: 'Share recording 的 backend 完成怎么样了？' },
	//     { id: '1232', creator: 'Sophia (Jinmei) Lin', time: '2025-02-13 00:00:00', text: 'Recording project BE dependencies completed' }
	//   ]
	// });
	// data.unshift({
	//   groupName: '大群',
	//   groupId: '2578219014',
	//   posts: [
	//     { id: '25782190141', creator: 'Colin Liu', time: '2025-02-14 00:00:00', text: '@Team 应要求，大家注意一下到公司时候的上下班时间，至少保持8个小时在公司的时间，无特殊情况不要中场离开，谢谢各位 。详细信息大家请翻看我之前发的消息' },
	//     { id: '25782190142', creator: 'Ruphi', time: '2025-02-14 00:01:00', text: '详细信息可以查看：MTR-128732' }
	//   ]
	// });
	// data.unshift({
	//   groupName: '小群',
	//   groupId: '321',
	//   posts: [
	//     { id: '3211', creator: 'Fred', time: '2025-02-14 00:00:00', text: '没事' }
	//   ]
	// });
	// data.splice(3);
	console.log(data, concernedItems, username);
	if (data.length === 0) {
		console.log('没有消息数据，跳过处理');
		return { 
			success: true, 
			message: '没有消息数据需要处理', 
			data: [] as any[]
		};
	}
    
    // 根据配置选择处理方式
    if (envConfig.ANALYSIS_TYPE === 'agentThinking') {
        // 使用智能 Agent 处理
        console.log('Using Intelligent Agent to process messages');
		console.log('使用智能Agent系统直接批量处理消息，支持消息降噪和上下文分析...');
		
		try {
			// 设置初始进度信息
			chrome.storage.local.set({
				ollamaAnalysisProgress: {
					total: data.length,
					lastAnalyzedIndex: 0,
					lastAnalyzedTime: new Date().toISOString()
				}
			});
			
			// 构造消息组格式
			const messageGroups = data.map(item => ({
				groupName: item.groupName,
				groupId: item.groupId,
				posts: item.posts.map((post: any) => ({
					sender: post.creator,
					datetime: post.time,
					post_id: post.id || '',
					content: post.text,
					raw: post
				}))
			}));
			
			// 一次性传递所有消息组给processMessage处理
			console.log(`开始批量处理 ${messageGroups.length} 个群组的所有消息...`);
			
			// 直接将所有messageGroups传递给processMessage，让它内部决定如何处理
			const agent = new IntelligentAgent();
			chrome.storage.onChanged.addListener((changes, namespace) => {
			  if (namespace === 'local' && changes.scheduleActive) {
				const scheduleActive = changes.scheduleActive.newValue;
				if (!scheduleActive && isScheduledTask) agent.stop();
			  }
			});
			const allResults = await agent.analyze(messageGroups, {type: 'message'}, {concernedRules: concernedItems}, results => {
				console.log('已分析', results[0].groupIndex+1, '/' ,data.length ,'，当前群组 [', results[0].messageContext?.groupName, '] 处理结果:', results);
				chrome.storage.local.set({
					ollamaAnalysisProgress: {
						total: data.length,
						lastAnalyzedIndex: results[0].groupIndex + 1,
						lastAnalyzedTime: new Date().toISOString(),
					}
				});
			}) as MessageAnalysisResult[];
			
			// 转换结果为数组格式，便于统计
			const resultsArray = Array.isArray(allResults) ? allResults : [allResults];
			
			// 计算处理统计信息
			const storedCount = resultsArray.filter(r => r.shouldStore).length;
			const notifiedCount = resultsArray.filter(r => r.shouldNotify).length;
			const importantCount = resultsArray.filter(r => r.isImportant).length;
			const noisyCount = resultsArray.filter(r => !r.shouldStore && !r.shouldNotify && !r.isImportant).length;
			
			console.log(`所有群组消息处理完成: 共 ${resultsArray.length} 条消息, ${importantCount} 条重要, ${storedCount} 条已存储, ${notifiedCount} 条已通知, ${noisyCount} 条被降噪过滤。结果细节：`, resultsArray);
			
			// 更新进度为完成
			chrome.storage.local.set({
				ollamaAnalysisProgress: {
					total: data.length,
					lastAnalyzedIndex: data.length,
					lastAnalyzedTime: new Date().toISOString(),
					processingStats: {
						total: resultsArray.length,
						important: importantCount,
						stored: storedCount,
						notified: notifiedCount,
						filtered: noisyCount
					}
				}
			});

			// 处理 shouldNotify 和 shouldStore 标志
			for (const result of resultsArray) {
				// 处理 shouldNotify 标志
				if (result.shouldNotify && envConfig.ENABLE_BOT) {
					// 直接使用 result 中的信息，不需要复杂的查找
					const originalMessage = result.messageContext || {};
					
					// 查找匹配的关注项，确定是否需要mention
					const matchedConcernedItem = concernedItems.find((item: any) => 
						result.matchedRule && result.matchedRule.includes(item.text)
					);
					const shouldMention = matchedConcernedItem?.mentionMe || false;
					
					sendBotMessage({
						matched_rule: result.matchedRule || '',
						team_name: originalMessage.groupName || '',
						team_id: originalMessage.groupId || '',
						sender: originalMessage.sender || '',
						message_content: originalMessage.messageContent || '',
						summary: result.summary || '',
						reply_advice: result.replyAdvice || '',
						datetime: originalMessage.datetime || '',
						mention: shouldMention
					}).catch(console.error);
				}
				
										// 🆕 处理 shouldStore 标志 - 使用统一存储接口
				if (result.shouldStore) {
					try {
						const originalMessage = result.messageContext || {};
						const messageId = uuidv4();
						
						// 构建消息元数据
						const messageMetadata = {
							sender: originalMessage.sender || 'unknown',
							datetime: new Date(originalMessage.datetime).getTime() || Date.now(),
							matchedRules: result.matchedRule ? [result.matchedRule] : result.reasonsToStore || [],
							summary: result.summary || '',
							groupName: originalMessage.groupName || '',
							groupId: originalMessage.groupId || '',
							groupUrl: 'https://app.ringcentral.com/messages/' + originalMessage.groupId,
							// 基于智能分析结果推断用户关系类型
							user_relation_type: result.user_relation_type || 'general_interest',
							contextMessages: [] as any[], // Todo: 暂时设为空数组，稍后从其他地方获取
							entities: result.enrichedData?.entities || {},
							metadata: {
								sentiment: result.enrichedData?.sentiment || 'neutral',
								priority: result.notificationPriority || 'low',
								category: result.enrichedData?.category || [],
								tags: result.enrichedData?.tags || []
							},
							actions: result.enrichedData?.actions || [],
							replyAdvice: result.replyAdvice || ''
						};

						// 🆕 使用统一存储接口 - 内部自动处理实体关联数据
						try {
							// 确保记忆系统已初始化
							await memorySystem.initialize();
							
							// 统一存储接口 - 包含消息存储和实体关联数据处理
							const storeResult: StoreResult = await memorySystem.storeMessage({
								id: messageId,
								content: originalMessage.messageContent || '',
								metadata: messageMetadata
							});

							console.log(`✅ 消息完整存储完成: ${messageId}`, {
								...storeResult,
								performance: `${storeResult.processingTime}ms`
							});

						} catch (unifiedError) {
							console.error('🚨 统一存储系统失败，回退到原有方式:', unifiedError);
							
							// 回退到原有的存储方式
							await storeMessage(
								messageId,
								originalMessage.messageContent || '',
								messageMetadata
							);
							
							console.log(`📦 消息存储完成 [回退系统]: ${messageId}`);
						}
						
					} catch (error) {
						console.error('存储消息失败:', error);
					}
				}
			}

			// 返回处理结果
			return {
				success: true,
				message: `agentThinking处理完成: ${resultsArray.length} 条消息, ${storedCount} 条已存储, ${notifiedCount} 条已通知`,
				data: resultsArray,
				stats: {
					total: resultsArray.length,
					important: importantCount,
					stored: storedCount,
					notified: notifiedCount,
					filtered: noisyCount
				}
			};
		} catch (error) {
			console.error('批量处理消息失败:', error);
			return {
				success: false,
				message: `agentThinking处理失败: ${error.message}`,
				data: [] as any[],
				error: error.message
			};
		}
    } else if (envConfig.ANALYSIS_TYPE === 'agentWorkflow') {
        // 使用智能 Agent 系统处理
        console.log('Using Intelligent Agent Workflow to process messages');
		
		// agentWorkflow 模式需要逐个处理每个群组的消息
		for (let index = 0; index < data.length; index++) {
			const item = data[index];
			console.log(`--开始使用 Agent Workflow 分析第 ${index+1}/${data.length} 个群组的消息--`);
			
			// 检查是否需要继续分析
			const scheduleActive = (await chrome.storage.local.get('scheduleActive')).scheduleActive || false;
			if (!scheduleActive && isScheduledTask) {
				console.log('分析任务已被终止');
				break;
			}
			
			// 处理该群组的每条消息
			for (const post of item.posts) {
				const messageData = {
					post_id: post.id,
					team_id: item.groupId,
					team_name: item.groupName,
					message_content: post.text,
					sender: post.creator,
					datetime: post.time,
					username: username // 传递用户名用于匹配关注项
				};
				
				// 使用Agent系统处理单条消息
				const processResult = await processNewMessage(messageData);
				console.log(`Agent处理消息结果:`, processResult);
				
				// 如果需要发送通知
				if (processResult.shouldNotify && envConfig.ENABLE_BOT) {
					// 查找匹配的关注项，确定是否需要mention
					const matchedConcernedItem = concernedItems.find((item: any) => 
						processResult.matchedRule && processResult.matchedRule.includes(item.text)
					);
					const shouldMention = matchedConcernedItem?.mentionMe || false;
					
					sendBotMessage({
						matched_rule: processResult.matchedRule || '',
						team_name: processResult.messageContext?.groupName || '',
						team_id: processResult.messageContext?.groupId || '',
						sender: processResult.messageContext?.sender || '',
						message_content: processResult.messageContext?.messageContent || '',
						summary: processResult.summary || '',
						reply_advice: processResult.replyAdvice || '',
						datetime: processResult.messageContext?.datetime || '',
						mention: shouldMention
					}).catch(console.error);
				}
			}
		}
		
		// agentWorkflow 处理完成
		return {
			success: true,
			message: `agentWorkflow处理完成: 共处理 ${data.length} 个群组`,
			data: [] as any[],
			stats: {
				total: data.length,
				processed: data.length
			}
		};
    } else {
        // 使用普通模式处理
        console.log('Using filter mode to process messages');
        return await processMessageFilterByConcernedItems(data, concernedItems, username, isScheduledTask);
    }
}
async function processMessageFilterByConcernedItems(data: any[], concernedItems: {text: string}[], username: string, isScheduledTask: boolean) {
    const envConfig = await getEnvConfig();

	const system_prompt = `
你是一个很细心的项目经理，请认真阅读并分析以上消息，并按照以下要求返回数据。
${envConfig.ANALYZE_BY_GROUP ? '' : '每条 <message_group> 都是同一个群组的消息集合，其中可能包含了多条不同人发的 <message_content>，不同的 <message_group> 不相关联。'}
<message_group> 的 property 有 team_name，如果team_name是单个人名，则视为私聊，如果是多个人名，则是临时会话，否则视为群聊。

---- 以下是我的需求和你需要返回的内容定义 ----
${envConfig.ANALYZE_BY_GROUP ? '针对消息内容' : '让我们来一个一个查看 <message_group>，并且针对每个 <message_group> 都' }执行以下三步的任务：
1. 请仔细阅读 <message_group> 里的每条聊天消息，判断里面的 <message_content> 是否有符合以下规则其中一条${envConfig.ANALYZE_BY_GROUP ? '' : '。如果没有则跳过并查看下一个 message_group'}：
	- 规则0: 排除发送者是"SM AI undefined"的消息，排除发送者是自己的消息
	${concernedItems.map((item:any, i:number) => `- 规则${i+1}: ${item.text}`).join('\n	')}
2. 对 <message_group> 中有符合规则的消息，请提取以下字段：
	- <message_content> 标签内的消息原文（只提取原文，即便文字很多，不做删减不做修改不做翻译，并保留原有格式包括<a>标签、换行等）
	- <message_content> properties 中的发送者sender和发送时间datetime, 还有 <message_group> properties 中的 team_name, team_id, post_id
3. 对 <message_group> 中刚有符合规则的消息，每条生成对应的这几个新字段：
	- matched_rule: 上面第一步的符合到的规则x的原文内容
	- filter_reason: 选择这条消息过滤出来的原因，可以用中文表达
	- summary: 对这条消息所在的 message_group 的其他消息的上下文做出总结并适当的推理为什么sender会发出这个消息。请不要留空，这里可以用中文
	- reply_advice: 针对这条消息的上下文，给出回复建议，回复用的语言跟随上下文聊天语言。如果觉得这条消息不需要回复，请回复空字符串
	- entities: 提取消息中的实体信息，包括人物、项目、话题、行动项、情感和类别
	- user_relation_type: 基于智能分析结果推断本消息与我的关系，先检查是否有明确提及我的名字或者是在私聊(群组名是单个人名)直接对我说的话，如果有则返回 mention_me，提及团队或Team则返回 mention_team，如果没有则检查是否有明确提及项目、政策、人员等，如果有则返回 project_related、policy_related、person_tracking，如果没有则返回 general_interest
${envConfig.ANALYZE_BY_GROUP ? '' : '结束当前 <message_group> 的三步任务后，开始遍历下一个 <message_group>，直到所有 <message_group> 都遍历完成。'}

将任务输出的数据进行如下验证：
1. 以严格JSON格式输出，仅包含匹配的消息。如果没有匹配任何规则，输出{success: false, message: "No messages matched any rules", data: []}：
{
	"success": true,
	"message": "消息过滤完成: 共处理 {total} 个群组",
	"data": [{
		"message_content": "{message_content}",
		"sender": "{sender}",
		"matched_rule": "所符合的规则的内容",
		"filter_reason": "",
		"user_relation_type": "消息与用户的关系类型：mention_me(直接提到我)|mention_team(@Team)|project_related(项目相关关注)|policy_related(政策规定关注)|person_tracking(特定人员追踪)|general_interest(一般关注)",
		"post_id": "{post_id}",
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
			"actions": ["消息中需要执行的动作"],
			"documents": [{"name": "文档名称", "url": "链接", "type": "文档类型"}],
			"technologies": [{"name": "技术名称", "category": "技术分类", "version": "版本号"}],
			"sentiment": "整体情感(positive/negative/neutral)",
			"category": [消息类别，如"决策"、"讨论"、"公告"等]
		},
		"contextMessages": [{
			"id": "message_group内所有相关消息的post_id",
			"sender": "message_group内所有相关消息的发送者",
			"content": "message_group内所有相关消息原文",
			"datetime": "message_group内所有相关消息的发送时间",
			"isMainMessage": false // 是否是符合条件过滤出来的关键消息
		}]
	}]
}
2. 再次检查 message_content，是否是 <message_content> 标签内的消息原文，如果发现不是，找到对应的 <message_content> 标签，并返回对应的 message_content
3. 再次检查下即将输出的内容，是否有重复记录，如果发现重复记录（message_content、team_id 和 datetime 都相同），保留时间较新的那条记录，删除重复的记录
`

	// 以下是原有的LLM处理逻辑，当未启用智能Agent时使用
	if (envConfig.ANALYZE_BY_GROUP) {
		// 拆分单条发送 LLM
		let countAnalyzed = 0;
		chrome.storage.local.set({
			ollamaAnalysisProgress: {
				total: data.length,
				lastAnalyzedIndex: countAnalyzed,
				lastAnalyzedTime: new Date().toISOString()
			}
		});
		let scheduleActive = false;
		scheduleActive = (await chrome.storage.local.get('scheduleActive')).scheduleActive;
		chrome.storage.onChanged.addListener((changes, namespace) => {
			if (namespace === 'local' && changes.scheduleActive) {
				scheduleActive = changes.scheduleActive.newValue;
			}
		});
		for (let index = 0; index < data.length; index++) {
			const item = data[index];
			console.log(`--开始分析第 ${index+1}/${data.length} 个群组的消息--`);
			// 检查是否需要继续分析
			if (!scheduleActive && isScheduledTask) {
				console.log('分析任务已被终止');
				break;
			}
			const message = `<message_group team_name="${item.groupName}" team_id="${item.groupId}">${item.posts.map((post:any) => `
	<message_content sender="${post.creator}" datetime="${post.time}" post_id="${post.id}">${post.text}</message_content>`).join('')}
</message_group>`
			const user_prompt = `
我的名字是：<current_user_name>${username}</current_user_name> （如果过滤规则中消息的内容 message_content 有提到我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及，排除 sender 是我的消息）

---- 这是我收到的最近聊条消息开始 ----
${message}
---- 这是我收到的最近聊条消息结束 ----
`

			await reviewMessageByLLMAndSendToBot({user_prompt, system_prompt, messageData: item});
			chrome.storage.local.set({
				ollamaAnalysisProgress: {
					total: data.length,
					lastAnalyzedIndex: ++countAnalyzed,
					lastAnalyzedTime: new Date().toISOString()
				}
			});
			await new Promise(resolve => setTimeout(resolve, (envConfig.LLM_TYPE === 'local' ? 3 * 60 : 10) * 1000));
		}
		return {success: true, message: '消息过滤完成: 共处理 ' + data.length + ' 个群组'};
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
		const dealResponse = await reviewMessageByLLMAndSendToBot({user_prompt, system_prompt});
		console.log('MessageDealing response:', dealResponse);
		chrome.storage.local.set({
			ollamaAnalysisProgress: {
				total: 1,
				lastAnalyzedIndex: 1,
				lastAnalyzedTime: new Date().toISOString()
			}
		});
		return dealResponse;
	}
}
// 整合处理请求以及推送 bot 消息
async function reviewMessageByLLMAndSendToBot(body: any) {
	const envConfig = await getEnvConfig();
	try {
		const { concernedItems } = await chrome.storage.local.get('concernedItems');
		const { userinfo } = await chrome.storage.local.get('userinfo');
		if (!body.prompt) body.prompt = body.user_prompt + '\n\n' + body.system_prompt;
		const dealResponse = await callLLMJsonAPI(body);
		console.log('MessageDealing response:', dealResponse, body);
		
		if (dealResponse && dealResponse.data && dealResponse.data.length > 0) {
			for (const json of dealResponse.data) {
				// 如果需要推送 Glip 消息，则进行审核
				if (body.messageData && (body.messageData.groupName.includes('4700372020') || body.messageData.groupName == 'SM AI')) continue;	// 排除 SM AI 的私人消息
				if (json.team_name.includes('4700372020') || json.team_name == 'SM AI') continue;	// 排除 SM AI 的私人消息
				if (json.sender == 'SM AI undefined' || json.sender == userinfo.fullName) continue;	// Todo: sender 在 SM AI bot 中会被误判
				let isPassReview = true;
				let matched_rule = json.matched_rule;
				if (envConfig.LLM_REVIEW_BEFORE_SEND) {
				  // 先进行 LLM 审核
				  const concernedItemsForPush = concernedItems.filter((item:any) => item.pushToGlip);
				  const reviewPrompt = `本条消息是由 ${json.sender} 在群 ${json.team_name} 中发送的，内容如下：
<message_content>${json.message_content}</message_content>
这是上下文的总结：<summary>${json.summary}</summary>

请审核以上消息是否符合这些过滤规则中的任意一条（我的名字是 ${userinfo.fullName}）：
${concernedItemsForPush.map((item:any, i:number) => `- 规则${i+1}: ${item.text}`).join('\n')}

如果符合规则，请直接返回符合的规则原文，符合多条规则用换行隔开，不要包含其他内容。如果不符合任何规则，请返回"不通过"。
				  `;
				  const reviewResponseRaw = await handleLLMRequest({ prompt: reviewPrompt, type: 'review' });
				  console.log('reviewResponseRaw:', reviewResponseRaw, reviewPrompt);
				  const reviewResponse = reviewResponseRaw.replace(/<think>[\s\S]*?<\/think>/g, '').replace('\n', '').trim()
				  if (reviewResponse.includes('不通过')) {
					isPassReview = false;
				  }
				  matched_rule = reviewResponse.length < 100 ? reviewResponse : matched_rule;
				}

				// 增强逻辑：使用新的统一存储系统
				const messageId = uuidv4();
				const extractedEntities = await extractEntitiesFromMessage(json.message_content, json);
				
				// 构建消息元数据（包含上下文信息）
				const contextMessages = body.messageData ? body.messageData.posts.map((post: any) => ({
					id: post.id,
					sender: post.creator,
					content: post.text,
					datetime: post.time,
					isMainMessage: post.id == json.post_id
				})) : json.contextMessages;
				const messageMetadata = {
					sender: json.sender || 'unknown',
					datetime: new Date(json.datetime).getTime() || Date.now(),
					postId: json.post_id,   // 原始消息ID
					matchedRules: matched_rule ? matched_rule.split('\n').map((rule: string) => rule.trim()) : [],
					summary: json.summary || '',
					groupName: json.team_name,
					groupId: json.team_id,
					groupUrl: json.team_url || `https://app.ringcentral.com/messages/${json.team_id}`,
					// 用户关系类型（用于更精确的用户画像更新）
					user_relation_type: json.user_relation_type || 'general_interest',
					// 上下文信息（如果是ANALYZE_BY_GROUP模式，添加同组其他消息）
					contextMessages: contextMessages,
					// 当前消息在上下文中的位置
					messagePosition: contextMessages.findIndex((post: any) => post.id === json.post_id),
					actions: extractedEntities.actions,
					replyAdvice: json.reply_advice,
					entities: extractedEntities.entities,
					metadata: {
						sentiment: extractedEntities.metadata.sentiment,
						priority: extractedEntities.metadata.priority,
						category: extractedEntities.metadata.category,
						tags: extractedEntities.metadata.tags
					}
				};

				// 🆕 使用统一存储接口（与 agentThinking 方式一致）
				try {
					// 确保记忆系统已初始化
					await memorySystem.initialize();
					
					// 统一存储接口 - 包含消息存储和实体关联数据处理
					const storeResult: StoreResult = await memorySystem.storeMessage({
						id: messageId,
						content: json.message_content,
						metadata: messageMetadata
					});

					console.log(`✅ 消息完整存储完成 [统一接口]: ${messageId.slice(0,8)}`, {
						...storeResult,
						performance: `${storeResult.processingTime}ms`
					});

				} catch (memoryError) {
					console.error('🚨 统一存储系统失败，回退到原有方式:', memoryError);
					
					// 回退到基础存储
					await storeMessage(messageId, json.message_content, messageMetadata);
					console.log(`📦 消息存储完成 [回退系统]: ${messageId.slice(0,8)}`);
				}

				// 如果审核通过，则推送 Glip 消息
				if (isPassReview && envConfig.ENABLE_BOT) {
					// 查找匹配的关注项，确定是否需要mention
					const matchedConcernedItem = concernedItems.find((item: any) => 
						matched_rule && matched_rule.includes(item.text)
					);
					const shouldMention = matchedConcernedItem?.mentionMe || false;
					
					sendBotMessage({
						matched_rule,
						team_name: body.messageData ? body.messageData.groupName : json.team_name,
						team_id: body.messageData ? body.messageData.groupId : json.team_id,
						sender: json.sender,
						message_content: json.message_content,
						summary: json.summary,
						reply_advice: json.reply_advice,
						datetime: json.datetime,
						mention: shouldMention
					}).catch(console.error);
				}
			}
		}
		return dealResponse;
	} catch (error) {
		console.error('LLM error:', error);
		return { 
			error: error.message,
			details: `Failed to connect to ${envConfig.LLM_TYPE} service`
		}
	}
}
