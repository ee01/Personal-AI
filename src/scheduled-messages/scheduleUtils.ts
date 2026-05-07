/**
 * Schedule 解析工具函数
 * 共享的纯解析逻辑，可被多个 content scripts 和 services 使用
 * 不依赖 Chrome APIs，保证在任何上下文中都能正常工作
 */

import {
  formatLocalScheduleDate,
  getTodayLocalScheduleDate,
} from './scheduleDateTime';

/**
 * Schedule 配置接口
 */
export interface ScheduleConfig {
  scheduleDate?: string;       // YYYY-MM-DD
  scheduleTime?: string;       // HH:mm
  repeatEvery: number;
  repeatUnit: 'Day' | 'Week' | 'Month';
  daysOfWeek?: number[];       // Jira 格式：1=周日, 2=周一, ..., 7=周六
  executionMode: 'nosearch' | 'jql' | 'other';
  needsWebhookConversion: boolean;
  triggerType?: string;        // 原始 trigger 类型
}

/**
 * Cron 解析结果
 */
export interface CronParseResult {
  time: string;                // HH:mm（本地时间 UTC+8）
  repeatEvery: number;
  repeatUnit: 'Day' | 'Week' | 'Month';
  daysOfWeek?: number[];       // Jira 格式
}

/**
 * 解析星期配置
 * 支持格式：1-5, 1,3,5, MON-FRI, MON,WED,FRI
 * @returns Jira 格式的数字数组：1=周日, 2=周一, ..., 7=周六
 */
export function parseDaysOfWeek(dayOfWeek: string): number[] {
  const dayMap: Record<string, number> = {
    'SUN': 1, 'MON': 2, 'TUE': 3, 'WED': 4, 'THU': 5, 'FRI': 6, 'SAT': 7,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7
  };
  
  const result: number[] = [];
  const segments = dayOfWeek.split(',');
  
  for (const segment of segments) {
    const trimmed = segment.trim().toUpperCase();
    
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-');
      const startNum = dayMap[start.trim()] || parseInt(start.trim(), 10);
      const endNum = dayMap[end.trim()] || parseInt(end.trim(), 10);
      
      if (!isNaN(startNum) && !isNaN(endNum)) {
        for (let i = startNum; i <= endNum; i++) {
          if (!result.includes(i)) result.push(i);
        }
      }
    } else {
      const num = dayMap[trimmed] || parseInt(trimmed, 10);
      if (!isNaN(num) && !result.includes(num)) {
        result.push(num);
      }
    }
  }
  
  return result.sort((a, b) => a - b);
}

/**
 * 计算下一个调度日期
 */
export function getNextScheduleDate(
  hours: number,
  minutes: number,
  repeatUnit: string,
  daysOfWeek?: number[]
): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  
  if (repeatUnit === 'Week' && daysOfWeek && daysOfWeek.length > 0) {
    // Jira 的周日是 1，JavaScript Date.getDay() 的周日是 0
    const currentJiraDay = now.getDay() + 1;
    
    for (let offset = 0; offset < 7; offset++) {
      const checkDay = ((currentJiraDay - 1 + offset) % 7) + 1;
      if (daysOfWeek.includes(checkDay)) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + offset);
        
        // 如果是今天但时间已过，继续找下一天
        if (offset === 0 && now > today) {
          continue;
        }
        
        return formatLocalScheduleDate(targetDate);
      }
    }
  }
  
  // 默认：如果今天时间已过，用明天
  if (now > today) {
    today.setDate(today.getDate() + 1);
  }
  
  return formatLocalScheduleDate(today);
}

/**
 * 解析 Cron 表达式获取调度配置
 * Jira CRON 格式: 秒 分 时 日 月 周
 * 注意：Jira 使用 UTC 时间，会自动转换为本地时间 (UTC+8)
 */
