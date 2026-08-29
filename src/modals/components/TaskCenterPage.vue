<template>
  <div class="task-center-page">
    <div class="page-header">
      <div>
        <h2>任务中心</h2>
        <p>{{ pageDescription }}</p>
      </div>
      <div class="header-actions">
        <button class="tc-btn" @click="loadAll()">刷新</button>
        <button class="tc-btn primary" @click="openCreate()">＋ 新建任务</button>
      </div>
    </div>

    <!-- One compact line: what is on, what is not, and a way in. The detail
         lives in the setup drawer rather than taking a third of the viewport. -->
    <button class="level-bar" :class="{ incomplete: !allLevelsActive }" @click="setupOpen = true">
      <span class="level-bar-label">能力</span>
      <span v-for="level in levels" :key="level.key" class="level-pill" :class="{ on: level.active }">
        <span class="level-dot" />{{ level.shortLabel }}
      </span>
      <span class="level-bar-cta">{{ allLevelsActive ? '查看配置' : '去配置 →' }}</span>
    </button>

    <!-- Guided setup: the same three steps as the prototype, each linking to the
         surface that actually owns that configuration. -->
    <div v-if="setupOpen" class="tc-backdrop" @click.self="setupOpen = false">
      <div class="tc-dialog" role="dialog" aria-label="任务中心初始化">
        <div class="tc-dialog-head">
          <strong>初始化任务中心</strong>
          <span class="tc-x" @click="setupOpen = false">✕</span>
        </div>
        <div class="tc-dialog-body">
          <p class="setup-intro">
            能力是分层的：装完插件就能用 L0，L1 和 L2 按需开启。未开启不影响已有功能，只是少一些投递目标和调度选择。
          </p>

          <div v-for="(level, index) in levels" :key="level.key" class="setup-step" :class="{ done: level.active }">
            <div class="setup-step-top">
              <span class="setup-num">{{ level.active ? '✓' : index }}</span>
              <strong>{{ level.label }}</strong>
              <span class="setup-state">{{ level.active ? '已启用' : '未启用' }}</span>
            </div>
            <div class="setup-step-body">
              <p>{{ level.detail }}</p>
              <p class="setup-unlocks"><span>解锁</span>{{ level.unlocks }}</p>
              <div v-if="level.action" class="setup-actions">
                <button class="tc-btn primary" @click="level.action.run()">{{ level.action.label }}</button>
                <small>{{ level.action.hint }}</small>
              </div>
            </div>
          </div>

          <div class="setup-note">
            L2 在受管 Google 账号下可能被域策略拦住（禁止匿名 Web App 部署）。届时定时消息页会给出明确原因；
            没有 L2 也不影响任何任务创建，只是调度器固定用 🏠。
          </div>
        </div>
        <div class="tc-dialog-foot">
          <span class="tc-sync-hint">配置完成后回到本页刷新即可生效</span>
          <button class="tc-btn" @click="setupOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <div class="chips" role="tablist" aria-label="任务类型">
      <button
        v-for="chip in kindChips"
        :key="chip.value"
        class="chip"
        :class="{ on: activeKind === chip.value }"
        role="tab"
        :aria-selected="activeKind === chip.value"
        @click="setKind(chip.value)"
      >
        {{ chip.label }}
        <span v-if="chip.count > 0" class="chip-count">{{ chip.count }}</span>
      </button>
    </div>

    <div v-if="loading" class="tc-loading">加载任务中…</div>
    <div v-else-if="loadError" class="tc-error">
      <strong>无法读取任务</strong>
      <span>{{ loadError }}</span>
    </div>
    <div v-else-if="visibleTasks.length === 0" class="tc-empty">
      <p>{{ emptyMessage }}</p>
      <button class="tc-btn primary" @click="openCreate()">＋ 建一个试试</button>
    </div>

    <div v-else class="tc-layout">
      <section class="tc-list" aria-label="任务列表">
        <div v-for="group in groupedTasks" :key="group.title" class="tc-group">
          <div class="tc-group-head">
            {{ group.title }}<span class="tc-group-count">{{ group.tasks.length }} 条</span>
          </div>
          <button
            v-for="task in group.tasks"
            :key="task.id"
            class="tc-row"
            :class="{ on: selectedId === task.id }"
            @click="select(task)"
          >
            <span class="tc-time">{{ formatWhen(task) }}</span>
            <span class="tc-kind" :class="task.taskKind">{{ kindLabel(task.taskKind) }}</span>
            <span class="tc-lane" :title="laneTitle(task)">{{ task.lane === 'jira_sheet' ? '☁️' : '🏠' }}</span>
            <span class="tc-title">{{ task.title }}</span>
            <span class="tc-status" :class="statusTone(task.queueStatus)">{{ statusLabel(task) }}</span>
          </button>
        </div>
      </section>

      <section v-if="selected" class="tc-detail" aria-label="任务详情">
        <div class="tc-detail-head">
          <span class="tc-kind" :class="selected.taskKind">{{ kindLabel(selected.taskKind) }}</span>
          <h3>{{ selected.title }}</h3>
          <span class="tc-status" :class="statusTone(selected.queueStatus)">{{ selected.queueStatus }}</span>
        </div>

        <dl class="tc-facts">
          <div><dt>调度器</dt><dd>{{ laneTitle(selected) }}</dd></div>
          <div><dt>下次执行</dt><dd>{{ formatWhen(selected) }}</dd></div>
          <div v-if="selected.recurrenceSpec"><dt>重复</dt><dd>{{ recurrenceLabel(selected) }}</dd></div>
          <div v-if="selected.dependsOn?.length"><dt>依赖</dt><dd>{{ selected.dependsOn.length }} 个前置任务未完成前不会执行</dd></div>
          <div v-if="selected.mirrorRef"><dt>Sheet 镜像</dt><dd>{{ mirrorLabel(selected) }}</dd></div>
          <div v-if="selected.retryCount > 0"><dt>重试</dt><dd>{{ selected.retryCount }} 次</dd></div>
        </dl>

        <div v-if="selected.lastError" class="tc-error-box">
          <strong>最近一次失败</strong>
          <span>{{ selected.lastError }}</span>
        </div>

        <div v-if="childTasks.length" class="tc-children">
          <div class="tc-children-head">子任务 {{ childTasks.length }} 个</div>
          <div v-for="child in childTasks" :key="child.id" class="tc-child">
            <span class="tc-status" :class="statusTone(child.queueStatus)">{{ child.queueStatus }}</span>
            <span>{{ child.title }}</span>
          </div>
          <small>父任务在全部子任务成功后自动完成。</small>
        </div>

        <div class="tc-detail-actions">
          <router-link
            v-if="selected.sourceRefId"
            class="tc-btn"
            :to="`/actions?sourceKind=${selected.sourceKind || 'agent_task'}&sourceRefId=${selected.sourceRefId}`"
          >查看执行记录</router-link>
          <button class="tc-btn" @click="sweep()">滚动到下一次</button>
        </div>
      </section>
    </div>

    <!-- Create dialog: fields differ per kind, lane picker greys what is unavailable. -->
    <div v-if="createOpen" class="tc-backdrop" @click.self="createOpen = false">
      <div class="tc-dialog" role="dialog" aria-label="新建任务">
        <div class="tc-dialog-head">
          <strong>新建任务</strong>
          <span class="tc-x" @click="createOpen = false">✕</span>
        </div>

        <div class="tc-dialog-body">
          <div class="tc-field">
            <label>任务类型</label>
            <div class="tc-opts">
              <button
                v-for="opt in createKindOptions"
                :key="opt.value"
                class="tc-opt"
                :class="{ on: draft.taskKind === opt.value }"
                @click="draft.taskKind = opt.value"
              >
                {{ opt.label }}<small>{{ opt.hint }}</small>
              </button>
            </div>
          </div>

          <div class="tc-field">
            <label>标题 <span class="req">*</span></label>
            <input v-model="draft.title" type="text" :placeholder="titlePlaceholder" />
          </div>

          <div v-if="draft.taskKind === 'push'" class="tc-field">
            <label>内容 / JQL</label>
            <textarea v-model="draft.content" rows="3" placeholder="要推送的内容，或用于查询的 JQL" />
          </div>

          <template v-if="draft.taskKind === 'agent'">
            <div class="tc-field">
              <label>任务描述 <span class="req">*</span></label>
              <textarea v-model="draft.content" rows="4" placeholder="只描述要做什么；查到 0 条也是合法成功" />
            </div>
            <div class="tc-field">
              <label>执行边界</label>
              <div class="tc-opts">
                <button class="tc-opt" :class="{ on: draft.mode === 'read' }" @click="draft.mode = 'read'">🔍 只读查询</button>
                <button class="tc-opt" :class="{ on: draft.mode === 'write' }" @click="draft.mode = 'write'">
                  ✍️ 允许外部写入<small>执行前需你审批</small>
                </button>
              </div>
            </div>
          </template>

          <template v-if="draft.taskKind === 'remind'">
            <div class="tc-field">
              <label>提醒时间</label>
              <div class="tc-opts">
                <button
                  v-for="preset in remindPresets"
                  :key="preset.label"
                  class="tc-opt"
                  :class="{ on: draft.remindPreset === preset.label }"
                  @click="draft.remindPreset = preset.label"
                >{{ preset.label }}</button>
              </div>
            </div>
          </template>

          <template v-if="draft.taskKind === 'dev'">
            <div class="tc-field">
              <label>任务说明</label>
              <textarea v-model="draft.content" rows="3" />
            </div>
            <div class="tc-field">
              <label>验收标准 <span class="req">*</span></label>
              <textarea
                v-model="draft.acceptance"
                rows="2"
                placeholder="怎样算完成？说不清就先回 Codex / Claude Code 里聊，定稿再委派"
              />
            </div>
          </template>

          <div v-if="draft.taskKind === 'push' || draft.taskKind === 'agent'" class="tc-field">
            <label>重复规则</label>
            <select v-model="draft.repeat">
              <option value="once">一次性</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>

          <div class="tc-field">
            <label>调度器</label>
            <div class="tc-opts">
              <button
                class="tc-opt"
                :class="{ on: effectiveLane === 'memory_cron' }"
                @click="draft.lane = 'memory_cron'"
              >
                🏠 memory_cron<small>本地到期队列 · 秒级入队</small>
              </button>
              <button
                class="tc-opt"
                :class="{ on: effectiveLane === 'jira_sheet', off: !cloudSelectable }"
                :disabled="!cloudSelectable"
                @click="cloudSelectable && (draft.lane = 'jira_sheet')"
              >
                ☁️ jira_sheet<small>{{ cloudLaneAvailable ? 'Jira Automation 云端触发 · 24/7' : '未启用 Level 2' }}</small>
              </button>
            </div>
            <div class="tc-lane-note" :class="laneNoteTone">{{ laneNote }}</div>
          </div>
        </div>

        <div class="tc-dialog-foot">
          <span class="tc-sync-hint">{{ syncHint }}</span>
          <button class="tc-btn" @click="createOpen = false">取消</button>
          <button class="tc-btn primary" :disabled="!canSave || saving" @click="saveTask()">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="tc-toast">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  getMemoryServiceClient,
  type TaskCenterTask,
  type TaskKind,
  type TaskLane,
} from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();

