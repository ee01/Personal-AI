<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoadmapState, scheduleFromBacklog, hasTargetInTimeline, targetDays } from '../composables/useRoadmapState';
import {
  X,
  DAY_W,
  computeTL,
  fmtMD,
  fmtISO,
  addD,
  diffD,
  clamp,
  today,
  mStart,
  parseDate,
  qOf,
  type Timeline,
} from '../composables/useGeometry';
import {
  PHASE_RULER,
  buildReleaseSheetConfig,
  catchReleaseHint,
  fetchReleaseSheetRows,
  isReleaseSheetStale,
  phaseOptions,
  pickSplit,
  relParsed,
  relSegments,
  shownKinds,
  type PhaseRulerKind,
  type ParsedReleaseSchedule,
  type ReleaseSheetConfig,
} from '../composables/useReleaseRuler';
import type { RoadmapItem, RoadmapSub, RulerMode } from '../types';
import GanttRow from './GanttRow.vue';
import ResourceView from './ResourceView.vue';
import {
  bridgeImportChildTasks,
  bridgeRefreshJiraIssues,
  bridgeUpdateAssignee,
  bridgeUpdateTargetDates,
} from '../composables/useExtensionBridge';
import { extensionLockTip, useExtensionGate } from '../composables/useExtensionGate';
import {
  jiraUsernameFromFull,
  mapGet,
  teamAssigneeMap,
} from '../composables/useAssigneeMap';

const state = useRoadmapState();
const gate = useExtensionGate();
const gScroll = ref<HTMLElement | null>(null);
const gBody = ref<HTMLElement | null>(null);
const dropVisible = ref(false);
const dropLeft = ref(0);
const dropDate = ref('');
const dragHint = ref({ show: false, x: 0, y: 0, text: '' });
let silentRefreshInFlight = false;

const tl = computed<Timeline>(() =>
  computeTL(state.snapshot.value?.team.checkedQuarters || []),
);

/** Data-level schedule (always on when configured) — for catch-sprint hints. */
const teamRel = computed<ParsedReleaseSchedule | null>(() => {
  const cfg = state.snapshot.value?.team.releaseSheet as ReleaseSheetConfig | null | undefined;
  if (!cfg?.rows?.length) return null;
  return relParsed(cfg);
});

/** Render-level schedule — null when temporarily switched to month ruler. */
const activeRel = computed<ParsedReleaseSchedule | null>(() =>
  state.rulerMode.value === 'month' ? null : teamRel.value,
);

const releaseCfg = computed(
  () => state.snapshot.value?.team.releaseSheet as ReleaseSheetConfig | null | undefined,
);

const splitKind = computed<PhaseRulerKind | null>(() => {
  if (!activeRel.value || !releaseCfg.value) return null;
  return pickSplit(releaseCfg.value.splitPhase, activeRel.value);
});

const shownPhaseKinds = computed(() => {
  if (!activeRel.value || !releaseCfg.value) return [] as PhaseRulerKind[];
  return shownKinds(releaseCfg.value, activeRel.value);
});

const sprintSegments = computed(() => {
  if (!activeRel.value || !splitKind.value) return [];
  return relSegments(activeRel.value, splitKind.value);
});

const showRulerSwitch = computed(
  () => Boolean(teamRel.value) && state.view.value === 'gantt',
);

const phaseLegend = computed(() => {
  if (!activeRel.value || !releaseCfg.value || !splitKind.value) return [];
  const raw: Record<string, string> = {};
  phaseOptions(activeRel.value).forEach((o) => {
    raw[o.kind] = o.raw;
  });
  return shownPhaseKinds.value.map((k) => ({
    kind: k,
    label: raw[k] || PHASE_RULER[k].label,
    color: PHASE_RULER[k].color,
    full: PHASE_RULER[k].full,
    isSplit: k === splitKind.value,
  }));
});

const monthOffsetDays = computed(() => {
  const months = tl.value.months;
  const acc: number[] = [];
  let sum = 0;
  for (const mo of months) {
    acc.push(sum);
    sum += mo.days;
  }
  return acc;
});

const visibleSegments = computed(() => {
  if (!activeRel.value || !splitKind.value) return [];
  const maxX = tl.value.days * DAY_W;
  return sprintSegments.value
    .map((sg, i) => {
      if (sg.end <= tl.value.start || sg.start > tl.value.end) return null;
      const x0 = clamp(X(tl.value, sg.start) + DAY_W / 2, 0, maxX);
      const x1 = clamp(X(tl.value, sg.end) + DAY_W / 2, 0, maxX);
      const cur = today >= sg.start && today < sg.end;
      const tip =
        `${sg.rel.name}${cur ? '（当前 Sprint）' : ''} · ${fmtMD(sg.start)} → ${fmtMD(sg.end)}||` +
        sg.rel.phases.map((p) => `${p.phase} ${fmtMD(p.date)}`).join(' · ') +
        `||Sprint 区间按结束分割节点「${PHASE_RULER[splitKind.value!].label}」划分 · 数据来自团队发布时间表`;
      return { rel: sg.rel, x0, x1, cur, tip, i };
    })
    .filter(Boolean) as Array<{
    rel: (typeof sprintSegments.value)[number]['rel'];
    x0: number;
    x1: number;
    cur: boolean;
    tip: string;
    i: number;
  }>;
});

