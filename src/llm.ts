import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { naturalLanguageQuery, getAllKnownPeople, fuzzyMatchPerson } from './vectorStore';

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL,
    dangerouslyAllowBrowser: true
});

// 初始化 Groq 客户端
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    dangerouslyAllowBrowser: true
});

// 新增：初始化 Dify API 配置
const difyConfig = {
    apiKey: process.env.DIFY_API_KEY,
    reviewApiKey: process.env.DIFY_REVIEW_API_KEY,
    baseURL: process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1'
};

// 根据不同 LLM 服务处理 LLM 请求，并提取 JSON 数据
export async function handleLLMRequest(body: any): Promise<[string, any[]]> {
    let handler;
    switch (process.env.LLM_TYPE) {
        case 'local':
            handler = handleOllamaRequest;
            if (body.type === 'review') body.model = process.env.OLLAMA_REVIEW_MODEL;
            if (body.type === 'query') body.model = process.env.OLLAMA_QUERY_MODEL;
            break;
        case 'groq':
            handler = handleGroqRequest;
            if (body.type === 'review') body.model = process.env.GROQ_REVIEW_MODEL;
            break;
        case 'dify':
            handler = handleDifyRequest;
            if (body.type === 'review') body.apiKey = process.env.DIFY_REVIEW_MODEL;
            break;
        default:
            handler = handleOpenAIRequest;
            if (body.type === 'review') body.model = process.env.OPENAI_REVIEW_MODEL;
    }
    const response = await handler(body);
    const jsonData = extractJsonFromResponse(response);
    return [response, jsonData];
}

// 处理 Ollama 请求。Ollama 安装后需要把 launchctl setenv OLLAMA_ORIGINS "*" 加入到 .bashrc 中
async function handleOllamaRequest(body: any): Promise<string> {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: body.model || process.env.OLLAMA_MODEL,
            prompt: body.prompt,
            stream: false,
            temperature: 0.3,
            top_p: 0.9
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.response;
}

// 处理 OpenAI 请求
async function handleOpenAIRequest(body: any): Promise<string> {
    const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL,
        messages: [{ role: "user", content: body.prompt }],
        temperature: 0.3,
        top_p: 0.9
    });

    return completion.choices[0].message.content || '';
}

// 处理 Groq 请求
async function handleGroqRequest(body: any): Promise<string> {
    const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: [{ role: "user", content: body.prompt }],
        temperature: 0.3,
        top_p: 0.9
    });

    return completion.choices[0].message.content || '';
}

// 新增：处理 Dify 请求
async function handleDifyRequest(body: any): Promise<string> {
    const response = await fetch(`${difyConfig.baseURL}/completion-messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${body.apiKey || difyConfig.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: {query: body.prompt},            // 可选的输入参数
            response_mode: 'blocking',           // 改为 streaming 模式
            user: body.user || 'default-user',    // 可选
        })
    });

    if (!response.ok) {
        throw new Error(`Dify API error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.answer || '';
}

// 新增：从响应文本中提取 JSON 数据
function extractJsonFromResponse(response: string): any[] {
    let jsonData: any[] = [];
    try {
        // 首先尝试直接解析整个响应
        try {
            const directParse = JSON.parse(response.trim());
            return directParse;
        } catch (e) {
            // 如果直接解析失败，继续尝试其他方法
        }

        // 尝试从响应中查找 JSON 代码块
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            const parsedData = JSON.parse(jsonMatch[1].trim());
            jsonData = parsedData;
        } else {
            // 尝试查找可能的 JSON 字符串（方括号或大括号开头和结尾）
            const jsonRegex = /(\[[\s\S]*\]|\{[\s\S]*\})/;
            const potentialJson = response.match(jsonRegex);
            if (potentialJson) {
                const parsedData = JSON.parse(potentialJson[1].trim());
                jsonData = parsedData;
            }
        }
    } catch (e) {
        console.warn('Failed to parse JSON from LLM response:', e);
    }
    return jsonData;
}

