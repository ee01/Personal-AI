/**
 * Snooze Manager - 稍后处理功能核心逻辑
 * 
 * 功能：
 * 1. 从消息 DOM 提取消息信息 (MessageInfo)
 * 2. 提供快速选项和时间格式化工具
 * 3. 创建定时提醒（通过 Bot 私聊提醒）
 * 
 * 此模块属于消息交互功能 (Message Reaction) 的一部分
 */

import { getIndexedDBData } from '../storage';
import { isScheduledMessagesInitialized, showInitRequiredDialog } from '../scheduled-messages/ScheduledMessagesUtils';

// 消息信息接口
export interface MessageInfo {
  id: string;           // 消息 ID
  groupId: string;      // 群组 ID
  groupName: string;    // 群组名称
  senderName: string;   // 发送者名称
  content: string;      // 消息内容（前 200 字符）
  timestamp: string;    // 消息时间
  messageLink: string;  // 消息直达链接
}

// Snooze 配置接口
export interface SnoozeConfig {
  messageInfo: MessageInfo;
  remindAt: Date;       // 提醒时间
  note?: string;        // 可选备注
}

// 快速选项
export interface QuickOption {
  label: string;
  icon: string;
  getTime: () => Date;
}

// 缓存
let personCache: Map<number, string> | null = null;
let groupCache: Map<number, { name: string; is_team: boolean }> | null = null;

/**
 * 初始化缓存
 */
async function initCache() {
  if (!personCache) {
    try {
      const persons = await getIndexedDBData('Glip', 'person');
      personCache = new Map();
      persons.forEach((person: any) => {
        personCache!.set(person.id, `${person.first_name} ${person.last_name}`.trim());
      });
    } catch (e) {
      console.error('Failed to load person cache:', e);
      personCache = new Map();
    }
  }
  
  if (!groupCache) {
    try {
      const groups = await getIndexedDBData('Glip', 'group');
      groupCache = new Map();
      groups.forEach((group: any) => {
        groupCache!.set(group.id, {
          name: group.set_abbreviation || 'Unknown',
          is_team: group.is_team
        });
      });
    } catch (e) {
      console.error('Failed to load group cache:', e);
      groupCache = new Map();
    }
  }
}

/**
 * 从 DOM 元素提取消息信息
 * 
 * 根据 RingCentral/Glip 的实际 DOM 结构：
 * - 消息卡片：div.conversation-card
 * - 消息 wrapper：.conversation-card-wrapper[data-id][groupid]
 * - 发送者名称：[data-name="name"]
 * - 消息内容：[data-name="text"]
 * - 时间：[data-name="time"]
 */
export async function extractMessageInfo(messageElement: HTMLElement): Promise<MessageInfo | null> {
  await initCache();
  
  try {
    // 找到 .conversation-card-wrapper 元素（包含 data-id 和 groupid）
    const wrapper = messageElement.classList.contains('conversation-card-wrapper')
      ? messageElement
      : messageElement.querySelector('.conversation-card-wrapper') ||
        messageElement.closest('.conversation-card-wrapper');
    
    // 从 wrapper 获取消息 ID 和群组 ID
    const postId = wrapper?.getAttribute('data-id') || 
                   messageElement.getAttribute('data-id') ||
                   messageElement.getAttribute('data-ally-id');
    
    // 从 wrapper 获取群组 ID，或从 URL 获取
    let groupId = wrapper?.getAttribute('groupid') || '';
    if (!groupId) {
      const urlMatch = window.location.href.match(/\/messages\/(\d+)/);
      groupId = urlMatch ? urlMatch[1] : '';
    }
    
    // 获取消息内容 - RingCentral 使用 [data-name="text"]
    const textElement = messageElement.querySelector('[data-name="text"]') ||
                       messageElement.querySelector('[data-name="body"]');
    let content = '';
    if (textElement) {
      // 克隆元素并移除 @ 提及的额外信息
      const clone = textElement.cloneNode(true) as HTMLElement;
      // 保留换行符和其他格式,只移除首尾空白
      content = clone.textContent || '';
      content = content.replace(/^\s+|\s+$/g, '');
    }
    
    // 如果还没找到内容，尝试其他选择器
    if (!content) {
      const bodyElement = messageElement.querySelector('.sc-jPbAGM, .sc-cnQiCv');
      if (bodyElement) {
        content = bodyElement.textContent || '';
        content = content.replace(/^\s+|\s+$/g, '');
      }
    }
    
    // 获取发送者 - RingCentral 使用 [data-name="name"]
    const nameElement = messageElement.querySelector('[data-name="name"]');
    let senderName = nameElement?.textContent?.trim() || '';
    
    // 如果从 DOM 找不到，尝试从缓存中查找（使用头像按钮的 data-uid）
    if (!senderName) {
      const avatarButton = messageElement.querySelector('[data-name="avatar"]');
      const uid = avatarButton?.getAttribute('data-uid');
      if (uid && personCache) {
        // uid 格式如 "GLIP_PERSON.20367368195"
        const personId = parseInt(uid.replace('GLIP_PERSON.', ''));
        senderName = personCache.get(personId) || '';
      }
    }
    
    // 获取群组名称
    let groupName = '';
    if (groupId && groupCache) {
      groupName = groupCache.get(parseInt(groupId))?.name || '';
    }
    if (!groupName) {
      // 尝试从页面标题获取（RingCentral 的对话标题）
      const titleElement = document.querySelector('[data-name="conversationTitle"]') ||
                          document.querySelector('.conversation-header [class*="title"]') ||
                          document.querySelector('[class*="TeamName"]');
      groupName = titleElement?.textContent?.trim() || '';
    }
    
    // 获取时间 - RingCentral 使用 [data-name="time"]
    const timeElement = messageElement.querySelector('[data-name="time"]');
    const timestamp = timeElement?.textContent?.trim() || new Date().toLocaleTimeString();
    
    // 构建消息链接
    const messageLink = postId && groupId 
      ? `https://app.ringcentral.com/l/messages/${groupId}/${postId}`
      : window.location.href;
    
    // 不再压缩空白字符,保留原始格式(包括换行符)
    // 只规范化连续的空格(但保留换行符)
    content = content.replace(/ {2,}/g, ' ');
    
    console.log('🔔 Snooze: 提取消息信息', {
      postId,
      groupId,
      senderName,
      content: content.substring(0, 50),
      messageLink
    });
    
    return {
      id: postId || `temp_${Date.now()}`,
      groupId,
      groupName: groupName || 'Unknown',
      senderName: senderName || 'Unknown',
      // 保留完整内容,不截断(移除 200 字符限制)
      content: content,
      timestamp,
      messageLink
    };
  } catch (error) {
    console.error('Failed to extract message info:', error);
    return null;
  }
}

