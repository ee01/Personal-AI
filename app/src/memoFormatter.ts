/**
 * 随手记消息格式化器
 * 
 * 将 MemoItem 格式化为豆包可识别的结构化消息
 */

import type { MemoType, MemoItem } from './memoTypes.js';
import { MEMO_TYPE_NAMES, MEMO_TYPE_ICONS } from './memoTypes.js';

function formatTypeHeading(type: MemoType): string {
  const icon = MEMO_TYPE_ICONS[type];
  const typeName = MEMO_TYPE_NAMES[type];
  return icon ? `${icon} 【${typeName}】` : `【${typeName}】`;
}

function formatTypeSummary(type: MemoType, count: number): string {
  const icon = MEMO_TYPE_ICONS[type];
  const name = MEMO_TYPE_NAMES[type];
  return icon ? `${icon} ${name}: ${count} 条` : `${name}: ${count} 条`;
}

function formatTypeLabel(type: MemoType): string {
  const icon = MEMO_TYPE_ICONS[type];
  const name = MEMO_TYPE_NAMES[type];
  return icon ? `${icon} ${name}` : name;
}

/**
 * 格式化单个 MemoItem 为豆包消息
 */
export function formatMemoItem(item: MemoItem): string {
  const typeName = MEMO_TYPE_NAMES[item.type];
  
  const lines: string[] = [
    formatTypeHeading(item.type),
    '',
    `📌 ${item.title}`,
  ];
  
  // 添加内容（如果有且不同于标题）
  if (item.content && item.content !== item.title) {
    // 截取前 200 字符
    const shortContent = item.content.length > 200 
      ? item.content.slice(0, 200) + '...' 
      : item.content;
    lines.push(`📝 ${shortContent}`);
  }
  
  // 添加元数据
  if (item.metadata) {
    lines.push('');
    lines.push('---');
    
    if (item.metadata.dueDate) {
      lines.push(`⏰ 时间: ${item.metadata.dueDate}`);
    }
    
    if (item.metadata.location) {
      lines.push(`📍 位置: ${item.metadata.location}`);
    }
    
    if (item.metadata.category) {
      lines.push(`📁 分类: ${item.metadata.category}`);
    }
    
    if (item.metadata.importance) {
      const importanceIcon = {
        low: '🟢',
        medium: '🟡',
        high: '🔴',
      }[item.metadata.importance];
      lines.push(`${importanceIcon} 重要程度: ${item.metadata.importance}`);
    }
    
    if (item.metadata.tags && item.metadata.tags.length > 0) {
      lines.push(`🏷️ 标签: ${item.metadata.tags.join(', ')}`);
    }
    
    if (item.metadata.source) {
      lines.push(`📡 来源: ${item.metadata.source}`);
    }
  }
  
  // 添加类型提示
  lines.push('');
  lines.push(`_类型: ${typeName}_`);
  
  return lines.join('\n');
}

/**
 * 格式化多个 MemoItem 为批量消息
 */
export function formatMemoBatch(items: MemoItem[], title?: string): string {
  const header = title || `📦 随手记同步 (${items.length} 条)`;
  const lines: string[] = [header, ''];
  
  // 按类型分组
  const grouped = groupByType(items);
  
  // 统计信息
  const typeStats = Object.entries(grouped)
    .filter(([, groupItems]) => groupItems.length > 0)
    .map(([type, groupItems]) => formatTypeSummary(type as MemoType, groupItems.length));
  
  if (typeStats.length > 0) {
    lines.push('📊 类型分布:');
    lines.push(...typeStats.map((s) => `  ${s}`));
    lines.push('');
  }
  
  // 分隔线
  lines.push('---');
  lines.push('');
  
  // 逐条输出
  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    lines.push(formatMemoItem(items[i]));
  }
  
  // 添加提示
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_以上内容已同步到豆包随手记，可在手机端查看和管理。_');
  
  return lines.join('\n');
}

/**
 * 按类型分组
 */
export function groupByType(items: MemoItem[]): Partial<Record<MemoType, MemoItem[]>> {
  const grouped: Partial<Record<MemoType, MemoItem[]>> = {};
  
  for (const item of items) {
    if (!grouped[item.type]) {
      grouped[item.type] = [];
    }
    grouped[item.type]!.push(item);
  }
  
  return grouped;
}

