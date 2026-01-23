/**
 * 通用日志服务
 * 支持多种日志类别，统一存储到 localStorage
 * 
 * 使用方法：
 *   import { Logger } from './utils/logger';
 *   
 *   // 获取或创建日志实例
 *   const authLogger = Logger.get('auth', { maxLogs: 20 });
 *   authLogger.log('slide.getAuthToken', { interactive: true, success: true });
 *   
 *   // 或使用快捷方法
 *   Logger.auth('slide.getAuthToken', true, true);
 *   Logger.upgrade('2.1.0', true, '升级成功');
 *   Logger.analysis('message_analysis', { count: 5, duration: 1200 });
 */

export type LogCategory = 'auth' | 'upgrade' | 'analysis' | 'task' | 'error' | 'lifecycle';
export type StorageLocation = 'localStorage' | 'chrome.storage.local'; // 预留参数

export interface LogEntry {
  timestamp: string;
  location: string;
  success: boolean;
  message?: string;
  data?: Record<string, any>;
  stack?: string;
}

export interface LoggerOptions {
  maxLogs?: number;
  storage?: StorageLocation;
  includeStack?: boolean;
}

// 默认配置
const DEFAULT_OPTIONS: Required<LoggerOptions> = {
  maxLogs: 20,
  storage: 'localStorage',
  includeStack: false,
};

// 类别默认配置
const CATEGORY_DEFAULTS: Record<LogCategory, Partial<LoggerOptions>> = {
  auth: { maxLogs: 20, includeStack: true },
  upgrade: { maxLogs: 50 },
  analysis: { maxLogs: 100 },
  task: { maxLogs: 50 },
  error: { maxLogs: 100, includeStack: true },
  lifecycle: { maxLogs: 30 },
};

// 日志实例缓存
const loggerInstances: Map<LogCategory, Logger> = new Map();

export class Logger {
  private category: LogCategory;
  private storageKey: string;
  private options: Required<LoggerOptions>;

  constructor(category: LogCategory, options: LoggerOptions = {}) {
    this.category = category;
    this.storageKey = `personal_ai_logs_${category}`;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...CATEGORY_DEFAULTS[category],
      ...options,
    };
  }

  /**
   * 获取或创建日志实例
   */
  static get(category: LogCategory, options?: LoggerOptions): Logger {
    if (!loggerInstances.has(category)) {
      loggerInstances.set(category, new Logger(category, options));
    }
    return loggerInstances.get(category)!;
  }

  /**
   * 记录日志
   */
  async log(
    location: string,
    success: boolean,
    message?: string,
    data?: Record<string, any>,
    includeStack?: boolean
  ): Promise<void> {
    try {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        location,
        success,
        message,
        data,
      };

      // 获取调用栈
      if (includeStack ?? this.options.includeStack) {
        const stack = new Error().stack;
        if (stack) {
          const lines = stack.split('\n');
          entry.stack = lines.slice(3, 8).join('\n');
        }
      }

      // 获取现有日志
      const logs = await this.getLogs();

      // 添加新日志到开头
      logs.unshift(entry);

      // 保留最大数量
      if (logs.length > this.options.maxLogs) {
        logs.splice(this.options.maxLogs);
      }

      // 保存
      await this.saveLogs(logs);

      // 控制台输出
      this.consoleLog(entry);
    } catch (e) {
      console.error(`[Logger.${this.category}] 记录日志失败:`, e);
    }
  }

  /**
   * 获取所有日志
   */
  async getLogs(): Promise<LogEntry[]> {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || [];
    } catch {
      return [];
    }
  }

  /**
   * 保存日志
   */
  private async saveLogs(logs: LogEntry[]): Promise<void> {
    try {
      await chrome.storage.local.set({ [this.storageKey]: logs });
    } catch (e) {
      console.error(`[Logger.${this.category}] 保存日志失败:`, e);
    }
  }

  /**
   * 清空日志
   */
  async clear(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.storageKey);
      console.log(`✅ [Logger.${this.category}] 日志已清空`);
    } catch (e) {
      console.error(`[Logger.${this.category}] 清空日志失败:`, e);
    }
  }

  /**
   * 格式化输出到控制台
   */
  private consoleLog(entry: LogEntry): void {
    const emoji = entry.success ? '✅' : '❌';
    const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN');
    const msg = entry.message ? ` - ${entry.message}` : '';
    console.log(`${emoji} [${this.category}] ${time} ${entry.location}${msg}`);
    if (entry.data) {
      console.log(`   📊`, entry.data);
    }
  }

  /**
   * 打印所有日志
   */
  async print(): Promise<void> {
    const logs = await this.getLogs();
    if (logs.length === 0) {
      console.log(`📋 [${this.category}] 暂无日志`);
      return;
    }

    console.log(`📋 [${this.category}] 日志（共 ${logs.length} 条）：\n`);
    logs.forEach((log, i) => {
      const emoji = log.success ? '✅' : '❌';
      const time = new Date(log.timestamp).toLocaleString('zh-CN');
      console.log(`${i + 1}. ${emoji} [${time}] ${log.location}`);
      if (log.message) console.log(`   消息: ${log.message}`);
      if (log.data) console.log(`   数据:`, log.data);
      if (log.stack) console.log(`   调用栈:\n${log.stack}`);
      console.log('');
    });
  }

  /**
   * 导出为文本
   */
  async export(): Promise<string> {
    const logs = await this.getLogs();
    if (logs.length === 0) return `[${this.category}] 暂无日志`;

    let text = `[${this.category}] 日志（共 ${logs.length} 条）\n`;
    text += '='.repeat(80) + '\n\n';

    logs.forEach((log, i) => {
      const emoji = log.success ? '✅' : '❌';
      const time = new Date(log.timestamp).toLocaleString('zh-CN');
      text += `${i + 1}. ${emoji} [${time}] ${log.location}\n`;
      if (log.message) text += `   消息: ${log.message}\n`;
      if (log.data) text += `   数据: ${JSON.stringify(log.data)}\n`;
      if (log.stack) text += `   调用栈:\n${log.stack}\n`;
      text += '\n';
    });

    return text;
  }

  // ============ 快捷方法 ============

  /**
   * 授权日志
   */
  static async auth(
    location: string,
    interactive: boolean,
    success: boolean,
    error?: string
  ): Promise<void> {
    await Logger.get('auth').log(
      location,
      success,
      error,
      { interactive },
      true // 授权日志始终记录调用栈
    );
  }

  /**
   * 版本升级日志
   */
  static async upgrade(
    version: string,
    success: boolean,
    message?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await Logger.get('upgrade').log(
      `v${version}`,
      success,
      message,
      details
    );
  }

  /**
   * 消息分析日志
   */
  static async analysis(
    taskName: string,
    data: {
      messagesCount?: number;
      duration?: number;
      result?: string;
      error?: string;
    }
  ): Promise<void> {
    await Logger.get('analysis').log(
      taskName,
      !data.error,
      data.error || data.result,
      {
        messagesCount: data.messagesCount,
        duration: data.duration ? `${data.duration}ms` : undefined,
      }
    );
  }

  /**
   * 任务执行日志
   */
  static async task(
    taskName: string,
    success: boolean,
    message?: string,
    data?: Record<string, any>
  ): Promise<void> {
    await Logger.get('task').log(taskName, success, message, data);
  }

  /**
   * 错误日志
   */
  static async error(
    location: string,
    error: Error | string,
    context?: Record<string, any>
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await Logger.get('error').log(
      location,
      false,
      errorMessage,
      { ...context, stack: errorStack },
      true
    );
  }

  /**
   * 生命周期日志（启动、重载等）
   */
  static async lifecycle(
    event: 'startup' | 'reload' | 'install' | 'update' | 'shutdown' | string,
    message?: string,
    data?: Record<string, any>
  ): Promise<void> {
    await Logger.get('lifecycle').log(event, true, message, data);
  }
}