const loading = ref(true);
const loadError = ref('');
const tasks = ref<TaskCenterTask[]>([]);
const selectedId = ref('');
const activeKind = ref<TaskKind | 'all'>('all');
const createOpen = ref(false);
const setupOpen = ref(false);
const saving = ref(false);
const toast = ref('');
const laneSelectableKinds = ref<TaskKind[]>(['push', 'agent']);

/**
 * Level 2 (Sheet + Apps Script + Jira rule) is configured in the extension, not
 * in memory-service, so the page reads it from chrome.storage rather than the
 * API — the backend has no way to detect it.
 */
const cloudLaneAvailable = ref(false);
const botConfigured = ref(false);

const draft = ref({
  taskKind: 'push' as TaskKind,
  title: '',
  content: '',
  acceptance: '',
  mode: 'read' as 'read' | 'write',
  repeat: 'once',
  remindPreset: '今晚 19:00',
  lane: undefined as TaskLane | undefined,
});

const remindPresets = [
  { label: '1 小时后', ms: 3600_000 },
  { label: '今晚 19:00', ms: 0 },
  { label: '明早 9:00', ms: 0 },
  { label: '下周一 9:00', ms: 0 },
];

const KIND_LABELS: Record<TaskKind, string> = {
  push: '定时推送',
  agent: 'Agent 任务',
  remind: '稍后提醒',
  dev: '开发委派',
  reflection: '反思候选',
};

