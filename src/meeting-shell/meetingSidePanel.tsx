import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatMainLlmProfileForMeetingPilot } from '../llm';
import { defaultEnvConfig, EnvConfigType, getEnvConfig } from '../utils';
import CaptureLogTab from './CaptureLogTab';
import { getDemoMeetingSessionSnapshot } from './demo';
import {
  MeetingPilotActionItem,
  MeetingPilotAlert,
  MeetingPilotCaptureLogEntry,
  MeetingPilotTimelineEvent,
  MeetingPilotSessionSnapshot,
  createMeetingPilotSessionSnapshot,
} from './protocol';
import {
  getRequestedTabId,
  useMeetingPilotState,
} from './useMeetingPilotState';
import SpeechTab from './SpeechTab';
import { TierBadge } from './components/TierBadge';

declare const __DEV__: boolean;

function shouldUseMeetingPilotDemo() {
  return new URLSearchParams(window.location.search).get('demo') === '1';
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

type TabId =
  | 'live'
  | 'speech'
  | 'timeline'
  | 'actions'
  | 'settings'
  | 'capture-log';

type PanelSurfaceMode = 'embedded' | 'side-panel' | 'window';
type ActionReviewFilter =
  | 'open'
  | 'review'
  | 'confirmed'
  | 'done'
  | 'dismissed'
  | 'all';

type MeetingSidePanelUiState = {
  activeTab?: TabId;
  scrollTopByTab?: Partial<Record<TabId, number>>;
};

type PanelViewportState = {
  isAtTop: boolean;
  lastScrollHeight: number;
};

type ActionEditDraft = {
  title: string;
  owner: string;
  deadline: string;
};

const PANEL_UI_STORAGE_PREFIX = 'meetingPilot.panelUi.';
const DEFAULT_TAB: TabId = 'live';
const TOP_SCROLL_THRESHOLD = 12;
const BULK_ACTION_COPY_ID = '__bulk_action_copy__';
const TIMELINE_FOCUS_DURATION_MS = 2200;

function getRequestedSurfaceMode(): PanelSurfaceMode {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('surface');
  if (raw === 'embedded' || raw === 'side-panel' || raw === 'window') {
    return raw;
  }
  return params.get('embedded') === '1' ? 'embedded' : 'window';
}

function openChromeSidePanelFromUserGesture(
  tabId: number,
): Promise<'side-panel' | 'unavailable'> | undefined {
  if (tabId <= 0 || !chrome.sidePanel?.open) {
    return undefined;
  }
  return chrome.sidePanel
    .open({ tabId })
    .then(() => 'side-panel' as const)
    .catch((error) => {
      console.warn('[Meeting Pilot][sidepanel] native side panel open failed', {
        tabId,
        error: String((error as Error)?.message || error),
      });
      return 'unavailable' as const;
    });
}

type ChromeSidePanelWithClose = typeof chrome.sidePanel & {
  close?: (options?: { tabId?: number }) => Promise<void> | void;
};

async function closePanelHostSurface(
  tabId: number,
  surfaceMode: PanelSurfaceMode,
): Promise<void> {
  if (surfaceMode === 'embedded') {
    return;
  }

  if (surfaceMode === 'side-panel') {
    const closeSidePanel = (chrome.sidePanel as ChromeSidePanelWithClose)
      ?.close;
    if (closeSidePanel) {
      try {
        await closeSidePanel.call(chrome.sidePanel, { tabId });
        return;
      } catch (error) {
        console.warn('[Meeting Pilot][sidepanel] close failed', {
          tabId,
          error: String((error as Error)?.message || error),
        });
      }
    }
  }

  window.close();
}

function isValidTabId(tab: unknown, showDebugTab: boolean): tab is TabId {
  if (
    tab === 'live' ||
    tab === 'speech' ||
    tab === 'timeline' ||
    tab === 'actions' ||
    tab === 'settings'
  ) {
    return true;
  }
  return showDebugTab && tab === 'capture-log';
}

function normalizeActiveTab(tab: unknown, showDebugTab: boolean): TabId {
  return isValidTabId(tab, showDebugTab) ? tab : DEFAULT_TAB;
}

function sanitizeScrollTopByTab(
  value: unknown,
  showDebugTab: boolean,
): Partial<Record<TabId, number>> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const next: Partial<Record<TabId, number>> = {};
  Object.entries(value as Record<string, unknown>).forEach(
    ([tab, scrollTop]) => {
      if (!isValidTabId(tab, showDebugTab)) {
        return;
      }
      const parsed = Number(scrollTop);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return;
      }
      next[tab] = parsed;
    },
  );
  return next;
}

function buildPanelUiStorageKey(session: MeetingPilotSessionSnapshot): string {
  const stableKey =
    String(session.meetingId || '').trim() ||
    (session.tabId > 0 ? `tab-${session.tabId}` : 'global');
  return `${PANEL_UI_STORAGE_PREFIX}${stableKey}`;
}

function getActionReviewState(
  item: MeetingPilotActionItem,
): 'suggested' | 'confirmed' | 'dismissed' {
  if (item.reviewState === 'dismissed') {
    return 'dismissed';
  }
  if (item.reviewState === 'confirmed' || item.status === 'done') {
    return 'confirmed';
  }
  return 'suggested';
}

function getActionStatusLabel(item: MeetingPilotActionItem): string {
  const reviewState = getActionReviewState(item);
  if (reviewState === 'dismissed') return '已忽略';
  if (item.status === 'done') return '已完成';
  if (reviewState === 'confirmed') return '已确认';
  return '待复核';
}

function getActionStatusClass(item: MeetingPilotActionItem): string {
  const reviewState = getActionReviewState(item);
  if (reviewState === 'dismissed') return 'dismissed';
  if (item.status === 'done') return 'done';
  if (reviewState === 'confirmed') return 'confirmed';
  return 'pending';
}

function isActionVisibleInFilter(
  item: MeetingPilotActionItem,
  filter: ActionReviewFilter,
): boolean {
  const reviewState = getActionReviewState(item);
  if (filter === 'all') return true;
  if (filter === 'open') {
    return reviewState !== 'dismissed' && item.status !== 'done';
  }
  if (filter === 'review') return reviewState === 'suggested';
  if (filter === 'confirmed') {
    return reviewState === 'confirmed' && item.status !== 'done';
  }
  if (filter === 'done') {
    return reviewState !== 'dismissed' && item.status === 'done';
  }
  return reviewState === 'dismissed';
}

function getActionFilterEmptyCopy(filter: ActionReviewFilter): string {
  if (filter === 'open') {
    return '当前没有需要继续处理的行动项。已完成或已忽略的项目可以从上方筛选查看。';
  }
  if (filter === 'review') {
    return '当前没有待复核行动项。新的 transcript 触发明确 owner / deadline 后会进入这里。';
  }
  if (filter === 'confirmed') {
    return '当前没有已确认行动项。复核通过后，项目会保留在这个筛选中。';
  }
  if (filter === 'done') {
    return '当前没有已完成行动项。完成后的跟进会移到这里，便于会后复盘。';
  }
  if (filter === 'dismissed') {
    return '当前没有已忽略行动项。误判项目被忽略后会移到这里，必要时可以恢复。';
  }
  return '当前还没有识别到结构化行动项。随着 transcript 增长，这里会自动更新。';
}

function getActionFilterLabel(filter: ActionReviewFilter): string {
  if (filter === 'open') return '处理中';
  if (filter === 'review') return '待复核';
  if (filter === 'confirmed') return '已确认';
  if (filter === 'done') return '已完成';
  if (filter === 'dismissed') return '已忽略';
  return '全部';
}

function buildActionEditDraft(item: MeetingPilotActionItem): ActionEditDraft {
  return {
    title: item.title || '',
    owner: item.owner || '',
    deadline: item.deadline || '',
  };
}

function formatActionItemForClipboard(item: MeetingPilotActionItem): string {
  const lines = [`行动项：${item.title}`, `负责人：${item.owner || 'Unknown'}`];
  if (item.deadline) {
    lines.push(`截止：${item.deadline}`);
  }
  if (item.timestamp) {
    lines.push(`识别时间：${item.timestamp}`);
  }
  lines.push(`状态：${getActionStatusLabel(item)}`);
  if (item.evidence) {
    lines.push(`依据：${item.evidence}`);
  }
  return lines.join('\n');
}

