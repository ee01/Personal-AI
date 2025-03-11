import { ChromaClient, Collection } from 'chromadb';
import { getEmbeddingViaOffscreen } from './embeddings';
import { getEnvConfig } from './utils';

let chromaClient: ChromaClient | null = null;
let messageCollection: Collection | null = null;

// 获取嵌入向量
export async function getEmbedding(text: string): Promise<number[]> {
  const envConfig = await getEnvConfig();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('嵌入模型已禁用，返回空向量');
    return new Array(384).fill(0);
  }
  
  try {
    // 使用离屏文档获取嵌入向量
    return await getEmbeddingViaOffscreen(text);
  } catch (error) {
    console.error('获取嵌入向量失败:', error);
    return new Array(384).fill(0);
  }
}

// 初始化 Chroma 客户端
export async function initChromaClient() {
  const envConfig = await getEnvConfig();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用');
    return false;
  }
  
  try {
    chromaClient = new ChromaClient({
      path: envConfig.CHROMA_API_URL || 'http://localhost:8000'
    });
    
    console.log('正在连接向量数据库...');
    const collections = await chromaClient.listCollections();
    console.log('可用集合:', collections);
    
    // 创建一个空的 embeddingFunction，因为我们使用自定义的 getEmbedding 函数
    const embeddingFunction = {
      generate: async (texts: string[]) => {
        // 这个函数不会被调用，因为我们在添加文档前手动生成嵌入
        return new Array(texts.length).fill(new Array(1536).fill(0));
      }
    };
    
    if (!collections.includes('messages')) {
      messageCollection = await chromaClient.createCollection({
        name: 'messages',
        metadata: { description: "存储与关注项匹配的消息" },
        embeddingFunction
      });
    } else {
      messageCollection = await chromaClient.getCollection({
        name: 'messages',
        embeddingFunction
      });
    }
    
    console.log('向量数据库集合已初始化', messageCollection);
    return true;
  } catch (error) {
    console.error('初始化 Chroma 客户端失败:', error);
    return false;
  }
}

// 存储消息到向量数据库
export async function storeMessage(
  messageId: string, 
  content: string, 
  metadata: {
    source: string,                // 消息来源（发送者）
    timestamp: number,             // 时间戳
    matchedRules: string[],        // 匹配到的规则
    summary: string,               // 消息摘要
    reply_advice: string,          // 回复建议
    teamName?: string,             // 群组/团队名称
    teamId?: string,               // 群组/团队ID
    entities?: {                   // 实体识别结果
      people?: string[],           // 消息中提到的人物
      projects?: string[],         // 消息中提到的项目
      topics?: string[],           // 消息中提到的话题
      actions?: string[]           // 消息中提到的行动项
    },
    sentiment?: string,            // 情感分析结果（正面/负面/中性）
    category?: string[]            // 消息分类（如"决策"、"讨论"、"公告"等）
  }
) {
  const envConfig = await getEnvConfig();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，消息未存储');
    return false;
  }
  
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }
    
    const embedding = await getEmbedding(content);
    
    // 简化元数据，确保它与 Chroma 兼容
    // Chroma 只支持字符串、数字或布尔值作为元数据值
    const simplifiedMetadata: Record<string, string | number | boolean> = {
      source: metadata.source,
      timestamp: metadata.timestamp,
      matchedRules: JSON.stringify(metadata.matchedRules),
      summary: metadata.summary,
      // 添加详细信息字段，用于展示详情
      details: content,
      // 添加标签字段，用于展示标签
      tags: JSON.stringify(metadata.category || []),
    };
    
    if (metadata.teamName) simplifiedMetadata.teamName = metadata.teamName;
    if (metadata.teamId) simplifiedMetadata.teamId = metadata.teamId;
    
    // 将复杂对象序列化为字符串
    if (metadata.entities) {
      if (metadata.entities.people) simplifiedMetadata.people = JSON.stringify(metadata.entities.people);
      if (metadata.entities.projects) simplifiedMetadata.projects = JSON.stringify(metadata.entities.projects);
      if (metadata.entities.topics) simplifiedMetadata.topics = JSON.stringify(metadata.entities.topics);
      if (metadata.entities.actions) simplifiedMetadata.actions = JSON.stringify(metadata.entities.actions);
      
      // 将实体添加到标签中
      const allTags = [];
      if (metadata.category) allTags.push(...metadata.category);
      if (metadata.entities.people) allTags.push(...metadata.entities.people);
      if (metadata.entities.projects) allTags.push(...metadata.entities.projects);
      if (metadata.entities.topics) allTags.push(...metadata.entities.topics);
      
      // 更新标签字段
      simplifiedMetadata.tags = JSON.stringify(allTags);
    }
    
    if (metadata.sentiment) simplifiedMetadata.sentiment = metadata.sentiment;
    
    await messageCollection.add({
      ids: [messageId],
      embeddings: [embedding],
      documents: [content],
      metadatas: [simplifiedMetadata]
    });
    
    console.log(`消息 ${messageId} 已存储到向量数据库`);
    return true;
  } catch (error) {
    console.error('存储消息到向量数据库失败:', error);
    return false;
  }
}