const createKindOptions: Array<{ value: TaskKind; label: string; hint: string }> = [
  { value: 'push', label: '⏰ 定时推送', hint: '定时把消息 / 报表推送出去' },
  { value: 'agent', label: '🤖 Agent 任务', hint: '让 agent 定期执行外部操作' },
  { value: 'remind', label: '⏳ 稍后提醒', hint: '到点提醒我自己' },
  { value: 'dev', label: '🛠 开发委派', hint: '定稿的开发 / 调研工作单' },
];

/**
 * L1 (Bot credentials) and L2 (Sheet + Apps Script + Jira rule) are both owned
 * by the scheduled-messages page — that is where the credentials and the
 * one-click setup already live. The Task Center reports status and sends the
 * user there rather than growing a second copy of those flows.
 */
function openScheduledMessages(hash = '') {
  window.open(chrome.runtime.getURL(`scheduled-messages.html${hash}`), '_blank');
}

const levels = computed(() => [
  {
    key: 'l0',
    shortLabel: 'L0 账本',
    label: 'L0 任务账本',
    active: true,
    detail: '零配置，装完插件即可用。',
    unlocks: '四类任务全部可创建（🏠 本地调度）+ 插件通知',
    action: null as null | { label: string; hint: string; run: () => void },
  },
  {
    key: 'l1',
    shortLabel: 'L1 推送',
    label: 'L1 推送通道',
    active: botConfigured.value,
    detail: botConfigured.value
      ? 'Glip Bot 已配置，通知可发到私信或群组。'
      : '未配置 Bot，通知目前只走插件通知（Chrome 通知）。',
    unlocks: 'Glip Bot 私发 / 群组作为通知目标',
    action: botConfigured.value
      ? null
      : {
          label: '去配置 Bot',
          hint: '在定时消息页填写 SM AI Bot 凭据',
          run: () => openScheduledMessages(),
        },
  },
  {
    key: 'l2',
    shortLabel: 'L2 云端',
    label: 'L2 云端 lane（☁️ jira_sheet）',
    active: cloudLaneAvailable.value,
    detail: cloudLaneAvailable.value
      ? 'Google Sheet + Apps Script + Jira Automation 已就绪。'
      : '未配置。需要 Google 授权和 Jira 项目 admin 权限。',
    unlocks: '☁️ 调度器（memory-service 离线也照跑）、Timeline 里程碑触发、Drive 附件',
    action: cloudLaneAvailable.value
      ? null
      : {
          label: '去一键初始化',
          hint: '定时消息页 → 一键初始化，会创建 Sheet、部署脚本、装 Jira 规则',
          run: () => openScheduledMessages(),
        },
  },
]);

