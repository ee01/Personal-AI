<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
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
  type Timeline,
} from '../composables/useGeometry';
import type { RoadmapItem, RoadmapSub } from '../types';
import { useRoadmapState } from '../composables/useRoadmapState';
import { isDraftItem, itemDisplayKey } from '../composables/useRoadmapContract';

const props = defineProps<{
  item: RoadmapItem;
  tl: Timeline;
  teamId: string;
  editable: boolean;
  enter?: boolean;
  newSubId?: string | null;
}>();

const emit = defineEmits<{
  unschedule: [];
  toggleExpand: [];
  commit: [payload: { start: string; days: number; lane?: number; op?: string; sub: RoadmapSub | null }];
  setAlias: [intent: Record<string, unknown>];
  addSub: [intent: Record<string, unknown>];
  deleteSub: [intent: Record<string, unknown>];
}>();

const state = useRoadmapState();
const rowRef = ref<HTMLElement | null>(null);
const editorOpen = ref(false);
const editorOwner = ref<string | null>(null);
const editorTitle = ref('');
const aliasOpen = ref(false);
const aliasTarget = ref<{ sub?: RoadmapSub }>({});
const aliasValue = ref('');

const disp = computed(() => props.item.alias || props.item.title);
const isDraft = computed(() => isDraftItem(props.item));
const dispKey = computed(() => itemDisplayKey(props.item));
const wrapMode = computed(() => Boolean(props.item.alias));
const barW = computed(() => (props.item.days || 0) * DAY_W - 2);
const labelIn = computed(() => wrapMode.value || barW.value >= 110);
const nSubs = computed(() => props.item.subs.length);

const memberColor = (name: string | null | undefined) =>
  state.snapshot.value?.members.find((m) => m.name === name)?.avatarColor || '#8895A5';

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
  // Click vs double-click must outlive this pointer session — same as demo's
  // `barEl._ct`. A local `clickTimer` resets on every pointerdown, so the
  // second click of a double-click always looked like a fresh single click
  // (expand/collapse flicker, never open the alias editor).
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
      hint.textContent = `${fmtMD(live.start)} → ${fmtMD(addD(live.start, live.days - 1))} · ${live.days}d`;
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
          if (!sub) emit('toggleExpand');
        }, 230);
      }
      return;
    }

    let lane: number | undefined;
    if (!sub && mode === 'move' && Math.abs(ev.clientY - orig.y) > 30 && rowRef.value) {
      const rows = [...document.querySelectorAll('.g-row')].filter((r) => r !== rowRef.value);
      const others = state.scheduledItems.value.filter((i) => i.key !== props.item.key);
      lane = others.length;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) {
          lane = i;
          break;
        }
      }
    }

    emit('commit', {
      start: fmtISO(live.start),
      days: live.days,
      lane,
      op: sub ? undefined : props.item.scheduled ? (lane != null ? 'move' : mode === 'move' ? 'move' : 'resize') : 'schedule',
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
  aliasOpen.value = true;
}

async function saveAlias() {
  const sub = aliasTarget.value.sub;
  const intent = sub
    ? {
        op: 'set_alias',
        subId: sub.id,
        alias: aliasValue.value.trim() || null,
        baseVersion: sub.version,
      }
    : {
        op: 'set_alias',
        itemKey: props.item.key,
        alias: aliasValue.value.trim() || null,
        baseVersion: props.item.version,
      };
  emit('setAlias', intent);
  aliasOpen.value = false;
}

function showEditor() {
  editorOpen.value = true;
  editorTitle.value = '';
  editorOwner.value = null;
  nextTick(() => {
    (document.querySelector('.task-editor input') as HTMLInputElement)?.focus();
  });
}

async function submitSub() {
  if (!editorTitle.value.trim()) {
    editorOpen.value = false;
    return;
  }
  emit('addSub', {
    op: 'add_sub',
    itemKey: props.item.key,
    title: editorTitle.value.trim(),
    owner: editorOwner.value,
    start: props.item.start,
    days: 14,
  });
  editorOpen.value = false;
}

onMounted(() => {
  nextTick(() => {
    const bar = rowRef.value?.querySelector('.bar.free-h') as HTMLElement | null;
    if (bar?.parentElement) {
      bar.parentElement.style.height = `${bar.offsetHeight + 18}px`;
    }
  });
});
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
        :data-tip="`${dispKey} · ${item.start ? fmtMD(item.start) : ''} → ${item.start && item.days ? fmtMD(addD(item.start, item.days - 1)) : ''} · ${item.days}d${isDraft ? ' · 未创建 Jira' : ''}||${item.title}||单击展开 · 双击改备注名 · 拖动/两端拉伸排期`"
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
        <span v-if="nSubs" class="sub-badge">
          <svg
            class="chev"
            :class="{ up: item.expanded }"
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
        @click.stop="emit('toggleExpand'); showEditor()"
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
    </div>

    <div
      v-if="item.expanded"
      class="g-subs"
      :style="{ '--guide-x': `${barLeft() + 4}px` }"
    >
      <div v-for="s in item.subs" :key="s.id" class="sub-lane">
        <div
          class="sbar"
          :class="[
            s.temp ? 'draft' : s.start && s.days ? colorCls(s.start, s.days) : '',
            { 'free-h': !!s.alias },
          ]"
          :style="{
            left: `${s.start ? X(tl, s.start) : 0}px`,
            width: `${(s.days || 0) * DAY_W - 2}px`,
          }"
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
            <input
              v-model="editorTitle"
              placeholder="任务标题，Enter 创建…"
              @keydown.enter="submitSub"
              @keydown.esc="editorOpen = false"
            />
          </div>
          <span class="te-hint">Enter 创建 · Esc 取消</span>
        </div>
      </div>
      <div v-else-if="editable" class="add-lane">
        <button class="add-ghost" :style="{ left: `${barLeft()}px` }" @click="showEditor">
          <svg width="11" height="11" viewBox="0 0 14 14">
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
    >
      <input v-model="aliasValue" placeholder="输入备注名（显示名），留空恢复原名" @keydown.enter="saveAlias" @keydown.esc="aliasOpen = false" />
      <button class="ae-ai" type="button" @click="aliasValue = (item.alias || item.title).slice(0, 32)">✦ AI 缩写</button>
      <span class="ae-hint">Enter 保存 · Esc 取消</span>
    </div>
  </div>
</template>
