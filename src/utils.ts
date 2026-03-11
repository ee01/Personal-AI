// 环境配置类型定义
export interface EnvConfigType {
  MESSAGE_ANALYSIS_INTERVAL: number; // 分析消息的频度（分钟）
  MESSAGE_CONTEXT_WINDOW: number;    // 消息上下文窗口：距离此刻的历史消息时间范围（分钟）
  SCHEDULED_INTERVAL: number;        // 已废弃，保留用于向后兼容
  ANALYSIS_TYPE: string;
  ANALYZE_BY_GROUP: boolean;
  LLM_TYPE: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
  OLLAMA_REVIEW_MODEL: string;
  OLLAMA_QUERY_MODEL: string;
  DIFY_API_KEY: string;
  DIFY_REVIEW_API_KEY: string;
  DIFY_API_BASE_URL: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_REVIEW_MODEL: string;
  OPENAI_API_BASE_URL: string;
  GROQ_API_KEY: string;
  GROQ_MODEL: string;
  GROQ_REVIEW_MODEL: string;
  BOT_API_BASE_URL: string;
  BOT_TOKEN: string;
  BOT_ID: string;
  BOT_TYPE: string;
  TEAM_ID: string;
  /** @deprecated 使用每个 concernedItem 的 notifyMethod 替代 */
  ENABLE_BOT?: boolean;
  LLM_REVIEW_BEFORE_SEND: boolean;
  ENABLE_CHROMA: boolean;
  CHROMA_API_URL: string;  // 保留用于兼容旧配置
  CHROMA_HOST: string;     // 新增：Chroma 主机地址
  CHROMA_PORT: number;
  CHROMA_SSL: boolean;     // 新增：是否使用 SSL
  CHROMA_COLLECTION_NAME: string;
  // JIRA相关配置
  JIRA_BASE_URL?: string;
  JIRA_USERNAME?: string;
  JIRA_API_TOKEN?: string;
  DESIGN_JIRA_PROJECT?: string;       // Jira Design项目前缀（如 UX）
  DEPENDENCIES_JIRA_PROJECT?: string; // Jira外部依赖项目前缀（如 RCV）
  // 消息交互功能开关
  ENABLE_AUTO_REPLY: boolean;    // 启用自动答复功能
  ENABLE_SNOOZE: boolean;        // 启用稍后处理功能
  // 消息过滤配置
  FILTER_OWN_MESSAGES: boolean;  // 是否过滤自己发送的消息
  // 记忆系统 (Memory Service)
  MEMORY_SERVICE_BASE_URL: string;  // 记忆服务 API 地址，如 http://localhost:3210/api/v1
  MEMORY_SERVICE_API_KEY?: string;  // 可选，用于认证扩展请求；后端配置 API_KEY 时需匹配
  MEMORY_SERVICE_TIMEOUT?: number;  // 请求超时（毫秒），默认 30000
  // 自动周报 (Weekly Report)
  WEEKLY_REPORT_ENABLED: string;        // 'true' | 'false'
  WEEKLY_REPORT_CRON: string;           // cron 表达式，默认 '0 18 * * 5'（每周五 18:00）
  WEEKLY_REPORT_MIN_MESSAGES: number;   // 最少消息数阈值，默认 20
  DREAM_DIGEST_SCHEDULE_TYPE?: 'weekly' | 'every_x_days' | 'monthly';
  DREAM_DIGEST_INTERVAL_DAYS?: number;
}

export function formatDate(dateString: string | number) {
    const date = new Date(dateString);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
  
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function uniqBy(array: any[], key: string) {
    const seen = new Set();
    return array.filter(item => {
      const keyValue = item[key];
      if (seen.has(keyValue)) {
        return false;
      }
      seen.add(keyValue);
      return true;
    });
}

export function showToast(message: string, type: string, onClose?: () => void) {
  // 获取或创建容器元素
  const container = document.getElementById('radar-poc-result');
  if (!container) return

  // 移除现有的 Toast 元素
  const existingToast = container.querySelector('.radar-poc-toast');
  if (existingToast) {
    container.removeChild(existingToast);
  }

  // 创建新的 Toast 元素
  const toast = document.createElement('div');
  toast.className = `radar-poc-toast radar-poc-toast-${type}`;

  const toastInner = document.createElement('div');
  toastInner.className = 'radar-poc-toast-inner';
  toastInner.textContent = message;

  toast.appendChild(toastInner);
  container.appendChild(toast);

  // 设置定时器在 3 秒后关闭 Toast
  const timer = setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
    if (onClose) {
      onClose();
    }
  }, 3000);

  // 返回一个函数以便手动关闭 Toast
  return () => {
    clearTimeout(timer);
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
    if (onClose) {
      onClose();
    }
  };
}