const allLevelsActive = computed(() => levels.value.every((level) => level.active));

const pageDescription = computed(
  () =>
    '定时推送、Agent 任务、稍后提醒、开发委派共用一个账本；🏠 由 memory-service 调度，☁️ 由 Jira Automation 云端触发。',
);

const kindChips = computed(() => {
  const counts = new Map<string, number>();
  for (const task of tasks.value) {
    counts.set(task.taskKind ?? 'other', (counts.get(task.taskKind ?? 'other') ?? 0) + 1);
  }
  return [
    { value: 'all' as const, label: '全部', count: tasks.value.length },
    ...(Object.keys(KIND_LABELS) as TaskKind[]).map((kind) => ({
      value: kind,
      label: KIND_LABELS[kind],
      count: counts.get(kind) ?? 0,
    })),
  ];
});

const visibleTasks = computed(() =>
  activeKind.value === 'all'
    ? tasks.value
    : tasks.value.filter((task) => task.taskKind === activeKind.value),
);

/** Ordered by when they run, which is how people actually look for a task. */
const groupedTasks = computed(() => {
  const pending: TaskCenterTask[] = [];
  const done: TaskCenterTask[] = [];
  const blocked: TaskCenterTask[] = [];
  for (const task of visibleTasks.value) {
    if (['succeeded', 'cancelled'].includes(task.queueStatus)) done.push(task);
    else if (['failed', 'dead_letter', 'input_required'].includes(task.queueStatus)) blocked.push(task);
    else pending.push(task);
  }
  const byTime = (a: TaskCenterTask, b: TaskCenterTask) =>
    (a.scheduledAt ?? a.createdAt) - (b.scheduledAt ?? b.createdAt);
  return [
    { title: '需要处理', tasks: blocked.sort(byTime) },
    { title: '待执行', tasks: pending.sort(byTime) },
    { title: '已完成', tasks: done.sort(byTime).reverse() },
  ].filter((group) => group.tasks.length > 0);
});

const selected = computed(() => tasks.value.find((task) => task.id === selectedId.value) ?? null);
const childTasks = computed(() =>
  selected.value ? tasks.value.filter((task) => task.parentActionId === selected.value!.id) : [],
);

const emptyMessage = computed(() =>
  activeKind.value === 'all'
    ? '账本里还没有任务。'
    : `没有${KIND_LABELS[activeKind.value as TaskKind]}类型的任务。`,
);

const cloudSelectable = computed(
  () => cloudLaneAvailable.value && laneSelectableKinds.value.includes(draft.value.taskKind),
);
const effectiveLane = computed<TaskLane>(() =>
  draft.value.lane === 'jira_sheet' && cloudSelectable.value ? 'jira_sheet' : 'memory_cron',
);
const laneNoteTone = computed(() => {
  if (!laneSelectableKinds.value.includes(draft.value.taskKind)) return 'locked';
  if (effectiveLane.value === 'jira_sheet') return 'cloud';
  return cloudLaneAvailable.value ? 'home' : 'blocked';
});
const laneNote = computed(() => {
  if (!laneSelectableKinds.value.includes(draft.value.taskKind)) {
    return `🔒 ${KIND_LABELS[draft.value.taskKind]}需要人工节点 / 依赖 / 产物能力，固定由 memory-service 调度`;
  }
  if (effectiveLane.value === 'jira_sheet') {
    return '☁️ 保存后需同步一行 Sheet，由 Jira Automation 每分钟领取；memory-service 离线也会执行。';
  }
  return cloudLaneAvailable.value
    ? '🏠 由 memory-service 调度。切到 ☁️ 会创建 Sheet 镜像行交给 Jira 调度。'
    : '☁️ 需要 Level 2（Google Sheet + Jira Automation），当前不可选；保存后使用 🏠 调度，之后可随时切换。点右上「能力」可去配置。';
});
const syncHint = computed(() =>
  effectiveLane.value === 'jira_sheet'
    ? '保存 → 写入账本 → 扩展同步器写 Sheet 行 → Jira Automation 调度'
    : '保存 → 写入账本 → memory_cron 到期队列',
);

