export const RINGCENTRAL_NATIVE_JOIN_ENABLED_CONFIG_KEY =
  'MEETING_NATIVE_CLIENT_JOIN_ENABLED';
export const RINGCENTRAL_NATIVE_JOIN_ENABLED_ATTR =
  'data-pai-ringcentral-native-join-enabled';
export const RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_SOURCE =
  'personal-ai-ringcentral-native-join-preference';
export const RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_REQUEST =
  'PAI_RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_REQUEST';
export const RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_RESPONSE =
  'PAI_RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_RESPONSE';

const RINGCENTRAL_VIDEO_HOST = 'v.ringcentral.com';
const RINGCENTRAL_VIDEO_NATIVE_SCHEME = 'rcvdt';
const RINGCENTRAL_VIDEO_BROWSER_PROTOCOLS = new Set(['https:', 'http:']);
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_ID =
  'pai-ringcentral-native-join-fallback';
const RINGCENTRAL_NATIVE_JOIN_DISMISSED_RECOVERY_ID =
  'pai-ringcentral-native-join-dismissed-recovery';
const RINGCENTRAL_NATIVE_JOIN_BROWSER_REQUESTED_ID =
  'pai-ringcentral-native-join-browser-requested';
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_LINK_ATTR =
  'data-pai-ringcentral-native-join-fallback-link';
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_URL_ATTR =
  'data-pai-ringcentral-native-join-browser-url';
const RINGCENTRAL_NATIVE_JOIN_COPY_LINK_ATTR =
  'data-pai-ringcentral-native-join-copy-link';
const RINGCENTRAL_NATIVE_JOIN_COPY_MEETING_ID_ATTR =
  'data-pai-ringcentral-native-join-copy-meeting-id';
const RINGCENTRAL_NATIVE_JOIN_COPY_PASSCODE_ATTR =
  'data-pai-ringcentral-native-join-copy-passcode';
const RINGCENTRAL_NATIVE_JOIN_MEETING_ID_VALUE_ATTR =
  'data-pai-ringcentral-native-join-meeting-id-value';
const RINGCENTRAL_NATIVE_JOIN_MEETING_ID_NOTE_ATTR =
  'data-pai-ringcentral-native-join-meeting-id-note';
const RINGCENTRAL_NATIVE_JOIN_PASSCODE_VALUE_ATTR =
  'data-pai-ringcentral-native-join-passcode-value';
const RINGCENTRAL_NATIVE_JOIN_PASSCODE_NOTE_ATTR =
  'data-pai-ringcentral-native-join-passcode-note';
const RINGCENTRAL_NATIVE_JOIN_VISIBLE_LINK_ATTR =
  'data-pai-ringcentral-native-join-visible-link';
const RINGCENTRAL_NATIVE_JOIN_LINK_PRIVACY_ATTR =
  'data-pai-ringcentral-native-join-link-privacy';
const RINGCENTRAL_NATIVE_JOIN_REVEAL_LINK_ATTR =
  'data-pai-ringcentral-native-join-reveal-link';
const RINGCENTRAL_NATIVE_JOIN_RESTORE_RECOVERY_ATTR =
  'data-pai-ringcentral-native-join-restore-recovery';
const RINGCENTRAL_NATIVE_JOIN_PREFER_BROWSER_ATTR =
  'data-pai-ringcentral-native-join-prefer-browser';
const RINGCENTRAL_NATIVE_JOIN_CLOSE_ATTR =
  'data-pai-ringcentral-native-join-close';
const RINGCENTRAL_NATIVE_JOIN_TITLE_ATTR =
  'data-pai-ringcentral-native-join-title';
const RINGCENTRAL_NATIVE_JOIN_BODY_ATTR =
  'data-pai-ringcentral-native-join-body';
const RINGCENTRAL_NATIVE_JOIN_HANDOFF_RECEIPT_ATTR =
  'data-pai-ringcentral-native-join-handoff-receipt';
const RINGCENTRAL_NATIVE_JOIN_DEFAULT_RECEIPT_ATTR =
  'data-pai-ringcentral-native-join-default-receipt';