const visibleTicks = computed(() => {
  if (!activeRel.value) return [];
  let lastLabelRight = -1e9;
  const out: Array<{
    release: string;
    kind: PhaseRulerKind;
    px: number;
    color: string;
    past: boolean;
    tip: string;
    proLabel?: string;
    row2?: boolean;
  }> = [];
  for (const p of activeRel.value.phases) {
    if (!shownPhaseKinds.value.includes(p.kind)) continue;
    if (p.date < tl.value.start || p.date > tl.value.end) continue;
    const px = X(tl.value, p.date) + DAY_W / 2;
    const past = p.date < today;
    const ymd = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}-${String(p.date.getDate()).padStart(2, '0')}`;
    const entry: (typeof out)[number] = {
      release: p.release,
      kind: p.kind,
      px,
      color: PHASE_RULER[p.kind].color,
      past,
      tip: `${p.release} · ${p.phase}（${PHASE_RULER[p.kind].full}）||${ymd}${past ? '（已过）' : ''}||发布时间表标尺`,
    };
    if (p.kind === 'pro') {
      const text = `Pro ${fmtMD(p.date)}`;
      const w = text.length * 5.2;
      const clash = px - w / 2 < lastLabelRight + 4;
      entry.proLabel = text;
      entry.row2 = clash;
      if (!clash) lastLabelRight = px + w / 2;
    }
    out.push(entry);
  }
  return out;
});

const splitLines = computed(() => {
  if (!activeRel.value || !splitKind.value) return [];
  return sprintSegments.value
    .filter((sg) => sg.start >= tl.value.start && sg.start <= tl.value.end)
    .map((sg) => ({
      left: X(tl.value, sg.start) + DAY_W / 2,
      color: PHASE_RULER[splitKind.value!].color,
    }));
});

const phaseLines = computed(() => {
  if (!activeRel.value || !splitKind.value) return [];
  return activeRel.value.phases
    .filter(
      (p) =>
        p.kind !== splitKind.value &&
        shownPhaseKinds.value.includes(p.kind) &&
        p.date >= tl.value.start &&
        p.date <= tl.value.end,
    )
    .map((p) => ({
      left: X(tl.value, p.date) + DAY_W / 2,
      color: PHASE_RULER[p.kind].color,
      pro: p.kind === 'pro',
    }));
});

function setRulerMode(mode: RulerMode) {
  if (state.rulerMode.value === mode) return;
  state.rulerMode.value = mode;
  state.toast(
    mode === 'month'
      ? '已临时切回月份标尺 · 团队的发布时间表配置不受影响'
      : '<span class="ok">✓</span> 已切回发布 Sprint 标尺',
  );
}

async function silentRefreshReleaseSheet() {
  const cfg = releaseCfg.value;
  if (!cfg || !state.editable.value || silentRefreshInFlight) return;
  if (!isReleaseSheetStale(cfg)) return;
  silentRefreshInFlight = true;
  try {
    const rows = await fetchReleaseSheetRows({
      spreadsheetId: cfg.spreadsheetId,
      sheetName: cfg.sheetName,
      range: cfg.range,
    });
    const next = buildReleaseSheetConfig({
      url: cfg.url,
      sheetName: cfg.sheetName,
      range: cfg.range,
      splitPhase: cfg.splitPhase,
      showPhases: cfg.showPhases,
      releaseFilter: cfg.releaseFilter,
      rows,
    });
    if (!next) return;
    await state.applySnapshotFromIntent({
      op: 'update_release_sheet',
      releaseSheet: next,
      silent: true,
    });
  } catch {
    /* keep cached rows; no toast on silent refresh */
  } finally {
    silentRefreshInFlight = false;
  }
}

watch(
  () => state.snapshot.value?.team.releaseSheet?.fetchedAt,
  () => {
    void silentRefreshReleaseSheet();
  },
  { immediate: true },
);

const expired = computed(() => state.expiredStats());
const cleanupCount = computed(
  () => expired.value.epics.length + expired.value.subs.length,
);
const draftCount = computed(
  () => state.draftItems().length + state.draftSubs().length,
);

const hasScheduledJiraEpics = computed(() =>
  state.scheduledItems.value.some((it) => Boolean(it.jiraKey)),
);
/**
 * 导入 Task 走扩展的 Options Jira token。无扩展时仍然显示，但呈锁定态并引导安装
 * —— 直接隐藏会让人以为功能不存在。
 */
const showImportTasks = computed(
  () => state.view.value === 'gantt' && hasScheduledJiraEpics.value,
);

const importTasksLoading = ref(false);

/** Debounce Target sync per item/sub (matches server 1.5s). */
const targetSyncTimers = new Map<string, number>();
/** Jira keys with a Target write still in flight (debounce + HTTP). */
const targetSyncInFlightKeys = new Set<string>();
const JIRA_REFRESH_TTL_MS = 10 * 60 * 1000;
let jiraRefreshTimer: number | null = null;
let jiraRefreshInFlight = false;

type TargetSyncRef = {
  itemKey?: string;
  subId?: string;
  jiraKey: string;
  start: string;
  days: number;
};

function targetTimerKey(ref: TargetSyncRef) {
  return ref.subId ? `sub:${ref.subId}` : `item:${ref.itemKey}`;
}

function scheduleTargetDateSync(ref: TargetSyncRef) {
  const timerKey = targetTimerKey(ref);
  const existing = targetSyncTimers.get(timerKey);
  if (existing) window.clearTimeout(existing);
  // Block silent refresh for this key until the write (and confirm) finish —
  // not only during the 1.5s debounce. Otherwise open-page refresh can fetch
  // the old Target, relocate the bar, and leave start_date/days stale while
  // Jira already has the new dates.
  if (ref.jiraKey) targetSyncInFlightKeys.add(ref.jiraKey);
  targetSyncTimers.set(
    timerKey,
    window.setTimeout(() => {
      targetSyncTimers.delete(timerKey);
      void runTargetDateSync(ref).finally(() => {
        targetSyncInFlightKeys.delete(ref.jiraKey);
      });
    }, 1500),
  );
}

function pendingTargetJiraKeys(): Set<string> {
  return new Set(targetSyncInFlightKeys);
}

function editingOrDraggingJiraKeys(): Set<string> {
  const out = new Set<string>();
  document.querySelectorAll('.g-row').forEach((row) => {
    const busy = row.querySelector('.dragging, .alias-editor, .task-editor');
    if (!busy) return;
    const itemKey = row.getAttribute('data-key');
    const item = state.scheduledItems.value.find((i) => i.key === itemKey);
    if (item?.jiraKey) out.add(item.jiraKey);
    const subEl = busy.closest('[data-sub-id]') || row.querySelector('.dragging[data-sub-id]');
    const subId = subEl?.getAttribute('data-sub-id');
    const sub = item?.subs.find((s) => s.id === subId);
    if (sub?.key) out.add(sub.key);
    else if (item) {
      for (const s of item.subs) if (s.key) out.add(s.key);
    }
  });
  return out;
}

/**
 * Prefer extension Options JIRA_API_TOKEN; fall back to server JIRA_PAT.
 * If neither is available, stay silent (no toast). Success gets a light toast.
 */
async function runTargetDateSync(ref: TargetSyncRef) {
  if (!state.teamId.value || !state.editable.value) return;
  const start = ref.start;
  const end = fmtISO(addD(parseDate(start), Math.max(1, ref.days) - 1));
  const viaExt = state.hasExtension.value;

  if (viaExt) {
    try {
      await bridgeUpdateTargetDates(ref.jiraKey, start, end);
      const confirmed = await state.api.syncTarget(
        state.teamId.value,
        ref.subId
          ? {
              subId: ref.subId,
              mode: 'confirm',
              start,
              end,
              jiraKey: ref.jiraKey,
            }
          : {
              itemKey: ref.itemKey!,
              mode: 'confirm',
              start,
              end,
              jiraKey: ref.jiraKey,
            },
      );
      if (confirmed.snapshot) state.commitSnapshot(confirmed.snapshot);
      state.toast(
        `<span class="ok">✓</span> 已回写 ${ref.jiraKey} Target ${start} → ${end}（经你的 Jira 账号）`,
        2600,
      );
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/jira_token_missing|扩展未接收|扩展响应超时/i.test(msg)) {
        // Hard Jira write failure: still try server fallback once.
      }
    }
  }

  try {
    await state.api.syncTarget(
      state.teamId.value,
      ref.subId
        ? { subId: ref.subId, mode: 'queue' }
        : { itemKey: ref.itemKey!, mode: 'queue' },
    );
    state.toast(
      `<span class="ok">✓</span> 已回写 ${ref.jiraKey} Target ${start} → ${end}`,
      2600,
    );
  } catch {
    // Silent when server PAT also missing / network fails.
  }
}

function collectRefreshKeys(): string[] {
  const blocked = new Set([
    ...pendingTargetJiraKeys(),
    ...editingOrDraggingJiraKeys(),
  ]);
  const itemKeys: string[] = [];
  const depKeys: string[] = [];
  for (const it of state.scheduledItems.value) {
    if (it.jiraKey && !blocked.has(it.jiraKey)) itemKeys.push(it.jiraKey);
    for (const s of it.subs) {
      if (s.cleared || !s.key || blocked.has(s.key)) continue;
      itemKeys.push(s.key);
    }
    for (const m of it.markers || []) {
      if (m.kind !== 'dep' || !m.jiraKey || blocked.has(m.jiraKey)) continue;
      depKeys.push(m.jiraKey);
    }
  }
  const primary = [...new Set(itemKeys)].slice(0, 50);
  const seen = new Set(primary);
  const extra = [...new Set(depKeys)].filter((k) => !seen.has(k)).slice(0, 25);
  return [...primary, ...extra];
}

async function silentRefreshFromJira() {
  if (!state.teamId.value || !state.editable.value || !state.hasExtension.value) return;
  if (jiraRefreshInFlight) return;
  const last = state.snapshot.value?.team.jiraRefreshedAt || 0;
  if (last && Date.now() - last < JIRA_REFRESH_TTL_MS) return;
  const keys = collectRefreshKeys();
  if (!keys.length) return;
  jiraRefreshInFlight = true;
  try {
    const issues = await bridgeRefreshJiraIssues(keys);
    if (!issues.length) return;
    await state.applySnapshotFromIntent({
      op: 'refresh_from_jira',
      issues: issues.map((issue) => ({
        key: issue.key,
        fetchedAt: issue.fetchedAt,
        fields: {
          summary: issue.summary,
          description: issue.description,
          targetStart: issue.targetStart,
          targetEnd: issue.targetEnd,
          assignee: issue.assignee,
          status: issue.status,
        },
      })),
    });
  } catch (err) {
    console.debug('[roadmap] silent jira refresh skipped', err);
  } finally {
    jiraRefreshInFlight = false;
  }
}

function scheduleSilentJiraRefresh() {
  if (jiraRefreshTimer) window.clearTimeout(jiraRefreshTimer);
  jiraRefreshTimer = window.setTimeout(() => {
    jiraRefreshTimer = null;
    void silentRefreshFromJira();
  }, 2000);
}

watch(
  () => [state.hasExtension.value, state.editable.value, state.snapshot.value?.team.id] as const,
  ([hasExt, editable, teamId]) => {
    if (hasExt && editable && teamId) scheduleSilentJiraRefresh();
  },
  { immediate: true },
);

watch(
  () => state.scheduledItems.value.length,
  () => {
    nextTick(() => {
      if (gScroll.value) {
        gScroll.value.scrollLeft = Math.max(0, X(tl.value, mStart) - 60);
      }
    });
  },
  { immediate: true },
);

function onCardDragStart(ev: Event) {
  const { event, item } = (ev as CustomEvent).detail as {
    event: PointerEvent;
    item: RoadmapItem;
  };
  if (!state.editable.value) return;
  cardDragStart(event, item);
}

function cardDragStart(e: PointerEvent, it: RoadmapItem) {
  const startX = e.clientX;
  const startY = e.clientY;
  let ghost: HTMLElement | null = null;
  const cardEl = e.currentTarget as HTMLElement;

  const onMove = (ev: PointerEvent) => {
    if (!ghost) {
      if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
      ghost = cardEl.cloneNode(true) as HTMLElement;
      ghost.className = 'card drag-ghost';
      document.body.appendChild(ghost);
      cardEl.style.opacity = '0.35';
      document.body.classList.add('no-select');
    }
    ghost.style.left = `${ev.clientX + 10}px`;
    ghost.style.top = `${ev.clientY + 8}px`;
    const gs = gScroll.value;
    const inner = gs?.querySelector('.g-inner') as HTMLElement | null;
    if (!gs || !inner) return;
    const sr = gs.getBoundingClientRect();
    if (
      ev.clientX > sr.left &&
      ev.clientX < sr.right &&
      ev.clientY > sr.top &&
      ev.clientY < sr.bottom
    ) {
      const hasTarget = hasTargetInTimeline(it, tl.value.start, tl.value.end);
      const day = hasTarget
        ? diffD(tl.value.start, it.targetStart!)
        : clamp(
            Math.round((ev.clientX - inner.getBoundingClientRect().left) / DAY_W),
            0,
            tl.value.days - 1,
          );
      dropVisible.value = true;
      dropLeft.value = day * DAY_W;
      const startHint = addD(tl.value.start, day);
      const daysHint = hasTarget
        ? targetDays(it)
        : Math.max(7, (it.estimate || 3) * 7);
      const endHint = addD(startHint, daysHint - 1);
      dropDate.value = `${hasTarget ? 'Target ' : ''}${fmtMD(startHint)}${catchReleaseHint(endHint, teamRel.value)}`;
      if (ev.clientX > sr.right - 60) gs.scrollLeft += 12;
      if (ev.clientX < sr.left + 60) gs.scrollLeft -= 12;
    } else {
      dropVisible.value = false;
    }
  };

  const onUp = async (ev: PointerEvent) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    cardEl.style.opacity = '';
    document.body.classList.remove('no-select');
    ghost?.remove();
    if (dropVisible.value && gBody.value) {
      const inner = gScroll.value?.querySelector('.g-inner') as HTMLElement;
      const hasTarget = hasTargetInTimeline(it, tl.value.start, tl.value.end);
      let start: Date;
      let days: number;
      if (hasTarget && it.targetStart) {
        start = parseDate(it.targetStart);
        days = targetDays(it);
      } else {
        const day = clamp(
          Math.round((ev.clientX - inner.getBoundingClientRect().left) / DAY_W),
          0,
          tl.value.days - 1,
        );
        start = addD(tl.value.start, day);
        days = Math.max(7, (it.estimate || 3) * 7);
      }
      if (diffD(start, tl.value.end) + 1 < days) {
        days = diffD(start, tl.value.end) + 1;
      }
      const rows = [...gBody.value.querySelectorAll('.g-row')];
      let lane = state.scheduledItems.value.length;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) {
          lane = i;
          break;
        }
      }
      try {
        await state.applySnapshotFromIntent(
          scheduleFromBacklog(it, start, days, lane),
        );
        state.enterKey.value = it.key;
        if (it.jiraKey) {
          scheduleTargetDateSync({
            itemKey: it.key,
            jiraKey: it.jiraKey,
            start: fmtISO(start),
            days,
          });
        }
        state.toast(
          hasTarget
            ? `<span class="ok">✓</span> ${it.key} 已按 Target 日期落位：${fmtMD(start)} → ${fmtMD(addD(start, days - 1))}`
            : `<span class="ok">✓</span> ${it.key} 已排期 ${fmtMD(start)} 起 · ${days}d`,
        );
      } catch {
        /* handled */
      }
    }
    dropVisible.value = false;
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

async function unscheduleItem(it: RoadmapItem) {
  if (!state.editable.value) return;
  await state.applySnapshotFromIntent({
    op: 'unschedule',
    itemKey: it.key,
    baseVersion: it.version,
  });
  state.popKeys.value = [it.key];
  state.toast(`${it.key} 已退回 Backlog`);
}

function setExpanded(it: RoadmapItem, open: boolean) {
  state.setItemExpanded(it.key, open);
}

async function onAddSub(it: RoadmapItem, intent: Record<string, unknown>) {
  const before = new Set(it.subs.map((s) => s.id));
  await state.applySnapshotFromIntent(intent);
  const fresh = state.scheduledItems.value.find((row) => row.key === it.key);
  const created = fresh?.subs.find((s) => !before.has(s.id));
  if (created) {
    state.newSubId.value = created.id;
    setTimeout(() => {
      if (state.newSubId.value === created.id) state.newSubId.value = null;
    }, 400);
  }
}

async function applyMarkerIntent(intent: Record<string, unknown>) {
  try {
    await state.applySnapshotFromIntent(intent);
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e.status === 409) {
      state.toast('内容已被他人修改，已刷新');
    }
    throw err;
  }
}

async function commitBar(
  it: RoadmapItem,
  sub: RoadmapSub | null,
  payload: { start: string; days: number; lane?: number; op?: string },
) {
  if (!state.editable.value) return;
  if (sub) {
    await state.applySnapshotFromIntent({
      op: 'update_sub',
      subId: sub.id,
      start: payload.start,
      days: payload.days,
      baseVersion: sub.version,
    });
    if (sub.key) {
      scheduleTargetDateSync({
        subId: sub.id,
        jiraKey: sub.key,
        start: payload.start,
        days: payload.days,
      });
    }
    return;
  }
  const op =
    payload.op ||
    (it.scheduled ? (payload.lane != null ? 'move' : 'resize') : 'schedule');
  await state.applySnapshotFromIntent({
    op,
    itemKey: it.key,
    start: payload.start,
    days: payload.days,
    lane: payload.lane,
    baseVersion: it.version,
  });
  if (it.jiraKey && (op === 'schedule' || op === 'move' || op === 'resize')) {
    scheduleTargetDateSync({
      itemKey: it.key,
      jiraKey: it.jiraKey,
      start: payload.start,
      days: payload.days,
    });
  }
}

async function onUpdateSub(intent: Record<string, unknown>) {
  const subId = String(intent.subId || '');
  const item = state.scheduledItems.value.find((row) =>
    row.subs.some((s) => s.id === subId),
  );
  const sub = item?.subs.find((s) => s.id === subId);
  const nextOwner =
    intent.owner === undefined ? undefined : (intent.owner as string | null);
  const ownerChanging =
    Boolean(sub) &&
    nextOwner !== undefined &&
    (nextOwner || null) !== (sub?.owner || null);
  const jiraKey = sub?.key || null;

  if (ownerChanging && jiraKey && nextOwner === null) {
    if (!window.confirm('清空 Owner 会同时从 Jira 去掉 assignee，确定吗？')) {
      return;
    }
  }

  await state.applySnapshotFromIntent(intent);

  if (!ownerChanging || !jiraKey) return;
  if (!state.hasExtension.value) {
    state.toast('未回写 assignee（需要 Personal AI 扩展）', 2600);
    return;
  }
  const map = teamAssigneeMap(state.snapshot.value);
  const mapped = nextOwner ? mapGet(map, nextOwner) : null;
  if (nextOwner && !mapped) {
    state.toast(`未回写 assignee（${nextOwner} 未映射）`, 2600);
    return;
  }
  const jiraUser = mapped ? jiraUsernameFromFull(mapped) : null;
  try {
    await bridgeUpdateAssignee(jiraKey, jiraUser);
    state.toast(
      jiraUser
        ? `<span class="ok">✓</span> 已回写 ${jiraKey} assignee → ${jiraUser}（经你的 Jira 账号）`
        : `<span class="ok">✓</span> 已回写 ${jiraKey} assignee（已清空，经你的 Jira 账号）`,
      2600,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    state.toast(`未回写 assignee：${msg}`, 3200);
  }
}

function openCleanup() {
  if (!state.editable.value) return;
  state.modals.value.cleanup = true;
}

function openAiCreate() {
  if (!state.hasExtension.value) {
    gate.openGate('createJira');
    return;
  }
  if (!state.editable.value) return;
  // Allow reopen while a run is in progress to inspect row status.
  state.modals.value.aiCreate = true;
}

async function onImportTasks() {
  if (!state.hasExtension.value) {
    gate.openGate('importTasks');
    return;
  }
  if (!state.editable.value || !state.teamId.value || importTasksLoading.value) {
    return;
  }
  if (!state.ensureActorName()) return;
  importTasksLoading.value = true;
  try {
    const epicKeys = state.scheduledItems.value
      .map((i) => i.jiraKey)
      .filter((k): k is string => Boolean(k));
    const linkField = state.snapshot.value?.team.jqlHints?.linkField || null;
    const tasks = await bridgeImportChildTasks(epicKeys, linkField);
    const result = await state.api.importTasks(state.teamId.value, tasks);
    state.commitSnapshot(result.snapshot);

    const parentsWithAdds = Object.entries(result.byEpic || {})
      .filter(([, v]) => v.added > 0)
      .map(([k]) => k);
    for (const jiraKey of parentsWithAdds) {
      const item = state.scheduledItems.value.find((i) => i.jiraKey === jiraKey);
      if (item) state.setItemExpanded(item.key, true);
    }

    if (result.added > 0) {
      state.toast(
        `<span class="ok">✓</span> 已导入 ${result.added} 个 Task（跳过 ${result.skipped} 个已存在）`,
      );
    } else {
      state.toast(`没有新的 Task 需要导入（${result.skipped} 个均已存在）`);
    }
  } catch (err: unknown) {
    const e = err as { status?: number; body?: { error?: string }; message?: string };
    const msg = e.message || e.body?.error || '';
    if (/jira_token_missing/i.test(msg)) {
      state.toast('请先在扩展 Options 配置 Jira Token');
    } else if (e.status === 403) {
      state.toast('需要编辑权限才能导入 Task');
    } else {
      state.toast(`导入失败：${msg || 'unknown'}`);
    }
  } finally {
    importTasksLoading.value = false;
  }
}

onMounted(() => {
  window.addEventListener('roadmap-card-drag-start', onCardDragStart);
});
onUnmounted(() => {
  window.removeEventListener('roadmap-card-drag-start', onCardDragStart);
  for (const timer of targetSyncTimers.values()) window.clearTimeout(timer);
  targetSyncTimers.clear();
  if (jiraRefreshTimer) window.clearTimeout(jiraRefreshTimer);
});
</script>

<template>
  <section class="gantt-panel">
    <div class="g-toolbar">
      <div class="view-switch">
        <button
          class="vs-btn"
          :class="{ active: state.view.value === 'gantt' }"
          @click="state.view.value = 'gantt'"
        >
          任务
        </button>
        <button
          class="vs-btn"
          :class="{ active: state.view.value === 'resource' }"
          @click="state.view.value = 'resource'"
        >
          人员
        </button>
      </div>

      <div
        v-show="showRulerSwitch"
        class="view-switch ruler-switch"
        :class="{ temp: state.rulerMode.value === 'month' }"
        data-tip="时间标尺||Sprint = 按发布时间表 · 月份 = 临时切回月份刻度||仅影响你自己的当前视图，不改团队配置，刷新即恢复"
      >
        <button
          class="vs-btn"
          :class="{ active: state.rulerMode.value === 'release' }"
          @click="setRulerMode('release')"
        >
          Sprint
        </button>
        <button
          class="vs-btn"
          :class="{ active: state.rulerMode.value === 'month' }"
          @click="setRulerMode('month')"
        >
          月份
        </button>
      </div>

      <div v-show="state.view.value === 'gantt' && !activeRel" class="legend">
        <span class="lg"><span class="dot past" />过去</span>
        <span class="lg"><span class="dot cur" />当前月</span>
        <span class="lg"><span class="dot fut" />未来</span>
        <span class="lg"><span class="dot draft" />草稿任务（未创建）</span>
      </div>

      <div
        v-show="state.view.value === 'gantt' && activeRel"
        class="legend rel-legend"
      >
        <span
          v-for="ph in phaseLegend"
          :key="ph.kind"
          class="lg"
          :data-tip="`${ph.full}${ph.isSplit ? ' · 当前 release 结束分割节点' : ''}`"
        >
          <span class="ph-sq" :style="{ background: ph.color }" />
          {{ ph.label }}{{ ph.isSplit ? ' 🏁' : '' }}
        </span>
        <span class="lg"><span class="dot draft" />草稿</span>
      </div>

      <div v-show="state.view.value === 'resource'" class="view-switch res-tools">
        <button
          class="vs-btn"
          :class="{ active: state.resWin.value === '2w' }"
          @click="state.resWin.value = '2w'"
        >
          近 2 周
        </button>
        <button
          class="vs-btn"
          :class="{ active: state.resWin.value === 'all' }"
          @click="state.resWin.value = 'all'"
        >
          全部
        </button>
      </div>

      <div class="g-spacer" />

      <button
        v-show="state.view.value === 'gantt' && cleanupCount"
        class="btn cleanup-btn"
        :disabled="!state.editable.value"
        data-tip="过期 = 结束日期早于今天。Epic 回退 Backlog（保留子任务记录），过期子任务从任务视图清理"
        @click="openCleanup"
      >
        <svg width="13" height="13" viewBox="0 0 14 14">
          <path
            d="M2.5 4h9M5.5 4V2.8a.8.8 0 01.8-.8h1.4a.8.8 0 01.8.8V4M4 4l.6 7.4a1 1 0 001 .9h2.8a1 1 0 001-.9L10 4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        清理过期
        <span class="cnt" style="background: rgba(154, 91, 0, 0.14)">{{ cleanupCount }}</span>
      </button>

      <button
        v-show="showImportTasks"
        class="btn btn-ghost import-tasks-btn"
        :class="{ locked: !state.hasExtension.value }"
        :disabled="!state.editable.value || importTasksLoading"
        :data-tip="
          state.hasExtension.value
            ? '从 Jira 拉取甘特上各 Epic 名下的 Task，按 Key 去重导入为子任务'
            : extensionLockTip('importTasks')
        "
        @click="onImportTasks"
      >
        <span v-if="importTasksLoading" class="mini-spin" />
        <svg v-else class="lock" width="12" height="13" viewBox="0 0 14 15">
          <rect
            x="2.4"
            y="6.2"
            width="9.2"
            height="7"
            rx="2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
          />
          <path
            d="M4.7 6.2V4.4a2.3 2.3 0 014.6 0v1.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
        {{ importTasksLoading ? '查询 Jira…' : '导入 Task' }}
      </button>

      <button
        v-show="state.view.value === 'gantt' && (draftCount || state.createJiraRunning.value)"
        class="btn btn-orange create-jira"
        :class="{
          busy: state.createJiraRunning.value,
          locked: !state.hasExtension.value,
        }"
        :disabled="!state.editable.value"
        :title="state.createJiraRunning.value ? '创建进行中…点击可查看进度' : undefined"
        :data-tip="!state.hasExtension.value ? extensionLockTip('createJira') : undefined"
        @click="openAiCreate"
      >
        <span
          v-if="state.createJiraRunning.value"
          class="mini-spin"
          style="border-top-color: #fff; border-color: rgba(255,255,255,.35)"
        />
        <svg class="lock" width="12" height="13" viewBox="0 0 14 15">
          <rect
            x="2.4"
            y="6.2"
            width="9.2"
            height="7"
            rx="2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
          />
          <path
            d="M4.7 6.2V4.4a2.3 2.3 0 014.6 0v1.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
        <svg v-if="!state.createJiraRunning.value" class="ico" width="13" height="13" viewBox="0 0 14 14">
          <path
            d="M7 2.5c1.5-1.8 4.5-1 4.5 1.5 0 1.8-2 2.5-3 4M7 11.5v.01M2.5 7H1M13 7h-1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
        {{ state.createJiraRunning.value ? '创建中…' : '创建 Jira' }}
        <span v-if="!state.createJiraRunning.value" class="cnt">{{ draftCount }}</span>
      </button>
    </div>

    <div
      v-show="state.view.value === 'gantt'"
      ref="gScroll"
      class="gantt-scroll"
      :class="{ 'rel-on': !!activeRel }"
    >
      <div class="g-inner" :style="{ width: `${tl.days * DAY_W}px` }">
        <div v-if="activeRel && splitKind" class="g-relruler">
          <div
            v-for="(sg, i) in visibleSegments"
            :key="`sg-${sg.rel.name}-${i}`"
            class="rel-band"
            :class="{ alt: i % 2 === 1, cur: sg.cur }"
            :style="{ left: `${sg.x0}px`, width: `${sg.x1 - sg.x0}px` }"
            :data-tip="sg.tip"
          >
            <span v-if="sg.x1 - sg.x0 >= 40" class="rel-name">{{ sg.rel.name }}</span>
          </div>
          <template v-for="tick in visibleTicks" :key="`tk-${tick.release}-${tick.kind}-${tick.px}`">
            <div
              class="rel-tick"
              :class="[`ph-${tick.kind}`, { past: tick.past }]"
              :style="{ left: `${tick.px}px`, background: tick.color }"
              :data-tip="tick.tip"
            />
            <span
              v-if="tick.proLabel"
              class="rel-pro-label"
              :class="{ past: tick.past, row2: tick.row2 }"
              :style="{ left: `${tick.px}px` }"
            >{{ tick.proLabel }}</span>
          </template>
        </div>
        <div class="g-header" :class="{ slim: !!activeRel }">
          <div
            v-for="mo in tl.months"
            :key="`${mo.y}-${mo.m}`"
            class="g-month"
            :class="{ cur: mo.cur }"
            :style="{ width: `${mo.days * DAY_W}px` }"
          >
            <span class="gm-l">{{ mo.y }}-{{ String(mo.m + 1).padStart(2, '0') }}</span>
            <span class="gm-q">{{ qOf(new Date(mo.y, mo.m, 1)) }}</span>
          </div>
        </div>
        <div ref="gBody" class="g-body">
          <div class="g-grid">
            <template v-for="(mo, mi) in tl.months" :key="`g-${mi}`">
              <div
                v-if="mo.cur"
                class="gl-curband"
                :style="{
                  left: `${monthOffsetDays[mi] * DAY_W}px`,
                  width: `${mo.days * DAY_W}px`,
                }"
              />
            </template>
            <div
              v-for="(mo, mi) in tl.months"
              :key="`m-${mi}`"
              class="gl-month"
              :style="{
                left: `${(monthOffsetDays[mi] + mo.days) * DAY_W}px`,
              }"
            />
            <template v-if="activeRel && splitKind">
              <div
                v-for="(line, i) in splitLines"
                :key="`spl-${i}`"
                class="gl-split"
                :style="{ left: `${line.left}px`, borderLeftColor: line.color }"
              />
              <div
                v-for="(line, i) in phaseLines"
                :key="`phl-${i}`"
                class="gl-phase"
                :class="{ pro: line.pro }"
                :style="{ left: `${line.left}px`, borderLeftColor: line.color }"
              />
            </template>
            <template v-else>
              <div
                v-for="d in Math.ceil(tl.days / 7)"
                :key="`w-${d}`"
                class="gl-week"
                :style="{
                  left: `${((8 - tl.start.getDay()) % 7 + (d - 1) * 7) * DAY_W}px`,
                }"
              />
            </template>
          </div>
          <div
            v-if="today >= tl.start && today <= tl.end"
            class="today-line"
            :style="{ left: `${X(tl, today) + DAY_W / 2}px` }"
          />
          <div v-if="!state.scheduledItems.value.length" class="g-empty">
            时间轴还是空的<br />把左侧 <b>Backlog</b> 的卡片拖进来开始排期
          </div>
          <GanttRow
            v-for="it in state.scheduledItems.value"
            :key="it.key"
            :item="it"
            :tl="tl"
            :team-id="state.teamId.value"
            :editable="state.editable.value"
            :enter="state.enterKey.value === it.key"
            :new-sub-id="state.newSubId.value"
            :persist-toggle="(open) => setExpanded(it, open)"
            :apply-marker-intent="applyMarkerIntent"
            @unschedule="unscheduleItem(it)"
            @commit="(p) => commitBar(it, p.sub, p)"
            @set-alias="(p) => state.applySnapshotFromIntent(p)"
            @add-sub="(p) => onAddSub(it, p)"
            @delete-sub="(p) => state.applySnapshotFromIntent(p)"
            @update-sub="(p) => onUpdateSub(p)"
          />
        </div>
        <div
          v-show="dropVisible"
          class="drop-line"
          :style="{ left: `${dropLeft}px`, display: 'block' }"
          :data-date="dropDate"
        />
      </div>
    </div>

    <ResourceView v-show="state.view.value === 'resource'" :tl="tl" />

    <div
      v-show="dragHint.show"
      class="drag-hint"
      :style="{ left: `${dragHint.x}px`, top: `${dragHint.y}px`, display: 'block' }"
    >
      {{ dragHint.text }}
    </div>
  </section>
</template>
