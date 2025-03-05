import { ChromaClient, Collection } from 'chromadb';
import { getEmbeddingViaOffscreen } from './embeddings';

// 添加一个标志来控制是否初始化 Chroma
const ENABLE_CHROMA = process.env.ENABLE_CHROMA === 'true'; // 设置为 false 暂时禁用 Chroma

let chromaClient: ChromaClient | null = null;
let messageCollection: Collection | null = null;

// 获取嵌入向量
export async function getEmbedding(text: string): Promise<number[]> {
  if (!ENABLE_CHROMA) {
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
  if (!ENABLE_CHROMA) {
    console.log('Chroma 向量数据库已禁用');
    return false;
  }
  
  try {
    chromaClient = new ChromaClient({
      path: process.env.CHROMA_API_URL || 'http://localhost:8000'
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
  if (!ENABLE_CHROMA) {
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
  if (!ENABLE_CHROMA) {
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
      
      // 处理分类过滤
      if (filters.category) {
        conditions.push({ 
          category: { $in: filters.category } 
        });
      }
      
      // 处理实体过滤（人物、项目、话题）
      if (filters.entities) {
        // 人物过滤
        if (filters.entities.people && filters.entities.people.length > 0) {
          conditions.push({ 
            people: { $in: filters.entities.people } 
          });
        }
        
        // 项目过滤
        if (filters.entities.projects && filters.entities.projects.length > 0) {
          conditions.push({ 
            projects: { $in: filters.entities.projects } 
          });
        }
        
        // 话题过滤
        if (filters.entities.topics && filters.entities.topics.length > 0) {
          conditions.push({ 
            topics: { $in: filters.entities.topics } 
          });
        }
      }
      
      // 如果有多个条件，使用 $and 操作符
      if (conditions.length > 0) {
        if (conditions.length === 1) {
          queryParams.where = conditions[0];
        } else {
          queryParams.where = { $and: conditions };
        }
      }
    }
    
    // 执行查询
    console.log('naturalLanguageQuery queryParams', queryParams);
    const results = await messageCollection.query(queryParams);
    
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
  if (!ENABLE_CHROMA) {
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