import {
  type EnvConfigType,
  getEnvConfig,
  normalizeEnvConfigShape,
} from '../utils';
import {
  MEETING_PILOT_SIDE_PANEL_PATH,
  MeetingPilotDetectionPayload,
  MeetingPilotParticipant,
  MeetingPilotSessionSnapshot,
  extractMeetingIdFromUrl,
  isMeetingPilotUrl,
} from './protocol';

type OverlayState = {
  snapshot?: MeetingPilotSessionSnapshot;
  lastSignature?: string;
  hover: boolean;
  busy: boolean;
  temporarilyHidden: boolean;
  closeAffordanceVisible: boolean;
  closeConfirmOpen: boolean;
  embeddedPanelOpen: boolean;
  coachmarkOpen: boolean;
  catchupOpen: boolean;
  note?: string;
  noteUntil?: number;
};

type MeetingPilotRuntimeConfig = {
  enabled: boolean;
  floatingIconVisible: boolean;
  autoDetect: boolean;
  entryMode: 'auto' | 'manual';
  memoryContextEnabled: boolean;
  privacyNoticeText: string;
  hotwords: string[];
  nameAliases: string[];
};

const OVERLAY_ID = 'meeting-pilot-overlay-root';
const DEBOUNCE_MS = 900;
const ICON_URL = chrome.runtime.getURL('icons/icon48.png');

const overlayState: OverlayState = {
  hover: false,
  busy: false,
  temporarilyHidden: false,
  closeAffordanceVisible: false,
  closeConfirmOpen: false,
  embeddedPanelOpen: false,
  coachmarkOpen: false,
  catchupOpen: false,
};

let debounceTimer: number | undefined;
let mounted = false;
let observersInstalled = false;
let hoverCloseTimer: number | undefined;
let entryCloseRevealTimer: number | undefined;
let lastAlertMeetingId: string | undefined;
const seenDanmakuIds = new Set<string>();
const dismissedP0Ids = new Set<string>();
const emittedHeuristicAlertIds = new Set<string>();
let danmakuSpeedKey: 'fast' | 'medium' | 'slow' = 'medium';
let runtimeConfig: MeetingPilotRuntimeConfig = {
  enabled: true,
  floatingIconVisible: true,
  autoDetect: true,
  entryMode: 'auto',
  memoryContextEnabled: true,
  privacyNoticeText: '',
  hotwords: [],
  nameAliases: [],
};

function getOverlayShadowRoot(): ShadowRoot | null {
  return document.getElementById(OVERLAY_ID)?.shadowRoot || null;
}

function buildEmbeddedPanelUrl(args?: {
  tabId?: number;
  catchup?: boolean;
  debug?: boolean;
}): string {
  const params = new URLSearchParams();
  if (args?.tabId && args.tabId > 0) {
    params.set('tabId', String(args.tabId));
  }
  params.set('embedded', '1');
  params.set('surface', 'embedded');
  if (args?.catchup) {
    params.set('catchup', '1');
  }
  if (args?.debug) {
    params.set('debug', '1');
  }
  const query = params.toString();
  return chrome.runtime.getURL(
    `${MEETING_PILOT_SIDE_PANEL_PATH}${query ? `?${query}` : ''}`,
  );
}

function setEmbeddedPanelOpen(
  open: boolean,
  args?: { tabId?: number; catchup?: boolean; debug?: boolean },
): boolean {
  const shadow = getOverlayShadowRoot();
  if (!shadow) {
    console.warn('[Meeting Pilot][content] embedded panel open failed: no shadow');
    return false;
  }
  const backdrop = shadow.getElementById('mpSidePanelBackdrop');
  const panel = shadow.getElementById('mpSidePanelShell');
  const frame = shadow.getElementById(
    'mpSidePanelFrame',
  ) as HTMLIFrameElement | null;
  if (!backdrop || !panel || !frame) {
    console.warn('[Meeting Pilot][content] embedded panel open failed: missing DOM', {
      hasBackdrop: Boolean(backdrop),
      hasPanel: Boolean(panel),
      hasFrame: Boolean(frame),
    });
    return false;
  }

  if (open) {
    const nextSrc = buildEmbeddedPanelUrl({
      tabId: args?.tabId || overlayState.snapshot?.tabId,
      catchup: args?.catchup,
      debug: args?.debug,
    });
    if (args?.catchup || args?.debug || frame.dataset.src !== nextSrc) {
      frame.src = nextSrc;
      frame.dataset.src = nextSrc;
    }
    overlayState.embeddedPanelOpen = true;
    overlayState.hover = false;
    backdrop.classList.add('open');
    panel.classList.add('open');
    console.info('[Meeting Pilot][content] embedded panel opened', {
      tabId: args?.tabId || overlayState.snapshot?.tabId,
      catchup: Boolean(args?.catchup),
      debug: Boolean(args?.debug),
    });
  } else {
    overlayState.embeddedPanelOpen = false;
    backdrop.classList.remove('open');
    panel.classList.remove('open');
  }

  renderOverlay(overlayState.snapshot, getMeetingPageContext());
  return true;
}

function resolveParticipantAlias(name: string): string {
  const normalizedName = normalizeText(name);
  for (const entry of runtimeConfig.nameAliases) {
    const [alias, canonical] = entry
      .split('=')
      .map((item) => normalizeText(item));
    if (alias && canonical && namesMatch(normalizedName, alias)) {
      return canonical;
    }
  }
  return normalizedName;
}

function getDanmakuDuration(level: 'P1' | 'P2'): number {
  const base = level === 'P1' ? 8 : 7;
  const multiplier =
    danmakuSpeedKey === 'fast' ? 2 : danmakuSpeedKey === 'slow' ? 4.5 : 3;
  return Math.round(base * multiplier * 10) / 10;
}

function attachDanmakuHoverFreeze(item: HTMLElement): void {
  item.addEventListener('mouseenter', () => {
    const matrix = new DOMMatrix(getComputedStyle(item).transform);
    item.style.transform = `translateX(${matrix.m41}px) translateZ(0)`;
    item.classList.add('paused');
  });
  item.addEventListener('mouseleave', () => {
    item.classList.remove('paused');
    const currentX = new DOMMatrix(getComputedStyle(item).transform).m41;
    const endX = -(window.innerWidth + 240);
    const startX = window.innerWidth;
    const totalPx = startX - endX;
    const remainingPx = currentX - endX;
    const originalDur =
      parseFloat(item.style.getPropertyValue('--duration')) || 8;
    const remainingDur = originalDur * (remainingPx / totalPx);
    item.style.setProperty('--duration', `${Math.max(remainingDur, 0.1)}s`);
    item.style.transform = '';
  });
}

async function hydrateDanmakuConfig(): Promise<void> {
  try {
    const envConfig = await getEnvConfig();
    danmakuSpeedKey = envConfig.MEETING_DANMAKU_SPEED || 'medium';
    runtimeConfig = {
      enabled: envConfig.MEETING_PILOT_ENABLED !== false,
      floatingIconVisible:
        envConfig.MEETING_PILOT_FLOATING_ICON_VISIBLE !== false,
      autoDetect: envConfig.MEETING_AUTO_DETECT !== false,
      entryMode: envConfig.MEETING_ENTRY_MODE || 'auto',
      memoryContextEnabled: envConfig.MEETING_MEMORY_CONTEXT_ENABLED !== false,
      privacyNoticeText: String(
        envConfig.MEETING_PRIVACY_NOTICE_TEXT || '',
      ).trim(),
      hotwords: String(envConfig.MEETING_HOTWORDS || '')
        .split(/[\n,]/)
        .map((item) => normalizeText(item))
        .filter(Boolean),
      nameAliases: String(envConfig.MEETING_NAME_ALIASES || '')
        .split(/[\n,]/)
        .map((item) => normalizeText(item))
        .filter(Boolean),
    };
  } catch {
    danmakuSpeedKey = 'medium';
  }
}

function normalizeText(value?: string | null): string {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeName(value?: string | null): string {
  return normalizeText(value)
    .replace(/\(you\)$/i, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function namesMatch(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  return sanitizeName(left) === sanitizeName(right);
}

function firstText(selectors: string[]): string {
  for (const selector of selectors) {
    const direct = normalizeText(document.querySelector(selector)?.textContent);
    if (direct) return direct;

    const descendantText = Array.from(
      document.querySelectorAll(`${selector} *`),
    )
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean)
      .sort((left, right) => left.length - right.length)[0];

    if (descendantText) return descendantText;
  }
  return '';
}

function extractSelfDisplayName(): string | undefined {
  const candidates = Array.from(
    document.querySelectorAll('button, div, span, p'),
  )
    .map((node) => normalizeText(node.textContent))
    .filter((text) => /\(you\)/i.test(text))
    .sort((left, right) => left.length - right.length);

  for (const candidate of candidates) {
    const match = candidate.match(/^(.+?)\s*\(you\)$/i);
    if (match?.[1]) return normalizeText(match[1]);
  }
  return undefined;
}

function extractSharerName(value?: string): string | undefined {
  const text = normalizeText(value);
  if (!text || /^your screen/i.test(text) || /^you are sharing/i.test(text))
    return undefined;

  const patterns = [
    /^waiting for\s+(.+?)'s screen/i,
    /^(.+?)'s screen/i,
    /^(.+?)\s+is sharing/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return normalizeText(match[1]);
  }

  return undefined;
}

function extractSharerNameFromPage(): string | undefined {
  const candidates = [
    '#main-drag-field',
    '.SharingPreview',
    '.SharingToolbar',
    '.SharingToolbar__description',
    '.description-title',
    '#screensharing',
  ]
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .map((node) => normalizeText(node.textContent))
    .filter((text) => /'s screen|is sharing/i.test(text))
    .map((text) => extractSharerName(text))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.length - right.length);

  return candidates[0];
}

function inferParticipantCount(selfName?: string): number {
  const participantButtons = document.querySelectorAll(
    'button[aria-label*="has a good connection" i]',
  ).length;
  return participantButtons + (selfName ? 1 : 0);
}

function extractParticipants(selfName?: string): MeetingPilotParticipant[] {
  const participants = new Map<string, MeetingPilotParticipant>();

  const pushParticipant = (
    name: string,
    partial?: Partial<MeetingPilotParticipant>,
  ) => {
    const normalized = normalizeText(name);
    if (!normalized) return;
    const resolvedName = resolveParticipantAlias(normalized);
    const id =
      sanitizeName(resolvedName) || `participant-${participants.size + 1}`;
    if (participants.has(id)) return;
    participants.set(id, {
      id,
      name: resolvedName,
      role:
        partial?.role ||
        (selfName && namesMatch(resolvedName, resolveParticipantAlias(selfName))
          ? 'You'
          : 'Participant'),
      speakingPct: partial?.speakingPct ?? 0,
      isSelf:
        partial?.isSelf ??
        Boolean(selfName && namesMatch(normalized, selfName)),
      isHost: partial?.isHost,
      stances: partial?.stances,
      resolutionState: 'roster',
      resolutionConfidence: 1,
      sourceLabels: ['roster'],
    });
  };

  Array.from(
    document.querySelectorAll('button[aria-label*="has a good connection" i]'),
  ).forEach((node) => {
    const label = normalizeText(
      (node as HTMLElement).getAttribute('aria-label'),
    );
    const match = label.match(/^(.+?)\s+has a good connection/i);
    if (match?.[1]) {
      pushParticipant(match[1]);
    }
  });

  if (selfName) {
    pushParticipant(selfName, { role: 'You', isSelf: true });
  }

  return Array.from(participants.values());
}

function inferSelfSharing(args: {
  shareActive: boolean;
  shareBannerText: string;
  shareControlText: string;
  selfName?: string;
  sharerName?: string;
}): boolean {
  if (!args.shareActive) return false;

  if (
    /\(you\)/i.test(args.shareBannerText) ||
    /^your screen/i.test(args.shareBannerText) ||
    /^you are sharing/i.test(args.shareBannerText)
  ) {
    return true;
  }

  if (
    /share your screen/i.test(args.shareControlText) &&
    !/stop sharing|stop share|you are sharing|you're sharing/i.test(
      args.shareControlText,
    )
  ) {
    return false;
  }

  if (
    /stop sharing|stop share|you are sharing|you're sharing/i.test(
      args.shareControlText,
    )
  ) {
    return true;
  }

  if (args.sharerName && args.selfName) {
    return namesMatch(args.sharerName, args.selfName);
  }

  return false;
}

