export type ExternalUrlSafetyReason =
  | 'safe'
  | 'empty'
  | 'placeholder'
  | 'invalid'
  | 'credentialed_url'
  | 'unsupported_protocol';

export interface ExternalUrlSafetyResult {
  safeUrl: string;
  blocked: boolean;
  reason: ExternalUrlSafetyReason;
  originalUrl?: string;
  hostname?: string;
}

export interface ExternalLinkCandidate {
  url: unknown;
  label?: string;
  titleLabel?: string;
}

export interface SafeExternalLinkPresentation {
  url: string;
  label: string;
  host: string;
  title: string;
}

export const getExternalUrlSafety = (
  url: unknown,
): ExternalUrlSafetyResult => {
  if (url === undefined || url === null) {
    return { safeUrl: '', blocked: false, reason: 'empty' };
  }
  const normalizedUrl = String(url).trim();
  if (!normalizedUrl) {
    return { safeUrl: '', blocked: false, reason: 'empty' };
  }
  if (normalizedUrl === '#') {
    return {
      safeUrl: '',
      blocked: false,
      reason: 'placeholder',
      originalUrl: normalizedUrl,
    };
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      if (parsedUrl.username || parsedUrl.password) {
        return {
          safeUrl: '',
          blocked: true,
          reason: 'credentialed_url',
          originalUrl: normalizedUrl,
          hostname: parsedUrl.hostname,
        };
      }

      return {
        safeUrl: parsedUrl.href,
        blocked: false,
        reason: 'safe',
        originalUrl: normalizedUrl,
        hostname: parsedUrl.hostname,
      };
    }

    return {
      safeUrl: '',
      blocked: true,
      reason: 'unsupported_protocol',
      originalUrl: normalizedUrl,
    };
  } catch {
    return {
      safeUrl: '',
      blocked: true,
      reason: 'invalid',
      originalUrl: normalizedUrl,
    };
  }
};

export const getSafeExternalUrl = (url: unknown): string =>
  getExternalUrlSafety(url).safeUrl;

export const getFirstSafeExternalUrl = (...urls: unknown[]): string => {
  for (const url of urls) {
    const safeUrl = getSafeExternalUrl(url);
    if (safeUrl) return safeUrl;
  }

  return '';
};

export const hasBlockedExternalUrlCandidate = (...urls: unknown[]): boolean =>
  urls.some((url) => getExternalUrlSafety(url).blocked);

export const getExternalUrlBlockedReasonLabel = (
  reason: ExternalUrlSafetyReason,
): string => {
  switch (reason) {
    case 'credentialed_url':
      return '包含账号信息';
    case 'invalid':
      return '格式无效';
    case 'unsupported_protocol':
      return '非 http/https';
    default:
      return '不符合安全规则';
  }
};

export const getBlockedExternalUrlResults = (
  ...urls: unknown[]
): ExternalUrlSafetyResult[] =>
  urls.map((url) => getExternalUrlSafety(url)).filter((result) => result.blocked);

export const getFirstSafeExternalLinkPresentation = (
  candidates: ExternalLinkCandidate[],
  fallbackLabel = '来源',
  fallbackTitleLabel = fallbackLabel,
): SafeExternalLinkPresentation | null => {
  for (const candidate of candidates) {
    const safety = getExternalUrlSafety(candidate.url);
    if (!safety.safeUrl) continue;

    const label = candidate.label || fallbackLabel;
    const titleLabel = candidate.titleLabel || label || fallbackTitleLabel;

    const title = safety.hostname
      ? `打开${titleLabel}：${safety.hostname}`
      : `打开${titleLabel}`;

    return {
      url: safety.safeUrl,
      label,
      host: safety.hostname || '',
      title: `${title}；只请求外部标签页；不会重新读取来源内容、同步 Memory Service、标记已读、确认结论或写回原始平台。`,
    };
  }

  return null;
};

export const getHiddenExternalUrlLabel = (
  blockedResults: ExternalUrlSafetyResult[],
  prefix = '来源已隐藏',
): string => {
  if (!blockedResults.length) return prefix;

  const reasonLabels = Array.from(
    new Set(
      blockedResults.map((safety) =>
        getExternalUrlBlockedReasonLabel(safety.reason),
      ),
    ),
  );

  if (blockedResults.length === 1 && reasonLabels.length === 1) {
    return `${prefix} · ${reasonLabels[0]}`;
  }

  const reasonSummary =
    reasonLabels.length > 2
      ? `${reasonLabels.slice(0, 2).join('/')}等`
      : reasonLabels.join('/');

  return `${prefix} · ${blockedResults.length} 个不可信：${reasonSummary}`;
};

export const getHiddenExternalUrlTitle = (
  blockedResults: ExternalUrlSafetyResult[],
  subject = '来源链接',
): string => {
  const reasonSummary = Array.from(
    new Set(
      blockedResults.map((safety) =>
        getExternalUrlBlockedReasonLabel(safety.reason),
      ),
    ),
  ).join('、');

  return blockedResults.length > 1
    ? `已隐藏 ${blockedResults.length} 个不可信${subject}：${reasonSummary}`
    : `${subject}已隐藏：${reasonSummary || '不符合安全规则'}`;
};
