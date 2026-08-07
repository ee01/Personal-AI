<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import {
  X,
  DAY_W,
  colorCls,
  fmtMD,
  fmtISO,
  addD,
  diffD,
  clamp,
  esc,
  initials,
  fitLanes,
  type Timeline,
} from '../composables/useGeometry';
import { memberChipHtml, openOwnerFloat } from '../composables/useOwnerFloat';
import type { RoadmapItem, RoadmapSub, TeamMember } from '../types';
import { useRoadmapState } from '../composables/useRoadmapState';
import { isDraftItem, itemDisplayKey, pendingDepCount, trackMarkers, phaseColor, phaseGlyph } from '../composables/useRoadmapContract';
import {
  isMarkerDone,
  linkIconHtml,
  markerDragStart,
  openDepPopover,
  openMarkerMenu,
  type MarkerHandlers,
} from '../composables/useMarkerFloats';
import { bridgeFetchIssueDates } from '../composables/useExtensionBridge';
import {
  catchReleaseHint,
  catchReleaseTooltipLine,
  relParsed,
  type ReleaseSheetConfig,
} from '../composables/useReleaseRuler';

const props = defineProps<{
  item: RoadmapItem;
  tl: Timeline;
  teamId: string;
  editable: boolean;
  enter?: boolean;
  newSubId?: string | null;
  /** Persist expand/collapse to local viewer state + URL (not multi-user sync). */
  persistToggle?: (open: boolean) => void | Promise<void>;
  applyMarkerIntent?: (intent: Record<string, unknown>) => Promise<void>;
}>();

const emit = defineEmits<{
  unschedule: [];
  toggleExpand: [open: boolean];
  commit: [payload: { start: string; days: number; lane?: number; op?: string; sub: RoadmapSub | null }];
  setAlias: [intent: Record<string, unknown>];
  addSub: [intent: Record<string, unknown>];
  deleteSub: [intent: Record<string, unknown>];
  updateSub: [intent: Record<string, unknown>];
  addMarker: [intent: Record<string, unknown>];
  updateMarker: [intent: Record<string, unknown>];
  deleteMarker: [intent: Record<string, unknown>];
}>();

const state = useRoadmapState();
const rowRef = ref<HTMLElement | null>(null);
const subsRef = ref<HTMLElement | null>(null);
/** Local open state so collapse can animate before `item.expanded` flips. */
const subsOpen = ref(props.item.expanded);
const opening = ref(false);
const closing = ref(false);
const chevOpen = ref(props.item.expanded);
let expandAnimLock = false;

const editorOpen = ref(false);
const editorOwner = ref<TeamMember | null>(null);
const editorTitle = ref('');
const editorPopOpen = ref(false);
const editorPopList = ref<TeamMember[]>([]);
const editorPopIdx = ref(0);
const editorPopQuery = ref<string | null>(null);
const editorInputRef = ref<HTMLInputElement | null>(null);

const aliasOpen = ref(false);
const aliasTarget = ref<{ sub?: RoadmapSub }>({});
const aliasValue = ref('');
const aliasOwner = ref<TeamMember | null>(null);
const aliasOwnerDirty = ref(false);

const disp = computed(() => props.item.alias || props.item.title);
const isDraft = computed(() => isDraftItem(props.item));
const dispKey = computed(() => itemDisplayKey(props.item));
const wrapMode = computed(() => Boolean(props.item.alias));
const barW = computed(() => (props.item.days || 0) * DAY_W - 2);
const labelIn = computed(() => wrapMode.value || barW.value >= 110);
const visibleSubs = computed(() => props.item.subs.filter((s) => !s.cleared));
const nSubs = computed(() => visibleSubs.value.length);
const markers = computed(() => props.item.markers || []);
const onTrack = computed(() => trackMarkers(props.item));
const depCount = computed(() => markers.value.filter((m) => m.kind === 'dep').length);
const pendingDeps = computed(() => pendingDepCount(props.item));

const members = computed(() => state.snapshot.value?.members || []);

