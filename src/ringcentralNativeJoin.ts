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
const RINGCENTRAL_NATIVE_JOIN_COPY_LINK_ATTR =
  'data-pai-ringcentral-native-join-copy-link';
const RINGCENTRAL_NATIVE_JOIN_PREFER_BROWSER_ATTR =
  'data-pai-ringcentral-native-join-prefer-browser';
const RINGCENTRAL_NATIVE_JOIN_LAUNCH_LINK_ID =
  'pai-ringcentral-native-join-launch-link';
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_ESCALATE_MS = 6000;
const RINGCENTRAL_NATIVE_JOIN_LAUNCH_LINK_TTL_MS = 10000;
const RINGCENTRAL_VIDEO_JOIN_URL_PATTERN =
  /(?:https?:\/\/)?v\.ringcentral\.com\/(?:join|conf\/on)\/[^\s"'<>]+/gi;
const RINGCENTRAL_VIDEO_MEETING_ID_PATTERN = /^[A-Za-z0-9_-]{3,128}$/;

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
      const rawMeetingId =
        parsed.hostname === 'join'
          ? parsed.pathname.replace(/^\/+/, '').split('/')[0]
          : '';
      const meetingId = normalizeRingCentralVideoMeetingId(rawMeetingId);
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
    const meetingId = normalizeRingCentralVideoMeetingId(match?.[1]);
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
        `${RINGCENTRAL_VIDEO_NATIVE_SCHEME}://join/${encodeURIComponent(
          meetingId,
        )}` +
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

function normalizeRingCentralVideoMeetingId(
  rawMeetingId: string | null | undefined,
): string | null {
  const raw = String(rawMeetingId || '').trim();
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);
    if (!RINGCENTRAL_VIDEO_MEETING_ID_PATTERN.test(decoded)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
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
        target.closest(
          `[${RINGCENTRAL_NATIVE_JOIN_FALLBACK_LINK_ATTR}], [${RINGCENTRAL_NATIVE_JOIN_COPY_LINK_ATTR}]`,
        ),
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

export async function setRingCentralNativeJoinEnabled(
  enabled: boolean,
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  const result = await chrome.storage.local.get(['envConfig']);
  await chrome.storage.local.set({
    envConfig: {
      ...(result.envConfig || {}),
      [RINGCENTRAL_NATIVE_JOIN_ENABLED_CONFIG_KEY]: enabled,
    },
  });
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
  let handoffConcernTimer: number | null = null;
  let statusMode: 'handoff' | 'manual' = 'handoff';

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

  const status = document.createElement('div');
  status.textContent = `Meeting ${target.meetingId}`;
  status.setAttribute('data-pai-ringcentral-native-join-status', 'true');
  status.style.cssText = 'color:#64748b;margin-bottom:10px;font-size:12px';
  host.appendChild(status);

  const clearHandoffConcern = (): void => {
    if (
      handoffConcernTimer != null &&
      typeof window.clearTimeout === 'function'
    ) {
      window.clearTimeout(handoffConcernTimer);
    }
    handoffConcernTimer = null;
  };

  const setFallbackStatus = (
    text: string,
    mode: 'handoff' | 'manual' = 'manual',
  ): void => {
    statusMode = mode;
    if (mode === 'manual') {
      clearHandoffConcern();
    }
    status.textContent = text;
  };

  const removeHost = (): void => {
    clearHandoffConcern();
    removeRingCentralNativeLaunchLink();
    host.remove();
  };

  const scheduleHandoffConcern = (): void => {
    if (typeof window.setTimeout !== 'function') {
      return;
    }
    clearHandoffConcern();
    handoffConcernTimer = window.setTimeout(() => {
      if (statusMode !== 'handoff') {
        return;
      }
      status.textContent =
        'Still on this page? RingCentral app may not have opened. Use Join in browser or Copy link.';
    }, RINGCENTRAL_NATIVE_JOIN_FALLBACK_ESCALATE_MS);
  };

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
    const opened = openBrowserFallbackWindow(browserUrl);
    if (opened) {
      removeHost();
      return;
    }

    setFallbackStatus(
      'Popup was blocked. Opening the browser meeting in this tab...',
    );
    try {
      window.location.assign(browserUrl);
    } catch (error) {
      console.warn(
        '[Personal AI] Browser RingCentral same-tab fallback failed:',
        error,
      );
      setFallbackStatus(
        'Browser join could not open. Try the button again or paste the meeting link in a new tab.',
      );
      return;
    }
    removeHost();
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

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = 'Copy link';
  copyButton.setAttribute(RINGCENTRAL_NATIVE_JOIN_COPY_LINK_ATTR, 'true');
  copyButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    copyButton.disabled = true;
    setFallbackStatus('Copying browser meeting link...');
    try {
      await copyTextToClipboard(browserUrl);
      setFallbackStatus('Browser meeting link copied.');
    } catch (error) {
      console.warn(
        '[Personal AI] Failed to copy RingCentral browser join link:',
        error,
      );
      setFallbackStatus(
        'Could not copy the link automatically. Use Join in browser or copy the original meeting link.',
      );
    } finally {
      copyButton.disabled = false;
    }
  });
  copyButton.style.cssText = [
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
  actions.appendChild(copyButton);

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
  dismissButton.addEventListener('click', removeHost, {
    once: true,
  });
  actions.appendChild(dismissButton);
  host.appendChild(actions);

  const defaultBrowserHint = document.createElement('div');
  defaultBrowserHint.style.cssText = [
    'margin-top:10px',
    'color:#64748b',
    'font-size:12px',
    'text-align:right',
  ].join(';');
  defaultBrowserHint.textContent = 'Prefer browser next time? ';
  const preferBrowserButton = document.createElement('button');
  preferBrowserButton.type = 'button';
  preferBrowserButton.textContent = 'Use browser by default';
  preferBrowserButton.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_PREFER_BROWSER_ATTR,
    'true',
  );
  preferBrowserButton.style.cssText = [
    'border:0',
    'padding:0',
    'background:transparent',
    'color:#64748b',
    'font:inherit',
    'font-weight:600',
    'text-decoration:underline',
    'cursor:pointer',
  ].join(';');
  preferBrowserButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    preferBrowserButton.disabled = true;
    setFallbackStatus('Saving browser as the default join path...');
    try {
      await setRingCentralNativeJoinEnabled(false);
      setFallbackStatus(
        'Saved. Future RingCentral joins will use the browser by default.',
      );
    } catch (error) {
      console.warn(
        '[Personal AI] Failed to set RingCentral browser join default:',
        error,
      );
      preferBrowserButton.disabled = false;
      setFallbackStatus(
        'Could not save the default. Open Options > Meeting Pilot to turn off Native Client join.',
      );
    }
  });
  defaultBrowserHint.appendChild(preferBrowserButton);
  host.appendChild(defaultBrowserHint);

  document.body?.appendChild(host);
  scheduleHandoffConcern();
}