// 辅助函数：记录查询条件
function logQueryConditions(where: any) {
  console.log('完整查询条件:', JSON.stringify(where, null, 2));
  return where;
}

// 辅助函数：生成可能的 JSON 字符串模式
function generatePossibleJsonPatterns(value: string): string[] {
  // 转义特殊字符，防止 JSON 注入
  const escapedValue = value.replace(/"/g, '\\"');
  
  // 基本模式，适用于单值数组和多值数组
  const patterns = [
    `["${escapedValue}"]`,                   // 精确匹配单个值 ["value"]
    `["${escapedValue}", `,                  // 数组开头 ["value", ...
    `, "${escapedValue}"]`,                  // 数组结尾 ..., "value"]
    `, "${escapedValue}", `                  // 数组中间 ..., "value", ...
  ];
  
  // 处理可能的空格变化
  patterns.push(`[ "${escapedValue}" ]`);    // 带空格的数组 [ "value" ]
  
  // 处理不同的引号格式（单引号）
  patterns.push(`['${escapedValue}']`);      // 单引号格式 ['value']
  
  // 处理值本身包含的部分（用于子字符串搜索）
  if (escapedValue.includes(' ')) {
    // 如果值中包含空格，则提取关键部分
    const parts = escapedValue.split(' ');
    for (const part of parts) {
      if (part.length > 2) {  // 只处理有意义的部分
        patterns.push(`"${part}"`);          // 匹配部分关键词 "keyword"
      }
    }
  }
  
  return patterns;
}

// 使用 $in 进行字符串模式匹配的更高级方法
function createJsonPatternFilters(field: string, values: string[]): any {
  // 对每个值，生成可能的 JSON 模式
  const allPatterns: string[] = [];
  for (const value of values) {
    allPatterns.push(...generatePossibleJsonPatterns(value));
  }
  
  // 将这些模式用 $in 操作符组合起来
  return { [field]: { $in: allPatterns } };
}

// 修改：通用自然语言查询接口，添加 filters 参数
export async function naturalLanguageQuery(
    userQuestion: string,
    filters?: {
      source?: string,              // 按发送者过滤
      teamName?: string,            // 按团队名称过滤
      entities?: {                  // 按实体过滤
        people?: string[],          // 人物
        projects?: string[],        // 项目
        topics?: string[]           // 话题
      },
      startTime?: number,           // 开始时间
      endTime?: number,             // 结束时间
      sentiment?: string,           // 情感
      category?: string[]           // 分类
    },
    limit = 20
  ) {
  const envConfig = await getEnvConfig();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，无法执行自然语言查询');
    return {
      question: userQuestion,
      results: {
        ids: [],
        documents: [],
        metadatas: [],
        distances: []
      }
    };
  }
  
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }
    
    // 1. 首先使用向量相似度查找相关消息
    const queryEmbedding = await getEmbedding(userQuestion);
    
    // 构建查询参数
    const queryParams: any = {
      queryEmbeddings: [queryEmbedding],
      nResults: limit
    };
    
    // 如果提供了过滤条件，添加到查询参数中
    if (filters && Object.keys(filters).length > 0) {
      const conditions = [];
      
      // 处理来源过滤
      if (filters.source) {
        conditions.push({ source: filters.source });
      }
      
      // 处理团队名称过滤
      if (filters.teamName) {
        conditions.push({ teamName: filters.teamName });
      }
      
      // 处理时间范围过滤
      if (filters.startTime && filters.endTime) {
        conditions.push({ timestamp: { $gte: filters.startTime, $lte: filters.endTime } });
      } else if (filters.startTime) {
        conditions.push({ timestamp: { $gte: filters.startTime } });
      } else if (filters.endTime) {
        conditions.push({ timestamp: { $lte: filters.endTime } });
      }
      
      // 处理情感过滤
      if (filters.sentiment) {
        conditions.push({ sentiment: filters.sentiment });
      }
      
      // 处理实体过滤（人物、项目、话题）
      if (filters.entities) {
        // 人物过滤
        if (filters.entities.people && filters.entities.people.length > 0) {
          // 使用 $in 进行 JSON 模式匹配
          conditions.push(createJsonPatternFilters('people', filters.entities.people));
        }
        
        // 项目过滤
        if (filters.entities.projects && filters.entities.projects.length > 0) {
          // 使用 $in 进行 JSON 模式匹配
          conditions.push(createJsonPatternFilters('projects', filters.entities.projects));
        }
        
        // 话题过滤
        if (filters.entities.topics && filters.entities.topics.length > 0) {
          // 使用 $in 进行 JSON 模式匹配
          conditions.push(createJsonPatternFilters('topics', filters.entities.topics));
        }
      }
      
      // 处理分类过滤
      if (filters.category && filters.category.length > 0) {
        // 使用 $in 进行 JSON 模式匹配
        conditions.push(createJsonPatternFilters('category', filters.category));
      }
      
      // 如果有多个条件，使用 $and 操作符
      if (conditions.length > 0) {
        if (conditions.length === 1) {
          queryParams.where = logQueryConditions(conditions[0]);
        } else {
          queryParams.where = logQueryConditions({ $and: conditions });
        }
      }
    }
    
    // 执行查询
    console.log('naturalLanguageQuery queryParams', queryParams);
    const results = await messageCollection.query(queryParams);
    
    // 记录结果
    console.log(`查询结果: 找到 ${results.ids[0]?.length || 0} 条匹配记录`);
    if (results.ids[0]?.length > 0) {
      console.log('第一条记录预览:', {
        id: results.ids[0][0],
        document: results.documents[0][0].substring(0, 100) + '...',
        metadata: results.metadatas[0][0]
      });
    }
    
    // 3. 返回查询结果和元数据
    return {
      question: userQuestion,
      results: {
        ids: results.ids[0] || [],
        documents: results.documents[0] || [],
        metadatas: results.metadatas[0] || [],
        distances: results.distances[0] || []
      }
    };
  } catch (error) {
    console.error('自然语言查询失败:', error);
    return null;
  }
}

