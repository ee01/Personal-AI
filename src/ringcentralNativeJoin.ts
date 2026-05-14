export const RINGCENTRAL_NATIVE_JOIN_ENABLED_CONFIG_KEY =
  'MEETING_NATIVE_CLIENT_JOIN_ENABLED';
export const RINGCENTRAL_NATIVE_JOIN_ENABLED_ATTR =
  'data-pai-ringcentral-native-join-enabled';

const RINGCENTRAL_VIDEO_HOST = 'v.ringcentral.com';
const RINGCENTRAL_VIDEO_NATIVE_SCHEME = 'rcvdt';
const RINGCENTRAL_VIDEO_BROWSER_PROTOCOLS = new Set(['https:', 'http:']);
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_ID =
  'pai-ringcentral-native-join-fallback';
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_LINK_ATTR =
  'data-pai-ringcentral-native-join-fallback-link';
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_URL_ATTR =
  'data-pai-ringcentral-native-join-browser-url';
const RINGCENTRAL_NATIVE_JOIN_LAUNCH_FRAME_ID =
  'pai-ringcentral-native-join-launch-frame';
const RINGCENTRAL_VIDEO_JOIN_URL_PATTERN =
  /(?:https?:\/\/)?v\.ringcentral\.com\/(?:join|conf\/on)\/[^\s"'<>]+/gi;

export interface RingCentralVideoJoinTarget {
  originalUrl: string;
  nativeUrl: string;
  browserUrl: string;
  meetingId: string;
}

export function parseRingCentralVideoJoinTarget(
  rawUrl: string,
  baseUrl: string = getDefaultRingCentralVideoBaseUrl(),
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
        browserUrl: buildRingCentralVideoBrowserJoinUrl(
          meetingId,
          parsed.search,
          parsed.hash,
        ),
        meetingId,
      };
    }

    if (
      !RINGCENTRAL_VIDEO_BROWSER_PROTOCOLS.has(parsed.protocol) ||
      parsed.hostname.toLowerCase() !== RINGCENTRAL_VIDEO_HOST
    ) {
      return null;
    }

    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    const match = normalizedPath.match(/^\/(?:join|conf\/on)\/([^/]+)$/);
    const meetingId = match?.[1]?.trim();
    if (!meetingId) {
      return null;
    }

    const browserUrl = buildRingCentralVideoBrowserJoinUrl(
      meetingId,
      parsed.search,
      parsed.hash,
    );
    return {
      originalUrl: parsed.toString(),
      nativeUrl:
        `${RINGCENTRAL_VIDEO_NATIVE_SCHEME}://join/${meetingId}` +
        `${parsed.search}${parsed.hash}`,
      browserUrl,
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
  let match: RegExpExecArray | null;
  while ((match = RINGCENTRAL_VIDEO_JOIN_URL_PATTERN.exec(text)) !== null) {
    const candidate = normalizeRingCentralVideoJoinUrlProtocol(
      stripTrailingJoinUrlPunctuation(match[0]),
    );
    const target = parseRingCentralVideoJoinTarget(candidate);
    if (target) {
      return target.originalUrl;
    }
  }

  return null;
}

function normalizeRingCentralVideoJoinUrlProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function shouldPreserveDefaultNativeJoinClick(event: MouseEvent): boolean {
  const target = event.target;
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (typeof Element !== 'undefined' &&
      target instanceof Element &&
      Boolean(
        target.closest(`[${RINGCENTRAL_NATIVE_JOIN_FALLBACK_LINK_ATTR}]`),
      ))
  );
}

export function openRingCentralVideoNativeJoin(
  target: RingCentralVideoJoinTarget,
) {
  try {
    showRingCentralNativeJoinFallback(target);
    launchRingCentralNativeProtocol(target.nativeUrl);
    console.info(
      '[Personal AI] RingCentral meeting opened with native app:',
      target.meetingId,
    );
  } catch (error) {
    console.warn(
      '[Personal AI] Native RingCentral join failed, falling back to web link:',
      error,
    );
    window.location.assign(getRingCentralBrowserFallbackUrl(target));
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

function getDefaultRingCentralVideoBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }
  return `https://${RINGCENTRAL_VIDEO_HOST}/`;
}

