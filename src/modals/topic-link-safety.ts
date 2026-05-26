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
