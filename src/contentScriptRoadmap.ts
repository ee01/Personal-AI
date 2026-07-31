/**
 * Content script for Personal Roadmap pages.
 * - Injects identity / bridge handshake
 * - Syncs Gantt focus items into memory-service (per-team overwrite)
 * - Proxies Jira create / AI alias (extension-owned credentials)
 * - Renders personal-layer overlays (drift badges, memory candidates mount)
 */

import { getMemoryServiceClient } from './services/MemoryServiceClient';
import { getJiraBaseUrl, jiraFetchViaBackground } from './jira';
import {
  buildJiraCreateFields,
  findIssueType,
  findSubtaskIssueType,
  getJiraProjectCreateMeta,
  JIRA_FIELD_EPIC_LINK,
  JIRA_FIELD_PARENT_LINK,
  JIRA_FIELD_QUARTER,
  JIRA_FIELD_TARGET_END,
  JIRA_FIELD_TARGET_START,
  listIssueTypeNames,
  listMissingRequiredFields,
  looksLikeSubtaskName,
  supportsField,
  type ChildLink,
  type JiraIssueTypeMeta,
} from './jiraCreateMeta';
import { handleLLMRequest } from './llm';
import {
  readTeamId,
  toFocusSyncItem,
  type RoadmapStateMessage,
} from './roadmapFocusContract';
import { CAPABILITIES } from './analytics/capabilities';

const PARTICIPATED_TEAMS_KEY = 'roadmapParticipatedTeams';
const SYNC_ENABLED_KEY = 'roadmapFocusSyncEnabled';

/** RingCentral Jira custom fields used by Roadmap import only. */
const JIRA_FIELD_END_DATE = 'customfield_14354';
const JIRA_FIELD_DEV_ESTIMATE = 'customfield_25757';

type ImportItemPayload = {
  key: string;
  type: string;
  title: string;
  quarter?: string;
  estimate?: number;
  targetStart?: string;
  targetEnd?: string;
};

function isRoadmapHost(): boolean {
  const host = location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '10.32.56.212' ||
    host.includes('roadmap')
  );
}

async function getActorIdentity(): Promise<{
  name: string;
  source: 'extension';
}> {
  try {
    const stored = await chrome.storage.local.get(['userinfo', 'userId']);
    const userinfo = stored.userinfo || {};
    const emailPrefix =
      String(userinfo.userEmail || userinfo.email || '')
        .split('@')[0]
        ?.trim() || '';
    const name =
      userinfo.displayName ||
      userinfo.name ||
      userinfo.username ||
      emailPrefix ||
      stored.userId ||
      'Personal AI User';
    return { name: String(name).trim(), source: 'extension' };
  } catch {
    return { name: 'Personal AI User', source: 'extension' };
  }
}

async function markParticipated(teamId: string): Promise<void> {
  const stored = await chrome.storage.local.get([PARTICIPATED_TEAMS_KEY]);
  const list = Array.isArray(stored[PARTICIPATED_TEAMS_KEY])
    ? stored[PARTICIPATED_TEAMS_KEY]
    : [];
  if (!list.includes(teamId)) {
    list.push(teamId);
    await chrome.storage.local.set({ [PARTICIPATED_TEAMS_KEY]: list });
  }
}

async function isParticipated(teamId: string): Promise<boolean> {
  const stored = await chrome.storage.local.get([
    PARTICIPATED_TEAMS_KEY,
    SYNC_ENABLED_KEY,
  ]);
  if (stored[SYNC_ENABLED_KEY] === false) return false;
  const list = Array.isArray(stored[PARTICIPATED_TEAMS_KEY])
    ? stored[PARTICIPATED_TEAMS_KEY]
    : [];
  return list.includes(teamId);
}

