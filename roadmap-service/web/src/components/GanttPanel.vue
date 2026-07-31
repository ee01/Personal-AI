<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoadmapState, scheduleFromBacklog, hasTargetInTimeline, targetDays } from '../composables/useRoadmapState';
import {
  X,
  DAY_W,
  computeTL,
  colorCls,
  fmtMD,
  fmtISO,
  addD,
  diffD,
  clamp,
  today,
  mStart,
  esc,
  initials,
  parseDate,
  qOf,
  type Timeline,
} from '../composables/useGeometry';
import type { RoadmapItem, RoadmapSub } from '../types';
import GanttRow from './GanttRow.vue';
import ResourceView from './ResourceView.vue';

const state = useRoadmapState();
const gScroll = ref<HTMLElement | null>(null);
const gBody = ref<HTMLElement | null>(null);
const dropVisible = ref(false);
const dropLeft = ref(0);
const dropDate = ref('');
const dragHint = ref({ show: false, x: 0, y: 0, text: '' });

const tl = computed<Timeline>(() =>
  computeTL(state.snapshot.value?.team.checkedQuarters || []),
);

const expired = computed(() => state.expiredStats());
const cleanupCount = computed(
  () => expired.value.epics.length + expired.value.subs.length,
);
const draftCount = computed(
  () => state.draftItems().length + state.draftSubs().length,
);

const extTitle = '需要 Personal AI 扩展';

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
      dropDate.value = `${hasTarget ? 'Target ' : ''}${fmtMD(addD(tl.value.start, day))}`;
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

async function toggleExpand(it: RoadmapItem) {
  if (!state.editable.value) return;
  await state.applySnapshotFromIntent({
    op: it.expanded ? 'collapse' : 'expand',
    itemKey: it.key,
    baseVersion: it.version,
  });
}

async function commitBar(
  it: RoadmapItem,
  sub: RoadmapSub | null,
  payload: { start: string; days: number; lane?: number; op?: string },
) {
  if (!state.editable.value) return;
  if (sub) {
    await state.applySnapshotFromIntent({ op: 'delete_sub', subId: sub.id });
    await state.applySnapshotFromIntent({
      op: 'add_sub',
      itemKey: it.key,
      title: sub.title,
      owner: sub.owner,
      start: payload.start,
      days: payload.days,
    });
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
}

function openCleanup() {
  if (!state.editable.value) return;
  state.modals.value.cleanup = true;
}

function openAiCreate() {
  if (!state.hasExtension.value || !state.editable.value) return;
  state.modals.value.aiCreate = true;
}

onMounted(() => {
  window.addEventListener('roadmap-card-drag-start', onCardDragStart);
});
onUnmounted(() => {
  window.removeEventListener('roadmap-card-drag-start', onCardDragStart);
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

      <div v-show="state.view.value === 'gantt'" class="legend">
        <span class="lg"><span class="dot past" />过去</span>
        <span class="lg"><span class="dot cur" />当前月</span>
        <span class="lg"><span class="dot fut" />未来</span>
        <span class="lg"><span class="dot draft" />草稿任务（未创建）</span>
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
        v-show="state.view.value === 'gantt' && draftCount"
        class="btn btn-orange create-jira"
        :disabled="!state.hasExtension.value || !state.editable.value"
        :title="!state.hasExtension.value ? extTitle : undefined"
        @click="openAiCreate"
      >
        <svg width="13" height="13" viewBox="0 0 14 14">
          <path
            d="M7 2.5c1.5-1.8 4.5-1 4.5 1.5 0 1.8-2 2.5-3 4M7 11.5v.01M2.5 7H1M13 7h-1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.4" />
        </svg>
        创建 Jira
        <span class="cnt">{{ draftCount }}</span>
      </button>
    </div>

    <div
      v-show="state.view.value === 'gantt'"
      ref="gScroll"
      class="gantt-scroll"
    >
      <div class="g-inner" :style="{ width: `${tl.days * DAY_W}px` }">
        <div class="g-header">
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
                  left: `${tl.months.slice(0, mi).reduce((a, m) => a + m.days, 0) * DAY_W}px`,
                  width: `${mo.days * DAY_W}px`,
                }"
              />
            </template>
            <div
              v-for="(mo, mi) in tl.months"
              :key="`m-${mi}`"
              class="gl-month"
              :style="{
                left: `${tl.months.slice(0, mi + 1).reduce((a, m) => a + m.days, 0) * DAY_W}px`,
              }"
            />
            <div
              v-for="d in Math.ceil(tl.days / 7)"
              :key="`w-${d}`"
              class="gl-week"
              :style="{
                left: `${((8 - tl.start.getDay()) % 7 + (d - 1) * 7) * DAY_W}px`,
              }"
            />
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
            @unschedule="unscheduleItem(it)"
            @toggle-expand="toggleExpand(it)"
            @commit="(p) => commitBar(it, p.sub, p)"
            @set-alias="(p) => state.applySnapshotFromIntent(p)"
            @add-sub="(p) => state.applySnapshotFromIntent(p)"
            @delete-sub="(p) => state.applySnapshotFromIntent(p)"
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
