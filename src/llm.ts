import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { naturalLanguageQuery, getAllKnownPeople, fuzzyMatchPerson, getAllKnownProjects, getAllKnownTopics, fuzzyMatchEntityName } from './vectorStore';
import { getEnvConfig } from './utils';
import { extractEntitiesForQuery } from './services/entityExtraction';

// 根据不同 LLM 服务处理 LLM 请求，并提取 JSON 数据
export async function handleLLMRequest(body: any): Promise<string> {
    const envConfig = await getEnvConfig();
    let handler;
    switch (envConfig.LLM_TYPE) {
        case 'local':
            handler = handleOllamaRequest;
            if (body.type === 'review') body.model = envConfig.OLLAMA_REVIEW_MODEL;
            if (body.type === 'query') body.model = envConfig.OLLAMA_QUERY_MODEL;
            break;
        case 'groq':
            handler = handleGroqRequest;
            if (body.type === 'review') body.model = envConfig.GROQ_REVIEW_MODEL;
            break;
        case 'dify':
            handler = handleDifyRequest;
            if (body.type === 'review') body.apiKey = envConfig.DIFY_REVIEW_API_KEY;
            break;
        default:
            handler = handleOpenAIRequest;
            if (body.type === 'review') body.model = envConfig.OPENAI_REVIEW_MODEL;
    }
    const response = await handler(body);
    return response;
}