const teamRelParsed = computed(() => {
  const cfg = state.snapshot.value?.team.releaseSheet as
    | ReleaseSheetConfig
    | null
    | undefined;
  if (!cfg?.rows?.length) return null;
  return relParsed(cfg);
});

function barCatchTip(start: string | null | undefined, days: number | null | undefined) {
  if (!start || !days || !teamRelParsed.value) return '';
  const line = catchReleaseTooltipLine(addD(start, days - 1), teamRelParsed.value);
  return line ? ` · ${line}` : '';
}

function markerHandlers(): MarkerHandlers {
  return {
    editable: props.editable,
    hasExtension: state.hasExtension.value,
    toast: (html) => state.toast(html),
    addMarker: async (intent) => {
      if (props.applyMarkerIntent) await props.applyMarkerIntent(intent);
      else emit('addMarker', intent);
    },
    updateMarker: async (intent) => {
      if (props.applyMarkerIntent) await props.applyMarkerIntent(intent);
      else emit('updateMarker', intent);
    },
    deleteMarker: async (intent) => {
      if (props.applyMarkerIntent) await props.applyMarkerIntent(intent);
      else emit('deleteMarker', intent);
    },
    fetchIssueDates: state.hasExtension.value
      ? (jiraKey) => bridgeFetchIssueDates(jiraKey)
      : undefined,
  };
}

const memberColor = (name: string | null | undefined) =>
  members.value.find((m) => m.name === name)?.avatarColor || '#8895A5';

function findMember(name: string | null | undefined): TeamMember | null {
  if (!name) return null;
  return members.value.find((m) => m.name === name) || {
    id: '',
    name,
    avatarColor: '#8895A5',
  };
}

function barLeft() {
  return props.item.start ? X(props.tl, props.item.start) : 0;
}

