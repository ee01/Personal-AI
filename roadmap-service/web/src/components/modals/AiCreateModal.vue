<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoadmapState } from '../../composables/useRoadmapState';
import {
  buildCreateJiraPayload,
  buildDraftGroups,
  isDraftItem,
  itemDisplayKey,
  subTypeComesFromCreateMeta,
  typeBadge,
  type DraftGroup,
} from '../../composables/useRoadmapContract';
import { bridgeCreateJira } from '../../composables/useExtensionBridge';

type RowStatus =
  | { kind: 'pending' }
  | { kind: 'loading' }
  | { kind: 'ok'; jiraKey: string }
  | { kind: 'error'; message: string };

const state = useRoadmapState();
const running = ref(false);
const rowStatus = ref<Record<string, RowStatus>>({});

const projectKey = ref('');
const itemType = ref('');
const subType = ref('');

/**
 * Rows are frozen for the duration of a run: resolving a child immediately
 * drops it out of the live draft list, and a row that vanishes takes its
 * "created as NOVA-123" status with it.
 */
const frozenGroups = ref<DraftGroup[] | null>(null);
const groups = computed(
  () => frozenGroups.value ?? buildDraftGroups(state.scheduledItems.value),
);
const totalRows = computed(() =>
  groups.value.reduce(
    (n, g) => n + (isDraftItem(g.item) ? 1 : 0) + g.subs.length,
    0,
  ),
);
const needsSubType = computed(() => groups.value.some((g) => g.subs.length > 0));
const needsParent = computed(() => groups.value.some((g) => isDraftItem(g.item)));

/**
 * `confident` only covers the issue type, so an unparsed project key has to be
 * reported separately. Neither blocks the dialog — the fields above are
 * editable exactly so the user can fill in what the JQL did not say.
 */
const hintWarning = computed(() => {
  const hints = state.jqlHints.value;
  const missing: string[] = [];
  if (!hints.confident) missing.push('issue 类型');
  if (!hints.projectKey) missing.push('project');
  return missing.length ? `未能从 JQL 识别${missing.join(' 与 ')}，请手动填写` : '';
});

/** Task-level parents take a sub-task whose name only Jira knows — see the helper. */
const subTypeAuto = computed(() => subTypeComesFromCreateMeta(itemType.value));

const blockReason = computed(() => {
  if (!state.hasExtension.value) return '需要 Personal AI 扩展';
  if (!state.editable.value) return '当前为只读模式';
  if (!projectKey.value.trim()) return '请填写 Project Key';
  if (needsParent.value && !itemType.value.trim()) return '请填写主任务类型';
  if (needsSubType.value && !subType.value.trim() && !subTypeAuto.value) {
    return '请填写子任务类型';
  }
  return '';
});

function itemRowId(key: string) {
  return `item:${key}`;
}
function subRowId(id: string) {
  return `sub:${id}`;
}

function statusOf(id: string): RowStatus {
  return rowStatus.value[id] || { kind: 'pending' };
}

function kindOf(id: string): RowStatus['kind'] {
  return statusOf(id).kind;
}

function okKey(id: string): string {
  const status = statusOf(id);
  return status.kind === 'ok' ? status.jiraKey : '';
}

function errorOf(id: string): string {
  const status = statusOf(id);
  return status.kind === 'error' ? status.message : '';
}

watch(
  () => state.modals.value.aiCreate,
  (open) => {
    if (!open) return;
    const hints = state.jqlHints.value;
    rowStatus.value = {};
    frozenGroups.value = null;
    running.value = false;
    projectKey.value = hints.projectKey || '';
    itemType.value = hints.itemType || '';
    subType.value = hints.subType || '';
  },
);