const RINGCENTRAL_NATIVE_JOIN_LAUNCH_LINK_ID =
  'pai-ringcentral-native-join-launch-link';
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_AUTO_DISMISS_MS = 5000;
const RINGCENTRAL_NATIVE_JOIN_FALLBACK_ESCALATE_MS = 6000;
const RINGCENTRAL_NATIVE_JOIN_LAUNCH_LINK_TTL_MS = 10000;
const RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_TIMEOUT_MS = 3000;
const RINGCENTRAL_VIDEO_JOIN_URL_PATTERN =
  /(?:https?:\/\/)?v\.ringcentral\.com\/(?:join|launcher|conf\/on)\/[^\s"'<>]+/gi;
const RINGCENTRAL_VIDEO_MEETING_ID_PATTERN =
  /^(?=.{3,128}$)[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;
const RINGCENTRAL_JOIN_REDIRECT_PARAM_NAMES = new Set([
  'q',
  'u',
  'url',
  'uri',
  'link',
  'target',
  'to',
  'dest',
  'destination',
  'redirect',
  'redirecturl',
  'redirecturi',
  'meetingurl',
  'meetinguri',
  'joinurl',
]);
const RINGCENTRAL_JOIN_PASSCODE_PARAM_NAMES = new Set([
  'passcode',
  'password',
  'pwd',
  'pw',
  'meetingpasscode',
  'meetingpassword',
]);
const RINGCENTRAL_JOIN_REDIRECT_QUERY_PARAM_PATTERN =
  /(?:^|[?&#])([A-Za-z][A-Za-z0-9_-]{0,30})=([^&\s"'<>]+)/g;

let currentRingCentralNativeJoinFallbackCleanup: (() => void) | null = null;

export interface RingCentralVideoJoinTarget {
  originalUrl: string;
  nativeUrl: string;
  browserUrl: string;
  meetingId: string;
}

export interface RingCentralNativeJoinSetEnabledRequestMessage {
  source: typeof RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_SOURCE;
  target: 'content-script';
  type: typeof RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_REQUEST;
  requestId: string;
  enabled: boolean;
}

export interface RingCentralNativeJoinSetEnabledResponseMessage {
  source: typeof RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_SOURCE;
  target: 'page';
  type: typeof RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_RESPONSE;
  requestId: string;
  success: boolean;
  enabled?: boolean;
  error?: string;
}

interface RingCentralNativeJoinFallbackOptions {
  restoredAfterDismiss?: boolean;
  restoredAfterBrowserRequest?: boolean;
}

export function parseRingCentralVideoJoinTarget(
  rawUrl: string,
  baseUrl: string = getDefaultRingCentralVideoBaseUrl(),
): RingCentralVideoJoinTarget | null {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    if (parsed.protocol === `${RINGCENTRAL_VIDEO_NATIVE_SCHEME}:`) {
      const pathSegments = parsed.pathname.replace(/^\/+/, '').split('/');
      const rawMeetingId =
        parsed.hostname === 'join' && pathSegments.length === 1
          ? pathSegments[0]
          : '';
      const meetingId = normalizeRingCentralVideoMeetingId(rawMeetingId);
      if (!meetingId) return null;
      return {
        originalUrl: parsed.toString(),
        nativeUrl: buildRingCentralVideoNativeJoinUrl(
          meetingId,
          parsed.search,
          parsed.hash,
        ),
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
    const match = normalizedPath.match(
      /^\/(?:join|launcher|conf\/on)\/([^/]+)$/,
    );
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
      nativeUrl: buildRingCentralVideoNativeJoinUrl(
        meetingId,
        parsed.search,
        parsed.hash,
      ),
      browserUrl,
      meetingId,
    };
  } catch {
    return null;
  }
}

export function extractRingCentralVideoJoinUrl(value: unknown): string | null {
  const text = decodeEscapedRingCentralJoinText(value);
  if (!text) return null;

  const redirectParamUrl = extractRingCentralJoinUrlFromRedirectParams(
    text,
    0,
    new Set<string>(),
  );
  if (redirectParamUrl) {
    return redirectParamUrl;
  }

  return extractRingCentralVideoJoinUrlFromText(text, 0, new Set<string>());
}

function extractRingCentralVideoJoinUrlFromText(
  text: string,
  depth: number,
  seenTexts: Set<string>,
): string | null {
  if (!text || seenTexts.has(text)) return null;
  seenTexts.add(text);

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

  const redirectParamUrl = extractRingCentralJoinUrlFromRedirectParams(
    text,
    depth,
    seenTexts,
  );
  if (redirectParamUrl) {
    return redirectParamUrl;
  }

  if (depth < 2) {
    const percentDecodedText = decodePercentEncodedRingCentralJoinText(text);
    if (percentDecodedText !== text) {
      return extractRingCentralVideoJoinUrlFromText(
        percentDecodedText,
        depth + 1,
        seenTexts,
      );
    }
  }

  return null;
}

function decodeEscapedRingCentralJoinText(value: unknown): string {
  const raw = String(value || '');
  if (!raw) return '';

  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function decodePercentEncodedRingCentralJoinText(text: string): string {
  return text.replace(/(?:%[0-9a-fA-F]{2})+/g, (encoded) => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  });
}

function extractRingCentralJoinUrlFromRedirectParams(
  text: string,
  depth: number,
  seenTexts: Set<string>,
): string | null {
  if (depth >= 2) return null;

  RINGCENTRAL_JOIN_REDIRECT_QUERY_PARAM_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while (
    (match = RINGCENTRAL_JOIN_REDIRECT_QUERY_PARAM_PATTERN.exec(text)) !== null
  ) {
    const name = match[1];
    const value = decodeRedirectParamValue(match[2]);
    if (!isRingCentralJoinRedirectParam(name, value)) {
      continue;
    }
    const nestedUrl = extractRingCentralVideoJoinUrlFromText(
      decodeEscapedRingCentralJoinText(value),
      depth + 1,
      seenTexts,
    );
    if (nestedUrl) {
      return nestedUrl;
    }
  }

  return null;
}

function decodeRedirectParamValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch {
    return value;
  }
}

function isRingCentralJoinRedirectParam(name: string, value: string): boolean {
  if (!value || !/ringcentral/i.test(value)) {
    return false;
  }

  const normalizedName = name.toLowerCase().replace(/[-_]/g, '');
  return RINGCENTRAL_JOIN_REDIRECT_PARAM_NAMES.has(normalizedName);
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
          [
            `[${RINGCENTRAL_NATIVE_JOIN_FALLBACK_LINK_ATTR}]`,
            `[${RINGCENTRAL_NATIVE_JOIN_COPY_LINK_ATTR}]`,
            `[${RINGCENTRAL_NATIVE_JOIN_COPY_MEETING_ID_ATTR}]`,
            `[${RINGCENTRAL_NATIVE_JOIN_COPY_PASSCODE_ATTR}]`,
            `[${RINGCENTRAL_NATIVE_JOIN_REVEAL_LINK_ATTR}]`,
            `[${RINGCENTRAL_NATIVE_JOIN_RESTORE_RECOVERY_ATTR}]`,
            `[${RINGCENTRAL_NATIVE_JOIN_PREFER_BROWSER_ATTR}]`,
            `[${RINGCENTRAL_NATIVE_JOIN_CLOSE_ATTR}]`,
          ].join(', '),
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
    await requestRingCentralNativeJoinPreferenceBridge(enabled);
    setRingCentralNativeJoinEnabledAttribute(enabled);
    return;
  }

  const result = await chrome.storage.local.get(['envConfig']);
  await chrome.storage.local.set({
    envConfig: {
      ...(result.envConfig || {}),
      [RINGCENTRAL_NATIVE_JOIN_ENABLED_CONFIG_KEY]: enabled,
    },
  });
  setRingCentralNativeJoinEnabledAttribute(enabled);
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
  options: RingCentralNativeJoinFallbackOptions = {},
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const previousFallbackCleanup = currentRingCentralNativeJoinFallbackCleanup;
  currentRingCentralNativeJoinFallbackCleanup = null;
  previousFallbackCleanup?.();
  document.getElementById(RINGCENTRAL_NATIVE_JOIN_FALLBACK_ID)?.remove();
  document
    .getElementById(RINGCENTRAL_NATIVE_JOIN_DISMISSED_RECOVERY_ID)
    ?.remove();
  document
    .getElementById(RINGCENTRAL_NATIVE_JOIN_BROWSER_REQUESTED_ID)
    ?.remove();

  const browserUrl = getRingCentralBrowserFallbackUrl(target);
  const browserDisplayUrl = buildRingCentralBrowserDisplayUrl(target);
  const browserUrlHasHiddenDetails = browserDisplayUrl !== browserUrl;
  const meetingPasscode = extractRingCentralMeetingPasscode(browserUrl);
  let autoDismissTimer: number | null = null;
  let handoffConcernTimer: number | null = null;
  let statusMode: 'handoff' | 'manual' = 'handoff';
  let browserUrlRevealed = false;
  let revealHiddenBrowserUrlDetails: ((statusText: string) => void) | null =
    null;
  let retryAppButton: HTMLButtonElement | null = null;
  let actions: HTMLDivElement | null = null;

  const setActionBoundary = (
    button: HTMLButtonElement,
    boundary: string,
  ): void => {
    button.setAttribute('aria-label', boundary);
    button.setAttribute('title', boundary);
  };

  const browserFallbackActionBoundary = browserUrlHasHiddenDetails
    ? 'Open this RingCentral meeting in a new browser window using the full meeting link, including hidden passcode/details. Personal AI cannot confirm the new window joined, does not retry the app, copy meeting material, or change the default join path.'
    : 'Open this RingCentral meeting in a new browser window using the browser meeting link. Personal AI cannot confirm the new window joined, does not retry the app, copy meeting material, or change the default join path.';
  const copyLinkActionBoundary = browserUrlHasHiddenDetails
    ? 'Copy the full RingCentral browser meeting link, including hidden passcode/details. This does not join the meeting, retry the app, or change the default join path.'
    : 'Copy the RingCentral browser meeting link. This does not join the meeting, retry the app, or change the default join path.';
  const copyMeetingIdActionBoundary =
    'Copy only the RingCentral Meeting ID for manual app entry. This does not join the meeting, copy passcode/details, copy the full browser link, retry the app, or change the default join path.';
  const copyPasscodeActionBoundary =
    'Copy only the RingCentral meeting passcode for manual app entry. The value stays hidden in this panel; this does not join the meeting, retry the app, copy the full browser link, copy the Meeting ID, or change the default join path.';
  const closeActionBoundary =
    'Hide this RingCentral recovery panel and leave a compact Restore recovery strip. This does not confirm joining, retry the app, open the browser fallback, copy meeting material, or change the default join path.';
  const retryAppActionBoundary =
    'Try opening this validated RingCentral app link again. This does not open the browser fallback, copy meeting material, or change the default join path; Personal AI still cannot confirm whether you joined.';

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
    'max-height:min(680px,calc(100vh - 36px))',
    'overflow:auto',
    'overscroll-behavior:contain',
    'padding:14px 42px 14px 14px',
    'border:1px solid rgba(15,23,42,0.14)',
    'border-radius:8px',
    'background:#ffffff',
    'box-shadow:0 18px 48px rgba(15,23,42,0.18)',
    'color:#111827',
    'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'x';
  setActionBoundary(closeButton, closeActionBoundary);
  closeButton.setAttribute(RINGCENTRAL_NATIVE_JOIN_CLOSE_ATTR, 'true');
  closeButton.style.cssText = [
    'position:absolute',
    'top:8px',
    'right:8px',
    'width:26px',
    'height:26px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
    'border:0',
    'border-radius:6px',
    'background:transparent',
    'color:#64748b',
    'font:16px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'font-weight:700',
    'cursor:pointer',
  ].join(';');
  host.appendChild(closeButton);

  const title = document.createElement('div');
  title.textContent = 'Opening RingCentral app...';
  title.setAttribute(RINGCENTRAL_NATIVE_JOIN_TITLE_ATTR, 'true');
  title.style.cssText = 'font-weight:700;margin-bottom:4px';
  host.appendChild(title);

  const body = document.createElement('div');
  body.textContent =
    'If Chrome asks, choose Open RingCentral. If you cancel or nothing opens, continue in the browser.';
  body.setAttribute(RINGCENTRAL_NATIVE_JOIN_BODY_ATTR, 'true');
  body.style.cssText = 'color:#475569;margin-bottom:10px';
  host.appendChild(body);

  const status = document.createElement('div');
  status.textContent = `Meeting ${target.meetingId} - waiting for the app prompt.`;
  status.setAttribute('data-pai-ringcentral-native-join-status', 'true');
  status.style.cssText = 'color:#64748b;margin-bottom:10px;font-size:12px';
  host.appendChild(status);

  const handoffReceipt = document.createElement('div');
  handoffReceipt.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_HANDOFF_RECEIPT_ATTR,
    'true',
  );
  handoffReceipt.style.cssText = [
    'margin-bottom:10px',
    'padding:8px 9px',
    'border:1px solid #dbeafe',
    'border-left:3px solid #2563eb',
    'border-radius:6px',
    'background:#eff6ff',
    'color:#1e3a8a',
    'font-size:12px',
    'line-height:1.35',
  ].join(';');
  const handoffReceiptLabel = document.createElement('div');
  handoffReceiptLabel.textContent = 'Handoff receipt';
  handoffReceiptLabel.style.cssText =
    'margin-bottom:3px;color:#1d4ed8;font-weight:700';
  const handoffReceiptBody = document.createElement('div');
  const setHandoffReceipt = (text: string): void => {
    handoffReceiptBody.textContent = text;
  };
  setHandoffReceipt(
    'App attempt started from this click and uses the validated full meeting link, including passcode/details if present. Personal AI cannot verify whether the RingCentral app opened or whether you joined, so browser recovery stays available. The displayed link hides passcode/details only in this panel; recovery actions keep the full meeting link. Default join preference has not changed.',
  );
  handoffReceipt.appendChild(handoffReceiptLabel);
  handoffReceipt.appendChild(handoffReceiptBody);
  host.appendChild(handoffReceipt);

  const browserUrlBlock = document.createElement('div');
  browserUrlBlock.style.cssText = [
    'margin-bottom:10px',
    'padding:8px',
    'border:1px solid #e2e8f0',
    'border-radius:6px',
    'background:#f8fafc',
    'color:#475569',
    'font-size:12px',
    'word-break:break-all',
  ].join(';');
  const browserUrlLabel = document.createElement('div');
  browserUrlLabel.textContent = 'Browser link';
  browserUrlLabel.style.cssText =
    'margin-bottom:3px;color:#64748b;font-weight:600';
  browserUrlBlock.appendChild(browserUrlLabel);
  const browserUrlText = document.createElement('span');
  browserUrlText.textContent = browserDisplayUrl;
  browserUrlText.setAttribute(RINGCENTRAL_NATIVE_JOIN_VISIBLE_LINK_ATTR, 'true');
  browserUrlBlock.appendChild(browserUrlText);
  if (browserUrlHasHiddenDetails) {
    const browserUrlPrivacyNote = document.createElement('div');
    browserUrlPrivacyNote.setAttribute(
      RINGCENTRAL_NATIVE_JOIN_LINK_PRIVACY_ATTR,
      'true',
    );
    browserUrlPrivacyNote.style.cssText =
      'margin-top:6px;color:#64748b;font-size:11px;line-height:1.35';
    const revealFullLinkButton = document.createElement('button');
    revealFullLinkButton.type = 'button';
    revealFullLinkButton.setAttribute(
      RINGCENTRAL_NATIVE_JOIN_REVEAL_LINK_ATTR,
      'true',
    );
    revealFullLinkButton.style.cssText = [
      'margin-top:6px',
      'border:0',
      'padding:0',
      'background:transparent',
      'color:#0f172a',
      'font:inherit',
      'font-size:12px',
      'font-weight:700',
      'text-decoration:underline',
      'cursor:pointer',
    ].join(';');

    const updateVisibleBrowserLink = (): void => {
      browserUrlText.textContent = browserUrlRevealed
        ? browserUrl
        : browserDisplayUrl;
      browserUrlPrivacyNote.textContent = browserUrlRevealed
        ? 'Full link is visible now. Hide it before sharing your screen.'
        : 'Passcode and extra URL details are hidden here; Join in browser and Copy link still use the full meeting link.';
      revealFullLinkButton.textContent = browserUrlRevealed
        ? 'Hide full link'
        : 'Show full link';
      setActionBoundary(
        revealFullLinkButton,
        browserUrlRevealed
          ? 'Hide the full RingCentral browser meeting link from this panel and return to the safer display URL. This does not delete the link, copy meeting material, join the meeting, retry the app, or change the default join path.'
          : 'Show the full RingCentral browser meeting link in this panel, including hidden passcode/details. This does not copy the link, open the browser fallback, retry the app, join the meeting, or change the default join path; hide it before sharing your screen.',
      );
    };
    revealHiddenBrowserUrlDetails = (statusText: string): void => {
      browserUrlRevealed = true;
      updateVisibleBrowserLink();
      setFallbackStatus(statusText);
    };

    revealFullLinkButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      browserUrlRevealed = !browserUrlRevealed;
      updateVisibleBrowserLink();
      setFallbackStatus(
        browserUrlRevealed
          ? 'Full browser link is visible. Hide it before sharing your screen.'
          : 'Full browser link hidden. Join in browser and Copy link still preserve it.',
      );
    });

    updateVisibleBrowserLink();
    browserUrlBlock.appendChild(browserUrlPrivacyNote);
    browserUrlBlock.appendChild(revealFullLinkButton);
  }
  host.appendChild(browserUrlBlock);

  const meetingIdBlock = document.createElement('div');
  meetingIdBlock.style.cssText = [
    'margin-bottom:10px',
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:8px',
    'padding:7px 8px',
    'border:1px solid #e2e8f0',
    'border-radius:6px',
    'background:#ffffff',
    'color:#475569',
    'font-size:12px',
  ].join(';');
  const meetingIdText = document.createElement('div');
  meetingIdText.style.cssText =
    'min-width:0;display:flex;flex-direction:column;gap:2px';
  const meetingIdLabel = document.createElement('span');
  meetingIdLabel.textContent = 'Meeting ID';
  meetingIdLabel.style.cssText = 'color:#64748b;font-weight:600';
  const meetingIdValue = document.createElement('span');
  meetingIdValue.textContent = target.meetingId;
  meetingIdValue.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_MEETING_ID_VALUE_ATTR,
    'true',
  );
  meetingIdValue.style.cssText =
    'color:#0f172a;font-weight:700;word-break:break-all';
  const meetingIdNote = document.createElement('span');
  meetingIdNote.textContent = browserUrlHasHiddenDetails
    ? 'ID only for manual app entry; passcode/details stay in Join in browser, Copy link, or Show full link.'
    : 'ID only for manual app entry; copying it does not join or change defaults.';
  meetingIdNote.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_MEETING_ID_NOTE_ATTR,
    'true',
  );
  meetingIdNote.style.cssText =
    'color:#64748b;font-size:11px;line-height:1.3;max-width:220px';
  meetingIdText.appendChild(meetingIdLabel);
  meetingIdText.appendChild(meetingIdValue);
  meetingIdText.appendChild(meetingIdNote);
  meetingIdBlock.appendChild(meetingIdText);

  const copyMeetingIdButton = document.createElement('button');
  copyMeetingIdButton.type = 'button';
  copyMeetingIdButton.textContent = 'Copy ID';
  copyMeetingIdButton.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_COPY_MEETING_ID_ATTR,
    'true',
  );
  setActionBoundary(copyMeetingIdButton, copyMeetingIdActionBoundary);
  copyMeetingIdButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    copyMeetingIdButton.disabled = true;
    setFallbackStatus('Copying meeting ID...');
    try {
      await copyTextToClipboard(target.meetingId);
      setFallbackStatus(
        'Meeting ID copied. This does not join the meeting, copy passcode/details, or change the default join path.',
      );
    } catch (error) {
      console.warn(
        '[Personal AI] Failed to copy RingCentral meeting ID:',
        error,
      );
      setFallbackStatus(
        'Could not copy the meeting ID. Select the Meeting ID shown above for manual app join.',
      );
    } finally {
      copyMeetingIdButton.disabled = false;
    }
  });
  copyMeetingIdButton.style.cssText = [
    'flex:0 0 auto',
    'min-height:28px',
    'padding:0 9px',
    'border:1px solid #cbd5e1',
    'border-radius:6px',
    'background:#f8fafc',
    'color:#334155',
    'font:inherit',
    'font-weight:700',
    'cursor:pointer',
  ].join(';');
  meetingIdBlock.appendChild(copyMeetingIdButton);
  host.appendChild(meetingIdBlock);

  if (meetingPasscode) {
    const passcodeBlock = document.createElement('div');
    passcodeBlock.style.cssText = [
      'margin-bottom:10px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:8px',
      'padding:7px 8px',
      'border:1px solid #fde68a',
      'border-radius:6px',
      'background:#fffbeb',
      'color:#78350f',
      'font-size:12px',
    ].join(';');
    const passcodeText = document.createElement('div');
    passcodeText.style.cssText =
      'min-width:0;display:flex;flex-direction:column;gap:2px';
    const passcodeLabel = document.createElement('span');
    passcodeLabel.textContent = 'Meeting passcode';
    passcodeLabel.style.cssText = 'color:#92400e;font-weight:600';
    const passcodeValue = document.createElement('span');
    passcodeValue.textContent = 'Hidden until copied';
    passcodeValue.setAttribute(
      RINGCENTRAL_NATIVE_JOIN_PASSCODE_VALUE_ATTR,
      'true',
    );
    passcodeValue.style.cssText = 'color:#0f172a;font-weight:700';
    const passcodeNote = document.createElement('span');
    passcodeNote.textContent =
      'For manual app entry only; value stays hidden in this panel.';
    passcodeNote.setAttribute(
      RINGCENTRAL_NATIVE_JOIN_PASSCODE_NOTE_ATTR,
      'true',
    );
    passcodeNote.style.cssText =
      'color:#92400e;font-size:11px;line-height:1.3;max-width:220px';
    passcodeText.appendChild(passcodeLabel);
    passcodeText.appendChild(passcodeValue);
    passcodeText.appendChild(passcodeNote);
    passcodeBlock.appendChild(passcodeText);

    const copyPasscodeButton = document.createElement('button');
    copyPasscodeButton.type = 'button';
    copyPasscodeButton.textContent = 'Copy passcode';
    copyPasscodeButton.setAttribute(
      RINGCENTRAL_NATIVE_JOIN_COPY_PASSCODE_ATTR,
      'true',
    );
    setActionBoundary(copyPasscodeButton, copyPasscodeActionBoundary);
    copyPasscodeButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      copyPasscodeButton.disabled = true;
      setFallbackStatus('Copying meeting passcode...');
      try {
        await copyTextToClipboard(meetingPasscode);
        setFallbackStatus(
          'Meeting passcode copied for manual app entry. This does not join the meeting, retry the app, copy the full link, or change the default join path.',
        );
      } catch (error) {
        console.warn(
          '[Personal AI] Failed to copy RingCentral meeting passcode:',
          error,
        );
        setFallbackStatus(
          'Could not copy the meeting passcode. Use Show full link only if you need to inspect the full invitation details.',
        );
      } finally {
        copyPasscodeButton.disabled = false;
      }
    });
    copyPasscodeButton.style.cssText = [
      'flex:0 0 auto',
      'min-height:28px',
      'padding:0 9px',
      'border:1px solid #f59e0b',
      'border-radius:6px',
      'background:#ffffff',
      'color:#78350f',
      'font:inherit',
      'font-weight:700',
      'cursor:pointer',
    ].join(';');
    passcodeBlock.appendChild(copyPasscodeButton);
    host.appendChild(passcodeBlock);
  }

  const clearHandoffConcern = (): void => {
    if (
      handoffConcernTimer != null &&
      typeof window.clearTimeout === 'function'
    ) {
      window.clearTimeout(handoffConcernTimer);
    }
    handoffConcernTimer = null;
  };

  const clearAutoDismiss = (): void => {
    if (
      autoDismissTimer != null &&
      typeof window.clearTimeout === 'function'
    ) {
      window.clearTimeout(autoDismissTimer);
    }
    autoDismissTimer = null;
  };

  const setFallbackStatus = (
    text: string,
    mode: 'handoff' | 'manual' = 'manual',
  ): void => {
    statusMode = mode;
    if (mode === 'manual') {
      clearAutoDismiss();
      clearHandoffConcern();
    }
    status.textContent = text;
  };

  const removeHost = (): void => {
    clearAutoDismiss();
    clearHandoffConcern();
    removeRingCentralNativeLaunchLink();
    if (currentRingCentralNativeJoinFallbackCleanup === removeHost) {
      currentRingCentralNativeJoinFallbackCleanup = null;
    }
    host.remove();
  };
  currentRingCentralNativeJoinFallbackCleanup = removeHost;

  const setHandoffRecoveryState = (): void => {
    title.textContent = 'RingCentral app did not take over';
    body.textContent =
      'Use the browser fallback if the app prompt was cancelled or nothing opened.';
    setHandoffReceipt(
      'No app takeover was detected in this tab. This does not prove the app failed or that you joined elsewhere. Continue in browser or copy the full meeting link. Default join preference stays unchanged unless you change it below.',
    );
    setFallbackStatus(
      'Still on this page? Use Join in browser or Copy link to continue.',
    );
    ensureRetryAppButton();
  };

  closeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    removeHost();
    showRingCentralNativeJoinDismissedRecovery(target);
  });

  const scheduleHandoffConcern = (): void => {
    if (typeof window.setTimeout !== 'function') {
      return;
    }
    clearHandoffConcern();
    handoffConcernTimer = window.setTimeout(() => {
      handoffConcernTimer = null;
      if (statusMode !== 'handoff') {
        return;
      }
      setHandoffRecoveryState();
    }, RINGCENTRAL_NATIVE_JOIN_FALLBACK_ESCALATE_MS);
  };

  const scheduleAutoDismiss = (): void => {
    if (typeof window.setTimeout !== 'function') {
      return;
    }
    clearAutoDismiss();
    autoDismissTimer = window.setTimeout(() => {
      autoDismissTimer = null;
      if (statusMode !== 'handoff') {
        return;
      }
      if (isRingCentralNativeJoinFallbackPageStillActive()) {
        setHandoffRecoveryState();
        return;
      }
      removeHost();
    }, RINGCENTRAL_NATIVE_JOIN_FALLBACK_AUTO_DISMISS_MS);
  };

  const setHandoffRetryState = (): void => {
    clearAutoDismiss();
    clearHandoffConcern();
    statusMode = 'handoff';
    title.textContent = 'Trying RingCentral app again...';
    body.textContent =
      'Chrome may show the external app prompt again. Browser recovery stays here.';
    setHandoffReceipt(
      'App retry started from this recovery panel and reuses the validated full meeting link. Personal AI still cannot verify whether the RingCentral app opened or whether you joined, so browser recovery and Copy link stay available. Default join preference has not changed.',
    );
    status.textContent =
      'Trying the RingCentral app again. Keep this browser recovery open until the app takes over.';
    scheduleAutoDismiss();
    scheduleHandoffConcern();
  };

  const ensureRetryAppButton = (): void => {
    if (retryAppButton || !actions) {
      return;
    }

    retryAppButton = document.createElement('button');
    retryAppButton.type = 'button';
    retryAppButton.textContent = 'Try app again';
    setActionBoundary(retryAppButton, retryAppActionBoundary);
    retryAppButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setHandoffRetryState();
      try {
        launchRingCentralNativeProtocol(target.nativeUrl);
      } catch (error) {
        console.warn('[Personal AI] Native RingCentral retry failed:', error);
        setHandoffRecoveryState();
        setFallbackStatus(
          'App retry could not start. Use Join in browser or Copy link.',
        );
      }
    });
    retryAppButton.style.cssText = [
      'min-height:30px',
      'padding:0 10px',
      'border:1px solid #93c5fd',
      'border-radius:6px',
      'background:#eff6ff',
      'color:#1d4ed8',
      'font:inherit',
      'font-weight:700',
      'cursor:pointer',
    ].join(';');
    actions.appendChild(retryAppButton);
  };

  const setRestoredRecoveryState = (
    source: 'hidden' | 'browser-request',
  ): void => {
    title.textContent = 'RingCentral recovery restored';
    if (source === 'browser-request') {
      body.textContent =
        'No new app attempt or browser window started. Use the recovery controls below only if you need another explicit handoff.';
      setHandoffReceipt(
        'Recovery panel restored after a browser join request. Personal AI did not open another browser window, retry the app, copy a link, or change the default join path. The earlier browser window request remains unconfirmed.',
      );
      setFallbackStatus(
        'Recovery restored after browser request. No join was confirmed; default join preference is unchanged.',
      );
    } else {
      body.textContent =
        'No new app attempt started. Use the recovery controls below or retry the app explicitly.';
      setHandoffReceipt(
        'Recovery panel restored after being hidden. Personal AI did not retry the app, join in browser, copy a link, or change the default join path. Use Try app again for a new app handoff, or Join in browser / Copy link to continue with the browser recovery path.',
      );
      setFallbackStatus(
        'Recovery restored. No join was confirmed; default join preference is unchanged.',
      );
    }
    ensureRetryAppButton();
  };

  actions = document.createElement('div');
  actions.style.cssText =
    'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';

  const browserButton = document.createElement('button');
  browserButton.type = 'button';
  browserButton.textContent = 'Join in browser';
  browserButton.setAttribute(RINGCENTRAL_NATIVE_JOIN_FALLBACK_LINK_ATTR, 'true');
  setActionBoundary(browserButton, browserFallbackActionBoundary);
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
      showRingCentralNativeJoinBrowserRequestedReceipt(target);
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
        'Browser join could not open. Try the button again or paste the browser link in a new tab.',
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
  setActionBoundary(copyButton, copyLinkActionBoundary);
  copyButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    copyButton.disabled = true;
    setFallbackStatus('Copying browser meeting link...');
    try {
      await copyTextToClipboard(browserUrl);
      setFallbackStatus(
        'Full browser meeting link copied, including hidden passcode/details if present. This does not join the meeting, retry the app, or change the default join path.',
      );
    } catch (error) {
      console.warn(
        '[Personal AI] Failed to copy RingCentral browser join link:',
        error,
      );
      if (browserUrlHasHiddenDetails && revealHiddenBrowserUrlDetails) {
        revealHiddenBrowserUrlDetails(
          'Copy failed. Full browser link is visible for manual copy; hide it before sharing your screen.',
        );
      } else {
        setFallbackStatus(
          'Could not copy the link automatically. Use Join in browser or select the browser link.',
        );
      }
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

  host.appendChild(actions);

  const defaultBrowserHint = document.createElement('div');
  defaultBrowserHint.style.cssText = [
    'margin-top:10px',
    'color:#64748b',
    'font-size:12px',
    'text-align:right',
  ].join(';');
  const defaultPreferenceReceipt = document.createElement('div');
  defaultPreferenceReceipt.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_DEFAULT_RECEIPT_ATTR,
    'true',
  );
  defaultPreferenceReceipt.style.cssText = [
    'display:none',
    'margin-top:10px',
    'padding:7px 8px',
    'border:1px solid #dcfce7',
    'border-left:3px solid #16a34a',
    'border-radius:6px',
    'background:#f0fdf4',
    'color:#166534',
    'font-size:11px',
    'line-height:1.35',
  ].join(';');
  const defaultPreferenceReceiptLabel = document.createElement('div');
  defaultPreferenceReceiptLabel.textContent = 'Default path receipt';
  defaultPreferenceReceiptLabel.style.cssText =
    'margin-bottom:2px;color:#15803d;font-weight:700';
  const defaultPreferenceReceiptBody = document.createElement('div');
  const setDefaultPreferenceReceipt = (
    text: string,
    state: 'saved' | 'failed' = 'saved',
  ): void => {
    defaultPreferenceReceipt.style.display = 'block';
    if (state === 'failed') {
      defaultPreferenceReceipt.style.border = '1px solid #fecaca';
      defaultPreferenceReceipt.style.borderLeft = '3px solid #dc2626';
      defaultPreferenceReceipt.style.background = '#fef2f2';
      defaultPreferenceReceipt.style.color = '#991b1b';
      defaultPreferenceReceiptLabel.style.color = '#b91c1c';
    } else {
      defaultPreferenceReceipt.style.border = '1px solid #dcfce7';
      defaultPreferenceReceipt.style.borderLeft = '3px solid #16a34a';
      defaultPreferenceReceipt.style.background = '#f0fdf4';
      defaultPreferenceReceipt.style.color = '#166534';
      defaultPreferenceReceiptLabel.style.color = '#15803d';
    }
    defaultPreferenceReceiptBody.textContent = text;
  };
  defaultPreferenceReceipt.appendChild(defaultPreferenceReceiptLabel);
  defaultPreferenceReceipt.appendChild(defaultPreferenceReceiptBody);
  const defaultPreferencePrompt = document.createTextNode('');
  defaultBrowserHint.appendChild(defaultPreferencePrompt);
  const defaultPreferenceButton = document.createElement('button');
  defaultPreferenceButton.type = 'button';
  defaultPreferenceButton.setAttribute(
    RINGCENTRAL_NATIVE_JOIN_PREFER_BROWSER_ATTR,
    'true',
  );
  defaultPreferenceButton.style.cssText = [
    'border:0',
    'padding:0',
    'background:transparent',
    'color:#64748b',
    'font:inherit',
    'font-weight:600',
    'text-decoration:underline',
    'cursor:pointer',
  ].join(';');
  let nativeJoinPreferred =
    document.documentElement.getAttribute(
      RINGCENTRAL_NATIVE_JOIN_ENABLED_ATTR,
    ) !== 'false';
  const updateDefaultPreferenceControl = (): void => {
    defaultPreferencePrompt.textContent = nativeJoinPreferred
      ? 'Prefer browser next time? '
      : 'Prefer app next time? ';
    defaultPreferenceButton.textContent = nativeJoinPreferred
      ? 'Use browser by default'
      : 'Use app by default';
    setActionBoundary(
      defaultPreferenceButton,
      nativeJoinPreferred
        ? 'Save browser as the future default for RingCentral joins. This preference write does not join the current meeting, retry the app, open a browser window, copy meeting material, or remove current recovery controls.'
        : 'Save the RingCentral app as the future default for RingCentral joins. This preference write does not join the current meeting, retry the app, open a browser window, copy meeting material, or remove current recovery controls.',
    );
  };
  updateDefaultPreferenceControl();
  defaultPreferenceButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const nextNativeJoinPreferred = !nativeJoinPreferred;
    defaultPreferenceButton.disabled = true;
    setFallbackStatus(
      nextNativeJoinPreferred
        ? 'Saving RingCentral app as the default join path...'
        : 'Saving browser as the default join path...',
    );
    try {
      await setRingCentralNativeJoinEnabled(nextNativeJoinPreferred);
      nativeJoinPreferred = nextNativeJoinPreferred;
      updateDefaultPreferenceControl();
      setHandoffReceipt(
        nextNativeJoinPreferred
          ? 'Default saved for future joins: Personal AI will try the RingCentral app first. This meeting still has the browser recovery link available.'
          : 'Default saved for future joins: Personal AI will leave RingCentral meetings in the browser. This meeting still has the browser recovery link available.',
      );
      setDefaultPreferenceReceipt(
        nextNativeJoinPreferred
          ? 'Saved future default: try the RingCentral app first. This preference write did not join this meeting, retry the app, open a browser window, copy meeting material, or remove current recovery controls.'
          : 'Saved future default: use the browser first. This preference write did not join this meeting, retry the app, open a browser window, copy meeting material, or remove current recovery controls.',
      );
      setFallbackStatus(
        nextNativeJoinPreferred
          ? 'Saved. Future RingCentral joins will try the app first.'
          : 'Saved. Future RingCentral joins will use the browser by default.',
      );
    } catch (error) {
      console.warn(
        '[Personal AI] Failed to set RingCentral join default:',
        error,
      );
      setHandoffReceipt(
        'Default join preference was not saved. This click did not change future RingCentral joins, did not join this meeting, did not retry the app, did not open the browser meeting, and did not copy any meeting material. Current browser recovery controls remain available.',
      );
      setDefaultPreferenceReceipt(
        'Default path was not saved. Future RingCentral joins keep the previous preference; this click also did not join this meeting, retry the app, open a browser window, copy meeting material, or remove current recovery controls.',
        'failed',
      );
      setFallbackStatus(
        'Could not save the default; current join preference is unchanged. Open Options > Meeting Pilot to change Native Client join.',
      );
    } finally {
      defaultPreferenceButton.disabled = false;
    }
  });
  defaultBrowserHint.appendChild(defaultPreferenceButton);
  host.appendChild(defaultBrowserHint);
  host.appendChild(defaultPreferenceReceipt);

  document.body?.appendChild(host);
  if (options.restoredAfterBrowserRequest) {
    setRestoredRecoveryState('browser-request');
  } else if (options.restoredAfterDismiss) {
    setRestoredRecoveryState('hidden');
  } else {
    scheduleAutoDismiss();
    scheduleHandoffConcern();
  }
}