function formatActionItemsForClipboard(
  items: MeetingPilotActionItem[],
  filter: ActionReviewFilter,
): string {
  const header = `Meeting Pilot 行动项（${getActionFilterLabel(filter)}，${
    items.length
  } 项）`;
  return [
    header,
    '',
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.title}`,
      `负责人：${item.owner || 'Unknown'}`,
      ...(item.deadline ? [`截止：${item.deadline}`] : []),
      ...(item.timestamp ? [`识别时间：${item.timestamp}`] : []),
      `状态：${getActionStatusLabel(item)}`,
      ...(item.evidence ? [`依据：${item.evidence}`] : []),
      '',
    ]),
  ]
    .join('\n')
    .trim();
}

async function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  textarea.remove();
  if (!ok) {
    throw new Error('execCommand copy returned false');
  }
}

function normalizeTimelineMatchText(value?: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[“”"'.!！?？:：;；,，、()[\]{}]/g, '');
}

function timelineEventMatchesAction(
  event: MeetingPilotTimelineEvent,
  item: MeetingPilotActionItem,
): boolean {
  const actionTitle = normalizeTimelineMatchText(item.title);
  const eventTitle = normalizeTimelineMatchText(event.title);
  const eventDescription = normalizeTimelineMatchText(event.description);
  if (!actionTitle || (!eventTitle && !eventDescription)) {
    return false;
  }
  return (
    Boolean(eventTitle && eventTitle.includes(actionTitle)) ||
    Boolean(eventTitle && actionTitle.includes(eventTitle)) ||
    Boolean(eventDescription && eventDescription.includes(actionTitle))
  );
}

function findTimelineEventForAction(
  session: MeetingPilotSessionSnapshot,
  item: MeetingPilotActionItem,
): MeetingPilotTimelineEvent | undefined {
  const sameChapterEvents = item.chapterId
    ? session.timelineEvents.filter((event) => event.chapterId === item.chapterId)
    : [];
  const candidates = sameChapterEvents.length
    ? sameChapterEvents
    : session.timelineEvents;

  return (
    candidates.find(
      (event) => event.type === 'action' && timelineEventMatchesAction(event, item),
    ) ||
    candidates.find((event) => event.type === 'action') ||
    candidates.find((event) => timelineEventMatchesAction(event, item)) ||
    sameChapterEvents[0]
  );
}

async function loadPanelUiState(
  storageKey: string,
): Promise<MeetingSidePanelUiState> {
  const payload = await chrome.storage.local.get([storageKey]);
  return (payload?.[storageKey] as MeetingSidePanelUiState | undefined) || {};
}

async function persistPanelUiState(
  storageKey: string,
  uiState: MeetingSidePanelUiState,
): Promise<void> {
  await chrome.storage.local.set({
    [storageKey]: uiState,
  });
}

const shellStyle = `
  :root {
    color-scheme: dark;
    --bg-dark: #0f1117;
    --surface: #1a1d27;
    --surface-2: #242836;
    --surface-3: #2e3340;
    --border: #2e3340;
    --text: #e4e7ef;
    --text-dim: #8b8fa3;
    --text-muted: #5a5e72;
    --accent: #6c5ce7;
    --accent-light: #a29bfe;
    --accent-glow: rgba(108,92,231,0.35);
    --p0-color: #ff6b6b;
    --p0-bg: rgba(255,107,107,0.12);
    --p0-border: rgba(255,107,107,0.4);
    --p1-color: #ffd43b;
    --p1-bg: rgba(255,212,59,0.10);
    --p1-border: rgba(255,212,59,0.35);
    --p2-color: #69db7c;
    --p2-bg: rgba(105,219,124,0.08);
    --p2-border: rgba(105,219,124,0.25);
    --rec-red: #ff4757;
  }

  html, body {
    margin: 0;
    min-height: 100%;
    background: radial-gradient(circle at top, rgba(108,92,231,0.14), transparent 24%), #0b0d14;
    color: var(--text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  #meeting-pilot-root { min-height: 100vh; }

  .meeting-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    width: 360px;
    max-width: 100%;
    margin-left: auto;
    background: linear-gradient(180deg, rgba(26,29,39,0.995), rgba(15,17,24,0.995));
    border-left: 1px solid var(--border);
    box-shadow: -18px 0 42px rgba(0,0,0,0.28);
    animation: panel-enter 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
    box-sizing: border-box;
  }

  .meeting-shell.fill-width {
    width: 100%;
  }

  @keyframes panel-enter {
    from {
      opacity: 0;
      transform: translateX(18px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .panel-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(14,16,23,0.94);
    backdrop-filter: blur(16px) saturate(1.5);
    position: sticky;
    top: 0;
    z-index: 3;
  }

  .panel-logo {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .panel-logo img { width: 100%; height: 100%; }

  .panel-title {
    font-size: 14px;
    font-weight: 700;
    background: linear-gradient(135deg, #e4e7ef 0%, #a29bfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    flex: 1;
  }

  .panel-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .panel-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    padding: 0 8px;
    margin-top: 0;
    gap: 2px;
    background: rgba(14,16,23,0.92);
  }

  .panel-tab {
    flex: none;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--text-dim);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    position: relative;
    background: transparent;
    border-top: none;
    border-left: none;
    border-right: none;
    text-align: center;
    font-weight: 500;
  }

  .panel-tab:hover { color: var(--text); }
  .panel-tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
  .panel-tab .badge {
    position: absolute;
    top: 7px;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--p0-color);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px 14px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }

  .catchup-btn {
    width: 100%;
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid rgba(108,92,231,0.3);
    background: linear-gradient(135deg, rgba(108,92,231,0.15) 0%, rgba(162,155,254,0.10) 100%);
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s;
    box-sizing: border-box;
  }

  .catchup-btn:hover {
    background: linear-gradient(135deg, rgba(108,92,231,0.25) 0%, rgba(162,155,254,0.18) 100%);
    box-shadow: 0 2px 16px var(--accent-glow);
    transform: translateY(-1px);
  }

  .catchup-btn .shortcut {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-dim);
    background: var(--surface-2);
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 500;
  }

  .current-topic-card {
    padding: 12px 14px;
    background: var(--surface-2);
    border-radius: 10px;
    margin: 0 0 12px;
    border: 1px solid rgba(46,51,64,0.9);
    border-left: 3px solid var(--accent);
    box-shadow: none;
  }

  .current-topic-card .label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .current-topic-card .value { font-size: 14px; font-weight: 600; }

  .capture-start-card {
    padding: 14px 15px;
    border-radius: 14px;
    margin: 0 0 12px;
    border: 1px solid rgba(108,92,231,0.28);
    background: linear-gradient(135deg, rgba(108,92,231,0.14), rgba(162,155,254,0.08));
    box-shadow: 0 10px 24px rgba(0,0,0,0.18);
  }

  .capture-start-card.warn {
    border-color: rgba(255,107,107,0.32);
    background: linear-gradient(135deg, rgba(255,107,107,0.12), rgba(255,212,59,0.06));
  }

  .capture-start-card.low-mode {
    border-color: rgba(105,219,124,0.30);
    background: linear-gradient(135deg, rgba(105,219,124,0.12), rgba(108,92,231,0.08));
  }

  .capture-start-eyebrow {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.7px;
    margin-bottom: 6px;
  }

  .capture-start-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 6px;
  }

  .capture-start-copy {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-dim);
  }

  .capture-start-actions {
    display: flex;
    gap: 10px;
    margin-top: 12px;
  }

  .capture-start-feedback {
    margin-top: 8px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-dim);
  }

  .capture-start-feedback.warn {
    color: var(--p1-color);
  }

  .capture-start-primary {
    flex: 1;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(108,92,231,0.34);
    background: rgba(108,92,231,0.18);
    color: var(--text);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .capture-start-primary:hover {
    border-color: rgba(108,92,231,0.52);
    box-shadow: 0 10px 20px rgba(0,0,0,0.18);
    transform: translateY(-1px);
  }

  .alert-feed, .action-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }

  .action-toolbar-count {
    min-width: 0;
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.35;
  }

  .action-copy-all {
    flex-shrink: 0;
    min-height: 28px;
    padding: 5px 9px;
    border-radius: 8px;
    border: 1px solid rgba(116,185,255,0.28);
    background: rgba(116,185,255,0.1);
    color: #bfdbfe;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .action-copy-all:hover:not(:disabled) {
    border-color: rgba(116,185,255,0.48);
    color: var(--text);
  }

  .action-copy-all:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .action-copy-all.success {
    background: rgba(105,219,124,0.12);
    border-color: rgba(105,219,124,0.34);
    color: var(--p2-color);
  }

  .action-copy-all.danger {
    background: rgba(255,107,107,0.1);
    border-color: rgba(255,107,107,0.28);
    color: var(--p0-color);
  }

  .action-review-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: 6px;
    margin-bottom: 8px;
  }

  .action-review-filter {
    min-width: 0;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    cursor: pointer;
    display: flex;
    justify-content: center;
    gap: 4px;
    line-height: 1.2;
    white-space: nowrap;
  }

  .action-review-filter:hover {
    border-color: rgba(108,92,231,0.5);
    color: var(--text);
  }

  .action-review-filter.active {
    background: rgba(108,92,231,0.18);
    border-color: rgba(162,155,254,0.55);
    color: var(--accent-light);
  }

  .action-review-filter-count {
    color: var(--text);
  }

  .alert-card, .action-card {
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface-2);
  }

  .action-card.dismissed {
    opacity: 0.68;
    border-style: dashed;
  }

  .action-card.editing {
    border-color: rgba(116,185,255,0.54);
    background: rgba(116,185,255,0.08);
  }

  .alert-card:hover, .action-card:hover {
    border-color: rgba(108,92,231,0.72);
    transform: translateX(2px);
    box-shadow: 0 8px 18px rgba(0,0,0,0.18);
  }
  .alert-card .card-header, .meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .priority-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .priority-tag.p0 { background: var(--p0-bg); color: var(--p0-color); border: 1px solid var(--p0-border); }
  .priority-tag.p1 { background: var(--p1-bg); color: var(--p1-color); border: 1px solid var(--p1-border); }
  .priority-tag.p2 { background: var(--p2-bg); color: var(--p2-color); border: 1px solid var(--p2-border); }
  .priority-tag.memory-tag { background: rgba(108,92,231,0.15); color: var(--accent-light); border: 1px solid rgba(108,92,231,0.35); }
  .time { font-size: 11px; color: var(--text-dim); margin-left: auto; }
  .content { font-size: 13px; line-height: 1.5; color: var(--text); margin-top: 5px; }
  .content a { color: var(--accent-light); text-decoration: underline; text-underline-offset: 2px; }
  .memory-why-matched { font-size: 11px; color: var(--text-dim); margin-top: 4px; font-style: italic; }
  .memory-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }

  .mini-timeline { display: flex; flex-direction: column; gap: 6px; padding-left: 16px; position: relative; }
  .mini-timeline::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 8px;
    width: 2px;
    height: calc(100% - 16px);
    background: linear-gradient(180deg, var(--accent), var(--border));
    border-radius: 2px;
  }

  .mini-tl-item {
    position: relative;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    font-size: 12px;
    transition: all 0.2s;
  }

  .mini-tl-item::before {
    content: '';
    position: absolute;
    left: -18px;
    top: 12px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--accent);
    background: var(--bg-dark);
  }

  .mini-tl-item.decision::before { border-color: #00cec9; }
  .mini-tl-item.action::before { border-color: #ffa502; }
  .mini-tl-item.mention::before { border-color: var(--p0-color); background: rgba(255,107,107,0.2); }
  .mini-tl-item.screen::before { border-color: #74b9ff; }
  .tl-time { color: var(--text-muted); font-size: 10px; margin-right: 6px; font-variant-numeric: tabular-nums; }
  .tl-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-right: 4px;
  }
  .tl-badge.topic { background: rgba(108,92,231,0.15); color: var(--accent-light); }
  .tl-badge.decision { background: rgba(0,206,201,0.15); color: #00cec9; }
  .tl-badge.action { background: rgba(255,165,2,0.15); color: #ffa502; }
  .tl-badge.mention { background: rgba(255,107,107,0.15); color: var(--p0-color); }
  .tl-badge.screen { background: rgba(116,185,255,0.15); color: #74b9ff; }
  .tl-summary { display: flex; align-items: center; gap: 4px; }
  .tl-expand-icon { font-size: 10px; color: var(--text-muted); margin-left: auto; transition: transform 0.2s; flex-shrink: 0; }
  .mini-tl-item.expanded .tl-expand-icon { transform: rotate(90deg); }
  .mini-tl-item.timeline-focused {
    border-color: rgba(255,165,2,0.72);
    box-shadow: 0 0 0 2px rgba(255,165,2,0.18), 0 10px 22px rgba(0,0,0,0.2);
  }
  .mini-tl-detail {
    display: none;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-dim);
    line-height: 1.55;
  }
  .mini-tl-item.expanded .mini-tl-detail { display: block; }
  .detail-desc { margin-bottom: 6px; }
  .detail-speaker {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    background: var(--surface-3);
    padding: 2px 8px;
    border-radius: 8px;
    color: var(--text-muted);
  }
  .detail-actions { margin-top: 6px; display: flex; flex-direction: column; gap: 3px; }
  .detail-action {
    font-size: 10px;
    color: var(--text-muted);
    padding: 3px 6px;
    background: rgba(255,165,2,0.08);
    border-radius: 4px;
    border-left: 2px solid #ffa502;
  }
  .detail-screenshot {
    margin-top: 6px;
    width: 100%;
    height: 60px;
    background: var(--surface-3);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }

  .action-card .ac-title { font-size: 12.5px; font-weight: 600; margin-bottom: 4px; }
  .action-card .ac-meta { font-size: 10.5px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .action-card .ac-edited {
    color: #bfdbfe;
    border: 1px solid rgba(116,185,255,0.25);
    border-radius: 999px;
    padding: 1px 6px;
  }
  .action-card .ac-edit-form {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .action-card .ac-edit-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(86px, 0.7fr);
    gap: 7px;
  }
  .action-card .ac-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 700;
  }
  .action-card .ac-field input {
    min-width: 0;
    min-height: 30px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: rgba(15,23,42,0.64);
    color: var(--text);
    padding: 5px 7px;
    font-size: 11px;
    line-height: 1.35;
    outline: none;
  }
  .action-card .ac-field input:focus {
    border-color: rgba(116,185,255,0.58);
    box-shadow: 0 0 0 2px rgba(116,185,255,0.1);
  }
  .action-card .ac-edit-error {
    color: var(--p0-color);
    font-size: 10.5px;
    line-height: 1.35;
  }
  .action-card .ac-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 8px;
  }
  .action-card .ac-button {
    min-height: 26px;
    padding: 5px 8px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: var(--surface-3);
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .action-card .ac-button:hover {
    border-color: rgba(108,92,231,0.58);
    color: var(--text);
  }
  .action-card .ac-button.primary {
    background: rgba(105,219,124,0.12);
    border-color: rgba(105,219,124,0.34);
    color: var(--p2-color);
  }
  .action-card .ac-button.success {
    background: rgba(116,185,255,0.12);
    border-color: rgba(116,185,255,0.34);
    color: #74b9ff;
  }
  .action-card .ac-button.danger {
    background: rgba(255,107,107,0.1);
    border-color: rgba(255,107,107,0.28);
    color: var(--p0-color);
  }
  .action-card .ac-evidence {
    margin-top: 6px;
    padding: 6px 8px;
    border-left: 2px solid #ffa502;
    border-radius: 6px;
    background: rgba(255,165,2,0.08);
    color: var(--text-dim);
    font-size: 10.5px;
    line-height: 1.45;
  }
  .ac-status { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }
  .ac-status.pending { background: rgba(255,165,2,0.15); color: #ffa502; }
  .ac-status.done { background: rgba(105,219,124,0.15); color: var(--p2-color); }
  .ac-status.confirmed { background: rgba(116,185,255,0.15); color: #74b9ff; }
  .ac-status.dismissed { background: rgba(148,163,184,0.12); color: var(--text-muted); }

  .settings-group { margin-bottom: 12px; }
  .settings-group .sg-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    font-size: 12px;
    color: var(--text-dim);
    border-bottom: 1px solid rgba(46,51,64,0.5);
  }
  .setting-row input[type="text"], .setting-row input[type="number"], .setting-row select {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 8px;
    color: var(--text);
    font-size: 11px;
    width: 140px;
  }
  .setting-row input[type="checkbox"] { accent-color: var(--accent); }
  .setting-row.readonly { align-items: flex-start; }
  .setting-value {
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    max-width: 150px;
    text-align: right;
    line-height: 1.45;
  }
  .settings-note {
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(108,92,231,0.08);
    border: 1px solid rgba(108,92,231,0.18);
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.6;
    margin-bottom: 10px;
  }
  .settings-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
  }
  .settings-chip {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
  }
  .settings-chip.ok {
    background: rgba(105,219,124,0.10);
    color: var(--p2-color);
    border-color: rgba(105,219,124,0.24);
  }
  .settings-chip.warn {
    background: rgba(255,212,59,0.10);
    color: var(--p1-color);
    border-color: rgba(255,212,59,0.22);
  }
  .settings-chip.neutral {
    background: rgba(148,163,184,0.12);
    color: var(--text-dim);
    border-color: rgba(148,163,184,0.16);
  }
  .settings-link-btn {
    width: 100%;
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(108,92,231,0.24);
    background: linear-gradient(135deg, rgba(108,92,231,0.12), rgba(162,155,254,0.08));
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .settings-link-btn:hover {
    border-color: rgba(108,92,231,0.4);
    box-shadow: 0 8px 18px rgba(0,0,0,0.16);
  }

  .panel-status {
    padding: 10px 16px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: var(--text-dim);
    background: rgba(14,16,23,0.92);
  }
  .rec-status { display: flex; align-items: center; gap: 6px; color: var(--rec-red); font-weight: 600; }
  .rec-dot-s { width: 8px; height: 8px; border-radius: 50%; background: var(--rec-red); animation: blink 1.2s ease-in-out infinite; }
  .panel-status-action {
    margin-left: 4px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .panel-status-action:hover { border-color: var(--accent); color: var(--text); }
  .panel-pin,
  .panel-close {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-dim);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .panel-pin:hover,
  .panel-close:hover { background: var(--surface-2); color: var(--text); }
  .panel-pin svg {
    width: 15px;
    height: 15px;
    display: block;
  }
  .panel-pin.active {
    color: var(--accent-light);
    border-color: rgba(162,155,254,0.48);
    background: rgba(108,92,231,0.16);
  }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

  .empty-state {
    padding: 12px;
    border-radius: 12px;
    border: 1px dashed rgba(148,163,184,0.16);
    background: rgba(148,163,184,0.06);
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.55;
  }

  .catchup-modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(6px);
  }

  .catchup-card {
    width: min(480px, calc(100vw - 24px));
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }

  .modal-header {
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(108,92,231,0.12) 0%, rgba(162,155,254,0.06) 100%);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .modal-header h3 { font-size: 16px; font-weight: 700; margin: 0; }

  .modal-close-btn {
    margin-left: auto;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: var(--surface-2);
    color: var(--text-dim);
    cursor: pointer;
  }

  .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .time-pills { display: flex; gap: 8px; padding: 0 20px 16px; flex-wrap: wrap; }
  .time-pill {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-dim);
    font-size: 12px;
  }
  .time-pill.active { background: rgba(108,92,231,0.2); border-color: var(--accent); color: var(--accent); }
  .catchup-section { padding: 10px 14px; border-radius: 10px; background: var(--surface-2); }
  .catchup-section .section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); margin-bottom: 6px; }
  .catchup-section .section-content { font-size: 14px; line-height: 1.6; }

  .speech-tab { display: flex; flex-direction: column; gap: 10px; padding: 0; }
  .speech-suggestion-card {
    position: sticky;
    top: 0;
    z-index: 5;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(23, 29, 42, 0.96);
    border: 1px solid rgba(94, 116, 160, 0.42);
    box-shadow: 0 10px 28px rgba(0,0,0,0.22);
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .speech-suggestion-card.stale {
    opacity: 0.78;
  }
  .speech-suggestion-kicker {
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 700;
  }
  .speech-suggestion-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: start;
  }
  .speech-suggestion-text {
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
    font-weight: 650;
    word-break: break-word;
  }
  .speech-suggestion-actions {
    display: inline-flex;
    gap: 5px;
    flex-wrap: nowrap;
  }
  .speech-suggestion-icon-btn,
  .speech-context-toggle,
  .speech-context-save,
  .speech-context-note button {
    background: var(--surface-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
    font-size: 11px;
    white-space: nowrap;
  }
  .speech-suggestion-icon-btn:hover,
  .speech-context-toggle:hover,
  .speech-context-save:hover,
  .speech-context-note button:hover {
    color: var(--text);
    border-color: rgba(108,92,231,0.6);
  }
  .speech-suggestion-icon-btn:disabled,
  .speech-context-save:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .speech-suggestion-meta,
  .speech-context-row {
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.4;
  }
  .speech-context-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .speech-context-message { color: var(--p2-color); }
  .speech-context-error { color: var(--p0-color); }
  .speech-context-editor {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .speech-context-input {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    min-height: 68px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.45;
  }
  .speech-context-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-glow);
  }
  .speech-context-editor-actions {
    display: flex;
    justify-content: flex-end;
  }
  .speech-context-save {
    color: var(--accent-light);
    border-color: rgba(108,92,231,0.55);
  }
  .speech-context-note-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .speech-context-note {
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 5px 4px 8px;
    border-radius: 6px;
    background: rgba(108,92,231,0.08);
    border: 1px solid rgba(108,92,231,0.16);
    color: var(--text-dim);
    font-size: 11px;
  }
  .speech-context-note span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .speech-context-note button {
    padding: 1px 5px;
    font-size: 10px;
  }
  .speech-status-card {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 12px;
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .speech-status-card .speech-error { color: var(--p0-color); }
  .speech-turn-list { display: flex; flex-direction: column; gap: 8px; }
  .speech-turn-card {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .speech-turn-card.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-glow);
  }
  .speech-turn-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .speech-speaker-btn {
    background: none;
    border: none;
    color: var(--text);
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-size: 13px;
  }
  .speech-speaker-btn:hover { color: var(--accent-light); }
  .speech-meta { color: var(--text-dim); font-size: 11px; }
  .speech-lowconf { color: var(--p1-color); }
  .speech-rename-btn {
    margin-left: auto;
    background: var(--surface-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 11px;
  }
  .speech-rename-btn:hover { color: var(--text); }
  .speech-rename-row { display: inline-flex; gap: 4px; align-items: center; }
  .speech-rename-input {
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 2px 6px;
    font-size: 12px;
    min-width: 100px;
  }
  .speech-rename-confirm,
  .speech-rename-cancel {
    background: var(--surface-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px 6px;
    cursor: pointer;
    font-size: 11px;
  }
  .speech-rename-confirm { color: var(--accent-light); border-color: var(--accent); }
  .speech-source-badges { display: inline-flex; gap: 4px; }
  .speech-source-badge {
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(108,92,231,0.12);
    color: var(--accent-light);
    font-size: 10px;
    text-transform: uppercase;
  }
  .speech-turn-body {
    color: var(--text);
    font-size: 13px;
    line-height: 1.55;
    word-break: break-word;
  }
  .speech-fade-text {
    display: inline;
  }
  .speech-chunk {
    display: inline;
  }
  .speech-chunk-gap {
    display: inline;
  }
  .speech-fade-char {
    display: inline-block;
    opacity: 0;
    transform: translateY(3px);
    animation: speech-char-in 420ms ease forwards;
    will-change: opacity, transform;
  }
  .speech-fade-char.visible {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
    animation: none;
    will-change: auto;
  }
  @keyframes speech-char-in {
    from {
      opacity: 0;
      transform: translateY(3px);
      filter: blur(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .speech-fade-char {
      opacity: 1;
      transform: none;
      filter: none;
      animation: none;
    }
  }
  .speech-stance-panel {
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(108,92,231,0.08);
    border: 1px solid rgba(108,92,231,0.2);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .speech-stance-header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .speech-stance-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .speech-stance-item { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px; }
  .speech-stance-tag {
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11px;
    background: var(--surface-2);
    color: var(--text);
  }
  .speech-stance-tag.stance-主导 { color: #fff; background: var(--accent); }
  .speech-stance-tag.stance-支持 { color: #fff; background: var(--p2-color); }
  .speech-stance-tag.stance-中立 { color: var(--text-dim); }
  .speech-stance-tag.stance-质疑 { color: #1a1d27; background: var(--p1-color); }
  .speech-stance-tag.stance-反对 { color: #fff; background: var(--p0-color); }
  .speech-stance-topic { color: var(--text); font-weight: 500; }
  .speech-stance-quote { color: var(--text-dim); font-style: italic; }

`;

function formatElapsed(startedAt?: number, fallback?: number): string {
  const base = startedAt || fallback;
  if (!base) return '--:--';
  const totalSeconds = Math.max(0, Math.floor((Date.now() - base) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function getCurrentChapter(session: MeetingPilotSessionSnapshot) {
  if (!session.chapters.length) return undefined;
  const index = Math.min(
    session.chapters.length - 1,
    Math.max(
      0,
      Math.floor((session.timelineProgress || 0) * session.chapters.length),
    ),
  );
  return session.chapters[index];
}

function getMentionAlerts(session: MeetingPilotSessionSnapshot) {
  return session.alerts.filter(
    (alert) =>
      !alert.resolved &&
      (alert.source === 'mention' || alert.source === 'action'),
  );
}

function levelKey(level: MeetingPilotAlert['level']) {
  return level.toLowerCase();
}

function formatConfigEndpoint(url: string): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    return '未配置';
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.host;
  } catch {
    return trimmed;
  }
}

function MeetingSidePanel() {
  const [state, refresh] = useMeetingPilotState();
  const [captureLogEntries, setCaptureLogEntries] = useState<
    MeetingPilotCaptureLogEntry[]
  >([]);
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);
  const [catchupOpen, setCatchupOpen] = useState(false);
  const [expandedTimelineIds, setExpandedTimelineIds] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState<ActionReviewFilter>('open');
  const [actionCopyFeedback, setActionCopyFeedback] = useState<{
    id: string;
    status: 'copied' | 'failed';
  } | null>(null);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionEditDraft, setActionEditDraft] = useState<ActionEditDraft>({
    title: '',
    owner: '',
    deadline: '',
  });
  const [actionEditError, setActionEditError] = useState<string | null>(null);
  const [captureGuideFeedback, setCaptureGuideFeedback] = useState<
    'shown' | 'failed' | null
  >(null);
  const [panelUiReady, setPanelUiReady] = useState(false);
  const [settings, setSettings] = useState({
    autoDetect: true,
    danmakuSpeed: 'medium',
    entryMode: 'auto',
    providerBaseUrl: '',
    transcribeModel: defaultEnvConfig.MEETING_TRANSCRIBE_MODEL,
    mainLlmProfile: '—',
    minutesApiUrl: '',
    hotwords: '',
    nameAliases: '',
    summaryIntervalSec: '45',
    screenshotIntervalSec: '18',
    memoryContextEnabled: true,
    privacyNoticeText: '',
  });
  const requestedTabId = getRequestedTabId();
  const surfaceMode = useMemo(() => getRequestedSurfaceMode(), []);
  const embeddedMode = useMemo(() => surfaceMode === 'embedded', [surfaceMode]);
  const fillShellWidth = surfaceMode !== 'window';
  const panelContentRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<TabId>(DEFAULT_TAB);
  const scrollTopByTabRef = useRef<Partial<Record<TabId, number>>>({});
  const viewportStateRef = useRef<Partial<Record<TabId, PanelViewportState>>>(
    {},
  );
  const pendingRestoreTabRef = useRef<TabId | null>(DEFAULT_TAB);
  const persistTimerRef = useRef<number | null>(null);
  const restoreTimerRefs = useRef<number[]>([]);
  const actionCopyResetTimerRef = useRef<number | null>(null);
  const timelineFocusResetTimerRef = useRef<number | null>(null);
  const captureGuideFeedbackTimerRef = useRef<number | null>(null);
  const panelUiReadyRef = useRef(false);
  const panelUiStorageKeyRef = useRef('');
  const [focusedTimelineEventId, setFocusedTimelineEventId] = useState<
    string | null
  >(null);
  /** 开发联调：始终可开 Capture Log；?debug=1 仍保留给其它更啰嗦的调试用。 */
  const showDebugTab =
    __DEV__ && new URLSearchParams(window.location.search).get('debug') !== '0';
  const useDemoSession = shouldUseMeetingPilotDemo();
  const session = useDemoSession
    ? getDemoMeetingSessionSnapshot(requestedTabId || 0)
    : (requestedTabId
        ? (state?.activeSession?.tabId === requestedTabId
            ? state.activeSession
            : undefined) ||
          state?.sessions.find((item) => item.tabId === requestedTabId) ||
          state?.activeSession
        : state?.activeSession) ||
      createMeetingPilotSessionSnapshot({
        meetingId: 'unbound',
        tabId: requestedTabId || 0,
        url: '',
        title: 'Meeting Pilot',
      });
  const panelUiStorageKey = useMemo(
    () => buildPanelUiStorageKey(session),
    [session.meetingId, session.tabId],
  );
  panelUiStorageKeyRef.current = panelUiStorageKey;
  panelUiReadyRef.current = panelUiReady;

  const persistCurrentTabScroll = () => {
    const container = panelContentRef.current;
    if (!container) {
      return;
    }
    const currentTab = activeTabRef.current;
    const scrollTop = container.scrollTop;
    scrollTopByTabRef.current[currentTab] = scrollTop;
    viewportStateRef.current[currentTab] = {
      isAtTop: scrollTop <= TOP_SCROLL_THRESHOLD,
      lastScrollHeight: container.scrollHeight,
    };
  };

  const schedulePersistPanelUiState = () => {
    if (!panelUiReady) {
      return;
    }
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      void persistPanelUiState(panelUiStorageKey, {
        activeTab: activeTabRef.current,
        scrollTopByTab: scrollTopByTabRef.current,
      });
    }, 120);
  };

  const flushPersistPanelUiState = () => {
    if (!panelUiReady) {
      return;
    }
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    void persistPanelUiState(panelUiStorageKey, {
      activeTab: activeTabRef.current,
      scrollTopByTab: scrollTopByTabRef.current,
    });
  };

  const handlePanelTabChange = (nextTab: TabId) => {
    if (nextTab === activeTabRef.current) {
      return;
    }
    persistCurrentTabScroll();
    activeTabRef.current = nextTab;
    pendingRestoreTabRef.current = nextTab;
    setActiveTab(nextTab);
    schedulePersistPanelUiState();
  };

  const handlePanelScroll = () => {
    persistCurrentTabScroll();
    schedulePersistPanelUiState();
  };

  const syncSettingsFromEnv = (envConfig: EnvConfigType) => {
    setSettings({
      autoDetect: envConfig.MEETING_AUTO_DETECT,
      danmakuSpeed: envConfig.MEETING_DANMAKU_SPEED,
      entryMode: envConfig.MEETING_ENTRY_MODE,
      providerBaseUrl: envConfig.MEETING_PROVIDER_BASE_URL,
      transcribeModel: envConfig.MEETING_TRANSCRIBE_MODEL,
      mainLlmProfile: formatMainLlmProfileForMeetingPilot(envConfig),
      minutesApiUrl: envConfig.MEETING_MINUTES_API_URL,
      hotwords: envConfig.MEETING_HOTWORDS,
      nameAliases: envConfig.MEETING_NAME_ALIASES,
      summaryIntervalSec: String(envConfig.MEETING_SUMMARY_INTERVAL_SEC),
      screenshotIntervalSec: String(envConfig.MEETING_SCREENSHOT_INTERVAL_SEC),
      memoryContextEnabled: envConfig.MEETING_MEMORY_CONTEXT_ENABLED,
      privacyNoticeText: envConfig.MEETING_PRIVACY_NOTICE_TEXT,
    });
  };
  const currentChapter = getCurrentChapter(session);
  const launchCatchup = useMemo(
    () => new URLSearchParams(window.location.search).get('catchup') === '1',
    [],
  );
  const mentionAlerts = getMentionAlerts(session);
  const unresolvedAlerts = session.alerts.filter((alert) => !alert.resolved);
  const liveFeedItems = [
    ...session.memoryRefs.map((ref) => ({
      kind: 'memory' as const,
      id: ref.id,
      createdAt: 0,
      memory: ref,
    })),
    ...unresolvedAlerts.map((alert) => ({
      kind: 'alert' as const,
      id: alert.id,
      createdAt: alert.createdAt,
      alert,
    })),
  ].sort((left, right) => right.createdAt - left.createdAt);
  const pendingActions = session.actionItems.filter(
    (item) =>
      item.status === 'pending' && getActionReviewState(item) !== 'dismissed',
  );
  const openActions = session.actionItems.filter((item) =>
    isActionVisibleInFilter(item, 'open'),
  );
  const reviewQueueActions = session.actionItems.filter(
    (item) => getActionReviewState(item) === 'suggested',
  );
  const confirmedActions = session.actionItems.filter(
    (item) =>
      getActionReviewState(item) === 'confirmed' && item.status !== 'done',
  );
  const doneActions = session.actionItems.filter((item) =>
    isActionVisibleInFilter(item, 'done'),
  );
  const dismissedActions = session.actionItems.filter(
    (item) => getActionReviewState(item) === 'dismissed',
  );
  const visibleActionItems = session.actionItems.filter((item) =>
    isActionVisibleInFilter(item, actionFilter),
  );
  const actionFilterOptions: Array<{
    key: ActionReviewFilter;
    label: string;
    count: number;
  }> = [
    { key: 'open', label: '处理中', count: openActions.length },
    { key: 'review', label: '待复核', count: reviewQueueActions.length },
    { key: 'confirmed', label: '已确认', count: confirmedActions.length },
    { key: 'done', label: '已完成', count: doneActions.length },
    { key: 'dismissed', label: '已忽略', count: dismissedActions.length },
    { key: 'all', label: '全部', count: session.actionItems.length },
  ];
  const activeTabContentVersion = useMemo(() => {
    if (activeTab === 'live') {
      return `live:${session.updatedAt}:${liveFeedItems.length}:${
        liveFeedItems[0]?.id || ''
      }:${session.currentTopic}`;
    }
    if (activeTab === 'speech') {
      return `speech:${session.updatedAt}:${session.transcriptTurns.length}:${
        session.transcriptTurns[0]?.id || ''
      }`;
    }
    if (activeTab === 'timeline') {
      return `timeline:${session.updatedAt}:${session.timelineEvents.length}:${
        session.timelineEvents[0]?.id || ''
      }`;
    }
    if (activeTab === 'actions') {
      return `actions:${session.updatedAt}:${session.actionItems.length}:${
        session.actionItems[0]?.id || ''
      }:${actionFilter}:${visibleActionItems.length}`;
    }
    if (activeTab === 'settings') {
      return `settings:${settings.autoDetect}:${settings.danmakuSpeed}:${settings.entryMode}`;
    }
    return `capture-log:${captureLogEntries.length}:${
      captureLogEntries[0]?.id || ''
    }`;
  }, [
    activeTab,
    captureLogEntries,
    liveFeedItems,
    session.actionItems,
    actionFilter,
    visibleActionItems.length,
    session.currentTopic,
    session.timelineEvents,
    session.transcriptTurns,
    session.updatedAt,
    settings.autoDetect,
    settings.danmakuSpeed,
    settings.entryMode,
  ]);
  const toggleTimelineItem = (eventId: string) => {
    setExpandedTimelineIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  };
  const updateActionItemReview = async (
    item: MeetingPilotActionItem,
    updates: {
      status?: 'pending' | 'done';
      reviewState?: 'suggested' | 'confirmed' | 'dismissed';
      title?: string;
      owner?: string;
      deadline?: string;
    },
  ): Promise<boolean> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_UPDATE_ACTION_ITEM',
        tabId: session.tabId,
        meetingId: session.meetingId,
        actionItemId: item.id,
        ...updates,
      });
      if (!response?.success) {
        throw new Error(response?.message || '更新行动项失败');
      }
      await refresh();
      return true;
    } catch (error) {
      console.warn('[Meeting Pilot][sidepanel] update action item failed', {
        actionItemId: item.id,
        error: String((error as Error)?.message || error),
      });
      return false;
    }
  };
  const startActionItemEdit = (item: MeetingPilotActionItem) => {
    setEditingActionId(item.id);
    setActionEditDraft(buildActionEditDraft(item));
    setActionEditError(null);
  };
  const cancelActionItemEdit = () => {
    setEditingActionId(null);
    setActionEditError(null);
  };
  const saveActionItemEdit = async (item: MeetingPilotActionItem) => {
    const title = actionEditDraft.title.trim();
    const owner = actionEditDraft.owner.trim();
    const deadline = actionEditDraft.deadline.trim();
    if (!title || !owner) {
      setActionEditError('标题和负责人不能为空。');
      return;
    }
    setActionEditError(null);
    const success = await updateActionItemReview(item, {
      title,
      owner,
      deadline,
      reviewState: 'confirmed',
    });
    if (success) {
      setEditingActionId(null);
    } else {
      setActionEditError('保存失败，请稍后重试。');
    }
  };
  const copyActionItem = async (item: MeetingPilotActionItem) => {
    if (actionCopyResetTimerRef.current) {
      window.clearTimeout(actionCopyResetTimerRef.current);
    }

    try {
      await writeTextToClipboard(formatActionItemForClipboard(item));
      setActionCopyFeedback({ id: item.id, status: 'copied' });
    } catch (error) {
      console.warn('[Meeting Pilot][sidepanel] copy action item failed', {
        actionItemId: item.id,
        error: String((error as Error)?.message || error),
      });
      setActionCopyFeedback({ id: item.id, status: 'failed' });
    }

    actionCopyResetTimerRef.current = window.setTimeout(() => {
      setActionCopyFeedback((current) =>
        current?.id === item.id ? null : current,
      );
      actionCopyResetTimerRef.current = null;
    }, 1800);
  };
  const copyVisibleActionItems = async () => {
    if (!visibleActionItems.length) {
      return;
    }
    if (actionCopyResetTimerRef.current) {
      window.clearTimeout(actionCopyResetTimerRef.current);
    }

    try {
      await writeTextToClipboard(
        formatActionItemsForClipboard(visibleActionItems, actionFilter),
      );
      setActionCopyFeedback({
        id: BULK_ACTION_COPY_ID,
        status: 'copied',
      });
    } catch (error) {
      console.warn('[Meeting Pilot][sidepanel] copy action items failed', {
        actionFilter,
        count: visibleActionItems.length,
        error: String((error as Error)?.message || error),
      });
      setActionCopyFeedback({
        id: BULK_ACTION_COPY_ID,
        status: 'failed',
      });
    }

    actionCopyResetTimerRef.current = window.setTimeout(() => {
      setActionCopyFeedback((current) =>
        current?.id === BULK_ACTION_COPY_ID ? null : current,
      );
      actionCopyResetTimerRef.current = null;
    }, 1800);
  };
  const focusTimelineForAction = (item: MeetingPilotActionItem) => {
    const targetEvent = findTimelineEventForAction(session, item);
    if (!targetEvent) {
      return;
    }
    persistCurrentTabScroll();
    setExpandedTimelineIds((current) =>
      current.includes(targetEvent.id) ? current : [...current, targetEvent.id],
    );
    setFocusedTimelineEventId(targetEvent.id);
    activeTabRef.current = 'timeline';
    pendingRestoreTabRef.current = null;
    setActiveTab('timeline');
    schedulePersistPanelUiState();
  };

  useEffect(() => {
    (async () => {
      const envConfig = await getEnvConfig();
      syncSettingsFromEnv(envConfig);
    })();

    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local' || !changes.envConfig?.newValue) {
        return;
      }
      syncSettingsFromEnv(changes.envConfig.newValue as EnvConfigType);
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, []);

  useEffect(
    () => () => {
      if (actionCopyResetTimerRef.current) {
        window.clearTimeout(actionCopyResetTimerRef.current);
      }
      if (timelineFocusResetTimerRef.current) {
        window.clearTimeout(timelineFocusResetTimerRef.current);
      }
      if (captureGuideFeedbackTimerRef.current) {
        window.clearTimeout(captureGuideFeedbackTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setPanelUiReady(false);
    pendingRestoreTabRef.current = DEFAULT_TAB;
    void loadPanelUiState(panelUiStorageKey).then((stored) => {
      if (cancelled) {
        return;
      }
      const restoredTab = normalizeActiveTab(stored.activeTab, showDebugTab);
      activeTabRef.current = restoredTab;
      scrollTopByTabRef.current = sanitizeScrollTopByTab(
        stored.scrollTopByTab,
        showDebugTab,
      );
      setActiveTab(restoredTab);
      pendingRestoreTabRef.current = restoredTab;
      setPanelUiReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [panelUiStorageKey, showDebugTab]);

  useEffect(() => {
    const handlePageHide = () => {
      if (!panelUiReadyRef.current) {
        return;
      }
      persistCurrentTabScroll();
      void persistPanelUiState(panelUiStorageKeyRef.current, {
        activeTab: activeTabRef.current,
        scrollTopByTab: scrollTopByTabRef.current,
      });
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      restoreTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
      restoreTimerRefs.current = [];
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const openCatchup = () => {
    if (embeddedMode && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'MEETING_PILOT_EMBEDDED_CATCHUP_OPEN',
          source: 'meeting-pilot',
        },
        '*',
      );
      return;
    }
    setCatchupOpen(true);
  };

  useEffect(() => {
    if (!launchCatchup) return;
    openCatchup();
    const params = new URLSearchParams(window.location.search);
    params.delete('catchup');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
  }, [embeddedMode, launchCatchup]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== 'c' ||
        isTextEntryTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      openCatchup();
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [embeddedMode]);

  useEffect(() => {
    if (activeTab !== 'capture-log') {
      return;
    }

    let cancelled = false;
    const loadCaptureLog = async () => {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_GET_CAPTURE_LOG',
      })) as { entries?: MeetingPilotCaptureLogEntry[] } | undefined;
      if (!cancelled) {
        setCaptureLogEntries(response?.entries || []);
      }
    };

    void loadCaptureLog();
    const timer = window.setInterval(() => void loadCaptureLog(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTab]);

  useLayoutEffect(() => {
    const container = panelContentRef.current;
    if (!container || !panelUiReady) {
      return;
    }
    if (pendingRestoreTabRef.current === activeTab) {
      const savedScrollTop = scrollTopByTabRef.current[activeTab] || 0;
      const applySavedScroll = () => {
        const activeContainer = panelContentRef.current;
        if (!activeContainer || activeTabRef.current !== activeTab) {
          return;
        }
        activeContainer.scrollTop = savedScrollTop;
        scrollTopByTabRef.current[activeTab] = activeContainer.scrollTop;
        viewportStateRef.current[activeTab] = {
          isAtTop: activeContainer.scrollTop <= TOP_SCROLL_THRESHOLD,
          lastScrollHeight: activeContainer.scrollHeight,
        };
      };
      restoreTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
      restoreTimerRefs.current = [
        window.setTimeout(applySavedScroll, 0),
        window.setTimeout(applySavedScroll, 120),
      ];
      applySavedScroll();
      pendingRestoreTabRef.current = null;
      return;
    }

    const priorViewport = viewportStateRef.current[activeTab];
    if (!priorViewport) {
      viewportStateRef.current[activeTab] = {
        isAtTop: container.scrollTop <= TOP_SCROLL_THRESHOLD,
        lastScrollHeight: container.scrollHeight,
      };
      scrollTopByTabRef.current[activeTab] = container.scrollTop;
      return;
    }

    const nextScrollHeight = container.scrollHeight;
    if (
      !priorViewport.isAtTop &&
      nextScrollHeight > priorViewport.lastScrollHeight
    ) {
      container.scrollTop += nextScrollHeight - priorViewport.lastScrollHeight;
    }

    scrollTopByTabRef.current[activeTab] = container.scrollTop;
    viewportStateRef.current[activeTab] = {
      isAtTop: container.scrollTop <= TOP_SCROLL_THRESHOLD,
      lastScrollHeight: nextScrollHeight,
    };
  }, [activeTab, activeTabContentVersion, panelUiReady]);

  useLayoutEffect(() => {
    if (activeTab !== 'timeline' || !focusedTimelineEventId) {
      return;
    }
    const target = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.mini-tl-item[data-timeline-event-id]',
      ),
    ).find((element) => element.dataset.timelineEventId === focusedTimelineEventId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (timelineFocusResetTimerRef.current) {
      window.clearTimeout(timelineFocusResetTimerRef.current);
    }
    timelineFocusResetTimerRef.current = window.setTimeout(() => {
      setFocusedTimelineEventId((current) =>
        current === focusedTimelineEventId ? null : current,
      );
      timelineFocusResetTimerRef.current = null;
    }, TIMELINE_FOCUS_DURATION_MS);
  }, [activeTab, focusedTimelineEventId, activeTabContentVersion]);

  const toggleCaptureFromFooter = async () => {
    if (session.capture.kind === 'recording') {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_STOP_CAPTURE',
        tabId: session.tabId,
        meetingId: session.meetingId,
      });
    } else {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_START_CAPTURE',
        tabId: session.tabId,
        meetingId: session.meetingId,
        url: session.url,
        title: session.title,
      });
    }
    await refresh();
  };

  const saveSettings = async () => {
    const currentConfig = await getEnvConfig();
    await chrome.runtime.sendMessage({
      type: 'UPDATE_ENV_CONFIG',
      config: {
        ...currentConfig,
        MEETING_AUTO_DETECT: settings.autoDetect,
        MEETING_DANMAKU_SPEED: settings.danmakuSpeed as
          | 'fast'
          | 'medium'
          | 'slow',
        MEETING_ENTRY_MODE: settings.entryMode,
        MEETING_HOTWORDS: settings.hotwords,
        MEETING_NAME_ALIASES: settings.nameAliases,
        MEETING_SUMMARY_INTERVAL_SEC: Number(settings.summaryIntervalSec) || 45,
        MEETING_SCREENSHOT_INTERVAL_SEC:
          Number(settings.screenshotIntervalSec) || 18,
        MEETING_MEMORY_CONTEXT_ENABLED: settings.memoryContextEnabled,
        MEETING_PRIVACY_NOTICE_TEXT: settings.privacyNoticeText,
      },
    });
    await refresh();
  };

  const openMeetingOptionsPage = () => {
    const url = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('options.html#meeting-pilot-config')
      : 'options.html#meeting-pilot-config';
    window.open(url, '_blank', 'noopener');
  };

  const closeMeetingPanel = () => {
    persistCurrentTabScroll();
    flushPersistPanelUiState();
    if (embeddedMode && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'MEETING_PILOT_EMBEDDED_PANEL_CLOSE',
          source: 'meeting-pilot',
        },
        '*',
      );
      return;
    }
    void chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_CLOSE_SIDE_PANEL',
      tabId: session.tabId,
    });
  };

  const showCaptureAuthorizationGuide = async () => {
    if (captureGuideFeedbackTimerRef.current) {
      window.clearTimeout(captureGuideFeedbackTimerRef.current);
    }
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_SHOW_CAPTURE_AUTH_GUIDE',
        tabId: session.tabId,
        meetingId: session.meetingId,
        source: 'sidepanel-upgrade',
      });
      setCaptureGuideFeedback(response?.success ? 'shown' : 'failed');
    } catch (error) {
      console.warn('[Meeting Pilot][sidepanel] show capture guide failed', {
        tabId: session.tabId,
        error: String((error as Error)?.message || error),
      });
      setCaptureGuideFeedback('failed');
    }
    captureGuideFeedbackTimerRef.current = window.setTimeout(() => {
      setCaptureGuideFeedback(null);
      captureGuideFeedbackTimerRef.current = null;
    }, 2200);
  };

  const sidePanelPinned = Boolean(session.sidePanelPinned);
  const pinButtonActive = surfaceMode === 'side-panel' && sidePanelPinned;
  const toggleSidePanelPin = async () => {
    const nextPinned = !pinButtonActive;
    const nativeOpenPromise = nextPinned
      ? openChromeSidePanelFromUserGesture(session.tabId)
      : undefined;
    const response = (await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_SET_SIDE_PANEL_PIN',
      tabId: session.tabId,
      meetingId: session.meetingId,
      pinned: nextPinned,
      source: 'pin',
      skipOpen: Boolean(nativeOpenPromise),
    })) as
      | {
          success?: boolean;
          surface?: 'side-panel' | 'window' | 'unavailable';
        }
      | undefined;

    if (!response?.success) {
      return;
    }
    if (!nextPinned && surfaceMode !== 'embedded') {
      await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_OPEN_SIDE_PANEL',
        tabId: session.tabId,
        source: 'unpin',
        preferSurface: 'embedded',
      });
      await closePanelHostSurface(session.tabId, surfaceMode);
      await refresh();
      return;
    }
    const nativeSurface = await nativeOpenPromise;
    const openedSurface = nativeSurface || response.surface;
    if (
      nextPinned &&
      openedSurface === 'side-panel' &&
      embeddedMode &&
      window.parent !== window
    ) {
      window.parent.postMessage(
        {
          type: 'MEETING_PILOT_EMBEDDED_PANEL_CLOSE',
          source: 'meeting-pilot-pin',
        },
        '*',
      );
    }
    await refresh();
  };

  const transcribeModelLabel =
    settings.transcribeModel || defaultEnvConfig.MEETING_TRANSCRIBE_MODEL;
  const mainLlmProfileLabel = settings.mainLlmProfile;
  const readinessStatusLabel =
    session.readiness.status === 'blocked'
      ? 'Blocked'
      : session.readiness.status === 'degraded'
      ? 'Degraded'
      : 'Ready';
  const isEnhancedCaptureActive =
    session.capture.kind === 'armed' ||
    session.capture.kind === 'recording' ||
    session.capture.kind === 'uploading' ||
    session.capture.kind === 'completed';
  const isTranscriptPilotActive = Boolean(
    session.webTranscript?.active &&
      session.transcript.some(
        (chunk) => chunk.source === 'ringcentral_transcript',
      ),
  );
  const showCaptureStartCard =
    !isEnhancedCaptureActive && activeTab === 'live';
  const captureStartTitle = !session.readiness.canStartCapture
    ? '先修复配置，再从 popup 开始'
    : isTranscriptPilotActive
    ? 'Transcript Pilot 已自动运行'
    : session.capture.kind === 'error'
    ? '请改从 popup 重试 Capture'
    : session.capture.kind === 'stopped'
    ? '请改从 popup 重新开始 Capture'
    : '请从 popup 开始 Capture';
  const captureStartDescription = !session.readiness.canStartCapture
    ? '当前配置仍有阻断项。先修复配置，再点击浏览器右上角的 Personal AI 图标，并在 popup 第一项点击“开启会议全貌”。'
    : isTranscriptPilotActive
    ? '当前已通过 RingCentral Transcript 支撑发言、实时摘要、时间线、行动项和记忆关联。启用画面理解与纪要后，会额外读取共享画面/OCR，并把画面文字一起用于记忆关联和会后图文 Minutes。'
    : session.capture.lastError === 'tabCapture_stream_unavailable'
    ? 'Chrome 的标签页录制授权在当前实现里以 popup 按钮最稳定。请点击浏览器右上角的 Personal AI 图标，然后在 popup 第一项点击“开启会议全貌”。'
    : session.capture.kind === 'stopped'
    ? '录制已经停止。请点击浏览器右上角的 Personal AI 图标，然后在 popup 第一项点击“开启会议全貌”，恢复会中总结、时间线和会后分析。'
    : 'Chrome 的标签页录制授权在当前实现里以 popup 按钮最稳定。请点击浏览器右上角的 Personal AI 图标，然后在 popup 第一项点击“开启会议全貌”。';
  const captureGuideButtonLabel =
    captureGuideFeedback === 'shown'
      ? '已显示开启步骤'
      : captureGuideFeedback === 'failed'
      ? '未能显示步骤'
      : session.capture.kind === 'stopped'
      ? '查看重新开启步骤'
      : session.capture.kind === 'error'
      ? '查看重试步骤'
      : '查看开启步骤';
  const providerConfigured = Boolean(
    String(settings.providerBaseUrl || '').trim(),
  );
  const minutesConfigured = Boolean(
    String(settings.minutesApiUrl || '').trim(),
  );
  const debugTabButton =
    __DEV__ && showDebugTab ? (
      <button
        className={`panel-tab ${activeTab === 'capture-log' ? 'active' : ''}`}
        onClick={() => handlePanelTabChange('capture-log')}
      >
        Capture Log
      </button>
    ) : null;
  const debugTabContent =
    __DEV__ && activeTab === 'capture-log' && showDebugTab ? (
      <>
        <CaptureLogTab
          session={session}
          captureLogEntries={captureLogEntries}
          readinessStatusLabel={readinessStatusLabel}
          currentTopicLabel={currentChapter?.title || session.currentTopic}
        />
      </>
    ) : null;

  return (
    <div
      className={`meeting-shell${fillShellWidth ? ' fill-width' : ''}`}
      data-session-title={session.title}
    >
      <style>{shellStyle}</style>
      <div className="panel-header">
        <div className="panel-logo">
          <img
            src={chrome.runtime.getURL('icons/icon48.png')}
            alt="Meeting Pilot"
          />
        </div>
        <span className="panel-title">Meeting Pilot</span>
        <div className="panel-header-actions">
          <button
            className={`panel-pin${pinButtonActive ? ' active' : ''}`}
            type="button"
            title={
              pinButtonActive
                ? '取消固定 Chrome 侧边栏'
                : '固定到 Chrome 侧边栏'
            }
            aria-label={
              pinButtonActive
                ? '取消固定 Chrome 侧边栏'
                : '固定到 Chrome 侧边栏'
            }
            aria-pressed={pinButtonActive}
            disabled={session.tabId <= 0}
            onClick={() => void toggleSidePanelPin()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M14.5 4.5 19.5 9.5 16.3 10.6 13.2 13.7 13 18 11 20 9 15 4 13 6 11 10.3 10.8 13.4 7.7 14.5 4.5Z"
                fill={pinButtonActive ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="panel-close"
            type="button"
            aria-label="关闭 Meeting Pilot"
            onClick={closeMeetingPanel}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="panel-tabs" id="panelTabs">
        {(['live', 'speech', 'timeline', 'actions', 'settings'] as TabId[]).map(
          (tab) => (
            <button
              key={tab}
              className={`panel-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => handlePanelTabChange(tab)}
            >
              {tab === 'live'
                ? '实时'
                : tab === 'speech'
                ? '发言'
                : tab === 'timeline'
                ? '时间线'
                : tab === 'actions'
                ? '行动项'
                : '设置'}
              {tab === 'live' &&
              unresolvedAlerts.some((alert) => alert.level === 'P0') ? (
                <div className="badge" />
              ) : null}
            </button>
          ),
        )}
        {debugTabButton}
      </div>

      <div
        className="panel-content"
        ref={panelContentRef}
        onScroll={handlePanelScroll}
      >
        {activeTab === 'live' ? (
          <>
            {showCaptureStartCard ? (
              <div
                className={`capture-start-card ${
                  session.capture.kind === 'error' ? 'warn' : ''
                } ${isTranscriptPilotActive ? 'low-mode' : ''}`}
              >
                <div className="capture-start-eyebrow">
                  {isTranscriptPilotActive
                    ? 'Low-Power Meeting Pilot'
                    : 'Capture Authorization'}
                </div>
                <div className="capture-start-title">{captureStartTitle}</div>
                <div className="capture-start-copy">
                  {captureStartDescription}
                </div>
                {!session.readiness.canStartCapture ? (
                  <div className="capture-start-actions">
                    <button
                      className="capture-start-primary"
                      onClick={openMeetingOptionsPage}
                    >
                      ⚙️ 去配置 Meeting Pilot
                    </button>
                  </div>
                ) : isTranscriptPilotActive ? (
                  <div className="capture-start-actions">
                    <button
                      className="capture-start-primary"
                      onClick={() => void showCaptureAuthorizationGuide()}
                    >
                      启用画面理解与纪要
                    </button>
                  </div>
                ) : (
                  <div className="capture-start-actions">
                    <button
                      className="capture-start-primary"
                      onClick={() => void showCaptureAuthorizationGuide()}
                    >
                      {captureGuideButtonLabel}
                    </button>
                  </div>
                )}
                {captureGuideFeedback === 'failed' ? (
                  <div className="capture-start-feedback warn">
                    没能打开会议页引导。请确认原会议标签页仍在打开，然后从浏览器右上角扩展 icon 进入 popup。
                  </div>
                ) : null}
              </div>
            ) : null}

            <button className="catchup-btn" onClick={openCatchup}>
              ⚡ 刚错过了什么？
              <span className="shortcut">C</span>
            </button>

            <div className="current-topic-card">
              <div className="label">当前话题</div>
              <div className="value">
                {currentChapter?.title || session.currentTopic}
              </div>
            </div>

            <div className="current-topic-card">
              <div className="label">Readiness</div>
              <div className="value">{readinessStatusLabel}</div>
              <div className="subtext">{session.readiness.summary}</div>
              {!session.readiness.canStartCapture ? (
                <button
                  className="settings-link-btn"
                  style={{ marginTop: 10 }}
                  onClick={openMeetingOptionsPage}
                >
                  去配置 Meeting Pilot
                </button>
              ) : null}
            </div>

            <div className="alert-feed">
              {liveFeedItems.length ? (
                liveFeedItems.map((item) =>
                  item.kind === 'memory' ? (
                    <div className="alert-card" key={`memory-${item.id}`}>
                      <div className="card-header">
                        <span className="priority-tag memory-tag">记忆</span>
                        <span className="time">
                          {Math.round(item.memory.score * 100)}%
                        </span>
                      </div>
                      <div className="content">
                        {item.memory.title ? (
                          <strong>{item.memory.title}</strong>
                        ) : null}
                        <div>
                          {item.memory.fullSnippet || item.memory.snippet}
                        </div>
                        {item.memory.whyMatched ? (
                          <div className="memory-why-matched">
                            {item.memory.whyMatched}
                          </div>
                        ) : null}
                        <div className="memory-links">
                          {item.memory.exploreLink ? (
                            <a
                              href={item.memory.exploreLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              在记忆库中查看
                            </a>
                          ) : null}
                          {item.memory.sourceUrl ? (
                            <a
                              href={item.memory.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              打开原始文档
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-card" key={`alert-${item.id}`}>
                      <div className="card-header">
                        <span
                          className={`priority-tag ${levelKey(
                            item.alert.level,
                          )}`}
                        >
                          {item.alert.level}
                        </span>
                        <span className="time">
                          {new Date(item.alert.createdAt).toLocaleTimeString(
                            [],
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </span>
                      </div>
                      <div className="content">
                        <strong>{item.alert.title}</strong>
                        <div>{item.alert.body}</div>
                      </div>
                    </div>
                  ),
                )
              ) : (
                <div className="empty-state">
                  当前没有新的会中提醒。开启录制后，P0/P1/P2
                  提醒会进入这里，同时页内悬浮入口会显示轻量状态。
                </div>
              )}
            </div>
          </>
        ) : null}

        {activeTab === 'speech' ? (
          <>
            <div
              style={{
                padding: '4px 12px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <TierBadge tier={session.tier} />
            </div>
            <SpeechTab session={session} refresh={refresh} />
          </>
        ) : null}

        {activeTab === 'timeline' ? (
          <div className="mini-timeline">
            {session.timelineEvents.length ? (
              session.timelineEvents.map((event) => (
                <div
                  key={event.id}
                  className={`mini-tl-item ${event.type} ${
                    expandedTimelineIds.includes(event.id) ? 'expanded' : ''
                  } ${
                    focusedTimelineEventId === event.id
                      ? 'timeline-focused'
                      : ''
                  }`}
                  data-timeline-event-id={event.id}
                  onClick={() => toggleTimelineItem(event.id)}
                >
                  <div className="tl-summary">
                    <span className="tl-time">{event.timestamp}</span>
                    <span className={`tl-badge ${event.type}`}>
                      {event.type === 'screen'
                        ? '画面'
                        : event.type === 'decision'
                        ? '决议'
                        : event.type === 'mention'
                        ? '提及你'
                        : event.type === 'action'
                        ? '行动项'
                        : '话题'}
                    </span>
                    {event.title}
                    <span className="tl-expand-icon">▶</span>
                  </div>
                  <div className="mini-tl-detail">
                    <div className="detail-desc">{event.description}</div>
                    {event.speaker ? (
                      <div className="detail-speaker">👤 {event.speaker}</div>
                    ) : null}
                    {session.actionItems.some(
                      (item) =>
                        item.chapterId === event.chapterId &&
                        getActionReviewState(item) !== 'dismissed',
                    ) ? (
                      <div className="detail-actions">
                        {session.actionItems
                          .filter(
                            (item) =>
                              item.chapterId === event.chapterId &&
                              getActionReviewState(item) !== 'dismissed',
                          )
                          .slice(0, 2)
                          .map((item) => (
                            <div className="detail-action" key={item.id}>
                              {item.owner} — {item.title}
                              {item.deadline ? ` (${item.deadline})` : ''}
                              {item.evidence ? (
                                <div>依据：{item.evidence}</div>
                              ) : null}
                            </div>
                          ))}
                      </div>
                    ) : null}
                    {event.type === 'screen' ? (
                      <div className="detail-screenshot">
                        共享画面观察已记录
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                时间线会在会议检测、章节变化与行动项落地后逐步充实。
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'actions' ? (
          <div className="action-list">
            {session.actionItems.length ? (
              <>
                <div className="action-toolbar">
                  <div className="action-toolbar-count">
                    当前筛选 {visibleActionItems.length} /{' '}
                    {session.actionItems.length} 项
                  </div>
                  <button
                    className={`action-copy-all ${
                      actionCopyFeedback?.id === BULK_ACTION_COPY_ID
                        ? actionCopyFeedback.status === 'copied'
                          ? 'success'
                          : 'danger'
                        : ''
                    }`}
                    type="button"
                    disabled={!visibleActionItems.length}
                    onClick={() => void copyVisibleActionItems()}
                  >
                    {actionCopyFeedback?.id === BULK_ACTION_COPY_ID
                      ? actionCopyFeedback.status === 'copied'
                        ? '已复制当前筛选'
                        : '复制失败'
                      : '复制当前筛选'}
                  </button>
                </div>
                <div className="action-review-summary" aria-label="行动项筛选">
                  {actionFilterOptions.map((option) => (
                    <button
                      className={`action-review-filter ${
                        actionFilter === option.key ? 'active' : ''
                      }`}
                      data-action-filter={option.key}
                      type="button"
                      aria-pressed={actionFilter === option.key}
                      key={option.key}
                      onClick={() => setActionFilter(option.key)}
                    >
                      <span>{option.label}</span>
                      <span className="action-review-filter-count">
                        {option.count}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {visibleActionItems.length ? (
              visibleActionItems.map((item: MeetingPilotActionItem) => {
                const timelineTarget = findTimelineEventForAction(session, item);
                return (
                  <div
                    className={`action-card ${getActionReviewState(item)} ${
                      editingActionId === item.id ? 'editing' : ''
                    }`}
                    data-action-id={item.id}
                    key={item.id}
                  >
                    {editingActionId === item.id ? (
                      <div className="ac-edit-form">
                        <label className="ac-field">
                          <span>行动项</span>
                          <input
                            value={actionEditDraft.title}
                            onChange={(event) =>
                              setActionEditDraft((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className="ac-edit-row">
                          <label className="ac-field">
                            <span>负责人</span>
                            <input
                              value={actionEditDraft.owner}
                              onChange={(event) =>
                                setActionEditDraft((current) => ({
                                  ...current,
                                  owner: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="ac-field">
                            <span>截止</span>
                            <input
                              value={actionEditDraft.deadline}
                              placeholder="可留空"
                              onChange={(event) =>
                                setActionEditDraft((current) => ({
                                  ...current,
                                  deadline: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        {actionEditError ? (
                          <div className="ac-edit-error">{actionEditError}</div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div className="ac-title">📌 {item.title}</div>
                        <div className="ac-meta">
                          <span>👤 {item.owner}</span>
                          {item.deadline ? (
                            <span>📅 {item.deadline}</span>
                          ) : null}
                          {item.timestamp ? (
                            <span>🕒 {item.timestamp}</span>
                          ) : null}
                          <span
                            className={`ac-status ${getActionStatusClass(item)}`}
                          >
                            {getActionStatusLabel(item)}
                          </span>
                          {item.editedAt ? (
                            <span className="ac-edited">人工校正</span>
                          ) : null}
                        </div>
                      </>
                    )}
                    {item.evidence ? (
                      <div className="ac-evidence">依据：{item.evidence}</div>
                    ) : null}
                    <div className="ac-actions">
                      {editingActionId === item.id ? (
                        <>
                          <button
                            className="ac-button primary"
                            type="button"
                            onClick={() => void saveActionItemEdit(item)}
                          >
                            保存校正
                          </button>
                          <button
                            className="ac-button"
                            type="button"
                            onClick={cancelActionItemEdit}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className={`ac-button ${
                              actionCopyFeedback?.id === item.id &&
                              actionCopyFeedback.status === 'copied'
                                ? 'success'
                                : ''
                            }`}
                            type="button"
                            onClick={() => void copyActionItem(item)}
                          >
                            {actionCopyFeedback?.id === item.id
                              ? actionCopyFeedback.status === 'copied'
                                ? '已复制'
                                : '复制失败'
                              : '复制'}
                          </button>
                          {timelineTarget ? (
                            <button
                              className="ac-button"
                              type="button"
                              title={
                                timelineTarget.timestamp
                                  ? `定位到 ${timelineTarget.timestamp} 的时间线`
                                  : '定位到对应时间线'
                              }
                              onClick={() => focusTimelineForAction(item)}
                            >
                              时间线
                            </button>
                          ) : null}
                          <button
                            className="ac-button"
                            type="button"
                            onClick={() => startActionItemEdit(item)}
                          >
                            编辑
                          </button>
                          {getActionReviewState(item) === 'dismissed' ? (
                            <button
                              className="ac-button"
                              type="button"
                              onClick={() =>
                                void updateActionItemReview(item, {
                                  status: 'pending',
                                  reviewState: 'suggested',
                                })
                              }
                            >
                              恢复
                            </button>
                          ) : (
                            <>
                              {getActionReviewState(item) !== 'confirmed' ? (
                                <button
                                  className="ac-button primary"
                                  type="button"
                                  onClick={() =>
                                    void updateActionItemReview(item, {
                                      reviewState: 'confirmed',
                                    })
                                  }
                                >
                                  确认
                                </button>
                              ) : null}
                              <button
                                className="ac-button"
                                type="button"
                                onClick={() =>
                                  void updateActionItemReview(item, {
                                    status:
                                      item.status === 'done'
                                        ? 'pending'
                                        : 'done',
                                    reviewState: 'confirmed',
                                  })
                                }
                              >
                                {item.status === 'done' ? '撤回完成' : '完成'}
                              </button>
                              <button
                                className="ac-button danger"
                                type="button"
                                onClick={() =>
                                  void updateActionItemReview(item, {
                                    status: 'pending',
                                    reviewState: 'dismissed',
                                  })
                                }
                              >
                                忽略
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                {getActionFilterEmptyCopy(
                  session.actionItems.length ? actionFilter : 'all',
                )}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'settings' ? (
          <>
            <div className="settings-group">
              <div className="sg-title">核心服务</div>
              <div className="settings-note">
                ASR / 转写、Meeting Minutes 在会议区块配置；结构化分析使用选项页
                主 LLM（与消息分析相同的 LLM_TYPE），这里仅展示当前状态。
                未配置转写服务时，Capture 仍可开启，但会缺少 transcript
                驱动的实时总结与更准确的行动项/决议提取。未配置 Minutes API
                时，不影响会中提醒与基础归档，但不会生成会后 PDF 纪要。
              </div>
              <div className="settings-summary">
                <span
                  className={`settings-chip ${
                    providerConfigured ? 'ok' : 'warn'
                  }`}
                >
                  转写 {providerConfigured ? '已配置' : '未配置'}
                </span>
                <span
                  className={`settings-chip ${
                    minutesConfigured ? 'ok' : 'warn'
                  }`}
                >
                  Minutes API {minutesConfigured ? '已配置' : '未配置'}
                </span>
                <span className="settings-chip neutral">
                  主 LLM {mainLlmProfileLabel}
                </span>
              </div>
              <div className="setting-row readonly">
                <span>ASR Provider</span>
                <span className="setting-value">
                  {formatConfigEndpoint(settings.providerBaseUrl)}
                </span>
              </div>
              <div className="setting-row readonly">
                <span>转写模型</span>
                <span className="setting-value">{transcribeModelLabel}</span>
              </div>
              <div className="setting-row readonly">
                <span>结构化分析（主 LLM）</span>
                <span className="setting-value">{mainLlmProfileLabel}</span>
              </div>
              <div className="setting-row readonly">
                <span>Meeting Minutes API</span>
                <span className="setting-value">
                  {formatConfigEndpoint(settings.minutesApiUrl)}
                </span>
              </div>
              <button
                className="settings-link-btn"
                onClick={openMeetingOptionsPage}
              >
                前往选项页配置服务与密钥
              </button>
            </div>

            <div className="settings-group">
              <div className="sg-title">会中体验</div>
              <div className="setting-row">
                <span>弹幕节奏</span>
                <select
                  value={settings.danmakuSpeed}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      danmakuSpeed: e.target.value,
                    }))
                  }
                >
                  <option value="fast">快</option>
                  <option value="medium">标准</option>
                  <option value="slow">慢</option>
                </select>
              </div>
              <div className="setting-row">
                <span>自动识别会议</span>
                <input
                  type="checkbox"
                  checked={settings.autoDetect}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      autoDetect: e.target.checked,
                    }))
                  }
                />
              </div>
              <div className="setting-row">
                <span>入口方式</span>
                <select
                  value={settings.entryMode}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      entryMode: e.target.value,
                    }))
                  }
                >
                  <option value="auto">自动</option>
                  <option value="manual">手动</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="sg-title">个性化</div>
              <div className="setting-row">
                <span>会议热词</span>
                <input
                  type="text"
                  value={settings.hotwords}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      hotwords: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="setting-row">
                <span>名称别名</span>
                <input
                  type="text"
                  value={settings.nameAliases}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      nameAliases: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="setting-row">
                <span>摘要刷新间隔（秒）</span>
                <input
                  type="number"
                  value={settings.summaryIntervalSec}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      summaryIntervalSec: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="setting-row">
                <span>共享画面采样间隔（秒）</span>
                <input
                  type="number"
                  value={settings.screenshotIntervalSec}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      screenshotIntervalSec: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="setting-row">
                <span>关联历史记忆</span>
                <input
                  type="checkbox"
                  checked={settings.memoryContextEnabled}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      memoryContextEnabled: e.target.checked,
                    }))
                  }
                />
              </div>
              <div className="setting-row">
                <span>录制提示文案</span>
                <input
                  type="text"
                  value={settings.privacyNoticeText}
                  onChange={(e) =>
                    setSettings((current) => ({
                      ...current,
                      privacyNoticeText: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <button className="catchup-btn" onClick={saveSettings}>
              💾 保存会中设置
            </button>
          </>
        ) : null}

        {debugTabContent}
      </div>

      <div className="panel-status">
        <div
          className="rec-status"
          style={{
            display: session.capture.kind === 'recording' ? 'flex' : 'none',
          }}
        >
          <div className="rec-dot-s" />
          REC
        </div>
        <span>
          {formatElapsed(session.capture.startedAt, session.detectedAt)}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          👥 {session.participantCount || session.participants.length || 0}{' '}
          人参会
        </span>
        <button
          className="panel-status-action"
          onClick={
            session.capture.kind === 'recording'
              ? toggleCaptureFromFooter
              : session.readiness.canStartCapture
              ? showCaptureAuthorizationGuide
              : openMeetingOptionsPage
          }
          disabled={
            session.capture.kind !== 'recording' &&
            session.readiness.canStartCapture &&
            session.tabId <= 0
          }
        >
          {session.capture.kind === 'recording'
            ? '🔘 停止 Capture'
            : session.readiness.canStartCapture
            ? captureGuideButtonLabel
            : '⚙️ 去配置 Meeting Pilot'}
        </button>
      </div>

      {catchupOpen ? (
        <div className="catchup-modal" onClick={() => setCatchupOpen(false)}>
          <div
            className="catchup-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <span style={{ fontSize: 20 }}>⚡</span>
              <h3>你刚错过了什么</h3>
              <button
                className="modal-close-btn"
                onClick={() => setCatchupOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="time-pills">
              <span className="time-pill active">过去 5 分钟</span>
              <span className="time-pill">10 分钟</span>
              <span className="time-pill">15 分钟</span>
              <span className="time-pill">自上次查看</span>
            </div>
            <div className="modal-body">
              <div className="catchup-section">
                <div className="section-title">🎯 当前章节</div>
                <div className="section-content">
                  {currentChapter?.summary || session.summary}
                </div>
              </div>
              <div className="catchup-section">
                <div className="section-title">👤 提到了你</div>
                <div className="section-content">
                  {mentionAlerts.length
                    ? mentionAlerts
                        .map((alert) => `${alert.title}：${alert.body}`)
                        .join('；')
                    : '当前没有新的提及你提醒。'}
                </div>
              </div>
              <div className="catchup-section">
                <div className="section-title">📌 新行动项</div>
                <div className="section-content">
                  {pendingActions.length
                    ? pendingActions
                        .slice(0, 3)
                        .map(
                          (item) =>
                            `${item.owner} — ${item.title}${
                              item.deadline ? ` (${item.deadline})` : ''
                            }`,
                        )
                        .join('；')
                    : '当前章节暂无新的待处理行动项。'}
                </div>
              </div>
              <div className="catchup-section">
                <div className="section-title">🔄 话题变化</div>
                <div className="section-content">
                  {session.chapters
                    .map((chapter) => chapter.title)
                    .join(' → ') || '等待章节结构生成'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const container = document.getElementById('meeting-pilot-root');
if (container) {
  ReactDOM.render(<MeetingSidePanel />, container);
}