// 处理 Ollama 请求。Ollama 安装后需要把 launchctl setenv OLLAMA_ORIGINS "*" 加入到 .bashrc 中
async function handleOllamaRequest(body: any): Promise<string> {
    const envConfig = await getEnvConfig();
    const response = await fetch(`${envConfig.OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: body.model || envConfig.OLLAMA_MODEL,
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
  const envConfig = await getEnvConfig();
  // 初始化 OpenAI 客户端
  const openai = new OpenAI({
      apiKey: envConfig.OPENAI_API_KEY,
      baseURL: envConfig.OPENAI_API_BASE_URL,
      dangerouslyAllowBrowser: true
  });
  const completion = await openai.chat.completions.create({
      model: envConfig.OPENAI_MODEL,
      messages: body.system_prompt ?  [
        { role: "system", content: body.system_prompt },
        { role: "user", content: body.user_prompt },
      ] : [
        { role: "user", content: body.prompt },
      ],
      temperature: 0.3,
      top_p: 0.9
  });

  return completion.choices[0].message.content || '';
}

// 处理 Groq 请求
async function handleGroqRequest(body: any): Promise<string> {
    const envConfig = await getEnvConfig();
    // 初始化 Groq 客户端
    const groq = new Groq({
        apiKey: envConfig.GROQ_API_KEY,
        dangerouslyAllowBrowser: true
    });
    const completion = await groq.chat.completions.create({
        model: envConfig.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: body.system_prompt ? [
          { role: "system", content: body.system_prompt },
          { role: "user", content: body.user_prompt },
        ] : [
          { role: "user", content: body.prompt },
        ],
        temperature: 0.3,
        top_p: 0.9
    });

    return completion.choices[0].message.content || '';
}

// 新增：处理 Dify 请求
async function handleDifyRequest(body: any): Promise<string> {
    const envConfig = await getEnvConfig();
    // 新增：初始化 Dify API 配置
    const difyConfig = {
        apiKey: envConfig.DIFY_API_KEY,
        reviewApiKey: envConfig.DIFY_REVIEW_API_KEY,
        baseURL: envConfig.DIFY_API_BASE_URL || 'https://api.dify.ai/v1'
    };
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
    const queryIntent = await extractEntitiesForQuery(question);
    console.log('queryIntent', queryIntent, new Date().getTime());
    
    // 类型安全处理：确保时间范围有效
    if (queryIntent?.query?.filters?.time_range) {
      const timeRange = queryIntent.query.filters.time_range;
      
      // 处理时间疑问词
      if (timeRange.type === 'specific' && typeof timeRange.start === 'string') {
        console.warn(`非法的时间值: ${timeRange.start}，类型: ${typeof timeRange.start}`);
        
        // 检查是否是常见的时间疑问词
        const timeQuestionWords = ["什么时候", "何时", "几点", "哪天", "什么日期", "什么时间", "几号", "什么时段", "几月", "哪一天", "什么季节"];
        
        if (timeQuestionWords.some(word => timeRange.start.includes(word))) {
          console.log(`检测到时间疑问词: "${timeRange.start}"，将time_range.type设为"all"`);
          timeRange.type = "all";
          timeRange.start = null;
          timeRange.end = null;
        }
      }
      
      // 根据时间描述设置具体的时间范围
      if (timeRange.type === 'range' && timeRange.description) {
        const now = new Date();
        const thisYear = now.getFullYear();
        const thisMonth = now.getMonth();
        
        if (/今年|本年|今年度|本年度/.test(timeRange.description)) {
          // 今年范围：从今年1月1日到现在
          const startOfYear = new Date(thisYear, 0, 1).getTime();
          timeRange.start = startOfYear;
          timeRange.end = now.getTime();
          console.log(`设置今年时间范围: ${new Date(startOfYear).toISOString()} 到 ${new Date().toISOString()}`);
        } 
        else if (/这个月|本月|当月/.test(timeRange.description)) {
          // 这个月范围：从本月1日到现在
          const startOfMonth = new Date(thisYear, thisMonth, 1).getTime();
          timeRange.start = startOfMonth;
          timeRange.end = now.getTime();
          console.log(`设置本月时间范围: ${new Date(startOfMonth).toISOString()} 到 ${new Date().toISOString()}`);
        }
        else if (/上个月|上月|前一个月/.test(timeRange.description)) {
          // 上个月范围
          const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
          const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
          const startOfLastMonth = new Date(lastMonthYear, lastMonth, 1).getTime();
          const endOfLastMonth = new Date(thisYear, thisMonth, 0).getTime();
          timeRange.start = startOfLastMonth;
          timeRange.end = endOfLastMonth;
          console.log(`设置上月时间范围: ${new Date(startOfLastMonth).toISOString()} 到 ${new Date(endOfLastMonth).toISOString()}`);
        }
        else if (/去年|上一年|前一年/.test(timeRange.description)) {
          // 去年范围
          const lastYear = thisYear - 1;
          const startOfLastYear = new Date(lastYear, 0, 1).getTime();
          const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59).getTime();
          timeRange.start = startOfLastYear;
          timeRange.end = endOfLastYear;
          console.log(`设置去年时间范围: ${new Date(startOfLastYear).toISOString()} 到 ${new Date(endOfLastYear).toISOString()}`);
        }
        else if (/过去(\d+)天|最近(\d+)天/.test(timeRange.description)) {
          // 过去N天
          const matches = timeRange.description.match(/过去(\d+)天|最近(\d+)天/);
          if (matches) {
            const days = parseInt(matches[1] || matches[2]);
            if (!isNaN(days)) {
              const pastDays = now.getTime() - (days * 24 * 60 * 60 * 1000);
              timeRange.start = pastDays;
              timeRange.end = now.getTime();
              console.log(`设置过去${days}天时间范围: ${new Date(pastDays).toISOString()} 到 ${new Date().toISOString()}`);
            }
          }
        }
      }
      
      // 如果是recent类型，设置默认为过去7天
      if (timeRange.type === 'recent') {
        const now = new Date();
        const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        timeRange.start = sevenDaysAgo;
        timeRange.end = now.getTime();
        console.log(`设置最近时间范围(7天): ${new Date(sevenDaysAgo).toISOString()} 到 ${new Date().toISOString()}`);
      }
    }
    
    // 1.5 获取所有已知人名、项目和主题进行模糊匹配
    // 1.5.1 人名模糊匹配
    if (queryIntent?.query?.filters?.entities?.people?.length > 0) {
      // 获取所有已知人名
      const knownPeople = await getAllKnownPeople();
      console.log('已知人名列表:', knownPeople);
      
      // 对每个识别出的人名进行模糊匹配
      const matchedPeople = [];
      for (const person of queryIntent.query.filters.entities.people) {
        const matchedPerson = fuzzyMatchPerson(person.name, knownPeople);
        if (matchedPerson) {
          console.log(`人名模糊匹配: "${person.name}" => "${matchedPerson}"`);
          matchedPeople.push({
            name: matchedPerson,
            role: person.role,
            required: person.required
          });
        } else {
          // 如果没有匹配到，保留原始人名
          matchedPeople.push(person);
        }
      }
      
      // 更新查询意图中的人名
      queryIntent.query.filters.entities.people = matchedPeople;
      console.log('更新后的人名列表:', queryIntent.query.filters.entities.people);
    }
    
    // 1.5.2 项目和主题的模糊匹配
    // 获取所有已知项目和主题
    const knownProjects = await getAllKnownProjects();
    const knownTopics = await getAllKnownTopics();
    console.log('已知项目列表:', knownProjects);
    console.log('已知主题列表:', knownTopics);
    
    // 项目模糊匹配
    if (queryIntent?.query?.filters?.entities?.projects?.length > 0) {
      const matchedProjects = [];
      for (const project of queryIntent.query.filters.entities.projects) {
        const matchedNames = fuzzyMatchEntityName(project.name, knownProjects);
        if (matchedNames.length > 0) {
          console.log(`项目模糊匹配: "${project.name}" => `, matchedNames);
          matchedNames.forEach(name => {
            matchedProjects.push({
              name,
              status: project.status,
              required: project.required
            });
          });
        } else {
          // 如果项目没匹配到，检查是否可以在主题中找到
          const matchedTopics = fuzzyMatchEntityName(project.name, knownTopics);
          if (matchedTopics.length > 0) {
            console.log(`项目在主题中匹配: "${project.name}" => `, matchedTopics);
            // 将匹配到的主题添加到主题列表中
            if (!queryIntent.query.filters.entities.topics) {
              queryIntent.query.filters.entities.topics = [];
            }
            matchedTopics.forEach(name => {
              queryIntent.query.filters.entities.topics.push({
                name,
                category: '',
                required: project.required
              });
            });
          } else {
            matchedProjects.push(project);
          }
        }
      }
      
      // 更新查询意图中的项目
      queryIntent.query.filters.entities.projects = matchedProjects;
    }
    
    // 主题模糊匹配
    if (queryIntent?.query?.filters?.entities?.topics?.length > 0) {
      const matchedTopics = [];
      for (const topic of queryIntent.query.filters.entities.topics) {
        const matchedNames = fuzzyMatchEntityName(topic.name, knownTopics);
        if (matchedNames.length > 0) {
          console.log(`主题模糊匹配: "${topic.name}" => `, matchedNames);
          matchedNames.forEach(name => {
            matchedTopics.push({
              name,
              category: topic.category,
              required: topic.required
            });
          });
        } else {
          // 如果主题没匹配到，检查是否可以在项目中找到
          const matchedProjects = fuzzyMatchEntityName(topic.name, knownProjects);
          if (matchedProjects.length > 0) {
            console.log(`主题在项目中匹配: "${topic.name}" => `, matchedProjects);
            // 将匹配到的项目添加到项目列表中
            if (!queryIntent.query.filters.entities.projects) {
              queryIntent.query.filters.entities.projects = [];
            }
            matchedProjects.forEach(name => {
              queryIntent.query.filters.entities.projects.push({
                name,
                status: '',
                required: topic.required
              });
            });
          } else {
            matchedTopics.push(topic);
          }
        }
      }
      
      // 更新查询意图中的主题
      queryIntent.query.filters.entities.topics = matchedTopics;
    }
    
    // 1.5.3 特殊处理：如果用户查询既没有指定项目也没有指定主题，但问题中含有实体名称，尝试从两者中匹配
    if ((!queryIntent?.query?.filters?.entities?.projects?.length) && 
        (!queryIntent?.query?.filters?.entities?.topics?.length)) {
      
      // 从问题中提取可能的实体名称（简单策略：提取所有名词短语）
      const words = question.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        // 尝试不同长度的词组
        for (let j = Math.min(i + 3, words.length); j > i; j--) {
          const phrase = words.slice(i, j).join(' ');
          
          // 在项目中查找
          const matchedProjects = fuzzyMatchEntityName(phrase, knownProjects);
          if (matchedProjects.length > 0) {
            console.log(`从问题中提取项目: "${phrase}" => `, matchedProjects);
            if (!queryIntent.query.filters.entities.projects) {
              queryIntent.query.filters.entities.projects = [];
            }
            matchedProjects.forEach(name => {
              queryIntent.query.filters.entities.projects.push({
                name,
                status: '',
                required: true
              });
            });
          }
          
          // 在主题中查找
          const matchedTopics = fuzzyMatchEntityName(phrase, knownTopics);
          if (matchedTopics.length > 0) {
            console.log(`从问题中提取主题: "${phrase}" => `, matchedTopics);
            if (!queryIntent.query.filters.entities.topics) {
              queryIntent.query.filters.entities.topics = [];
            }
            matchedTopics.forEach(name => {
              queryIntent.query.filters.entities.topics.push({
                name,
                category: '',
                required: true
              });
            });
          }
        }
      }
    }
    
    // 去重（基于name字段）
    if (queryIntent?.query?.filters?.entities?.projects) {
      queryIntent.query.filters.entities.projects = Array.from(
        new Map(queryIntent.query.filters.entities.projects.map((item: { name: string }) => [item.name, item])).values()
      );
    }
    if (queryIntent?.query?.filters?.entities?.topics) {
      queryIntent.query.filters.entities.topics = Array.from(
        new Map(queryIntent.query.filters.entities.topics.map((item: { name: string }) => [item.name, item])).values()
      );
    }
    
    console.log('最终查询意图:', queryIntent);
    
    // 2. 构建查询过滤条件
    const filters: any = {};
    
    // 添加安全检查，确保 queryIntent 结构完整
    if (queryIntent?.query?.filters) {
      // 复制实体过滤器
      if (queryIntent.query.filters.entities) {
        filters.entities = queryIntent.query.filters.entities;
      }
      
      // 复制时间范围
      if (queryIntent.query.filters.time_range) {
        filters.time_range = queryIntent.query.filters.time_range;
      }
    }
    
    // 设置输出选项
    const output = queryIntent?.query?.output || {
      format: "list",
      limit: 20,
      sort: {
        field: "timestamp",
        order: "desc" as const
      }
    };
    
    // 4. 查询向量数据库
    let queryResults;
    try {
      queryResults = await naturalLanguageQuery(question, filters, output);
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
    
    switch (queryIntent?.query?.intent?.secondary) {
      case "project_status":
        promptTemplate = `
        以下是关于项目的一些信息:
        {{context}}
        
        基于以上信息,请分析并回答关于项目进展的问题:
        ${formattedQuestion}
        
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
        ${formattedQuestion}
        
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
        ${formattedQuestion}
        
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
        ${formattedQuestion}
        
        请列出:
        1. 所有需要注意的行动项
        2. 各项的截止日期(如有提及)
        3. 负责人(如有提及)
        `;
        break;
        
      default:
        promptTemplate = `
        以下是与问题"${formattedQuestion}"相关的信息:
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
    if (queryIntent?.query?.intent?.secondary === "person_info" && 
        queryIntent?.query?.filters?.entities?.people?.length > 0) {
      prompt = prompt.replace('{{person}}', queryIntent.query.filters.entities.people[0].name);
    }
    
    if (queryIntent?.query?.intent?.secondary === "topic_discussion" && 
        queryIntent?.query?.filters?.entities?.topics?.length > 0) {
      prompt = prompt.replace('{{topic}}', queryIntent.query.filters.entities.topics[0].name);
    }
    
    // 7. 调用 LLM 生成回答
    const llmResponse = await handleLLMRequest({prompt});
    
    // 8. 构建符合 QueryResult 接口的结果
    const formattedResults = results.documents.map((doc, idx) => {
      const metadata = results.metadatas[idx] as Record<string, string | number | boolean>;
      const id = String(results.ids[idx]);
      const relevance = Math.max(0, 1 - results.distances[idx]); // 余弦距离：1-distance转换为相关性分数 (0-1)
      
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
      
      // 构建群组信息
      const groupInfo = metadata.grName || metadata.groupId ? {
        name: String(metadata.groupName || '未知群组'),
        id: String(metadata.groupId || ''),
        url: metadata.groupId ? `https://app.ringcentral.com/messages/${metadata.groupId}` : ''
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
        team: groupInfo,
        reply_advice: metadata.reply_advice || ''
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
export async function callLLMJsonAPI(body: any): Promise<any> {
  // 复用现有的 LLM 请求代码
  const response = await handleLLMRequest(body);
  const jsonData = extractJsonFromResponse(response);
  
  return jsonData;
}

// 通用聊天消息接口
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  onMessage?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: any) => void;
}

// OPENAI聊天实现
class OpenAIChat {
  private apiKey: string;
  private baseUrl: string;
  private openai: any; // OpenAI实例
  private conversationId = ''; // 添加会话ID存储
  private conversationHistory: Map<string, ChatMessage[]> = new Map(); // 存储不同会话的历史记录
  
  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    
    // 初始化OpenAI客户端
    this.openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true
    });
  }
  
  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }
  
  // 设置会话ID
  setConversationId(id: string) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }
  
  // 获取当前会话ID
  getConversationId(): string {
    return this.conversationId;
  }
  
  // 获取当前会话的历史记录
  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory.get(this.conversationId) || [];
  }

  async chat(options: ChatOptions) {
    const { model, messages, temperature = 0.7, max_tokens, stream = false, onMessage, onComplete, onError } = options;
    
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }
      
      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];
      
      const tokenLimit = model.includes('gpt-4') ? 8000 : 4000; // 根据模型调整
      const optimizedHistory = this.optimizeHistory(history, tokenLimit);
      const allMessages = [...optimizedHistory, ...messages];
      
      // 使用OpenAI SDK
      if (stream) {
        const stream = await this.openai.chat.completions.create({
          model,
          messages: allMessages,
          temperature,
          max_tokens,
          stream: true
        });
        
        let fullResponse = '';
        for await (const part of stream) {
          const content = part.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onMessage?.(content);
          }
        }
        
        // 更新会话历史
        if (fullResponse) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content: fullResponse }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(fullResponse);
        return fullResponse;
      } else {
        const completion = await this.openai.chat.completions.create({
          model,
          messages: allMessages,
          temperature,
          max_tokens
        });
        
        const content = completion.choices[0].message.content || '';
        
        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }

  private optimizeHistory(messages: ChatMessage[], maxTokens = 4000): ChatMessage[] {
    // 如果消息数量少，直接返回
    if (messages.length <= 3) return messages;

    // 保留系统消息
    const systemMessages = messages.filter(m => m.role === 'system');
    
    // 获取非系统消息
    let conversationMessages = messages.filter(m => m.role !== 'system');
    
    // 估算当前token数量（简单估算：每4个字符约1个token）
    const estimateTokens = (msgs: ChatMessage[]): number => {
      return msgs.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    };
    
    // 如果预估token数量超过限制，开始裁剪历史
    let estimatedTokens = estimateTokens(conversationMessages);
    
    // 保留最新的消息，逐步移除较早的消息对
    while (estimatedTokens > maxTokens && conversationMessages.length > 2) {
      // 移除最早的一对对话（用户+助手）
      conversationMessages = conversationMessages.slice(2);
      estimatedTokens = estimateTokens(conversationMessages);
    }
    
    // 合并系统消息和优化后的对话
    return [...systemMessages, ...conversationMessages];
  }
}