/**
 * 获取快速选项列表
 */
export function getQuickOptions(): QuickOption[] {
  return [
    {
      label: '1 小时后',
      icon: '⏰',
      getTime: () => {
        const d = new Date();
        d.setHours(d.getHours() + 1);
        return d;
      }
    },
    {
      label: '3 小时后',
      icon: '🕐',
      getTime: () => {
        const d = new Date();
        d.setHours(d.getHours() + 3);
        return d;
      }
    },
    {
      label: '今天下班前',
      icon: '🌆',
      getTime: () => {
        const d = new Date();
        d.setHours(18, 0, 0, 0);
        // 如果已过 18 点，则设为第二天
        if (d <= new Date()) {
          d.setDate(d.getDate() + 1);
        }
        return d;
      }
    },
    {
      label: '明天 9 点',
      icon: '☀️',
      getTime: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      }
    },
    {
      label: '下周一 9 点',
      icon: '📅',
      getTime: () => {
        const d = new Date();
        const dayOfWeek = d.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
        d.setDate(d.getDate() + daysUntilMonday);
        d.setHours(9, 0, 0, 0);
        return d;
      }
    }
  ];
}

/**
 * 格式化提醒时间显示
 */
export function formatRemindTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  
  if (diffDays === 0) {
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} 分钟后 (${timeStr})`;
    }
    return `${diffHours} 小时后 (${timeStr})`;
  } else if (diffDays === 1) {
    return `明天 ${timeStr}`;
  } else if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${weekdays[date.getDay()]} ${timeStr}`;
  } else {
    return `${dateStr} ${timeStr}`;
  }
}

// isScheduledMessagesInitialized 和 showInitRequiredDialog 已移至 scheduled-messages/ScheduledMessagesUtils.ts 共用

/**
 * 创建 Snooze 提醒消息
 * 发送到 background script 处理
 */
export async function createSnoozeReminder(config: SnoozeConfig): Promise<boolean> {
  console.log('🔔 Snooze: 准备发送消息到 background...', config);
  
  // 前置检查：定时消息是否已初始化
  const initialized = await isScheduledMessagesInitialized();
  if (!initialized) {
    console.log('🔔 Snooze: 定时消息未初始化，显示提示对话框');
    await showInitRequiredDialog('稍后处理');
    return false;
  }
  
  try {
    // 序列化 Date 对象
    const serializedConfig = {
      messageInfo: config.messageInfo,
      remindAt: config.remindAt.toISOString(),
      note: config.note
    };
    
    console.log('🔔 Snooze: 发送数据', serializedConfig);
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_SNOOZE_REMINDER',
      data: serializedConfig
    });
    
    console.log('🔔 Snooze: 收到响应', response);
    
    if (response?.success) {
      return true;
    } else {
      console.error('🔔 Snooze: 创建失败', response?.error);
      return false;
    }
  } catch (error) {
    console.error('🔔 Snooze: 发送消息失败', error);
    return false;
  }
}

/**
 * 显示成功提示
 */
export function showSuccessToast(message: string) {
  const toast = document.createElement('div');
  toast.className = 'snooze-toast snooze-toast-success';
  toast.innerHTML = `
    <span class="snooze-toast-icon">✓</span>
    <span class="snooze-toast-message">${message}</span>
  `;
  document.body.appendChild(toast);
  
  // 动画显示
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  
  // 3 秒后移除
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * 显示错误提示
 */
export function showErrorToast(message: string) {
  const toast = document.createElement('div');
  toast.className = 'snooze-toast snooze-toast-error';
  toast.innerHTML = `
    <span class="snooze-toast-icon">✕</span>
    <span class="snooze-toast-message">${message}</span>
  `;
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