export function parseCronExpression(cron: string): CronParseResult | null {
  if (!cron) return null;
  
  const parts = cron.split(' ');
  if (parts.length < 6) return null;
  
  const [_seconds, minutes, hours, dayOfMonth, _month, dayOfWeek] = parts;
  
  // 解析时间（Jira CRON 使用 UTC 时间，需要转换为本地时间 UTC+8）
  const timeMinutes = parseInt(minutes, 10) || 0;
  const utcHours = parseInt(hours, 10) || 0;
  const localHours = (utcHours + 8) % 24;  // UTC -> 本地时间 (UTC+8)
  const time = `${String(localHours).padStart(2, '0')}:${String(timeMinutes).padStart(2, '0')}`;
  
  let repeatEvery = 1;
  let repeatUnit: 'Day' | 'Week' | 'Month' = 'Day';
  let daysOfWeek: number[] | undefined;
  
  // 检查是否是每周特定几天
  if (dayOfWeek !== '*' && dayOfWeek !== '?') {
    daysOfWeek = parseDaysOfWeek(dayOfWeek);
    if (daysOfWeek && daysOfWeek.length > 0) {
      repeatUnit = 'Week';
    }
  }
  
  // 检查是否是每 N 天
  if (dayOfMonth !== '*' && dayOfMonth !== '?') {
    const dayMatch = dayOfMonth.match(/^\*\/(\d+)$/);
    if (dayMatch) {
      repeatEvery = parseInt(dayMatch[1], 10);
      repeatUnit = 'Day';
    } else if (/^\d+$/.test(dayOfMonth)) {
      repeatUnit = 'Month';
    }
  }
  
  return { time, repeatEvery, repeatUnit, daysOfWeek };
}

/**
 * 为 FIXED 模式计算默认的调度日期
 * 规则：使用今天的日期作为起始点
 * @param repeatUnit - 重复单位
 * @returns YYYY-MM-DD 格式的日期字符串
 */
export function getDefaultScheduleDateForFixed(): string {
  // 对于所有 FIXED 模式，默认使用今天的日期
  // 用户可以在导入后通过管理界面调整
  return getTodayLocalScheduleDate();
}

/**
 * 解析 FIXED 模式配置
 * @param schedule - trigger.value.schedule 对象
 * @returns 解析后的重复配置
 */
export function parseFixedRateConfig(schedule: any): { repeatEvery: number; repeatUnit: 'Day' | 'Week' | 'Month' } {
  // rateInterval 单位是分钟
  // 60 = 1小时, 86400 = 1天, 604800 = 1周, 2592000 = 1个月
  let repeatUnit: 'Day' | 'Week' | 'Month' = 'Day';
  let repeatEvery = schedule?.rate || 1;
  const rateInterval = schedule?.rateInterval || 86400;
  
  if (rateInterval < 86400) {
    // 小于1天的间隔（Hour、Minute），统一为"每天"
    repeatUnit = 'Day';
    repeatEvery = 1;
  } else if (rateInterval === 604800) {
    repeatUnit = 'Week';
  } else if (rateInterval === 2592000) {
    repeatUnit = 'Month';
  }
  
  return { repeatEvery, repeatUnit };
}

/**
 * 分析 Jira Automation Rule 的 trigger，返回用于 Scheduled Messages 的配置
 * 
 * 支持三种情况：
 * 1. scheduled + nosearch - 完整导入调度信息，可以托管
 * 2. scheduled + jql - 仅展示调度信息，不可托管
 * 3. 其他类型 - 仅作为引用
 * 
 * @param trigger - Jira Rule 的 trigger 对象
 * @param scheduleDate - 可选的日期（用于 FIXED 模式，从 audit log 获取）
 * @returns ScheduleConfig 对象
 */