function ensureBridgeBadge(focusCount: number): void {
  let badge = document.getElementById('pai-roadmap-bridge-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'pai-roadmap-bridge-badge';
    badge.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:18px',
      'z-index:99999',
      'background:#20242A',
      'color:#fff',
      'font:600 11px/1.2 -apple-system,BlinkMacSystemFont,sans-serif',
      'padding:6px 10px',
      'border-radius:999px',
      'box-shadow:0 4px 16px rgba(0,0,0,.18)',
      'cursor:pointer',
    ].join(';');
    badge.title = 'Personal AI 已连接。点击可关停重点项目同步。';
    badge.addEventListener('click', async () => {
      const stored = await chrome.storage.local.get([SYNC_ENABLED_KEY]);
      const next = stored[SYNC_ENABLED_KEY] === false;
      await chrome.storage.local.set({ [SYNC_ENABLED_KEY]: next });
      badge!.textContent = next
        ? `Personal AI 已连接 · ${focusCount} 个重点项目`
        : 'Personal AI 同步已关闭';
    });
    document.body.appendChild(badge);
  }
  badge.textContent = `Personal AI 已连接 · ${focusCount} 个重点项目`;
}

async function renderMemoryCandidates(): Promise<void> {
  const mount = document.getElementById('pai-memory-candidates');
  if (!mount) return;
  try {
    const client = getMemoryServiceClient();
    const response = await client.getMemoryProjectCandidates();
    const candidates = response?.candidates || [];
    if (!candidates.length) {
      mount.innerHTML = '';
      return;
    }
    mount.innerHTML = `
      <div class="pai-mem-cand-head">记忆里在谈但不在 JQL 里</div>
      ${candidates
        .map(
          (c: any) => `
        <div class="pai-mem-cand-card" draggable="true" data-title="${escapeHtml(c.title)}">
          <div class="pai-mem-cand-title">${escapeHtml(c.title)}</div>
          <div class="pai-mem-cand-meta">${escapeHtml(c.type || 'Topic')} · ${c.mentionCount || 0} 次提及</div>
        </div>`,
        )
        .join('')}
    `;
    mount.querySelectorAll('.pai-mem-cand-card').forEach((el) => {
      el.addEventListener('dragstart', (event) => {
        const title = (el as HTMLElement).dataset.title || '';
        (event as DragEvent).dataTransfer?.setData(
          'application/pai-memory-candidate',
          JSON.stringify({ title, source: 'memory' }),
        );
      });
    });
  } catch (error) {
    console.warn('[pai-roadmap] memory candidates unavailable', error);
  }
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderDriftBadges(): Promise<void> {
  try {
    const client = getMemoryServiceClient();
    const response = await client.getProjectDriftReceipts();
    const items = response?.items || [];
    for (const item of items) {
      if (item.status !== 'open' || item.event_type !== 'date_change') continue;
      const key =
        item.project_id?.split('-').slice(-2).join('-') ||
        item.project_id ||
        '';
      const bar =
        document.querySelector(`[data-pai-item="${CSS.escape(key)}"]`) ||
        document.querySelector(`[data-pai-item*="${key}"]`);
      if (!bar) continue;
      const slot =
        bar.querySelector('.pai-overlay-slot') ||
        (() => {
          const el = document.createElement('span');
          el.className = 'pai-overlay-slot';
          bar.appendChild(el);
          return el;
        })();
      if (slot.querySelector('.pai-drift-badge')) continue;
      const badge = document.createElement('button');
      badge.className = 'pai-drift-badge';
      badge.type = 'button';
      badge.textContent = item.to_value ? `→ ${item.to_value}` : '漂移';
      badge.title = item.summary || '意图与现实存在偏差';
      badge.style.cssText =
        'border:0;border-radius:999px;background:#FF8800;color:#fff;font:600 10px/1 sans-serif;padding:3px 7px;cursor:pointer';
      badge.addEventListener('click', async (event) => {
        event.stopPropagation();
        const accept = confirm(
          `${item.summary || '检测到日期漂移'}\n\n按此更新团队 bar？\n确定=接受建议（需你在页面手动拖动或后续写回）\n取消=忽略此提示`,
        );
        await client.resolveProjectDriftReceipt({
          id: item.id,
          status: accept ? 'accepted' : 'ignored',
        });
        badge.remove();
      });
      slot.appendChild(badge);
    }
  } catch (error) {
    console.warn('[pai-roadmap] drift badges unavailable', error);
  }
}

async function syncFocusSnapshot(state: RoadmapStateMessage): Promise<void> {
  // The page used to send only `team`; newer bundles send both. Reading just
  // `teamId` made this return on the first line and sync never ran.
  const teamId = readTeamId(state);
  if (!teamId || !state.editable) return;
  await markParticipated(teamId);
  if (!(await isParticipated(teamId))) return;

  const scheduled = (state.items || []).filter(Boolean);
  const client = getMemoryServiceClient();
  const result = await client.syncFocusProjects({
    teamId,
    teamName: state.teamName,
    syncedAt: Date.now(),
    items: scheduled.map(toFocusSyncItem),
  });
  ensureBridgeBadge(
    result.projects?.filter((p: any) => p.tier === 'focus').length ||
      scheduled.length,
  );
  void renderMemoryCandidates();
  void renderDriftBadges();
}

const FOCUS_SYNC_DEBOUNCE_MS = 500;
let focusSyncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFocusState: RoadmapStateMessage | null = null;

/** The page re-pushes state on every drag, so only the last one is worth sending. */
function queueFocusSnapshot(state: RoadmapStateMessage): void {
  pendingFocusState = state;
  if (focusSyncTimer) clearTimeout(focusSyncTimer);
  focusSyncTimer = setTimeout(() => {
    focusSyncTimer = null;
    const next = pendingFocusState;
    pendingFocusState = null;
    if (!next) return;
    void syncFocusSnapshot(next).catch((error) => {
      console.warn('[pai-roadmap] focus sync failed', error);
    });
  }, FOCUS_SYNC_DEBOUNCE_MS);
}

function applyQuartersToJql(jql: string, quarters: string[]): string {
  const replacement = quarters.join(', ');
  const re = /("Target Delivery Quarter"\s+in\s*\()([^)]*)(\))/g;
  let hit = false;
  const out = jql.replace(re, (_m, p1: string, _p2: string, p3: string) => {
    hit = true;
    return `${p1}${replacement}${p3}`;
  });
  if (!hit) {
    return `${jql} AND "Target Delivery Quarter" in (${replacement})`;
  }
  return out;
}

