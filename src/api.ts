import { SERVER_HOST, API_PATH } from './constants';
import { IConfig } from './config';
import { handleLLMRequest } from './llm';

export function fetchRadarPocServer(path: string, body: any) {
    const url = SERVER_HOST + path;
    return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      .then(async response => {
        if (!response.ok) {

          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        return data;
      })
}

export function genTopics(config: IConfig) {
    const { username, extensionId, model  } = config;
    const body = {
        username: username,
        extension_id: extensionId,
        model: model,
    };

    return fetchRadarPocServer(API_PATH.GEN_TOPICS, body);
}

export function trendingTopics(config: IConfig) {
  const { username, extensionId, model  } = config;
  const body = {
      username: username,
      extension_id: extensionId,
      model: model,
  };

  return fetchRadarPocServer(API_PATH.TRENDING_TOPICS, body);
}

export function customQuery(query: string, config: IConfig) {
    const { username, extensionId, model  } = config;

    const body = {
        username: username,
        extension_id: extensionId,
        model: model,
        query: query
    };

    return fetchRadarPocServer(API_PATH.QUERY, body);
}

export function globalQuery(query: string, config: IConfig) {
  const { username, extensionId, model  } = config;

  const body = {
      username: username,
      extension_id: extensionId,
      model: model,
      query: query
  };

  return fetchRadarPocServer(API_PATH.GLOBAL_QUERY, body);
}

export function fetchLastIndexTime(config: IConfig) {
    const { username, extensionId  } = config;

    const body = {
        username: username,
        extension_id: extensionId,
    };

    return fetchRadarPocServer(API_PATH.LATEST_INDEX_TIME, body);
}

export function indexing(data: any[], config: IConfig) {
  const { username, extensionId, model  } = config;

  if (!data || data.length === 0) {
      return Promise.reject(new Error('No data provided'));
  }

  const body = {
      username,
      extension_id: extensionId,
      model,
      data
  };

  return fetchRadarPocServer(API_PATH.INDEXING, body);
}

export function increment(data: any[], config: IConfig) {
  const { username, extensionId, model  } = config;

  if (!data || data.length === 0) {
      return Promise.reject(new Error('No data provided'));
  }

  const body = {
      username,
      extension_id: extensionId,
      model,
      data
  };

  return fetchRadarPocServer(API_PATH.INCREMENT, body);
}

export function delete_indexing(config: IConfig) {
  const { username, extensionId  } = config;

  const body = {
      username,
      extension_id: extensionId,
  };

  return fetchRadarPocServer(API_PATH.DELETE, body);
}

export function fetchDifyServer(query: string[], config: IConfig) {
  const url = 'https://lap2-api-dev.int.rclabenv.com/v1/completion-messages';
  const { username, apiKey  } = config;

  const data = {
    inputs: { query: JSON.stringify(query), username: username},
    response_mode: 'blocking',
    user: username
  };

  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    return data.answer;
  })
  .catch(error => {
    return error.message || 'Https error'
  });
}

