<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoadmapState } from '../../composables/useRoadmapState';
import {
  collectPeople,
  effectiveFullName,
  jiraUsernameFromFull,
  looksFullName,
  type AssigneeMap,
} from '../../composables/useAssigneeMap';
import { initials } from '../../composables/useGeometry';

const state = useRoadmapState();
const open = computed(() => state.modals.value.assigneeMap);
const draft = ref<AssigneeMap>({});
const saving = ref(false);

const people = computed(() =>
  collectPeople({
    currentUser: state.api.actorName.value || '',
    members: state.snapshot.value?.members || [],
    items: state.snapshot.value?.items || [],
  }),
);

watch(open, (isOpen) => {
  if (!isOpen) return;
  draft.value = { ...(state.snapshot.value?.team.assigneeMap || {}) };
  // Prefill names that already look like Firstname Lastname.
  for (const p of people.value) {
    const key = p.name.toLowerCase();
    if (!draft.value[key] && looksFullName(p.name)) {
      draft.value[key] = p.name.trim();
    }
  }
});

function sourceLabel(sources: Set<string>): string {
  return [...sources].join(' · ');
}

function previewUser(name: string): string {
  const full = effectiveFullName(draft.value, name);
  return full ? jiraUsernameFromFull(full) : '';
}

function wordHint(name: string): string {
  const val = draft.value[name.toLowerCase()] || '';
  if (!val.trim()) return '';
  return looksFullName(val) ? '' : '需要两个词';
}

function autoFill() {
  const next = { ...draft.value };
  for (const p of people.value) {
    const key = p.name.toLowerCase();
    if (!next[key] && looksFullName(p.name)) next[key] = p.name.trim();
  }
  draft.value = next;
}

function memberColor(name: string): string {
  return (
    state.snapshot.value?.members.find((m) => m.name === name)?.avatarColor ||
    '#8895A5'
  );
}

async function save() {
  if (saving.value || !state.editable.value) return;
  saving.value = true;
  try {
    const cleaned: AssigneeMap = {};
    for (const [k, v] of Object.entries(draft.value)) {
      const key = k.trim().toLowerCase();
      const val = String(v || '').trim();
      if (key && val) cleaned[key] = val;
    }
    await state.applySnapshotFromIntent({
      op: 'update_assignee_map',
      assigneeMap: cleaned,
    });
    state.modals.value.assigneeMap = false;
    state.toast('<span class="ok">✓</span> Assignee 映射已保存');
  } catch (err) {
    state.toast(err instanceof Error ? err.message : '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    class="modal-back"
    :class="{ show: open }"
    @click.self="state.modals.value.assigneeMap = false"
  >
    <div class="modal" style="width: 640px">
      <div class="m-head">
        <div class="m-title">Assignee 映射</div>
        <div class="m-sub">
          系统名（成员名 / 创建者用户名）→ Jira 实名
          <b>Firstname Lastname</b>。保存后全团队共享；直连 API 会转成
          <code>firstname.lastname</code> 填 assignee。
        </div>
      </div>
      <div class="m-body">
        <div class="am-toolbar">
          <button type="button" class="btn btn-ghost" @click="autoFill">
            ✦ 自动填充空缺
          </button>
          <span class="am-hint">两个词以上的系统名会自动推断</span>
        </div>
        <div class="am-list">
          <div v-for="p in people" :key="p.name.toLowerCase()" class="am-row">
            <span class="own-av" :style="{ background: memberColor(p.name) }">
              {{ initials(p.name) }}
            </span>
            <div class="am-name">
              <div class="n">{{ p.name }}</div>
              <div class="am-src">{{ sourceLabel(p.sources) }}</div>
            </div>
            <div class="am-field">
              <input
                class="am-input"
                :value="draft[p.name.toLowerCase()] || ''"
                placeholder="Firstname Lastname"
                @input="
                  draft[p.name.toLowerCase()] = (
                    $event.target as HTMLInputElement
                  ).value
                "
              />
              <div v-if="wordHint(p.name)" class="am-warn">{{ wordHint(p.name) }}</div>
            </div>
            <div class="am-user" :class="{ none: !previewUser(p.name) }">
              {{ previewUser(p.name) || '未映射' }}
            </div>
          </div>
        </div>
      </div>
      <div class="m-foot">
        <button
          type="button"
          class="btn btn-ghost"
          @click="state.modals.value.assigneeMap = false"
        >
          取消
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!state.editable.value || saving"
          @click="save"
        >
          {{ saving ? '保存中…' : '保存映射' }}
        </button>
      </div>
    </div>
  </div>
</template>