// 获取所有已知的人名
export async function getAllKnownPeople() {
  const envConfig = await getEnvConfig();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，无法获取已知人名');
    return [];
  }
  
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }
    
    // 获取所有消息的元数据
    const allMessages = await messageCollection.get();
    
    // 提取所有来源（发送者）
    const sources = new Set<string>();
    if (allMessages && allMessages.metadatas) {
      allMessages.metadatas.forEach((metadata: any) => {
        if (metadata.source) {
          sources.add(String(metadata.source));
        }
      });
    }
    
    // 提取所有提到的人物
    const mentionedPeople = new Set<string>();
    if (allMessages && allMessages.metadatas) {
      allMessages.metadatas.forEach((metadata: any) => {
        if (metadata.people) {
          try {
            const people = JSON.parse(String(metadata.people));
            if (Array.isArray(people)) {
              people.forEach(person => mentionedPeople.add(person));
            }
          } catch (e) {
            console.error('解析人物数据失败:', e);
          }
        }
      });
    }
    
    // 合并所有人名
    return Array.from(new Set([...Array.from(sources), ...Array.from(mentionedPeople)]));
  } catch (error) {
    console.error('获取已知人名失败:', error);
    return [];
  }
}

// 模糊匹配人名
export function fuzzyMatchPerson(partialName: string, knownPeople: string[]): string | null {
  if (!partialName || !knownPeople || knownPeople.length === 0) {
    return null;
  }
  
  // 转换为小写进行比较
  const lowerPartialName = partialName.toLowerCase();
  
  // 1. 精确匹配（忽略大小写）
  const exactMatch = knownPeople.find(person => 
    person.toLowerCase() === lowerPartialName
  );
  if (exactMatch) return exactMatch;
  
  // 2. 开头匹配（例如 "Nelson" 匹配 "Nelson Wu"）
  const startsWithMatch = knownPeople.find(person => 
    person.toLowerCase().startsWith(lowerPartialName)
  );
  if (startsWithMatch) return startsWithMatch;
  
  // 3. 包含匹配（例如 "Wu" 匹配 "Nelson Wu"）
  const containsMatch = knownPeople.find(person => 
    person.toLowerCase().includes(lowerPartialName)
  );
  if (containsMatch) return containsMatch;
  
  // 4. 分词匹配（例如 "nelson" 匹配 "Nelson Wu"）
  const wordMatch = knownPeople.find(person => {
    const words = person.toLowerCase().split(/\s+/);
    return words.some(word => word === lowerPartialName);
  });
  if (wordMatch) return wordMatch;
  
  // 5. 首字母匹配（例如 "NW" 匹配 "Nelson Wu"）
  if (lowerPartialName.length >= 2) {
    const initialsMatch = knownPeople.find(person => {
      const initials = person.split(/\s+/).map(word => word[0]?.toLowerCase()).join('');
      return initials === lowerPartialName;
    });
    if (initialsMatch) return initialsMatch;
  }
  
  // 没有找到匹配
  return null;
}

