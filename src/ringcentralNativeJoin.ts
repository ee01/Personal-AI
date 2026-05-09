export const RINGCENTRAL_NATIVE_JOIN_ENABLED_CONFIG_KEY =
  'MEETING_NATIVE_CLIENT_JOIN_ENABLED';
export const RINGCENTRAL_NATIVE_JOIN_ENABLED_ATTR =
  'data-pai-ringcentral-native-join-enabled';

const RINGCENTRAL_VIDEO_HOST = 'v.ringcentral.com';
const RINGCENTRAL_VIDEO_NATIVE_SCHEME = 'rcvdt';
const RINGCENTRAL_VIDEO_JOIN_URL_PATTERN =
  /https:\/\/v\.ringcentral\.com\/(?:join|conf\/on)\/[^\s"'<>]+/gi;

export interface RingCentralVideoJoinTarget {
  originalUrl: string;
  nativeUrl: string;
  meetingId: string;
}

export function parseRingCentralVideoJoinTarget(
  rawUrl: string,
  baseUrl: string = window.location.href,
): RingCentralVideoJoinTarget | null {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    if (parsed.protocol === `${RINGCENTRAL_VIDEO_NATIVE_SCHEME}:`) {
      const meetingId =
        parsed.hostname === 'join'
          ? parsed.pathname.replace(/^\/+/, '').split('/')[0]
          : '';
      if (!meetingId) return null;
      return {
        originalUrl: parsed.toString(),
        nativeUrl: parsed.toString(),
        meetingId,
      };
    }

    if (parsed.hostname.toLowerCase() !== RINGCENTRAL_VIDEO_HOST) {
      return null;
    }

    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    const match = normalizedPath.match(/^\/(?:join|conf\/on)\/([^/]+)$/);
    const meetingId = match?.[1]?.trim();
    if (!meetingId) {
      return null;
    }

    return {
      originalUrl: parsed.toString(),
      nativeUrl:
        `${RINGCENTRAL_VIDEO_NATIVE_SCHEME}://join/${meetingId}` +
        `${parsed.search}${parsed.hash}`,
      meetingId,
    };
  } catch {
    return null;
  }
}

export function extractRingCentralVideoJoinUrl(value: unknown): string | null {
  const text = String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  if (!text) return null;

  RINGCENTRAL_VIDEO_JOIN_URL_PATTERN.lastIndex = 0;
  const matches = text.matchAll(RINGCENTRAL_VIDEO_JOIN_URL_PATTERN);
  for (const match of matches) {
    const candidate = stripTrailingJoinUrlPunctuation(match[0]);
    const target = parseRingCentralVideoJoinTarget(candidate);
    if (target) {
      return target.originalUrl;
    }
  }

  return null;
}

export function shouldPreserveDefaultNativeJoinClick(event: MouseEvent): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function openRingCentralVideoNativeJoin(
  target: RingCentralVideoJoinTarget,
) {
  try {
    window.location.assign(target.nativeUrl);
    console.info(
      '[Personal AI] RingCentral meeting opened with native app:',
      target.meetingId,
    );
  } catch (error) {
    console.warn(
      '[Personal AI] Native RingCentral join failed, falling back to web link:',
      error,
    );
    window.location.assign(target.originalUrl);
  }
}

export function isRingCentralNativeJoinEnabledFromConfig(
  envConfig: Record<string, unknown> | null | undefined,
): boolean {
  return envConfig?.[RINGCENTRAL_NATIVE_JOIN_ENABLED_CONFIG_KEY] !== false;
}

export async function loadRingCentralNativeJoinEnabled(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return true;
  }

  try {
    const result = await chrome.storage.local.get(['envConfig']);
    return isRingCentralNativeJoinEnabledFromConfig(result.envConfig);
  } catch {
    return true;
  }
}

export function watchRingCentralNativeJoinEnabled(
  onChange: (enabled: boolean) => void,
): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => undefined;
  }

  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== 'local' || !changes.envConfig) {
      return;
    }
    onChange(
      isRingCentralNativeJoinEnabledFromConfig(changes.envConfig.newValue),
    );
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function setRingCentralNativeJoinEnabledAttribute(enabled: boolean) {
  document.documentElement.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_ENABLED_ATTR,
    enabled ? 'true' : 'false',
  );
}

function stripTrailingJoinUrlPunctuation(url: string): string {
  return url.replace(/[)\].,;]+$/g, '');
}
