// 新文件：实体识别和提取
import { handleLLMRequest } from './llm';

// 使用LLM提取消息中的实体
export async function extractEntities(content: string, options = {}) {
  try {
    // 构建 LLM 提示
    const prompt = `
    请分析以下消息，并提取出所有相关的实体信息：
    
    消息内容：
    ${content}
    
    请严格按照以下 JSON 格式提取实体信息：
    {
      "people": [], // 消息中提到的所有人物名称
      "projects": [], // 消息中提到的所有项目名称
      "topics": [], // 消息中讨论的所有话题
      "actions": [], // 消息中提到的所有行动项/任务
      "sentiment": "", // 整体情感(positive/negative/neutral)
      "category": [] // 消息类别，如"决策"、"讨论"、"公告"等
    }
    
    仅返回JSON，不要有其他内容。如果某类实体不存在，返回空数组。
    `;
    
    // 调用 LLM API 进行提取
    const [_, jsonData] = await handleLLMRequest({
      prompt,
      type: 'entity_extraction'
    });
    
    // 解析返回的 JSON 结果
    if (jsonData && jsonData.length > 0) {
      const entityData = jsonData[0];
      return {
        people: entityData.people || [],
        projects: entityData.projects || [],
        topics: entityData.topics || [],
        actions: entityData.actions || [],
        sentiment: entityData.sentiment || "neutral",
        category: entityData.category || []
      };
    }
    
    // 如果没有成功解析JSON，返回默认值
    return {
      people: [],
      projects: [],
      topics: [],
      actions: [],
      sentiment: "neutral",
      category: []
    };
  } catch (error) {
    console.error('实体提取失败:', error);
    return {
      people: [],
      projects: [],
      topics: [],
      actions: [],
      sentiment: "neutral",
      category: []
    };
  }
} 