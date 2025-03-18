// 新文件：实体识别和提取
import { callLLMJsonAPI } from './llm';

// 使用LLM提取消息中的实体
export async function extractEntitiesToStore(content: string, metadata: any = {}) {
  try {
    const prompt = `
    请分析以下消息，提取所有相关的实体信息和关系：
    
    消息内容：
    ${content}
    ${metadata.sender ? `消息发送者：${metadata.sender}` : ''}
    ${metadata.team_name ? `消息所在群组：${metadata.team_name}` : ''}
    ${metadata.summary ? `根据上下文得到的总结：${metadata.summary}` : ''}

    请严格按照以下 JSON 格式提取实体信息：
    {
      "entities": {
        "people": [
          {
            "name": "",
            "role": "",  // 角色，如"员工"、"客户"等
            "mentioned_context": ""  // 在消息中提及的上下文
          }
        ],
        "time": [
          {
            "raw": "",  // 原始时间表述
            "normalized": "",  // 标准化时间
            "type": ""  // deadline/schedule/mentioned
          }
        ],
        "location": [
          {
            "name": "",
            "type": ""  // office/remote/physical
          }
        ],
        "projects": [
          {
            "name": "",
            "status": "",  // 进行中/已完成/计划中
            "related_people": []  // 相关人员
          }
        ],
        "topics": [
          {
            "name": "",
            "category": "",  // 技术/业务/管理等
            "keywords": []
          }
        ],
        "resources": [
          {
            "type": "",  // 文档/链接/工具等
            "name": "",
            "location": ""
          }
        ]
      },
      "metadata": {
        "sentiment": "",  // positive/negative/neutral
        "priority": "",   // high/medium/low
        "category": [],   // 消息类别：决策/讨论/公告等
        "tags": []       // 自动标签
      },
      "relationships": [
        {
          "source": "",      // 实体1
          "target": "",      // 实体2
          "relationship": "" // 关系类型
        }
      ],
      "actions": [
        {
          "type": "",        // task/decision/followup
          "description": "", 
          "assignee": "",
          "deadline": null,  // 时间戳
          "status": ""      // pending/completed
        }
      ]
    }
    
    仅返回JSON，不要有其他内容。如果某类实体不存在，返回空数组。
    `;
    
    const entityData = await callLLMJsonAPI({prompt, type: 'query'});
    console.log('提取出的实体信息：', entityData);
    
    if (typeof entityData === 'object') {
      return {
        entities: {
          people: entityData.entities?.people || [],
          time: entityData.entities?.time || [],
          location: entityData.entities?.location || [],
          projects: entityData.entities?.projects || [],
          topics: entityData.entities?.topics || [],
          resources: entityData.entities?.resources || []
        },
        metadata: {
          sentiment: entityData.metadata?.sentiment || "neutral",
          priority: entityData.metadata?.priority || "medium",
          category: entityData.metadata?.category || [],
          tags: entityData.metadata?.tags || []
        },
        relationships: entityData.relationships || [],
        actions: entityData.actions || []
      };
    }
    
    return {
      entities: {
        people: [],
        time: [],
        location: [],
        projects: [],
        topics: [],
        resources: []
      },
      metadata: {
        sentiment: "neutral",
        priority: "medium",
        category: [],
        tags: []
      },
      relationships: [],
      actions: []
    };
  } catch (error) {
    console.error('实体提取失败:', error);
    return {
      entities: {
        people: [],
        time: [],
        location: [],
        projects: [],
        topics: [],
        resources: []
      },
      metadata: {
        sentiment: "neutral",
        priority: "medium",
        category: [],
        tags: []
      },
      relationships: [],
      actions: []
    };
  }
}

export async function extractEntitiesForQuery(question: string) {
  try {
    const analysisPrompt = `
    分析以下问题，提取查询意图和关键实体。按JSON格式返回：
    
    问题: "${question}"
    
    {
      "query": {
        "intent": {
          "primary": "",     // search/analyze/summarize/compare
          "secondary": "",   // 具体查询类型，如project_status/person_info等
          "action_type": "" // retrieve/count/timeline/relationship
        },
        "filters": {
          "time_range": {
            "type": "recent|all|specific|range",
            "start": null,   // 时间戳
            "end": null,     // 时间戳
            "description": "" // 对时间范围的文字描述，如"今年"、"这个月"、"最近一周"等
          },
          "entities": {
            "people": [
              {
                "name": "",
                "role": "",
                "required": true  // 是否必须包含该人物
              }
            ],
            "projects": [
              {
                "name": "",
                "status": "",
                "required": true
              }
            ],
            "topics": [
              {
                "name": "",
                "category": "",
                "required": true
              }
            ],
            "location": [
              {
                "name": "",
                "type": "",
                "required": true
              }
            ]
          }
        },
        "output": {
          "format": "",     // list/timeline/summary/graph
          "fields": [],     // 需要返回的字段
          "sort": {
            "field": "",
            "order": "asc|desc"
          },
          "limit": null    // 结果数量限制
        }
      },
      "context": {
        "reference_time": null,  // 参考时间点
        "user_context": "",     // 用户查询上下文
        "priority": ""         // high/medium/low
      }
    }
    
    注意：
    1. time_range.type 必须是以下值之一：
       - "all"：表示所有时间，不指定则默认是 all
       - "recent"：仅表示最近几天，如"最近"、"近期"、"最近几天"
       - "specific"：表示具体时间点
       - "range"：表示时间范围
    2. 对于包含较长时间段的描述：
       - "这个月"、"本月"应设为range类型，而非recent
       - "今年"、"本年"应设为range类型，而非recent
       - "去年"、"上个月"等也应设为range类型
    3. 请在description字段中保留原始时间描述词，如"今年"、"这个月"等
    4. 所有时间戳必须是数字或null，不能是字符串
    5. 如果无法确定具体时间，相关时间字段设为null
    6. 时间疑问词表示查询事件发生时间，不是限制查询范围
    7. required 字段表示该实体是否为必需匹配项
    8. 重要：如果问题中没有明确的时间限定词（如"最近"、"今年"、"这个月"等），请将time_range.type设为"all"
    `;
    
    // 使用LLM分析问题
    const queryIntent = await callLLMJsonAPI({prompt: analysisPrompt, type: 'query'});
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