function showRingCentralNativeJoinFallback(
  target: RingCentralVideoJoinTarget,
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const previous = document.getElementById(RINGCENTRAL_NATIVE_JOIN_FALLBACK_ID);
  previous?.remove();
  const browserUrl = getRingCentralBrowserFallbackUrl(target);

  const host = document.createElement('div');
  host.id = RINGCENTRAL_NATIVE_JOIN_FALLBACK_ID;
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', 'RingCentral app handoff fallback');
  host.setAttribute('aria-live', 'polite');
  host.style.cssText = [
    'position:fixed',
    'right:18px',
    'bottom:18px',
    'z-index:2147483647',
    'box-sizing:border-box',
    'width:min(360px,calc(100vw - 36px))',
    'padding:14px',
    'border:1px solid rgba(15,23,42,0.14)',
    'border-radius:8px',
    'background:#ffffff',
    'box-shadow:0 18px 48px rgba(15,23,42,0.18)',
    'color:#111827',
    'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = 'Opening RingCentral app...';
  title.style.cssText = 'font-weight:700;margin-bottom:4px';
  host.appendChild(title);

  const body = document.createElement('div');
  body.textContent =
    'If the app prompt was cancelled or nothing opened, continue in the browser.';
  body.style.cssText = 'color:#475569;margin-bottom:10px';
  host.appendChild(body);

  const actions = document.createElement('div');
  actions.style.cssText =
    'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';

  const browserButton = document.createElement('button');
  browserButton.type = 'button';
  browserButton.textContent = 'Join in browser';
  browserButton.setAttribute(RINGCENTRAL_NATIVE_JOIN_FALLBACK_LINK_ATTR, 'true');
  browserButton.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_FALLBACK_URL_ATTR,
    browserUrl,
  );
  browserButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    let opened: Window | null = null;
    try {
      opened = window.open(browserUrl, '_blank', 'width=1280,height=900');
    } catch (error) {
      console.warn(
        '[Personal AI] Browser RingCentral join popup failed:',
        error,
      );
    }
    if (opened) {
      try {
        opened.opener = null;
      } catch {
        // Cross-origin popup handles may reject opener changes; fallback closing
        // should still complete.
      }
    }
    host.remove();
  });
  browserButton.style.cssText = [
    'min-height:30px',
    'padding:0 10px',
    'border:0',
    'border-radius:6px',
    'background:#0f172a',
    'color:#ffffff',
    'font:inherit',
    'font-weight:700',
    'cursor:pointer',
  ].join(';');
  actions.appendChild(browserButton);

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.textContent = 'Dismiss';
  dismissButton.style.cssText = [
    'min-height:30px',
    'padding:0 10px',
    'border:1px solid #cbd5e1',
    'border-radius:6px',
    'background:#ffffff',
    'color:#334155',
    'font:inherit',
    'font-weight:600',
    'cursor:pointer',
  ].join(';');
  dismissButton.addEventListener('click', () => host.remove(), {
    once: true,
  });
  actions.appendChild(dismissButton);
  host.appendChild(actions);

  document.body?.appendChild(host);
}

function buildRingCentralVideoBrowserJoinUrl(
  meetingId: string,
  search = '',
  hash = '',
): string {
  return `https://${RINGCENTRAL_VIDEO_HOST}/conf/on/${meetingId}${search}${hash}`;
}

function getRingCentralBrowserFallbackUrl(
  target: RingCentralVideoJoinTarget,
): string {
  return target.browserUrl || target.originalUrl;
}

function launchRingCentralNativeProtocol(nativeUrl: string): void {
  if (typeof document === 'undefined' || !document.body) {
    window.location.assign(nativeUrl);
    return;
  }

  const previousFrame = document.getElementById(
    RINGCENTRAL_NATIVE_JOIN_LAUNCH_FRAME_ID,
  );
  previousFrame?.remove();

  const frame = document.createElement('iframe');
  frame.id = RINGCENTRAL_NATIVE_JOIN_LAUNCH_FRAME_ID;
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = [
    'position:absolute',
    'width:0',
    'height:0',
    'border:0',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(frame);
  frame.src = nativeUrl;
  window.setTimeout(() => frame.remove(), 10000);
}

function stripTrailingJoinUrlPunctuation(url: string): string {
  return url.replace(/[)\]}.,;]+$/g, '');
}
