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

export const GOOGLE_AUTH_SCOPES = {
  USERINFO_PROFILE: 'https://www.googleapis.com/auth/userinfo.profile',
  USERINFO_EMAIL: 'https://www.googleapis.com/auth/userinfo.email',
  SCRIPT_LOCALE: 'https://www.googleapis.com/auth/script.locale',
  SCRIPT_PROJECTS: 'https://www.googleapis.com/auth/script.projects',
  SCRIPT_SCRIPTAPP: 'https://www.googleapis.com/auth/script.scriptapp',
  SCRIPT_DEPLOYMENTS: 'https://www.googleapis.com/auth/script.deployments',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  SPREADSHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  PRESENTATIONS: 'https://www.googleapis.com/auth/presentations',
} as const;

export type GoogleAuthScope =
  typeof GOOGLE_AUTH_SCOPES[keyof typeof GOOGLE_AUTH_SCOPES];

const IDENTITY_SCOPES = [
  GOOGLE_AUTH_SCOPES.USERINFO_PROFILE,
  GOOGLE_AUTH_SCOPES.USERINFO_EMAIL,
] as const;

const APPS_SCRIPT_SCOPES = [
  GOOGLE_AUTH_SCOPES.SCRIPT_LOCALE,
  GOOGLE_AUTH_SCOPES.SCRIPT_PROJECTS,
  GOOGLE_AUTH_SCOPES.SCRIPT_SCRIPTAPP,
  GOOGLE_AUTH_SCOPES.SCRIPT_DEPLOYMENTS,
] as const;

export const GOOGLE_AUTH_SCOPE_SETS = {
  IDENTITY: IDENTITY_SCOPES,
  SHEETS: [GOOGLE_AUTH_SCOPES.SPREADSHEETS] as const,
  SLIDES: [GOOGLE_AUTH_SCOPES.PRESENTATIONS] as const,
  APPS_SCRIPT_ADMIN: [
    ...APPS_SCRIPT_SCOPES,
    GOOGLE_AUTH_SCOPES.SPREADSHEETS,
  ] as const,
  FULL: [
    ...IDENTITY_SCOPES,
    ...APPS_SCRIPT_SCOPES,
    GOOGLE_AUTH_SCOPES.DRIVE_FILE,
    GOOGLE_AUTH_SCOPES.SPREADSHEETS,
    GOOGLE_AUTH_SCOPES.PRESENTATIONS,
  ] as const,
} as const;

export type GoogleAuthFailureReason =
  | 'auth_error'
  | 'missing_scopes'
  | 'no_token';

export interface GoogleAuthTokenResult {
  token: string | null;
  grantedScopes: string[];
  missingScopes: string[];
  scopeVerificationAvailable: boolean;
  failureReason?: GoogleAuthFailureReason;
  error?: string;
}

interface RawGoogleAuthTokenResult extends GoogleAuthTokenResult {
  rawToken: string | null;
}

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
  /** 本次功能实际请求的权限；传入后覆盖 manifest 的全局 scopes */
  scopes?: readonly string[];
  /** 本次功能必须具备的权限；默认与 scopes 相同 */
  requiredScopes?: readonly string[];
}

/**
 * Auth Token 获取选项（静默，不弹窗）
 */
export interface GoogleAuthSilentOptions {
  /** 调用者标识，用于日志追踪（必填，便于调试） */
  caller?: string;
  /** 是否先清除旧 token 再获取新的（默认 false） */
  forceRefresh?: boolean;
  /** 本次功能实际请求的权限；传入后覆盖 manifest 的全局 scopes */
  scopes?: readonly string[];
  /** 本次功能必须具备的权限；默认与 scopes 相同 */
  requiredScopes?: readonly string[];
}

const GOOGLE_AUTH_SCOPE_LABELS: Record<string, string> = {
  [GOOGLE_AUTH_SCOPES.USERINFO_PROFILE]: 'Google 个人资料',
  [GOOGLE_AUTH_SCOPES.USERINFO_EMAIL]: 'Google 邮箱地址',
  [GOOGLE_AUTH_SCOPES.SCRIPT_LOCALE]: 'Apps Script 地区设置',
  [GOOGLE_AUTH_SCOPES.SCRIPT_PROJECTS]: 'Apps Script 项目',
  [GOOGLE_AUTH_SCOPES.SCRIPT_SCRIPTAPP]: 'Apps Script 执行',
  [GOOGLE_AUTH_SCOPES.SCRIPT_DEPLOYMENTS]: 'Apps Script 部署',
  [GOOGLE_AUTH_SCOPES.DRIVE_FILE]: 'Google Drive 文件',
  [GOOGLE_AUTH_SCOPES.SPREADSHEETS]: 'Google Sheets',
  [GOOGLE_AUTH_SCOPES.PRESENTATIONS]: 'Google Slides',
};

function normalizeScopes(scopes?: readonly string[]): string[] {
  return Array.from(
    new Set((scopes || []).map((scope) => scope.trim()).filter(Boolean)),
  );
}

export function formatGoogleAuthScopeLabels(scopes: readonly string[]): string {
  return normalizeScopes(scopes)
    .map((scope) => GOOGLE_AUTH_SCOPE_LABELS[scope] || scope)
    .join('、');
}

export function formatGoogleAuthFailure(result: GoogleAuthTokenResult): string {
  if (
    result.failureReason === 'missing_scopes' &&
    result.missingScopes.length > 0
  ) {
    return `尚未授予 ${formatGoogleAuthScopeLabels(result.missingScopes)} 权限`;
  }
  if (result.error) {
    return result.error;
  }
  return '未取得 Google 授权';
}

export function isGoogleAuthRecoveryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /(?:\b401\b|Unauthorized|Invalid Credentials|invalid_token|OAuth2 not granted|not signed in|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes|insufficientPermissions|Google Sheets 授权)/i
    .test(message);
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
  silent = false,
  scopes?: readonly string[],
  requiredScopes?: readonly string[],
): Promise<RawGoogleAuthTokenResult> {
  const requestedScopes = normalizeScopes(scopes);
  const normalizedRequiredScopes = normalizeScopes(
    requiredScopes ?? requestedScopes,
  );

  return new Promise((resolve) => {
    const details: chrome.identity.TokenDetails = {
      interactive,
      ...(requestedScopes.length > 0 ? { scopes: requestedScopes } : {}),
    };
    const getAuthTokenWithGrantedScopes = chrome.identity.getAuthToken as unknown as (
      details: chrome.identity.TokenDetails,
      callback: (token?: string, grantedScopes?: string[]) => void,
    ) => void;

    getAuthTokenWithGrantedScopes(details, (token, grantedScopes) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
        
        if (!silent) {
          Logger.auth(caller, interactive, false, errorMsg);
        }
        
        resolve({
          token: null,
          rawToken: null,
          grantedScopes: [],
          missingScopes: [],
          scopeVerificationAvailable: false,
          failureReason: 'auth_error',
          error: errorMsg,
        });
        return;
      }

      const normalizedGrantedScopes = normalizeScopes(grantedScopes);
      const scopeVerificationAvailable = Array.isArray(grantedScopes);
      const grantedScopeSet = new Set(normalizedGrantedScopes);
      const missingScopes = scopeVerificationAvailable
        ? normalizedRequiredScopes.filter((scope) => !grantedScopeSet.has(scope))
        : [];
      const failureReason: GoogleAuthFailureReason | undefined = !token
        ? 'no_token'
        : missingScopes.length > 0
          ? 'missing_scopes'
          : undefined;
      const error = missingScopes.length > 0
        ? `尚未授予 ${formatGoogleAuthScopeLabels(missingScopes)} 权限`
        : !token
          ? '未获取到 token'
          : undefined;

      if (!silent || token) {
        void Logger.auth(caller, interactive, Boolean(token) && missingScopes.length === 0, error);
      }

      resolve({
        token: token && missingScopes.length === 0 ? token : null,
        rawToken: token || null,
        grantedScopes: normalizedGrantedScopes,
        missingScopes,
        scopeVerificationAvailable,
        failureReason,
        error,
      });
    });
  });
}

function toPublicAuthResult(
  result: RawGoogleAuthTokenResult,
): GoogleAuthTokenResult {
  const { rawToken: _rawToken, ...publicResult } = result;
  return publicResult;
}

export async function getGoogleAuthTokenResult(
  options: GoogleAuthOptions = {},
): Promise<GoogleAuthTokenResult> {
  const {
    caller = 'getGoogleAuthToken',
    forceRefresh = false,
    silent = false,
    scopes,
    requiredScopes,
  } = options;

  if (forceRefresh) {
    const cachedResult = await _getAuthToken(
      false,
      `${caller}.checkCache`,
      true,
      scopes,
      requiredScopes,
    );
    if (cachedResult.rawToken) {
      await removeCachedToken(cachedResult.rawToken);
    }
  }

  const cachedResult = await _getAuthToken(
    false,
    `${caller}.tryCache`,
    true,
    scopes,
    requiredScopes,
  );
  if (cachedResult.token) {
    if (!silent) {
      void Logger.auth(caller, false, true, '使用缓存 token');
    }
    return toPublicAuthResult(cachedResult);
  }

  // 粒度授权可能返回一个只覆盖部分 scope 的 token。用户主动触发授权时先移除
  // 该 access token 缓存，再进入 interactive 流程，以便 Google 补齐缺失 scope。
  if (cachedResult.rawToken) {
    await removeCachedToken(cachedResult.rawToken);
  }

  return toPublicAuthResult(await _getAuthToken(
    true,
    caller,
    silent,
    scopes,
    requiredScopes,
  ));
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
  const result = await getGoogleAuthTokenResult(options);
  return result.token;
}

export async function getGoogleAuthTokenSilentlyResult(
  options: GoogleAuthSilentOptions = {},
): Promise<GoogleAuthTokenResult> {
  const {
    caller = 'getGoogleAuthTokenSilently',
    forceRefresh = false,
    scopes,
    requiredScopes,
  } = options;

  if (forceRefresh) {
    const cachedResult = await _getAuthToken(
      false,
      `${caller}.checkCache`,
      true,
      scopes,
      requiredScopes,
    );
    if (cachedResult.rawToken) {
      await removeCachedToken(cachedResult.rawToken);
    }
  }

  return toPublicAuthResult(await _getAuthToken(
    false,
    caller,
    true,
    scopes,
    requiredScopes,
  ));
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
  const result = await getGoogleAuthTokenSilentlyResult(options);
  return result.token;
}

// ============ 向后兼容导出 ============
// 保持与 slide.ts 中原有 API 的兼容性

/**
 * @deprecated 请使用 getGoogleAuthToken({ caller: 'xxx' })
 */
export async function getAuthToken(): Promise<string | null> {
  return getGoogleAuthToken({
    caller: 'getAuthToken.compat',
    scopes: GOOGLE_AUTH_SCOPE_SETS.SLIDES,
  });
}

/**
 * @deprecated 请使用 getGoogleAuthTokenSilently({ caller: 'xxx' })
 */
export async function getCachedAuthToken(): Promise<string | null> {
  return getGoogleAuthTokenSilently({
    caller: 'getCachedAuthToken.compat',
    scopes: GOOGLE_AUTH_SCOPE_SETS.SLIDES,
  });
}
