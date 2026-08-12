<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRoadmapState } from '../composables/useRoadmapState';
import {
  addD,
  colorCls,
  diffD,
  esc,
  fmtMD,
  initials,
  parseDate,
  today,
  type Timeline,
} from '../composables/useGeometry';
import type { RoadmapItem, RoadmapSub, TeamMember } from '../types';
import { dispName, teamAssigneeMap } from '../composables/useAssigneeMap';

const props = defineProps<{ tl: Timeline }>();
const state = useRoadmapState();
const assigneeMap = computed(() => teamAssigneeMap(state.snapshot.value));
function showName(name: string | null | undefined) {
  return dispName(assigneeMap.value, name);
}
const addingMember = ref(false);
const newMemberName = ref('');
const renamingId = ref<string | null>(null);
const renameValue = ref('');

const allWin = computed(() => state.resWin.value === 'all');
const winS = computed(() => (allWin.value ? props.tl.start : today));
const winE = computed(() => (allWin.value ? props.tl.end : addD(today, 13)));
const days = computed(() => diffD(winS.value, winE.value) + 1);

type TaskPair = { s: RoadmapSub; it: RoadmapItem };

function tasksOf(name: string | null): TaskPair[] {
  const out: TaskPair[] = [];
  for (const it of state.scheduledItems.value) {
    for (const s of it.subs) {
      if (s.cleared) continue;
      if ((s.owner || null) === name) out.push({ s, it });
    }
  }
  return out;
}

/** Simple greedy lane packing so overlapping bars don't stack on one row. */
function placeLanes(tasks: TaskPair[]) {
  const laneEndMs: number[] = [];
  const placed = tasks
    .filter(({ s }) => s.start && s.days)
    .map(({ s, it }) => {
      const end = addD(s.start!, (s.days || 1) - 1);
      const startMs = parseDate(s.start!).getTime();
      const endMs = end.getTime();
      let li = laneEndMs.findIndex((prevEnd) => prevEnd < startMs);
      if (li < 0) {
        li = laneEndMs.length;
        laneEndMs.push(endMs);
      } else {
        laneEndMs[li] = endMs;
      }
      return { s, it, end, li };
    });
  return {
    placed,
    stripH: Math.max(56, laneEndMs.length * 27 + 16),
    laneCount: laneEndMs.length,
  };
}

const rows = computed(() =>
  (state.snapshot.value?.members || []).map((m) => {
    const tasks = tasksOf(m.name);
    return { m, tasks, virtual: false as const, ...placeLanes(tasks) };
  }),
);

const unassigned = computed(() => {
  const tasks = tasksOf(null);
  return { m: null, tasks, virtual: true as const, ...placeLanes(tasks) };
});

function pct(d: Date | string) {
  return (diffD(winS.value, d) / days.value) * 100;
}

function overflowCounts(placed: ReturnType<typeof placeLanes>['placed']) {
  let before = 0;
  let after = 0;
  for (const { s, end } of placed) {
    if (end < winS.value) before += 1;
    else if (s.start! > winE.value) after += 1;
  }
  return { before, after };
}

function inWindow(s: RoadmapSub, end: Date | string) {
  return end >= winS.value && s.start! <= winE.value;
}

async function removeMember(id: string) {
  if (!state.editable.value) return;
  await state.applySnapshotFromIntent({ op: 'remove_member', memberId: id });
  state.toast('成员已移除');
}

async function addMember() {
  if (!newMemberName.value.trim() || !state.editable.value) return;
  await state.applySnapshotFromIntent({
    op: 'add_member',
    name: newMemberName.value.trim(),
  });
  state.toast(`成员「${esc(newMemberName.value.trim())}」已加入团队`);
  addingMember.value = false;
  newMemberName.value = '';
}

function startRename(m: TeamMember) {
  if (!state.editable.value) return;
  renamingId.value = m.id;
  renameValue.value = m.name;
  nextTick(() => {
    const inp = document.querySelector('.rp-name-edit') as HTMLInputElement | null;
    inp?.focus();
    inp?.select();
  });
}

async function commitRename(m: TeamMember) {
  const name = renameValue.value.trim();
  renamingId.value = null;
  if (!name || name === m.name) return;
  try {
    await state.applySnapshotFromIntent({
      op: 'update_member',
      memberId: m.id,
      name,
    });
    state.toast(`成员已改名为「${esc(name)}」`);
  } catch {
    /* toast from apply */
  }
}
</script>