function optionValue(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw && 'value' in raw) {
    const value = (raw as { value?: unknown }).value;
    return value == null ? undefined : String(value);
  }
  return String(raw);
}

function toIsoDate(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  // Jira date fields are usually YYYY-MM-DD
  return text.slice(0, 10);
}

function estimateWeeks(fields: Record<string, unknown>): number | undefined {
  const dev = fields[JIRA_FIELD_DEV_ESTIMATE];
  const asNumber =
    typeof dev === 'number'
      ? dev
      : typeof dev === 'string' && dev.trim()
        ? Number(dev)
        : NaN;
  if (Number.isFinite(asNumber) && asNumber > 0) {
    // DEV Estimate is person-days at RC; Roadmap estimate is weeks.
    return Math.max(1, Math.round(asNumber / 5));
  }
  const original = fields.timeoriginalestimate;
  if (typeof original === 'number' && original > 0) {
    const days = original / (3600 * 8);
    return Math.max(1, Math.round(days / 5));
  }
  return undefined;
}

function mapIssueToImportItem(issue: any): ImportItemPayload | null {
  const key = String(issue?.key || '').trim();
  if (!key) return null;
  const fields = (issue?.fields || {}) as Record<string, unknown>;
  const targetEnd =
    toIsoDate(fields[JIRA_FIELD_TARGET_END]) ||
    toIsoDate(fields[JIRA_FIELD_END_DATE]);
  return {
    key,
    type: String((fields.issuetype as { name?: string } | undefined)?.name || 'Epic'),
    title: String(fields.summary || key),
    quarter: optionValue(fields[JIRA_FIELD_QUARTER]),
    estimate: estimateWeeks(fields),
    targetStart: toIsoDate(fields[JIRA_FIELD_TARGET_START]),
    targetEnd,
  };
}