const titlePlaceholder = computed(() => {
  switch (draft.value.taskKind) {
    case 'agent': return '例如：Nova 缺少 Assignee 的 INIT';
    case 'remind': return '提醒我做什么';
    case 'dev': return '一个明确方向的工作单';
    default: return '例如：每天检查无 Assignee 的新 bug';
  }
});

const canSave = computed(() => {
  if (!draft.value.title.trim()) return false;
  if (draft.value.taskKind === 'agent' && !draft.value.content.trim()) return false;
  // Borrowed from the industry consensus on delegation: a work order without a
  // verifiable finish line belongs in a conversation, not in the ledger.
  if (draft.value.taskKind === 'dev' && !draft.value.acceptance.trim()) return false;
  return true;
});

function kindLabel(kind?: TaskKind) {
  return kind ? KIND_LABELS[kind] ?? kind : '任务';
}
function laneTitle(task: TaskCenterTask) {
  return task.lane === 'jira_sheet'
    ? '☁️ jira_sheet · Jira Automation 云端触发'
    : '🏠 memory_cron · memory-service 到期队列';
}
function statusTone(status: string) {
  if (status === 'succeeded') return 'ok';
  if (['failed', 'dead_letter'].includes(status)) return 'bad';
  if (status === 'running') return 'run';
  if (status === 'input_required') return 'wait-human';
  return 'wait';
}
function statusLabel(task: TaskCenterTask) {
  if (task.queueStatus === 'input_required') return '等你处理';
  if (task.queueStatus === 'queued' && task.dependsOn?.length) return '等依赖';
  return task.queueStatus;
}
function formatWhen(task: TaskCenterTask) {
  const at = task.scheduledAt ?? task.createdAt;
  if (!at) return '—';
  const date = new Date(at * 1000);
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function recurrenceLabel(task: TaskCenterTask) {
  const spec = task.recurrenceSpec as Record<string, unknown> | undefined;
  if (!spec) return '一次性';
  const every = Number(spec.repeatEvery) || 1;
  const unit = String(spec.repeatUnit ?? '');
  const map: Record<string, string> = { Day: '工作日', Week: '周', Month: '月' };
  return `每 ${every} ${map[unit] ?? unit}`;
}
function mirrorLabel(task: TaskCenterTask) {
  const ref = task.mirrorRef as Record<string, unknown> | undefined;
  if (!ref) return '—';
  return `${ref.sheetMessageId ?? '未同步'} · ${ref.syncState ?? 'pending'}`;
}

function setKind(kind: TaskKind | 'all') {
  activeKind.value = kind;
}
function select(task: TaskCenterTask) {
  selectedId.value = task.id;
}
function openCreate() {
  draft.value = {
    taskKind: 'push',
    title: '',
    content: '',
    acceptance: '',
    mode: 'read',
    repeat: 'once',
    remindPreset: '今晚 19:00',
    lane: undefined,
  };
  createOpen.value = true;
}
function showToast(message: string) {
  toast.value = message;
  window.setTimeout(() => { toast.value = ''; }, 3500);
}

function buildRecurrence(): Record<string, unknown> | undefined {
  if (draft.value.repeat === 'once') return undefined;
  const unit = { daily: 'Day', weekly: 'Week', monthly: 'Month' }[draft.value.repeat];
  if (!unit) return undefined;
  const nowDate = new Date();
  return {
    repeatEvery: 1,
    repeatUnit: unit,
    scheduleDate: nowDate.toISOString().slice(0, 10),
    scheduleTime: `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`,
  };
}

async function saveTask() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const response = await client.createTaskCenterTask({
      taskKind: draft.value.taskKind,
      title: draft.value.title.trim(),
      description: draft.value.content.trim() || undefined,
      lane: effectiveLane.value,
      cloudLaneAvailable: cloudLaneAvailable.value,
      // write-mode agent work and dev delegations stop for a human first.
      requiresApproval: draft.value.taskKind === 'dev' || draft.value.mode === 'write',
      recurrenceSpec: buildRecurrence(),
      payload: {
        content: draft.value.content.trim() || undefined,
        acceptance: draft.value.acceptance.trim() || undefined,
        mode: draft.value.taskKind === 'agent' ? draft.value.mode : undefined,
        remindPreset: draft.value.taskKind === 'remind' ? draft.value.remindPreset : undefined,
      },
    });
    createOpen.value = false;
    showToast(
      response.lane.honoredRequest
        ? `已保存「${response.task.title}」· ${response.mirrorRequired ? '待同步 Sheet ☁️' : '已入 memory_cron 队列 🏠'}`
        : `已保存，但调度器回落为 🏠：${response.lane.reason}`,
    );
    await loadAll();
    selectedId.value = response.task.id;
  } catch (error) {
    showToast(`保存失败：${(error as Error).message}`);
  } finally {
    saving.value = false;
  }
}