export function analyzeTriggerForScheduledMessages(
  trigger: any,
  scheduleDate?: string
): ScheduleConfig {
  const isScheduledTrigger = trigger?.type === 'jira.jql.scheduled';
  const executionMode = trigger?.value?.executionMode;
  const schedule = trigger?.value?.schedule;
  
  // 情况一：scheduled + nosearch - 完整导入，可以托管
  if (isScheduledTrigger && executionMode === 'nosearch') {
    if (schedule?.method === 'CRON') {
      const cronConfig = parseCronExpression(schedule.cronExpression);
      if (cronConfig) {
        const [hours, minutes] = cronConfig.time.split(':').map(Number);
        return {
          scheduleDate: getNextScheduleDate(hours, minutes, cronConfig.repeatUnit, cronConfig.daysOfWeek),
          scheduleTime: cronConfig.time,
          repeatEvery: cronConfig.repeatEvery,
          repeatUnit: cronConfig.repeatUnit,
          daysOfWeek: cronConfig.daysOfWeek,
          executionMode: 'nosearch',
          needsWebhookConversion: true,
          triggerType: trigger.type
        };
      }
    } else if (schedule?.method === 'FIXED') {
      const { repeatEvery, repeatUnit } = parseFixedRateConfig(schedule);
      // FIXED 模式：优先使用外部传入日期，否则使用默认计算的日期
      const defaultScheduleDate = getDefaultScheduleDateForFixed();
      return {
        scheduleDate: scheduleDate || defaultScheduleDate,
        repeatEvery,
        repeatUnit,
        executionMode: 'nosearch',
        needsWebhookConversion: true,
        triggerType: trigger.type
      };
    }
  }
  
  // 情况二：scheduled + jql - 仅展示，不可托管
  if (isScheduledTrigger && executionMode === 'jql') {
    if (schedule?.method === 'CRON') {
      const cronConfig = parseCronExpression(schedule.cronExpression);
      if (cronConfig) {
        const [hours, minutes] = cronConfig.time.split(':').map(Number);
        return {
          scheduleDate: getNextScheduleDate(hours, minutes, cronConfig.repeatUnit, cronConfig.daysOfWeek),
          scheduleTime: cronConfig.time,
          repeatEvery: cronConfig.repeatEvery,
          repeatUnit: cronConfig.repeatUnit,
          daysOfWeek: cronConfig.daysOfWeek,
          executionMode: 'jql',
          needsWebhookConversion: false,
          triggerType: trigger.type
        };
      }
    } else if (schedule?.method === 'FIXED') {
      const { repeatEvery, repeatUnit } = parseFixedRateConfig(schedule);
      // FIXED 模式：优先使用外部传入日期，否则使用默认计算的日期
      const defaultScheduleDate = getDefaultScheduleDateForFixed();
      return {
        scheduleDate: scheduleDate || defaultScheduleDate,
        repeatEvery,
        repeatUnit,
        executionMode: 'jql',
        needsWebhookConversion: false,
        triggerType: trigger.type
      };
    }
  }
  
  // 情况三：其他类型（包括 incoming webhook）- 仅作为引用
  return {
    repeatEvery: 1,
    repeatUnit: 'Day',
    executionMode: 'other',
    needsWebhookConversion: false,
    triggerType: trigger?.type
  };
}

/**
 * 将 Jira 格式的星期 (1-7) 转换为 JS 格式 (0-6)
 * Jira: 1=周日, 2=周一, ..., 7=周六
 * JS: 0=周日, 1=周一, ..., 6=周六
 */
export function jiraDaysToJsDays(jiraDays: number[]): number[] {
  return jiraDays.map(d => (d - 1) % 7).sort((a, b) => a - b);
}

/**
 * 格式化星期显示（用于 UI 展示）
 * @param daysOfWeek Jira 格式的星期数组 (1=周日, 2=周一...7=周六)
 */
export function formatDaysOfWeekDisplay(daysOfWeek: number[] | undefined): string {
  if (!daysOfWeek || daysOfWeek.length === 0) return '';
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // 转换 Jira 格式 (1-7) 到 JS 格式 (0-6)
  const jsDays = jiraDaysToJsDays(daysOfWeek);
  
  // 检查是否是工作日 (1,2,3,4,5 in JS = Mon-Fri)
  if (jsDays.length === 5 && 
      jsDays[0] === 1 && jsDays[1] === 2 && jsDays[2] === 3 && 
      jsDays[3] === 4 && jsDays[4] === 5) {
    return '工作日 (Mon-Fri)';
  }
  
  // 检查是否是周末 (0,6 in JS = Sun, Sat)
  if (jsDays.length === 2 && jsDays[0] === 0 && jsDays[1] === 6) {
    return '周末 (Sat, Sun)';
  }
  
  // 其他情况，显示具体星期
  return jsDays.map(d => dayNames[d]).join(', ');
}

/**
 * 根据 ScheduleConfig 构建 Scheduled Messages 的 messageData 中的调度字段
 * @param scheduleConfig - 解析后的调度配置
 * @returns 需要添加到 messageData 的调度字段对象
 */
export function buildScheduleMessageFields(scheduleConfig: ScheduleConfig): Record<string, any> {
  const fields: Record<string, any> = {};
  
  if (scheduleConfig.scheduleDate) {
    fields.Schedule_Date = scheduleConfig.scheduleDate;
  }
  
  if (scheduleConfig.scheduleTime) {
    fields.Schedule_Time = scheduleConfig.scheduleTime;
  }
  
  fields.Repeat_Every = scheduleConfig.repeatEvery;
  fields.Repeat_Unit = scheduleConfig.repeatUnit;
  
  // 如果有多星期配置，转换 Jira 格式 (1-7) 到 JS 格式 (0-6) 并保存
  if (scheduleConfig.daysOfWeek && scheduleConfig.daysOfWeek.length > 0) {
    const jsDays = jiraDaysToJsDays(scheduleConfig.daysOfWeek);
    fields.Repeat_Days = jsDays.join(',');
  }
  
  return fields;
}
