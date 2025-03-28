import { getCurrentUserInfo, getLocalStorageItem } from "./storage";

// 环境配置类型定义
export interface EnvConfigType {
  SCHEDULED_INTERVAL: number;
  LLM_TYPE: string;
  LLM_GROUP_ANALYSIS: boolean;
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
  ENABLE_BOT: boolean;
  LLM_REVIEW_BEFORE_SEND: boolean;
  ENABLE_CHROMA: boolean;
  CHROMA_API_URL: string;
  CHROMA_PORT: number;
  CHROMA_COLLECTION_NAME: string;
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
  SCHEDULED_INTERVAL: Number(process.env.SCHEDULED_INTERVAL) || 120,
  LLM_TYPE: process.env.LLM_TYPE || "dify",
  LLM_GROUP_ANALYSIS: process.env.LLM_GROUP_ANALYSIS === "true",
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
  ENABLE_BOT: process.env.ENABLE_BOT === "true",
  LLM_REVIEW_BEFORE_SEND: process.env.LLM_REVIEW_BEFORE_SEND === "true",
  ENABLE_CHROMA: process.env.ENABLE_CHROMA === "true",
  CHROMA_API_URL: process.env.CHROMA_API_URL || "http://localhost:8000",
  CHROMA_PORT: Number(process.env.CHROMA_PORT) || 8000,
  CHROMA_COLLECTION_NAME: process.env.CHROMA_COLLECTION_NAME || ""
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

export function getUserInfo() {
  const accountUD = getLocalStorageItem('global.account.UD', '');
  const accountInfoList = getLocalStorageItem('global.account.ACCOUNT_SESSION_DATA_LIST', {});

  const accountInfo = accountUD ? accountInfoList[accountUD] : accountInfoList.find((item:any) => item.displayName != '');
  console.log('accountInfoList', accountInfoList, accountInfo);
  if (accountInfo) return {
    extensionId: accountInfo.extensionId,
    email: accountInfo.email,
    fullName: accountInfo.displayName,
    username: accountInfo.email ? accountInfo.email.trim().split('@')[0] : accountInfo.displayName.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''),
  }

  const userInfo = getCurrentUserInfo();
  return {
    extensionId: userInfo.extensionId,
    fullName: userInfo.username,
    username: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''),
    email: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, '') + '@ringcentral.com'
  };
}