function showRingCentralNativeJoinDismissedRecovery(
  target: RingCentralVideoJoinTarget,
): void {
  showRingCentralNativeJoinCompactReceipt(target, {
    id: RINGCENTRAL_NATIVE_JOIN_DISMISSED_RECOVERY_ID,
    label: 'RingCentral app handoff hidden recovery',
    title: 'RingCentral handoff hidden',
    body:
      'No join was confirmed and the default path is unchanged. Restore recovery if the app prompt was cancelled.',
    closeBoundary:
      'Close this compact RingCentral hidden-handoff strip. This does not confirm joining, restore the recovery panel, retry the app, open the browser fallback, copy meeting material, or change the default join path.',
    restoreBoundary:
      'Restore browser recovery controls for this RingCentral handoff. This does not retry the app, open the browser fallback, copy meeting material, change the default join path, or confirm that you joined.',
    restoreMode: 'hidden',
  });
}

function showRingCentralNativeJoinBrowserRequestedReceipt(
  target: RingCentralVideoJoinTarget,
): void {
  showRingCentralNativeJoinCompactReceipt(target, {
    id: RINGCENTRAL_NATIVE_JOIN_BROWSER_REQUESTED_ID,
    label: 'RingCentral browser join requested receipt',
    title: 'Browser join requested',
    body:
      'A browser meeting window was opened, but Personal AI cannot confirm you joined. The app was not retried and the default path is unchanged.',
    closeBoundary:
      'Close this compact RingCentral browser-request receipt. This does not confirm joining, restore the recovery panel, retry the app, open another browser window, copy meeting material, or change the default join path.',
    restoreBoundary:
      'Restore RingCentral recovery after the browser join request. This does not open another browser window, retry the app, copy meeting material, change the default join path, or confirm the previous browser join.',
    restoreMode: 'browser-request',
  });
}