/**
 * 格式化为紧凑列表（用于移动端简报）
 */
export function formatCompactMemoList(items: MemoItem[], maxItems = 10): string {
  const limited = items.slice(0, maxItems);
  const lines: string[] = ['📋 随手记概览:', ''];
  
  const grouped = groupByType(limited);
  
  for (const [type, groupItems] of Object.entries(grouped)) {
    if (!groupItems || groupItems.length === 0) continue;
    
    lines.push(formatTypeLabel(type as MemoType));
    for (const item of groupItems) {
      lines.push(`  • ${item.title}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * 格式化提醒事项为待办列表
 */
export function formatTodoList(items: MemoItem[]): string {
  const lines: string[] = ['待办事项', ''];
  
  const todos = items.filter((item) => item.type === 'todo' || item.type === 'important_date');
  
  for (let i = 0; i < todos.length; i++) {
    const item = todos[i];
    const due = item.metadata?.dueDate ? ` [${item.metadata.dueDate}]` : '';
    const importance = item.metadata?.importance === 'high' ? '🔴 ' : '';

    lines.push(`${i + 1}. ${importance}${item.title}${due}`.trimEnd());
  }
  
  if (todos.length === 0) {
    lines.push('_暂无待办事项_');
  }
  
  return lines.join('\n');
}

/**
 * 格式化购物清单
 */
export function formatShoppingList(items: MemoItem[]): string {
  const lines: string[] = ['🛒 购物清单:', ''];
  
  const shoppingItems = items.filter((item) => item.type === 'shopping');
  
  for (let i = 0; i < shoppingItems.length; i++) {
    lines.push(`☐ ${shoppingItems[i].title}`);
  }
  
  if (shoppingItems.length === 0) {
    lines.push('_暂无购物项目_');
  }
  
  return lines.join('\n');
}

/**
 * 格式化重要日子列表
 */
export function formatImportantDates(items: MemoItem[]): string {
  const lines: string[] = ['📅 重要日子:', ''];
  
  const dates = items.filter((item) => item.type === 'important_date');
  
  // 按日期排序
  dates.sort((a, b) => {
    const dateA = a.metadata?.dueDate || '';
    const dateB = b.metadata?.dueDate || '';
    return dateA.localeCompare(dateB);
  });
  
  for (const item of dates) {
    const date = item.metadata?.dueDate || '日期待定';
    lines.push(`• ${date}: ${item.title}`);
  }
  
  if (dates.length === 0) {
    lines.push('_暂无重要日子记录_');
  }
  
  return lines.join('\n');
}

function prependInstruction(instruction: string, content: string): string {
  return [instruction, '', content].join('\n');
}

/**
 * 智能选择格式化方式
 * 根据内容类型自动选择最合适的格式
 */
export function smartFormat(items: MemoItem[], context?: 'stable' | 'briefing' | 'reminder'): string {
  const emptyMessage =
    context === 'reminder' ? '_暂无待办需要记录到随手记_' : '_暂无内容需要存入随手记_';
  if (items.length === 0) {
    return context === 'briefing' ? '_暂无内容需要同步_' : emptyMessage;
  }

  const formatted =
    items.length === 1 && context !== 'reminder'
      ? formatMemoItem(items[0])
      : (() => {
          switch (context) {
            case 'stable':
              return formatMemoBatch(items, '📚 长期记忆同步');

            case 'briefing':
              return formatCompactMemoList(items);

            case 'reminder': {
              const todos = items.filter((i) => i.type === 'todo' || i.type === 'important_date');
              if (todos.length === items.length) {
                return formatTodoList(items);
              }
              return formatMemoBatch(items, '待办事项同步');
            }

            default:
              return formatMemoBatch(items);
          }
        })();

  switch (context) {
    case 'stable':
      return prependInstruction('请把以下信息存入随手记：', formatted);

    case 'briefing':
      return formatted;

    case 'reminder':
      return prependInstruction('请在随手记中记录以下待办事项，不要加已完成标记：', formatted);

    default:
      return prependInstruction('请把以下内容存入随手记：', formatted);
  }
}