async function handleImportJql(
  jql: string,
  quarters: string[],
): Promise<ImportItemPayload[]> {
  const baseUrl = await getJiraBaseUrl();
  const effectiveJql = applyQuartersToJql(String(jql || ''), quarters || []);
  const fields = [
    'summary',
    'issuetype',
    'timeoriginalestimate',
    JIRA_FIELD_TARGET_START,
    JIRA_FIELD_TARGET_END,
    JIRA_FIELD_END_DATE,
    JIRA_FIELD_QUARTER,
    JIRA_FIELD_DEV_ESTIMATE,
  ];

  const items: ImportItemPayload[] = [];
  let startAt = 0;
  const maxResults = 100;
  let total = Infinity;

  console.info('[pai-roadmap] import jql start', {
    baseUrl,
    quarters,
    jql: effectiveJql,
  });

  while (startAt < total) {
    const response = await jiraFetchViaBackground(`${baseUrl}/rest/api/2/search`, {
      method: 'POST',
      body: {
        jql: effectiveJql,
        startAt,
        maxResults,
        fields,
      },
      requestLabel: 'roadmap import jql search',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira 查询失败 (${response.status}): ${errorText.slice(0, 300)}`);
    }
    const data = await response.json();
    total = Number(data.total || 0);
    const page = Array.isArray(data.issues) ? data.issues : [];
    for (const issue of page) {
      const mapped = mapIssueToImportItem(issue);
      if (mapped) items.push(mapped);
    }
    if (!page.length) break;
    startAt += page.length;
    if (startAt > 2000) break; // hard safety cap
  }

  console.info('[pai-roadmap] import jql', {
    quarters,
    total: items.length,
    jql: effectiveJql,
  });
  return items;
}

type CreateJiraParentInput = {
  itemKey: string;
  title: string;
  issueType: string;
  projectKey: string;
  targetStart: string | null;
  targetEnd: string | null;
};

type CreateJiraChildInput = {
  draftId: string;
  title: string;
  issueType: string;
  projectKey: string;
  parentItemKey: string;
  parentJiraKey: string | null;
};

type CreateJiraPayload = {
  teamId: string;
  token: string | null;
  parent: CreateJiraParentInput | null;
  children: CreateJiraChildInput[];
};

type CreateJiraResult = {
  parent?: { itemKey: string; jiraKey?: string; error?: string };
  children: Array<{ draftId: string; jiraKey?: string; error?: string }>;
};

type LegacyCreateJiraPayload = {
  prompt?: string;
  drafts: Array<{
    id: string;
    title: string;
    owner?: string;
    parentKey: string;
  }>;
};

type LegacyCreateJiraResult = {
  mappings: Array<{ draftId: string; jiraKey?: string; error?: string }>;
};

type RoadmapSnapshotItem = {
  key: string;
  type?: string;
  jiraKey?: string | null;
  projectKey?: string | null;
  quarter?: string | null;
  subs?: Array<{ id: string; key?: string | null }>;
};

type RoadmapSnapshot = {
  team?: {
    id?: string;
    jqlHints?: {
      projectKey?: string | null;
      itemType?: string | null;
      subType?: string | null;
      linkField?: string | null;
      confident?: boolean;
    };
  };
  items?: RoadmapSnapshotItem[];
};

function errorMessage(error: unknown): string {
  return (error as { message?: string })?.message || String(error);
}

/** Jira's own message names the offending field; a bare status code does not. */
function describeJiraFailure(status: number, body: string): string {
  try {
    const data = JSON.parse(body);
    const messages = [
      ...(Array.isArray(data?.errorMessages) ? data.errorMessages : []),
      ...Object.entries(data?.errors || {}).map(
        ([field, message]) => `${field}: ${message}`,
      ),
    ].filter(Boolean);
    if (messages.length) return messages.join('；');
  } catch {
    /* not JSON — fall through to the raw body */
  }
  return body.trim().slice(0, 300) || `HTTP ${status}`;
}

function roadmapClientId(): string {
  try {
    return localStorage.getItem('roadmap-client-id') || 'pai-extension';
  } catch {
    return 'pai-extension';
  }
}

function roadmapShareToken(teamId: string, provided?: string | null): string {
  if (provided) return String(provided);
  try {
    return localStorage.getItem(`roadmap-edit-token:${teamId}`) || '';
  } catch {
    return '';
  }
}

/**
 * Talks to the roadmap service the same way the page does (see
 * `web/src/composables/useRoadmapApi.ts`): same origin, actor headers, and the
 * team's edit token.
 */
async function roadmapApiFetch<T>(
  path: string,
  options: {
    method: 'GET' | 'POST';
    teamId: string;
    token?: string | null;
    body?: Record<string, unknown>;
  },
): Promise<T> {
  const identity = await getActorIdentity();
  const shareToken = roadmapShareToken(options.teamId, options.token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Id': roadmapClientId(),
    'X-Actor-Name': identity.name,
    'X-Actor-Source': 'extension',
  };
  if (shareToken) headers['X-Share-Token'] = shareToken;

  const response = await fetch(`${location.origin}${path}`, {
    method: options.method,
    headers,
    body: options.body
      ? JSON.stringify({
          ...options.body,
          actorName: identity.name,
          clientId: roadmapClientId(),
          actorSource: 'extension',
          shareToken,
        })
      : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    let detail = text.slice(0, 200);
    try {
      detail = JSON.parse(text)?.error || detail;
    } catch {
      /* keep the raw text */
    }
    throw new Error(`Roadmap 服务返回 ${response.status}：${detail}`);
  }
  return (await response.json()) as T;
}

async function sendRoadmapIntent(
  teamId: string,
  token: string | null | undefined,
  intent: Record<string, unknown>,
): Promise<void> {
  await roadmapApiFetch(`/api/v1/teams/${encodeURIComponent(teamId)}/intents`, {
    method: 'POST',
    teamId,
    token,
    body: intent,
  });
}

async function loadRoadmapSnapshot(
  teamId: string,
  token: string | null | undefined,
): Promise<RoadmapSnapshot | null> {
  try {
    const data = await roadmapApiFetch<{ snapshot: RoadmapSnapshot }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}`,
      { method: 'GET', teamId, token },
    );
    return data?.snapshot || null;
  } catch (error) {
    // Only used for idempotency and hierarchy hints; creation can still run.
    console.warn('[pai-roadmap] snapshot unavailable before create', error);
    return null;
  }
}

/**
 * Which field hangs a child off its parent, from the parent's own issue type:
 * Initiative→Epic uses Parent Link, Epic→Task uses Epic Link, and anything at
 * Task/Story level takes a real sub-task via `fields.parent`.
 */
function deriveLinkField(
  parentIssueType: string | undefined,
  hint: string | null | undefined,
): string {
  const type = String(parentIssueType || '').trim().toUpperCase();
  if (type === 'INITIATIVE' || type === 'INIT') return JIRA_FIELD_PARENT_LINK;
  if (type === 'EPIC') return JIRA_FIELD_EPIC_LINK;
  if (type) return 'parent';
  return hint || JIRA_FIELD_EPIC_LINK;
}

function resolveChildLink(
  childType: JiraIssueTypeMeta | null,
  parentIssueType: string | undefined,
  hint: string | null | undefined,
): ChildLink {
  if (childType?.subtask) return { mode: 'parent' };
  const derived = deriveLinkField(parentIssueType, hint);
  if (derived === 'parent') return { mode: 'parent' };
  if (childType && !supportsField(childType, derived)) {
    const alternate =
      derived === JIRA_FIELD_PARENT_LINK
        ? JIRA_FIELD_EPIC_LINK
        : JIRA_FIELD_PARENT_LINK;
    if (supportsField(childType, alternate)) {
      return { mode: 'field', fieldId: alternate };
    }
    if (supportsField(childType, 'parent')) return { mode: 'parent' };
  }
  return { mode: 'field', fieldId: derived };
}

async function resolveIssueTypeForCreate(
  projectKey: string,
  requestedType: string,
  options: { wantsSubtask?: boolean } = {},
): Promise<{ typeMeta: JiraIssueTypeMeta | null; typeName: string }> {
  const meta = await getJiraProjectCreateMeta(projectKey);
  const requested = String(requestedType || '').trim();
  let typeMeta = findIssueType(meta, requested);
  const needsSubtask =
    Boolean(options.wantsSubtask) || looksLikeSubtaskName(requested);
  if (meta && needsSubtask && !typeMeta?.subtask) {
    // 'Sub-task' is only one of the names Jira instances use for this.
    typeMeta = findSubtaskIssueType(meta) || typeMeta;
  }
  if (meta && !meta.empty && !typeMeta) {
    throw new Error(
      `项目 ${projectKey} 下没有可创建的类型「${requested}」（可选：${
        listIssueTypeNames(meta).join('、') || '无'
      }）`,
    );
  }
  const typeName = typeMeta?.name || requested;
  if (!typeName) {
    // The page leaves the sub-task type empty on purpose (its name is per
    // project), so createmeta being unreachable is the only way to land here.
    throw new Error(
      `无法确定 ${projectKey} 的子任务类型：Jira createmeta 不可用，请在弹窗里手动填写子任务类型`,
    );
  }
  return { typeMeta, typeName };
}

async function createJiraIssue(input: {
  projectKey: string;
  typeName: string;
  typeMeta: JiraIssueTypeMeta | null;
  summary: string;
  targetStart?: string | null;
  targetEnd?: string | null;
  quarter?: string | null;
  link?: ChildLink & { parentKey: string };
  requestLabel: string;
}): Promise<string> {
  const { typeMeta } = input;
  const fields = buildJiraCreateFields(input);

  const baseUrl = await getJiraBaseUrl();
  const response = await jiraFetchViaBackground(`${baseUrl}/rest/api/2/issue`, {
    method: 'POST',
    body: { fields },
    requestLabel: input.requestLabel,
  });
  if (!response.ok) {
    const body = await response.text();
    const hints: string[] = [];
    if (response.status === 401 || response.status === 403) {
      hints.push('若未登录 Jira，请先在 Options 配置 Jira API Token');
    }
    const missing = listMissingRequiredFields(typeMeta, Object.keys(fields));
    if (missing.length) hints.push(`该类型还要求：${missing.join('、')}`);
    throw new Error(
      `创建失败 (${response.status}): ${describeJiraFailure(response.status, body)}${
        hints.length ? `（${hints.join('；')}）` : ''
      }`,
    );
  }
  const created = await response.json();
  const key = String(created?.key || '').trim();
  if (!key) throw new Error('Jira 未返回 issue key');
  return key;
}

function isLegacyCreatePayload(payload: any): payload is LegacyCreateJiraPayload {
  return Array.isArray(payload?.drafts) && !Array.isArray(payload?.children);
}

/**
 * Two-phase creation: the main issue first, its key persisted to the roadmap
 * before any child is touched, then each child linked to it. One failing row
 * never stops the batch — every row reports its own key or error.
 */
async function handleCreateJiraBatch(
  payload: CreateJiraPayload,
): Promise<CreateJiraResult> {
  const teamId = String(payload.teamId || '').trim();
  const parent = payload.parent || null;
  const children = Array.isArray(payload.children) ? payload.children : [];
  if (!teamId) throw new Error('缺少 teamId，无法把创建结果写回 Roadmap');
  if (!parent && !children.length) return { children: [] };

  const snapshot = await loadRoadmapSnapshot(teamId, payload.token);
  const hintLinkField = snapshot?.team?.jqlHints?.linkField ?? null;
  const itemsByKey = new Map<string, RoadmapSnapshotItem>();
  const subKeys = new Map<string, string>();
  for (const item of snapshot?.items || []) {
    if (!item?.key) continue;
    itemsByKey.set(item.key, item);
    for (const sub of item.subs || []) {
      if (sub?.id && sub.key) subKeys.set(sub.id, String(sub.key));
    }
  }

  /** itemKey → Jira key, seeded from the snapshot and filled in as we create. */
  const parentKeys = new Map<string, string>();
  for (const [key, item] of itemsByKey) {
    if (item.jiraKey) parentKeys.set(key, String(item.jiraKey));
  }

  const result: CreateJiraResult = { children: [] };

  if (parent) {
    const existing = parentKeys.get(parent.itemKey);
    if (existing) {
      // Re-running after a partial failure must not create a second issue.
      result.parent = { itemKey: parent.itemKey, jiraKey: existing };
    } else {
      try {
        const { typeMeta, typeName } = await resolveIssueTypeForCreate(
          parent.projectKey,
          parent.issueType,
        );
        const jiraKey = await createJiraIssue({
          projectKey: parent.projectKey,
          typeName,
          typeMeta,
          summary: parent.title,
          targetStart: parent.targetStart,
          targetEnd: parent.targetEnd,
          quarter: itemsByKey.get(parent.itemKey)?.quarter || null,
          requestLabel: 'roadmap create jira item',
        });
        parentKeys.set(parent.itemKey, jiraKey);
        result.parent = { itemKey: parent.itemKey, jiraKey };
        try {
          // Persisted before any child work: a child failure or a closed tab
          // must never orphan a created issue from its roadmap row.
          await sendRoadmapIntent(teamId, payload.token, {
            op: 'resolve_item',
            itemKey: parent.itemKey,
            jiraKey,
            type: typeName,
            projectKey: parent.projectKey,
          });
        } catch (error) {
          result.parent.error = `已创建 ${jiraKey}，但回写 Roadmap 失败：${errorMessage(
            error,
          )}`;
        }
      } catch (error) {
        result.parent = { itemKey: parent.itemKey, error: errorMessage(error) };
      }
    }
  }

  for (const child of children) {
    const draftId = String(child?.draftId || '');
    if (!draftId) continue;
    const existing = subKeys.get(draftId);
    if (existing) {
      result.children.push({ draftId, jiraKey: existing });
      continue;
    }
    const parentJiraKey =
      child.parentJiraKey || parentKeys.get(child.parentItemKey) || '';
    if (!parentJiraKey) {
      result.children.push({
        draftId,
        error: '父任务未创建成功，已跳过（修复后重试即可，不会重复创建）',
      });
      continue;
    }

    const row: { draftId: string; jiraKey?: string; error?: string } = { draftId };
    try {
      const parentIssueType =
        (parent && parent.itemKey === child.parentItemKey
          ? parent.issueType
          : itemsByKey.get(child.parentItemKey)?.type) || undefined;
      const wantsSubtask =
        deriveLinkField(parentIssueType, hintLinkField) === 'parent';
      const { typeMeta, typeName } = await resolveIssueTypeForCreate(
        child.projectKey,
        child.issueType,
        { wantsSubtask },
      );
      const link = resolveChildLink(typeMeta, parentIssueType, hintLinkField);
      const jiraKey = await createJiraIssue({
        projectKey: child.projectKey,
        typeName,
        typeMeta,
        summary: child.title,
        link: { ...link, parentKey: parentJiraKey },
        requestLabel: 'roadmap create jira sub-task',
      });
      row.jiraKey = jiraKey;
      try {
        await sendRoadmapIntent(teamId, payload.token, {
          op: 'resolve_draft',
          mappings: [{ draftId, jiraKey }],
        });
      } catch (error) {
        row.error = `已创建 ${jiraKey}，但回写 Roadmap 失败：${errorMessage(error)}`;
      }
    } catch (error) {
      row.error = errorMessage(error);
    }
    result.children.push(row);
  }

  return result;
}

/** Kept so a stale page bundle gets a real answer instead of a rejected promise. */
async function handleLegacyCreateJira(
  payload: LegacyCreateJiraPayload,
): Promise<LegacyCreateJiraResult> {
  const mappings: LegacyCreateJiraResult['mappings'] = [];
  for (const draft of payload.drafts || []) {
    try {
      const parentKey = String(draft.parentKey || '').trim();
      const projectKey = parentKey.split('-')[0] || 'NOVA';
      const { typeMeta, typeName } = await resolveIssueTypeForCreate(
        projectKey,
        'Task',
      );
      const jiraKey = await createJiraIssue({
        projectKey,
        typeName,
        typeMeta,
        summary: draft.title,
        link: parentKey
          ? { ...resolveChildLink(typeMeta, 'Epic', null), parentKey }
          : undefined,
        requestLabel: 'roadmap create jira task (legacy)',
      });
      mappings.push({ draftId: draft.id, jiraKey });
    } catch (error) {
      mappings.push({ draftId: draft.id, error: errorMessage(error) });
    }
  }
  return { mappings };
}

async function handleCreateJira(
  payload: any,
): Promise<CreateJiraResult | LegacyCreateJiraResult> {
  if (isLegacyCreatePayload(payload)) {
    return handleLegacyCreateJira(payload);
  }
  return handleCreateJiraBatch(payload as CreateJiraPayload);
}

async function handleAiAlias(title: string): Promise<string> {
  const text = await handleLLMRequest({
    type: 'query',
    system_prompt:
      '你是项目备注名生成器。把 Jira 标题压缩成 2-6 个汉字或英文短词，不要标点，不要解释。',
    user_prompt: title,
    capability: CAPABILITIES.PROJECT_DASHBOARD,
    feature: 'ai_alias',
  });
  const cleaned = String(text || title)
    .replace(/\s+/g, '')
    .slice(0, 12);
  return cleaned || title.slice(0, 6);
}

function injectBridge(): void {
  (window as any).__PAI_ROADMAP_BRIDGE__ = {
    version: 1,
    extension: true,
  };

  async function announceIdentity(): Promise<void> {
    window.postMessage({ type: 'pai-roadmap-hello', source: 'extension' }, '*');
    try {
      const identity = await getActorIdentity();
      window.postMessage(
        {
          type: 'pai-roadmap-identity',
          ...identity,
        },
        '*',
      );
    } catch (error) {
      console.warn('[pai-roadmap] identity announce failed', error);
    }
  }

  void announceIdentity();

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.type === 'pai-roadmap-state') {
      queueFocusSnapshot(data as RoadmapStateMessage);
      return;
    }

    if (data.type === 'pai-roadmap-request-identity') {
      const identity = await getActorIdentity();
      window.postMessage(
        {
          type: 'pai-roadmap-identity',
          ...identity,
        },
        '*',
      );
      return;
    }

    if (data.type === 'pai-roadmap-import-jql') {
      // 先回执，页面才能区分「扩展没收到请求」和「Jira 查询很慢」
      window.postMessage(
        {
          type: 'pai-roadmap-import-jql-ack',
          requestId: data.requestId,
        },
        '*',
      );
      try {
        const items = await handleImportJql(
          String(data.jql || ''),
          Array.isArray(data.quarters) ? data.quarters.map(String) : [],
        );
        window.postMessage(
          {
            type: 'pai-roadmap-import-jql-result',
            requestId: data.requestId,
            ok: true,
            items,
          },
          '*',
        );
      } catch (error: any) {
        window.postMessage(
          {
            type: 'pai-roadmap-import-jql-result',
            requestId: data.requestId,
            ok: false,
            error: error?.message || String(error),
          },
          '*',
        );
      }
      return;
    }

    if (data.type === 'pai-roadmap-create-jira') {
      // Same contract as import: acknowledge first so the page can tell
      // "extension never got it" apart from "Jira is slow".
      window.postMessage(
        {
          type: 'pai-roadmap-create-jira-ack',
          requestId: data.requestId,
        },
        '*',
      );
      try {
        const result = await handleCreateJira(data.payload || {});
        window.postMessage(
          {
            type: 'pai-roadmap-create-jira-result',
            requestId: data.requestId,
            ok: true,
            result,
          },
          '*',
        );
      } catch (error: any) {
        window.postMessage(
          {
            type: 'pai-roadmap-create-jira-result',
            requestId: data.requestId,
            ok: false,
            error: error?.message || String(error),
          },
          '*',
        );
      }
      return;
    }

    if (data.type === 'pai-roadmap-ai-alias') {
      try {
        const alias = await handleAiAlias(String(data.title || ''));
        window.postMessage(
          {
            type: 'pai-roadmap-ai-alias-result',
            requestId: data.requestId,
            ok: true,
            alias,
          },
          '*',
        );
      } catch (error: any) {
        window.postMessage(
          {
            type: 'pai-roadmap-ai-alias-result',
            requestId: data.requestId,
            ok: false,
            error: error?.message || String(error),
          },
          '*',
        );
      }
    }
  });

  // Re-announce after page scripts mount (covers late SPA boot).
  setTimeout(() => {
    void announceIdentity();
  }, 800);
}

if (isRoadmapHost()) {
  injectBridge();
}