function extractSpeakerLabel(bodyText: string): string | undefined {
  const match =
    bodyText.match(/speaker[:\s]+([^\n]+)/i) ||
    bodyText.match(/currently speaking[:\s]+([^\n]+)/i);
  return normalizeText(match?.[1]);
}

function resolveTopicHint(value: string): string | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;
  const hotword = runtimeConfig.hotwords.find((item) =>
    text.toLowerCase().includes(item.toLowerCase()),
  );
  if (hotword) return hotword;
  const builtInTopics = ['预算', '排期', '技术评审', '风险', 'owner', 'QA'];
  return builtInTopics.find((item) => text.includes(item));
}

function getMeetingPageContext():
  | (MeetingPilotDetectionPayload & {
      participantCount: number;
      selfName?: string;
    })
  | null {
  const meetingId = extractMeetingIdFromUrl(location.href);
  if (!meetingId) return null;

  const bodyText = document.body?.innerText || '';
  const shareBannerText = firstText(['#screen-sharing-panel']);
  const shareRegionText = firstText(['section#screensharing']);
  const shareControlText = normalizeText(
    document
      .querySelector(
        'button[aria-label*="Share your screen" i], button[aria-label*="Stop sharing" i], button[aria-label*="Stop share" i], button[aria-label*="sharing" i]',
      )
      ?.getAttribute('aria-label'),
  );
  const shareActive = Boolean(
    document.querySelector(
      '#screen-sharing-panel, section#screensharing, video.screencast',
    ),
  );
  const minimizedShare = /shared application was minimized/i.test(
    `${shareRegionText} ${bodyText}`,
  );
  const selfName = extractSelfDisplayName();
  const participants = extractParticipants(selfName);
  const sharerName =
    extractSharerName(shareBannerText) ||
    (shareActive ? extractSharerNameFromPage() : undefined);
  const selfSharing = inferSelfSharing({
    shareActive,
    shareBannerText,
    shareControlText,
    selfName,
    sharerName,
  });
  const ended =
    /meeting ended/i.test(bodyText) ||
    /you have left the meeting/i.test(bodyText) ||
    /you were disconnected here because you joined this meeting from another window/i.test(
      bodyText,
    ) ||
    /you may now close the window/i.test(bodyText);

  return {
    meetingId,
    tabId: 0,
    url: location.href,
    title: document.title || 'RingCentral meeting',
    inMeeting: !ended,
    shareState: shareActive
      ? minimizedShare
        ? 'minimized'
        : 'active'
      : 'none',
    selfSharing,
    sharerName,
    speakerLabel: extractSpeakerLabel(bodyText),
    detectedAt: Date.now(),
    notes: [
      shareActive ? 'screen_share_detected' : 'no_screen_share',
      minimizedShare ? 'screen_share_minimized' : 'screen_share_visible',
    ],
    participantCount: participants.length || inferParticipantCount(selfName),
    participants,
    selfName,
  };
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
  }
  return [minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function formatDurationLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  return `持续 ${minutes} 分钟`;
}

function getCurrentChapter(snapshot?: MeetingPilotSessionSnapshot) {
  if (!snapshot?.chapters?.length) return undefined;
  const index = Math.min(
    snapshot.chapters.length - 1,
    Math.max(
      0,
      Math.floor((snapshot.timelineProgress || 0) * snapshot.chapters.length),
    ),
  );
  return snapshot.chapters[index];
}

function formatCaptureStartError(error?: string): string {
  if (error === 'tabCapture_stream_unavailable') {
    return '浏览器未返回可用的 tab capture stream，请重试并保持当前会议页处于激活状态。';
  }
  return String(error || 'Capture 未能成功启动');
}

function getMentionCount(snapshot?: MeetingPilotSessionSnapshot): number {
  return (
    snapshot?.alerts.filter(
      (alert) =>
        !alert.resolved &&
        (alert.source === 'mention' || alert.source === 'action'),
    ).length || 0
  );
}

function getMentionAlerts(snapshot?: MeetingPilotSessionSnapshot) {
  return (
    snapshot?.alerts.filter(
      (alert) =>
        !alert.resolved &&
        (alert.source === 'mention' || alert.source === 'action'),
    ) || []
  );
}

function isCaptureEnabled(snapshot?: MeetingPilotSessionSnapshot): boolean {
  return Boolean(
    snapshot &&
    ['armed', 'recording', 'uploading', 'completed'].includes(
      snapshot.capture.kind,
    ),
  );
}

function hasCaptureAttempt(snapshot?: MeetingPilotSessionSnapshot): boolean {
  return Boolean(
    snapshot &&
    [
      'armed',
      'recording',
      'uploading',
      'completed',
      'stopped',
      'error',
    ].includes(snapshot.capture.kind),
  );
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if ((target as HTMLElement).isContentEditable) {
    return true;
  }
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], .ProseMirror',
    ),
  );
}

function openMeetingPilotOptionsPage(): void {
  const url = chrome?.runtime?.getURL
    ? chrome.runtime.getURL('options.html#meeting-pilot-config')
    : 'options.html#meeting-pilot-config';
  window.open(url, '_blank', 'noopener');
}

async function updateMeetingPilotConfig(
  patch: Partial<EnvConfigType>,
): Promise<void> {
  const currentConfig = await getEnvConfig();
  const nextConfig = normalizeEnvConfigShape({
    ...currentConfig,
    ...patch,
  });
  const response = await chrome.runtime.sendMessage({
    type: 'UPDATE_ENV_CONFIG',
    config: nextConfig,
  });
  if (!response?.success) {
    throw new Error('保存 Meeting Pilot 配置失败');
  }
}

function clearEntryCloseRevealTimer(): void {
  window.clearTimeout(entryCloseRevealTimer);
  entryCloseRevealTimer = undefined;
}

function scheduleEntryCloseReveal(): void {
  clearEntryCloseRevealTimer();
  if (!runtimeConfig.enabled || !runtimeConfig.floatingIconVisible) {
    return;
  }
  if (overlayState.closeAffordanceVisible || overlayState.closeConfirmOpen) {
    return;
  }
  entryCloseRevealTimer = window.setTimeout(() => {
    overlayState.closeAffordanceVisible = true;
    renderOverlay(overlayState.snapshot, getMeetingPageContext());
  }, 3000);
}

function hideEntryCloseControls(force = false): void {
  clearEntryCloseRevealTimer();
  if (!force && overlayState.closeConfirmOpen) {
    return;
  }
  if (!overlayState.closeAffordanceVisible && !overlayState.closeConfirmOpen) {
    return;
  }
  overlayState.closeAffordanceVisible = false;
  overlayState.closeConfirmOpen = false;
  renderOverlay(overlayState.snapshot, getMeetingPageContext());
}

function setCoachmarkOpen(open: boolean): void {
  overlayState.coachmarkOpen = open;
  if (open) {
    overlayState.catchupOpen = false;
    overlayState.hover = false;
  }
  renderOverlay(overlayState.snapshot, getMeetingPageContext());
}

function setCatchupModalOpen(open: boolean): void {
  overlayState.catchupOpen = open;
  if (open) {
    overlayState.coachmarkOpen = false;
    overlayState.hover = false;
  }
  renderOverlay(overlayState.snapshot, getMeetingPageContext());
}

function getCatchupSections(snapshot?: MeetingPilotSessionSnapshot): Array<{
  title: string;
  content: string;
}> {
  const chapter = getCurrentChapter(snapshot);
  const mentionSummary = getMentionAlerts(snapshot)
    .map((alert) => `${alert.title}：${alert.body}`)
    .join('；');
  const pendingActions = (snapshot?.actionItems || [])
    .filter((item) => item.status === 'pending')
    .slice(0, 3)
    .map(
      (item) =>
        `${item.owner} — ${item.title}${
          item.deadline ? ` (${item.deadline})` : ''
        }`,
    )
    .join('；');
  const topicFlow =
    snapshot?.chapters
      ?.map((item) => item.title)
      .filter(Boolean)
      .join(' → ') || '';

  return [
    {
      title: '当前章节',
      content:
        normalizeText(chapter?.summary) ||
        normalizeText(snapshot?.summary) ||
        'Meeting Pilot 正在继续整理当前章节。',
    },
    {
      title: '提到了你',
      content: mentionSummary || '当前没有新的提及你提醒。',
    },
    {
      title: '新行动项',
      content: pendingActions || '当前章节暂无新的待处理行动项。',
    },
    {
      title: '话题变化',
      content: topicFlow || '等待章节结构生成',
    },
  ];
}

function updateTransientNote(): void {
  if (overlayState.noteUntil && overlayState.noteUntil < Date.now()) {
    overlayState.note = undefined;
    overlayState.noteUntil = undefined;
  }
}

function showNote(note: string): void {
  overlayState.note = note;
  overlayState.noteUntil = Date.now() + 2200;
}

function getDanmakuTop(index: number): number {
  return 96 + (index % 6) * 52;
}

