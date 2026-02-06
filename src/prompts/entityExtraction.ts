/**
 * 实体提取相关的 Prompt 模板
 * 
 * 用于从消息中提取结构化的实体信息、查询意图分析等
 */

/**
 * 构建消息实体提取 Prompt
 * 从消息内容中提取人物、项目、主题、资源等实体
 */
export function buildEntityExtractionPrompt(params: {
    content: string;
    sender?: string;
    teamName?: string;
    summary?: string;
}): string {
    const { content, sender, teamName, summary } = params;
    
    return `
请分析以下消息，提取所有相关的实体信息和关系：

消息内容：
${content}
${sender ? `消息发送者：${sender}` : ''}
${teamName ? `消息所在群组：${teamName}` : ''}
${summary ? `根据上下文得到的总结：${summary}` : ''}

请严格按照以下 JSON 格式提取实体信息：
{
  "entities": {
    "people": [
      {
        "name": "",
        "role": "", // 如果不知道可以留空
        "team": "", // 如果不知道可以留空
        "expertise": [], // 如果不知道可以留空
        "lastContact": null,
        "relevanceScore": 0.8
      }
    ],
    "projects": [
      {
        "name": "",
        "description": "",
        "status": "", // 如果不知道可以留空
        "relevanceScore": 0.8
      }
    ],
    "topics": [
      {
        "name": "",
        "summary": "",
        "category": "",
        "relevanceScore": 0.8
      }
    ],
    "resources": [ // 如果找到 wiki, docs, slides 等资源对应的 URL, 提取相关资源信息
      {
        "name": "",
        "summary": "",
        "type": "",
        "url": "wiki|docs|slides|...",
        "relevanceScore": 0.8
      }
    ],
    "webpages": [ // 如果找到非以上资源的其他网页，提取相关网页信息
      {
        "title": "",
        "summary": "",
        "url": "",
        "relevanceScore": 0.8
      }
    ],
    "jiraTickets": [
      {
        "key": "",
        "summary": "",
        "status": "",
        "assignee": "",
        "priority": "",
        "relevanceScore": 0.8
      }
    ]
  },
  "metadata": {
    "sentiment": "",
    "priority": "",
    "category": [],
    "tags": []
  },
  "actions": [
    {
      "type": "",
      "description": "",
      "assignee": "",
      "deadline": null,
      "status": ""
    }
  ]
}

仅返回JSON，不要有其他内容。如果某类实体不存在，返回空数组。
注意：relevanceScore应该在0-1之间，表示与当前消息的相关性。
`.trim();
}

/**
 * 构建查询意图分析 Prompt
 * 分析用户查询问题，提取查询意图和关键实体
 */
export function buildQueryIntentAnalysisPrompt(question: string): string {
    return `
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
`.trim();
}
