import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatMainLlmProfileForMeetingPilot } from '../llm';
import {
  extractRingCentralVideoJoinUrl,
  parseRingCentralVideoJoinTarget,
} from '../ringcentralNativeJoin';
import type {
  CalendarEventSyncItem,
  ComposerAssistEvidence,
  ContextAssistCueCard,
  MeetingOutcomeBinder,
} from '../services/MemoryServiceClient';
import { defaultEnvConfig, EnvConfigType, getEnvConfig } from '../utils';
import {
  sanitizeContextExternalUrl,
  sanitizeExploreRoute,
} from '../web-intelligence/contextRecallGuards';
import {
  getActionReviewExceptionHint,
  getActionReviewWarningLabel,
  getActionReviewWarningSummary,
  getActionReviewWarnings,
} from './actionItemReview';
import { buildMeetingPilotAlertReceipt } from './alertPresentation';
import {
  getMeetingOutcomeLiveSlots,
  normalizeMeetingOutcomeBinder,
} from './meetingOutcomeBinder';
import { getDemoMeetingSessionSnapshot } from './demo';
import {
  buildMeetingPilotLiveFeedReceipt,
  buildMeetingPilotLiveFeedItems,
  getVisibleMeetingMemoryCueRefs,
} from './liveFeedPresentation';
import {
  MeetingPilotActionItem,
  MeetingPilotAlert,
  MeetingPilotCaptureLogEntry,
  MeetingPilotStateResponse,
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

const LazyCaptureLogTab = React.lazy(() => import('./CaptureLogTab'));
const CAPTURE_LOG_TAB_LABEL = ['Capture', 'Log'].join(' ');

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
type RingCentralCcEnableFeedback =
  | 'idle'
  | 'enabling'
  | 'enabled'
  | 'already-active'
  | 'clicked'
  | 'not-found'
  | 'failed';
type ActionReviewFilter =
  | 'open'
  | 'needs-info'
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

type ManualActionDraft = ActionEditDraft & {
  evidence: string;
};

type ActionReviewUpdate = {
  status?: 'pending' | 'done';
  reviewState?: 'suggested' | 'confirmed' | 'dismissed';
  title?: string;
  owner?: string;
  deadline?: string;
};

type BulkActionReviewFeedback = {
  status: 'updating' | 'confirmed' | 'failed';
  total: number;
  completed: number;
};

type MeetingPrepActionFeedbackState = 'adding' | 'added' | 'failed';
type MeetingPrepActionDraft = {
  title: string;
  owner: string;
  deadline: string;
  evidence: string;
};

const PANEL_UI_STORAGE_PREFIX = 'meetingPilot.panelUi.';
const DEFAULT_TAB: TabId = 'live';
const TOP_SCROLL_THRESHOLD = 12;
const BULK_ACTION_COPY_ID = '__bulk_action_copy__';
const FOLLOW_UP_ACTION_COPY_ID = '__follow_up_action_copy__';
const MEETING_PREP_HANDOFF_STORAGE_KEY = 'meetingPrepHandoff';
const MEETING_PREP_HANDOFFS_STORAGE_KEY = 'meetingPrepHandoffs';
const TIMELINE_FOCUS_DURATION_MS = 2200;
const UNASSIGNED_ACTION_OWNER = '待分配';

type MeetingPrepHandoff = {
  createdAt: number;
  expiresAt: number;
  event: CalendarEventSyncItem;
  goal: string;
  text: string;
  cueCards: ContextAssistCueCard[];
  evidence: ComposerAssistEvidence[];
  source?: 'today_pilot' | 'context_assist';
  prepId?: string;
  missionId?: string;
  generatedMode?: string;
  outcomeBinder?: MeetingOutcomeBinder;
};

function getRequestedSurfaceMode(): PanelSurfaceMode {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('surface');
  if (raw === 'embedded' || raw === 'side-panel' || raw === 'window') {
    return raw;
  }
  return params.get('embedded') === '1' ? 'embedded' : 'window';
}

function getPanelSurfaceLabel(surfaceMode: PanelSurfaceMode): string {
  if (surfaceMode === 'embedded') return '页内面板';
  if (surfaceMode === 'side-panel') return 'Chrome 侧边栏';
  return '独立窗口';
}

function buildMeetingPilotUnboundSession(
  requestedTabId: number | undefined,
): MeetingPilotSessionSnapshot {
  return createMeetingPilotSessionSnapshot({
    meetingId: 'unbound',
    tabId: requestedTabId || 0,
    url: '',
    title: 'Meeting Pilot',
  });
}

function selectMeetingPilotPanelSession(
  state: MeetingPilotStateResponse | null,
  requestedTabId: number | undefined,
  useDemoSession: boolean,
): MeetingPilotSessionSnapshot {
  if (useDemoSession) {
    return getDemoMeetingSessionSnapshot(requestedTabId || 0);
  }

  if (requestedTabId) {
    return (
      (state?.activeSession?.tabId === requestedTabId
        ? state.activeSession
        : undefined) ||
      state?.sessions.find((item) => item.tabId === requestedTabId) ||
      buildMeetingPilotUnboundSession(requestedTabId)
    );
  }

  return state?.activeSession || buildMeetingPilotUnboundSession(undefined);
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
  if (filter === 'needs-info') {
    return (
      reviewState !== 'dismissed' &&
      item.status !== 'done' &&
      getActionReviewWarnings(item).length > 0
    );
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
  if (filter === 'needs-info') {
    return '当前没有缺少负责人、截止或依据的行动项。可以继续复核或复制已确认跟进。';
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
  if (filter === 'needs-info') return '需补信息';
  if (filter === 'review') return '待复核';
  if (filter === 'confirmed') return '已确认';
  if (filter === 'done') return '已完成';
  if (filter === 'dismissed') return '已忽略';
  return '全部';
}

function getPanelTabLabel(tab: TabId): string {
  if (tab === 'live') return '实时';
  if (tab === 'speech') return '发言';
  if (tab === 'timeline') return '时间线';
  if (tab === 'actions') return '行动项';
  if (tab === 'settings') return '设置';
  return CAPTURE_LOG_TAB_LABEL;
}

function buildPanelTabBoundary(tab: TabId, active: boolean): string {
  const label = getPanelTabLabel(tab);
  const verb = active ? '当前已在' : '切到';
  const detail =
    tab === 'actions'
      ? '查看当前会议 session 的行动项、复核状态、复制和人工补录入口'
      : tab === 'timeline'
      ? '查看当前会议的章节、决议、提及和行动项证据锚点'
      : tab === 'speech'
      ? '查看当前转写/ASR 链路和发言文本'
      : tab === 'settings'
      ? '查看本侧栏会中体验设置和 Options 配置入口'
      : tab === 'live'
      ? '查看当前重点、提醒、会前 handoff 和关联记忆'
      : '查看本场 Capture 调试日志';
  return `${verb}「${label}」：${detail}；只切换本侧栏视图并恢复该 tab 的滚动位置，不会开始/停止 Capture、确认/完成行动项、复制内容、发消息、创建外部任务、重跑分析或写回会议纪要。`;
}

function buildFocusRailActionBoundary(
  kind: 'capture' | 'action-review',
  label: string,
): string {
  if (kind === 'capture') {
    return `${label}：只在原会议页打开 Capture 授权/配置引导；不会直接开始录制、通知参会者、发送会议内容、创建纪要或代表你取得录制同意。`;
  }
  return `${label}：只切到本侧栏行动项页并定位到需要复核的本场行动项；不会确认、完成、忽略、复制、发送或创建外部任务。`;
}

function formatActionItemControlTarget(item: MeetingPilotActionItem): string {
  const title = String(item.title || '').replace(/\s+/g, ' ').trim();
  if (!title) return '这条行动项';
  return title.length <= 36 ? `「${title}」` : `「${title.slice(0, 35)}…」`;
}

function buildActionFilterBoundary(
  filter: ActionReviewFilter,
  count: number,
  total: number,
  active: boolean,
): string {
  const label = getActionFilterLabel(filter);
  const verb = active ? '当前正在查看' : '切换到';
  return `${verb}「${label}」筛选：显示 ${count}/${total} 个本场行动项；只改变本侧栏可见列表和滚动位置，不会确认、完成、忽略、复制行动项，不会创建外部任务、发送纪要、写回 Calendar/Jira/RingCentral 或重跑会议分析。`;
}

function buildActionToolbarBoundary(
  kind: 'add' | 'bulk-confirm' | 'copy-followup' | 'copy-visible',
  details: {
    addingActionItem?: boolean;
    confirmableCount?: number;
    blockedCount?: number;
    visibleCount?: number;
    confirmedCount?: number;
    feedback?: BulkActionReviewFeedback | null;
    filter?: ActionReviewFilter;
  } = {},
): string {
  if (kind === 'add') {
    return details.addingActionItem
      ? '正在打开人工补录表单：还没有保存新行动项；取消会丢弃草稿，不会创建外部任务、发送纪要、写日历或重跑分析。'
      : '打开人工补录表单：先在本侧栏填写行动项、负责人、截止和依据；点击保存前不会写入当前会议 session、创建外部任务、发送纪要或写回外部系统。';
  }
  if (kind === 'bulk-confirm') {
    const confirmable = details.confirmableCount || 0;
    const blocked = details.blockedCount || 0;
    if (details.feedback?.status === 'updating') {
      return `批量确认写入中：正在把 ${details.feedback.completed}/${details.feedback.total} 个信息完整的待复核项标为已确认；缺信息项仍跳过，不会完成任务、复制内容、创建外部任务或发送纪要。`;
    }
    if (!confirmable) {
      return blocked
        ? `当前筛选有 ${blocked} 个待复核项缺负责人、截止或依据；此按钮不会批量确认，先补信息或单条明确确认例外。`
        : '当前筛选没有可批量确认的待复核项；点击不会写入行动项、复制内容、创建外部任务或发送纪要。';
    }
    return `批量确认当前筛选中 ${confirmable} 个信息完整的待复核项；会写入当前会议 session 的复核状态，缺信息项仍跳过，不会标记完成、复制跟进清单、创建外部任务、发送纪要或写 Calendar/Jira/RingCentral。`;
  }
  if (kind === 'copy-followup') {
    const count = details.confirmedCount || 0;
    return count
      ? `只复制 ${count} 个已确认且未完成的行动项为 Markdown 跟进清单到本机剪贴板；不会改变复核/完成状态、创建外部任务、发送纪要、写回会议记录或重跑分析。`
      : '当前没有已确认且未完成的行动项可复制；不会创建外部任务、发送纪要或改变行动项状态。';
  }
  const visibleCount = details.visibleCount || 0;
  const filterLabel = getActionFilterLabel(details.filter || 'all');
  return visibleCount
    ? `只复制当前「${filterLabel}」筛选下 ${visibleCount} 个行动项到本机剪贴板；不会改变复核/完成/忽略状态、创建外部任务、发送纪要、写回会议记录或重跑分析。`
    : `当前「${filterLabel}」筛选没有可复制行动项；不会创建外部任务、发送纪要或改变行动项状态。`;
}

function buildMeetingPrepCueActionBoundary(
  card: ContextAssistCueCard,
  status: MeetingPrepActionFeedbackState | undefined,
  draft: MeetingPrepActionDraft | null,
): string {
  const cueLabel = card.kind === 'question' ? '问题 cue' : '目标 cue';
  if (status === 'adding') {
    return `正在把这条${cueLabel}写入当前会议行动项；不会重复写入、发送消息、创建外部任务、写日历或确认会前准备事实。`;
  }
  if (status === 'added') {
    return `这条${cueLabel}已存在于当前会议行动项；再次点击不会重复写入、发送消息、创建外部任务或写回外部系统。`;
  }
  if (!draft) {
    return `这条${cueLabel}缺少可写入的行动项标题；点击不会写入当前会议 session、创建外部任务或发送纪要。`;
  }
  const owner = draft.owner ? `负责人 ${draft.owner}` : '负责人待分配';
  return `把这条${cueLabel}写入当前 Meeting Pilot session 的行动项和时间线锚点，默认 ${owner}、截止 ${draft.deadline || '待补'}；不会发送消息、创建外部任务、写 Calendar/Jira/RingCentral、确认事实或开始 Capture。`;
}

function buildManualActionButtonBoundary(
  action: 'save' | 'cancel',
  draft: ManualActionDraft,
): string {
  if (action === 'cancel') {
    return '取消人工补录草稿：只关闭本侧栏表单并丢弃未保存输入，不会删除已有行动项、创建外部任务、发送纪要或写回外部系统。';
  }
  const title = String(draft.title || '').trim();
  return title
    ? `保存人工补录「${title.length > 36 ? `${title.slice(0, 35)}…` : title}」到当前会议 session，并建立本场时间线锚点；不会创建外部任务、发送纪要、写 Calendar/Jira/RingCentral 或重跑分析。`
    : '保存人工补录：需要先填写行动项标题；负责人和截止可留空并标记待补，不会创建外部任务、发送纪要或写回外部系统。';
}

function buildActionItemButtonBoundary(
  item: MeetingPilotActionItem,
  action:
    | 'copy'
    | 'timeline'
    | 'edit'
    | 'restore'
    | 'confirm'
    | 'toggle-done'
    | 'dismiss'
    | 'save-edit'
    | 'cancel-edit',
  options: {
    timelineTarget?: MeetingPilotTimelineEvent;
    exceptionHint?: string;
  } = {},
): string {
  const target = formatActionItemControlTarget(item);
  if (action === 'copy') {
    return `只复制${target}的标题、负责人、截止、状态和依据到本机剪贴板；不会确认、完成、忽略、编辑、创建外部任务、发送纪要或写回会议记录。`;
  }
  if (action === 'timeline') {
    const time = options.timelineTarget?.timestamp
      ? ` ${options.timelineTarget.timestamp}`
      : '';
    return `切到时间线并展开${time}附近的证据锚点来复核${target}；只改变本侧栏视图，不会确认/完成行动项、复制内容、重跑分析或写外部系统。`;
  }
  if (action === 'edit') {
    return `打开${target}的本地校正表单；保存前不会改写行动项、确认状态、完成状态、外部任务或会议纪要。`;
  }
  if (action === 'restore') {
    return `把${target}从已忽略恢复为待复核，并保留在当前会议 session；不会标记完成、复制内容、创建外部任务、发送纪要或重跑分析。`;
  }
  if (action === 'confirm') {
    const prefix = options.exceptionHint
      ? `确认例外：${options.exceptionHint}；`
      : '';
    return `${prefix}把${target}标为已确认，表示你接受这条 AI/手动行动项进入会后跟进候选；不会标记完成、创建外部任务、发送纪要、写 Calendar/Jira/RingCentral 或修改原始 transcript。`;
  }
  if (action === 'toggle-done') {
    if (item.status === 'done') {
      return `撤回${target}的已完成状态，回到已确认待跟进；不会重新打开外部任务、发送通知、改写 transcript 或重跑分析。`;
    }
    const prefix =
      getActionReviewState(item) === 'suggested' && options.exceptionHint
        ? `确认例外并完成：${options.exceptionHint}；`
        : getActionReviewState(item) === 'suggested'
        ? '先确认再完成；'
        : '';
    return `${prefix}把${target}标为已确认且已完成，只更新当前会议 session 的复核状态；不会创建/关闭外部任务、发送纪要、写 Calendar/Jira/RingCentral 或修改原始 transcript。`;
  }
  if (action === 'dismiss') {
    return `把${target}标为已忽略；它不会进入会议 recap 的主行动项列表，但仍保留在本场完整结构化数据中供排查，不会删除 transcript、创建外部任务或发送纪要。`;
  }
  if (action === 'save-edit') {
    return `保存${target}的标题、负责人和截止校正，并把它标为已确认；不会修改原始 transcript、创建外部任务、发送纪要、写 Calendar/Jira/RingCentral 或重跑分析。`;
  }
  return `取消${target}的本地校正草稿；不会保存输入、改变行动项状态、创建外部任务、发送纪要或写回外部系统。`;
}

function buildActionEditDraft(item: MeetingPilotActionItem): ActionEditDraft {
  return {
    title: item.title || '',
    owner: item.owner || '',
    deadline: item.deadline || '',
  };
}

function formatActionOwner(owner?: string): string {
  const normalized = String(owner || '').trim();
  if (!normalized || /^unknown$/i.test(normalized)) {
    return UNASSIGNED_ACTION_OWNER;
  }
  return normalized;
}

function isActionOwnerUnassigned(owner?: string): boolean {
  return formatActionOwner(owner) === UNASSIGNED_ACTION_OWNER;
}

function formatActionReviewWarningLine(
  item: MeetingPilotActionItem,
): string | undefined {
  return getActionReviewWarningSummary(item);
}

function formatActionItemForClipboard(item: MeetingPilotActionItem): string {
  const lines = [
    `行动项：${item.title}`,
    `负责人：${formatActionOwner(item.owner)}`,
  ];
  if (item.deadline) {
    lines.push(`截止：${item.deadline}`);
  }
  if (item.timestamp) {
    lines.push(`识别时间：${item.timestamp}`);
  }
  lines.push(`状态：${getActionStatusLabel(item)}`);
  const warningLine = formatActionReviewWarningLine(item);
  if (warningLine) {
    lines.push(`复核提示：${warningLine}`);
  }
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
    ...items.flatMap((item, index) => {
      const warningLine = formatActionReviewWarningLine(item);
      return [
        `${index + 1}. ${item.title}`,
        `负责人：${formatActionOwner(item.owner)}`,
        ...(item.deadline ? [`截止：${item.deadline}`] : []),
        ...(item.timestamp ? [`识别时间：${item.timestamp}`] : []),
        `状态：${getActionStatusLabel(item)}`,
        ...(warningLine ? [`复核提示：${warningLine}`] : []),
        ...(item.evidence ? [`依据：${item.evidence}`] : []),
        '',
      ];
    }),
  ]
    .join('\n')
    .trim();
}

function formatFollowUpActionItemsForClipboard(
  items: MeetingPilotActionItem[],
): string {
  return [
    `Meeting Pilot 跟进清单（已确认，${items.length} 项）`,
    '',
    ...items.flatMap((item) => {
      const warningLine = formatActionReviewWarningLine(item);
      return [
        `- [ ] ${item.title}`,
        `  负责人：${formatActionOwner(item.owner)}`,
        ...(item.deadline ? [`  截止：${item.deadline}`] : []),
        ...(item.timestamp ? [`  识别时间：${item.timestamp}`] : []),
        ...(warningLine ? [`  复核提示：${warningLine}`] : []),
        ...(item.evidence ? [`  依据：${item.evidence}`] : []),
        '',
      ];
    }),
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
  const eventByActionId = session.timelineEvents.find(
    (event) => event.actionItemId === item.id,
  );
  if (eventByActionId) {
    return eventByActionId;
  }

  const sameChapterEvents = item.chapterId
    ? session.timelineEvents.filter(
        (event) => event.chapterId === item.chapterId,
      )
    : [];
  const candidates = sameChapterEvents.length
    ? sameChapterEvents
    : session.timelineEvents;

  return (
    candidates.find(
      (event) =>
        event.type === 'action' && timelineEventMatchesAction(event, item),
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

async function loadMeetingPrepHandoffForSession(
  session: MeetingPilotSessionSnapshot,
): Promise<MeetingPrepHandoff | null> {
  const payload = await chrome.storage.local.get([
    MEETING_PREP_HANDOFF_STORAGE_KEY,
    MEETING_PREP_HANDOFFS_STORAGE_KEY,
  ]);
  return selectMeetingPrepHandoffForSession(
    [
      normalizeMeetingPrepHandoff(payload?.[MEETING_PREP_HANDOFF_STORAGE_KEY]),
      ...normalizeMeetingPrepHandoffCollection(
        payload?.[MEETING_PREP_HANDOFFS_STORAGE_KEY],
      ),
    ],
    session,
  );
}

function normalizeMeetingPrepHandoff(
  value: unknown,
): MeetingPrepHandoff | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<MeetingPrepHandoff>;
  if (!raw.event || typeof raw.event !== 'object') {
    return null;
  }
  const createdAt = Number(raw.createdAt);
  const expiresAt = Number(raw.expiresAt);
  const text = String(raw.text || '').trim();
  const event = raw.event as CalendarEventSyncItem;
  const cueCards = Array.isArray(raw.cueCards)
    ? raw.cueCards.filter(isMeetingPrepCueCard).slice(0, 8)
    : [];
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.filter(isMeetingPrepEvidence).slice(0, 8)
    : [];
  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    !String(event.title || '').trim() ||
    !text
  ) {
    return null;
  }
  return {
    createdAt,
    expiresAt,
    event,
    goal:
      String(raw.goal || '').trim() ||
      buildMeetingPrepHandoffGoalFromCards(cueCards, event, text),
    text,
    cueCards,
    evidence,
    source:
      raw.source === 'today_pilot' || raw.source === 'context_assist'
        ? raw.source
        : undefined,
    prepId: typeof raw.prepId === 'string' ? raw.prepId : undefined,
    missionId: typeof raw.missionId === 'string' ? raw.missionId : undefined,
    generatedMode:
      typeof raw.generatedMode === 'string' ? raw.generatedMode : undefined,
    outcomeBinder: normalizeMeetingOutcomeBinder(raw.outcomeBinder),
  };
}

function normalizeMeetingPrepHandoffCollection(
  value: unknown,
): MeetingPrepHandoff[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const candidates = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  return candidates
    .map(normalizeMeetingPrepHandoff)
    .filter((item): item is MeetingPrepHandoff => Boolean(item));
}

function isMeetingPrepCueCard(value: unknown): value is ContextAssistCueCard {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const card = value as Partial<ContextAssistCueCard>;
  return Boolean(
    card.id &&
      card.title &&
      card.body &&
      (card.kind === 'brief' ||
        card.kind === 'memory' ||
        card.kind === 'question' ||
        card.kind === 'action'),
  );
}

function isMeetingPrepEvidence(
  value: unknown,
): value is ComposerAssistEvidence {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<ComposerAssistEvidence>;
  return Boolean(item.id && (item.snippet || item.title || item.sourceTitle));
}

function selectMeetingPrepHandoffForSession(
  candidates: Array<MeetingPrepHandoff | null>,
  session: MeetingPilotSessionSnapshot,
): MeetingPrepHandoff | null {
  const ranked = candidates
    .filter((handoff): handoff is MeetingPrepHandoff => Boolean(handoff))
    .map((handoff) => ({
      handoff,
      score: getMeetingPrepHandoffMatchScore(handoff, session),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.handoff.createdAt - left.handoff.createdAt,
    );
  return ranked[0]?.handoff || null;
}

function getMeetingPrepHandoffMatchScore(
  handoff: MeetingPrepHandoff,
  session: MeetingPilotSessionSnapshot,
): number {
  const sessionMeetingIds = [
    getRingCentralMeetingId(session.url),
    normalizeRingCentralMeetingId(session.meetingId),
  ].filter((id): id is string => Boolean(id));
  const eventMeetingIds = [
    handoff.event.joinUrl,
    handoff.event.sourceUrl,
    handoff.event.location,
    handoff.text,
  ]
    .map(getRingCentralMeetingId)
    .filter(Boolean);
  if (sessionMeetingIds.length > 0) {
    const exactIdMatch = eventMeetingIds.some((meetingId) =>
      sessionMeetingIds.includes(meetingId),
    );
    if (exactIdMatch) {
      return 100 + getMeetingPrepHandoffFreshnessScore(handoff);
    }
  }

  const sessionTitle = normalizeMeetingPrepTitle(session.title);
  const eventTitle = normalizeMeetingPrepTitle(handoff.event.title);
  if (!sessionTitle || !eventTitle) {
    return 0;
  }
  if (!isMeetingPrepHandoffTimePlausible(handoff, session)) {
    return 0;
  }
  if (sessionTitle === eventTitle) {
    return 70 + getMeetingPrepHandoffFreshnessScore(handoff);
  }
  if (
    (sessionTitle.length >= 8 && eventTitle.includes(sessionTitle)) ||
    (eventTitle.length >= 8 && sessionTitle.includes(eventTitle))
  ) {
    return 55 + getMeetingPrepHandoffFreshnessScore(handoff);
  }
  const overlap = countMeetingPrepTitleTokenOverlap(sessionTitle, eventTitle);
  return overlap >= 2
    ? 40 + overlap + getMeetingPrepHandoffFreshnessScore(handoff)
    : 0;
}

function getRingCentralMeetingId(value?: string): string | null {
  const joinUrl = extractRingCentralVideoJoinUrl(value) || value;
  const target = joinUrl ? parseRingCentralVideoJoinTarget(joinUrl) : null;
  return target?.meetingId || null;
}

function normalizeRingCentralMeetingId(value?: string): string | null {
  const normalized = String(value || '').replace(/\D/g, '');
  return normalized.length >= 3 ? normalized : null;
}

function isMeetingPrepHandoffTimePlausible(
  handoff: MeetingPrepHandoff,
  session: MeetingPilotSessionSnapshot,
): boolean {
  const sessionTime = normalizeMeetingPrepTimeMs(
    session.detectedAt || session.capture?.startedAt || Date.now(),
  );
  const eventStart = normalizeMeetingPrepTimeMs(handoff.event.startTime);
  if (!sessionTime || !eventStart) {
    return false;
  }
  const eventEnd =
    normalizeMeetingPrepTimeMs(handoff.event.endTime) ||
    eventStart + 2 * 60 * 60 * 1000;
  const earlyWindowMs = 30 * 60 * 1000;
  const lateWindowMs = 60 * 60 * 1000;
  return (
    sessionTime >= eventStart - earlyWindowMs &&
    sessionTime <= eventEnd + lateWindowMs
  );
}

function normalizeMeetingPrepTimeMs(value?: number): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

function getMeetingPrepHandoffFreshnessScore(
  handoff: MeetingPrepHandoff,
): number {
  const ageMs = Math.max(0, Date.now() - handoff.createdAt);
  return Math.max(0, 10 - Math.floor(ageMs / (30 * 60 * 1000)));
}

function normalizeMeetingPrepTitle(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(ringcentral|video|meeting)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMeetingPrepTitleTokenOverlap(
  left: string,
  right: string,
): number {
  const leftTokens = new Set(
    left
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
  const rightTokens = new Set(
    right
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}

type MeetingPrepHandoffMatchReceipt = {
  tone: 'exact' | 'fallback' | 'weak';
  title: string;
  detail: string;
  chips: string[];
  boundary: string;
};

function formatMeetingPrepHandoffDuration(ms: number): string {
  const safeMs = Math.max(0, ms);
  const minutes = Math.floor(safeMs / (60 * 1000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes
      ? `${hours} 小时 ${remainingMinutes} 分钟`
      : `${hours} 小时`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days} 天 ${remainingHours} 小时` : `${days} 天`;
}

function formatMeetingPrepHandoffRemaining(ms: number): string {
  if (ms <= 0) return '已过期';
  return formatMeetingPrepHandoffDuration(ms);
}

function getMeetingPrepHandoffSourceLabel(
  handoff: MeetingPrepHandoff,
): string {
  if (handoff.source === 'today_pilot') return 'Today Pilot';
  if (handoff.source === 'context_assist') return 'Context Assist';
  return '会前准备';
}

function getMeetingPrepGeneratedModeLabel(
  generatedMode: string | undefined,
): string {
  const normalized = String(generatedMode || '').trim().toLowerCase();
  if (!normalized) return '准备模式未标记';
  if (normalized.includes('fallback')) return '规则 fallback';
  if (normalized.includes('generated') || normalized.includes('fresh')) {
    return '新生成准备';
  }
  if (normalized.includes('cached') || normalized.includes('pre')) {
    return '预生成缓存';
  }
  return `模式 ${generatedMode}`;
}

function getMeetingPrepHandoffMatchReceipt(
  handoff: MeetingPrepHandoff,
  session: MeetingPilotSessionSnapshot,
): MeetingPrepHandoffMatchReceipt {
  const sessionMeetingIds = [
    getRingCentralMeetingId(session.url),
    normalizeRingCentralMeetingId(session.meetingId),
  ].filter((id): id is string => Boolean(id));
  const eventMeetingIds = [
    handoff.event.joinUrl,
    handoff.event.sourceUrl,
    handoff.event.location,
    handoff.text,
  ]
    .map(getRingCentralMeetingId)
    .filter(Boolean);
  const exactIdMatch =
    sessionMeetingIds.length > 0 &&
    eventMeetingIds.some((meetingId) => sessionMeetingIds.includes(meetingId));
  const sessionTitle = normalizeMeetingPrepTitle(session.title);
  const eventTitle = normalizeMeetingPrepTitle(handoff.event.title);
  const timePlausible = isMeetingPrepHandoffTimePlausible(handoff, session);
  const overlap =
    sessionTitle && eventTitle
      ? countMeetingPrepTitleTokenOverlap(sessionTitle, eventTitle)
      : 0;
  const nowMs = Date.now();
  const sourceLabel = getMeetingPrepHandoffSourceLabel(handoff);
  const chips = [
    `来源 ${sourceLabel}`,
    getMeetingPrepGeneratedModeLabel(handoff.generatedMode),
    `缓存 ${formatMeetingPrepHandoffDuration(nowMs - handoff.createdAt)}前`,
    `剩余 ${formatMeetingPrepHandoffRemaining(handoff.expiresAt - nowMs)}`,
  ];
  const boundary =
    '这条回执只解释本机 handoff 如何被选中；不会加入会议、开启录音、发消息、创建/完成行动项、写回日历或外部系统。';

  if (exactIdMatch) {
    return {
      tone: 'exact',
      title: 'Meeting ID 精确命中',
      detail: '当前会议链接/meeting id 与 handoff 里的会议链接一致。',
      chips,
      boundary,
    };
  }

  if (sessionTitle && eventTitle && timePlausible) {
    if (sessionTitle === eventTitle) {
      return {
        tone: 'fallback',
        title: '标题 + 时间窗口命中',
        detail: '当前 meeting id 未命中，按会议标题和日历事件时间窗口带入。',
        chips,
        boundary,
      };
    }
    if (
      (sessionTitle.length >= 8 && eventTitle.includes(sessionTitle)) ||
      (eventTitle.length >= 8 && sessionTitle.includes(eventTitle))
    ) {
      return {
        tone: 'fallback',
        title: '标题包含 + 时间窗口兜底',
        detail: '当前 meeting id 未命中，按标题包含关系和事件时间窗口带入。',
        chips,
        boundary,
      };
    }
    if (overlap >= 2) {
      return {
        tone: 'weak',
        title: '标题关键词 + 时间窗口兜底',
        detail: '当前 meeting id 未命中，仅按标题关键词重叠和事件时间窗口带入，请先核对会议标题。',
        chips,
        boundary,
      };
    }
  }

  return {
    tone: 'weak',
    title: 'Handoff 匹配待复核',
    detail: '当前 handoff 已带入，但匹配证据不足，请先核对会议标题和时间。',
    chips,
    boundary,
  };
}

function getMeetingPrepDisplayCueCards(
  handoff: MeetingPrepHandoff,
): ContextAssistCueCard[] {
  const primary = handoff.cueCards.filter((card) => card.kind !== 'memory');
  const memoryCards = handoff.cueCards.filter((card) => card.kind === 'memory');
  return [...primary, ...memoryCards].slice(0, 4);
}

function buildMeetingPrepHandoffGoalFromCards(
  cueCards: ContextAssistCueCard[],
  event: CalendarEventSyncItem,
  fallbackText?: string,
): string {
  const actionCard = cueCards.find((card) => {
    return card.kind === 'action' && (card.body || card.title);
  });
  const questionCard = cueCards.find((card) => {
    return card.kind === 'question' && (card.body || card.title);
  });
  const briefCard = cueCards.find((card) => {
    return card.kind === 'brief' && (card.body || card.title);
  });
  const candidates = [
    actionCard?.body || actionCard?.title || '',
    questionCard
      ? `会中确认：${questionCard.body || questionCard.title || ''}`
      : '',
    briefCard?.body || briefCard?.title || '',
    fallbackText || '',
  ];

  for (const candidate of candidates) {
    const goal = normalizeMeetingPrepGoalText(candidate, event.title);
    if (goal) {
      return goal;
    }
  }
  return normalizeMeetingPrepGoalText(
    `明确 ${event.title || '本场会议'} 的下一步、owner 和风险。`,
    event.title,
  );
}

function normalizeMeetingPrepGoalText(
  value: string | undefined,
  eventTitle: string | undefined,
  maxLength = 120,
): string {
  const normalizedTitle = normalizeMeetingPrepTitle(eventTitle || '');
  const lines = String(value || '')
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/<[^>]*>/g, ' ')
        .replace(/^#+\s*/g, '')
        .replace(/^[\s>*-]+/g, '')
        .replace(/[`*_]+/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .filter((line) => normalizeMeetingPrepTitle(line) !== normalizedTitle)
    .filter((line) => !/^today pilot (?:会前准备|meeting prep)/i.test(line));
  const firstLine = lines[0] || '';
  if (!firstLine) {
    return '';
  }
  return firstLine.length <= maxLength
    ? firstLine
    : `${firstLine.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function getMeetingPrepCardKindLabel(
  kind: ContextAssistCueCard['kind'],
): string {
  if (kind === 'brief') return 'Brief';
  if (kind === 'question') return '问题';
  if (kind === 'action') return '目标';
  return '记忆';
}

function getMeetingPrepEvidenceLinks(
  item: ComposerAssistEvidence,
): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();
  const addLink = (label: string, url: string | null): void => {
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);
    links.push({ label, url });
  };

  const exploreRoute = sanitizeExploreRoute(item.exploreLink);
  if (exploreRoute) {
    addLink(
      '在记忆中查看',
      chrome.runtime.getURL(`memory-exploring.html${exploreRoute}`),
    );
  }

  for (const link of item.links ?? []) {
    addLink(
      link.label || '打开来源',
      sanitizeContextExternalUrl(link.url, window.location.href),
    );
  }
  addLink(
    '打开来源',
    sanitizeContextExternalUrl(item.sourceUrl, window.location.href),
  );
  return links.slice(0, 2);
}

function getMeetingMemoryLinks(
  item: MeetingPilotSessionSnapshot['memoryRefs'][number],
): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();
  const addLink = (label: string, url: string | null | undefined): void => {
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);
    links.push({ label, url });
  };

  const exploreRoute = sanitizeExploreRoute(item.exploreLink);
  if (exploreRoute) {
    addLink(
      '在记忆库中查看',
      chrome.runtime.getURL(`memory-exploring.html${exploreRoute}`),
    );
  }

  for (const link of item.links ?? []) {
    addLink(
      link.label || '打开来源',
      sanitizeContextExternalUrl(link.url, window.location.href),
    );
  }

  addLink(
    '打开原始文档',
    sanitizeContextExternalUrl(item.sourceUrl, window.location.href),
  );

  return links.slice(0, 2);
}

function formatMeetingMemoryTime(
  item: MeetingPilotSessionSnapshot['memoryRefs'][number],
): string {
  const raw = item.timestamp || item.matchedAt;
  if (!raw) return '';
  const ms = raw < 10_000_000_000 ? raw * 1000 : raw;
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MeetingAlertReceipt({ alert }: { alert: MeetingPilotAlert }) {
  const receipt = buildMeetingPilotAlertReceipt(alert);
  return (
    <div className="alert-reason-receipt" aria-label="会中提醒原因回执">
      <div className="alert-reason-row">
        <span>为什么</span>
        <strong>{receipt.reason}</strong>
      </div>
      <div className="alert-reason-row">
        <span>下一步</span>
        <strong>{receipt.nextStep}</strong>
      </div>
      <div className="alert-reason-row">
        <span>边界</span>
        <strong>{receipt.boundary}</strong>
      </div>
      <div className="alert-reason-row">
        <span>信号</span>
        <strong>{receipt.signal}</strong>
      </div>
    </div>
  );
}

function isMeetingPrepCueActionable(card: ContextAssistCueCard): boolean {
  return card.kind === 'question' || card.kind === 'action';
}

function trimMeetingPrepActionText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function buildMeetingPrepCueActionDraft(
  card: ContextAssistCueCard,
  handoff: MeetingPrepHandoff,
  selfName?: string,
): MeetingPrepActionDraft | null {
  if (!isMeetingPrepCueActionable(card)) {
    return null;
  }

  const cardTitle = String(card.title || '').trim();
  const cardBody = String(card.body || '').trim();
  const baseTitle =
    card.kind === 'question'
      ? `确认：${cardBody || cardTitle}`
      : cardBody || cardTitle;
  const title = trimMeetingPrepActionText(baseTitle, 160);
  if (!title) {
    return null;
  }

  const evidenceParts = [
    cardTitle ? `会前准备「${cardTitle}」` : '会前准备',
    cardBody,
    handoff.goal ? `会议目标：${handoff.goal}` : '',
    handoff.evidence[0]?.snippet
      ? `来源：${handoff.evidence[0].snippet}`
      : '',
  ].filter(Boolean);

  return {
    title,
    owner: String(selfName || '').trim(),
    deadline: '本次会议',
    evidence: trimMeetingPrepActionText(evidenceParts.join('；'), 240),
  };
}

function hasMeetingPrepCueActionItem(
  session: MeetingPilotSessionSnapshot,
  card: ContextAssistCueCard,
  handoff: MeetingPrepHandoff,
): boolean {
  const draft = buildMeetingPrepCueActionDraft(card, handoff, session.selfName);
  const normalizedTitle = normalizeTimelineMatchText(draft?.title);
  if (!normalizedTitle) {
    return false;
  }

  return session.actionItems.some((item) => {
    if (getActionReviewState(item) === 'dismissed') {
      return false;
    }
    return normalizeTimelineMatchText(item.title) === normalizedTitle;
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

  .meeting-shell.surface-window {
    width: min(420px, 100%);
    margin-left: auto;
    margin-right: auto;
    border-right: 1px solid var(--border);
  }

  @media (max-width: 520px) {
    .meeting-shell.surface-window {
      width: 100%;
      border-left: 0;
      border-right: 0;
    }
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

  .panel-source-receipt {
    padding: 9px 14px 10px;
    border-bottom: 1px solid var(--border);
    background: rgba(12,14,24,0.72);
  }

  .panel-source-receipt.bound {
    background: rgba(105,219,124,0.08);
    border-bottom-color: rgba(105,219,124,0.22);
  }

  .panel-source-receipt.active,
  .panel-source-receipt.demo {
    background: rgba(64,192,255,0.08);
    border-bottom-color: rgba(64,192,255,0.22);
  }

  .panel-source-receipt.missing {
    background: rgba(255,212,59,0.08);
    border-bottom-color: rgba(255,212,59,0.24);
  }

  .panel-source-main {
    display: flex;
    gap: 8px;
    align-items: baseline;
    min-width: 0;
  }

  .panel-source-title {
    flex: 0 0 auto;
    color: var(--text);
    font-size: 12px;
    font-weight: 800;
  }

  .panel-source-detail {
    flex: 1;
    min-width: 0;
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.35;
  }

  .panel-source-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 6px;
  }

  .panel-source-chips span {
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(26,29,39,0.7);
    color: var(--text);
    font-size: 10px;
    line-height: 1.2;
  }

  .panel-source-boundary {
    margin-top: 5px;
    color: var(--text-muted);
    font-size: 10px;
    line-height: 1.35;
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

  .rc-cc-card {
    margin: 8px 12px 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(64, 192, 255, 0.28);
    background: rgba(64, 192, 255, 0.09);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rc-cc-card-copy {
    flex: 1;
    min-width: 0;
  }

  .rc-cc-card-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text);
  }

  .rc-cc-card-body {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--text-dim);
  }

  .rc-cc-card button {
    flex: 0 0 auto;
    border: 1px solid rgba(64, 192, 255, 0.36);
    background: rgba(64, 192, 255, 0.14);
    color: var(--text);
    border-radius: 8px;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .rc-cc-card button:disabled {
    cursor: default;
    opacity: 0.68;
  }

  .rc-cc-feedback {
    margin-top: 4px;
    font-size: 11px;
    color: var(--accent-light);
  }

  .rc-cc-feedback.warn {
    color: #ffd43b;
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

  .meeting-focus-rail {
    margin: 0 0 12px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid rgba(148,163,184,0.16);
    background: rgba(12,14,24,0.42);
  }

  .meeting-focus-rail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .meeting-focus-rail-title {
    color: var(--text);
    font-size: 12px;
    font-weight: 800;
  }

  .meeting-focus-rail-boundary {
    color: var(--text-dim);
    font-size: 10px;
    line-height: 1.3;
    text-align: right;
  }

  .meeting-focus-rail-items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .focus-rail-item {
    min-width: 0;
    padding: 8px 9px;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(26,29,39,0.74);
  }

  .focus-rail-item.urgent {
    border-color: rgba(255,107,107,0.28);
    background: rgba(255,107,107,0.09);
  }

  .focus-rail-item.warn {
    border-color: rgba(255,212,59,0.25);
    background: rgba(255,212,59,0.08);
  }

  .focus-rail-item.ready {
    border-color: rgba(46,204,113,0.24);
    background: rgba(46,204,113,0.07);
  }

  .focus-rail-label {
    color: var(--text-dim);
    font-size: 10px;
    line-height: 1.35;
    font-weight: 700;
  }

  .focus-rail-value {
    margin-top: 2px;
    color: var(--text);
    font-size: 12px;
    line-height: 1.35;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .focus-rail-detail {
    margin-top: 2px;
    color: var(--text-dim);
    font-size: 10px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .focus-rail-action {
    margin-top: 7px;
    border: 1px solid rgba(148,163,184,0.18);
    border-radius: 7px;
    padding: 5px 7px;
    background: rgba(255,255,255,0.05);
    color: var(--text);
    font-size: 10.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .focus-rail-action:hover {
    border-color: rgba(162,155,254,0.38);
    background: rgba(162,155,254,0.10);
  }

  @media (max-width: 360px) {
    .meeting-focus-rail-items {
      grid-template-columns: 1fr;
    }
  }

  .meeting-prep-handoff-card {
    padding: 12px 14px;
    border-radius: 10px;
    margin: 0 0 12px;
    background: rgba(46, 204, 113, 0.08);
    border: 1px solid rgba(46, 204, 113, 0.22);
    border-left: 3px solid #2ecc71;
  }

  .meeting-prep-handoff-card .label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .meeting-prep-handoff-card .value {
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
  }

  .meeting-prep-handoff-card .subtext {
    margin-top: 5px;
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .meeting-prep-match-receipt {
    margin-top: 9px;
    padding: 8px 9px;
    border-radius: 8px;
    background: rgba(15,23,42,0.38);
    border: 1px solid rgba(126,226,168,0.20);
  }

  .meeting-prep-match-receipt.fallback {
    border-color: rgba(245,158,11,0.28);
    background: rgba(245,158,11,0.08);
  }

  .meeting-prep-match-receipt.weak {
    border-color: rgba(248,113,113,0.30);
    background: rgba(248,113,113,0.08);
  }

  .meeting-prep-match-head {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .meeting-prep-match-head strong {
    color: var(--text);
    font-size: 11.5px;
    line-height: 1.35;
  }

  .meeting-prep-match-head span,
  .meeting-prep-match-boundary {
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .meeting-prep-match-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 7px;
  }

  .meeting-prep-match-chips span {
    border-radius: 999px;
    padding: 2px 6px;
    background: rgba(255,255,255,0.07);
    color: #c9f6d8;
    font-size: 10px;
    font-weight: 700;
  }

  .meeting-prep-match-boundary {
    margin-top: 7px;
  }

  .meeting-outcome-live {
    margin-top: 9px;
    padding: 9px;
    border-radius: 8px;
    border: 1px solid rgba(116,185,255,0.24);
    background: rgba(12,28,48,0.42);
  }

  .meeting-outcome-live-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 9px;
  }

  .meeting-outcome-live-head > div {
    min-width: 0;
  }

  .meeting-outcome-live-head span {
    display: block;
    color: var(--text-dim);
    font-size: 10px;
    line-height: 1.4;
  }

  .meeting-outcome-live-head > div > span {
    color: #74b9ff;
    font-weight: 800;
  }

  .meeting-outcome-live-head strong {
    display: block;
    margin-top: 2px;
    color: var(--text);
    font-size: 13px;
  }

  .meeting-outcome-live-list {
    display: grid;
    gap: 6px;
    margin-top: 8px;
  }

  .meeting-outcome-live-slot {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    gap: 7px;
    align-items: start;
    min-width: 0;
    padding: 7px;
    border-radius: 7px;
    border: 1px solid rgba(148,163,184,0.13);
    background: rgba(15,23,42,0.44);
  }

  .meeting-outcome-live-slot.mentioned {
    border-color: rgba(255,212,59,0.26);
  }

  .meeting-outcome-live-slot.evidence_candidate,
  .meeting-outcome-live-slot.final {
    border-color: rgba(105,219,124,0.28);
  }

  .meeting-outcome-live-index {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(116,185,255,0.14);
    color: #9fd0ff;
    font-size: 10px;
    font-weight: 800;
  }

  .meeting-outcome-live-slot > div {
    min-width: 0;
  }

  .meeting-outcome-live-slot > div strong,
  .meeting-outcome-live-slot > div span {
    display: block;
    overflow-wrap: anywhere;
  }

  .meeting-outcome-live-slot > div strong {
    color: var(--text);
    font-size: 11.5px;
    line-height: 1.4;
  }

  .meeting-outcome-live-slot > div span {
    margin-top: 2px;
    color: var(--text-dim);
    font-size: 10.5px;
    line-height: 1.4;
  }

  .meeting-outcome-live-status {
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(255,255,255,0.07);
    color: #cbd5e1;
    font-size: 9.5px;
    font-weight: 800;
    white-space: nowrap;
  }

  .meeting-outcome-live-boundary {
    margin-top: 8px;
    padding-top: 7px;
    border-top: 1px solid rgba(148,163,184,0.12);
    color: var(--text-dim);
    font-size: 10.5px;
    line-height: 1.45;
  }

  @media (max-width: 360px) {
    .meeting-outcome-live-slot {
      grid-template-columns: 20px minmax(0, 1fr);
    }

    .meeting-outcome-live-status {
      grid-column: 2;
      justify-self: start;
    }
  }

  .meeting-prep-goal {
    margin-top: 9px;
    padding: 8px 9px;
    border-radius: 8px;
    background: rgba(15,23,42,0.36);
    border: 1px solid rgba(46,204,113,0.18);
  }

  .meeting-prep-goal span {
    display: block;
    color: #7ee7a4;
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 3px;
  }

  .meeting-prep-goal strong {
    display: block;
    color: var(--text);
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .meeting-prep-cues {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 10px;
  }

  .meeting-prep-cue {
    border-radius: 8px;
    padding: 8px 9px;
    background: rgba(15,23,42,0.42);
    border: 1px solid rgba(148,163,184,0.14);
  }

  .meeting-prep-cue-head {
    display: flex;
    align-items: baseline;
    gap: 7px;
    min-width: 0;
    font-size: 11px;
    line-height: 1.35;
  }

  .meeting-prep-cue-head span {
    flex: 0 0 auto;
    color: #7ee2a8;
    font-weight: 700;
  }

  .meeting-prep-cue-head strong {
    min-width: 0;
    color: var(--text);
    overflow-wrap: anywhere;
  }

  .meeting-prep-cue-body {
    margin-top: 4px;
    color: var(--text-dim);
    font-size: 11.5px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .meeting-prep-cue-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .meeting-prep-action-btn {
    border: 1px solid rgba(126,226,168,0.42);
    background: rgba(46,204,113,0.12);
    color: #b9f6ca;
    border-radius: 7px;
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .meeting-prep-action-btn:hover:not(:disabled) {
    background: rgba(46,204,113,0.18);
  }

  .meeting-prep-action-btn.added,
  .meeting-prep-action-btn:disabled {
    cursor: default;
    opacity: 0.72;
  }

  .meeting-prep-action-btn.failed {
    border-color: rgba(255,107,107,0.46);
    background: rgba(255,107,107,0.12);
    color: #fecaca;
  }

  .meeting-prep-evidence {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(148,163,184,0.14);
    color: var(--text-dim);
    font-size: 11px;
  }

  .meeting-prep-evidence summary {
    cursor: pointer;
    color: var(--text);
    font-weight: 700;
  }

  .meeting-prep-source {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(148,163,184,0.10);
  }

  .meeting-prep-source strong,
  .meeting-prep-source span {
    overflow-wrap: anywhere;
  }

  .meeting-prep-source strong {
    color: var(--text);
    font-size: 11.5px;
  }

  .meeting-prep-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .meeting-prep-links a {
    color: #7ee2a8;
    font-weight: 700;
    text-decoration: none;
  }

  .meeting-prep-links a:hover {
    text-decoration: underline;
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

  .action-review-card {
    padding: 12px 14px;
    background: rgba(255,165,2,0.08);
    border-radius: 10px;
    margin: 0 0 12px;
    border: 1px solid rgba(255,165,2,0.22);
    border-left: 3px solid #ffa502;
    box-shadow: none;
  }

  .action-review-card .label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .action-review-card .value {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
  }

  .action-review-card .subtext {
    margin-top: 5px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-dim);
  }

  .action-review-next {
    margin-top: 8px;
    padding: 7px 8px;
    border-radius: 7px;
    background: rgba(15,23,42,0.44);
    color: var(--text-muted);
    font-size: 10.5px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .action-review-next strong {
    color: var(--text);
  }

  .action-review-next .review-hints {
    display: block;
    margin-top: 3px;
    color: #fbbf24;
    font-size: 10px;
  }

  .action-review-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .action-review-card-actions .settings-link-btn {
    margin-top: 0;
  }

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

  .capture-start-receipt {
    display: grid;
    grid-template-columns: minmax(58px, 0.32fr) minmax(0, 1fr);
    gap: 6px 10px;
    margin-top: 10px;
    padding: 10px 11px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(12, 14, 24, 0.28);
  }

  .capture-start-receipt.warn {
    border-color: rgba(255,107,107,0.24);
    background: rgba(255,107,107,0.08);
  }

  .capture-start-receipt.low {
    border-color: rgba(255,212,59,0.24);
    background: rgba(255,212,59,0.07);
  }

  .capture-start-receipt-label {
    color: var(--text-dim);
    font-size: 10px;
    line-height: 1.45;
    white-space: nowrap;
  }

  .capture-start-receipt-value {
    color: var(--text);
    font-size: 11px;
    line-height: 1.45;
    min-width: 0;
    overflow-wrap: anywhere;
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

  .alert-visibility-receipt {
    display: grid;
    gap: 5px;
    margin: 10px 0 12px;
    padding: 9px 11px;
    border-radius: 9px;
    border: 1px solid rgba(116,185,255,0.18);
    background: rgba(116,185,255,0.07);
  }

  .alert-visibility-title {
    color: var(--accent-light);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .alert-visibility-summary,
  .alert-visibility-boundary {
    color: var(--text);
    font-size: 10.5px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .alert-visibility-boundary {
    color: var(--text-dim);
  }

  .alert-reason-receipt {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 8px;
    padding: 8px 9px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(12,14,24,0.26);
  }

  .alert-reason-row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }

  .alert-reason-row span {
    color: var(--text-dim);
    font-size: 10px;
    line-height: 1.45;
    white-space: nowrap;
  }

  .alert-reason-row strong {
    color: var(--text);
    font-size: 10.5px;
    line-height: 1.45;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .action-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
    flex-wrap: wrap;
  }

  .action-toolbar-count {
    min-width: 0;
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.35;
  }

  .action-toolbar-warning {
    color: #fbbf24;
    white-space: nowrap;
  }

  .action-review-gate-note {
    padding: 7px 9px;
    border-radius: 8px;
    border: 1px solid rgba(251,191,36,0.22);
    background: rgba(251,191,36,0.08);
    color: #f8d678;
    font-size: 10.5px;
    line-height: 1.45;
  }

  .action-toolbar-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    flex-wrap: wrap;
  }

  .action-add,
  .action-copy-followup,
  .action-copy-all,
  .action-bulk-confirm {
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

  .action-add {
    border-color: rgba(162,155,254,0.30);
    background: rgba(108,92,231,0.12);
    color: var(--accent-light);
  }

  .action-bulk-confirm {
    border-color: rgba(105,219,124,0.28);
    background: rgba(105,219,124,0.1);
    color: var(--p2-color);
  }

  .action-add:hover:not(:disabled),
  .action-copy-followup:hover:not(:disabled),
  .action-copy-all:hover:not(:disabled),
  .action-bulk-confirm:hover:not(:disabled) {
    border-color: rgba(116,185,255,0.48);
    color: var(--text);
  }

  .action-add:disabled,
  .action-copy-followup:disabled,
  .action-copy-all:disabled,
  .action-bulk-confirm:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .action-copy-followup.success,
  .action-copy-all.success,
  .action-bulk-confirm.success,
  .action-bulk-confirm.confirmed {
    background: rgba(105,219,124,0.12);
    border-color: rgba(105,219,124,0.34);
    color: var(--p2-color);
  }

  .action-copy-followup.danger,
  .action-copy-all.danger,
  .action-bulk-confirm.danger,
  .action-bulk-confirm.failed {
    background: rgba(255,107,107,0.1);
    border-color: rgba(255,107,107,0.28);
    color: var(--p0-color);
  }

  .action-bulk-confirm.updating {
    background: rgba(162,155,254,0.12);
    border-color: rgba(162,155,254,0.32);
    color: var(--accent-light);
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

  .manual-action-card {
    border-color: rgba(162,155,254,0.45);
    background: rgba(108,92,231,0.09);
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

  .meeting-memory-cues {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 0 12px;
  }

  .meeting-memory-cue {
    padding: 11px 12px;
    border-radius: 10px;
    background: rgba(108,92,231,0.09);
    border: 1px solid rgba(108,92,231,0.26);
    border-left: 3px solid var(--accent-light);
  }

  .meeting-memory-cue-head {
    display: flex;
    gap: 7px;
    align-items: center;
    margin-bottom: 5px;
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
  }

  .meeting-memory-cue-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 10px;
    color: var(--text-dim);
    font-size: 11px;
    margin-bottom: 6px;
  }

  .meeting-memory-cue-body {
    color: var(--text);
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

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
  .action-card .ac-unassigned { color: #fbbf24; }
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
  .action-card .ac-field input,
  .action-card .ac-field textarea {
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
    box-sizing: border-box;
    font-family: inherit;
    resize: vertical;
  }
  .action-card .ac-field textarea {
    min-height: 56px;
  }
  .action-card .ac-field input:focus,
  .action-card .ac-field textarea:focus {
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
  .action-card .ac-review-warnings {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 6px;
  }
  .action-card .ac-review-warning {
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid rgba(251,191,36,0.28);
    background: rgba(251,191,36,0.10);
    color: #fbbf24;
    font-size: 10px;
    font-weight: 700;
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
  .speech-asr-receipt {
    margin-top: 6px;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.04);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .speech-asr-receipt-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0;
  }
  .speech-asr-receipt-row {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }
  .speech-asr-receipt-row span {
    color: var(--text-muted);
    font-size: 11px;
    white-space: nowrap;
  }
  .speech-asr-receipt-row strong {
    color: var(--text);
    font-size: 11px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .speech-asr-receipt-row[data-tone="success"] strong { color: #86efac; }
  .speech-asr-receipt-row[data-tone="warning"] strong { color: #fde68a; }
  .speech-asr-receipt-row[data-tone="danger"] strong { color: #fca5a5; }
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

type CaptureHandoffReceipt = {
  tone: 'ready' | 'warn' | 'low';
  status: string;
  scope: string;
  nextStep: string;
};

type PanelStateSourceReceipt = {
  tone: 'bound' | 'active' | 'demo' | 'missing';
  title: string;
  detail: string;
  chips: string[];
  boundary: string;
};

function formatCaptureStartErrorForPanel(error?: string): string {
  if (error === 'tabCapture_stream_unavailable') {
    return '浏览器没有返回可用的 tab capture stream；当前没有开始录制。';
  }
  return String(error || 'Capture 未能成功启动；当前没有开始录制。');
}

function buildCaptureHandoffReceipt(
  session: MeetingPilotSessionSnapshot,
  isTranscriptPilotActive: boolean,
): CaptureHandoffReceipt {
  const readiness = session.readiness;
  if (session.capture.kind === 'recording' || session.capture.kind === 'armed') {
    return {
      tone: 'ready',
      status: 'Capture 运行中',
      scope:
        '本场会议已授权本机 Capture；会中总结、时间线和行动项会继续刷新。它不会自动通知参会者、外发会议内容或代表你取得录制同意。',
      nextStep: '优先看提醒、行动项和当前话题；停止后会进入归档链路。',
    };
  }

  if (session.capture.kind === 'uploading') {
    return {
      tone: 'low',
      status: '上传中',
      scope: '会中 Capture 已结束，录制素材正在上传到会议分析服务。',
      nextStep: '先复核已生成行动项；上传完成后等待 Digest / PDF 状态。',
    };
  }

  if (session.capture.kind === 'completed') {
    return {
      tone: 'ready',
      status: 'Capture 已完成',
      scope: '本场录制素材已处理完成；结构化归档和纪要状态以会后页为准。',
      nextStep: '打开 Panorama 或会议历史复核摘要、行动项和纪要链接。',
    };
  }

  if (!readiness.canStartCapture) {
    return {
      tone: 'warn',
      status: '配置阻断',
      scope: readiness.summary || 'Capture 暂不能开始。',
      nextStep: '先去 Options 修复配置，再从 popup 开启。',
    };
  }

  if (isTranscriptPilotActive) {
    return {
      tone: 'low',
      status: '低配运行',
      scope: '已读取 RingCentral Transcript；未授权画面/OCR/PDF。',
      nextStep: '需要画面理解或会后纪要时，从 popup 授权。',
    };
  }

  if (session.capture.kind === 'error') {
    return {
      tone: 'warn',
      status: '启动失败',
      scope: formatCaptureStartErrorForPanel(session.capture.lastError),
      nextStep: '保持会议页打开，在 popup 第一项重试。',
    };
  }

  if (session.capture.kind === 'stopped') {
    return {
      tone: 'warn',
      status: '已停止',
      scope: '当前没有继续录制；已收集内容会继续走归档链路。',
      nextStep: '需要继续记录时，从 popup 重新授权开启。',
    };
  }

  if (readiness.status === 'degraded') {
    return {
      tone: 'low',
      status: '可开启，部分降级',
      scope:
        `${
          readiness.summary ||
          readiness.degradations[0] ||
          '授权后部分智能能力可能降级。'
        } 不会静默录制；参会者通知和录制同意需要你在会议中自行处理。`,
      nextStep: '从 popup 授权后，降级项会在会中继续刷新。',
    };
  }

  return {
    tone: 'ready',
    status: '等待授权',
    scope:
      '不会静默录制；授权后才开始本机录制、实时总结和会后分析。参会者通知和录制同意需要你在会议中自行处理。',
    nextStep: '点击扩展 icon，在 popup 第一项开启会议全貌。',
  };
}

function buildPanelCaptureControlBoundary(
  session: MeetingPilotSessionSnapshot,
  isTranscriptPilotActive: boolean,
): string {
  if (session.capture.kind === 'recording') {
    return '停止当前 Meeting Pilot Capture：只向当前绑定的会议 tab/session 提交停止请求并进入归档链路；不会发送纪要、创建或关闭外部任务、确认行动项、通知参会者或代表你取得录制同意。';
  }

  if (!session.readiness.canStartCapture) {
    return '打开 Meeting Pilot 配置：只打开本机 Options 修复配置；不会开始 Capture、停止录制、上传音频/画面、发送纪要、创建外部任务或写回 Calendar/Jira/RingCentral。';
  }

  if (session.tabId <= 0) {
    return '当前侧栏没有绑定真实会议标签页，不能从这里显示 Capture 开启步骤；不会开始录制、读取其他会议、上传音频/画面、发送纪要或写外部系统。请回到会议页或 popup 重试。';
  }

  if (isTranscriptPilotActive) {
    return '显示画面理解与纪要的授权步骤：只在原会议页引导你从 popup 开启增强 Capture；点击本身不会开始录制、上传音频/画面、通知参会者、发送纪要或创建外部任务。';
  }

  if (session.capture.kind === 'error') {
    return '显示 Capture 重试步骤：只引导你回到 popup 重新授权；点击本身不会开始录制、上传音频/画面、发送纪要、创建外部任务或清除上次失败原因。';
  }

  if (session.capture.kind === 'stopped') {
    return '显示重新开启 Capture 的步骤：只引导你回到 popup 重新授权；不会恢复旧录制、自动开始新录制、发送纪要、创建外部任务或修改已归档行动项。';
  }

  return '显示 Capture 开启步骤：只在原会议页引导你从 popup 授权开始；点击本身不会开始录制、上传音频/画面、通知参会者、发送纪要、创建外部任务或写回外部系统。';
}

function getPanelCaptureChip(session: MeetingPilotSessionSnapshot): string {
  if (session.capture.kind === 'recording' || session.capture.kind === 'armed') {
    return 'Capture 运行中';
  }
  if (session.capture.kind === 'uploading') return 'Capture 上传中';
  if (session.capture.kind === 'completed') return 'Capture 已完成';
  if (session.capture.kind === 'stopped') return 'Capture 已停止';
  if (session.capture.kind === 'error') return 'Capture 启动失败';
  return 'Capture 未开启';
}

function buildPanelStateSourceReceipt(
  session: MeetingPilotSessionSnapshot,
  requestedTabId: number | undefined,
  surfaceMode: PanelSurfaceMode,
  useDemoSession: boolean,
  state: MeetingPilotStateResponse | null,
): PanelStateSourceReceipt {
  const surfaceLabel = getPanelSurfaceLabel(surfaceMode);
  const tabChip = requestedTabId
    ? `请求 tabId ${requestedTabId}`
    : session.tabId > 0
    ? `活跃 tabId ${session.tabId}`
    : '未绑定 tab';
  const meetingChip =
    session.meetingId && session.meetingId !== 'unbound'
      ? `meeting ${session.meetingId}`
      : '未绑定 meeting';
  const commonBoundary =
    '本回执只说明侧栏正在读取哪份会中状态；不会开始/停止 Capture、发送纪要、创建外部任务或确认行动项。';

  if (useDemoSession) {
    return {
      tone: 'demo',
      title: '演示状态源',
      detail: '当前 URL 启用了 demo=1，侧栏内容来自本地示例数据，不绑定真实会议页。',
      chips: [surfaceLabel, tabChip, '本地 demo 数据'],
      boundary: commonBoundary,
    };
  }

  if (requestedTabId && session.meetingId === 'unbound') {
    return {
      tone: 'missing',
      title: '请求的会议标签页未绑定',
      detail:
        '这个侧栏带着 tabId 打开，但 background 当前没有对应会议 session；不会回退显示其他活跃会议，避免旧窗口改写错会议。',
      chips: [surfaceLabel, tabChip, '保持未绑定空态'],
      boundary: commonBoundary,
    };
  }

  if (requestedTabId && session.tabId === requestedTabId) {
    return {
      tone: 'bound',
      title: '已绑定当前会议页',
      detail:
        '这个侧栏按 URL 里的 tabId 读取同一场会议状态；行动项、时间线和 Capture 操作都会带同一个 tabId 与 meetingId。',
      chips: [surfaceLabel, tabChip, meetingChip, getPanelCaptureChip(session)],
      boundary: commonBoundary,
    };
  }

  if (!requestedTabId && state?.activeSession && session.meetingId !== 'unbound') {
    return {
      tone: 'active',
      title: '读取当前活跃会议',
      detail:
        '这个侧栏没有指定 tabId，当前显示 background 最近的活跃会议；从会议页或 popup 打开可锁定到单场会议。',
      chips: [surfaceLabel, tabChip, meetingChip, getPanelCaptureChip(session)],
      boundary: commonBoundary,
    };
  }

  return {
    tone: 'missing',
    title: '未绑定会议页',
    detail:
      '当前还没有可读取的 Meeting Pilot 会中状态。请先进入 RingCentral 会议页，再从 popup 或会议页入口打开侧栏。',
    chips: [surfaceLabel, tabChip, '等待会议 session'],
    boundary: commonBoundary,
  };
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
  const [bulkActionReviewFeedback, setBulkActionReviewFeedback] =
    useState<BulkActionReviewFeedback | null>(null);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [actionEditDraft, setActionEditDraft] = useState<ActionEditDraft>({
    title: '',
    owner: '',
    deadline: '',
  });
  const [actionEditError, setActionEditError] = useState<string | null>(null);
  const [addingActionItem, setAddingActionItem] = useState(false);
  const [manualActionDraft, setManualActionDraft] = useState<ManualActionDraft>(
    {
      title: '',
      owner: '',
      deadline: '',
      evidence: '',
    },
  );
  const [manualActionError, setManualActionError] = useState<string | null>(
    null,
  );
  const [captureGuideFeedback, setCaptureGuideFeedback] = useState<
    'shown' | 'failed' | null
  >(null);
  const [ringCentralCcFeedback, setRingCentralCcFeedback] =
    useState<RingCentralCcEnableFeedback>('idle');
  const [meetingPrepHandoff, setMeetingPrepHandoff] =
    useState<MeetingPrepHandoff | null>(null);
  const [meetingPrepActionFeedback, setMeetingPrepActionFeedback] = useState<
    Record<string, MeetingPrepActionFeedbackState>
  >({});
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
  const bulkActionReviewResetTimerRef = useRef<number | null>(null);
  const timelineFocusResetTimerRef = useRef<number | null>(null);
  const captureGuideFeedbackTimerRef = useRef<number | null>(null);
  const panelUiReadyRef = useRef(false);
  const panelUiStorageKeyRef = useRef('');
  const [focusedTimelineEventId, setFocusedTimelineEventId] = useState<
    string | null
  >(null);
  /** 开发联调：始终可开捕获日志；?debug=1 仍保留给其它更啰嗦的调试用。 */
  const showDebugTab =
    __DEV__ && new URLSearchParams(window.location.search).get('debug') !== '0';
  const useDemoSession = shouldUseMeetingPilotDemo();
  const session = selectMeetingPilotPanelSession(
    state,
    requestedTabId,
    useDemoSession,
  );
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
  const meetingMemoryCueRefs = getVisibleMeetingMemoryCueRefs(
    session.memoryRefs,
  );
  const liveFeedItems = buildMeetingPilotLiveFeedItems(
    session,
    meetingMemoryCueRefs,
  );
  const liveFeedReceipt = buildMeetingPilotLiveFeedReceipt(
    session,
    meetingMemoryCueRefs,
  );
  const pendingActions = session.actionItems.filter(
    (item) =>
      item.status === 'pending' && getActionReviewState(item) !== 'dismissed',
  );
  const openActions = session.actionItems.filter((item) =>
    isActionVisibleInFilter(item, 'open'),
  );
  const needsInfoActions = session.actionItems.filter((item) =>
    isActionVisibleInFilter(item, 'needs-info'),
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
  const visibleActionReviewWarningCount = visibleActionItems.filter(
    (item) => getActionReviewWarnings(item).length > 0,
  ).length;
  const visibleReviewActions = visibleActionItems.filter(
    (item) => getActionReviewState(item) === 'suggested',
  );
  const visibleConfirmableReviewActions = visibleReviewActions.filter(
    (item) => getActionReviewWarnings(item).length === 0,
  );
  const visibleBlockedReviewActions = visibleReviewActions.filter(
    (item) => getActionReviewWarnings(item).length > 0,
  );
  const nextReviewAction =
    needsInfoActions.find(
      (item) => getActionReviewState(item) === 'suggested',
    ) ||
    reviewQueueActions[0] ||
    needsInfoActions[0];
  const nextReviewActionWarnings = nextReviewAction
    ? getActionReviewWarnings(nextReviewAction)
    : [];
  const showActionReviewCard =
    activeTab === 'live' &&
    (needsInfoActions.length > 0 ||
      reviewQueueActions.length > 0 ||
      openActions.length > 0);
  const bulkConfirmButtonLabel = (() => {
    if (bulkActionReviewFeedback?.status === 'updating') {
      return `确认中 ${bulkActionReviewFeedback.completed}/${bulkActionReviewFeedback.total}`;
    }
    if (bulkActionReviewFeedback?.status === 'confirmed') {
      return `已确认 ${bulkActionReviewFeedback.completed} 项`;
    }
    if (bulkActionReviewFeedback?.status === 'failed') {
      return `确认失败 ${bulkActionReviewFeedback.completed}/${bulkActionReviewFeedback.total}`;
    }
    if (visibleConfirmableReviewActions.length) {
      return `确认可用项（${visibleConfirmableReviewActions.length}）`;
    }
    return visibleBlockedReviewActions.length ? '先补信息' : '无待复核';
  })();
  const actionFilterOptions: Array<{
    key: ActionReviewFilter;
    label: string;
    count: number;
  }> = [
    { key: 'open', label: '处理中', count: openActions.length },
    { key: 'needs-info', label: '需补信息', count: needsInfoActions.length },
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
      }:${session.currentTopic}:${meetingPrepHandoff?.createdAt || ''}`;
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
      }:${actionFilter}:${visibleActionItems.length}:${
        addingActionItem ? 'adding' : 'idle'
      }:${editingActionId || ''}`;
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
    meetingPrepHandoff?.createdAt,
    session.actionItems,
    actionFilter,
    addingActionItem,
    editingActionId,
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
  const sendActionItemReviewUpdate = async (
    item: MeetingPilotActionItem,
    updates: ActionReviewUpdate,
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
      return true;
    } catch (error) {
      console.warn('[Meeting Pilot][sidepanel] update action item failed', {
        actionItemId: item.id,
        error: String((error as Error)?.message || error),
      });
      return false;
    }
  };
  const updateActionItemReview = async (
    item: MeetingPilotActionItem,
    updates: ActionReviewUpdate,
  ): Promise<boolean> => {
    const success = await sendActionItemReviewUpdate(item, updates);
    if (success) {
      await refresh();
    }
    return success;
  };
  const confirmVisibleReviewActions = async () => {
    if (!visibleConfirmableReviewActions.length) {
      return;
    }
    if (bulkActionReviewFeedback?.status === 'updating') {
      return;
    }
    if (bulkActionReviewResetTimerRef.current) {
      window.clearTimeout(bulkActionReviewResetTimerRef.current);
    }

    const total = visibleConfirmableReviewActions.length;
    let completed = 0;
    setBulkActionReviewFeedback({ status: 'updating', total, completed });

    for (const item of visibleConfirmableReviewActions) {
      const success = await sendActionItemReviewUpdate(item, {
        reviewState: 'confirmed',
      });
      if (success) {
        completed += 1;
      }
      setBulkActionReviewFeedback({
        status: 'updating',
        total,
        completed,
      });
    }

    await refresh();
    setBulkActionReviewFeedback({
      status: completed === total ? 'confirmed' : 'failed',
      total,
      completed,
    });
    bulkActionReviewResetTimerRef.current = window.setTimeout(() => {
      setBulkActionReviewFeedback(null);
      bulkActionReviewResetTimerRef.current = null;
    }, 2200);
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
    if (!title) {
      setActionEditError('标题不能为空；负责人可留空，系统会标记为待分配。');
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
  const startManualActionItemAdd = () => {
    setAddingActionItem(true);
    setManualActionDraft({
      title: '',
      owner: session.selfName || '',
      deadline: '',
      evidence: '',
    });
    setManualActionError(null);
    setActionFilter('open');
  };
  const cancelManualActionItemAdd = () => {
    setAddingActionItem(false);
    setManualActionError(null);
  };
  const saveManualActionItem = async () => {
    const title = manualActionDraft.title.trim();
    const owner = manualActionDraft.owner.trim();
    const deadline = manualActionDraft.deadline.trim();
    const evidence = manualActionDraft.evidence.trim();
    if (!title) {
      setManualActionError('标题不能为空；负责人可留空，系统会标记为待分配。');
      return;
    }
    setManualActionError(null);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_ADD_ACTION_ITEM',
        tabId: session.tabId,
        meetingId: session.meetingId,
        title,
        owner,
        deadline,
        evidence,
        chapterId: currentChapter?.id,
      });
      if (!response?.success) {
        throw new Error(response?.message || '添加行动项失败');
      }
      setAddingActionItem(false);
      setManualActionDraft({
        title: '',
        owner: '',
        deadline: '',
        evidence: '',
      });
      setActionFilter('open');
      await refresh();
    } catch (error) {
      console.warn('[Meeting Pilot][sidepanel] add action item failed', {
        error: String((error as Error)?.message || error),
      });
      setManualActionError(
        (error as Error)?.message || '添加失败，请稍后重试。',
      );
    }
  };
  const addMeetingPrepCueAsActionItem = async (
    card: ContextAssistCueCard,
  ) => {
    if (!meetingPrepHandoff) {
      return;
    }
    const draft = buildMeetingPrepCueActionDraft(
      card,
      meetingPrepHandoff,
      session.selfName,
    );
    if (!draft || meetingPrepActionFeedback[card.id] === 'adding') {
      return;
    }
    if (hasMeetingPrepCueActionItem(session, card, meetingPrepHandoff)) {
      setMeetingPrepActionFeedback((current) => ({
        ...current,
        [card.id]: 'added',
      }));
      return;
    }

    setMeetingPrepActionFeedback((current) => ({
      ...current,
      [card.id]: 'adding',
    }));
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_ADD_ACTION_ITEM',
        tabId: session.tabId,
        meetingId: session.meetingId,
        title: draft.title,
        owner: draft.owner,
        deadline: draft.deadline,
        evidence: draft.evidence,
        chapterId: currentChapter?.id,
      });
      if (!response?.success) {
        throw new Error(response?.message || '添加会前准备行动项失败');
      }
      setMeetingPrepActionFeedback((current) => ({
        ...current,
        [card.id]: 'added',
      }));
      setActionFilter('open');
      await refresh();
    } catch (error) {
      console.warn('[Meeting Pilot][sidepanel] add prep action item failed', {
        cueCardId: card.id,
        error: String((error as Error)?.message || error),
      });
      setMeetingPrepActionFeedback((current) => ({
        ...current,
        [card.id]: 'failed',
      }));
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
  const copyFollowUpActionItems = async () => {
    if (!confirmedActions.length) {
      return;
    }
    if (actionCopyResetTimerRef.current) {
      window.clearTimeout(actionCopyResetTimerRef.current);
    }

    try {
      await writeTextToClipboard(
        formatFollowUpActionItemsForClipboard(confirmedActions),
      );
      setActionCopyFeedback({
        id: FOLLOW_UP_ACTION_COPY_ID,
        status: 'copied',
      });
    } catch (error) {
      console.warn(
        '[Meeting Pilot][sidepanel] copy follow-up action items failed',
        {
          count: confirmedActions.length,
          error: String((error as Error)?.message || error),
        },
      );
      setActionCopyFeedback({
        id: FOLLOW_UP_ACTION_COPY_ID,
        status: 'failed',
      });
    }

    actionCopyResetTimerRef.current = window.setTimeout(() => {
      setActionCopyFeedback((current) =>
        current?.id === FOLLOW_UP_ACTION_COPY_ID ? null : current,
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
  const openActionReviewQueue = () => {
    persistCurrentTabScroll();
    const nextFilter: ActionReviewFilter = needsInfoActions.length
      ? 'needs-info'
      : reviewQueueActions.length
      ? 'review'
      : 'open';
    setActionFilter(nextFilter);
    activeTabRef.current = 'actions';
    pendingRestoreTabRef.current = null;
    setActiveTab('actions');
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

  useEffect(() => {
    let cancelled = false;
    const syncMeetingPrepHandoff = async () => {
      const handoff = await loadMeetingPrepHandoffForSession(session).catch(
        (error) => {
          console.warn('[Meeting Pilot][sidepanel] load meeting prep failed', {
            error: String((error as Error)?.message || error),
          });
          return null;
        },
      );
      if (!cancelled) {
        setMeetingPrepHandoff(handoff);
      }
    };

    void syncMeetingPrepHandoff();
    const handleStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (
        areaName === 'local' &&
        (changes[MEETING_PREP_HANDOFF_STORAGE_KEY] ||
          changes[MEETING_PREP_HANDOFFS_STORAGE_KEY])
      ) {
        void syncMeetingPrepHandoff();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChanged);

    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [session.meetingId, session.tabId, session.title, session.url]);

  useEffect(
    () => () => {
      if (actionCopyResetTimerRef.current) {
        window.clearTimeout(actionCopyResetTimerRef.current);
      }
      if (bulkActionReviewResetTimerRef.current) {
        window.clearTimeout(bulkActionReviewResetTimerRef.current);
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
    ).find(
      (element) => element.dataset.timelineEventId === focusedTimelineEventId,
    );
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

  const enableRingCentralClosedCaptions = async () => {
    if (ringCentralCcFeedback === 'enabling') return;
    setRingCentralCcFeedback('enabling');
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_ENABLE_RINGCENTRAL_CC',
        tabId: session.tabId,
        meetingId: session.meetingId,
      })) as
        | {
            success?: boolean;
            status?: string;
            error?: string;
          }
        | undefined;
      if (response?.success) {
        setRingCentralCcFeedback(
          response.status === 'already_active' ? 'already-active' : 'enabled',
        );
        await refresh();
        return;
      }
      if (
        response?.status === 'more_not_found' ||
        response?.status === 'caption_item_not_found'
      ) {
        setRingCentralCcFeedback('not-found');
        return;
      }
      setRingCentralCcFeedback(response?.status === 'clicked' ? 'clicked' : 'failed');
    } catch {
      setRingCentralCcFeedback('failed');
    }
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
      const embeddedResponse = (await chrome.runtime.sendMessage({
        type: 'MEETING_PILOT_OPEN_SIDE_PANEL',
        tabId: session.tabId,
        source: 'unpin',
        preferSurface: 'embedded',
      })) as
        | {
            success?: boolean;
            surface?: 'embedded' | 'side-panel' | 'window' | 'unavailable';
          }
        | undefined;
      if (!embeddedResponse?.success) {
        await refresh();
        return;
      }
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
  const hasRingCentralTranscriptChunk = session.transcript.some(
    (chunk) => chunk.source === 'ringcentral_transcript',
  );
  const shouldShowRingCentralCcPrompt =
    activeTab === 'speech' &&
    session.tier?.activeTier === 'ringcentral_transcript' &&
    (!session.webTranscript?.active || !hasRingCentralTranscriptChunk);
  const ringCentralCcFeedbackText =
    ringCentralCcFeedback === 'enabling'
      ? '正在打开 RingCentral 的 More 菜单。'
      : ringCentralCcFeedback === 'enabled'
      ? '已请求开启 RC CC，字幕出现后会作为低置信预览读取。'
      : ringCentralCcFeedback === 'already-active'
      ? 'RC CC 已经开启。'
      : ringCentralCcFeedback === 'clicked'
      ? '已点击 CC 菜单项，等待 RingCentral 更新状态。'
      : ringCentralCcFeedback === 'not-found'
      ? '没找到 CC 菜单项。请手动点 RingCentral More → Enable closed captions。'
      : ringCentralCcFeedback === 'failed'
      ? '没能自动开启。请确认会议页仍打开，再手动从 More 菜单开启。'
      : '';
  const showCaptureStartCard = !isEnhancedCaptureActive && activeTab === 'live';
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
  const captureHandoffReceipt = buildCaptureHandoffReceipt(
    session,
    isTranscriptPilotActive,
  );
  const captureControlBoundary = buildPanelCaptureControlBoundary(
    session,
    isTranscriptPilotActive,
  );
  const visibleAlertCount = liveFeedReceipt.surfacedAlertCount;
  const p0AlertCount = liveFeedReceipt.surfacedP0AlertCount;
  const alertFocusTone = p0AlertCount
    ? 'urgent'
    : visibleAlertCount
    ? 'warn'
    : 'ready';
  const alertFocusValue = p0AlertCount
    ? `P0 ${p0AlertCount} 个`
    : visibleAlertCount
    ? `${visibleAlertCount} 个提醒`
    : '无新提醒';
  const alertFocusDetail = p0AlertCount
    ? '优先确认是否需要当场回应。'
    : visibleAlertCount
    ? '先看原因和边界，再决定是否处理。'
    : '继续保持低打扰。';
  const actionFocusTone = needsInfoActions.length
    ? 'warn'
    : reviewQueueActions.length
    ? 'warn'
    : openActions.length
    ? 'ready'
    : '';
  const actionFocusValue = needsInfoActions.length
    ? `需补信息 ${needsInfoActions.length}`
    : reviewQueueActions.length
    ? `待复核 ${reviewQueueActions.length}`
    : openActions.length
    ? `处理中 ${openActions.length}`
    : confirmedActions.length
    ? `已确认 ${confirmedActions.length}`
    : '无待办';
  const actionFocusDetail = needsInfoActions.length
    ? '补齐负责人、截止或依据。'
    : reviewQueueActions.length
    ? '先复核 AI 建议再复制跟进。'
    : openActions.length
    ? '可继续确认、完成或复制。'
    : confirmedActions.length
    ? '确认项可复制成跟进清单。'
    : '新的明确任务会进入行动项页。';
  const actionFocusCta = needsInfoActions.length
    ? '补信息'
    : reviewQueueActions.length
    ? '复核'
    : openActions.length
    ? '查看'
    : '';
  const captureFocusTone =
    captureHandoffReceipt.tone === 'warn'
      ? 'warn'
      : captureHandoffReceipt.tone === 'ready'
      ? 'ready'
      : '';
  const captureFocusCta = !isEnhancedCaptureActive
    ? session.readiness.canStartCapture
      ? '开启步骤'
      : '修复配置'
    : '';
  const topicFocusLabel = currentChapter?.title || session.currentTopic;
  const rawTopicFocusDetail = String(
    currentChapter?.summary || session.summary || '',
  ).trim();
  const topicFocusDetail =
    rawTopicFocusDetail.length > 88
      ? `${rawTopicFocusDetail.slice(0, 85)}...`
      : rawTopicFocusDetail;
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
        type="button"
        title={buildPanelTabBoundary('capture-log', activeTab === 'capture-log')}
        aria-label={buildPanelTabBoundary(
          'capture-log',
          activeTab === 'capture-log',
        )}
        onClick={() => handlePanelTabChange('capture-log')}
      >
        {CAPTURE_LOG_TAB_LABEL}
      </button>
    ) : null;
  const debugTabContent =
    __DEV__ && activeTab === 'capture-log' && showDebugTab ? (
      <React.Suspense
        fallback={<div className="empty-state">Loading logs...</div>}
      >
        <LazyCaptureLogTab
          session={session}
          captureLogEntries={captureLogEntries}
          readinessStatusLabel={readinessStatusLabel}
          currentTopicLabel={currentChapter?.title || session.currentTopic}
        />
      </React.Suspense>
    ) : null;
  const meetingPrepCards = meetingPrepHandoff
    ? getMeetingPrepDisplayCueCards(meetingPrepHandoff)
    : [];
  const meetingPrepEvidence = meetingPrepHandoff
    ? meetingPrepHandoff.evidence.slice(0, 5)
    : [];
  const meetingPrepGoal = meetingPrepHandoff
    ? meetingPrepHandoff.goal ||
      buildMeetingPrepHandoffGoalFromCards(
        meetingPrepHandoff.cueCards,
        meetingPrepHandoff.event,
        meetingPrepHandoff.text,
      )
    : '';
  const meetingPrepMatchReceipt = meetingPrepHandoff
    ? getMeetingPrepHandoffMatchReceipt(meetingPrepHandoff, session)
    : null;
  const meetingOutcomeLiveSlots = meetingPrepHandoff?.outcomeBinder
    ? getMeetingOutcomeLiveSlots(meetingPrepHandoff.outcomeBinder, session)
    : [];
  const panelStateSourceReceipt = buildPanelStateSourceReceipt(
    session,
    requestedTabId,
    surfaceMode,
    useDemoSession,
    state,
  );
  const actionAddButtonBoundary = buildActionToolbarBoundary('add', {
    addingActionItem,
  });
  const actionBulkConfirmBoundary = buildActionToolbarBoundary(
    'bulk-confirm',
    {
      confirmableCount: visibleConfirmableReviewActions.length,
      blockedCount: visibleBlockedReviewActions.length,
      feedback: bulkActionReviewFeedback,
    },
  );
  const actionCopyFollowupBoundary = buildActionToolbarBoundary(
    'copy-followup',
    {
      confirmedCount: confirmedActions.length,
    },
  );
  const actionCopyVisibleBoundary = buildActionToolbarBoundary('copy-visible', {
    visibleCount: visibleActionItems.length,
    filter: actionFilter,
  });

  return (
    <div
      className={`meeting-shell surface-${surfaceMode}${
        fillShellWidth ? ' fill-width' : ''
      }`}
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
            title="关闭 Meeting Pilot：只关闭当前侧栏/页内面板，不会停止 Capture、确认行动项、发送纪要或创建外部任务。"
            aria-label="关闭 Meeting Pilot"
            onClick={closeMeetingPanel}
          >
            ✕
          </button>
        </div>
      </div>

      <section
        className={`panel-source-receipt ${panelStateSourceReceipt.tone}`}
        data-panel-source-receipt="true"
        data-panel-source-tone={panelStateSourceReceipt.tone}
        aria-label="侧栏状态源回执"
      >
        <div className="panel-source-main">
          <div className="panel-source-title">
            {panelStateSourceReceipt.title}
          </div>
          <div className="panel-source-detail">
            {panelStateSourceReceipt.detail}
          </div>
        </div>
        <div className="panel-source-chips">
          {panelStateSourceReceipt.chips.map((chip, index) => (
            <span key={`${chip}-${index}`}>{chip}</span>
          ))}
        </div>
        <div className="panel-source-boundary">
          {panelStateSourceReceipt.boundary}
        </div>
      </section>

      <div className="panel-tabs" id="panelTabs">
        {(['live', 'speech', 'timeline', 'actions', 'settings'] as TabId[]).map(
          (tab) => (
            <button
              key={tab}
              className={`panel-tab ${activeTab === tab ? 'active' : ''}`}
              type="button"
              title={buildPanelTabBoundary(tab, activeTab === tab)}
              aria-label={buildPanelTabBoundary(tab, activeTab === tab)}
              onClick={() => handlePanelTabChange(tab)}
            >
              {getPanelTabLabel(tab)}
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
            <section
              className="meeting-focus-rail"
              data-meeting-focus-rail="true"
              aria-label="会中重点"
            >
              <div className="meeting-focus-rail-head">
                <div className="meeting-focus-rail-title">现在先看</div>
                <div className="meeting-focus-rail-boundary">
                  只提示，不代你发言或外发
                </div>
              </div>
              <div className="meeting-focus-rail-items">
                <div className={`focus-rail-item ${captureFocusTone}`}>
                  <div className="focus-rail-label">Capture</div>
                  <div className="focus-rail-value">
                    {captureHandoffReceipt.status}
                  </div>
                  <div className="focus-rail-detail">
                    {captureHandoffReceipt.nextStep}
                  </div>
                  {captureFocusCta ? (
                    <button
                      className="focus-rail-action"
                      type="button"
                      title={buildFocusRailActionBoundary(
                        'capture',
                        captureFocusCta,
                      )}
                      aria-label={buildFocusRailActionBoundary(
                        'capture',
                        captureFocusCta,
                      )}
                      onClick={
                        session.readiness.canStartCapture
                          ? showCaptureAuthorizationGuide
                          : openMeetingOptionsPage
                      }
                    >
                      {captureFocusCta}
                    </button>
                  ) : null}
                </div>
                <div className={`focus-rail-item ${alertFocusTone}`}>
                  <div className="focus-rail-label">提醒</div>
                  <div className="focus-rail-value">{alertFocusValue}</div>
                  <div className="focus-rail-detail">{alertFocusDetail}</div>
                </div>
                <div className={`focus-rail-item ${actionFocusTone}`}>
                  <div className="focus-rail-label">行动项</div>
                  <div className="focus-rail-value">{actionFocusValue}</div>
                  <div className="focus-rail-detail">{actionFocusDetail}</div>
                  {actionFocusCta ? (
                    <button
                      className="focus-rail-action"
                      type="button"
                      title={buildFocusRailActionBoundary(
                        'action-review',
                        actionFocusCta,
                      )}
                      aria-label={buildFocusRailActionBoundary(
                        'action-review',
                        actionFocusCta,
                      )}
                      onClick={openActionReviewQueue}
                    >
                      {actionFocusCta}
                    </button>
                  ) : null}
                </div>
                <div className="focus-rail-item">
                  <div className="focus-rail-label">当前话题</div>
                  <div className="focus-rail-value">{topicFocusLabel}</div>
                  <div className="focus-rail-detail">
                    {topicFocusDetail || '等待新的会议上下文。'}
                  </div>
                </div>
              </div>
            </section>

            <section
              className="alert-visibility-receipt"
              aria-label="会中提醒可见口径回执"
            >
              <div className="alert-visibility-title">提醒可见口径</div>
              <div className="alert-visibility-summary">
                {liveFeedReceipt.summary}
              </div>
              <div className="alert-visibility-boundary">
                {liveFeedReceipt.boundary}
              </div>
            </section>

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
                <div
                  className={`capture-start-receipt ${captureHandoffReceipt.tone}`}
                  data-capture-handoff-receipt="true"
                >
                  <span className="capture-start-receipt-label">当前</span>
                  <span className="capture-start-receipt-value">
                    {captureHandoffReceipt.status}
                  </span>
                  <span className="capture-start-receipt-label">范围</span>
                  <span className="capture-start-receipt-value">
                    {captureHandoffReceipt.scope}
                  </span>
                  <span className="capture-start-receipt-label">下一步</span>
                  <span className="capture-start-receipt-value">
                    {captureHandoffReceipt.nextStep}
                  </span>
                </div>
                {!session.readiness.canStartCapture ? (
                  <div className="capture-start-actions">
                    <button
                      className="capture-start-primary"
                      type="button"
                      title={captureControlBoundary}
                      aria-label={captureControlBoundary}
                      onClick={openMeetingOptionsPage}
                    >
                      ⚙️ 去配置 Meeting Pilot
                    </button>
                  </div>
                ) : isTranscriptPilotActive ? (
                  <div className="capture-start-actions">
                    <button
                      className="capture-start-primary"
                      type="button"
                      title={captureControlBoundary}
                      aria-label={captureControlBoundary}
                      onClick={() => void showCaptureAuthorizationGuide()}
                    >
                      启用画面理解与纪要
                    </button>
                  </div>
                ) : (
                  <div className="capture-start-actions">
                    <button
                      className="capture-start-primary"
                      type="button"
                      title={captureControlBoundary}
                      aria-label={captureControlBoundary}
                      onClick={() => void showCaptureAuthorizationGuide()}
                    >
                      {captureGuideButtonLabel}
                    </button>
                  </div>
                )}
                {captureGuideFeedback === 'failed' ? (
                  <div className="capture-start-feedback warn">
                    没能打开会议页引导。请确认原会议标签页仍在打开，然后从浏览器右上角扩展
                    icon 进入 popup。
                  </div>
                ) : null}
              </div>
            ) : null}

            {meetingPrepHandoff ? (
              <section
                className="meeting-prep-handoff-card"
                data-meeting-prep-handoff="true"
              >
                <div className="label">Today Pilot</div>
                <div className="value">会前准备已带入</div>
                <div className="subtext">
                  {meetingPrepHandoff.event.title}
                </div>
                {meetingPrepMatchReceipt ? (
                  <div
                    className={`meeting-prep-match-receipt ${meetingPrepMatchReceipt.tone}`}
                    aria-label="Handoff 匹配回执"
                  >
                    <div className="meeting-prep-match-head">
                      <strong>{meetingPrepMatchReceipt.title}</strong>
                      <span>{meetingPrepMatchReceipt.detail}</span>
                    </div>
                    <div className="meeting-prep-match-chips">
                      {meetingPrepMatchReceipt.chips.map((chip, index) => (
                        <span key={`${chip}-${index}`}>{chip}</span>
                      ))}
                    </div>
                    <div className="meeting-prep-match-boundary">
                      {meetingPrepMatchReceipt.boundary}
                    </div>
                  </div>
                ) : null}
                {meetingOutcomeLiveSlots.length ? (
                  <section
                    className="meeting-outcome-live"
                    data-meeting-outcome-live="true"
                    data-meeting-outcome-status={
                      meetingPrepHandoff?.outcomeBinder?.status || 'planned'
                    }
                    aria-label="本场闭环进度"
                  >
                    <div className="meeting-outcome-live-head">
                      <div>
                        <span>本场要闭环</span>
                        <strong>{meetingOutcomeLiveSlots.length} 件事</strong>
                      </div>
                      <span>会中只跟踪，不提前判定</span>
                    </div>
                    <div className="meeting-outcome-live-list">
                      {meetingOutcomeLiveSlots.map((item, index) => (
                        <article
                          className={`meeting-outcome-live-slot ${item.state}`}
                          data-outcome-state={item.state}
                          key={item.slot.id}
                        >
                          <span className="meeting-outcome-live-index">
                            {index + 1}
                          </span>
                          <div>
                            <strong>{item.slot.title}</strong>
                            <span>{item.detail}</span>
                          </div>
                          <span className="meeting-outcome-live-status">
                            {item.label}
                          </span>
                        </article>
                      ))}
                    </div>
                    <div className="meeting-outcome-live-boundary">
                      Transcript 提到不等于已解决；Meeting Pilot 会在归档时用决议、行动项和 transcript 证据装订最终结果。
                    </div>
                  </section>
                ) : null}
                {meetingPrepGoal ? (
                  <div className="meeting-prep-goal">
                    <span>本场关注</span>
                    <strong>{meetingPrepGoal}</strong>
                  </div>
                ) : null}
                {meetingPrepCards.length ? (
                  <div className="meeting-prep-cues">
                    {meetingPrepCards.map((card) => (
                      <article
                        className={`meeting-prep-cue ${card.kind}`}
                        key={card.id}
                      >
                        <div className="meeting-prep-cue-head">
                          <span>{getMeetingPrepCardKindLabel(card.kind)}</span>
                          <strong>{card.title}</strong>
                        </div>
                        <div className="meeting-prep-cue-body">{card.body}</div>
                        {isMeetingPrepCueActionable(card) ? (
                          <div className="meeting-prep-cue-actions">
                            {(() => {
                              const status = hasMeetingPrepCueActionItem(
                                session,
                                card,
                                meetingPrepHandoff,
                              )
                                ? 'added'
                                : meetingPrepActionFeedback[card.id];
                              const draft = buildMeetingPrepCueActionDraft(
                                card,
                                meetingPrepHandoff,
                                session.selfName,
                              );
                              const buttonBoundary =
                                buildMeetingPrepCueActionBoundary(
                                  card,
                                  status,
                                  draft,
                                );
                              return (
                                <button
                                  className={`meeting-prep-action-btn ${
                                    status === 'added' ? 'added' : ''
                                  } ${status === 'failed' ? 'failed' : ''}`}
                                  type="button"
                                  title={buttonBoundary}
                                  aria-label={buttonBoundary}
                                  disabled={
                                    status === 'adding' || status === 'added'
                                  }
                                  onClick={() =>
                                    void addMeetingPrepCueAsActionItem(card)
                                  }
                                >
                                  {status === 'adding'
                                    ? '加入中'
                                    : status === 'added'
                                    ? '已加入行动项'
                                    : status === 'failed'
                                    ? '重试加入'
                                    : '加入行动项'}
                                </button>
                              );
                            })()}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}
                {meetingPrepEvidence.length ? (
                  <details className="meeting-prep-evidence">
                    <summary>证据来源（{meetingPrepEvidence.length}）</summary>
                    {meetingPrepEvidence.map((item) => {
                      const links = getMeetingPrepEvidenceLinks(item);
                      return (
                        <div className="meeting-prep-source" key={item.id}>
                          <strong>
                            {item.sourceTitle ||
                              item.title ||
                              item.sourceLabel ||
                              'Memory'}
                          </strong>
                          <span>{item.snippet}</span>
                          {links.length ? (
                            <div className="meeting-prep-links">
                              {links.map((link) => (
                                <a
                                  href={link.url}
                                  key={link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {link.label}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </details>
                ) : null}
              </section>
            ) : null}

            {meetingMemoryCueRefs.length ? (
              <section
                className="meeting-memory-cues"
                aria-label="会中关联记忆"
              >
                {meetingMemoryCueRefs.map((memory) => {
                  const memoryLinks = getMeetingMemoryLinks(memory);
                  const timeLabel = formatMeetingMemoryTime(memory);
                  return (
                    <article
                      className="meeting-memory-cue"
                      key={`memory-cue-${memory.id}`}
                    >
                      <div className="meeting-memory-cue-head">
                        <span className="priority-tag memory-tag">
                          {memory.evidenceRoleLabel || '记忆'}
                        </span>
                        <strong>
                          {memory.cueTitle || memory.title || '相关记忆'}
                        </strong>
                      </div>
                      <div className="meeting-memory-cue-meta">
                        {memory.relationLabel ? (
                          <span>{memory.relationLabel}</span>
                        ) : null}
                        <span>{Math.round(memory.score * 100)}%</span>
                        {memory.sourceLabel ? (
                          <span>{memory.sourceLabel}</span>
                        ) : null}
                        {timeLabel ? <span>{timeLabel}</span> : null}
                        {memory.mergedCount && memory.mergedCount > 1 ? (
                          <span>合并 {memory.mergedCount} 条</span>
                        ) : null}
                      </div>
                      <div className="meeting-memory-cue-body">
                        {memory.cueBody ||
                          memory.evidenceSnippet ||
                          memory.fullSnippet ||
                          memory.snippet}
                      </div>
                      {memoryLinks.length ? (
                        <div className="memory-links">
                          {memoryLinks.map((link) => (
                            <a
                              href={link.url}
                              key={link.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {link.label}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </section>
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

            {showActionReviewCard ? (
              <div className="action-review-card">
                <div className="label">Action Review</div>
                <div className="value">
                  {needsInfoActions.length
                    ? `${needsInfoActions.length} 个需补信息行动项`
                    : reviewQueueActions.length
                    ? `${reviewQueueActions.length} 个待复核行动项`
                    : `${openActions.length} 个处理中行动项`}
                </div>
                <div className="subtext">
                  {needsInfoActions.length
                    ? '先补齐负责人、截止时间或依据，再批量确认；单条确认仍可用于你明确接受的例外项。'
                    : reviewQueueActions.length
                    ? '先确认负责人、截止时间和依据，再复制或标记完成，避免 AI 误判直接进入会后跟进。'
                    : '当前没有待复核项，已确认的跟进可以继续复制给外部系统或标记完成。'}
                </div>
                {nextReviewAction ? (
                  <div className="action-review-next">
                    下一项：
                    <strong>
                      {formatActionOwner(nextReviewAction.owner)}
                    </strong>{' '}
                    — {nextReviewAction.title}
                    {nextReviewAction.deadline
                      ? `（${nextReviewAction.deadline}）`
                      : ''}
                    {nextReviewActionWarnings.length ? (
                      <span className="review-hints">
                        复核提示：
                        {nextReviewActionWarnings
                          .map(getActionReviewWarningLabel)
                          .join(' / ')}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="action-review-card-actions">
                  <button
                    className="settings-link-btn"
                    type="button"
                    title={buildFocusRailActionBoundary(
                      'action-review',
                      needsInfoActions.length
                        ? '补齐信息'
                        : reviewQueueActions.length
                        ? '复核行动项'
                        : '查看行动项',
                    )}
                    aria-label={buildFocusRailActionBoundary(
                      'action-review',
                      needsInfoActions.length
                        ? '补齐信息'
                        : reviewQueueActions.length
                        ? '复核行动项'
                        : '查看行动项',
                    )}
                    onClick={openActionReviewQueue}
                  >
                    {needsInfoActions.length
                      ? '补齐信息'
                      : reviewQueueActions.length
                      ? '复核行动项'
                      : '查看行动项'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="alert-feed">
              {liveFeedItems.length ? (
                liveFeedItems.map((item) =>
                  item.kind === 'memory' ? (
                    <div className="alert-card" key={`memory-${item.id}`}>
                      <div className="card-header">
                        <span className="priority-tag memory-tag">
                          {item.memory.evidenceRoleLabel || '记忆'}
                        </span>
                        <span className="time">
                          {Math.round(item.memory.score * 100)}%
                        </span>
                      </div>
                      <div className="content">
                        {item.memory.title ? (
                          <strong>{item.memory.title}</strong>
                        ) : null}
                        <div>
                          {item.memory.cueBody ||
                            item.memory.fullSnippet ||
                            item.memory.snippet}
                        </div>
                        {item.memory.relationLabel || item.memory.whyMatched ? (
                          <div className="memory-why-matched">
                            {item.memory.relationLabel || item.memory.whyMatched}
                          </div>
                        ) : null}
                        <div className="memory-links">
                          {getMeetingMemoryLinks(item.memory).map((link) => (
                            <a
                              href={link.url}
                              key={link.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {link.label}
                            </a>
                          ))}
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
                        <MeetingAlertReceipt alert={item.alert} />
                      </div>
                    </div>
                  ),
                )
              ) : (
                <div className="empty-state">
                  {meetingMemoryCueRefs.length
                    ? '上方已显示本轮关联记忆；当前没有新的 P0/P1/P2 会中提醒。'
                    : '当前没有新的会中提醒。开启录制后，P0/P1/P2 提醒会进入这里，同时页内悬浮入口会显示轻量状态。'}
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
            {shouldShowRingCentralCcPrompt ? (
              <div className="rc-cc-card">
                <div className="rc-cc-card-copy">
                  <div className="rc-cc-card-title">
                    使用 RingCentral CC 提高实时预览
                  </div>
                  <div className="rc-cc-card-body">
                    会议页的 CC 开启后，发言会先显示低置信预览；最终发言仍优先使用
                    RingCentral Transcript。
                  </div>
                  {ringCentralCcFeedbackText ? (
                    <div
                      className={`rc-cc-feedback ${
                        ringCentralCcFeedback === 'failed' ||
                        ringCentralCcFeedback === 'not-found'
                          ? 'warn'
                          : ''
                      }`}
                    >
                      {ringCentralCcFeedbackText}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={ringCentralCcFeedback === 'enabling'}
                  onClick={() => void enableRingCentralClosedCaptions()}
                >
                  {ringCentralCcFeedback === 'enabling'
                    ? '开启中'
                    : '启用 RC CC'}
                </button>
              </div>
            ) : null}
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
                              {formatActionOwner(item.owner)} — {item.title}
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
            <div className="action-toolbar">
              <div className="action-toolbar-count">
                当前筛选 {visibleActionItems.length} /{' '}
                {session.actionItems.length} 项
                {visibleActionReviewWarningCount ? (
                  <span className="action-toolbar-warning">
                    {' '}
                    · {visibleActionReviewWarningCount} 项需补信息
                  </span>
                ) : null}
              </div>
              <div className="action-toolbar-actions">
                <button
                  className="action-add"
                  type="button"
                  disabled={addingActionItem}
                  title={actionAddButtonBoundary}
                  aria-label={actionAddButtonBoundary}
                  onClick={startManualActionItemAdd}
                >
                  {addingActionItem ? '正在添加' : '添加行动项'}
                </button>
                <button
                  className={`action-bulk-confirm ${
                    bulkActionReviewFeedback?.status || ''
                  }`}
                  type="button"
                  disabled={
                    !visibleConfirmableReviewActions.length ||
                    bulkActionReviewFeedback?.status === 'updating'
                  }
                  title={actionBulkConfirmBoundary}
                  aria-label={actionBulkConfirmBoundary}
                  onClick={() => void confirmVisibleReviewActions()}
                >
                  {bulkConfirmButtonLabel}
                </button>
                <button
                  className={`action-copy-followup ${
                    actionCopyFeedback?.id === FOLLOW_UP_ACTION_COPY_ID
                      ? actionCopyFeedback.status === 'copied'
                        ? 'success'
                        : 'danger'
                      : ''
                  }`}
                  type="button"
                  disabled={!confirmedActions.length}
                  title={actionCopyFollowupBoundary}
                  aria-label={actionCopyFollowupBoundary}
                  onClick={() => void copyFollowUpActionItems()}
                >
                  {actionCopyFeedback?.id === FOLLOW_UP_ACTION_COPY_ID
                    ? actionCopyFeedback.status === 'copied'
                      ? '已复制跟进清单'
                      : '复制失败'
                    : '复制跟进清单'}
                </button>
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
                  title={actionCopyVisibleBoundary}
                  aria-label={actionCopyVisibleBoundary}
                  onClick={() => void copyVisibleActionItems()}
                >
                  {actionCopyFeedback?.id === BULK_ACTION_COPY_ID
                    ? actionCopyFeedback.status === 'copied'
                      ? '已复制当前筛选'
                      : '复制失败'
                    : '复制当前筛选'}
                </button>
              </div>
            </div>
            {visibleBlockedReviewActions.length ? (
              <div className="action-review-gate-note">
                {visibleBlockedReviewActions.length}{' '}
                个待复核项缺少负责人、截止或依据；
                批量确认会先跳过它们，补齐后再进入跟进清单。
              </div>
            ) : null}
            {session.actionItems.length ? (
              <>
                <div className="action-review-summary" aria-label="行动项筛选">
                  {actionFilterOptions.map((option) => (
                    <button
                      className={`action-review-filter ${
                        actionFilter === option.key ? 'active' : ''
                      }`}
                      data-action-filter={option.key}
                      type="button"
                      aria-pressed={actionFilter === option.key}
                      title={buildActionFilterBoundary(
                        option.key,
                        option.count,
                        session.actionItems.length,
                        actionFilter === option.key,
                      )}
                      aria-label={buildActionFilterBoundary(
                        option.key,
                        option.count,
                        session.actionItems.length,
                        actionFilter === option.key,
                      )}
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
            {addingActionItem ? (
              <div className="action-card editing manual-action-card">
                <div className="ac-edit-form">
                  <label className="ac-field">
                    <span>行动项</span>
                    <input
                      name="manual-action-title"
                      value={manualActionDraft.title}
                      onChange={(event) =>
                        setManualActionDraft((current) => ({
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
                        name="manual-action-owner"
                        value={manualActionDraft.owner}
                        placeholder="可留空，稍后分配"
                        onChange={(event) =>
                          setManualActionDraft((current) => ({
                            ...current,
                            owner: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="ac-field">
                      <span>截止</span>
                      <input
                        name="manual-action-deadline"
                        value={manualActionDraft.deadline}
                        placeholder="可留空"
                        onChange={(event) =>
                          setManualActionDraft((current) => ({
                            ...current,
                            deadline: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="ac-field">
                    <span>依据</span>
                    <textarea
                      name="manual-action-evidence"
                      value={manualActionDraft.evidence}
                      placeholder="可留空"
                      onChange={(event) =>
                        setManualActionDraft((current) => ({
                          ...current,
                          evidence: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {manualActionError ? (
                    <div className="ac-edit-error">{manualActionError}</div>
                  ) : null}
                  <div className="ac-actions">
                    <button
                      className="ac-button primary"
                      type="button"
                      title={buildManualActionButtonBoundary(
                        'save',
                        manualActionDraft,
                      )}
                      aria-label={buildManualActionButtonBoundary(
                        'save',
                        manualActionDraft,
                      )}
                      onClick={() => void saveManualActionItem()}
                    >
                      保存行动项
                    </button>
                    <button
                      className="ac-button"
                      type="button"
                      title={buildManualActionButtonBoundary(
                        'cancel',
                        manualActionDraft,
                      )}
                      aria-label={buildManualActionButtonBoundary(
                        'cancel',
                        manualActionDraft,
                      )}
                      onClick={cancelManualActionItemAdd}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {visibleActionItems.length ? (
              visibleActionItems.map((item: MeetingPilotActionItem) => {
                const timelineTarget = findTimelineEventForAction(
                  session,
                  item,
                );
                const itemReviewState = getActionReviewState(item);
                const itemReviewWarnings = getActionReviewWarnings(item);
                const itemReviewExceptionHint =
                  getActionReviewExceptionHint(item);
                return (
                  <div
                    className={`action-card ${itemReviewState} ${
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
                              placeholder="可留空，稍后分配"
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
                          <span
                            className={
                              isActionOwnerUnassigned(item.owner)
                                ? 'ac-unassigned'
                                : undefined
                            }
                          >
                            👤 {formatActionOwner(item.owner)}
                          </span>
                          {item.deadline ? (
                            <span>📅 {item.deadline}</span>
                          ) : null}
                          {item.timestamp ? (
                            <span>🕒 {item.timestamp}</span>
                          ) : null}
                          <span
                            className={`ac-status ${getActionStatusClass(
                              item,
                            )}`}
                          >
                            {getActionStatusLabel(item)}
                          </span>
                          {item.source === 'manual' ? (
                            <span className="ac-edited">人工新增</span>
                          ) : item.editedAt ? (
                            <span className="ac-edited">人工校正</span>
                          ) : null}
                        </div>
                      </>
                    )}
                    {itemReviewWarnings.length ? (
                      <div className="ac-review-warnings" aria-label="复核提示">
                        {itemReviewWarnings.map((warning) => (
                          <span className="ac-review-warning" key={warning}>
                            {getActionReviewWarningLabel(warning)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {item.evidence ? (
                      <div className="ac-evidence">依据：{item.evidence}</div>
                    ) : null}
                    <div className="ac-actions">
                      {editingActionId === item.id ? (
                        <>
                          <button
                            className="ac-button primary"
                            type="button"
                            title={buildActionItemButtonBoundary(
                              item,
                              'save-edit',
                            )}
                            aria-label={buildActionItemButtonBoundary(
                              item,
                              'save-edit',
                            )}
                            onClick={() => void saveActionItemEdit(item)}
                          >
                            保存校正
                          </button>
                          <button
                            className="ac-button"
                            type="button"
                            title={buildActionItemButtonBoundary(
                              item,
                              'cancel-edit',
                            )}
                            aria-label={buildActionItemButtonBoundary(
                              item,
                              'cancel-edit',
                            )}
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
                            title={buildActionItemButtonBoundary(item, 'copy')}
                            aria-label={buildActionItemButtonBoundary(
                              item,
                              'copy',
                            )}
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
                              title={buildActionItemButtonBoundary(
                                item,
                                'timeline',
                                { timelineTarget },
                              )}
                              aria-label={buildActionItemButtonBoundary(
                                item,
                                'timeline',
                                { timelineTarget },
                              )}
                              onClick={() => focusTimelineForAction(item)}
                            >
                              时间线
                            </button>
                          ) : null}
                          <button
                            className="ac-button"
                            type="button"
                            title={buildActionItemButtonBoundary(item, 'edit')}
                            aria-label={buildActionItemButtonBoundary(
                              item,
                              'edit',
                            )}
                            onClick={() => startActionItemEdit(item)}
                          >
                            编辑
                          </button>
                          {itemReviewState === 'dismissed' ? (
                            <button
                              className="ac-button"
                              type="button"
                              title={buildActionItemButtonBoundary(
                                item,
                                'restore',
                              )}
                              aria-label={buildActionItemButtonBoundary(
                                item,
                                'restore',
                              )}
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
                              {itemReviewState !== 'confirmed' ? (
                                <button
                                  className="ac-button primary"
                                  type="button"
                                  title={buildActionItemButtonBoundary(
                                    item,
                                    'confirm',
                                    { exceptionHint: itemReviewExceptionHint },
                                  )}
                                  aria-label={buildActionItemButtonBoundary(
                                    item,
                                    'confirm',
                                    { exceptionHint: itemReviewExceptionHint },
                                  )}
                                  onClick={() =>
                                    void updateActionItemReview(item, {
                                      reviewState: 'confirmed',
                                    })
                                  }
                                >
                                  {itemReviewExceptionHint
                                    ? '确认例外'
                                    : '确认'}
                                </button>
                              ) : null}
                              <button
                                className="ac-button"
                                type="button"
                                title={buildActionItemButtonBoundary(
                                  item,
                                  'toggle-done',
                                  { exceptionHint: itemReviewExceptionHint },
                                )}
                                aria-label={buildActionItemButtonBoundary(
                                  item,
                                  'toggle-done',
                                  { exceptionHint: itemReviewExceptionHint },
                                )}
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
                                {item.status === 'done'
                                  ? '撤回完成'
                                  : itemReviewState === 'suggested'
                                  ? itemReviewExceptionHint
                                    ? '确认例外并完成'
                                    : '确认并完成'
                                  : '完成'}
                              </button>
                              <button
                                className="ac-button danger"
                                type="button"
                                title={buildActionItemButtonBoundary(
                                  item,
                                  'dismiss',
                                )}
                                aria-label={buildActionItemButtonBoundary(
                                  item,
                                  'dismiss',
                                )}
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
            ) : !addingActionItem ? (
              <div className="empty-state">
                {getActionFilterEmptyCopy(
                  session.actionItems.length ? actionFilter : 'all',
                )}
              </div>
            ) : null}
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
          type="button"
          title={captureControlBoundary}
          aria-label={captureControlBoundary}
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
                            `${formatActionOwner(item.owner)} — ${item.title}${
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
