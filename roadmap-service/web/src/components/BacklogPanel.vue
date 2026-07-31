<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRoadmapState } from '../composables/useRoadmapState';
import {
  canDeleteItem,
  formatEstimate,
  isDraftItem,
  itemDisplayKey,
  typeBadge,
} from '../composables/useRoadmapContract';
import { CURQ, fmtMD, qCmp } from '../composables/useGeometry';
import type { RoadmapItem } from '../types';

const state = useRoadmapState();
const searchQuery = ref('');

function itemMatchesQuery(item: RoadmapItem, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.title,
    item.key,
    item.jiraKey || '',
    item.alias || '',
    item.type || '',
    item.quarter || '',
    itemDisplayKey(item),
  ]
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

const filteredBacklog = computed(() =>
  state.backlogItems.value.filter((it) => itemMatchesQuery(it, searchQuery.value)),
);

const groups = computed(() => {
  const map = new Map<string, RoadmapItem[]>();
  for (const it of filteredBacklog.value) {
    const q = it.quarter || '—';
    if (!map.has(q)) map.set(q, []);
    map.get(q)!.push(it);
  }
  return [...map.entries()].sort(([a], [b]) => qCmp(a, b));
});

const imported = computed(
  () => (state.snapshot.value?.team.importedQuarters.length || 0) > 0,
);

const quarterOptions = computed(() => {
  const checked = state.snapshot.value?.team.checkedQuarters || [];
  return checked.includes(CURQ) ? checked : [CURQ, ...checked];
});

const addOpen = ref(false);
const saving = ref(false);
const form = ref({
  title: '',
  type: '',
  quarter: CURQ,
  estimate: '' as string,
  targetStart: '',
  targetEnd: '',
});

function openAdd() {
  if (!state.editable.value) return;
  form.value = {
    title: '',
    type: state.jqlHints.value.itemType || '',
    quarter: state.focusQuarter.value || CURQ,
    estimate: '',
    targetStart: '',
    targetEnd: '',
  };
  addOpen.value = true;
  nextTick(() => {
    (document.querySelector('.add-item-modal input') as HTMLInputElement)?.focus();
  });
}

async function submitAdd() {
  const title = form.value.title.trim();
  if (!title || saving.value) return;
  const estimate = Number(form.value.estimate);
  saving.value = true;
  try {
    await state.applySnapshotFromIntent({
      op: 'add_item',
      title,
      type: form.value.type.trim() || undefined,
      quarter: form.value.quarter || undefined,
      estimate: Number.isFinite(estimate) && estimate > 0 ? estimate : undefined,
      targetStart: form.value.targetStart || undefined,
      targetEnd: form.value.targetEnd || undefined,
    });
    addOpen.value = false;
    state.toast(`<span class="ok">✓</span> 已新建条目 <b>${title}</b>`);
  } catch {
    /* toast handled centrally */
  } finally {
    saving.value = false;
  }
}

async function removeItem(item: RoadmapItem) {
  if (!state.editable.value || !canDeleteItem(item)) return;
  try {
    await state.applySnapshotFromIntent({ op: 'delete_item', itemKey: item.key });
    state.toast(`已删除条目 ${item.title}`);
  } catch {
    /* toast handled centrally */
  }
}

function onCardPointerDown(e: PointerEvent, item: RoadmapItem) {
  if (!state.editable.value) return;
  if ((e.target as HTMLElement).closest('.card-del')) return;
  window.dispatchEvent(
    new CustomEvent('roadmap-card-drag-start', {
      detail: { event: e, item },
    }),
  );
}

function clearSearch() {
  searchQuery.value = '';
}
</script>