// 获取所有已知的项目
export async function getAllKnownProjects() {
  const envConfig = await getEnvConfig();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，无法获取已知项目');
    return [];
  }
  
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }
    
    // 获取所有消息的元数据
    const allMessages = await messageCollection.get();
    
    // 提取所有项目
    const projects = new Set<string>();
    if (allMessages && allMessages.metadatas) {
      allMessages.metadatas.forEach((metadata: any) => {
        if (metadata.projects) {
          try {
            const projectsList = JSON.parse(String(metadata.projects));
            if (Array.isArray(projectsList)) {
              projectsList.forEach(project => projects.add(project));
            }
          } catch (e) {
            console.error('解析项目数据失败:', e);
          }
        }
      });
    }
    
    return Array.from(projects);
  } catch (error) {
    console.error('获取已知项目失败:', error);
    return [];
  }
}

// 获取所有已知的主题
export async function getAllKnownTopics() {
  const envConfig = await getEnvConfig();
  if (!envConfig.ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用，无法获取已知主题');
    return [];
  }
  
  try {
    if (!messageCollection) {
      await initChromaClient();
    }
    
    if (!messageCollection) {
      throw new Error('向量数据库集合未初始化');
    }
    
    // 获取所有消息的元数据
    const allMessages = await messageCollection.get();
    
    // 提取所有主题
    const topics = new Set<string>();
    if (allMessages && allMessages.metadatas) {
      allMessages.metadatas.forEach((metadata: any) => {
        if (metadata.topics) {
          try {
            const topicsList = JSON.parse(String(metadata.topics));
            if (Array.isArray(topicsList)) {
              topicsList.forEach(topic => topics.add(topic));
            }
          } catch (e) {
            console.error('解析主题数据失败:', e);
          }
        }
      });
    }
    
    return Array.from(topics);
  } catch (error) {
    console.error('获取已知主题失败:', error);
    return [];
  }
}

// 模糊匹配项目或主题
export function fuzzyMatchEntityName(partialName: string, knownNames: string[]): string[] {
  if (!partialName || !knownNames || knownNames.length === 0) {
    return [];
  }
  
  // 转换为小写进行比较
  const lowerPartialName = partialName.toLowerCase();
  const matches: string[] = [];
  
  // 1. 精确匹配（忽略大小写）
  const exactMatches = knownNames.filter(name => 
    name.toLowerCase() === lowerPartialName
  );
  matches.push(...exactMatches);
  
  // 如果找到精确匹配，直接返回
  if (matches.length > 0) return matches;
  
  // 2. 开头匹配（例如 "AI note" 匹配 "AI note 相关的规划进度"）
  const startsWithMatches = knownNames.filter(name => 
    name.toLowerCase().startsWith(lowerPartialName)
  );
  matches.push(...startsWithMatches);
  
  // 3. 包含匹配（例如 "note" 匹配 "AI note 相关的规划进度"）
  const containsMatches = knownNames.filter(name => 
    name.toLowerCase().includes(lowerPartialName) && 
    !matches.includes(name)  // 避免重复
  );
  matches.push(...containsMatches);
  
  // 4. 词语匹配（例如 "AI" 和 "note" 都匹配 "AI note 相关的规划进度"）
  const words = lowerPartialName.split(/\s+/);
  if (words.length > 1) {
    const wordMatches = knownNames.filter(name => {
      const nameWords = name.toLowerCase().split(/\s+/);
      return words.every(word => nameWords.some(nameWord => nameWord.includes(word))) &&
        !matches.includes(name);  // 避免重复
    });
    matches.push(...wordMatches);
  }
  
  return matches;
} 