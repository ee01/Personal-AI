import { SERVER_HOST, API_PATH } from './constants';
import { IConfig } from './config';

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
  const concerned_part = localStorage.getItem('concernedItems') || [
    'recording 项目在 RCV mobile 中的相关信息，特别是 BE 依赖部分的完成情况（关键词：recording/RCV mobile/BE dependencies，必须同时包含"recording"和"BE"相关关键词）',
    '聊到关于公司政策，也可以是政策相关的八卦消息',
    'Sophia (Jinmei) Lin 发送的所有消息（只需要检查发送者是否完全匹配）',
    '任何明确 @我 的消息，或者提到我的名字的消息',
  ];
  console.log(data);
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
    我的名字是：${username} （如果过滤规则中消息的内容 message_content 而不是 sender 有提到@我，可作为判断消息是否有@我，即便是不带姓氏@名字部分 也视为提及）

    ---- 这是我收到的最近聊条消息开始 ----
    ${messages}
    ---- 这是我收到的最近聊条消息结束 ----

    每条 message_group 都是同一个群组的消息集合，其中可能包含了多条不同人发的 message_content，不同的 message_group 不相关联。
    你是一个很细心的项目经理，请认真分析以上消息，并按照以下要求返回数据。

    ---- 以下是我的需求和你需要返回的内容定义 ----
    让我们来一个一个查看 message_group，并且针对每个 message_group 都执行以下三步的任务：
    1. 请仔细阅读 message_group 里的每条聊天消息，判断里面的 message_content 是否有符合以下规则其中一条。如果没有则跳过并查看下一个 message_group：
      ${concerned_part.map((item:any, i:number) => `      - 规则${i+1}: ${item}`).join('\n')}
    2. 对 message_group 中刚有符合规则的消息，请提取以下字段（只提取原文，不做修改不做翻译）：
      - message_content及其对应sender和datetime, 还有message_group中的 team_name, team_id, 以及符合的规则x
    3. 对 message_group 中刚有符合规则的消息，每条生成对应的这 3 个新字段：
      - matched_rule: 上面第一步的符合到的规则x的原文内容
      - filter_reason: 选择这条消息过滤出来的原因，可以用中文表达
      - summary: 对这条消息所在的 message_group 的其他消息的上下文做出总结并适当的推理为什么sender会发出这个消息。请不要留空，这里可以用中文
    结束当前 message_group 的三步任务后，开始遍历下一个 message_group，直到所有 message_group 都遍历完成。

    将任务输出的数据进行如下验证：
    1. 以严格JSON格式输出，仅包含匹配的消息：
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
    // +`1. 认真分析以上消息，每条 message_group 都是同一个群组的消息集合，其中可能包含了多条 post，请逐个检查每一条 post，看看是否有可能是和我的 concerned_part 相关的信息。
    // 如果有，第一步请将这个 <message_content> 所在 <message_group> 的数据原封不动的提取出来，你只帮忙过滤提取出符合条件的 <team> 数据，不要有其他额外的文字，也不要总结不要修改格式。
    // 在思考中可以先输出这个列表。如果没有的数据,返回空数组。不要再进行下面的第二步以及后面任何验证判断。
  //   2. 第二步我们来重塑这个 related_posts 列表，先遍历 related_posts，并请查找每个 post 相关字段用以下JSON格式输出返回，不要有其他额外的文字：
  //   [{
  //     "post_content": "{post_content}", // 消息的内容，从消息中提取原文{post_content}原封不动放入此，不要做任何修改和总结，原文是什么语言就用什么语言
  //     "sender": "{sender}", // 消息的发送者，从消息中提取原文{sender}原封不动放入此，不要做任何修改和总结，原文是什么语言就用什么语言
  //     "concerned_part": "{concerned_part}", // 与先定义关注项 concerned_part 中的某一项或多项目(分号隔开)
  //     "filter_reason": "", // 给出过滤此消息的理由，比如符合 xx 兴趣项等。这里可以用中文
  //     "team_name": "{team_name}",  // 群组名
  //     "team_id": "{team_id}",  // 群组id，整型
  //     "team_url": "https://app.ringcentral.com/messages/{team_id}", // 群组URL，通过 {team_id} 拼接
  //     "summary": "（请总结上下文到这里）",  //  针对 {post} 消息在 {posts} 中的上下文的做出总结和适当的推理为什么sender会发出这个消息。请不要留空，这里可以用中文
  //     "datetime": "{datetime}", // {post} 消息发送时间 {datetime}
  //   }]
  //   JSON 字段说明：
  //     - 把这条 post 的原文内容放入 post_content 字段返回给我
  //     - 并且这条返回记录的 concerned_part 字段设为你认为关联到的 concerned_part 中的那一条的内容
  //     - 把这条 post 的 sender 字段放入 sender 字段返回给我
  //     - 把这条 post 的 datetime 字段放入 datetime 字段返回给我
  //     - 把这条 post 对应的 team 的 team_name 字段放入 team_name 字段返回给我
  //     - 把这条 post 对应的 team 的 team_id 字段放入 team_id 字段返回给我
  //     - 这条返回记录的 team_url 字段组合 https://app.ringcentral.com/messages/{team_id} 放入 team_url 字段返回给我

  //   返回示例（正确）：
  //   [
  //     {
  //       "concerned_part": "任何明确 @${username} 的消息，或者提到 ${username} 的消息",
  //       "filter_reason": "检测到@${username}的提及",
  //       ...
  //     }
  //   ]

  //   错误示例（不要出现）：
  //   [
  //     {
  //       "concerned_part": "404错误", // 这不是预定义关注项！
  //       ...
  //     }
  //   ]

  //   <新增验证层>
  //     <检查步骤>
  //       <步骤1>确认 concerned_part 是否是预先定义的关注项 concerned_part 中的其中一项</步骤1>
  //     </检查步骤>
  //     <通过条件>同时满足步骤1</通过条件>
  //     <不通过处理>
  //       <检查步骤>
  //         <步骤2>如果不满足步骤1，检查 concerned_part 是否与 concerned_part 信息关联</步骤2>
  //       </检查步骤>
  //       <通过条件及处理>同时满足步骤2，则将 concerned_part 改为关联的 concerned_part 信息</通过条件及处理>
  //       <不通过处理>如果不满足步骤2，则丢弃此条返回记录</不通过处理>
  //     </不通过处理>
  //   </新增验证层>

  //   <新增验证层>
  //     <检查步骤>
  //       <步骤1>summary 是否有值，且是中文</步骤1>
  //     </检查步骤>
  //     <通过条件>同时满足步骤1</通过条件>
  //     <不通过处理>对应 post 所在的 team 上下文来总结中文输出到 summary 字段</不通过处理>
  //   </新增验证层>

  //   <新增验证层>
  //     <检查步骤>
  //       <步骤1>返回的 JSON 是否符合上面给出的 concerned_part, filter_reason, team_name, team_url, sender, post_content, summary 结构</步骤1>
  //     </检查步骤>
  //     <通过条件>同时满足步骤1</通过条件>
  //     <不通过处理>丢弃返回记录，重新思考并整理符合既定 JSON 格式的数据</不通过处理>
  //   </新增验证层>

  //   <新增验证层>
  //     <检查步骤>
  //       <步骤1>检查返回数组中是否存在重复记录</步骤1>
  //     </检查步骤>
  //     <通过条件>
  //       - post_content 内容不完全相同
  //       - 如果 post_content 内容相同，则 team_id 和 datetime 至少有一个不同
  //     </通过条件>
  //     <不通过处理>
  //       如果发现重复记录（post_content、team_id 和 datetime 都相同），保留时间较新的那条记录，删除重复的记录
  //     </不通过处理>
  //   </新增验证层>

  //   ++特别注意事项：
  //   - 关注项名称必须完全复制我定义的原文（如"任何有@Esone Qiu的消息"不能简化为"@提及"）
  //   - 如果关注项中有定义关键词，只有当post内容有包含了两个以上关键词才视为符合关注项
  //   - 返回的数据的结构和我给的范例一致，数组中每条记录都包含 concerned_part, filter_reason, team_name, team_url, sender, post_content, summary, datetime
  //   - 返回的数组中每条记录不应该超出我的关注范围，其中 {concerned_part} 的值只能是是预先定义的关注项 concerned_part 中的其中一项，不要创造新的关注项
  //   - 返回的 team_url 必须是 "https://app.ringcentral.com/messages/"开头，后面跟着的是 team_id 不要伪造，要和消息记录中的 team_id 一致
  //   - 检查下数组中的所有消息，不要有重复的记录
  //   - 明确 @Esone Qiu 是指消息中 <a class='at_mention_compose>@Esone Qiu</a> 类似的内容
  //   - 请不要编造消息，确认 post_content 字段的内容一定是我的最近消息内容里的原文信息
  //   ++
  // `;

  sendToOllama(prompt);
}

export const sendToOllama = async (prompt: string) => {
    console.log('Sending prompt to Ollama:', prompt);
    try {
        chrome.runtime.sendMessage({
            type: 'OLLAMA_REQUEST',
            data: {
                url: 'http://localhost:11434/api/generate',
                method: 'POST',
                body: {
                    model: "deepseek-r1",
                    prompt: prompt,
                    stream: false
                }
            }
        }, response => {
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
    } catch (error) {
        console.error("Error in sendToOllama:", error);
        showToast(`Error: ${error.message}`, 'error');
    }
};

export const showToast = (message: string, type: string) => {
    (window as any).showToast?.(message, type);
};