export function sendDataToOllama (data: any[], config: IConfig) {
  const { username } = config;
  const concerned_part: string[] = JSON.parse(config.concernedItems || JSON.stringify([
    'recording 项目在 RCV mobile 中的相关信息，特别是 BE 依赖部分的完成情况（关键词：recording/RCV mobile/BE dependencies，必须同时包含"recording"和"BE"相关关键词）',
    '聊到关于公司政策，也可以是政策相关的八卦消息',
    'Sophia (Jinmei) Lin 发送的所有消息（只需要检查发送者是否完全匹配）',
    '任何明确 @我 的消息，或者提到我的名字的消息',
  ]));
  console.log(data);
  // 插入调试数据
  data.unshift({
    groupName: 'Recording Test',
    groupId: '123',
    posts: [
      { creator: 'Sophia (Jinmei) Lin', time: '2025-02-13 00:00:00', text: 'Recording project BE dependencies completed' }
    ]
  });
  data.unshift({
    groupName: '大群',
    groupId: '321',
    posts: [
      { creator: 'Colin Liu', time: '2025-02-14 00:00:00', text: '@Team 应要求，大家注意一下到公司时候的上下班时间，至少保持8个小时在公司的时间，无特殊情况不要中场离开，谢谢各位 。' }
    ]
  });
  data.splice(3);
  console.log(data);

  if (process.env.LLM_TYPE === 'local') {
    // 拆分单条发送 LLM
    data.forEach((item: any, index: number) => setTimeout(() => {
      console.log(`--开始分析第 ${index+1}/${data.length} 条消息--`);
      const message = `<message_group team_name="${item.groupName}" team_id="${item.groupId}">${item.posts.map((post:any) => `
          <message_content sender="${post.creator}" datetime="${post.time}">${post.text}</message_content>`).join('')}
        </message_group>`
      const prompt = `
        我的名字是：${username} （如果过滤规则中消息的内容 message_content 有提到我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及，排除 sender 是我的消息）

        ---- 这是我收到的最近聊条消息开始 ----
        ${message}
        ---- 这是我收到的最近聊条消息结束 ----

        ---- 以下是我的需求和你需要返回的内容定义 ----
        你是一个很细心的项目经理，请仔细阅读并认真分析以上消息，执行以下三步的任务：
        1. 请仔细阅读 message_group 里的每条聊天消息，判断里面的 message_content 是否有符合以下规则其中一条：
          ${concerned_part.map((item:any, i:number) => `- 规则${i+1}: ${item}`).join('\n          ')}
        2. 对 message_group 中刚有符合规则的消息，请提取以下字段（只提取原文，不做修改不做翻译）：
          - message_content消息原文及其对应发送者sender和发送时间datetime, 还有message_group中的 team_name, team_id, 以及符合的规则x
        3. 对 message_group 中刚有符合规则的消息，每条生成对应的这 3 个新字段：
          - matched_rule: 上面第一步的符合到的规则x的原文内容
          - filter_reason: 选择这条消息过滤出来的原因，可以用中文表达
          - summary: 对这条消息所在的 message_group 的其他消息的上下文做出总结并适当的推理为什么sender会发出这个消息。请不要留空，这里可以用中文

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
            "datetime": "{datetime}",
          }]
        2. 再次检查下即将输出的内容，是否有重复记录，如果发现重复记录（message_content、team_id 和 datetime 都相同），保留时间较新的那条记录，删除重复的记录
      `
      sendToOllama(prompt);
    }, 3 * 60 * 1000 * index + 1));

  } else {
    // 合并发送 LLM
    const messages = data.reduce((acc, item) => `${acc}\n
      <message_group team_name="${item.groupName}" team_id="${item.groupId}">${item.posts.map((post:any) => `
        <message_content sender="${post.creator}" datetime="${post.time}">${post.text}</message_content>`).join('')}
      </message_group>`, '<messages>') 
      // 增加调试数据👇
      + `\n\n    <message_group team_name="Recording Test" team_id="123">
        <message_content sender="Sophia (Jinmei) Lin" datetime="2025-02-13 00:00:00">Recording project BE dependencies completed</message_content>
      </message_group>`
      + `\n\n    <message_group team_name="大群" team_id="321">
        <message_content sender="Colin Liu" datetime="2025-02-14 00:00:00">@Team 应要求，大家注意一下到公司时候的上下班时间，至少保持8个小时在公司的时间，无特殊情况不要中场离开，谢谢各位 。</message_content>
      </message_group>`
      + '\n    </messages>';

    const prompt = `
      我的名字是：${username} （如果过滤规则中消息的内容 message_content 有提到我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及，排除 sender 是我的消息）

      ---- 这是我收到的最近聊条消息开始 ----
      ${messages}
      ---- 这是我收到的最近聊条消息结束 ----

      每条 message_group 都是同一个群组的消息集合，其中可能包含了多条不同人发的 message_content，不同的 message_group 不相关联。
      你是一个很细心的项目经理，请认真分析以上消息，并按照以下要求返回数据。

      ---- 以下是我的需求和你需要返回的内容定义 ----
      让我们来一个一个查看 message_group，并且针对每个 message_group 都执行以下三步的任务：
      1. 请仔细阅读 message_group 里的每条聊天消息，判断里面的 message_content 是否有符合以下规则其中一条。如果没有则跳过并查看下一个 message_group：
        ${concerned_part.map((item:any, i:number) => `- 规则${i+1}: ${item}`).join('\n        ')}
      2. 对 message_group 中刚有符合规则的消息，请提取以下字段（只提取原文，不做修改不做翻译）：
        - message_content消息原文及其对应发送者sender和发送时间datetime, 还有message_group中的 team_name, team_id, 以及符合的规则x
      3. 对 message_group 中刚有符合规则的消息，每条生成对应的这 3 个新字段：
        - matched_rule: 上面第一步的符合到的规则x的原文内容
        - filter_reason: 选择这条消息过滤出来的原因，可以用中文表达
        - summary: 对这条消息所在的 message_group 的其他消息的上下文做出总结并适当的推理为什么sender会发出这个消息。请不要留空，这里可以用中文
      结束当前 message_group 的三步任务后，开始遍历下一个 message_group，直到所有 message_group 都遍历完成。

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
          "datetime": "{datetime}",
        }]
      2. 再次检查下即将输出的内容，是否有重复记录，如果发现重复记录（message_content、team_id 和 datetime 都相同），保留时间较新的那条记录，删除重复的记录
    `
    sendToOllama(prompt);
  }
}

export const sendToOllama = async (prompt: string) => {
    console.log('Sending prompt to Ollama:', prompt);
    try {
        // 检查是否在 background script 环境中
        const isBackground = typeof window === 'undefined';
        if (isBackground) {
            // 在 background script 中直接调用处理函数
            const data = await handleLLMRequest({ prompt });
            console.log("Ollama's response:", data.response);
            return data;
        } else {
            // 在 content script 或其他环境中使用 message passing
            chrome.runtime.sendMessage({
                type: 'OLLAMA_REQUEST',
                data: {
                    body: {
                        prompt: prompt
                    }
                }
            }, response => {
                console.log('sendToOllama-response', response);
                
                if (response.error) {
                    console.error("Error sending to Ollama:", response.error);
                    console.error("Additional details:", response.details || 'No details');
                    if (response.rawResponse) {
                        console.log("Raw response from Ollama:", response.rawResponse);
                    }
                    showToast(`Failed to connect to Ollama: ${response.error}`, 'error');
                    return;
                }
                
                if (response.data && response.data.response) {
                    console.log("Ollama's response:", response.data.response);
                    showToast('Analysis complete, please check the console', 'success');
                } else {
                    console.error("Unexpected response format:", response);
                    showToast('Received invalid response format from Ollama', 'error');
                }
            });
        }
    } catch (error) {
        console.error("Error in sendToOllama:", error);
        showToast(`Error: ${error.message}`, 'error');
    }
};

export const showToast = (message: string, type: string) => {
    (window as any).showToast?.(message, type);
};