export function transformGroupLinks(inputString: string) {
  const groupLinkPattern = /\[group:(.+):(\d+)\]/g;
  const transformedString = inputString.replace(groupLinkPattern, (match, groupName, groupId) => {
    return `[${groupName}](/messages/${groupId})`;
  });
  return transformedString;
}

export function transformPostLinks(inputString: string) {
  const postLinkPattern = /\[post:(\d+)\]/g;
  let index = 1;
  const transformedString = inputString.replace(postLinkPattern, (match, postId) => {
    return `[[${index++}]](/l${window.location.pathname}/${postId})`;
  });
  return transformedString;
}

// 默认环境配置
export const defaultEnvConfig: EnvConfigType = {
  MESSAGE_ANALYSIS_INTERVAL: Number(process.env.MESSAGE_ANALYSIS_INTERVAL) || Number(process.env.SCHEDULED_INTERVAL) || 120,
  MESSAGE_CONTEXT_WINDOW: Number(process.env.MESSAGE_CONTEXT_WINDOW) || 125,
  SCHEDULED_INTERVAL: Number(process.env.SCHEDULED_INTERVAL) || 120, // 保留用于向后兼容
  ANALYSIS_TYPE: process.env.ANALYSIS_TYPE || "filter",
  LLM_TYPE: process.env.LLM_TYPE || "dify",
  ANALYZE_BY_GROUP: process.env.ANALYZE_BY_GROUP === "true",
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || "deepseek-r1",
  OLLAMA_REVIEW_MODEL: process.env.OLLAMA_REVIEW_MODEL || "llama3.1",
  OLLAMA_QUERY_MODEL: process.env.OLLAMA_QUERY_MODEL || "llama3.1",
  DIFY_API_KEY: process.env.DIFY_API_KEY || "",
  DIFY_REVIEW_API_KEY: process.env.DIFY_REVIEW_API_KEY || "",
  DIFY_API_BASE_URL: process.env.DIFY_API_BASE_URL || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "",
  OPENAI_REVIEW_MODEL: process.env.OPENAI_REVIEW_MODEL || "",
  OPENAI_API_BASE_URL: process.env.OPENAI_API_BASE_URL || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GROQ_MODEL: process.env.GROQ_MODEL || "",
  GROQ_REVIEW_MODEL: process.env.GROQ_REVIEW_MODEL || "",
  BOT_API_BASE_URL: process.env.BOT_API_BASE_URL || "https://botman.int.rclabenv.com/v2",
  BOT_TOKEN: process.env.BOT_TOKEN || "",
  BOT_ID: process.env.BOT_ID || "4700372020@37439510.bot.glip.net",
  BOT_TYPE: process.env.BOT_TYPE || "user",
  TEAM_ID: process.env.TEAM_ID || "",
  // ENABLE_BOT 已废弃，使用每个 concernedItem 的 notifyMethod 替代
  ENABLE_BOT: undefined,
  LLM_REVIEW_BEFORE_SEND: process.env.LLM_REVIEW_BEFORE_SEND === "true",
  ENABLE_CHROMA: process.env.ENABLE_CHROMA === "true",
  CHROMA_API_URL: process.env.CHROMA_API_URL || "http://localhost:8000",  // 保留用于兼容
  CHROMA_HOST: process.env.CHROMA_HOST || "localhost",
  CHROMA_PORT: Number(process.env.CHROMA_PORT) || 8000,
  CHROMA_SSL: process.env.CHROMA_SSL === "true",
  CHROMA_COLLECTION_NAME: process.env.CHROMA_COLLECTION_NAME || "",
  JIRA_BASE_URL: process.env.JIRA_BASE_URL || "https://jira.ringcentral.com",
  JIRA_USERNAME: process.env.JIRA_USERNAME || "",
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || "",
  DESIGN_JIRA_PROJECT: process.env.DESIGN_JIRA_PROJECT || "UX*",
  DEPENDENCIES_JIRA_PROJECT: process.env.DEPENDENCIES_JIRA_PROJECT || "RCV",
  // 消息交互功能开关（默认全部启用）
  ENABLE_AUTO_REPLY: process.env.ENABLE_AUTO_REPLY !== "false",
  ENABLE_SNOOZE: process.env.ENABLE_SNOOZE !== "false",
  // 消息过滤配置（默认开启过滤）
  FILTER_OWN_MESSAGES: process.env.FILTER_OWN_MESSAGES !== "false",
  // 记忆系统 (Memory Service)
  MEMORY_SERVICE_BASE_URL: process.env.MEMORY_SERVICE_BASE_URL || "http://localhost:3210/api/v1",
  MEMORY_SERVICE_API_KEY: process.env.MEMORY_SERVICE_API_KEY || "",
  MEMORY_SERVICE_TIMEOUT: Number(process.env.MEMORY_SERVICE_TIMEOUT) || 30_000,
  // 自动周报 (Weekly Report)
  WEEKLY_REPORT_ENABLED: process.env.WEEKLY_REPORT_ENABLED || "true",
  WEEKLY_REPORT_CRON: process.env.WEEKLY_REPORT_CRON || "0 18 * * 5",
  WEEKLY_REPORT_MIN_MESSAGES: Number(process.env.WEEKLY_REPORT_MIN_MESSAGES) || 20,
  DREAM_DIGEST_SCHEDULE_TYPE: (
    process.env.DREAM_DIGEST_SCHEDULE_TYPE === 'every_x_days' ||
    process.env.DREAM_DIGEST_SCHEDULE_TYPE === 'monthly'
  ) ? process.env.DREAM_DIGEST_SCHEDULE_TYPE : 'weekly',
  DREAM_DIGEST_INTERVAL_DAYS: Math.max(1, Number(process.env.DREAM_DIGEST_INTERVAL_DAYS) || 7),
};