<template>
  <div class="res-view">
    <div class="res-head">
      <div class="res-corner">
        成员 / 任务 {{ allWin ? '（全部时间轴）' : '（今天起 14 天）' }}
      </div>
      <div class="res-days">
        <template v-if="allWin">
          <div
            v-for="mo in tl.months"
            :key="`${mo.y}-${mo.m}`"
            class="res-day"
            :class="{ today: mo.cur }"
            :style="{ flex: mo.days }"
          >
            <b>{{ mo.y }}-{{ String(mo.m + 1).padStart(2, '0') }}</b>
          </div>
        </template>
        <template v-else>
          <div
            v-for="i in days"
            :key="i"
            class="res-day"
            :class="{
              today: diffD(addD(winS, i - 1), today) === 0,
              wkd: addD(winS, i - 1).getDay() % 6 === 0,
            }"
          >
            <b>{{ addD(winS, i - 1).getDate() }}</b>
            {{ ['日', '一', '二', '三', '四', '五', '六'][addD(winS, i - 1).getDay()] }}
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="!rows.length && !unassigned.tasks.length"
      class="res-empty-hint"
    >
      还没有成员数据<br />添加任务时指定 Owner，或在下方<b>添加成员</b>
    </div>

    <div
      v-for="row in [...rows, ...(unassigned.tasks.length ? [unassigned] : [])]"
      :key="row.virtual ? 'unassigned' : row.m!.id"
      class="res-row"
    >
      <div class="res-person">
        <span
          class="own-av"
          :style="{ background: row.virtual ? '#C6CDD4' : row.m!.avatarColor }"
        >
          {{ row.virtual ? '?' : initials(row.m!.name) }}
        </span>
        <div class="rp-info">
          <input
            v-if="!row.virtual && renamingId === row.m!.id"
            v-model="renameValue"
            class="rp-name-edit"
            @keydown.enter="commitRename(row.m!)"
            @keydown.esc="renamingId = null"
            @blur="commitRename(row.m!)"
          />
          <div
            v-else
            class="rp-name"
            :data-tip="row.virtual ? undefined : '双击修改名字'"
            @dblclick="!row.virtual && startRename(row.m!)"
          >
            {{ row.virtual ? '未分配' : showName(row.m!.name) }}
          </div>
          <div v-if="row.tasks.length" class="rp-meta">
            {{ row.tasks.length }} 个任务 · 共 {{ row.tasks.reduce((a, t) => a + (t.s.days || 0), 0) }}d
          </div>
          <span v-else class="rp-idle">空闲</span>
        </div>
        <button
          v-if="!row.virtual && !row.tasks.length && state.editable.value"
          class="rp-del"
          @click="removeMember(row.m!.id)"
        >
          ×
        </button>
      </div>
      <div class="res-strip" :style="{ minHeight: `${row.stripH}px` }">
        <template v-for="({ s, it, end, li }) in row.placed" :key="s.id">
          <div
            v-if="inWindow(s, end)"
            class="res-bar"
            :class="[
              s.temp ? 'draft' : colorCls(s.start!, s.days!),
              {
                'clip-l': s.start! < winS,
                'clip-r': end > winE,
              },
            ]"
            :style="{
              left: `${pct(s.start! < winS ? winS : s.start!)}%`,
              width: `${((diffD(s.start! < winS ? winS : s.start!, end > winE ? winE : end) + 1) / days) * 100}%`,
              top: `${8 + li * 27}px`,
            }"
            :data-tip="`${s.key || '草稿'} · ${it.key} · ${fmtMD(s.start!)} → ${fmtMD(end)} · ${s.days}d||${s.title}||主任务：${it.alias || it.title}`"
          >
            <span class="rb-label">{{ esc(s.alias || s.title) }}</span>
          </div>
        </template>
        <span
          v-if="overflowCounts(row.placed).before"
          class="res-chip"
          style="left: 6px"
        >
          ◂ {{ overflowCounts(row.placed).before }} 更早
        </span>
        <span
          v-if="overflowCounts(row.placed).after"
          class="res-chip"
          style="right: 6px"
        >
          {{ overflowCounts(row.placed).after }} 更晚 ▸
        </span>
      </div>
    </div>

    <div v-if="state.editable.value" class="res-add">
      <button v-if="!addingMember" class="add-ghost" @click="addingMember = true">
        ＋ 添加成员
      </button>
      <input
        v-else
        v-model="newMemberName"
        placeholder="成员姓名，Enter 添加…"
        @keydown.enter="addMember"
        @keydown.esc="addingMember = false"
      />
    </div>
  </div>
</template>
