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
  /** 实际命中或尝试的 Chrome Google 账号（仅保存 opaque id，不保存 token/email） */
  accountId?: string;
  /** 当前浏览器可供 Identity API 尝试的账号数；API 不可用时为 undefined */
  availableAccountCount?: number;
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
  /** 显式指定 Chrome Google 账号；通常由内部账号绑定恢复逻辑提供 */
  accountId?: string;
  /** 交互授权时忽略旧账号绑定并允许用户重新选择账号 */
  promptForAccount?: boolean;
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
  /** 显式指定 Chrome Google 账号；通常由内部账号绑定恢复逻辑提供 */
  accountId?: string;
}

type ChromeIdentityAccount = { id: string };

const GOOGLE_AUTH_ACCOUNT_STORAGE_KEY_PREFIX = 'googleAuthPreferredAccountId';

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

function normalizeAccountId(accountId?: string | null): string | undefined {
  const normalized = String(accountId || '').trim();
  return normalized || undefined;
}

function getGoogleAuthAccountStorageKey(scopes?: readonly string[]): string {
  const scopeKey = normalizeScopes(scopes).sort().join('|') || 'manifest-default';
  return `${GOOGLE_AUTH_ACCOUNT_STORAGE_KEY_PREFIX}:${scopeKey}`;
}

async function getStoredGoogleAuthAccountId(
  scopes?: readonly string[],
): Promise<string | undefined> {
  const storageKey = getGoogleAuthAccountStorageKey(scopes);
  try {
    const storage = await chrome.storage?.local?.get([storageKey]);
    return normalizeAccountId(storage?.[storageKey]);
  } catch {
    return undefined;
  }
}

async function rememberGoogleAuthAccountId(
  accountId?: string,
  scopes?: readonly string[],
): Promise<void> {
  const normalized = normalizeAccountId(accountId);
  if (!normalized) return;
  const storageKey = getGoogleAuthAccountStorageKey(scopes);

  try {
    await chrome.storage?.local?.set({
      [storageKey]: normalized,
    });
  } catch {
    // 账号绑定只是恢复优化；storage 不可用时仍允许当前 token 正常返回。
  }
}

/**
 * Chrome 目前只在 Dev channel 暴露 getAccounts；因此这里必须能力探测并安全降级。
 * 用户常用 Chrome Canary 时可枚举多个账号，Stable/旧版本则继续使用默认账号路径。
 */
async function getAvailableGoogleAccounts(): Promise<ChromeIdentityAccount[] | null> {
  const getAccounts = (
    chrome.identity as typeof chrome.identity & {
      getAccounts?: (
        callback?: (accounts: ChromeIdentityAccount[]) => void,
      ) => Promise<ChromeIdentityAccount[]> | void;
    }
  ).getAccounts;

  if (typeof getAccounts !== 'function') {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (accounts?: ChromeIdentityAccount[]) => {
      if (settled) return;
      settled = true;
      const normalizedAccounts = Array.isArray(accounts)
        ? accounts
            .map((account) => ({ id: normalizeAccountId(account?.id) || '' }))
            .filter((account) => Boolean(account.id))
        : [];
      resolve(normalizedAccounts);
    };

    try {
      const maybePromise = getAccounts.call(chrome.identity, finish);
      if (maybePromise && typeof maybePromise.then === 'function') {
        void maybePromise.then(finish, () => finish([]));
      }
    } catch {
      finish([]);
    }
  });
}

function uniqueAccountIds(...groups: Array<Array<string | undefined>>): string[] {
  return Array.from(
    new Set(
      groups
        .flat()
        .map((accountId) => normalizeAccountId(accountId))
        .filter((accountId): accountId is string => Boolean(accountId)),
    ),
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
    if (
      result.failureReason === 'auth_error' &&
      typeof result.availableAccountCount === 'number' &&
      result.availableAccountCount > 1
    ) {
      return `${result.error}；已检查当前 Chrome 中的 ${result.availableAccountCount} 个 Google 账号`;
    }
    return result.error;
  }
  return '未取得 Google 授权';
}

export function isGoogleAuthRecoveryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const explicitAuthFailure = /(?:Invalid Credentials|invalid_token|OAuth2 not granted|not signed in|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes|insufficientPermissions|Google Sheets 授权(?:不可用|不完整|失败)?)/i;
  const googleSheets401 = /(?:读取|写入|更新|添加|删除|获取)\s*(?:Google\s*)?(?:Sheet|Sheets|工作表)[^\n]{0,80}(?:\(401\)|HTTP\s*401|Unauthorized)/i;
  return explicitAuthFailure.test(message) || googleSheets401.test(message);
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
  accountId?: string,
): Promise<RawGoogleAuthTokenResult> {
  const requestedScopes = normalizeScopes(scopes);
  const normalizedRequiredScopes = normalizeScopes(
    requiredScopes ?? requestedScopes,
  );

  return new Promise((resolve) => {
    const normalizedAccountId = normalizeAccountId(accountId);
    const details = {
      interactive,
      ...(requestedScopes.length > 0 ? { scopes: requestedScopes } : {}),
      ...(normalizedAccountId ? { account: { id: normalizedAccountId } } : {}),
    } as chrome.identity.TokenDetails;
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
          accountId: normalizedAccountId,
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
        accountId: normalizedAccountId,
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

async function getAuthTokenAcrossAccounts(
  caller: string,
  scopes?: readonly string[],
  requiredScopes?: readonly string[],
  explicitAccountId?: string,
): Promise<RawGoogleAuthTokenResult> {
  const [storedAccountId, availableAccounts] = await Promise.all([
    getStoredGoogleAuthAccountId(scopes),
    getAvailableGoogleAccounts(),
  ]);
  const availableAccountCount = availableAccounts?.length;
  const accountIds = uniqueAccountIds(
    [explicitAccountId],
    [storedAccountId],
    (availableAccounts || []).map((account) => account.id),
  );
  const attempts: RawGoogleAuthTokenResult[] = [];

  // getAccounts 不可用时保留 Chrome 默认账号行为；可用时逐账号静默探测，
  // 避免默认个人账号遮住第二个工作账号上仍然有效的授权。
  if (accountIds.length === 0) {
    const result = await _getAuthToken(
      false,
      caller,
      true,
      scopes,
      requiredScopes,
    );
    return { ...result, availableAccountCount };
  }

  for (const accountId of accountIds) {
    const result = await _getAuthToken(
      false,
      `${caller}.account`,
      true,
      scopes,
      requiredScopes,
      accountId,
    );
    const enrichedResult = { ...result, availableAccountCount };
    attempts.push(enrichedResult);
    if (enrichedResult.token) {
      await rememberGoogleAuthAccountId(accountId, scopes);
      return enrichedResult;
    }
  }

  // missing_scopes 带有可恢复的 raw token，优先保留；否则返回绑定账号的
  // 具体错误，最后才退回其它账号错误。
  return attempts.find((result) => result.failureReason === 'missing_scopes')
    || attempts.find((result) => result.accountId === normalizeAccountId(explicitAccountId))
    || attempts.find((result) => result.accountId === normalizeAccountId(storedAccountId))
    || attempts[0]
    || {
      token: null,
      rawToken: null,
      grantedScopes: [],
      missingScopes: [],
      scopeVerificationAvailable: false,
      availableAccountCount,
      failureReason: 'no_token',
      error: '未获取到 token',
    };
}

async function identifyAndRememberInteractiveAccount(
  token: string,
  caller: string,
  scopes?: readonly string[],
  requiredScopes?: readonly string[],
): Promise<string | undefined> {
  const availableAccounts = await getAvailableGoogleAccounts();
  if (!availableAccounts?.length) return undefined;

  const successfulAccounts: string[] = [];
  for (const account of availableAccounts) {
    const result = await _getAuthToken(
      false,
      `${caller}.identifyAccount`,
      true,
      scopes,
      requiredScopes,
      account.id,
    );
    if (result.rawToken === token) {
      await rememberGoogleAuthAccountId(account.id, scopes);
      return account.id;
    }
    if (result.token) successfulAccounts.push(account.id);
  }

  // 某些 Chrome 版本会为同一 grant 返回等价但不同的 access token；只有
  // 唯一账号能静默满足本次 scopes 时，才安全地建立账号绑定。
  if (successfulAccounts.length === 1) {
    await rememberGoogleAuthAccountId(successfulAccounts[0], scopes);
    return successfulAccounts[0];
  }
  return undefined;
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
    accountId,
    promptForAccount = false,
  } = options;

  const cachedResult = await getAuthTokenAcrossAccounts(
    `${caller}.tryCache`,
    scopes,
    requiredScopes,
    accountId,
  );
  if (cachedResult.token && !forceRefresh) {
    if (!silent) {
      void Logger.auth(caller, false, true, '使用缓存 token');
    }
    return toPublicAuthResult(cachedResult);
  }

  // 粒度授权可能返回一个只覆盖部分 scope 的 token。用户主动触发授权时先移除
  // 该 access token 缓存，再进入 interactive 流程，以便 Google 补齐缺失 scope。
  if (cachedResult.rawToken && (forceRefresh || cachedResult.failureReason === 'missing_scopes')) {
    await removeCachedToken(cachedResult.rawToken);
  }

  const storedAccountId = await getStoredGoogleAuthAccountId(scopes);
  const interactiveAccountId = promptForAccount
    ? undefined
    : normalizeAccountId(accountId) || normalizeAccountId(storedAccountId);
  const interactiveResult = await _getAuthToken(
    true,
    caller,
    silent,
    scopes,
    requiredScopes,
    interactiveAccountId,
  );

  let resolvedAccountId = interactiveResult.accountId;
  if (interactiveResult.token) {
    if (resolvedAccountId) {
      await rememberGoogleAuthAccountId(resolvedAccountId, scopes);
    } else {
      resolvedAccountId = await identifyAndRememberInteractiveAccount(
        interactiveResult.token,
        caller,
        scopes,
        requiredScopes,
      );
    }
  }

  return toPublicAuthResult({
    ...interactiveResult,
    accountId: resolvedAccountId,
    availableAccountCount: cachedResult.availableAccountCount,
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
    accountId,
  } = options;

  const cachedResult = await getAuthTokenAcrossAccounts(
    caller,
    scopes,
    requiredScopes,
    accountId,
  );
  if (!forceRefresh || !cachedResult.rawToken) {
    return toPublicAuthResult(cachedResult);
  }

  await removeCachedToken(cachedResult.rawToken);
  return toPublicAuthResult(await getAuthTokenAcrossAccounts(
    `${caller}.afterRefresh`,
    scopes,
    requiredScopes,
    cachedResult.accountId || accountId,
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