async function start() {
  if (blockReason.value || running.value) return;
  frozenGroups.value = groups.value;
  running.value = true;
  const teamId = state.teamId.value;
  const token = state.api.getShareToken(teamId) || null;
  let created = 0;
  let failed = 0;

  for (const group of groups.value) {
    const parentId = itemRowId(group.item.key);
    const parentIsDraft = isDraftItem(group.item);
    if (parentIsDraft) rowStatus.value[parentId] = { kind: 'loading' };
    for (const sub of group.subs) {
      rowStatus.value[subRowId(sub.id)] = { kind: 'loading' };
    }

    try {
      const result = await bridgeCreateJira(
        buildCreateJiraPayload(group, {
          teamId,
          token,
          projectKey: projectKey.value.trim(),
          issueType: itemType.value.trim(),
          subType: subType.value.trim(),
        }),
      );

      if (parentIsDraft) {
        const parent = result.parent;
        if (parent?.jiraKey) {
          rowStatus.value[parentId] = { kind: 'ok', jiraKey: parent.jiraKey };
          created += 1;
        } else {
          rowStatus.value[parentId] = {
            kind: 'error',
            message: parent?.error || '未返回 Jira key',
          };
          failed += 1;
        }
      }

      const mappings: Array<{ draftId: string; jiraKey: string }> = [];
      for (const sub of group.subs) {
        const row = result.children.find((c) => c.draftId === sub.id);
        if (row?.jiraKey) {
          rowStatus.value[subRowId(sub.id)] = { kind: 'ok', jiraKey: row.jiraKey };
          mappings.push({ draftId: sub.id, jiraKey: row.jiraKey });
          created += 1;
        } else {
          rowStatus.value[subRowId(sub.id)] = {
            kind: 'error',
            message: row?.error || '未创建',
          };
          failed += 1;
        }
      }
      // The extension resolves the parent key itself; sub keys are ours to write back.
      if (mappings.length) {
        await state.applySnapshotFromIntent({ op: 'resolve_draft', mappings }).catch(
          () => undefined,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '创建 Jira 失败';
      if (parentIsDraft) rowStatus.value[parentId] = { kind: 'error', message };
      for (const sub of group.subs) {
        rowStatus.value[subRowId(sub.id)] = { kind: 'error', message };
      }
      failed += group.subs.length + (parentIsDraft ? 1 : 0);
    }
  }

  // The parent resolve happened server-side, so pull the authoritative rows back.
  try {
    if (teamId) state.snapshot.value = await state.api.fetchTeam(teamId);
  } catch {
    /* SSE will catch up */
  }

  running.value = false;
  if (created) state.toast(`<span class="ok">✓</span> 已创建 <b>${created}</b> 个 Jira issue`);
  if (!failed) {
    state.modals.value.aiCreate = false;
  } else if (!created) {
    state.toast(`创建失败：${failed} 项未成功`);
  }
}
</script>

<template>
  <div
    class="modal-back"
    :class="{ show: state.modals.value.aiCreate }"
    @click.self="!running && (state.modals.value.aiCreate = false)"
  >
    <div class="modal">
      <div class="m-head">
        <div class="m-title">创建 Jira</div>
        <div class="m-sub">
          扩展会先创建主任务并立即回写 key，再按层级创建子任务并挂上父子链接。
        </div>
      </div>
      <div class="m-body">
        <div v-if="hintWarning" class="hint-warn">{{ hintWarning }}</div>
        <div class="f-grid">
          <div>
            <label class="f-label">Project Key</label>
            <input v-model="projectKey" class="f-input" placeholder="如 NOVA" :disabled="running" />
          </div>
          <div>
            <label class="f-label">主任务类型</label>
            <input v-model="itemType" class="f-input" placeholder="如 Epic" :disabled="running" />
          </div>
          <div>
            <label class="f-label">子任务类型</label>
            <input
              v-model="subType"
              class="f-input"
              :placeholder="subTypeAuto ? '留空＝由 Jira 决定' : '如 Task'"
              :disabled="running"
            />
            <div v-if="subTypeAuto && !subType.trim()" class="f-note">
              留空时扩展会用该项目实际的子任务类型
            </div>
          </div>
        </div>

        <label class="f-label">
          待创建 <span style="color: var(--cur-deep)">（{{ totalRows }}）</span>
        </label>
        <div v-if="!groups.length" class="ai-empty">没有待创建的草稿</div>
        <div v-for="g in groups" :key="g.item.key" class="ai-group">
          <div class="ai-row parent">
            <span class="type-badge" :class="typeBadge(itemType || g.item.type).cls">
              {{ typeBadge(itemType || g.item.type).label }}
            </span>
            <span class="t">{{ g.item.alias || g.item.title }}</span>
            <span class="st">
              <template v-if="!isDraftItem(g.item)">
                <span class="newkey">{{ itemDisplayKey(g.item) }}</span>
              </template>
              <template v-else-if="kindOf(itemRowId(g.item.key)) === 'loading'">
                <span class="mini-spin" /> 创建中
              </template>
              <span v-else-if="kindOf(itemRowId(g.item.key)) === 'ok'" class="newkey">
                ✓ {{ okKey(itemRowId(g.item.key)) }}
              </span>
              <span
                v-else-if="kindOf(itemRowId(g.item.key)) === 'error'"
                class="failkey"
                :title="errorOf(itemRowId(g.item.key))"
              >
                ✕ {{ errorOf(itemRowId(g.item.key)) }}
              </span>
              <template v-else>待创建</template>
            </span>
          </div>
          <div v-for="s in g.subs" :key="s.id" class="ai-row child">
            <span class="child-mark">└</span>
            <span class="t">{{ s.alias || s.title }}</span>
            <span class="st">
              <template v-if="kindOf(subRowId(s.id)) === 'loading'">
                <span class="mini-spin" /> 创建中
              </template>
              <span v-else-if="kindOf(subRowId(s.id)) === 'ok'" class="newkey">
                ✓ {{ okKey(subRowId(s.id)) }}
              </span>
              <span
                v-else-if="kindOf(subRowId(s.id)) === 'error'"
                class="failkey"
                :title="errorOf(subRowId(s.id))"
              >
                ✕ {{ errorOf(subRowId(s.id)) }}
              </span>
              <template v-else>待创建</template>
            </span>
          </div>
        </div>
      </div>
      <div class="m-foot">
        <span v-if="blockReason" class="foot-note">{{ blockReason }}</span>
        <button
          class="btn btn-ghost"
          :disabled="running"
          @click="state.modals.value.aiCreate = false"
        >
          关闭
        </button>
        <button
          class="btn btn-orange"
          :disabled="running || !!blockReason || !groups.length"
          :title="blockReason || undefined"
          @click="start"
        >
          开始创建
        </button>
      </div>
    </div>
  </div>
</template>