// 获取环境配置，如果可能的话从 storage 获取，否则从 process.env 获取
export async function getEnvConfig(): Promise<EnvConfigType> {
  try {
    const { envConfig } = await chrome.storage.local.get(['envConfig']);
    if (envConfig) {
      // 将存储的配置与默认配置合并，确保新增的配置项也会被包含
      return { ...defaultEnvConfig, ...envConfig };
    }
  } catch (error) {
    console.error('获取配置失败:', error);
  }
  
  // 如果获取失败或没有保存的配置，返回默认值
  return defaultEnvConfig;
}

export function getDefaultEnvConfig(): EnvConfigType {
  return defaultEnvConfig;
}

export async function getUserInfo() {
  const { userinfo } = await chrome.storage.local.get(['userinfo'])
  return userinfo;
}

/**
 * 解析 ChromaDB 连接参数，支持新旧配置格式的兼容
 */
export function parseChromaConfig(config: EnvConfigType) {
  // 如果有新的 host 配置，直接使用
  if (config.CHROMA_HOST && config.CHROMA_HOST !== 'localhost') {
    return {
      host: config.CHROMA_HOST,
      port: config.CHROMA_PORT,
      ssl: config.CHROMA_SSL
    };
  }

  // 如果没有配置新的 host，尝试从旧的 CHROMA_API_URL 解析
  if (config.CHROMA_API_URL) {
    try {
      const url = new URL(config.CHROMA_API_URL);
      return {
        host: url.hostname,
        port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 8000),
        ssl: url.protocol === 'https:'
      };
    } catch (error) {
      console.warn('解析 CHROMA_API_URL 失败:', error);
      // 回退到默认值
      return {
        host: 'localhost',
        port: config.CHROMA_PORT || 8000,
        ssl: false
      };
    }
  }

  // 都没有配置，使用默认值
  return {
    host: config.CHROMA_HOST || 'localhost',
    port: config.CHROMA_PORT || 8000,
    ssl: config.CHROMA_SSL || false
  };
}