function showRingCentralNativeJoinCompactReceipt(
  target: RingCentralVideoJoinTarget,
  options: {
    id: string;
    label: string;
    title: string;
    body: string;
    closeBoundary: string;
    restoreBoundary: string;
    restoreMode: 'hidden' | 'browser-request';
  },
): void {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  document
    .getElementById(RINGCENTRAL_NATIVE_JOIN_DISMISSED_RECOVERY_ID)
    ?.remove();
  document
    .getElementById(RINGCENTRAL_NATIVE_JOIN_BROWSER_REQUESTED_ID)
    ?.remove();

  const strip = document.createElement('div');
  strip.id = options.id;
  strip.setAttribute('role', 'status');
  strip.setAttribute('aria-live', 'polite');
  strip.setAttribute('aria-label', options.label);
  strip.style.cssText = [
    'position:fixed',
    'right:18px',
    'bottom:18px',
    'z-index:2147483647',
    'box-sizing:border-box',
    'width:min(320px,calc(100vw - 36px))',
    'padding:10px 38px 10px 12px',
    'border:1px solid rgba(15,23,42,0.14)',
    'border-left:3px solid #f59e0b',
    'border-radius:8px',
    'background:#fffbeb',
    'box-shadow:0 14px 34px rgba(15,23,42,0.16)',
    'color:#78350f',
    'font:12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'x';
  close.setAttribute('aria-label', options.closeBoundary);
  close.setAttribute('title', options.closeBoundary);
  close.setAttribute(RINGCENTRAL_NATIVE_JOIN_CLOSE_ATTR, 'true');
  close.style.cssText = [
    'position:absolute',
    'top:7px',
    'right:7px',
    'width:24px',
    'height:24px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
    'border:0',
    'border-radius:6px',
    'background:transparent',
    'color:#92400e',
    'font:15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'font-weight:700',
    'cursor:pointer',
  ].join(';');
  strip.appendChild(close);

  const title = document.createElement('div');
  title.textContent = options.title;
  title.style.cssText = 'font-weight:700;margin-bottom:3px';
  strip.appendChild(title);

  const body = document.createElement('div');
  body.textContent = options.body;
  body.style.cssText = 'margin-bottom:7px';
  strip.appendChild(body);

  const restore = document.createElement('button');
  restore.type = 'button';
  restore.textContent = 'Restore recovery';
  restore.setAttribute(RINGCENTRAL_NATIVE_JOIN_RESTORE_RECOVERY_ATTR, 'true');
  restore.setAttribute('aria-label', options.restoreBoundary);
  restore.setAttribute('title', options.restoreBoundary);
  restore.style.cssText = [
    'min-height:28px',
    'padding:0 9px',
    'border:1px solid #f59e0b',
    'border-radius:6px',
    'background:#ffffff',
    'color:#78350f',
    'font:inherit',
    'font-weight:700',
    'cursor:pointer',
  ].join(';');
  strip.appendChild(restore);

  let dismissTimer: number | null = null;
  const removeStrip = (): void => {
    if (
      dismissTimer != null &&
      typeof window !== 'undefined' &&
      typeof window.clearTimeout === 'function'
    ) {
      window.clearTimeout(dismissTimer);
    }
    dismissTimer = null;
    strip.remove();
  };

  close.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    removeStrip();
  });

  restore.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    removeStrip();
    showRingCentralNativeJoinFallback(target, {
      restoredAfterBrowserRequest: options.restoreMode === 'browser-request',
      restoredAfterDismiss: options.restoreMode === 'hidden',
    });
  });

  document.body.appendChild(strip);

  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    dismissTimer = window.setTimeout(removeStrip, 12000);
  }
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