// DIFY聊天实现
class DifyChat {
  private apiKey: string;
  private baseUrl: string;
  private conversationId = ''; // 添加会话ID存储
  
  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }
  
  // 设置会话ID
  setConversationId(id: string) {
    this.conversationId = id;
    return this;
  }
  
  // 获取当前会话ID
  getConversationId(): string {
    return this.conversationId;
  }

  async chat(options: ChatOptions) {
    const { messages, temperature = 0.7, stream = false, onMessage, onComplete, onError } = options;
    
    // 提取用户输入（最后一条用户消息）
    const userInput = messages.filter(m => m.role === 'user').pop()?.content || '';
    
    // 提取历史消息
    const history = messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content
    }));
    
    try {
      const requestBody: any = {
        inputs: {},
        query: userInput,
        response_mode: stream ? 'streaming' : 'blocking',
        user: 'user-id', // 可自定义
        temperature
      };
      
      // 如果有会话ID，添加到请求中
      if (this.conversationId) {
        requestBody.conversation_id = this.conversationId;
      }
      
      // 只在没有会话ID时添加历史消息
      if (!this.conversationId && history.length > 0) {
        requestBody.history = history;
      }
      
      const response = await fetch(`${this.baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (stream) {
        // 处理流式响应
        const reader = response.body?.getReader();
        let fullResponse = '';
        let metaDataProcessed = false;
        
        if (reader) {
          let isDone = false;
          while (!isDone) {
            const { done, value } = await reader.read();
            isDone = done;
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                
                // 保存会话ID (只需处理一次)
                if (!metaDataProcessed && json.conversation_id) {
                  this.conversationId = json.conversation_id;
                  metaDataProcessed = true;
                }
                
                if (json.event === 'message' && json.data) {
                  fullResponse += json.data.answer || '';
                  onMessage?.(json.data.answer || '');
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
          onComplete?.(fullResponse);
        }
      } else {
        const json = await response.json();
        
        // 保存会话ID
        if (json.conversation_id) {
          this.conversationId = json.conversation_id;
        }
        
        const content = json.answer || '';
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }
}

// GROQ聊天实现
class GroqChat {
  private apiKey: string;
  private groq: any; // Groq实例
  private conversationId = ''; // 添加会话ID存储
  private conversationHistory: Map<string, ChatMessage[]> = new Map(); // 存储不同会话的历史记录
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    // 初始化Groq客户端
    this.groq = new Groq({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  
  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }
  
  // 设置会话ID
  setConversationId(id: string) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }
  
  // 获取当前会话ID
  getConversationId(): string {
    return this.conversationId;
  }
  
  // 获取当前会话的历史记录
  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory.get(this.conversationId) || [];
  }

  async chat(options: ChatOptions) {
    const { model, messages, temperature = 0.7, max_tokens, stream = false, onMessage, onComplete, onError } = options;
    
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }
      
      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];
      
      const tokenLimit = model.includes('gpt-4') ? 8000 : 4000; // 根据模型调整
      const optimizedHistory = this.optimizeHistory(history, tokenLimit);
      const allMessages = [...optimizedHistory, ...messages];
      
      // 使用Groq SDK
      if (stream) {
        const stream = await this.groq.chat.completions.create({
          model,
          messages: allMessages,
          temperature,
          max_tokens,
          stream: true
        });
        
        let fullResponse = '';
        for await (const part of stream) {
          const content = part.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onMessage?.(content);
          }
        }
        
        // 更新会话历史
        if (fullResponse) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content: fullResponse }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(fullResponse);
        return fullResponse;
      } else {
        const completion = await this.groq.chat.completions.create({
          model,
          messages: allMessages,
          temperature,
          max_tokens
        });
        
        const content = completion.choices[0].message.content || '';
        
        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }

  private optimizeHistory(messages: ChatMessage[], maxTokens = 4000): ChatMessage[] {
    // 如果消息数量少，直接返回
    if (messages.length <= 3) return messages;

    // 保留系统消息
    const systemMessages = messages.filter(m => m.role === 'system');
    
    // 获取非系统消息
    let conversationMessages = messages.filter(m => m.role !== 'system');
    
    // 估算当前token数量（简单估算：每4个字符约1个token）
    const estimateTokens = (msgs: ChatMessage[]): number => {
      return msgs.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    };
    
    // 如果预估token数量超过限制，开始裁剪历史
    let estimatedTokens = estimateTokens(conversationMessages);
    
    // 保留最新的消息，逐步移除较早的消息对
    while (estimatedTokens > maxTokens && conversationMessages.length > 2) {
      // 移除最早的一对对话（用户+助手）
      conversationMessages = conversationMessages.slice(2);
      estimatedTokens = estimateTokens(conversationMessages);
    }
    
    // 合并系统消息和优化后的对话
    return [...systemMessages, ...conversationMessages];
  }
}

// Ollama聊天实现
class OllamaChat {
  private baseUrl;
  private conversationId = ''; // 移除了`: string`类型注解
  private conversationHistory: Map<string, ChatMessage[]> = new Map(); // 存储不同会话的历史记录
  
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }
  
  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }
  
  // 设置会话ID
  setConversationId(id: string) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }
  
  // 获取当前会话ID
  getConversationId(): string {
    return this.conversationId;
  }
  
  // 获取当前会话的历史记录
  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory.get(this.conversationId) || [];
  }
  
  async chat(options: ChatOptions) {
    const { model, messages, temperature = 0.7, stream = false, onMessage, onComplete, onError } = options;
    
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }
      
      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];
      
      // 合并历史记录和新消息，转换为Ollama的格式
      const allMessages = [...history, ...messages].map(m => ({
        role: m.role,
        content: m.content
      }));
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: allMessages,
          temperature,
          stream
        })
      });
      
      if (stream) {
        // 处理流式响应
        const reader = response.body?.getReader();
        let fullResponse = '';
        
        if (reader) {
          let isDone = false;
          while (!isDone) {
            const { done, value } = await reader.read();
            isDone = done;
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message && json.message.content) {
                  const content = json.message.content;
                  fullResponse += content;
                  onMessage?.(content);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
          
          // 更新会话历史
          if (fullResponse) {
            history.push(...messages); // 添加用户消息
            history.push({ role: 'assistant', content: fullResponse }); // 添加助手回复
            this.conversationHistory.set(this.conversationId, history);
          }
          
          onComplete?.(fullResponse);
        }
      } else {
        const json = await response.json();
        const content = json.message?.content || '';
        
        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }
}

// 导出所有实现
export {
  ChatMessage,
  ChatOptions,
  OpenAIChat,
  DifyChat,
  GroqChat,
  OllamaChat
};