// 用通用查询函数替代原来的项目进展查询函数
export async function knowledgeQuery(question: string) {
  console.log('knowledgeQuery', question, new Date().getTime());
  try {
    // 1. 从问题中识别查询意图和关键实体
    const analysisPrompt = `
    分析以下问题，提取查询意图和关键实体。按JSON格式返回：
    
    问题: "${question}"
    
    {
      "queryType": "project_progress|person_info|topic_discussion|action_items|sentiment_analysis",
      "entities": {
        "people": [],
        "projects": [],
        "topics": []
      },
      "timeFrame": "recent|all|specific",
      "specificTime": null
    }
    `;
    
    // 使用LLM分析问题
    const queryIntent = await callLLMJsonAPI(analysisPrompt);
    console.log('queryIntent', queryIntent, new Date().getTime());
    
    // 1.5 获取所有已知人名并进行模糊匹配
    if (queryIntent && queryIntent.entities && queryIntent.entities.people && 
        Array.isArray(queryIntent.entities.people) && queryIntent.entities.people.length > 0) {
      
      // 获取所有已知人名
      const knownPeople = await getAllKnownPeople();
      console.log('已知人名列表:', knownPeople);
      
      // 对每个识别出的人名进行模糊匹配
      const matchedPeople = [];
      for (const person of queryIntent.entities.people) {
        const matchedPerson = fuzzyMatchPerson(person, knownPeople);
        if (matchedPerson) {
          console.log(`人名模糊匹配: "${person}" => "${matchedPerson}"`);
          matchedPeople.push(matchedPerson);
        } else {
          // 如果没有匹配到，保留原始人名
          matchedPeople.push(person);
        }
      }
      
      // 更新查询意图中的人名
      queryIntent.entities.people = matchedPeople;
      console.log('更新后的人名列表:', queryIntent.entities.people);
    }
    
    // 2. 构建查询过滤条件
    const filters: any = {};
    
    // 添加安全检查，确保 queryIntent 和 entities 存在
    if (queryIntent && queryIntent.entities) {
      // 检查 people 数组
      if (queryIntent.entities.people && Array.isArray(queryIntent.entities.people) && queryIntent.entities.people.length > 0) {
        // 如果是关于人的查询
        if (queryIntent.queryType === "person_info") {
          filters.source = queryIntent.entities.people[0];
        } else {
          filters.entities = { people: queryIntent.entities.people };
        }
      }
      
      // 检查 projects 数组
      if (queryIntent.entities.projects && Array.isArray(queryIntent.entities.projects) && queryIntent.entities.projects.length > 0) {
        if (!filters.entities) filters.entities = {};
        filters.entities.projects = queryIntent.entities.projects;
      }
      
      // 检查 topics 数组
      if (queryIntent.entities.topics && Array.isArray(queryIntent.entities.topics) && queryIntent.entities.topics.length > 0) {
        if (!filters.entities) filters.entities = {};
        filters.entities.topics = queryIntent.entities.topics;
      }
      
      // 3. 设置时间范围
      if (queryIntent.timeFrame === "recent") {
        const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        filters.startTime = oneMonthAgo;
      } else if (queryIntent.specificTime) {
        // 处理特定时间范围
        filters.startTime = queryIntent.specificTime;
      }
    } else {
      console.warn('查询意图解析失败或格式不正确:', queryIntent);
    }
    
    // 4. 查询向量数据库
    let queryResults;
    try {
      queryResults = await naturalLanguageQuery(question, filters);
      console.log('queryResults', queryResults, new Date().getTime());
    } catch (error) {
      console.error('向量数据库查询失败:', error);
      queryResults = {
        question: question,
        results: {
          ids: [],
          documents: [],
          metadatas: [],
          distances: []
        }
      };
    }
    
    // 添加空值检查
    if (!queryResults) {
      console.warn('向量数据库查询返回空结果');
      queryResults = {
        question: question,
        results: {
          ids: [],
          documents: [],
          metadatas: [],
          distances: []
        }
      };
    }
    
    const { question: formattedQuestion, results } = queryResults;
    
    if (!results || !results.documents || results.documents.length === 0) {
      return {
        success: false,
        message: `没有找到关于"${question}"的相关信息。`
      };
    }

    console.log('results', !results, !results.documents, results.documents.length === 0, new Date().getTime());
    // 5. 根据查询类型构建不同的提示模板
    let promptTemplate = "";
    
    switch (queryIntent.queryType) {
      case "project_progress":
        promptTemplate = `
        以下是关于项目的一些信息:
        {{context}}
        
        基于以上信息,请分析并回答关于项目进展的问题:
        ${question}
        
        请包括:
        1. 项目当前进展
        2. 存在的风险和挑战
        3. 下一步计划
        `;
        break;
        
      case "person_info":
        promptTemplate = `
        以下是关于{{person}}的一些信息:
        {{context}}
        
        基于这些信息,请回答:
        ${question}
        
        请分析此人:
        1. 关注的重点话题/项目
        2. 交流和决策风格
        3. 可能的兴趣和关注点
        `;
        break;
        
      case "topic_discussion":
        promptTemplate = `
        以下是关于"{{topic}}"话题的相关信息:
        {{context}}
        
        基于这些信息,请回答:
        ${question}
        
        请分析:
        1. 这个话题的主要讨论点
        2. 不同观点和立场
        3. 最新的发展或决策
        `;
        break;
        
      case "action_items":
        promptTemplate = `
        以下是一些可能包含行动项的消息:
        {{context}}
        
        基于这些信息,请回答:
        ${question}
        
        请列出:
        1. 所有需要注意的行动项
        2. 各项的截止日期(如有提及)
        3. 负责人(如有提及)
        `;
        break;
        
      default:
        promptTemplate = `
        以下是与问题"${question}"相关的信息:
        {{context}}
        
        请基于以上信息提供详细回答。仅使用提供的信息,不要添加额外知识。
        如果信息不足,请明确指出。
        `;
    }
    
    // 6. 插入上下文
    const messagesContext = results.documents
      .map((doc, idx) => {
        const metadata = results.metadatas[idx];
        const source = metadata.source;
        const date = new Date(Number(metadata.timestamp)).toLocaleString();
        return `[${date} - ${source}] ${doc}`;
      })
      .join('\n\n');
      
    let prompt = promptTemplate.replace('{{context}}', messagesContext);
    
    // 替换实体
    if (queryIntent.queryType === "person_info" && queryIntent.entities.people.length > 0) {
      prompt = prompt.replace('{{person}}', queryIntent.entities.people[0]);
    }
    
    if (queryIntent.queryType === "topic_discussion" && queryIntent.entities.topics.length > 0) {
      prompt = prompt.replace('{{topic}}', queryIntent.entities.topics[0]);
    }
    
    // 7. 调用 LLM 生成回答
    const [ llmResponse ] = await handleLLMRequest({prompt});
    
    // 8. 构建符合 QueryResult 接口的结果
    const formattedResults = results.documents.map((doc, idx) => {
      const metadata = results.metadatas[idx] as Record<string, string | number | boolean>;
      const id = String(results.ids[idx]);
      const relevance = 1 - results.distances[idx]; // 转换距离为相关性分数
      
      // 解析标签
      let tags: string[] = [];
      try {
        if (metadata.tags) {
          tags = JSON.parse(String(metadata.tags));
        } else if (metadata.category) {
          tags = JSON.parse(String(metadata.category));
        }
      } catch (e) {
        console.error('解析标签失败:', e);
        tags = [];
      }
      
      // 构建团队信息
      const teamInfo = metadata.teamName || metadata.teamId ? {
        name: String(metadata.teamName || '未知群组'),
        id: String(metadata.teamId || ''),
        url: metadata.teamId ? `https://app.ringcentral.com/messages/${metadata.teamId}` : ''
      } : undefined;
      
      // 构建 QueryResult 对象
      return {
        id: id,
        summary: String(metadata.summary) || doc.substring(0, 100) + '...',
        details: String(metadata.details || doc),
        timestamp: new Date(Number(metadata.timestamp)).toISOString(),
        source: String(metadata.source),
        relevance: relevance,
        tags: tags,
        team: teamInfo
      };
    });
    
    return {
      success: true,
      analysis: llmResponse,
      relatedMessages: results.documents.length,
      queryIntent: queryIntent,
      results: formattedResults
    };
  } catch (error) {
    console.error('通用查询失败:', error);
    return {
      success: false,
      message: '查询时发生错误,请稍后再试。'
    };
  }
}

// 实现 callLLMJsonAPI 函数
async function callLLMJsonAPI(prompt: string): Promise<any> {
  // 复用现有的 LLM 请求代码
  const [, jsonData] = await handleLLMRequest({
    prompt: prompt,
    type: 'query',
  });
  
  return jsonData;
}