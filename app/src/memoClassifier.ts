/**
 * 随手记类型分类器
 * 
 * 根据消息内容智能判断应该使用哪种随手记类型
 */

import type { MemoType, MemoItem, MemoTypePattern } from './memoTypes.js';
import { MEMO_TYPE_PATTERNS, MEMO_TYPE_NAMES } from './memoTypes.js';

export interface ClassificationResult {
  type: MemoType;
  confidence: number; // 0-1
  matchedPatterns: string[];
}

/**
 * 分类单条消息
 */
export function classifyMessage(text: string): ClassificationResult {
  const normalizedText = text.trim().toLowerCase();
  
  // 收集所有匹配的模式
  const matches: Array<{ pattern: MemoTypePattern; matched: string[] }> = [];
  
  for (const pattern of MEMO_TYPE_PATTERNS) {
    const matched: string[] = [];
    
    // 检查关键词
    for (const keyword of pattern.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        matched.push(`keyword:${keyword}`);
      }
    }
    
    // 检查正则模式
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        matched.push(`pattern:${regex.source.slice(0, 30)}`);
      }
    }
    
    if (matched.length > 0) {
      matches.push({ pattern, matched });
    }
  }
  
  // 按优先级排序，选择最匹配的类型
  if (matches.length === 0) {
    return {
      type: 'note',
      confidence: 0.5,
      matchedPatterns: [],
    };
  }
  
  // 排序：优先级高的优先，相同优先级看匹配数量
  matches.sort((a, b) => {
    if (a.pattern.priority !== b.pattern.priority) {
      return b.pattern.priority - a.pattern.priority;
    }
    return b.matched.length - a.matched.length;
  });
  
  const best = matches[0];
  const totalPatterns = best.pattern.patterns.length + best.pattern.keywords.length;
  const confidence = Math.min(0.95, 0.6 + (best.matched.length / totalPatterns) * 0.35);
  
  return {
    type: best.pattern.type,
    confidence,
    matchedPatterns: best.matched,
  };
}

/**
 * 从文本中提取结构化信息
 */
export function extractMemoContent(text: string, type: MemoType): Partial<MemoItem['metadata']> {
  const metadata: Partial<MemoItem['metadata']> = {};
  
  switch (type) {
    case 'parking': {
      // 尝试提取车位号/楼层
      const parkingMatch = text.match(/[Bb]?(\d)[层楼]?\s*[-]?\s*([A-Za-z0-9]+)/);
      if (parkingMatch) {
        metadata.location = parkingMatch[0];
      }
      break;
    }
    
    case 'important_date': {
      // 尝试提取日期
      const dateMatch = text.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})[日号]?/);
      if (dateMatch) {
        metadata.dueDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
      // 也尝试简单日期格式
      const simpleDateMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
      if (simpleDateMatch && !metadata.dueDate) {
        const year = new Date().getFullYear();
        metadata.dueDate = `${year}-${simpleDateMatch[1].padStart(2, '0')}-${simpleDateMatch[2].padStart(2, '0')}`;
      }
      break;
    }
    
    case 'shopping': {
      // 尝试提取购物项目
      metadata.category = '日常购物';
      break;
    }
    
    case 'card': {
      // 标记重要性
      metadata.importance = 'high';
      break;
    }
    
    case 'number': {
      // 尝试提取数字类型
      if (/手机|电话|phone/i.test(text)) {
        metadata.tags = ['phone'];
      } else if (/密码|password/i.test(text)) {
        metadata.tags = ['password'];
        metadata.importance = 'high';
      } else if (/验证码/i.test(text)) {
        metadata.tags = ['verification'];
      }
      break;
    }
    
    case 'health': {
      metadata.tags = ['健康'];
      break;
    }
    
    case 'where': {
      // 尝试提取物品和位置
      const whereMatch = text.match(/(.+)[放在在]([^。！？]+)/);
      if (whereMatch) {
        metadata.tags = [whereMatch[1].trim()];
        metadata.location = whereMatch[2].trim();
      }
      break;
    }
  }
  
  return metadata;
}

/**
 * 将 ProviderMemoryProduct 转换为 MemoItem 数组
 */
export function convertToMemoItems(items: Array<{ title: string; body: string }>): MemoItem[] {
  return items.map((item) => {
    const fullText = `${item.title}\n${item.body}`;
    const classification = classifyMessage(fullText);
    const metadata = extractMemoContent(fullText, classification.type);
    
    return {
      type: classification.type,
      title: item.title,
      content: item.body,
      metadata: {
        ...metadata,
        source: 'memory_service',
      },
    };
  });
}

/**
 * 将 Reminder 转换为 MemoItem
 */
export function convertRemindersToMemoItems(
  reminders: Array<{ title: string; dueAt?: string; note?: string; severity?: 'low' | 'medium' | 'high' }>,
): MemoItem[] {
  return reminders.map((reminder) => {
    const metadata: Partial<MemoItem['metadata']> = {
      importance: reminder.severity || 'medium',
    };
    
    if (reminder.dueAt) {
      metadata.dueDate = reminder.dueAt;
    }
    
    if (reminder.note) {
      metadata.tags = [reminder.note];
    }
    
    return {
      type: 'todo',
      title: reminder.title,
      content: reminder.note || reminder.title,
      metadata,
    };
  });
}

/**
 * 批量分类消息
 */
export function classifyBatch(texts: string[]): Array<ClassificationResult & { text: string }> {
  return texts.map((text) => ({
    text,
    ...classifyMessage(text),
  }));
}

/**
 * 获取类型统计
 */
export function getTypeDistribution(items: MemoItem[]): Record<MemoType, number> {
  const distribution: Record<MemoType, number> = {
    todo: 0,
    shopping: 0,
    parking: 0,
    where: 0,
    important_date: 0,
    quote: 0,
    address: 0,
    card: 0,
    number: 0,
    health: 0,
    note: 0,
  };
  
  for (const item of items) {
    distribution[item.type]++;
  }
  
  return distribution;
}
