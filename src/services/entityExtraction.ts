// 新文件：实体识别和提取
import { callLLMJsonAPI } from '../llm';
import { CAPABILITIES } from '../analytics/capabilities';
import { buildEntityExtractionPrompt, buildQueryIntentAnalysisPrompt } from '../prompts';

// 使用LLM提取消息中的实体
// 该格式与MemoryEntity的relatedData结构保持一致
export async function extractEntitiesFromMessage(content: string, metadata: any = {}) {
  try {
    const prompt = buildEntityExtractionPrompt({
      content,
      sender: metadata.sender,
      teamName: metadata.team_name,
      summary: metadata.summary
    });
    
    const entityData = await callLLMJsonAPI({
      prompt,
      type: 'query',
      capability: CAPABILITIES.MEMORY_CAPTURE,
      feature: 'entity_extraction',
    });
    console.log('提取出的实体信息：', entityData);
    
    if (typeof entityData === 'object') {
      return {
        entities: {
          people: entityData.entities?.people || [],
          projects: entityData.entities?.projects || [],
          topics: entityData.entities?.topics || [],
          resources: entityData.entities?.resources || [],
          webpages: entityData.entities?.webpages || [],
          jiraTickets: entityData.entities?.jiraTickets || [],
          conversations: entityData.entities?.conversations || []
        },
        metadata: {
          sentiment: entityData.metadata?.sentiment || "neutral",
          priority: entityData.metadata?.priority || "medium",
          category: entityData.metadata?.category || [],
          tags: entityData.metadata?.tags || []
        },
        actions: entityData.actions || []
      };
    }
    
    return {
      entities: {
        people: [],
        projects: [],
        topics: [],
        resources: [],
        webpages: [],
        jiraTickets: [],
        conversations: []
      },
      metadata: {
        sentiment: "neutral",
        priority: "medium",
        category: [],
        tags: []
      },
      actions: [],
    };
  } catch (error) {
    console.error('实体提取失败:', error);
    return {
      entities: {
        people: [],
        projects: [],
        topics: [],
        resources: [],
        webpages: [],
        jiraTickets: [],
        conversations: []
      },
      metadata: {
        sentiment: "neutral",
        priority: "medium",
        category: [],
        tags: []
      },
      actions: [],
    };
  }
}

export async function extractEntitiesForQuery(question: string) {
  try {
    const analysisPrompt = buildQueryIntentAnalysisPrompt(question);
    
    // 使用LLM分析问题
    const queryIntent = await callLLMJsonAPI({
      prompt: analysisPrompt,
      type: 'query',
      capability: CAPABILITIES.MEMORY_CAPTURE,
      feature: 'query_intent',
    });
    return queryIntent;
  } catch (error) {
    console.error('查询意图分析失败:', error);
    return {
      query: {
        intent: {
          primary: "search",
          secondary: "general",
          action_type: "retrieve"
        },
        filters: {
          time_range: {
            type: "all",
            start: null,
            end: null,
            description: ""
          },
          entities: {
            people: [],
            projects: [],
            topics: [],
            location: []
          }
        },
        output: {
          format: "list",
          fields: [],
          sort: {
            field: "",
            order: "desc"
          },
          limit: 10
        }
      },
      context: {
        reference_time: null,
        user_context: "",
        priority: "medium"
      }
    };
  }
}