function barDragStart(
  e: PointerEvent,
  sub: RoadmapSub | null,
  barEl: HTMLElement,
) {
  if (!props.editable || e.button !== 0) return;
  if ((e.target as HTMLElement).closest('.bar-x, .bar-plus')) return;
  e.preventDefault();

  const target = sub || props.item;
  const mode = (e.target as HTMLElement).classList.contains('hdl')
    ? (e.target as HTMLElement).classList.contains('l')
      ? 'l'
      : 'r'
    : 'move';
  const orig = {
    start: parseDate(target.start!),
    days: target.days!,
    x: e.clientX,
    y: e.clientY,
  };
  let moved = false;
  let scrolled = 0;
  const gs = barEl.closest('.gantt-scroll') as HTMLElement;
  type BarWithClickTimer = HTMLElement & {
    _ct?: ReturnType<typeof setTimeout> | null;
  };
  const barWithTimer = barEl as BarWithClickTimer;

  const live = { start: orig.start, days: orig.days };
  const hint = document.querySelector('.drag-hint') as HTMLElement;

  try {
    barEl.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  barEl.classList.add('drag-transform');
  barEl.classList.remove('anim');

  const applyVisual = () => {
    barEl.style.left = `${X(props.tl, live.start)}px`;
    barEl.style.width = `${live.days * DAY_W - 2}px`;
    if (barEl.classList.contains('free-h') && barEl.parentElement) {
      barEl.parentElement.style.height = `${barEl.offsetHeight + (sub ? 14 : 18)}px`;
    }
  };

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - orig.x;
    const dy = ev.clientY - orig.y;
    if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    moved = true;
    barEl.classList.add('dragging');
    document.body.classList.add('no-select');

    if (gs) {
      const sr = gs.getBoundingClientRect();
      if (ev.clientX > sr.right - 50) {
        gs.scrollLeft += 14;
        scrolled += 14;
      } else if (ev.clientX < sr.left + 50) {
        const before = gs.scrollLeft;
        gs.scrollLeft = Math.max(0, before - 14);
        scrolled -= before - gs.scrollLeft;
      }
    }

    const dd = Math.round((dx + scrolled) / DAY_W);
    if (mode === 'move') {
      live.start = addD(
        orig.start,
        clamp(
          dd,
          diffD(orig.start, props.tl.start),
          diffD(addD(orig.start, orig.days - 1), props.tl.end),
        ),
      );
      if (!sub) barEl.style.transform = `translateY(${dy}px)`;
    } else if (mode === 'r') {
      live.days = clamp(orig.days + dd, 2, diffD(orig.start, props.tl.end) + 1);
    } else {
      const nd = clamp(orig.days - dd, 2, orig.days + diffD(props.tl.start, orig.start));
      live.start = addD(orig.start, orig.days - nd);
      live.days = nd;
    }
    applyVisual();
    if (hint) {
      hint.style.display = 'block';
      hint.style.left = `${ev.clientX + 14}px`;
      hint.style.top = `${ev.clientY - 34}px`;
      hint.textContent =
        `${fmtMD(live.start)} → ${fmtMD(addD(live.start, live.days - 1))} · ${live.days}d` +
        catchReleaseHint(addD(live.start, live.days - 1), teamRelParsed.value);
    }
  };

  const onUp = async (ev: PointerEvent) => {
    try {
      barEl.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    barEl.removeEventListener('pointermove', onMove);
    barEl.removeEventListener('pointerup', onUp);
    if (hint) hint.style.display = 'none';
    document.body.classList.remove('no-select');
    barEl.classList.remove('dragging', 'drag-transform');
    barEl.style.transform = '';

    if (!moved) {
      if (barWithTimer._ct) {
        clearTimeout(barWithTimer._ct);
        barWithTimer._ct = null;
        openAlias(sub);
      } else {
        barWithTimer._ct = setTimeout(() => {
          barWithTimer._ct = null;
          if (!sub) void requestToggleExpand();
        }, 230);
      }
      return;
    }

    let lane: number | undefined;
    if (!sub && mode === 'move' && Math.abs(ev.clientY - orig.y) > 30 && rowRef.value) {
      const rowEls = [...document.querySelectorAll('.g-row')].filter(
        (r) => r !== rowRef.value,
      );
      const others = state.scheduledItems.value.filter(
        (i) => i.key !== props.item.key,
      );
      let insertAt = others.length;
      for (let i = 0; i < rowEls.length; i++) {
        const r = rowEls[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) {
          const key = (rowEls[i] as HTMLElement).dataset.key || '';
          const idx = others.findIndex((o) => o.key === key);
          insertAt = idx >= 0 ? idx : i;
          break;
        }
      }
      lane = insertAt;
    }

    emit('commit', {
      start: fmtISO(live.start),
      days: live.days,
      lane,
      op: sub
        ? undefined
        : props.item.scheduled
          ? lane != null
            ? 'move'
            : mode === 'move'
              ? 'move'
              : 'resize'
          : 'schedule',
      sub,
    });
  };

  barEl.addEventListener('pointermove', onMove);
  barEl.addEventListener('pointerup', onUp);
}

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function openAlias(sub: RoadmapSub | null) {
  aliasTarget.value = { sub: sub || undefined };
  aliasValue.value = (sub || props.item).alias || '';
  aliasOwner.value = sub ? findMember(sub.owner) : null;
  aliasOwnerDirty.value = false;
  aliasOpen.value = true;
  nextTick(() => {
    const inp = rowRef.value?.querySelector('.alias-editor input') as HTMLInputElement | null;
    inp?.focus();
    inp?.select();
  });
}

async function saveAlias() {
  const sub = aliasTarget.value.sub;
  if (sub) {
    const intent: Record<string, unknown> = {
      op: 'update_sub',
      subId: sub.id,
      alias: aliasValue.value.trim() || null,
      baseVersion: sub.version,
    };
    if (aliasOwnerDirty.value) {
      intent.owner = aliasOwner.value?.name || null;
    }
    emit('updateSub', intent);
  } else {
    emit('setAlias', {
      op: 'set_alias',
      itemKey: props.item.key,
      alias: aliasValue.value.trim() || null,
      baseVersion: props.item.version,
    });
  }
  aliasOpen.value = false;
}

function cancelAlias() {
  aliasOpen.value = false;
  if (aliasOwnerDirty.value && aliasTarget.value.sub) {
    // Owner was changed live via float — persist even if Esc on alias.
    const sub = aliasTarget.value.sub;
    emit('updateSub', {
      op: 'update_sub',
      subId: sub.id,
      owner: aliasOwner.value?.name || null,
      baseVersion: sub.version,
    });
  }
}

function openAliasOwnerPop(chip: HTMLElement) {
  openOwnerFloat(
    chip,
    members.value,
    aliasOwner.value?.name,
    (m) => {
      aliasOwner.value = m;
      aliasOwnerDirty.value = true;
      const inp = rowRef.value?.querySelector('.alias-editor input') as HTMLInputElement | null;
      inp?.focus();
    },
    { allowClear: true },
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runExpand(after?: () => void) {
  if (subsOpen.value || closing.value) {
    after?.();
    return;
  }
  expandAnimLock = true;
  opening.value = true;
  chevOpen.value = true;
  subsOpen.value = true;
  await nextTick();
  if (rowRef.value) fitLanes(rowRef.value);
  const el = subsRef.value;
  if (el) {
    const h = el.scrollHeight;
    el.style.height = '0px';
    el.getBoundingClientRect();
    el.style.height = `${h}px`;
    await sleep(340);
    el.style.height = '';
  }
  opening.value = false;
  expandAnimLock = false;
  after?.();
}

async function runCollapse() {
  if (!subsOpen.value || opening.value) return;
  expandAnimLock = true;
  closing.value = true;
  chevOpen.value = false;
  const el = subsRef.value;
  if (el) {
    el.style.height = `${el.offsetHeight}px`;
    el.getBoundingClientRect();
    el.style.height = '0px';
    await sleep(300);
  }
  subsOpen.value = false;
  closing.value = false;
  if (el) el.style.height = '';
  expandAnimLock = false;
}

async function persistToggle(open: boolean) {
  if (props.persistToggle) await props.persistToggle(open);
  else emit('toggleExpand', open);
}

/** Demo-parity expand/collapse: height slide + staggered subIn, then persist locally. */
async function requestToggleExpand() {
  if (subsOpen.value) {
    await runCollapse();
    try {
      await persistToggle(false);
    } catch {
      await runExpand();
    }
  } else {
    try {
      await runExpand();
      await persistToggle(true);
    } catch {
      await runCollapse();
    }
  }
}

async function expandThenEdit() {
  if (!props.editable) return;
  if (subsOpen.value) {
    showEditor();
    return;
  }
  try {
    await runExpand(() => showEditor());
    await persistToggle(true);
  } catch {
    await runCollapse();
  }
}

function showEditor() {
  editorOpen.value = true;
  editorTitle.value = '';
  editorOwner.value = null;
  editorPopOpen.value = false;
  editorPopQuery.value = null;
  nextTick(() => editorInputRef.value?.focus());
}

// Local expand overlay: animate when this viewer's expandedKeys change
// (URL restore / setItemExpanded). Other users' actions never flip this.
watch(
  () => props.item.expanded,
  (next) => {
    if (expandAnimLock) return;
    if (next && !subsOpen.value) void runExpand();
    else if (!next && subsOpen.value) void runCollapse();
  },
);

watch(
  () => props.item.key,
  () => {
    subsOpen.value = props.item.expanded;
    chevOpen.value = props.item.expanded;
    opening.value = false;
    closing.value = false;
  },
);

function selectEditorOwner(m: TeamMember) {
  editorOwner.value = m;
  editorTitle.value =
    editorTitle.value.replace(/@[^@]*$/, '').trimEnd() +
    (editorTitle.value.match(/@[^@]*$/) ? ' ' : '');
  closeEditorPop();
  editorInputRef.value?.focus();
}

function openEditorPop(q: string) {
  editorPopQuery.value = q;
  editorPopIdx.value = 0;
  editorPopList.value = members.value.filter((o) =>
    o.name.toLowerCase().includes((q || '').toLowerCase()),
  );
  editorPopOpen.value = true;
}

function closeEditorPop() {
  editorPopOpen.value = false;
  editorPopQuery.value = null;
}

function onEditorInput() {
  const m = editorTitle.value.match(/@([^@]*)$/);
  if (m) openEditorPop(m[1]);
  else closeEditorPop();
}

function onEditorKeydown(e: KeyboardEvent) {
  if (editorPopOpen.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (editorPopList.value.length) {
        editorPopIdx.value = (editorPopIdx.value + 1) % editorPopList.value.length;
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (editorPopList.value.length) {
        editorPopIdx.value =
          (editorPopIdx.value - 1 + editorPopList.value.length) %
          editorPopList.value.length;
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editorPopList.value.length) {
        selectEditorOwner(editorPopList.value[editorPopIdx.value]);
      } else if (editorPopQuery.value?.trim()) {
        const name = editorPopQuery.value.trim();
        selectEditorOwner({ id: '', name, avatarColor: '#8895A5' });
      } else {
        closeEditorPop();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeEditorPop();
      return;
    }
  }
  if (e.key === 'Escape') {
    editorOpen.value = false;
    return;
  }
  if (e.key === 'Enter' && editorTitle.value.trim()) {
    e.preventDefault();
    submitSub();
  }
}

function openEditorOwnerChip(chip: HTMLElement) {
  closeEditorPop();
  openOwnerFloat(
    chip,
    members.value,
    editorOwner.value?.name,
    (m) => {
      editorOwner.value = m;
      editorInputRef.value?.focus();
    },
    { allowClear: true },
  );
}

async function submitSub() {
  const title = editorTitle.value.trim();
  if (!title) {
    editorOpen.value = false;
    return;
  }
  emit('addSub', {
    op: 'add_sub',
    itemKey: props.item.key,
    title,
    owner: editorOwner.value?.name || null,
    start: props.item.start,
    days: 14,
  });
  editorOpen.value = false;
}

function suggestAlias() {
  const target = aliasTarget.value.sub || props.item;
  const t = target.title.split(/[:：]/)[0].trim();
  aliasValue.value = t.length > 34 ? `${t.slice(0, 32)}…` : t;
}

onMounted(() => {
  nextTick(() => {
    if (rowRef.value) fitLanes(rowRef.value);
  });
});

watch(
  () => [props.item.alias, onTrack.value.length, props.item.days, wrapMode.value] as const,
  () => nextTick(() => {
    if (rowRef.value) fitLanes(rowRef.value);
  }),
);
</script>

<template>
  <div ref="rowRef" class="g-row" :data-key="item.key">
    <div class="g-lane">
      <div
        class="bar"
        :class="[
          item.start && item.days ? colorCls(item.start, item.days) : '',
          { 'free-h': wrapMode, enter: enter, draft: isDraft },
        ]"
        :style="{ left: `${barLeft()}px`, width: `${barW}px` }"
        :data-tip="`${dispKey} · ${item.start ? fmtMD(item.start) : ''} → ${item.start && item.days ? fmtMD(addD(item.start, item.days - 1)) : ''} · ${item.days}d${isDraft ? ' · 未创建 Jira' : ''}||${item.title}||单击展开 · 双击改备注名 · 拖动/两端拉伸排期${barCatchTip(item.start, item.days)}`"
        :data-pai-item="item.key"
        :data-pai-team="teamId"
        :data-pai-target-start="item.targetStart || ''"
        :data-pai-target-end="item.targetEnd || ''"
        @pointerdown="barDragStart($event, null, $event.currentTarget as HTMLElement)"
      >
        <div v-if="wrapMode" class="wrap-label">{{ esc(disp) }}</div>
        <span v-else-if="labelIn" class="in-label">{{ esc(disp) }}</span>
        <span v-else class="out-label">{{ disp }}</span>
        <span v-if="isDraft" class="draft-tag">DRAFT</span>
        <span v-if="depCount || nSubs" class="badge-cluster">
          <span
            v-if="depCount"
            class="dep-badge"
            :class="{ pending: pendingDeps > 0 }"
            :data-tip="
              (pendingDeps
                ? `${depCount} 个外部依赖 · 有依赖缺少交付时间 ETA`
                : `${depCount} 个外部依赖`) + '||点击查看 / 添加外部依赖'
            "
            @pointerdown.stop
            @click.stop="openDepPopover($event.currentTarget as HTMLElement, item, markerHandlers())"
            v-html="linkIconHtml(8) + depCount"
          />
          <span v-if="nSubs" class="sub-badge">
            <svg
              class="chev"
              :class="{ up: chevOpen }"
              width="8"
              height="8"
              viewBox="0 0 10 10"
            >
              <path
                d="M2 3.5l3 3 3-3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ nSubs }}
          </span>
        </span>
        <div class="hdl l" />
        <div class="hdl r" />
        <div class="pai-overlay-slot" />
        <button
          v-if="editable"
          class="bar-x"
          data-tip="退回 Backlog"
          @pointerdown.stop
          @click.stop="emit('unschedule')"
        >
          ×
        </button>
      </div>
      <button
        v-if="editable"
        class="bar-plus"
        :style="{ left: `${Math.max(2, barLeft() - 33)}px` }"
        data-tip="添加任务"
        @pointerdown.stop
        @click.stop="expandThenEdit"
      >
        <svg viewBox="0 0 14 14" width="13" height="13">
          <path
            d="M7 2.5v9M2.5 7h9"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <button
        v-if="editable"
        class="marker-plus"
        :style="{ left: `${barLeft() + barW + 18}px` }"
        data-tip="添加阶段节点 / 外部依赖"
        @pointerdown.stop
        @click.stop="openMarkerMenu($event.currentTarget as HTMLElement, item, markerHandlers())"
      >
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
          <path d="M3.2 12.5V2M3.2 2.5h6.8l-1.9 2.6L10 7.5H3.2" />
        </svg>
      </button>
      <div v-if="onTrack.length" class="marker-track">
        <button
          v-for="m in onTrack"
          :key="m.id"
          type="button"
          class="marker"
          :class="[{ done: isMarkerDone(m.date), dep: m.kind === 'dep' }]"
          :style="{
            left: `${X(tl, m.date!) + DAY_W / 2}px`,
            background: m.kind === 'dep' ? '#7C8794' : phaseColor(m),
          }"
          :data-tip="
            m.kind === 'phase'
              ? `${m.label} · ${fmtMD(m.date!)}${isMarkerDone(m.date) ? ' · 已完成' : ' · 待完成'}||阶段节点||左右拖动改期 · 单击编辑或删除`
              : `外部依赖 ETA ${fmtMD(m.date!)}${m.jiraKey ? ` · ${m.jiraKey}` : ' · 手动填写'}||${m.label}||左右拖动改 ETA · 单击查看该依赖`
          "
          @pointerdown="
            markerDragStart($event, {
              marker: m,
              item,
              tl,
              handlers: markerHandlers(),
            })
          "
        >
          <span v-if="m.kind === 'phase'" class="m-glyph">{{ phaseGlyph(m) }}</span>
          <span v-else class="m-glyph" v-html="linkIconHtml(9)" />
        </button>
      </div>
    </div>

    <div
      v-if="subsOpen"
      ref="subsRef"
      class="g-subs"
      :class="{ opening, closing }"
      :style="{ '--guide-x': `${barLeft() + 4}px` }"
    >
      <div v-for="(s, si) in visibleSubs" :key="s.id" class="sub-lane">
        <div
          class="sbar"
          :class="[
            s.temp ? 'draft' : s.start && s.days ? colorCls(s.start, s.days) : '',
            { 'free-h': !!s.alias },
          ]"
          :style="{
            left: `${s.start ? X(tl, s.start) : 0}px`,
            width: `${(s.days || 0) * DAY_W - 2}px`,
            animationDelay: opening ? `${si * 45}ms` : undefined,
            animation:
              !opening && s.id === newSubId
                ? 'subIn .34s cubic-bezier(.22,1,.36,1) backwards'
                : undefined,
          }"
          :data-tip="`${s.key || '草稿'} · ${s.start ? fmtMD(s.start) : ''} → ${s.start && s.days ? fmtMD(addD(s.start, s.days - 1)) : ''} · ${s.days}d${s.owner ? ` · ${s.owner}` : ''}||${s.title}||双击改备注名/Owner · 拖动/两端拉伸${barCatchTip(s.start, s.days)}`"
          @pointerdown="barDragStart($event, s, $event.currentTarget as HTMLElement)"
        >
          <div v-if="s.alias" class="wrap-label">{{ esc(s.alias) }}</div>
          <span v-else class="in-label">
            <span v-if="s.key" style="font-family: var(--mono); font-size: 9.5px; opacity: 0.75">{{ s.key }}</span>
            {{ s.key ? ' · ' : '' }}{{ esc(s.title) }}
          </span>
          <span v-if="s.temp" class="draft-tag">DRAFT{{ s.createdBy ? ` · ${s.createdBy}` : '' }}</span>
          <span
            v-if="s.owner"
            class="own-av sbar-owner"
            :style="{ background: memberColor(s.owner) }"
          >
            {{ initials(s.owner) }}
          </span>
          <div class="hdl l" />
          <div class="hdl r" />
          <button
            v-if="editable && s.temp"
            class="bar-x"
            @pointerdown.stop
            @click.stop="emit('deleteSub', { op: 'delete_sub', subId: s.id })"
          >
            ×
          </button>
        </div>
      </div>
      <div v-if="editorOpen" class="add-lane">
        <div class="task-editor" :style="{ left: `${barLeft()}px` }">
          <div class="te-box">
            <button
              class="te-owner"
              type="button"
              :data-tip="
                editorOwner
                  ? `Owner：${editorOwner.name}（点击更换）`
                  : 'Owner（可选）：点选或在标题里输入 @'
              "
              @pointerdown.prevent
              @click="openEditorOwnerChip($event.currentTarget as HTMLElement)"
              v-html="memberChipHtml(editorOwner)"
            />
            <input
              ref="editorInputRef"
              v-model="editorTitle"
              placeholder="任务标题，@ 可指定 Owner，Enter 创建…"
              @input="onEditorInput"
              @keydown="onEditorKeydown"
            />
            <div class="owner-pop" :class="{ show: editorPopOpen }">
              <template v-if="editorPopList.length">
                <div
                  v-for="(o, i) in editorPopList"
                  :key="o.id || o.name"
                  class="owner-item"
                  :class="{ act: i === editorPopIdx }"
                  @pointerdown.prevent.stop="selectEditorOwner(o)"
                >
                  <span class="own-av" :style="{ background: o.avatarColor }">{{ initials(o.name) }}</span>
                  {{ o.name }}
                </div>
              </template>
              <div v-else class="owner-none">
                无匹配成员 —— Enter 将「{{ editorPopQuery || '' }}」作为自定义 Owner
              </div>
            </div>
          </div>
          <span class="te-hint">Enter 创建 · Esc 取消</span>
        </div>
      </div>
      <div v-else-if="editable" class="add-lane">
        <button
          class="add-ghost"
          :style="{
            left: `${barLeft()}px`,
            animationDelay: opening ? `${visibleSubs.length * 45}ms` : undefined,
          }"
          @click="showEditor"
        >          <svg width="11" height="11" viewBox="0 0 14 14">
            <path
              d="M7 2.5v9M2.5 7h9"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
          添加任务
        </button>
      </div>
    </div>

    <div
      v-if="aliasOpen"
      class="alias-editor"
      :style="{ left: `${barLeft()}px`, top: '4px' }"
      @pointerdown.stop
    >
      <button
        v-if="aliasTarget.sub"
        class="te-owner ae-owner"
        type="button"
        :data-tip="
          aliasOwner ? `Owner：${aliasOwner.name}（点击更换）` : '设置 Owner'
        "
        @pointerdown.prevent.stop
        @click="openAliasOwnerPop($event.currentTarget as HTMLElement)"
        v-html="memberChipHtml(aliasOwner)"
      />
      <input
        v-model="aliasValue"
        placeholder="输入备注名（显示名），留空恢复原名"
        @keydown.enter="saveAlias"
        @keydown.esc="cancelAlias"
      />
      <button class="ae-ai" type="button" @click="suggestAlias">✦ AI 缩写</button>
      <span class="ae-hint">Enter 保存 · Esc 取消</span>
    </div>
  </div>
</template>