function isRingCentralNativeJoinFallbackPageStillActive(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  if (
    typeof document.visibilityState === 'string' &&
    document.visibilityState !== 'visible'
  ) {
    return false;
  }

  if (typeof document.hasFocus === 'function') {
    try {
      return document.hasFocus();
    } catch {
      return true;
    }
  }

  return true;
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

function buildRingCentralVideoNativeJoinUrl(
  meetingId: string,
  search = '',
  hash = '',
): string {
  return `${RINGCENTRAL_VIDEO_NATIVE_SCHEME}://join/${encodeURIComponent(
    meetingId,
  )}${search}${hash}`;
}

function buildRingCentralBrowserDisplayUrl(
  target: RingCentralVideoJoinTarget,
): string {
  return buildRingCentralVideoBrowserJoinUrl(target.meetingId);
}

function getRingCentralBrowserFallbackUrl(
  target: RingCentralVideoJoinTarget,
): string {
  return target.browserUrl || target.originalUrl;
}

function extractRingCentralMeetingPasscode(browserUrl: string): string {
  try {
    const parsed = new URL(browserUrl, `https://${RINGCENTRAL_VIDEO_HOST}/`);
    let passcode = '';
    parsed.searchParams.forEach((value, name) => {
      if (passcode) {
        return;
      }
      const normalizedName = name.toLowerCase().replace(/[-_]/g, '');
      const normalizedValue = value.trim();
      if (
        RINGCENTRAL_JOIN_PASSCODE_PARAM_NAMES.has(normalizedName) &&
        normalizedValue &&
        normalizedValue.length <= 128 &&
        !hasRingCentralPasscodeControlCharacters(normalizedValue)
      ) {
        passcode = normalizedValue;
      }
    });
    return passcode;
  } catch {
    return '';
  }
}

function hasRingCentralPasscodeControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
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

function requestRingCentralNativeJoinPreferenceBridge(
  enabled: boolean,
): Promise<void> {
  const targetWindow =
    typeof globalThis !== 'undefined'
      ? (globalThis as typeof globalThis & { window?: Window }).window
      : undefined;
  if (
    !targetWindow ||
    typeof targetWindow.postMessage !== 'function' ||
    typeof targetWindow.addEventListener !== 'function'
  ) {
    throw new Error('ringcentral_native_join_preference_unavailable');
  }

  return new Promise<void>((resolve, reject) => {
    const requestId = createRingCentralNativeJoinPreferenceRequestId();
    let settled = false;
    const cleanup = (): void => {
      settled = true;
      targetWindow.removeEventListener('message', handleResponse);
      if (typeof targetWindow.clearTimeout === 'function') {
        targetWindow.clearTimeout(timeoutId);
      }
    };
    const handleResponse = (event: MessageEvent): void => {
      const message = event.data as
        | RingCentralNativeJoinSetEnabledResponseMessage
        | undefined;
      if (
        !message ||
        message.source !== RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_SOURCE ||
        message.target !== 'page' ||
        message.type !== RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_RESPONSE ||
        message.requestId !== requestId
      ) {
        return;
      }

      cleanup();
      if (message.success) {
        resolve();
        return;
      }
      reject(
        new Error(
          message.error || 'ringcentral_native_join_preference_bridge_failed',
        ),
      );
    };
    const timeoutId =
      typeof targetWindow.setTimeout === 'function'
        ? targetWindow.setTimeout(() => {
            if (settled) return;
            cleanup();
            reject(
              new Error(
                'ringcentral_native_join_preference_bridge_timeout',
              ),
            );
          }, RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_TIMEOUT_MS)
        : 0;

    targetWindow.addEventListener('message', handleResponse);
    const request: RingCentralNativeJoinSetEnabledRequestMessage = {
      source: RINGCENTRAL_NATIVE_JOIN_PREFERENCE_BRIDGE_SOURCE,
      target: 'content-script',
      type: RINGCENTRAL_NATIVE_JOIN_SET_ENABLED_REQUEST,
      requestId,
      enabled,
    };
    targetWindow.postMessage(request, getSameWindowPostMessageTargetOrigin());
  });
}

function createRingCentralNativeJoinPreferenceRequestId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `ringcentral-native-join-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getSameWindowPostMessageTargetOrigin(): string {
  const targetWindow =
    typeof globalThis !== 'undefined'
      ? (globalThis as typeof globalThis & { window?: Window }).window
      : undefined;
  if (!targetWindow) {
    return '*';
  }
  const origin = targetWindow.location?.origin;
  return origin && origin !== 'null' ? origin : '*';
}

function stripTrailingJoinUrlPunctuation(url: string): string {
  return url.replace(/[)\]}.,;]+$/g, '');
}
