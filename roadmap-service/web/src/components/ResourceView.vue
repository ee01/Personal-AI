<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoadmapState } from '../composables/useRoadmapState';
import {
  addD,
  colorCls,
  diffD,
  esc,
  fmtMD,
  initials,
  today,
  type Timeline,
} from '../composables/useGeometry';
import type { RoadmapItem } from '../types';

const props = defineProps<{ tl: Timeline }>();
const state = useRoadmapState();
const addingMember = ref(false);
const newMemberName = ref('');

const allWin = computed(() => state.resWin.value === 'all');
const winS = computed(() => (allWin.value ? props.tl.start : today));
const winE = computed(() => (allWin.value ? props.tl.end : addD(today, 13)));
const days = computed(() => diffD(winS.value, winE.value) + 1);

function tasksOf(name: string | null) {
  const out: Array<{ s: RoadmapItem['subs'][number]; it: RoadmapItem }> = [];
  for (const it of state.scheduledItems.value) {
    for (const s of it.subs) {
      if ((s.owner || null) === name) out.push({ s, it });
    }
  }
  return out;
}

const rows = computed(() =>
  (state.snapshot.value?.members || []).map((m) => ({
    m,
    tasks: tasksOf(m.name),
    virtual: false,
  })),
);

const unassigned = computed(() => tasksOf(null));

function pct(d: Date | string) {
  return (diffD(winS.value, d) / days.value) * 100;
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
      v-if="!rows.length && !unassigned.length"
      class="res-empty-hint"
    >
      还没有成员数据<br />添加任务时指定 Owner，或在下方<b>添加成员</b>
    </div>

    <div
      v-for="{ m, tasks, virtual } in [...rows, ...(unassigned.length ? [{ m: null, tasks: unassigned, virtual: true }] : [])]"
      :key="virtual ? 'unassigned' : m!.id"
      class="res-row"
    >
      <div class="res-person">
        <span
          class="own-av"
          :style="{ background: virtual ? '#C6CDD4' : m!.avatarColor }"
        >
          {{ virtual ? '?' : initials(m!.name) }}
        </span>
        <div class="rp-info">
          <div class="rp-name">{{ virtual ? '未分配' : m!.name }}</div>
          <div v-if="tasks.length" class="rp-meta">
            {{ tasks.length }} 个任务 · 共 {{ tasks.reduce((a, t) => a + (t.s.days || 0), 0) }}d
          </div>
          <span v-else class="rp-idle">空闲</span>
        </div>
        <button
          v-if="!virtual && !tasks.length && state.editable.value"
          class="rp-del"
          @click="removeMember(m!.id)"
        >
          ×
        </button>
      </div>
      <div class="res-strip" :style="{ minHeight: '56px' }">
        <template
          v-for="({ s, it }, idx) in tasks"
          :key="idx"
        >
          <div
            v-if="s.start && s.days && addD(s.start, s.days - 1) >= winS && s.start <= winE"
            class="res-bar"
            :class="[
              s.temp ? 'draft' : colorCls(s.start, s.days),
              { 'clip-l': s.start < winS, 'clip-r': addD(s.start, s.days - 1) > winE },
            ]"
            :style="{
              left: `${pct(s.start < winS ? winS : s.start)}%`,
              width: `${((diffD(s.start < winS ? winS : s.start, addD(s.start, s.days - 1) > winE ? winE : addD(s.start, s.days - 1)) + 1) / days) * 100}%`,
              top: '8px',
            }"
            :data-tip="`${s.key || '草稿'} · ${it.key} · ${fmtMD(s.start)} → ${fmtMD(addD(s.start, s.days - 1))} · ${s.days}d||${s.title}||主任务：${it.alias || it.title}`"
          >
            <span class="rb-label">{{ esc(s.alias || s.title) }}</span>
          </div>
        </template>
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