async function sweep() {
  try {
    const result = await client.sweepTaskCenter();
    showToast(`已滚动 ${result.rolledOver} 个重复任务，完成 ${result.parentsCompleted} 个父任务`);
    await loadAll();
  } catch (error) {
    showToast(`滚动失败：${(error as Error).message}`);
  }
}

async function detectLevels() {
  try {
    const stored = await chrome.storage.local.get(['scheduledMessagesConfig', 'botConfig']);
    const config = stored?.scheduledMessagesConfig;
    // Level 2 means the whole cloud chain exists: a Sheet to mirror into and a
    // deployed script for Jira Automation to reach.
    cloudLaneAvailable.value = Boolean(config?.spreadsheetId && config?.webAppUrl);
    botConfigured.value = Boolean(stored?.botConfig?.botId || config?.botId);
  } catch {
    cloudLaneAvailable.value = false;
    botConfigured.value = false;
  }
}

async function loadAll(options: { silent?: boolean } = {}) {
  if (!options.silent) loading.value = true;
  try {
    const [list, capabilities] = await Promise.all([
      client.getTaskCenterTasks({ limit: 200 }),
      client.getTaskCenterCapabilities().catch(() => null),
    ]);
    tasks.value = list.items;
    if (capabilities?.laneSelectableKinds?.length) {
      laneSelectableKinds.value = capabilities.laneSelectableKinds;
    }
    loadError.value = '';
    if (!selectedId.value && list.items.length > 0) {
      selectedId.value = list.items[0].id;
    }
  } catch (error) {
    loadError.value = (error as Error).message;
  } finally {
    loading.value = false;
  }
}

let pollId: number | null = null;
onMounted(async () => {
  await detectLevels();
  await loadAll();
  pollId = window.setInterval(() => {
    // Only poll while something is actually moving.
    if (tasks.value.some((task) => ['running', 'queued'].includes(task.queueStatus))) {
      void loadAll({ silent: true });
    }
  }, 15000);
});
onUnmounted(() => {
  if (pollId !== null) window.clearInterval(pollId);
});
</script>

<style scoped>
.task-center-page {
  --tc-panel: rgba(15, 23, 42, 0.62);
  --tc-line: rgba(148, 163, 184, 0.18);
  --tc-ink: #eef6ff;
  --tc-muted: #8fa3bb;
  --tc-dim: #64748b;
  --tc-accent: #60a5fa;
  --tc-green: #34d399;
  --tc-amber: #fbbf24;
  --tc-red: #fb7185;
  --tc-purple: #a78bfa;
  --tc-cyan: #22d3ee;
  color: var(--tc-ink);
  padding: 0.5rem 0.25rem 2rem;
}

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.page-header h2 { font-size: 1.25rem; margin: 0; }
.page-header p { color: var(--tc-muted); font-size: 0.82rem; margin: 0.35rem 0 0; max-width: 640px; }
.header-actions { display: flex; gap: 0.5rem; }

.tc-btn { border: 1px solid var(--tc-line); background: var(--tc-panel); color: var(--tc-ink); border-radius: 999px; padding: 0.38rem 0.95rem; font-size: 0.78rem; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.tc-btn:hover { border-color: var(--tc-accent); }
.tc-btn.primary { background: rgba(59, 130, 246, 0.18); border-color: rgba(59, 130, 246, 0.45); color: var(--tc-accent); font-weight: 600; }
.tc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.level-bar { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 0.8rem; padding: 0.3rem 0.7rem 0.3rem 0.6rem; border: 1px solid var(--tc-line); border-radius: 999px; background: rgba(255, 255, 255, 0.02); cursor: pointer; font-family: inherit; color: inherit; }
.level-bar:hover { border-color: var(--tc-accent); }
.level-bar.incomplete { border-color: rgba(251, 191, 36, 0.3); }
.level-bar-label { font-size: 0.68rem; color: var(--tc-dim); }
.level-pill { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; color: var(--tc-dim); }
.level-pill.on { color: var(--tc-green); }
.level-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--tc-dim); flex-shrink: 0; }
.level-pill.on .level-dot { background: var(--tc-green); }
.level-bar-cta { font-size: 0.68rem; color: var(--tc-accent); margin-left: 0.15rem; }

