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
    
    let username = '';
    try {
      const { userinfo } = await chrome.storage.local.get('userinfo');
      username = userinfo.username || (userinfo.userEmail ? userinfo.userEmail.trim().split('@')[0] : userinfo.fullName.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''));
      if (!username) throw new Error('username is empty');
    } catch (error) {
      envConfig.CHROMA_COLLECTION_NAME = 'messages'
    }
    const collectionName = envConfig.CHROMA_COLLECTION_NAME || username + '-messages';
    const collectionNames = collections.map(c => c.name);
    if (!collectionNames.includes(collectionName)) {
      messageCollection = await chromaClient.createCollection({
        name: collectionName,
        metadata: { description: "存储与关注项匹配的消息", "hnsw:space": "cosine" },
        embeddingFunction
      });
    } else {
      messageCollection = await chromaClient.getCollection({
        name: collectionName,
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
    sender: string,                // 消息来源（发送者）
    datetime: number,             // 时间戳
    matchedRules: string[],        // 匹配到的规则
    summary: string,               // 消息摘要
    replyAdvice: string,          // 回复建议
    teamName?: string,             // 群组/团队名称
    teamId?: string,               // 群组/团队ID
    entities?: {                   // 实体识别结果
      people?: Array<{
        name: string,
        role?: string,
        mentioned_context?: string
      }>,
      time?: Array<{
        raw: string,
        normalized: string,
        type: string
      }>,
      location?: Array<{
        name: string,
        type: string
      }>,
      projects?: Array<{
        name: string,
        status?: string,
        related_people?: string[]
      }>,
      topics?: Array<{
        name: string,
        category?: string,
        keywords?: string[]
      }>,
      resources?: Array<{
        type: string,
        name: string,
        location?: string
      }>
    },
    metadata?: {
      sentiment?: string,         // positive/negative/neutral
      priority?: string,          // high/medium/low
      category?: string[],        // 消息类别
      tags?: string[]            // 自动标签
    },
    relationships?: Array<{
      source: string,
      target: string,
      relationship: string
    }>,
    actions?: Array<{
      type: string,
      description: string,
      assignee?: string,
      deadline?: number,
      status?: string
    }>
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
    const simplifiedMetadata: Record<string, string | number | boolean> = {
      source: metadata.source,
      timestamp: metadata.timestamp,
      matchedRules: JSON.stringify(metadata.matchedRules),
      summary: metadata.summary,
      details: content,
    };
    
    if (metadata.teamName) simplifiedMetadata.teamName = metadata.teamName;
    if (metadata.teamId) simplifiedMetadata.teamId = metadata.teamId;
    
    // 处理实体数据
    if (metadata.entities) {
      // 存储完整的实体数据
      simplifiedMetadata.entities = JSON.stringify(metadata.entities);
      
      // 为了便于搜索，单独存储实体名称列表
      if (metadata.entities.people) {
        simplifiedMetadata.people = JSON.stringify(metadata.entities.people.map(p => p.name));
      }
      if (metadata.entities.projects) {
        simplifiedMetadata.projects = JSON.stringify(metadata.entities.projects.map(p => p.name));
      }
      if (metadata.entities.topics) {
        simplifiedMetadata.topics = JSON.stringify(metadata.entities.topics.map(t => t.name));
      }
      if (metadata.entities.location) {
        simplifiedMetadata.locations = JSON.stringify(metadata.entities.location.map(l => l.name));
      }
    }
    
    // 处理元数据
    if (metadata.metadata) {
      if (metadata.metadata.sentiment) simplifiedMetadata.sentiment = metadata.metadata.sentiment;
      if (metadata.metadata.priority) simplifiedMetadata.priority = metadata.metadata.priority;
      if (metadata.metadata.category) simplifiedMetadata.category = JSON.stringify(metadata.metadata.category);
      if (metadata.metadata.tags) simplifiedMetadata.tags = JSON.stringify(metadata.metadata.tags);
    }
    
    // 处理关系数据
    if (metadata.relationships) {
      simplifiedMetadata.relationships = JSON.stringify(metadata.relationships);
    }
    
    // 处理行动项
    if (metadata.actions) {
      simplifiedMetadata.actions = JSON.stringify(metadata.actions);
    }
    
    // 生成搜索标签
    const allTags = new Set<string>();
    
    // 添加所有实体名称到标签
    if (metadata.entities) {
      if (metadata.entities.people) {
        metadata.entities.people.forEach(p => allTags.add(p.name));
      }
      if (metadata.entities.projects) {
        metadata.entities.projects.forEach(p => allTags.add(p.name));
      }
      if (metadata.entities.topics) {
        metadata.entities.topics.forEach(t => allTags.add(t.name));
      }
      if (metadata.entities.location) {
        metadata.entities.location.forEach(l => allTags.add(l.name));
      }
    }
    
    // 添加分类和标签
    if (metadata.metadata?.category) {
      metadata.metadata.category.forEach(c => allTags.add(c));
    }
    if (metadata.metadata?.tags) {
      metadata.metadata.tags.forEach(t => allTags.add(t));
    }
    
    // 更新搜索标签
    simplifiedMetadata.searchTags = JSON.stringify(Array.from(allTags));
    
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
    `, "${escapedValue}", `,                 // 数组中间 ..., "value", ...
    `"${escapedValue}"`,                     // 直接包含的值 "value"
  ];
  
  // 处理可能的空格变化
  patterns.push(`[ "${escapedValue}" ]`);    // 带空格的数组 [ "value" ]
  patterns.push(`[ "${escapedValue}"]`);     // 混合空格样式 [ "value"]
  patterns.push(`["${escapedValue}" ]`);     // 混合空格样式 ["value" ]
  
  // 处理不同的引号格式（单引号）
  patterns.push(`['${escapedValue}']`);      // 单引号格式 ['value']
  patterns.push(`'${escapedValue}'`);        // 单引号直接值 'value'
  
  // 处理值本身包含的部分（用于子字符串搜索）
  if (escapedValue.includes(' ')) {
    // 如果值中包含空格，则提取关键部分
    const parts = escapedValue.split(' ');
    for (const part of parts) {
      if (part.length > 2) {  // 只处理有意义的部分
        patterns.push(`"${part}"`);          // 匹配部分关键词 "keyword"
        patterns.push(`'${part}'`);          // 单引号格式 'keyword'
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
  
  // 处理两种可能情况：
  // 1. 字段存储为JSON字符串数组  
  // 2. 字段直接存储为普通字符串（没有JSON格式化）
  return { 
    "$or": [
      { [field]: { $in: allPatterns } },
      // 直接搜索原始值（针对可能未格式化为JSON的字段）
      ...values.map(value => ({ [field]: value }))
    ] 
  };
}

// 修改：通用自然语言查询接口，添加 filters 参数
export async function naturalLanguageQuery(
    userQuestion: string,
    filters?: {
      source?: string,              // 按发送者过滤
      teamName?: string,            // 按团队名称过滤
      entities?: {                  // 按实体过滤
        people?: Array<{
          name: string,
          role?: string,
          required?: boolean
        }>,
        projects?: Array<{
          name: string,
          status?: string,
          required?: boolean
        }>,
        topics?: Array<{
          name: string,
          category?: string,
          required?: boolean
        }>,
        location?: Array<{
          name: string,
          type?: string,
          required?: boolean
        }>
      },
      time_range?: {
        type: "recent" | "all" | "specific" | "range",
        start?: number,
        end?: number
      },
      metadata?: {
        sentiment?: string,         // positive/negative/neutral
        priority?: string,          // high/medium/low
        category?: string[],        // 消息类别
        tags?: string[]            // 标签
      }
    },
    output?: {
      format?: string,             // list/timeline/summary/graph
      fields?: string[],           // 需要返回的字段
      sort?: {
        field: string,
        order: "asc" | "desc"
      },
      limit?: number
    }
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
    
    const queryEmbedding = await getEmbedding(userQuestion);
    
    const queryParams: any = {
      queryEmbeddings: [queryEmbedding],
      nResults: output?.limit || 20
    };
    
    if (filters && Object.keys(filters).length > 0) {
      const conditions = [];
      
      // 处理基础过滤条件
      if (filters.source) {
        conditions.push({ source: filters.source });
      }
      if (filters.teamName) {
        conditions.push({ teamName: filters.teamName });
      }
      
      // 处理时间范围过滤
      if (filters.time_range) {
        const { type, start, end } = filters.time_range;
        
        // 对于"all"类型，不添加时间过滤
        if (type === "all") {
          console.log(`时间范围类型为"all"，不应用时间过滤`);
        }
        // 如果具有明确的start和end时间
        else if (start && end) {
          // 修复：Chroma不支持多个操作符在同一个对象中的写法
          conditions.push({ "$and": [
            { timestamp: { "$gte": start } },
            { timestamp: { "$lte": end } }
          ]});
          console.log(`应用时间范围过滤: ${new Date(start).toISOString()} 到 ${new Date(end).toISOString()}`);
        } 
        // 如果只有start时间（从某时刻到现在）
        else if (start && !end) {
          conditions.push({ timestamp: { "$gte": start } });
          console.log(`应用时间范围过滤: ${new Date(start).toISOString()} 到现在`);
        }
        // 如果只有end时间（到某个时刻为止）
        else if (!start && end) {
          conditions.push({ timestamp: { "$lte": end } });
          console.log(`应用时间范围过滤: 从最早到 ${new Date(end).toISOString()}`);
        }
        // 如果是特定时间
        else if (type === "specific" && start) {
          // 为特定时间点添加一天的范围，以确保能捕获到该天的所有消息
          const nextDay = start + (24 * 60 * 60 * 1000);
          // 修复：Chroma不支持多个操作符在同一个对象中的写法
          conditions.push({ "$and": [
            { timestamp: { "$gte": start } },
            { timestamp: { "$lte": nextDay } }
          ]});
          console.log(`应用特定时间过滤: ${new Date(start).toISOString()}`);
        }
        // 对于recent类型（如果走到这里，说明没有设置start和end）
        else if (type === "recent") {
          const now = new Date();
          const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
          conditions.push({ "$and": [
            { timestamp: { "$gte": sevenDaysAgo } },
            { timestamp: { "$lte": now.getTime() } }
          ]});
          console.log(`应用最近时间范围过滤(7天): ${new Date(sevenDaysAgo).toISOString()} 到 ${new Date().toISOString()}`);
        }
      }
      
      // 处理实体过滤
      if (filters.entities) {
        // 处理人物过滤
        if (filters.entities.people?.length) {
          const peopleNames = filters.entities.people.map(p => p.name);
          
          // 增强人名匹配：同时检查 people 字段和 source 字段
          const peopleCondition = {
            "$or": [
              createJsonPatternFilters('people', peopleNames),
              // 同时检查source字段（发送者）
              ...peopleNames.map(name => ({ source: name }))
            ]
          };
          
          conditions.push(peopleCondition);
        }
        
        // 处理项目过滤
        if (filters.entities.projects?.length) {
          const projectNames = filters.entities.projects.map(p => p.name);
          conditions.push(createJsonPatternFilters('projects', projectNames));
        }
        
        // 处理话题过滤
        if (filters.entities.topics?.length) {
          const topicNames = filters.entities.topics.map(t => t.name);
          conditions.push(createJsonPatternFilters('topics', topicNames));
        }
        
        // 处理位置过滤
        if (filters.entities.location?.length) {
          const locationNames = filters.entities.location.map(l => l.name);
          conditions.push(createJsonPatternFilters('locations', locationNames));
        }
      }
      
      // 处理元数据过滤
      if (filters.metadata) {
        if (filters.metadata.sentiment) {
          conditions.push({ sentiment: filters.metadata.sentiment });
        }
        if (filters.metadata.priority) {
          conditions.push({ priority: filters.metadata.priority });
        }
        if (filters.metadata.category?.length) {
          conditions.push(createJsonPatternFilters('category', filters.metadata.category));
        }
        if (filters.metadata.tags?.length) {
          conditions.push(createJsonPatternFilters('searchTags', filters.metadata.tags));
        }
      }
      
      // 合并所有条件
      if (conditions.length > 0) {
        if (conditions.length === 1) {
          queryParams.where = logQueryConditions(conditions[0]);
        } else {
          queryParams.where = logQueryConditions({ $and: conditions });
        }
      }
    }
    
    // 执行查询
    console.log(userQuestion, ' - queryParams', queryParams);
    let results = await messageCollection.query(queryParams);
    
    // 记录结果
    console.log(`查询结果: 找到 ${results.ids[0]?.length || 0} 条匹配记录`);
    if (results.ids[0]?.length > 0) {
      console.log('第一条记录预览:', {
        id: results.ids[0][0],
        document: results.documents[0][0].substring(0, 100) + '...',
        metadata: results.metadatas[0][0]
      });
    } else {
      console.log('没有找到匹配记录，检查是否因为查询条件过于严格');
      // 尝试仅通过向量相似度查询
      console.log('尝试仅使用向量相似度查询，不添加过滤条件');
      try {
        results = await messageCollection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: output?.limit || 20
        });
        console.log(`向量相似度查询结果: 找到 ${results.ids[0]?.length || 0} 条匹配记录`);
        if (results.ids[0]?.length > 0 && filters.entities.people?.length) {
          const simpleNames = filters.entities.people.map(p => p.name);
          // 找出匹配的索引位置
          const matchedIndices = results.metadatas[0].map((meta: any, index: number) => {
            const source = meta.source?.toString().toLowerCase() || '';
            return simpleNames.some(name => source.includes(name.toLowerCase())) ? index : -1;
          }).filter(i => i !== -1);

          // 根据匹配的索引过滤所有结果
          results.ids[0] = matchedIndices.map(i => results.ids[0][i]);
          results.metadatas[0] = matchedIndices.map(i => results.metadatas[0][i]);
          results.documents[0] = matchedIndices.map(i => results.documents[0][i]);
          results.distances[0] = matchedIndices.map(i => results.distances[0][i]);
          console.log(`其中有 ${matchedIndices.length} 条与 ${simpleNames.join(', ')} 相关的消息`);
        }
      } catch (error) {
        console.error('简单向量查询也失败了:', error);
      }
    }
    
    // 返回查询结果
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