function openBrowserFallbackWindow(browserUrl: string): Window | null {
  let opened: Window | null = null;
  try {
    opened = window.open('about:blank', '_blank', 'width=1280,height=900');
  } catch (error) {
    console.warn('[Personal AI] Browser RingCentral join popup failed:', error);
    return null;
  }

  if (!opened) {
    return null;
  }

  try {
    opened.opener = null;
  } catch {
    // The handle can be restricted by the browser. Continue with navigation if
    // possible; same-tab fallback still handles hard failures.
  }

  try {
    opened.location.href = browserUrl;
    return opened;
  } catch (error) {
    console.warn(
      '[Personal AI] Browser RingCentral join popup navigation failed:',
      error,
    );
    try {
      opened.close();
    } catch {
      // Ignore close failures and continue to same-tab fallback.
    }
    return null;
  }
}

function buildRingCentralVideoBrowserJoinUrl(
  meetingId: string,
  search = '',
  hash = '',
): string {
  return `https://${RINGCENTRAL_VIDEO_HOST}/conf/on/${encodeURIComponent(
    meetingId,
  )}${search}${hash}`;
}

function getRingCentralBrowserFallbackUrl(
  target: RingCentralVideoJoinTarget,
): string {
  return target.browserUrl || target.originalUrl;
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined' || !document.body) {
    throw new Error('clipboard_unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:-9999px',
    'opacity:0',
  ].join(';');
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const copied =
    typeof document.execCommand === 'function' &&
    document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('clipboard_unavailable');
  }
}

function launchRingCentralNativeProtocol(nativeUrl: string): void {
  if (typeof document === 'undefined' || !document.body) {
    window.location.assign(nativeUrl);
    return;
  }

  removeRingCentralNativeLaunchLink();

  const link = document.createElement('a');
  link.id = RINGCENTRAL_NATIVE_JOIN_LAUNCH_LINK_ID;
  link.href = nativeUrl;
  link.setAttribute('aria-hidden', 'true');
  link.tabIndex = -1;
  link.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:-9999px',
    'width:1px',
    'height:1px',
    'overflow:hidden',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(link);
  link.click();

  if (typeof window.setTimeout === 'function') {
    window.setTimeout(
      () => link.remove(),
      RINGCENTRAL_NATIVE_JOIN_LAUNCH_LINK_TTL_MS,
    );
  }
}

function removeRingCentralNativeLaunchLink(): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.getElementById(RINGCENTRAL_NATIVE_JOIN_LAUNCH_LINK_ID)?.remove();
}

function stripTrailingJoinUrlPunctuation(url: string): string {
  return url.replace(/[)\]}.,;]+$/g, '');
}