.setup-intro { font-size: 0.76rem; color: var(--tc-muted); margin-bottom: 0.9rem; }
.setup-step { border: 1px solid var(--tc-line); border-radius: 0.55rem; padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; background: rgba(255, 255, 255, 0.02); }
.setup-step.done { border-color: rgba(52, 211, 153, 0.35); }
.setup-step-top { display: flex; align-items: center; gap: 0.5rem; }
.setup-step-top strong { font-size: 0.84rem; flex: 1; }
.setup-num { width: 20px; height: 20px; border-radius: 50%; background: rgba(148, 163, 184, 0.15); color: var(--tc-muted); font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.setup-step.done .setup-num { background: rgba(34, 197, 94, 0.16); color: var(--tc-green); }
.setup-state { font-size: 0.68rem; color: var(--tc-muted); }
.setup-step-body { margin-left: 1.7rem; margin-top: 0.35rem; }
.setup-step-body p { font-size: 0.74rem; color: var(--tc-muted); margin: 0 0 0.3rem; }
.setup-unlocks { font-size: 0.72rem !important; color: var(--tc-dim) !important; }
.setup-unlocks span { color: var(--tc-green); margin-right: 0.35rem; }
.setup-actions { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; margin-top: 0.45rem; }
.setup-actions small { font-size: 0.68rem; color: var(--tc-dim); }
.setup-note { font-size: 0.7rem; color: var(--tc-amber); background: rgba(245, 158, 11, 0.08); border-radius: 6px; padding: 0.5rem 0.65rem; margin-top: 0.6rem; }

.chips { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
.chip { border: 1px solid var(--tc-line); background: transparent; color: var(--tc-muted); border-radius: 999px; padding: 0.25rem 0.8rem; font-size: 0.74rem; cursor: pointer; }
.chip.on { background: rgba(255, 255, 255, 0.08); color: var(--tc-ink); border-color: rgba(148, 163, 184, 0.4); }
.chip-count { margin-left: 0.35rem; font-size: 0.66rem; opacity: 0.75; }

.tc-loading, .tc-empty, .tc-error { padding: 2rem; text-align: center; color: var(--tc-muted); font-size: 0.85rem; }
.tc-error { color: var(--tc-red); display: flex; flex-direction: column; gap: 0.35rem; }
.tc-empty p { margin-bottom: 0.75rem; }

.tc-layout { display: grid; grid-template-columns: minmax(320px, 420px) minmax(0, 1fr); gap: 1.05rem; align-items: start; }
@media (max-width: 900px) { .tc-layout { grid-template-columns: 1fr; } }

.tc-list { background: var(--tc-panel); border: 1px solid var(--tc-line); border-radius: 0.7rem; padding: 0.6rem 0.7rem; }
.tc-group-head { font-size: 0.72rem; font-weight: 700; color: var(--tc-muted); padding: 0.35rem 0; border-bottom: 1px solid var(--tc-line); margin-bottom: 0.25rem; }
.tc-group-count { font-size: 0.64rem; color: var(--tc-dim); font-weight: 400; margin-left: 0.4rem; }
.tc-group + .tc-group { margin-top: 0.8rem; }
.tc-row { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.35rem 0.4rem; border: 0; background: transparent; border-radius: 6px; cursor: pointer; text-align: left; color: inherit; font-size: 0.78rem; font-family: inherit; }
.tc-row:hover { background: rgba(59, 130, 246, 0.08); }
.tc-row.on { background: rgba(59, 130, 246, 0.16); }
.tc-time { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.68rem; color: var(--tc-dim); flex-shrink: 0; }
.tc-lane { flex-shrink: 0; }
.tc-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #cbd5e1; }

.tc-kind { font-size: 0.62rem; padding: 0.08rem 0.45rem; border-radius: 999px; white-space: nowrap; flex-shrink: 0; background: rgba(255, 255, 255, 0.08); color: var(--tc-muted); }
.tc-kind.push { background: rgba(34, 211, 238, 0.14); color: var(--tc-cyan); }
.tc-kind.agent { background: rgba(147, 51, 234, 0.2); color: var(--tc-purple); }
.tc-kind.remind { background: rgba(34, 197, 94, 0.16); color: var(--tc-green); }
.tc-kind.dev { background: rgba(34, 211, 238, 0.12); color: var(--tc-cyan); }
.tc-kind.reflection { background: rgba(147, 51, 234, 0.18); color: var(--tc-purple); }

.tc-status { font-size: 0.62rem; padding: 0.08rem 0.5rem; border-radius: 999px; font-weight: 600; flex-shrink: 0; }
.tc-status.ok { background: rgba(34, 197, 94, 0.16); color: var(--tc-green); }
.tc-status.bad { background: rgba(244, 63, 94, 0.16); color: var(--tc-red); }
.tc-status.run { background: rgba(59, 130, 246, 0.18); color: var(--tc-accent); }
.tc-status.wait { background: rgba(148, 163, 184, 0.15); color: var(--tc-muted); }
.tc-status.wait-human { background: rgba(245, 158, 11, 0.16); color: var(--tc-amber); }

.tc-detail { background: var(--tc-panel); border: 1px solid var(--tc-line); border-radius: 0.7rem; padding: 0.95rem 1.1rem; }
.tc-detail-head { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
.tc-detail-head h3 { font-size: 0.98rem; margin: 0; flex: 1; min-width: 200px; }
.tc-facts { display: grid; gap: 0.45rem; margin: 0 0 0.8rem; }
.tc-facts > div { display: flex; gap: 0.6rem; font-size: 0.76rem; }
.tc-facts dt { color: var(--tc-dim); min-width: 72px; flex-shrink: 0; }
.tc-facts dd { margin: 0; color: #cbd5e1; }
.tc-error-box { border-left: 3px solid var(--tc-red); background: rgba(244, 63, 94, 0.07); padding: 0.5rem 0.65rem; border-radius: 0 6px 6px 0; font-size: 0.74rem; display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.8rem; }
.tc-error-box strong { color: var(--tc-red); }
.tc-children { border: 1px dashed var(--tc-line); border-radius: 0.5rem; padding: 0.6rem 0.7rem; margin-bottom: 0.8rem; }
.tc-children-head { font-size: 0.74rem; font-weight: 600; margin-bottom: 0.4rem; }
.tc-child { display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem; padding: 0.2rem 0; color: #cbd5e1; }
.tc-children small { display: block; margin-top: 0.4rem; font-size: 0.68rem; color: var(--tc-dim); }
.tc-detail-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.tc-backdrop { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.55); backdrop-filter: blur(6px); display: grid; place-items: center; z-index: 100; padding: 1rem; }
.tc-dialog { width: min(620px, 100%); max-height: 88vh; display: flex; flex-direction: column; background: #111a2e; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 0.75rem; }
.tc-dialog-head { display: flex; align-items: center; padding: 0.85rem 1.1rem; border-bottom: 1px solid var(--tc-line); }
.tc-dialog-head strong { flex: 1; font-size: 0.95rem; }
.tc-x { cursor: pointer; color: var(--tc-dim); }
.tc-dialog-body { padding: 1rem 1.1rem; overflow-y: auto; }
.tc-dialog-foot { display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1.1rem; border-top: 1px solid var(--tc-line); }
.tc-sync-hint { flex: 1; font-size: 0.68rem; color: var(--tc-dim); }

.tc-field { margin-bottom: 0.85rem; }
.tc-field label { display: block; font-size: 0.74rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.3rem; }
.tc-field .req { color: var(--tc-red); }
.tc-field input[type='text'], .tc-field textarea, .tc-field select {
  width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--tc-line);
  border-radius: 8px; color: var(--tc-ink); font-size: 0.78rem; padding: 0.5rem 0.65rem;
  font-family: inherit; outline: none;
}
.tc-field textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem; resize: vertical; }
.tc-field input:focus, .tc-field textarea:focus, .tc-field select:focus { border-color: rgba(59, 130, 246, 0.5); }
.tc-opts { display: flex; gap: 0.45rem; flex-wrap: wrap; }
.tc-opt { border: 1px solid var(--tc-line); background: rgba(255, 255, 255, 0.03); color: var(--tc-muted); border-radius: 8px; padding: 0.45rem 0.8rem; font-size: 0.74rem; cursor: pointer; text-align: left; font-family: inherit; }
.tc-opt.on { background: rgba(59, 130, 246, 0.18); border-color: rgba(59, 130, 246, 0.5); color: var(--tc-accent); font-weight: 600; }
.tc-opt.off, .tc-opt:disabled { opacity: 0.38; cursor: not-allowed; }
.tc-opt small { display: block; font-size: 0.62rem; font-weight: 400; color: var(--tc-dim); margin-top: 0.1rem; }
.tc-lane-note { margin-top: 0.4rem; font-size: 0.68rem; padding: 0.4rem 0.6rem; border-radius: 6px; }
.tc-lane-note.home { background: rgba(34, 197, 94, 0.14); color: var(--tc-green); }
.tc-lane-note.cloud { background: rgba(245, 158, 11, 0.14); color: var(--tc-amber); }
.tc-lane-note.locked { background: rgba(148, 163, 184, 0.1); color: var(--tc-muted); }
.tc-lane-note.blocked { background: rgba(244, 63, 94, 0.14); color: var(--tc-red); }

.tc-toast { position: fixed; bottom: 1.2rem; left: 50%; transform: translateX(-50%); background: #0e2a1c; border: 1px solid rgba(52, 211, 153, 0.45); color: var(--tc-green); font-size: 0.76rem; padding: 0.55rem 1.1rem; border-radius: 999px; z-index: 120; max-width: 90vw; }
</style>