<template>
  <aside class="backlog">
    <div class="bl-head">
      <div class="bl-title">
        Backlog
        <span class="bl-count">
          <template v-if="searchQuery.trim()">
            {{ filteredBacklog.length }}/{{ state.backlogItems.value.length }}
          </template>
          <template v-else>
            {{ state.backlogItems.value.length }}
          </template>
        </span>
        <button
          v-if="state.editable.value"
          class="bl-add"
          data-tip="手动新建一个 Backlog 条目（不需要 Jira）"
          @click="openAdd"
        >
          <svg width="11" height="11" viewBox="0 0 14 14">
            <path
              d="M7 2.5v9M2.5 7h9"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
          新建条目
        </button>
      </div>
      <div class="bl-search">
        <svg class="bl-search-ico" width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6" />
          <path
            d="M9.2 9.2L12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
        <input
          v-model="searchQuery"
          class="bl-search-input"
          type="search"
          placeholder="搜索标题 / Key / 备注…"
          spellcheck="false"
          @keydown.esc="clearSearch"
        />
        <button
          v-if="searchQuery"
          class="bl-search-clear"
          type="button"
          data-tip="清空搜索"
          @click="clearSearch"
        >
          ×
        </button>
      </div>
    </div>
    <div class="bl-body">
      <template v-if="filteredBacklog.length">
        <template v-for="[q, items] in groups" :key="q">
          <div class="bl-group-label">{{ q }}</div>
          <div
            v-for="it in items"
            :key="it.key"
            class="card"
            :class="{ pop: state.popKeys.value.includes(it.key), draft: isDraftItem(it) }"
            :data-tip="`${itemDisplayKey(it)} · 预估 ${formatEstimate(it.estimate)}${it.targetStart ? '' : ' · 无 Target 日期'}||${it.title}||拖到右侧时间轴排期${it.targetStart ? '（按 Target 日期落位）' : ''}`"
            :data-pai-item="it.key"
            :data-pai-team="state.teamId.value"
            :data-pai-target-start="it.targetStart || ''"
            :data-pai-target-end="it.targetEnd || ''"
            @pointerdown="onCardPointerDown($event, it)"
          >
            <div class="card-top">
              <span class="type-badge" :class="typeBadge(it.type).cls">
                {{ typeBadge(it.type).label }}
              </span>
              <span class="card-key">{{ itemDisplayKey(it) }}</span>
              <span v-if="isDraftItem(it)" class="card-draft">DRAFT</span>
              <span class="card-est">{{ formatEstimate(it.estimate) }}</span>
            </div>
            <div class="card-title">{{ it.title }}</div>
            <span v-if="it.targetStart" class="card-target">
              Target {{ fmtMD(it.targetStart) }} → {{ fmtMD(it.targetEnd!) }}
            </span>
            <span
              v-if="it.subs.length"
              class="card-subs"
              :style="{ marginLeft: it.targetStart ? '' : '0' }"
            >
              ↺ {{ it.subs.length }} 个子任务记录
            </span>
            <button
              v-if="state.editable.value && canDeleteItem(it)"
              class="card-del"
              data-tip="删除该手动条目"
              @pointerdown.stop
              @click.stop="removeItem(it)"
            >
              ×
            </button>
          </div>
        </template>
      </template>
      <div v-else-if="searchQuery.trim() && state.backlogItems.value.length" class="bl-empty">
        没有匹配「{{ searchQuery.trim() }}」的条目<br />
        <button class="bl-empty-link" type="button" @click="clearSearch">清除搜索</button>
      </div>
      <div v-else class="bl-empty">
        <template v-if="imported">
          Backlog 已清空<br />所有 issue 均已排期 🎉
        </template>
        <template v-else>
          尚未导入数据<br />请在上方勾选 Quarter 后点击<br /><b>「导入」</b>
        </template>
      </div>
      <div id="pai-memory-candidates" />
    </div>
  </aside>

  <div
    class="modal-back"
    :class="{ show: addOpen }"
    @click.self="!saving && (addOpen = false)"
  >
    <div class="modal add-item-modal">
      <div class="m-head">
        <div class="m-title">新建 Backlog 条目</div>
        <div class="m-sub">
          手动条目不需要 Jira，排期后会以 DRAFT 状态参与规划；之后可在时间轴上一键创建为 Jira issue。
        </div>
      </div>
      <div class="m-body">
        <label class="f-label">标题 <span class="req">*</span></label>
        <input
          v-model="form.title"
          class="f-input"
          placeholder="例如：Nova 26.4 权限模型重构"
          :disabled="saving"
          @keydown.enter="submitAdd"
          @keydown.esc="addOpen = false"
        />
        <div class="f-grid">
          <div>
            <label class="f-label">类型</label>
            <input
              v-model="form.type"
              class="f-input"
              :placeholder="state.jqlHints.value.itemType || 'Epic'"
              :disabled="saving"
            />
          </div>
          <div>
            <label class="f-label">Quarter</label>
            <select v-model="form.quarter" class="f-input" :disabled="saving">
              <option value="">不指定</option>
              <option v-for="q in quarterOptions" :key="q" :value="q">{{ q }}</option>
            </select>
          </div>
        </div>
        <div class="f-grid">
          <div>
            <label class="f-label">预估（周）</label>
            <input
              v-model="form.estimate"
              class="f-input"
              type="number"
              min="1"
              placeholder="可留空"
              :disabled="saving"
            />
          </div>
          <div>
            <label class="f-label">Target 开始</label>
            <input v-model="form.targetStart" class="f-input" type="date" :disabled="saving" />
          </div>
          <div>
            <label class="f-label">Target 结束</label>
            <input v-model="form.targetEnd" class="f-input" type="date" :disabled="saving" />
          </div>
        </div>
      </div>
      <div class="m-foot">
        <button class="btn btn-ghost" :disabled="saving" @click="addOpen = false">取消</button>
        <button
          class="btn btn-primary"
          :disabled="saving || !form.title.trim()"
          @click="submitAdd"
        >
          创建条目
        </button>
      </div>
    </div>
  </div>
</template>