function formatAlertAge(createdAt?: number): string {
  if (!createdAt) return 'just now';
  const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s ago`;
}

function buildDanmakuSummaryText(args: {
  title?: string;
  previewText: string;
}): string {
  const preview = normalizeText(args.previewText);
  const title = normalizeText(args.title);
  if (title && preview && title !== preview) {
    return `${title} · ${preview}`;
  }
  return preview || title;
}

function appendDanmakuContent(
  root: HTMLDivElement,
  args: {
    icon?: string;
    title?: string;
    previewText: string;
    detailText: string;
    linkUrl?: string;
    linkLabel?: string;
  },
): void {
  if (args.icon) {
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = args.icon;
    root.appendChild(icon);
  }

  const content = document.createElement('span');
  content.className = 'danmaku-content';

  const summary = document.createElement('span');
  summary.className = 'danmaku-summary';
  summary.textContent = buildDanmakuSummaryText({
    title: args.title,
    previewText: args.previewText,
  });
  summary.title = normalizeText(args.detailText);

  const detail = document.createElement('span');
  detail.className = 'danmaku-detail';

  if (args.title) {
    const title = document.createElement('span');
    title.className = 'danmaku-title';
    title.textContent = args.title;
    detail.appendChild(title);
  }

  const fullText = document.createElement('span');
  fullText.className = 'danmaku-full-text';
  fullText.textContent = normalizeText(args.detailText);
  detail.appendChild(fullText);

  if (args.linkUrl) {
    const link = document.createElement('a');
    link.href = args.linkUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = args.linkLabel || '查看原文';
    detail.appendChild(link);
  }

  content.appendChild(summary);
  content.appendChild(detail);
  root.appendChild(content);
}

function createP0AlertElement(
  alert: MeetingPilotSessionSnapshot['alerts'][number],
): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'p0-alert';
  root.dataset.alertId = alert.id;

  const icon = document.createElement('span');
  icon.className = 'p0-icon';
  icon.textContent = '🚨';

  const body = document.createElement('div');
  body.className = 'p0-body';

  const label = document.createElement('div');
  label.className = 'p0-label';
  label.textContent = `${alert.level} · ${alert.source}`;

  const ago = document.createElement('span');
  ago.className = 'ago';
  ago.textContent = formatAlertAge(alert.createdAt);
  label.appendChild(ago);

  const text = document.createElement('div');
  text.className = 'p0-text';
  text.textContent = `${alert.title} — ${alert.body}`;

  const closeButton = document.createElement('button');
  closeButton.className = 'p0-close';
  closeButton.dataset.alertId = alert.id;
  closeButton.textContent = '✕';

  body.appendChild(label);
  body.appendChild(text);
  root.appendChild(icon);
  root.appendChild(body);
  root.appendChild(closeButton);

  return root;
}

function syncAlertLayers(
  shadow: ShadowRoot,
  snapshot?: MeetingPilotSessionSnapshot,
): void {
  const danmakuOverlay = shadow.getElementById('mpDanmakuOverlay');
  const p0Container = shadow.getElementById('mpP0Container');
  if (!danmakuOverlay || !p0Container || !snapshot) {
    return;
  }

  if (snapshot.meetingId !== lastAlertMeetingId) {
    lastAlertMeetingId = snapshot.meetingId;
    seenDanmakuIds.clear();
    dismissedP0Ids.clear();
  }

  const unresolved = snapshot.alerts.filter((alert) => !alert.resolved);
  const p0Alerts = unresolved.filter(
    (alert) => alert.level === 'P0' && !dismissedP0Ids.has(alert.id),
  );
  p0Container.replaceChildren(
    ...p0Alerts.map((alert) => createP0AlertElement(alert)),
  );
  p0Container.querySelectorAll('.p0-close').forEach((button) => {
    button.addEventListener('click', () => {
      const alertId = (button as HTMLButtonElement).dataset.alertId;
      if (alertId) {
        dismissedP0Ids.add(alertId);
        syncAlertLayers(shadow, snapshot);
      }
    });
  });

  unresolved
    .filter((alert) => alert.level !== 'P0')
    .forEach((alert, index) => {
      if (seenDanmakuIds.has(alert.id)) {
        return;
      }
      seenDanmakuIds.add(alert.id);
      const item = document.createElement('div');
      item.className = `danmaku-item ${alert.level === 'P1' ? 'p1' : 'p2'}`;
      item.style.top = `${getDanmakuTop(index)}px`;
      const duration = getDanmakuDuration(alert.level === 'P1' ? 'P1' : 'P2');
      item.style.setProperty('--duration', `${duration}s`);
      appendDanmakuContent(item, {
        title: alert.title,
        previewText: alert.body,
        detailText: alert.body,
      });
      danmakuOverlay.appendChild(item);
      attachDanmakuHoverFreeze(item);
      item.addEventListener('animationend', () => item.remove());
    });

  snapshot.memoryRefs.forEach((ref, index) => {
    const memoryId = `memory:${ref.id}`;
    if (seenDanmakuIds.has(memoryId)) {
      return;
    }
    seenDanmakuIds.add(memoryId);

    const item = document.createElement('div');
    item.className = 'danmaku-item p2 memory-danmaku';
    item.style.top = `${getDanmakuTop(unresolved.length + index)}px`;
    item.style.setProperty('--duration', `${getDanmakuDuration('P2') + 3}s`);
    const title = ref.title || `记忆关联 ${Math.round(ref.score * 100)}%`;
    appendDanmakuContent(item, {
      icon: '🧠',
      title,
      previewText: ref.snippet,
      detailText: ref.fullSnippet || ref.snippet,
      linkUrl: ref.sourceUrl,
      linkLabel: '查看原文',
    });

    danmakuOverlay.appendChild(item);
    attachDanmakuHoverFreeze(item);
    item.addEventListener('animationend', () => item.remove());
  });
}

function ensureStanceCardStyles(): void {
  if (document.getElementById('meeting-pilot-stance-style')) return;
  const style = document.createElement('style');
  style.id = 'meeting-pilot-stance-style';
  style.textContent = `
    .meeting-pilot-stance-host { position: relative !important; }
    .meeting-pilot-stance-card {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%) translateY(6px);
      width: 260px;
      background: rgba(20,18,36,0.96);
      backdrop-filter: blur(20px) saturate(1.5);
      border: 1px solid rgba(46,51,64,0.9);
      border-radius: 12px;
      padding: 0;
      opacity: 0;
      visibility: hidden;
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 2147483647;
      pointer-events: none;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      overflow: hidden;
    }
    .meeting-pilot-stance-host:hover .meeting-pilot-stance-card {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }
    .meeting-pilot-stance-card .sc-header {
      padding: 8px 12px;
      background: linear-gradient(135deg, rgba(108,92,231,0.12), rgba(162,155,254,0.06));
      border-bottom: 1px solid rgba(46,51,64,0.9);
      display: flex;
      align-items: center;
      gap: 8px;
      color: #e4e7ef;
    }
    .meeting-pilot-stance-card .sc-name { font-size: 12px; font-weight: 700; }
    .meeting-pilot-stance-card .sc-role { font-size: 10px; color: #8b8fa3; margin-left: auto; }
    .meeting-pilot-stance-card .sc-topics { padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; }
    .meeting-pilot-stance-card .stance-topic { display: flex; align-items: flex-start; gap: 6px; }
    .meeting-pilot-stance-card .stance-indicator { flex-shrink: 0; width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; }
    .meeting-pilot-stance-card .stance-indicator.lead { background: rgba(108,92,231,0.2); }
    .meeting-pilot-stance-card .stance-indicator.support { background: rgba(105,219,124,0.15); }
    .meeting-pilot-stance-card .stance-indicator.neutral { background: rgba(255,212,59,0.12); }
    .meeting-pilot-stance-card .stance-indicator.question { background: rgba(255,165,2,0.15); }
    .meeting-pilot-stance-card .stance-indicator.oppose { background: rgba(255,107,107,0.18); }
    .meeting-pilot-stance-card .stance-topic-info { min-width: 0; color: #e4e7ef; }
    .meeting-pilot-stance-card .stance-topic-name { font-size: 11px; font-weight: 600; }
    .meeting-pilot-stance-card .stance-topic-label { font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 3px; margin-left: 4px; }
    .meeting-pilot-stance-card .stance-topic-label.lead { background: rgba(108,92,231,0.15); color: #a29bfe; }
    .meeting-pilot-stance-card .stance-topic-label.support { background: rgba(105,219,124,0.15); color: #69db7c; }
    .meeting-pilot-stance-card .stance-topic-label.neutral { background: rgba(255,212,59,0.1); color: #ffd43b; }
    .meeting-pilot-stance-card .stance-topic-label.question { background: rgba(255,165,2,0.15); color: #ffa502; }
    .meeting-pilot-stance-card .stance-topic-label.oppose { background: rgba(255,107,107,0.15); color: #ff6b6b; }
    .meeting-pilot-stance-card .stance-quote { font-size: 10px; color: #8b8fa3; font-style: italic; margin-top: 2px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meeting-pilot-stance-card .sc-footer { padding: 6px 12px; border-top: 1px solid rgba(46,51,64,0.9); font-size: 9px; color: #8b8fa3; text-align: center; }
    @keyframes meeting-pilot-focus-pulse {
      0% { box-shadow: 0 0 0 0 rgba(108,92,231,0.6); outline: 2px solid rgba(108,92,231,0.8); }
      50% { box-shadow: 0 0 0 12px rgba(108,92,231,0); outline: 2px solid rgba(108,92,231,0.5); }
      100% { box-shadow: 0 0 0 0 rgba(108,92,231,0); outline: 2px solid transparent; }
    }
    .meeting-pilot-focus-flash {
      animation: meeting-pilot-focus-pulse 1s ease-out 2;
      outline: 2px solid rgba(108,92,231,0.8);
      outline-offset: 2px;
      border-radius: 8px;
    }
  `;
  document.head.appendChild(style);
}

function getStanceClass(stance: string): string {
  if (stance === '主导') return 'lead';
  if (stance === '支持') return 'support';
  if (stance === '质疑') return 'question';
  if (stance === '反对') return 'oppose';
  return 'neutral';
}

interface RosterDomEntry {
  name: string;
  element: HTMLElement;
}

function collectRosterDomEntries(): RosterDomEntry[] {
  const entries: RosterDomEntry[] = [];
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('button, div, span'),
  );
  candidates.forEach((node) => {
    const aria = normalizeText(node.getAttribute('aria-label'));
    const text = normalizeText(node.textContent);
    let name: string | undefined;
    const ariaMatch = aria.match(/^(.+?)\s+has a good connection/i);
    if (ariaMatch) {
      name = ariaMatch[1];
    } else if (
      text &&
      text.length <= 60 &&
      /^[\w\s\u4e00-\u9fa5(.-]+$/.test(text)
    ) {
      // weak fallback: only consider short text-like nodes
      name = text.replace(/\s*\(you\)$/i, '').trim();
    }
    if (!name) return;
    entries.push({ name, element: node });
  });
  return entries;
}

function findParticipantHost(
  participant: { name: string; aliases?: string[] },
  rosterEntries: RosterDomEntry[],
): HTMLElement | undefined {
  const candidateNames = [participant.name, ...(participant.aliases || [])];
  for (const candidate of candidateNames) {
    const match = rosterEntries.find((entry) =>
      namesMatch(entry.name, candidate),
    );
    if (match) return match.element;
  }
  return undefined;
}

function syncParticipantStanceCards(
  snapshot?: MeetingPilotSessionSnapshot,
): void {
  document
    .querySelectorAll('.meeting-pilot-stance-card')
    .forEach((node) => node.remove());
  document
    .querySelectorAll<HTMLElement>('[data-meeting-pilot-participant-id]')
    .forEach((node) => {
      node.removeAttribute('data-meeting-pilot-participant-id');
    });
  if (!snapshot?.participants?.length) return;

  ensureStanceCardStyles();
  const rosterEntries = collectRosterDomEntries();

  snapshot.participants.forEach((participant) => {
    const target = findParticipantHost(participant, rosterEntries);
    if (!target) return;
    target.setAttribute('data-meeting-pilot-participant-id', participant.id);
    if (!(participant.stances || []).length) return;
    target.classList.add('meeting-pilot-stance-host');

    const card = document.createElement('div');
    card.className = 'meeting-pilot-stance-card';
    card.dataset.participantId = participant.id;
    card.innerHTML = `
      <div class="sc-header">
        <span class="sc-name">${participant.name}</span>
        <span class="sc-role">${participant.role}</span>
      </div>
      <div class="sc-topics">
        ${(participant.stances || [])
          .slice(0, 5)
          .map(
            (item) => `
              <div class="stance-topic">
                <div class="stance-indicator ${getStanceClass(item.stance)}">${
                  item.stance === '主导'
                    ? '🎯'
                    : item.stance === '支持'
                      ? '✓'
                      : item.stance === '质疑'
                        ? '?'
                        : item.stance === '反对'
                          ? '!'
                          : '—'
                }</div>
                <div class="stance-topic-info">
                  <div class="stance-topic-name">${
                    item.topic
                  }<span class="stance-topic-label ${getStanceClass(
                    item.stance,
                  )}">${item.stance}</span></div>
                  <div class="stance-quote">${item.keyQuote}</div>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
      <div class="sc-footer">点击头像查看完整发言记录</div>
    `;
    target.appendChild(card);
  });
}

function focusParticipantInDom(participantId: string): boolean {
  if (!participantId) return false;
  const target = document.querySelector<HTMLElement>(
    `[data-meeting-pilot-participant-id="${CSS.escape(participantId)}"]`,
  );
  if (!target) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('meeting-pilot-focus-flash');
  window.setTimeout(() => {
    target.classList.remove('meeting-pilot-focus-flash');
  }, 2000);
  return true;
}

function emitHeuristicAlerts(
  context: ReturnType<typeof getMeetingPageContext>,
): void {
  if (!context) return;
  const candidates: Array<
    Pick<
      MeetingPilotSessionSnapshot['alerts'][number],
      'level' | 'title' | 'body' | 'source'
    >
  > = [];
  if (context.shareState === 'active' && context.sharerName) {
    candidates.push({
      level: 'P1',
      title: '共享画面活跃中',
      body: `${context.sharerName} 正在共享屏幕，Meeting Pilot 已切换到共享画面上下文。`,
      source: 'share',
    });
  }
  if (context.selfSharing) {
    candidates.push({
      level: 'P2',
      title: '你正在共享屏幕',
      body: '后续如果出现 scroll / open link / switch tab 类请求，会在这里升级成更强提醒。',
      source: 'summary',
    });
  }
  if (context.speakerLabel) {
    candidates.push({
      level: 'P2',
      title: '当前主讲更新',
      body: `${context.speakerLabel} 正在主讲，当前对话上下文已刷新。`,
      source: 'summary',
    });
  }

  candidates.forEach((candidate) => {
    const alertId = `${context.meetingId}:${candidate.level}:${candidate.title}:${candidate.body}`;
    if (emittedHeuristicAlertIds.has(alertId)) {
      return;
    }
    emittedHeuristicAlertIds.add(alertId);
    void chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_UPDATE_ALERTS',
      tabId: 0,
      alert: {
        id: alertId,
        ...candidate,
        createdAt: Date.now(),
      },
    });
  });
}

function hideMeetingPilotFloatingIconTemporarily(): void {
  overlayState.temporarilyHidden = true;
  overlayState.closeConfirmOpen = false;
  overlayState.closeAffordanceVisible = false;
  renderOverlay(overlayState.snapshot, getMeetingPageContext());
}

async function hideMeetingPilotFloatingIconForever(): Promise<void> {
  overlayState.temporarilyHidden = false;
  overlayState.closeConfirmOpen = false;
  overlayState.closeAffordanceVisible = false;
  await updateMeetingPilotConfig({
    MEETING_PILOT_FLOATING_ICON_VISIBLE: false,
  });
}

function createOverlay(): void {
  if (document.getElementById(OVERLAY_ID)) return;

  const host = document.createElement('div');
  host.id = OVERLAY_ID;
  host.style.position = 'fixed';
  host.style.right = '20px';
  host.style.bottom = '80px';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none';

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }
      .danmaku-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483645;
      }
      .danmaku-item {
        position: fixed;
        right: -36px;
        padding: 8px 16px 8px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(12px);
        box-shadow: 0 2px 16px rgba(0,0,0,0.3);
        max-width: min(360px, calc(100vw - 96px));
        pointer-events: auto;
        cursor: default;
        animation: danmakuSlide var(--duration, 8s) linear forwards;
        will-change: transform;
        backface-visibility: hidden;
        transform: translateX(100vw) translateZ(0);
        transition:
          max-width 0.2s ease,
          box-shadow 0.2s ease,
          border-color 0.2s ease,
          background 0.2s ease;
      }
      .danmaku-item:hover {
        align-items: flex-start;
        max-width: min(560px, calc(100vw - 48px));
        box-shadow: 0 10px 28px rgba(0,0,0,0.38);
        z-index: 2147483647;
      }
      .danmaku-item.paused {
        animation: none;
      }
      .danmaku-item .icon {
        font-size: 16px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .danmaku-item .danmaku-content {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .danmaku-item .danmaku-summary {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .danmaku-item .danmaku-detail {
        display: none;
        white-space: normal;
        line-height: 1.45;
        max-height: 240px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .danmaku-item .danmaku-title {
        display: block;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .danmaku-item .danmaku-full-text {
        display: block;
      }
      .danmaku-item:hover .danmaku-summary {
        display: none;
      }
      .danmaku-item:hover .danmaku-detail {
        display: block;
      }
      .danmaku-item a {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
        pointer-events: auto;
        cursor: pointer;
      }
      .danmaku-item .danmaku-detail a {
        display: inline-flex;
        margin-top: 6px;
      }
      .danmaku-item.p1 {
        background: rgba(255,212,59,0.10);
        border: 1px solid rgba(255,212,59,0.35);
        color: #ffd43b;
      }
      .danmaku-item.p2 {
        background: rgba(105,219,124,0.08);
        border: 1px solid rgba(105,219,124,0.25);
        color: #69db7c;
      }
      .danmaku-item.memory-danmaku {
        background: rgba(108,92,231,0.12);
        border: 1px solid rgba(108,92,231,0.35);
        color: #a29bfe;
      }
      .p0-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: center;
        pointer-events: none;
        max-height: 60vh;
      }
      .side-panel-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(6, 9, 18, 0.42);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.22s ease, visibility 0.22s ease;
        z-index: 2147483644;
      }
      .side-panel-backdrop.open {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      .side-panel {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: min(361px, calc(100vw - 12px));
        box-sizing: border-box;
        transform: translateX(-100%);
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 2147483645;
        pointer-events: none;
        display: flex;
        background: rgba(11, 13, 20, 0.96);
        border-right: 1px solid rgba(46, 51, 64, 0.94);
        box-shadow: 16px 0 48px rgba(0, 0, 0, 0.42);
        overflow: hidden;
      }
      .side-panel.open {
        transform: translateX(0);
        pointer-events: auto;
      }
      .coachmark-backdrop,
      .catchup-backdrop {
        position: fixed;
        inset: 0;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.2s ease, visibility 0.2s ease;
      }
      .coachmark-backdrop {
        z-index: 2147483642;
        background:
          radial-gradient(circle at top right, rgba(108, 92, 231, 0.18), transparent 18%),
          rgba(5, 8, 16, 0.38);
      }
      .coachmark-backdrop.visible,
      .catchup-backdrop.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      .coachmark-shell {
        position: fixed;
        top: 58px;
        right: 26px;
        width: min(328px, calc(100vw - 44px));
        padding: 18px 18px 16px;
        border-radius: 20px;
        background:
          radial-gradient(circle at top right, rgba(255, 183, 77, 0.18), transparent 34%),
          linear-gradient(180deg, rgba(22, 24, 36, 0.98), rgba(11, 13, 20, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
        color: #eef2ff;
        z-index: 2147483646;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-6px) scale(0.96);
        transform-origin: top right;
        transition: opacity 0.22s ease, transform 0.22s ease, visibility 0.22s ease;
        pointer-events: none;
        overflow: visible;
      }
      .coachmark-shell.visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      .coachmark-arrow {
        position: absolute;
        top: -40px;
        left: 16px;
        width: 150px;
        height: 58px;
        pointer-events: none;
      }
      .coachmark-arrow svg {
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .coachmark-arrow path {
        fill: none;
        stroke: rgba(255, 255, 255, 0.92);
        stroke-width: 2.8;
        stroke-linecap: round;
        stroke-linejoin: round;
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.32));
      }
      .coachmark-head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .coachmark-icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: grid;
        place-items: center;
        box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24);
        flex-shrink: 0;
      }
      .coachmark-icon img {
        width: 28px;
        height: 28px;
        display: block;
      }
      .coachmark-copy-wrap {
        min-width: 0;
      }
      .coachmark-eyebrow {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 219, 156, 0.92);
        margin-bottom: 4px;
      }
      .coachmark-title {
        font-size: 18px;
        font-weight: 800;
        line-height: 1.2;
        color: #fff8e1;
      }
      .coachmark-copy {
        font-size: 13px;
        line-height: 1.6;
        color: rgba(236, 242, 255, 0.84);
      }
      .coachmark-steps {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }
      .coachmark-step {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: rgba(236, 242, 255, 0.88);
        font-size: 12px;
        line-height: 1.45;
      }
      .coachmark-step-index {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-size: 11px;
        font-weight: 800;
        background: rgba(255, 183, 77, 0.2);
        color: #ffe7b3;
        flex-shrink: 0;
      }
      .coachmark-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 28px;
        height: 28px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(236, 242, 255, 0.78);
        cursor: pointer;
      }
      .catchup-backdrop {
        z-index: 2147483644;
        background: rgba(6, 9, 18, 0.56);
        backdrop-filter: blur(6px);
      }
      .catchup-shell {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.22s ease, visibility 0.22s ease;
        padding: 20px;
      }
      .catchup-shell.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      .catchup-card {
        width: min(560px, calc(100vw - 40px));
        max-height: min(80vh, 720px);
        overflow: auto;
        border-radius: 22px;
        background:
          radial-gradient(circle at top right, rgba(108, 92, 231, 0.12), transparent 32%),
          linear-gradient(180deg, rgba(21, 24, 34, 0.98), rgba(11, 13, 20, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.48);
        color: #e4e7ef;
      }
      .catchup-header {
        padding: 18px 20px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .catchup-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
      }
      .catchup-subtitle {
        padding: 0 20px 6px;
        font-size: 12px;
        line-height: 1.6;
        color: rgba(228, 231, 239, 0.7);
      }
      .catchup-close {
        margin-left: auto;
        width: 30px;
        height: 30px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(228, 231, 239, 0.8);
        cursor: pointer;
      }
      .catchup-pills {
        display: flex;
        gap: 8px;
        padding: 10px 20px 0;
        flex-wrap: wrap;
      }
      .catchup-pill {
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid rgba(108, 92, 231, 0.3);
        background: rgba(108, 92, 231, 0.14);
        color: #a29bfe;
        font-size: 11px;
        font-weight: 700;
      }
      .catchup-body {
        display: grid;
        gap: 12px;
        padding: 16px 20px 20px;
      }
      .catchup-section {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .catchup-section-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(162, 155, 254, 0.82);
        margin-bottom: 8px;
      }
      .catchup-section-content {
        font-size: 14px;
        line-height: 1.65;
        color: rgba(236, 242, 255, 0.92);
        white-space: pre-wrap;
      }
      .side-panel-frame {
        width: 100%;
        height: 100%;
        border: 0;
        background: #0b0d14;
      }
      .p0-alert {
        pointer-events: auto;
        width: min(520px, calc(100vw - 48px));
        padding: 14px 20px 14px 16px;
        border-radius: 14px;
        background: rgba(20,16,32,0.92);
        backdrop-filter: blur(20px) saturate(1.6);
        border: 1.5px solid rgba(255,107,107,0.4);
        box-shadow: 0 8px 40px rgba(255,107,107,0.25), 0 0 60px rgba(255,107,107,0.08);
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .p0-icon { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
      .p0-body { flex: 1; }
      .p0-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #ff6b6b;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .p0-label .ago { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.56); text-transform: none; letter-spacing: 0; }
      .p0-text { font-size: 14px; font-weight: 600; color: #fff; line-height: 1.45; }
      .p0-close {
        width: 24px;
        height: 24px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.7);
        cursor: pointer;
      }
      .dock {
        position: fixed;
        right: 20px;
        bottom: 80px;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        pointer-events: none;
        z-index: 2147483643;
      }
      .entry-wrap {
        position: relative;
        pointer-events: auto;
      }
      .dock[data-hover="true"] .radar-tooltip {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
        visibility: visible;
      }
      .radar-tooltip, .entry {
        pointer-events: auto;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .radar-tooltip {
        position: absolute;
        right: 0;
        bottom: calc(100% + 12px);
        width: min(280px, calc(100vw - 32px));
        border-radius: 14px;
        background: rgba(20, 18, 36, 0.95);
        backdrop-filter: blur(20px) saturate(1.5);
        border: 1px solid rgba(46, 51, 64, 0.94);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
        transform: translateY(6px) scale(0.96);
        transform-origin: bottom right;
        transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
      }
      .tooltip-header {
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, rgba(108, 92, 231, 0.15) 0%, rgba(162, 155, 254, 0.06) 100%);
        border-bottom: 1px solid rgba(46, 51, 64, 0.92);
      }
      .tooltip-header.idle .rec-dot {
        background: rgba(151, 95, 130, 0.72);
        box-shadow: none;
        animation: none;
      }
      .tooltip-header.idle .rec-text {
        color: rgba(139, 143, 163, 0.95);
      }
      .rec-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #ff4757;
        animation: blink 1.2s ease-in-out infinite;
        box-shadow: 0 0 10px rgba(255, 71, 87, 0.36);
      }
      .rec-text {
        font-size: 11px;
        font-weight: 700;
        color: #ff5d74;
        letter-spacing: 0.02em;
      }
      .rec-time {
        margin-left: auto;
        font-size: 11px;
        font-weight: 500;
        color: rgba(139, 143, 163, 0.95);
        font-variant-numeric: tabular-nums;
      }
      .tooltip-idle-view {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 14px 14px;
        text-align: center;
      }
      .radar-tooltip:not(.idle) .tooltip-idle-view {
        display: none;
      }
      .start-capture-btn-large {
        appearance: none;
        border: none;
        width: 100%;
        border-radius: 8px;
        padding: 9px 16px;
        background: #6c5ce7;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .start-capture-btn-large:hover:enabled {
        opacity: 0.88;
        transform: translateY(-1px);
      }
      .start-capture-btn-large:disabled {
        cursor: progress;
        opacity: 0.72;
        transform: none;
      }
      .hint {
        font-size: 10px;
        line-height: 1.45;
        color: rgba(90, 94, 114, 1);
      }
      .tooltip-topic {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(46, 51, 64, 0.92);
      }
      .radar-tooltip.idle .tooltip-topic,
      .radar-tooltip.idle .tooltip-stats,
      .radar-tooltip.idle .tooltip-actions-bar {
        display: none;
      }
      .label {
        font-size: 10px;
        color: rgba(90, 94, 114, 1);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 3px;
      }
      .value {
        font-size: 13px;
        font-weight: 600;
        line-height: 1.4;
        color: #ffffff;
      }
      .sub {
        margin-top: 2px;
        font-size: 11px;
        line-height: 1.45;
        color: rgba(139, 143, 163, 0.98);
      }
      .tooltip-stats {
        padding: 10px 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .tooltip-stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .stat-label {
        font-size: 10px;
        color: rgba(90, 94, 114, 1);
      }
      .stat-value {
        font-size: 14px;
        font-weight: 700;
      }
      .stat-value.actions { color: #ffe24a; }
      .stat-value.mentions { color: #ff7278; }
      .stat-value.topics { color: #a89fff; }
      .stat-value.participants { color: #66ea7e; }
      .tooltip-actions-bar {
        padding: 8px 14px;
        border-top: 1px solid rgba(46, 51, 64, 0.92);
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .tooltip-action-btn {
        appearance: none;
        border: 1px solid rgba(46, 51, 64, 0.94);
        border-radius: 8px;
        padding: 7px 0;
        background: rgba(36, 40, 54, 0.92);
        color: rgba(228, 231, 239, 0.94);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .tooltip-action-btn.primary {
        background: rgba(108, 92, 231, 0.15);
        border-color: rgba(108, 92, 231, 0.36);
        color: #a29bfe;
      }
      .tooltip-action-btn:hover:enabled {
        transform: translateY(-1px);
        border-color: rgba(108, 92, 231, 0.64);
        background: rgba(108, 92, 231, 0.18);
      }
      .tooltip-action-btn:disabled {
        cursor: progress;
        opacity: 0.72;
        transform: none;
      }
      .panel-note {
        display: none;
        padding: 10px 14px 12px;
        border-top: 1px solid rgba(46, 51, 64, 0.92);
        font-size: 11px;
        line-height: 1.45;
        color: rgba(255, 209, 217, 0.92);
      }
      .panel-note.visible {
        display: block;
      }
      .entry-close-btn,
      .entry-close-popover,
      .entry {
        position: relative;
      }
      .entry-close-btn,
      .entry-close-popover,
      .entry {
        pointer-events: auto;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .entry-close-btn {
        position: absolute;
        top: -7px;
        right: -7px;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(19, 21, 33, 0.94);
        color: rgba(221, 226, 239, 0.82);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transform: scale(0.82);
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.34);
        transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease, background 0.18s ease, color 0.18s ease;
        z-index: 2;
      }
      .entry-close-btn.visible {
        opacity: 1;
        visibility: visible;
        transform: scale(1);
      }
      .entry-close-btn:hover {
        background: rgba(34, 37, 54, 0.98);
        color: #ffffff;
      }
      .entry-close-popover {
        position: absolute;
        right: 0;
        bottom: calc(100% + 18px);
        width: min(280px, calc(100vw - 32px));
        padding: 14px;
        border-radius: 14px;
        background: rgba(16, 18, 28, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.42);
        color: #eef2ff;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: translateY(8px) scale(0.96);
        transform-origin: bottom right;
        transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
        z-index: 3;
      }
      .entry-close-popover.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }
      .entry-close-popover::after {
        content: '';
        position: absolute;
        right: 18px;
        bottom: -6px;
        width: 12px;
        height: 12px;
        background: rgba(16, 18, 28, 0.98);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        transform: rotate(45deg);
      }
      .entry-close-popover-title {
        font-size: 13px;
        font-weight: 700;
        color: #ffffff;
      }
      .entry-close-popover-copy {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(221, 226, 239, 0.78);
      }
      .entry-close-popover-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      .entry-close-action,
      .entry-close-link {
        appearance: none;
        border-radius: 10px;
        cursor: pointer;
        transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
      }
      .entry-close-action {
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.05);
        color: #eef2ff;
        padding: 9px 10px;
        font-size: 12px;
        font-weight: 600;
      }
      .entry-close-action:hover,
      .entry-close-link:hover {
        transform: translateY(-1px);
      }
      .entry-close-action.danger {
        background: rgba(255, 107, 107, 0.12);
        border-color: rgba(255, 107, 107, 0.28);
        color: #ff9a9a;
      }
      .entry-close-link {
        width: 100%;
        margin-top: 10px;
        border: 1px dashed rgba(162, 155, 254, 0.3);
        background: rgba(108, 92, 231, 0.08);
        color: #c9c3ff;
        padding: 8px 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .entry {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        border: 1.5px solid rgba(108, 92, 231, 0.42);
        background: rgba(20, 16, 32, 0.88);
        backdrop-filter: blur(16px);
        box-shadow: 0 6px 28px rgba(0, 0, 0, 0.42), 0 0 22px rgba(108, 92, 231, 0.18);
        display: grid;
        place-items: center;
        overflow: visible;
        cursor: pointer;
        transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .entry:hover {
        transform: scale(1.08);
        border-color: rgba(108, 92, 231, 0.88);
        box-shadow: 0 10px 34px rgba(0, 0, 0, 0.5), 0 0 30px rgba(108, 92, 231, 0.28);
      }
      .entry.has-alert {
        border-color: #ff6b6b;
        animation: fabPulse 2s ease-in-out infinite;
      }
      .entry img {
        width: 30px;
        height: 30px;
        display: block;
        filter: drop-shadow(0 0 4px rgba(255, 77, 106, 0.4));
        transition: transform 0.3s;
      }
      .entry:hover img {
        transform: rotate(-8deg) scale(1.08);
      }
      .rec-ring {
        position: absolute;
        inset: -3px;
        border-radius: 18px;
        opacity: 0;
        transition: opacity 180ms ease;
        pointer-events: none;
        border: 2px solid transparent;
        border-top-color: #ff4757;
      }
      .entry.recording .rec-ring {
        opacity: 1;
        animation: recSpin 2s linear infinite;
      }
      .fab-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        background: #ff6b6b;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        box-shadow: 0 2px 8px rgba(255, 71, 87, 0.5);
      }
      .entry.has-alert .fab-badge {
        display: flex;
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      @keyframes fabPulse {
        0%, 100% {
          box-shadow: 0 6px 28px rgba(0, 0, 0, 0.42), 0 0 20px rgba(255, 107, 107, 0.18);
        }
        50% {
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 34px rgba(255, 107, 107, 0.32);
        }
      }
      @keyframes recSpin {
        to { transform: rotate(360deg); }
      }
      @keyframes danmakuSlide {
        0% { transform: translateX(100vw) translateZ(0); }
        100% { transform: translateX(calc(-100vw - 240px)) translateZ(0); }
      }
      @media (max-width: 720px) {
        .side-panel {
          width: min(100vw, 361px);
        }
      }
    </style>
    <div class="danmaku-overlay" id="mpDanmakuOverlay"></div>
    <div class="p0-container" id="mpP0Container"></div>
    <div class="side-panel-backdrop" id="mpSidePanelBackdrop"></div>
    <div class="side-panel" id="mpSidePanelShell">
      <iframe
        class="side-panel-frame"
        id="mpSidePanelFrame"
        title="Meeting Pilot"
      ></iframe>
    </div>
    <div class="coachmark-backdrop" id="mpCoachmarkBackdrop"></div>
    <div class="coachmark-shell" id="mpCoachmark" role="dialog" aria-label="Meeting Pilot start guide">
      <button class="coachmark-close" id="mpCoachmarkClose" aria-label="关闭提示">✕</button>
      <div class="coachmark-arrow" aria-hidden="true">
        <svg viewBox="0 0 150 58">
          <path d="M142 48 C 126 28, 98 14, 66 12 C 40 10, 20 16, 8 28" />
          <path d="M20 16 L 8 28 L 20 40" />
        </svg>
      </div>
      <div class="coachmark-head">
        <div class="coachmark-icon">
          <img src="${ICON_URL}" alt="Personal AI" />
        </div>
        <div class="coachmark-copy-wrap">
          <div class="coachmark-eyebrow">Browser Authorization</div>
          <div class="coachmark-title" id="mpCoachmarkTitle">请点击右上角扩展图标</div>
        </div>
      </div>
      <div class="coachmark-copy" id="mpCoachmarkCopy"></div>
      <div class="coachmark-steps">
        <div class="coachmark-step">
          <span class="coachmark-step-index">1</span>
          <span>点击浏览器右上角的 Personal AI 扩展图标。</span>
        </div>
        <div class="coachmark-step">
          <span class="coachmark-step-index">2</span>
          <span>在弹出的 popup 第一项点击“开启会议全貌”。</span>
        </div>
      </div>
    </div>
    <div class="catchup-backdrop" id="mpCatchupBackdrop"></div>
    <div class="catchup-shell" id="mpCatchupShell" role="dialog" aria-modal="true" aria-label="Catch Up">
      <div class="catchup-card" id="mpCatchupCard">
        <div class="catchup-header">
          <span style="font-size: 22px;">⚡</span>
          <h3>你刚错过了什么</h3>
          <button class="catchup-close" id="mpCatchupClose" aria-label="关闭 Catch Up">✕</button>
        </div>
        <div class="catchup-subtitle">
          在不离开会议页的情况下，快速补齐最近讨论、提及与行动项。
        </div>
        <div class="catchup-pills">
          <span class="catchup-pill">过去 5 分钟</span>
          <span class="catchup-pill">从上次查看开始</span>
        </div>
        <div class="catchup-body">
          <div class="catchup-section">
            <div class="catchup-section-title">当前章节</div>
            <div class="catchup-section-content" id="mpCatchupCurrent"></div>
          </div>
          <div class="catchup-section">
            <div class="catchup-section-title">提到了你</div>
            <div class="catchup-section-content" id="mpCatchupMentions"></div>
          </div>
          <div class="catchup-section">
            <div class="catchup-section-title">新行动项</div>
            <div class="catchup-section-content" id="mpCatchupActions"></div>
          </div>
          <div class="catchup-section">
            <div class="catchup-section-title">话题变化</div>
            <div class="catchup-section-content" id="mpCatchupTopics"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="dock" id="mpDock" data-hover="false">
      <div class="radar-tooltip idle" id="mpPanel" role="dialog" aria-label="Meeting Pilot">
        <div class="tooltip-header idle" id="mpHeaderRow">
          <span class="rec-dot" id="mpStatusDot"></span>
          <span class="rec-text" id="mpStatusText">READY</span>
          <span class="rec-time" id="mpTimer">00:00</span>
        </div>
        <div class="tooltip-idle-view">
          <button class="start-capture-btn-large" id="mpIdlePrimaryAction">开始 Capture</button>
          <div class="hint" id="mpIdleHint">授权后才会开始录制、实时总结和会后分析。</div>
        </div>
        <div class="tooltip-topic">
          <div class="label" id="mpEyebrow">当前话题</div>
          <div class="value" id="mpTopicTitle">会议进行中</div>
          <div class="sub" id="mpTopicMeta">持续 1 分钟 · 多人讨论</div>
        </div>
        <div class="tooltip-stats">
          <div class="tooltip-stat">
              <span class="stat-label">行动项</span>
              <span class="stat-value actions" id="mpActionCount">0</span>
          </div>
          <div class="tooltip-stat">
              <span class="stat-label">提及你</span>
              <span class="stat-value mentions" id="mpMentionCount">0</span>
          </div>
          <div class="tooltip-stat">
              <span class="stat-label">话题数</span>
              <span class="stat-value topics" id="mpTopicCount">0</span>
          </div>
          <div class="tooltip-stat">
              <span class="stat-label">参会者</span>
              <span class="stat-value participants" id="mpParticipantCount">0</span>
          </div>
        </div>
        <div class="tooltip-actions-bar" id="mpActionsRow">
          <button class="tooltip-action-btn primary" id="mpPrimaryAction">⚡ Catch Up</button>
          <button class="tooltip-action-btn" id="mpSecondaryAction">📋 面板</button>
        </div>
        <div class="panel-note" id="mpNote"></div>
      </div>
      <div class="entry-wrap" id="mpEntryWrap">
        <div class="entry-close-popover" id="mpEntryClosePopover" role="dialog" aria-label="Meeting Pilot visibility options">
          <div class="entry-close-popover-title">要怎么处理这个入口？</div>
          <div class="entry-close-popover-copy">
            你可以先在当前页面暂时隐藏会议页右下角的悬浮 icon，刷新页面后它会重新出现；也可以选择永不展示，之后可在 Options 的 Meeting Pilot 配置里重新打开。
          </div>
          <div class="entry-close-popover-actions">
            <button class="entry-close-action" id="mpHideEntryAction" type="button">隐藏 icon</button>
            <button class="entry-close-action danger" id="mpDisableFeatureAction" type="button">永不展示</button>
          </div>
          <button class="entry-close-link" id="mpOpenOptionsAction" type="button">去 Options 查看配置</button>
        </div>
        <button class="entry-close-btn" id="mpEntryCloseBtn" type="button" aria-label="关闭 Meeting Pilot 入口">×</button>
        <button class="entry" id="mpEntry" aria-label="Meeting Pilot">
          <span class="rec-ring"></span>
          <img src="${ICON_URL}" alt="Meeting Pilot" />
          <span class="fab-badge" id="mpFabBadge">0</span>
        </button>
      </div>
    </div>
  `;

  document.documentElement.appendChild(host);
  mounted = true;

  const dock = shadow.getElementById('mpDock');
  const panel = shadow.getElementById('mpPanel');
  const entryWrap = shadow.getElementById('mpEntryWrap');
  const entryClosePopover = shadow.getElementById('mpEntryClosePopover');
  const sidePanelBackdrop = shadow.getElementById('mpSidePanelBackdrop');
  const coachmarkBackdrop = shadow.getElementById('mpCoachmarkBackdrop');
  const coachmarkClose = shadow.getElementById('mpCoachmarkClose');
  const catchupBackdrop = shadow.getElementById('mpCatchupBackdrop');
  const catchupClose = shadow.getElementById('mpCatchupClose');
  dock?.addEventListener('mouseenter', () => {
    window.clearTimeout(hoverCloseTimer);
    overlayState.hover = true;
    renderOverlay(overlayState.snapshot, getMeetingPageContext());
  });
  dock?.addEventListener('mouseleave', () => {
    window.clearTimeout(hoverCloseTimer);
    hideEntryCloseControls(true);
    hoverCloseTimer = window.setTimeout(() => {
      overlayState.hover = false;
      renderOverlay(overlayState.snapshot, getMeetingPageContext());
    }, 120);
  });
  panel?.addEventListener('mouseenter', () => {
    window.clearTimeout(hoverCloseTimer);
    overlayState.hover = true;
    renderOverlay(overlayState.snapshot, getMeetingPageContext());
  });
  panel?.addEventListener('mouseleave', () => {
    window.clearTimeout(hoverCloseTimer);
    hoverCloseTimer = window.setTimeout(() => {
      overlayState.hover = false;
      renderOverlay(overlayState.snapshot, getMeetingPageContext());
    }, 120);
  });
  sidePanelBackdrop?.addEventListener('click', () => {
    setEmbeddedPanelOpen(false);
  });
  coachmarkBackdrop?.addEventListener('click', () => {
    setCoachmarkOpen(false);
  });
  coachmarkClose?.addEventListener('click', () => {
    setCoachmarkOpen(false);
  });
  catchupBackdrop?.addEventListener('click', () => {
    setCatchupModalOpen(false);
  });
  catchupClose?.addEventListener('click', () => {
    setCatchupModalOpen(false);
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (overlayState.catchupOpen) {
        setCatchupModalOpen(false);
        return;
      }
      if (overlayState.coachmarkOpen) {
        setCoachmarkOpen(false);
        return;
      }
      if (overlayState.embeddedPanelOpen) {
        setEmbeddedPanelOpen(false);
      }
      return;
    }

    if (
      event.defaultPrevented ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.key.toLowerCase() !== 'c' ||
      isTextEntryTarget(event.target) ||
      !isCaptureEnabled(overlayState.snapshot)
    ) {
      return;
    }
    event.preventDefault();
    setCatchupModalOpen(true);
  });
  window.addEventListener('message', (event) => {
    const extensionOrigin = new URL(chrome.runtime.getURL('')).origin;
    if (event.origin !== extensionOrigin) {
      return;
    }
    if (event.data?.type === 'MEETING_PILOT_EMBEDDED_PANEL_CLOSE') {
      setEmbeddedPanelOpen(false);
      return;
    }
    if (event.data?.type === 'MEETING_PILOT_EMBEDDED_CATCHUP_OPEN') {
      setCatchupModalOpen(true);
    }
  });

  const primary = shadow.getElementById(
    'mpPrimaryAction',
  ) as HTMLButtonElement | null;
  const idlePrimary = shadow.getElementById(
    'mpIdlePrimaryAction',
  ) as HTMLButtonElement | null;
  const secondary = shadow.getElementById(
    'mpSecondaryAction',
  ) as HTMLButtonElement | null;
  const entryCloseBtn = shadow.getElementById(
    'mpEntryCloseBtn',
  ) as HTMLButtonElement | null;
  const hideEntryAction = shadow.getElementById(
    'mpHideEntryAction',
  ) as HTMLButtonElement | null;
  const disableFeatureAction = shadow.getElementById(
    'mpDisableFeatureAction',
  ) as HTMLButtonElement | null;
  const openOptionsAction = shadow.getElementById(
    'mpOpenOptionsAction',
  ) as HTMLButtonElement | null;
  const entry = shadow.getElementById('mpEntry') as HTMLButtonElement | null;

  entryWrap?.addEventListener('mouseenter', () => {
    scheduleEntryCloseReveal();
  });
  entryWrap?.addEventListener('mouseleave', (event: MouseEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (relatedTarget?.closest('#mpEntryClosePopover')) {
      return;
    }
    hideEntryCloseControls();
  });
  entryClosePopover?.addEventListener('mouseenter', () => {
    clearEntryCloseRevealTimer();
  });
  entryClosePopover?.addEventListener('mouseleave', (event: MouseEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (relatedTarget?.closest('#mpEntryWrap')) {
      return;
    }
    hideEntryCloseControls(true);
  });

  const openPanel = async () => {
    await runBusy(
      async () => {
        const response = await chrome.runtime.sendMessage({
          type: 'MEETING_PILOT_OPEN_SIDE_PANEL',
          tabId: 0,
          source: 'overlay',
        });
        if (!response?.success) return false;
        return response?.surface === 'side-panel'
          ? '已打开 Chrome 侧边栏。'
          : response?.surface === 'window'
          ? '已用独立窗口打开 Meeting Pilot。'
          : '已打开面板。';
      },
      (message) => String(message || '已打开面板。'),
    );
  };

  const openSettings = async () => {
    await runBusy(async () => true, '已打开 Meeting Pilot 配置。');
    openMeetingPilotOptionsPage();
  };

  primary?.addEventListener('click', () => {
    const enabled = isCaptureEnabled(overlayState.snapshot);
    if (enabled) {
      setCatchupModalOpen(true);
      return;
    }
    setCoachmarkOpen(true);
  });
  idlePrimary?.addEventListener('click', () => {
    setCoachmarkOpen(true);
  });
  secondary?.addEventListener('click', () => {
    const enabled = isCaptureEnabled(overlayState.snapshot);
    void (enabled ? openPanel() : openSettings());
  });
  entryCloseBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearEntryCloseRevealTimer();
    overlayState.closeAffordanceVisible = true;
    overlayState.closeConfirmOpen = !overlayState.closeConfirmOpen;
    renderOverlay(overlayState.snapshot, getMeetingPageContext());
  });
  hideEntryAction?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideMeetingPilotFloatingIconTemporarily();
  });
  disableFeatureAction?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void (async () => {
      try {
        await hideMeetingPilotFloatingIconForever();
      } catch (error) {
        showNote(
          String(
            (error as Error)?.message || '设置 Meeting Pilot 为永不展示失败',
          ),
        );
        renderOverlay(overlayState.snapshot, getMeetingPageContext());
      }
    })();
  });
  openOptionsAction?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideEntryCloseControls(true);
    openMeetingPilotOptionsPage();
  });
  entry?.addEventListener('click', () => {
    if (overlayState.closeConfirmOpen) {
      hideEntryCloseControls(true);
      return;
    }
    void openPanel();
  });

  void syncContext('mount');
}

async function runBusy(
  task: () => Promise<unknown>,
  successMessage: string | ((result: unknown) => string),
): Promise<void> {
  overlayState.busy = true;
  renderOverlay(overlayState.snapshot, getMeetingPageContext());
  try {
    const result = await task();
    if (result === false) {
      throw new Error('Action did not complete');
    }
    showNote(
      typeof successMessage === 'function'
        ? successMessage(result)
        : successMessage,
    );
  } catch (error) {
    showNote(String((error as Error)?.message || error || 'Action failed'));
  } finally {
    try {
      const state = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_GET_STATE',
        tabId: 0,
      })) as { activeSession?: MeetingPilotSessionSnapshot } | undefined;
      if (state?.activeSession) {
        overlayState.snapshot = state.activeSession;
      }
    } catch {
      // ignore refresh errors and fall back to the latest broadcast/context sync
    }
    overlayState.busy = false;
    await syncContext('action-complete');
  }
}

function renderOverlay(
  snapshot: MeetingPilotSessionSnapshot | undefined,
  context: ReturnType<typeof getMeetingPageContext>,
): void {
  updateTransientNote();

  const host = document.getElementById(OVERLAY_ID);
  const shadow = host?.shadowRoot;
  if (!host || !shadow) return;

  const isFeatureDisabled = !runtimeConfig.enabled;
  const shouldHideDock =
    !runtimeConfig.floatingIconVisible || overlayState.temporarilyHidden;
  host.style.display = isFeatureDisabled ? 'none' : '';
  if (isFeatureDisabled) {
    overlayState.hover = false;
    overlayState.closeAffordanceVisible = false;
    overlayState.closeConfirmOpen = false;
    overlayState.embeddedPanelOpen = false;
    overlayState.coachmarkOpen = false;
    overlayState.catchupOpen = false;
    shadow.getElementById('mpSidePanelBackdrop')?.classList.remove('open');
    shadow.getElementById('mpSidePanelShell')?.classList.remove('open');
    shadow.getElementById('mpCoachmarkBackdrop')?.classList.remove('visible');
    shadow.getElementById('mpCoachmark')?.classList.remove('visible');
    shadow.getElementById('mpCatchupBackdrop')?.classList.remove('visible');
    shadow.getElementById('mpCatchupShell')?.classList.remove('visible');
    shadow.getElementById('mpEntryCloseBtn')?.classList.remove('visible');
    shadow.getElementById('mpEntryClosePopover')?.classList.remove('visible');
    return;
  }

  const dock = shadow.getElementById('mpDock');
  const panel = shadow.getElementById('mpPanel');
  const entry = shadow.getElementById('mpEntry');
  const entryCloseBtn = shadow.getElementById('mpEntryCloseBtn');
  const entryClosePopover = shadow.getElementById('mpEntryClosePopover');
  const fabBadge = shadow.getElementById('mpFabBadge');
  const headerRow = shadow.getElementById('mpHeaderRow');
  const statusDot = shadow.getElementById('mpStatusDot');
  const statusText = shadow.getElementById('mpStatusText');
  const timer = shadow.getElementById('mpTimer');
  const idleHint = shadow.getElementById('mpIdleHint');
  const eyebrow = shadow.getElementById('mpEyebrow');
  const topicTitle = shadow.getElementById('mpTopicTitle');
  const topicMeta = shadow.getElementById('mpTopicMeta');
  const note = shadow.getElementById('mpNote');
  const actionCount = shadow.getElementById('mpActionCount');
  const mentionCount = shadow.getElementById('mpMentionCount');
  const topicCount = shadow.getElementById('mpTopicCount');
  const participantCount = shadow.getElementById('mpParticipantCount');
  const primary = shadow.getElementById(
    'mpPrimaryAction',
  ) as HTMLButtonElement | null;
  const idlePrimary = shadow.getElementById(
    'mpIdlePrimaryAction',
  ) as HTMLButtonElement | null;
  const secondary = shadow.getElementById(
    'mpSecondaryAction',
  ) as HTMLButtonElement | null;

  const chapter = getCurrentChapter(snapshot);
  const enabled = isCaptureEnabled(snapshot);
  const hasAttempt = hasCaptureAttempt(snapshot);
  const readiness = snapshot?.readiness;
  const captureKind = snapshot?.capture.kind || 'idle';
  const startedAt =
    snapshot?.capture.startedAt || snapshot?.detectedAt || context?.detectedAt;
  const elapsedMs = startedAt ? Date.now() - startedAt : 0;
  const shareOwner = snapshot?.sharerName || context?.sharerName;
  const speaker = snapshot?.speakerLabel || context?.speakerLabel;
  const currentActionCount = chapter?.actionCount ?? 0;
  const currentMentionCount = getMentionCount(snapshot);
  const currentTopicCount = snapshot?.chapters?.length || 0;
  const currentParticipantCount = context?.participantCount || 0;
  const currentAlertCount =
    snapshot?.alerts.filter((alert) => !alert.resolved).length || 0;
  const readinessBlocked = Boolean(readiness && !readiness.canStartCapture);
  const readinessLabel = readiness?.status?.toUpperCase() || 'READY';

  if (shouldHideDock) {
    overlayState.hover = false;
    overlayState.closeAffordanceVisible = false;
    overlayState.closeConfirmOpen = false;
    overlayState.coachmarkOpen = false;
    shadow.getElementById('mpCoachmarkBackdrop')?.classList.remove('visible');
    shadow.getElementById('mpCoachmark')?.classList.remove('visible');
  }

  if (enabled && overlayState.coachmarkOpen) {
    overlayState.coachmarkOpen = false;
  }

  if (dock instanceof HTMLElement) {
    dock.style.display = shouldHideDock ? 'none' : '';
  }
  dock?.setAttribute('data-hover', String(overlayState.hover));
  panel?.classList.toggle('idle', !enabled);
  headerRow?.classList.toggle('idle', !enabled);
  entry?.classList.toggle('recording', enabled);
  entry?.classList.toggle('has-alert', currentAlertCount > 0);
  entryCloseBtn?.classList.toggle(
    'visible',
    overlayState.closeAffordanceVisible || overlayState.closeConfirmOpen,
  );
  entryClosePopover?.classList.toggle('visible', overlayState.closeConfirmOpen);
  if (fabBadge) {
    fabBadge.textContent = String(currentAlertCount);
  }
  if (statusDot instanceof HTMLElement) {
    statusDot.dataset.state = enabled
      ? 'recording'
      : captureKind === 'error'
        ? 'error'
        : 'idle';
  }

  if (statusText) {
    statusText.textContent = enabled
      ? 'REC'
      : captureKind === 'error'
        ? 'ERROR'
        : captureKind === 'stopped'
          ? 'STOPPED'
          : readinessLabel;
  }
  if (timer) timer.textContent = enabled ? formatElapsed(elapsedMs) : '00:00';

  if (!enabled) {
    if (eyebrow) eyebrow.textContent = '会议全貌';
    const fallbackError =
      captureKind === 'error'
        ? formatCaptureStartError(snapshot?.capture.lastError)
        : '';
    if (topicTitle) {
      topicTitle.textContent = readinessBlocked
        ? 'Capture 已被阻断'
        : captureKind === 'error'
          ? '请从扩展 icon 重试 Capture'
          : captureKind === 'stopped'
            ? '请从扩展 icon 重新开启 Capture'
            : hasAttempt
              ? '请从扩展 icon 继续 Capture'
              : '请从扩展 icon 开始 Capture';
    }
    const idleCopy = readinessBlocked
      ? readiness?.summary || '当前配置阻止开始 Capture。'
      : captureKind === 'error'
        ? `${
            fallbackError || 'Capture 未能成功启动，请重试。'
          } 请点击浏览器右上角的 Personal AI 图标，再在 popup 第一项点击“开启会议全貌”重新授权。`
        : captureKind === 'stopped'
          ? '录制已停止。请点击浏览器右上角的 Personal AI 图标，再在 popup 第一项点击“开启会议全貌”重新开始。'
          : shareOwner
            ? `${shareOwner}${
                snapshot?.selfSharing || context?.selfSharing ? '（你）' : ''
              } 正在共享屏幕。请点击浏览器右上角的 Personal AI 图标，再在 popup 第一项点击“开启会议全貌”开始录制、实时总结和会后分析。`
            : '请点击浏览器右上角的 Personal AI 图标，再在 popup 第一项点击“开启会议全貌”开始录制、实时总结和会后分析。';
    const idleCopyWithReadiness =
      readiness?.status === 'degraded' &&
      !readinessBlocked &&
      captureKind !== 'error' &&
      captureKind !== 'stopped'
        ? `${idleCopy} ${readiness.summary}`.trim()
        : idleCopy;
    if (topicMeta) {
      topicMeta.textContent = idleCopyWithReadiness;
      if (runtimeConfig.privacyNoticeText) {
        topicMeta.textContent += ` ${runtimeConfig.privacyNoticeText}`;
      }
    }
    if (idleHint) {
      idleHint.textContent = runtimeConfig.privacyNoticeText
        ? `${idleCopyWithReadiness} ${runtimeConfig.privacyNoticeText}`
        : idleCopyWithReadiness;
    }
    if (idlePrimary) {
      idlePrimary.textContent = overlayState.busy
        ? '处理中...'
        : readinessBlocked
          ? 'Capture 已阻断'
          : '查看开启步骤';
      idlePrimary.disabled = overlayState.busy || readinessBlocked;
    }
    if (primary) primary.textContent = '🧭 开启指引';
    if (secondary) {
      secondary.textContent = '⚙️ 去配置';
      secondary.disabled = overlayState.busy;
    }
  } else {
    if (eyebrow) eyebrow.textContent = '当前话题';
    if (topicTitle) topicTitle.textContent = chapter?.title || '会议进行中';
    if (topicMeta)
      topicMeta.textContent = `${formatDurationLabel(elapsedMs)} · ${
        speaker || shareOwner || '多人讨论'
      }${speaker ? ' 主讲' : ''}`;
    if (primary) {
      primary.textContent = '⚡ Catch Up';
      primary.disabled = overlayState.busy;
    }
    if (idlePrimary) {
      idlePrimary.textContent = '开始 Capture';
      idlePrimary.disabled = overlayState.busy;
    }
    if (secondary) {
      secondary.textContent = '📋 面板';
      secondary.disabled = overlayState.busy;
    }
  }

  if (primary) {
    primary.disabled = overlayState.busy;
  }

  if (actionCount) actionCount.textContent = String(currentActionCount);
  if (mentionCount) mentionCount.textContent = String(currentMentionCount);
  if (topicCount) topicCount.textContent = String(currentTopicCount);
  if (participantCount)
    participantCount.textContent = String(currentParticipantCount);
  if (note) {
    note.textContent = overlayState.note || '';
    note.className = overlayState.note ? 'panel-note visible' : 'panel-note';
  }

  syncCoachmark(shadow, snapshot);
  syncCatchupModal(shadow, snapshot);
  syncAlertLayers(shadow, snapshot);
  syncParticipantStanceCards(snapshot);
}

function syncCoachmark(
  shadow: ShadowRoot,
  snapshot: MeetingPilotSessionSnapshot | undefined,
): void {
  const backdrop = shadow.getElementById('mpCoachmarkBackdrop');
  const shell = shadow.getElementById('mpCoachmark');
  const title = shadow.getElementById('mpCoachmarkTitle');
  const copy = shadow.getElementById('mpCoachmarkCopy');
  const readinessBlocked = Boolean(
    snapshot?.readiness && !snapshot.readiness.canStartCapture,
  );
  const captureKind = snapshot?.capture.kind || 'idle';
  const visible = overlayState.coachmarkOpen && !isCaptureEnabled(snapshot);

  backdrop?.classList.toggle('visible', visible);
  shell?.classList.toggle('visible', visible);

  if (title) {
    title.textContent = readinessBlocked
      ? '先修复配置，再从扩展 icon 开始'
      : captureKind === 'error'
        ? '请从扩展 icon 重试 Capture'
        : captureKind === 'stopped'
          ? '请从扩展 icon 重新开启 Capture'
          : '请点击右上角扩展图标';
  }
  if (copy) {
    copy.textContent = readinessBlocked
      ? `${
          snapshot?.readiness.summary || '当前配置阻止了 Capture。'
        } 先修复配置，再点击浏览器右上角的 Personal AI 图标，在 popup 第一项点击“开启会议全貌”。`
      : 'Chrome 的 tab capture 授权在当前实现里需要从扩展 popup 稳定发起。先点击浏览器右上角的 Personal AI 图标，然后在弹出的 popup 第一项点击“开启会议全貌”。';
  }
}

function syncCatchupModal(
  shadow: ShadowRoot,
  snapshot: MeetingPilotSessionSnapshot | undefined,
): void {
  const backdrop = shadow.getElementById('mpCatchupBackdrop');
  const shell = shadow.getElementById('mpCatchupShell');
  const [current, mentions, actions, topics] = getCatchupSections(snapshot);

  backdrop?.classList.toggle('visible', overlayState.catchupOpen);
  shell?.classList.toggle('visible', overlayState.catchupOpen);

  const currentNode = shadow.getElementById('mpCatchupCurrent');
  const mentionsNode = shadow.getElementById('mpCatchupMentions');
  const actionsNode = shadow.getElementById('mpCatchupActions');
  const topicsNode = shadow.getElementById('mpCatchupTopics');

  if (currentNode) currentNode.textContent = current.content;
  if (mentionsNode) mentionsNode.textContent = mentions.content;
  if (actionsNode) actionsNode.textContent = actions.content;
  if (topicsNode) topicsNode.textContent = topics.content;
}

async function syncContext(reason: string): Promise<void> {
  const context = getMeetingPageContext();
  if (!context) return;

  const signature = JSON.stringify({
    meetingId: context.meetingId,
    inMeeting: context.inMeeting,
    shareState: context.shareState,
    selfSharing: context.selfSharing,
    sharerName: context.sharerName,
    speakerLabel: context.speakerLabel,
    participantCount: context.participantCount,
    reason,
  });

  if (
    overlayState.lastSignature === signature &&
    reason !== 'action-complete'
  ) {
    return;
  }
  overlayState.lastSignature = signature;

  try {
    const topicHint = resolveTopicHint(context.notes?.join(' ') || '');
    const response = (await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_UPDATE_CONTEXT',
      payload: {
        ...context,
        tabId: 0,
        summary: topicHint
          ? `${topicHint} 正在被优先关注。 ${
              context.notes?.join(' ') || ''
            }`.trim()
          : undefined,
      },
    })) as MeetingPilotSessionSnapshot | undefined;

    if (response) {
      overlayState.snapshot = response;
    }
    emitHeuristicAlerts(context);
  } catch (error) {
    console.warn('Meeting Pilot context sync failed:', error);
  }

  renderOverlay(overlayState.snapshot, context);
}

function scheduleSync(reason: string): void {
  if (!runtimeConfig.enabled) return;
  if (!runtimeConfig.autoDetect && runtimeConfig.entryMode === 'manual') return;
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void syncContext(reason);
  }, DEBOUNCE_MS);
}

function installObservers(): void {
  if (!runtimeConfig.enabled) return;
  if (!isMeetingPilotUrl(location.href)) return;
  if (!mounted) {
    createOverlay();
  }
  if (!runtimeConfig.autoDetect && runtimeConfig.entryMode === 'manual') {
    renderOverlay(overlayState.snapshot, getMeetingPageContext());
    return;
  }
  if (observersInstalled) {
    scheduleSync('reinstall');
    return;
  }
  observersInstalled = true;

  const observer = new MutationObserver(() => scheduleSync('mutation'));
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  window.addEventListener('hashchange', () => scheduleSync('hashchange'));
  window.addEventListener('popstate', () => scheduleSync('popstate'));
  window.addEventListener('focus', () => scheduleSync('focus'));

  scheduleSync('initial');
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'MEETING_PILOT_SESSION_SNAPSHOT') {
    overlayState.snapshot = request.snapshot as MeetingPilotSessionSnapshot;
    renderOverlay(overlayState.snapshot, getMeetingPageContext());
    sendResponse({ success: true });
    return true;
  }
  if (request.type === 'MEETING_PILOT_OPEN_EMBEDDED_PANEL') {
    const source =
      typeof request.source === 'string' ? request.source : undefined;
    const success = setEmbeddedPanelOpen(true, {
      tabId: Number(request.tabId || overlayState.snapshot?.tabId || 0),
      catchup: source === 'overlay-catchup',
      debug: source === 'overlay' || source === 'overlay-catchup',
    });
    sendResponse({ success, surface: 'embedded' });
    return true;
  }
  if (request.type === 'MEETING_PILOT_CLOSE_EMBEDDED_PANEL') {
    const success = setEmbeddedPanelOpen(false);
    sendResponse({ success });
    return true;
  }
  if (request.type === 'MEETING_PILOT_FOCUS_PARTICIPANT') {
    const participantId = String(request.participantId || '');
    const success = focusParticipantInDom(participantId);
    sendResponse({ success });
    return true;
  }
  return false;
});

async function bootstrapMeetingPilot(): Promise<void> {
  await hydrateDanmakuConfig();
  installObservers();
  renderOverlay(overlayState.snapshot, getMeetingPageContext());
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.envConfig) {
    void (async () => {
      await hydrateDanmakuConfig();
      installObservers();
      renderOverlay(overlayState.snapshot, getMeetingPageContext());
    })();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      void bootstrapMeetingPilot();
    },
    {
      once: true,
    },
  );
} else {
  void bootstrapMeetingPilot();
}
