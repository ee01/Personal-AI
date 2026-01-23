/**
 * Google Auth Token 共用工具
 * 
 * 统一管理 Google OAuth token 的获取、缓存和刷新
 * 
 * 核心设计：
 * 1. getGoogleAuthToken - 会弹窗的授权方法（先尝试缓存，失败后弹窗）
 * 2. getGoogleAuthTokenSilently - 静默授权方法（只用缓存，不弹窗）
 * 
 * 使用方法：
 *   import { getGoogleAuthToken, getGoogleAuthTokenSilently } from './utils/googleAuth';
 *   
 *   // 场景1: 用户主动操作（点击按钮等）- 先尝试缓存，失败后弹窗
 *   const token = await getGoogleAuthToken({ caller: 'popup.analyzeSlides' });
 *   
 *   // 场景2: 后台自动任务 - 只用缓存，不弹窗
 *   const token = await getGoogleAuthTokenSilently({ caller: 'background.autoUpdate' });
 *   
 *   // 场景3: 需要新权限（如 manifest 更新了 scopes）- 强制刷新
 *   const token = await getGoogleAuthToken({ 
 *     caller: 'OneClickSetup', 
 *     forceRefresh: true 
 *   });
 *   
 *   // 场景4: API 返回 401，尝试刷新 token - 静默刷新
 *   const token = await getGoogleAuthTokenSilently({ 
 *     caller: 'ScheduledMessageService.refresh', 
 *     forceRefresh: true 
 *   });
 */

import { Logger } from './logger';

/**
 * Auth Token 获取选项（会弹窗）
 */
export interface GoogleAuthOptions {
  /** 调用者标识，用于日志追踪（必填，便于调试） */
  caller?: string;
  /** 是否先清除旧 token 再获取新的（默认 false） */
  forceRefresh?: boolean;
  /** 失败时是否静默（不记录错误日志），默认 false */
  silent?: boolean;
}

/**
 * Auth Token 获取选项（静默，不弹窗）
 */
export interface GoogleAuthSilentOptions {
  /** 调用者标识，用于日志追踪（必填，便于调试） */
  caller?: string;
  /** 是否先清除旧 token 再获取新的（默认 false） */
  forceRefresh?: boolean;
}

/**
 * 移除缓存的 token
 * @internal
 */
function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      resolve();
    });
  });
}

/**
 * 基础 token 获取方法
 * @internal
 */
async function _getAuthToken(
  interactive: boolean,
  caller: string,
  silent = false
): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
        
        if (!silent) {
          Logger.auth(caller, interactive, false, errorMsg);
        }
        
        resolve(null);
      } else {
        if (!silent || token) {
          Logger.auth(caller, interactive, !!token, token ? undefined : '未获取到 token');
        }
        
        resolve(token || null);
      }
    });
  });
}

/**
 * 获取 Google Auth Token（会弹窗）
 * 
 * 默认行为：先尝试使用缓存的 token，如果没有缓存则弹出授权窗口
 * 这是最常用的方法，适用于 95% 的用户主动操作场景
 * 
 * @param options 配置选项
 * @returns token 字符串，失败时返回 null
 * 
 * @example
 * // 场景1: 用户点击按钮分析 Slides（先尝试缓存，失败后弹窗）
 * const token = await getGoogleAuthToken({ caller: 'popup.analyzeSlides' });
 * if (!token) {
 *   alert('获取授权失败');
 *   return;
 * }
 * 
 * @example
 * // 场景2: 用户首次配置，需要新权限（强制刷新）
 * const token = await getGoogleAuthToken({ 
 *   caller: 'OneClickSetup.init',
 *   forceRefresh: true  // 清除旧 token，应用新的权限范围
 * });
 */
export async function getGoogleAuthToken(
  options: GoogleAuthOptions = {}
): Promise<string | null> {
  const {
    caller = 'getGoogleAuthToken',
    forceRefresh = false,
    silent = false,
  } = options;

  // 如果需要强制刷新，先清除旧 token
  if (forceRefresh) {
    const cachedToken = await _getAuthToken(false, `${caller}.checkCache`, true);
    if (cachedToken) {
      await removeCachedToken(cachedToken);
    }
  }

  // 先尝试静默获取（使用缓存）
  const cachedToken = await _getAuthToken(false, `${caller}.tryCache`, true);
  if (cachedToken) {
    // 缓存命中，直接返回
    if (!silent) {
      Logger.auth(caller, false, true, '使用缓存 token');
    }
    return cachedToken;
  }

  // 缓存未命中，弹出授权窗口
  return _getAuthToken(true, caller, silent);
}

/**
 * 静默获取 Google Auth Token（不弹窗）
 * 
 * 只使用缓存的 token，如果没有缓存则返回 null
 * 适用于后台自动任务、页面初始化等不应打扰用户的场景
 * 
 * @param options 配置选项
 * @returns 缓存的 token，没有缓存时返回 null
 * 
 * @example
 * // 场景1: 后台自动更新（不弹窗）
 * const token = await getGoogleAuthTokenSilently({ 
 *   caller: 'background.autoUpdate' 
 * });
 * if (!token) {
 *   console.log('无缓存 token，跳过自动任务');
 *   return;
 * }
 * 
 * @example
 * // 场景2: API 返回 401，尝试刷新 token（不弹窗）
 * const token = await getGoogleAuthTokenSilently({ 
 *   caller: 'ScheduledMessageService.refresh',
 *   forceRefresh: true  // 清除旧 token，尝试获取新的
 * });
 * if (!token) {
 *   throw new Error('Token 已过期，请手动重新授权');
 * }
 * 
 * @example
 * // 场景3: 页面加载时初始化（不弹窗）
 * const token = await getGoogleAuthTokenSilently({ 
 *   caller: 'ScheduledMessagesManager.init' 
 * });
 * if (!token) {
 *   setNeedsReauth(true);  // 显示"需要授权"提示
 * }
 */
export async function getGoogleAuthTokenSilently(
  options: GoogleAuthSilentOptions = {}
): Promise<string | null> {
  const {
    caller = 'getGoogleAuthTokenSilently',
    forceRefresh = false,
  } = options;

  // 如果需要强制刷新，先清除旧 token
  if (forceRefresh) {
    const cachedToken = await _getAuthToken(false, `${caller}.checkCache`, true);
    if (cachedToken) {
      await removeCachedToken(cachedToken);
    }
  }

  // 静默获取（不弹窗）
  return _getAuthToken(false, caller, true);
}

// ============ 向后兼容导出 ============
// 保持与 slide.ts 中原有 API 的兼容性

/**
 * @deprecated 请使用 getGoogleAuthToken({ caller: 'xxx' })
 */
export async function getAuthToken(): Promise<string | null> {
  return getGoogleAuthToken({ caller: 'getAuthToken.compat' });
}

/**
 * @deprecated 请使用 getGoogleAuthTokenSilently({ caller: 'xxx' })
 */
export async function getCachedAuthToken(): Promise<string | null> {
  return getGoogleAuthTokenSilently({ caller: 'getCachedAuthToken.compat' });
}