// ============ 全局快捷访问 ============

// 在全局对象上暴露日志工具
if (typeof window !== 'undefined') {
  (window as any).logs = {
    auth: () => Logger.get('auth'),
    upgrade: () => Logger.get('upgrade'),
    analysis: () => Logger.get('analysis'),
    task: () => Logger.get('task'),
    error: () => Logger.get('error'),
    lifecycle: () => Logger.get('lifecycle'),
    
    // 快捷方法
    printAll: async () => {
      for (const cat of ['auth', 'upgrade', 'analysis', 'task', 'error', 'lifecycle']) {
        await Logger.get(cat as LogCategory).print();
      }
    },
    clearAll: async () => {
      if (confirm('确定要清空所有日志吗？')) {
        for (const cat of ['auth', 'upgrade', 'analysis', 'task', 'error', 'lifecycle']) {
          await Logger.get(cat as LogCategory).clear();
        }
      }
    },
    exportAll: async () => {
      const exports = [];
      for (const cat of ['auth', 'upgrade', 'analysis', 'task', 'error', 'lifecycle']) {
        exports.push(await Logger.get(cat as LogCategory).export());
      }
      return exports.join('\n\n');
    },
  };

  console.log('💡 日志工具已加载，使用方法（注意使用 await）：');
  console.log('  - await logs.auth().print()     // 查看授权日志');
  console.log('  - await logs.upgrade().print()  // 查看升级日志');
  console.log('  - await logs.analysis().print() // 查看分析日志');
  console.log('  - await logs.task().print()     // 查看任务日志');
  console.log('  - await logs.error().print()    // 查看错误日志');
  console.log('  - await logs.lifecycle().print()// 查看生命周期日志');
  console.log('  - await logs.printAll()         // 查看所有日志');
  console.log('  - await logs.clearAll()         // 清空所有日志');
  console.log('  - await logs.exportAll()        // 导出所有日志');
}

// 保持向后兼容的旧 API（现在都是异步的）
export const logAuthCall = Logger.auth;
export const getAuthLogs = async () => await Logger.get('auth').getLogs();
export const clearAuthLogs = async () => await Logger.get('auth').clear();
export const printAuthLogs = async () => await Logger.get('auth').print();
export const exportAuthLogsAsText = async () => await Logger.get('auth').export();
