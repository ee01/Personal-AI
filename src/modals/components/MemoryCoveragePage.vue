<template>
  <div class="coverage-page">
    <header class="coverage-header">
      <div>
        <div class="eyebrow">Memory Coverage Map · 按平台</div>
        <h1>记忆覆盖地图</h1>
        <p>
          看清 Personal AI 当前到底接住了哪些平台、每个平台贡献什么数据、最近是否仍在更新，以及哪里需要你主动修复或录入资料。
        </p>
      </div>
      <div class="header-actions">
        <span class="service-chip" :class="{ stale: Boolean(errorMessage) }">
          <span class="pulse"></span>
          {{ serviceStatusText }}
        </span>
        <span class="header-meta">{{ generatedAtText }}</span>
        <div class="memory-action-row">
          <button class="btn" type="button" @click="openImportDrawer">
            录入
          </button>
          <button
            class="btn primary"
            type="button"
            :disabled="exportingBackup"
            @click="exportBackup"
          >
            {{ exportingBackup ? '下载中...' : '记忆备份' }}
          </button>
          <button class="btn primary" type="button" :disabled="loading" @click="loadCoverage">
            {{ loading ? '刷新中...' : '重扫覆盖' }}
          </button>
        </div>
      </div>
    </header>

    <div v-if="errorMessage" class="status-box error">
      {{ errorMessage }}
    </div>
    <div v-if="loading && !coverage" class="status-box">加载记忆覆盖状态中...</div>

    <template v-if="coverage">
      <section class="summary-strip" aria-label="覆盖总览">
        <article class="summary-card">
          <span>已接入平台</span>
          <strong>{{ coverage.summary.activePlatforms }}</strong>
          <em>含 Personal AI Core 派生能力</em>
        </article>
        <article class="summary-card good">
          <span>健康平台</span>
          <strong>{{ coverage.summary.healthyPlatforms }}</strong>
          <em>有数据且近期仍有信号</em>
        </article>
        <article class="summary-card warn">
          <span>需关注</span>
          <strong>{{ coverage.summary.warningPlatforms }}</strong>
          <em>部分、陈旧、稀疏或失败</em>
        </article>
        <article class="summary-card pressure">
          <span>积压压力</span>
          <strong>{{ formatCount(coverage.summary.pressureItems) }}</strong>
          <em>通知、反思、动作、决策</em>
        </article>
        <article class="summary-card muted">
          <span>未启用通道</span>
          <strong>{{ coverage.summary.inactivePlatforms }}</strong>
          <em>不会自动写入外部平台</em>
        </article>
        <article class="summary-card gap">
          <span>覆盖缺口</span>
          <strong>{{ coverage.summary.coverageGaps }}</strong>
          <em>需主动处理的修复项</em>
        </article>
      </section>

      <section class="legend-bar" aria-label="图例">
        <strong>方向</strong>
        <span class="dir ingest">ingest</span>
        <span>平台 → Personal AI</span>
        <span class="dir push">push</span>
        <span>Personal AI → 平台</span>
        <span class="dir sync">sync</span>
        <span>双向</span>
        <span class="dir derive">derive</span>
        <span>内部派生</span>
      </section>

      <section
        v-for="group in platformGroups"
        :key="group.key"
        class="platform-section"
      >
        <div class="group-title">
          <h2>{{ group.title }}</h2>
          <span>{{ group.items.length }} 个平台</span>
        </div>
        <div class="platform-grid" :class="{ compact: group.key !== 'active' }">
          <button
            v-for="platform in group.items"
            :key="platform.id"
            type="button"
            class="platform-card"
            :class="[platform.state, { active: selectedPlatform?.id === platform.id }]"
            @click="selectedPlatformId = platform.id"
          >
            <div class="platform-top">
              <span class="platform-icon">{{ platform.icon }}</span>
              <span>
                <strong>{{ platform.name }}</strong>
                <em>{{ platform.nameEn }}</em>
              </span>
              <span class="pill" :class="platform.state">
                {{ stateLabel(platform.state) }}
              </span>
            </div>
            <p>{{ platform.headline }}</p>
            <div
              v-if="platform.qualityScoreBreakdown"
              class="score-card-row"
              :class="scoreTone(platform.qualityScore)"
              aria-label="平台质量分摘要"
            >
              <span>质量分</span>
              <strong>{{ formatCoverageScore(platform.qualityScore) }}</strong>
              <em>{{ scoreCardNote(platform) }}</em>
            </div>
            <div class="direction-row">
              <span
                v-for="direction in platform.directions"
                :key="`${platform.id}:${direction}`"
                class="dir"
                :class="direction"
              >
                {{ direction }}
              </span>
            </div>
            <div class="contribution-list">
              <div
                v-for="contribution in platform.contributions.slice(0, 3)"
                :key="contribution.id"
              >
                <span>{{ contribution.label }}</span>
                <strong>{{ formatCount(contribution.count) }}</strong>
              </div>
            </div>
          </button>
        </div>
      </section>

      <section class="workspace">
        <article class="detail-panel">
          <header class="panel-head">
            <div>
              <h2>{{ selectedPlatform?.name || '选择一个平台' }}</h2>
              <p>{{ selectedPlatform?.description }}</p>
            </div>
            <span v-if="selectedPlatform" class="pill" :class="selectedPlatform.state">
              {{ stateLabel(selectedPlatform.state) }}
            </span>
          </header>
          <div v-if="selectedPlatform" class="detail-body">
            <div class="metric-row">
              <div>
                <span>总信号</span>
                <strong>{{ formatCount(selectedPlatform.totalCount) }}</strong>
              </div>
              <div>
                <span>近 {{ coverage.staleAfterDays }} 天</span>
                <strong>{{ formatCount(selectedPlatform.recentCount) }}</strong>
              </div>
              <div>
                <span>最近信号</span>
                <strong>{{ formatTime(selectedPlatform.lastSeenAt) }}</strong>
              </div>
              <div>
                <span>质量分</span>
                <strong>{{ formatCoverageScore(selectedPlatform.qualityScore) }}</strong>
              </div>
            </div>
            <div
              v-if="selectedPlatform.qualityScoreBreakdown"
              class="score-breakdown"
              aria-label="质量分解释"
            >
              <div class="score-head">
                <strong>质量分解释</strong>
                <span>{{ formatCoverageScore(selectedPlatform.qualityScoreBreakdown.finalScore) }}</span>
              </div>
              <div class="score-factor-grid">
                <div>
                  <span>状态基准</span>
                  <strong>{{ selectedPlatform.qualityScoreBreakdown.base }}</strong>
                </div>
                <div>
                  <span>健康贡献</span>
                  <strong>+{{ selectedPlatform.qualityScoreBreakdown.healthyContributionBonus }}</strong>
                </div>
                <div>
                  <span>新鲜度</span>
                  <strong>+{{ selectedPlatform.qualityScoreBreakdown.freshnessBonus }}</strong>
                </div>
                <div>
                  <span>失败惩罚</span>
                  <strong>-{{ selectedPlatform.qualityScoreBreakdown.failingPenalty }}</strong>
                </div>
              </div>
              <div
                v-if="scorePriorityHint"
                class="score-priority-hint"
                :class="scorePriorityHint.state"
              >
                <span>优先处理</span>
                <strong>
                  {{ scorePriorityHint.label }} · {{ stateLabel(scorePriorityHint.state) }}
                </strong>
                <p>{{ scorePriorityHint.actionText }}</p>
                <div>
                  <em>{{ scorePriorityHint.countText }} · {{ scorePriorityHint.latestText }}</em>
                  <code>{{ scorePriorityHint.evidence }}</code>
                </div>
              </div>
              <ul>
                <li
                  v-for="reason in selectedPlatform.qualityScoreBreakdown.reasons"
                  :key="reason"
                >
                  {{ reason }}
                </li>
              </ul>
            </div>
            <div class="contribution-detail">
              <article
                v-for="contribution in selectedPlatform.contributions"
                :key="contribution.id"
              >
                <div>
                  <strong>{{ contribution.label }}</strong>
                  <span class="dir" :class="contribution.direction">
                    {{ directionLabel(contribution.direction) }}
                  </span>
                  <span class="pill" :class="contribution.state">
                    {{ stateLabel(contribution.state) }}
                  </span>
                </div>
                <p>{{ contribution.detail }}</p>
                <code>{{ contribution.evidence }}</code>
              </article>
            </div>
          </div>
        </article>

        <aside class="repair-panel">
          <header class="panel-head">
            <div>
              <h2>修复队列</h2>
              <p>{{ repairPanelSubtitle }}</p>
            </div>
            <div class="repair-scope-controls" role="group" aria-label="修复队列范围">
              <button
                type="button"
                :class="{ active: repairScope === 'selected' }"
                @click="repairScope = 'selected'"
              >
                当前平台
                <span>{{ selectedRepairActionCount }}</span>
              </button>
              <button
                type="button"
                :class="{ active: repairScope === 'all' }"
                @click="repairScope = 'all'"
              >
                全部
                <span>{{ globalRepairActionCount }}</span>
              </button>
            </div>
          </header>
          <div class="repair-list">
            <article
              v-for="action in visibleRepairActions"
              :key="action.id"
              :class="action.severity"
            >
              <div class="repair-action-head">
                <strong>{{ action.title }}</strong>
                <span v-if="repairScope === 'all'" class="repair-platform">
                  {{ repairPlatformName(action.platformId) }}
                </span>
              </div>
              <p>{{ action.description }}</p>
              <code>{{ action.source }}</code>
            </article>
            <div v-if="visibleRepairActions.length === 0" class="empty-state">
              <p>{{ repairEmptyText }}</p>
              <button
                v-if="repairScope === 'selected' && globalRepairActionCount > 0"
                class="inline-action"
                type="button"
                @click="repairScope = 'all'"
              >
                查看全部修复项
              </button>
            </div>
          </div>
        </aside>
      </section>

      <section class="timeline-panel">
        <div class="panel-head">
          <div>
            <h2>最近覆盖信号</h2>
            <p>用于快速判断这张地图是不是来自新鲜数据。</p>
          </div>
        </div>
        <div class="timeline-list">
          <div
            v-for="event in coverage.timeline"
            :key="event.id"
            :class="['timeline-event', event.state]"
          >
            <span>{{ formatTime(event.at) }}</span>
            <strong>{{ event.title }}</strong>
            <code>{{ event.source || 'coverage aggregate' }}</code>
          </div>
        </div>
      </section>
    </template>

    <input
      ref="importFileInput"
      class="hidden-input"
      type="file"
      accept=".md,.markdown,.txt,.json,.csv,.log,.pdf,.zip,application/zip,text/*,application/json"
      @change="handleImportFileSelected"
    />

    <div
      v-if="importDrawerOpen"
      class="drawer-backdrop"
      aria-hidden="true"
      @click="closeImportDrawer"
    ></div>
    <aside
      v-if="importDrawerOpen"
      class="import-drawer"
      aria-label="记忆录入"
    >
      <header class="drawer-head">
        <div>
          <span class="eyebrow">Memory Intake</span>
          <h2>记忆录入</h2>
          <p>粘贴、上传文档或 zip，先 dry-run 识别类型；Personal AI 备份 zip 会切到恢复模式。</p>
        </div>
        <button class="icon-btn" type="button" aria-label="关闭" @click="closeImportDrawer">
          ×
        </button>
      </header>

      <div class="drawer-body">
        <div class="source-toggle" role="group" aria-label="录入来源">
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'paste' }"
            @click="switchToPaste"
          >
            粘贴文本
          </button>
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'file' && detectedImportLabel === '文档' }"
            @click="openImportFilePicker('file')"
          >
            文档
          </button>
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'file' && detectedImportLabel === '普通 zip' }"
            @click="openImportFilePicker('file')"
          >
            普通 zip
          </button>
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'file' && detectedImportLabel === '外部 AI 历史' }"
            @click="openImportFilePicker('file')"
          >
            外部 AI
          </button>
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'backup' || isBackupRestoreCandidate }"
            @click="openImportFilePicker('backup')"
          >
            备份 zip
          </button>
        </div>

        <div class="compact-dropzone">
          <div>
            <strong>{{ selectedFileName || '选择文件或粘贴文本' }}</strong>
            <p>{{ importHintText }}</p>
          </div>
          <div class="button-row">
            <button class="btn" type="button" @click="openImportFilePicker('file')">
              选择文件
            </button>
            <button class="btn" type="button" @click="switchToPaste">
              粘贴文本
            </button>
          </div>
        </div>

        <label class="scope-row">
          <span>写入范围</span>
          <select v-model="importScope">
            <option value="work">work</option>
            <option value="personal">personal</option>
          </select>
        </label>

        <textarea
          v-if="importMode === 'paste'"
          v-model="importText"
          class="paste-box"
          placeholder="粘贴会议纪要、项目资料、偏好、AI 对话片段或 skill 草稿..."
          @input="resetImportInspection"
        ></textarea>

        <div class="analysis-summary">
          <div>
            <span>chunks</span>
            <strong>{{ importInspect?.summary.chunks ?? '-' }}</strong>
          </div>
          <div>
            <span>画像候选</span>
            <strong>{{ importInspect?.summary.profileCandidates ?? '-' }}</strong>
          </div>
          <div>
            <span>skill 线索</span>
            <strong>{{ importInspect?.summary.skillSignals ?? '-' }}</strong>
          </div>
          <div>
            <span>高风险</span>
            <strong>{{ importInspect?.summary.highRisk ?? '-' }}</strong>
          </div>
          <div v-if="isExternalAiImport">
            <span>外部 AI 对话</span>
            <strong>{{ importInspect?.summary.externalAiConversations ?? 0 }}</strong>
          </div>
          <div v-if="isExternalAiImport">
            <span>纳入消息</span>
            <strong>{{ externalAiMessageCoverageText }}</strong>
          </div>
          <div v-if="isExternalAiImport">
            <span>截断会话</span>
            <strong>{{ formatCount(importInspect?.summary.externalAiTruncatedConversations ?? 0) }}</strong>
          </div>
        </div>

        <div v-if="visibleImportWarnings.length > 0" class="import-warning-box">
          <strong>预检提醒</strong>
          <ul>
            <li v-for="warning in visibleImportWarnings" :key="warning">
              {{ warning }}
            </li>
          </ul>
        </div>

        <div
          v-if="isExternalAiImport"
          class="external-ai-review-box"
          :class="{ warn: externalAiHasTruncation }"
        >
          <strong>外部 AI 历史预检</strong>
          <p>{{ externalAiImportReviewText }}</p>
        </div>

        <div v-if="hasHighRiskImport" class="risk-review-box">
          <strong>发现 {{ importInspect?.summary.highRisk }} 个高风险词</strong>
          <p>可能包含密码、token、密钥或 private key；确认后才会写入可检索的低权重 shadow memory。</p>
          <label class="confirm-option">
            <input v-model="highRiskImportConfirmed" type="checkbox" />
            <span>确认仍以低权重 shadow memory 导入</span>
          </label>
        </div>

        <div
          v-if="isBackupRestoreCandidate"
          class="backup-restore-box"
        >
          <strong>检测到 Personal AI 备份 zip</strong>
          <p>{{ importInspect?.backup?.reason || '这个 zip 会走备份恢复，不会作为普通资料分析。' }}</p>
          <label class="replace-option">
            <input
              v-model="replaceExisting"
              type="checkbox"
              :disabled="Boolean(backupRestoreReceipt)"
            />
            <span>覆盖替换现有记忆</span>
          </label>
          <div v-if="backupPreview" class="preview-box">
            <div
              v-for="item in backupPreviewDetails"
              :key="item.label"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <div v-if="backupImpactPathGroups.length > 0" class="backup-impact-list">
            <strong>影响路径预览</strong>
            <article
              v-for="group in backupImpactPathGroups"
              :key="group.label"
              :class="group.tone"
            >
              <span>{{ group.label }}</span>
              <ul>
                <li v-for="path in group.paths" :key="path">
                  {{ path }}
                </li>
              </ul>
              <em v-if="group.remaining > 0">另有 {{ formatCount(group.remaining) }} 项未展开</em>
            </article>
          </div>
          <label
            v-if="backupRestoreReviewRequired"
            class="confirm-option backup-review-confirm"
          >
            <input v-model="backupRestoreReviewed" type="checkbox" />
            <span>已复核恢复影响路径、恢复模式和提醒</span>
          </label>
          <div v-if="backupRestoreReceipt" class="restore-receipt">
            <strong>恢复已写入</strong>
            <div
              v-for="item in backupReceiptDetails"
              :key="item.label"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <div v-if="backupWarningList.length > 0" class="backup-warning-list">
            <strong>恢复提醒</strong>
            <ul>
              <li v-for="warning in backupWarningList" :key="warning">
                {{ warning }}
              </li>
            </ul>
          </div>
        </div>

        <div v-if="importInspect" class="entry-list">
          <article
            v-for="entry in importInspect.entries.slice(0, 5)"
            :key="entry.id"
            :class="entry.status"
          >
            <div>
              <strong>{{ entry.title }}</strong>
              <span>{{ entry.kind }} · {{ formatCount(entry.sizeBytes) }} bytes</span>
            </div>
            <p v-if="entry.status === 'blocked'">{{ entry.blockedReason }}</p>
            <template v-else>
              <p>{{ entry.chunkCount }} chunks · {{ entry.path }}</p>
              <p v-if="entry.preview" class="entry-preview">{{ entry.preview }}</p>
            </template>
          </article>
        </div>

        <div v-if="importStatusText" class="import-status" :class="{ error: Boolean(importError) }">
          {{ importStatusText }}
        </div>
      </div>

      <footer class="drawer-footer">
        <button class="btn" type="button" @click="closeImportDrawer">取消</button>
        <button
          class="btn primary"
          type="button"
          :disabled="primaryImportDisabled"
          @click="handlePrimaryImportAction"
        >
          {{ primaryImportLabel }}
        </button>
      </footer>
    </aside>

    <div v-if="toastText" class="toast">{{ toastText }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import {
  getMemoryServiceClient,
  type MemoryBackupImportResponse,
  type MemoryBackupImportPreviewResponse,
  type MemoryCoverageContribution,
  type MemoryCoverageDirection,
  type MemoryCoverageMapResponse,
  type MemoryCoveragePlatform,
  type MemoryCoveragePlatformGroup,
  type MemoryCoverageRepairAction,
  type MemoryCoverageState,
  type SmartMemoryImportInspectResponse,
} from '../../services/MemoryServiceClient';

type ImportMode = 'paste' | 'file' | 'backup';

const coverage = ref<MemoryCoverageMapResponse | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const selectedPlatformId = ref('');
const repairScope = ref<'selected' | 'all'>('selected');
const exportingBackup = ref(false);
const toastText = ref('');

const importDrawerOpen = ref(false);
const importMode = ref<ImportMode>('paste');
const importScope = ref<'work' | 'personal'>('work');
const importText = ref('');
const importFile = ref<File | null>(null);
const importFileInput = ref<HTMLInputElement | null>(null);
const importInspect = ref<SmartMemoryImportInspectResponse | null>(null);
const importBusy = ref(false);
const importStatus = ref('');
const importError = ref('');
const replaceExisting = ref(false);
const backupPreview = ref<MemoryBackupImportPreviewResponse | null>(null);
const backupRestoreReceipt = ref<MemoryBackupImportResponse | null>(null);
const backupRestoreReviewed = ref(false);
const highRiskImportConfirmed = ref(false);

const groupOrder: Array<{ key: MemoryCoveragePlatformGroup; title: string }> = [
  { key: 'active', title: '已激活平台' },
  { key: 'derived', title: 'Personal AI 派生能力' },
  { key: 'inactive', title: '未启用通道' },
  { key: 'system', title: '系统入口' },
];

const scorePriorityRank: Record<MemoryCoverageState, number> = {
  failing: 0,
  pressure: 1,
  blocked: 2,
  not_configured: 3,
  stale: 4,
  sparse: 5,
  unknown: 6,
  partial: 7,
  healthy: 99,
};

const platformGroups = computed(() => {
  const platforms = coverage.value?.platforms ?? [];
  return groupOrder
    .map((group) => ({
      ...group,
      items: platforms.filter((platform) => platform.group === group.key),
    }))
    .filter((group) => group.items.length > 0);
});

const selectedPlatform = computed<MemoryCoveragePlatform | null>(() => {
  const platforms = coverage.value?.platforms ?? [];
  return (
    platforms.find((platform) => platform.id === selectedPlatformId.value) ??
    platforms[0] ??
    null
  );
});

const selectedRepairActionCount = computed(() => {
  if (!coverage.value || !selectedPlatform.value) return 0;
  return coverage.value.repairActions.filter(
    (action) => action.platformId === selectedPlatform.value?.id,
  ).length;
});

const globalRepairActionCount = computed(() => coverage.value?.repairActions.length ?? 0);

const visibleRepairActions = computed<MemoryCoverageRepairAction[]>(() => {
  if (!coverage.value) return [];
  if (repairScope.value === 'all' || !selectedPlatform.value) {
    return coverage.value.repairActions;
  }
  return coverage.value.repairActions.filter(
    (action) => action.platformId === selectedPlatform.value?.id,
  );
});

const repairPanelSubtitle = computed(() => {
  if (repairScope.value === 'all') {
    return '全部可解释的下一步，不自动改同步设置。';
  }
  const name = selectedPlatform.value?.name ?? '当前平台';
  return `${name} 的修复项；可切到全部查看全局覆盖缺口。`;
});

const repairEmptyText = computed(() => {
  if (repairScope.value === 'all') {
    return '当前没有需要处理的覆盖修复项。';
  }
  if (globalRepairActionCount.value > 0) {
    return '当前平台没有修复项，但全局仍有覆盖缺口。';
  }
  return '当前平台没有需要处理的覆盖修复项。';
});

const generatedAtText = computed(() => {
  if (!coverage.value?.generatedAt) return '尚未生成';
  return `生成于 ${formatTime(coverage.value.generatedAt)}`;
});

const serviceStatusText = computed(() => {
  if (errorMessage.value) return 'Coverage API 异常';
  if (!coverage.value) return '等待覆盖数据';
  return `${formatCount(coverage.value.summary.totalMessages)} messages · ${formatCount(
    coverage.value.summary.totalChunks,
  )} chunks · ${formatCount(coverage.value.summary.totalEntities)} entities`;
});

const selectedFileName = computed(() => importFile.value?.name ?? '');

const detectedImportLabel = computed(() => {
  const kind = importInspect.value?.detectedKind;
  if (kind === 'backup_zip') return '备份 zip';
  if (kind === 'external_ai_history') return '外部 AI 历史';
  if (kind === 'document_zip') return '普通 zip';
  if (kind === 'document') return '文档';
  return importMode.value === 'paste' ? '粘贴文本' : '文档';
});

const isBackupRestoreCandidate = computed(
  () => importInspect.value?.detectedKind === 'backup_zip',
);

const isExternalAiImport = computed(
  () => importInspect.value?.detectedKind === 'external_ai_history',
);

const importHintText = computed(() => {
  if (importInspect.value?.status === 'duplicate') {
    return '这份资料已经录入过，不会重复写入。';
  }
  if (backupRestoreReceipt.value) {
    return '恢复已经完成；如需再次恢复，请重新选择备份文件。';
  }
  if (isBackupRestoreCandidate.value) {
    return '恢复前会先 dry-run；勾选覆盖替换后才会使用 replace。';
  }
  if (isExternalAiImport.value) {
    return '已识别为外部 AI 历史；只会写入用户主动上传的低权重 shadow memory，不自动抓取原平台。';
  }
  if (importMode.value === 'backup') {
    return '请选择 Personal AI 备份 zip；系统会先验证 manifest，不会直接恢复。';
  }
  if (importFile.value) {
    return '上传后自动识别文本、文档、普通 zip 或 Personal AI 备份 zip。';
  }
  return '普通资料先分析，不会直接变成 confirmed 画像或外发上下文。';
});

const importStatusText = computed(() =>
  importError.value ? importError.value : importStatus.value,
);

const visibleImportWarnings = computed(() =>
  (importInspect.value?.warnings ?? []).filter((warning) => warning.trim().length > 0),
);

const externalAiMessageCoverageText = computed(() => {
  const summary = importInspect.value?.summary;
  if (!summary) return '-';
  const imported = summary.externalAiImportedMessages ?? 0;
  const total = summary.externalAiTotalMessages ?? imported;
  return total > 0 ? `${formatCount(imported)}/${formatCount(total)}` : '-';
});

const externalAiHasTruncation = computed(
  () => (importInspect.value?.summary.externalAiTruncatedConversations ?? 0) > 0,
);

const externalAiImportReviewText = computed(() => {
  const summary = importInspect.value?.summary;
  if (!summary) return '';
  const conversations = summary.externalAiConversations ?? summary.readyFiles;
  const importedMessages = summary.externalAiImportedMessages ?? 0;
  const totalMessages = summary.externalAiTotalMessages ?? importedMessages;
  const truncatedConversations = summary.externalAiTruncatedConversations ?? 0;
  const truncatedMessages = summary.externalAiTruncatedMessages ?? 0;
  const truncationText =
    truncatedConversations > 0
      ? `；${formatCount(truncatedConversations)} 个长会话超过上限，后续 ${formatCount(
          truncatedMessages,
        )} 条消息不会写入。`
      : '；未检测到长会话截断。';
  return `${formatCount(conversations)} 个会话，纳入 ${formatCount(
    importedMessages,
  )}/${formatCount(totalMessages)} 条消息${truncationText}`;
});

const hasHighRiskImport = computed(
  () =>
    !isBackupRestoreCandidate.value &&
    importInspect.value?.status === 'ready' &&
    (importInspect.value.summary.highRisk ?? 0) > 0,
);

const primaryImportLabel = computed(() => {
  if (importBusy.value) return '处理中...';
  if (backupRestoreReceipt.value) return '已恢复';
  if (importMode.value === 'backup' && !isBackupRestoreCandidate.value) {
    return '选择备份 zip';
  }
  if (isBackupRestoreCandidate.value) {
    return backupPreview.value ? '确认恢复' : '继续恢复';
  }
  if (!importInspect.value) return '查看 dry-run';
  if (importInspect.value.status === 'duplicate') return '已录入过';
  if (importInspect.value.status === 'blocked') return '无法录入';
  return '提交录入';
});

const primaryImportDisabled = computed(() => {
  if (importBusy.value) return true;
  if (backupRestoreReceipt.value) return true;
  if (importMode.value === 'backup' && !isBackupRestoreCandidate.value) return true;
  if (
    isBackupRestoreCandidate.value &&
    backupRestoreReviewRequired.value &&
    !backupRestoreReviewed.value
  ) {
    return true;
  }
  if (isBackupRestoreCandidate.value) return !importFile.value;
  if (importInspect.value?.status === 'duplicate') return true;
  if (importInspect.value?.status === 'blocked') return true;
  if (importMode.value === 'paste' && !importText.value.trim()) return true;
  if (importMode.value !== 'paste' && !importFile.value) return true;
  if (hasHighRiskImport.value && !highRiskImportConfirmed.value) return true;
  return false;
});

const importReadySummaryText = computed(() => {
  const inspect = importInspect.value;
  if (!inspect) return '';
  const readyCount = isExternalAiImport.value
    ? (inspect.summary.externalAiConversations ?? inspect.summary.readyFiles)
    : inspect.summary.readyFiles;
  const unit = isExternalAiImport.value ? '个 AI 会话' : '个文件';
  return `${formatCount(readyCount)} ${unit}可录入，约 ${formatCount(
    inspect.summary.chunks,
  )} 个 chunks`;
});

watch(importScope, () => resetImportInspection());
watch(replaceExisting, () => {
  if (backupRestoreReceipt.value) return;
  backupPreview.value = null;
  backupRestoreReviewed.value = false;
});

const backupPreviewDetails = computed(() => {
  const preview = backupPreview.value;
  if (!preview) return [];
  const skippedTables = preview.database.skippedTables.length;
  return [
    {
      label: '恢复模式',
      value: preview.mode === 'replace' ? 'replace：替换当前记忆' : 'merge：合并备份内容',
    },
    {
      label: '备份用户',
      value: preview.backup.userId,
    },
    {
      label: '导出时间',
      value: formatDateTimeString(preview.backup.exportedAt),
    },
    {
      label: 'DB 行数',
      value: `${formatCount(preview.database.importedRows)} 行`,
    },
    {
      label: '文件影响',
      value: `写入 ${formatCount(preview.files.written)} · 覆盖 ${formatCount(
        preview.files.overwritten,
      )} · 保留 ${formatCount(preview.files.preserved)} · 删除 ${formatCount(
        preview.files.deleted,
      )}`,
    },
    {
      label: '跳过表',
      value: skippedTables > 0 ? `${formatCount(skippedTables)} 个` : '无',
    },
  ];
});

const backupReceiptDetails = computed(() => {
  const receipt = backupRestoreReceipt.value;
  if (!receipt) return [];
  const changedRows =
    typeof receipt.database.changedRows === 'number'
      ? ` · ${formatCount(receipt.database.changedRows)} 行`
      : '';
  return [
    {
      label: '数据库',
      value: `${receipt.database.action}${changedRows}`,
    },
    {
      label: '文件',
      value: `写入 ${formatCount(receipt.files.written)} · 覆盖 ${formatCount(
        receipt.files.overwritten,
      )} · 保留 ${formatCount(receipt.files.preserved)} · 删除 ${formatCount(
        receipt.files.deleted,
      )}`,
    },
    {
      label: '完成时间',
      value: formatDateTimeString(receipt.importedAt),
    },
  ];
});

const backupWarningList = computed(() =>
  Array.from(
    new Set([
      ...(backupPreview.value?.warnings ?? []),
      ...(backupRestoreReceipt.value?.warnings ?? []),
    ]),
  ),
);

const backupImpactPathGroups = computed(() => {
  const preview = backupPreview.value;
  if (!preview) return [];
  return [
    {
      label: '将写入',
      tone: 'write',
      paths: preview.files.writtenPaths,
    },
    {
      label: '将覆盖',
      tone: 'overwrite',
      paths: preview.files.overwrittenPaths,
    },
    {
      label: '将删除',
      tone: 'delete',
      paths: preview.files.deletedPaths,
    },
  ]
    .filter((group) => group.paths.length > 0)
    .map((group) => ({
      ...group,
      paths: group.paths.slice(0, 4),
      remaining: Math.max(0, group.paths.length - 4),
    }));
});

const backupRestoreReviewRequired = computed(() => {
  const preview = backupPreview.value;
  if (!preview || backupRestoreReceipt.value) return false;
  return (
    replaceExisting.value ||
    backupWarningList.value.length > 0 ||
    preview.files.overwritten > 0 ||
    preview.files.deleted > 0
  );
});

const scorePriorityHint = computed(() => {
  const platform = selectedPlatform.value;
  const breakdown = platform?.qualityScoreBreakdown;
  if (!platform || !breakdown || breakdown.finalScore >= 80) return null;
  const contribution = pickScorePriorityContribution(platform.contributions);
  if (!contribution) return null;
  return {
    label: contribution.label,
    state: contribution.state,
    actionText: scorePriorityActionText(contribution),
    countText: `${formatCount(contribution.count)} 条信号`,
    latestText: `最近 ${formatTime(contribution.latestAt)}`,
    evidence: contribution.evidence,
  };
});

function formatCount(value: number | undefined | null): string {
  return new Intl.NumberFormat('zh-CN').format(Number(value ?? 0));
}

function formatTime(value: number | undefined | null): string {
  if (!value) return '暂无';
  return new Date(value * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateTimeString(value: string | undefined | null): string {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatCoverageScore(value: number | undefined | null): string {
  if (typeof value !== 'number') return '暂无';
  return `${Math.round(value)}/100`;
}

function scoreTone(score: number | undefined | null): string {
  if (typeof score !== 'number') return 'unknown';
  if (score >= 80) return 'good';
  if (score >= 55) return 'warn';
  return 'risk';
}

function scoreCardNote(platform: MemoryCoveragePlatform): string {
  const breakdown = platform.qualityScoreBreakdown;
  if (!breakdown) return '等待解释';
  const staleDays = coverage.value?.staleAfterDays ?? 7;
  const parts = [
    `近 ${staleDays} 天 ${Math.round(breakdown.recentRatio * 100)}%`,
  ];
  if (breakdown.failingPenalty > 0) {
    parts.push(`失败 -${breakdown.failingPenalty}`);
  } else if (breakdown.healthyContributionBonus > 0) {
    parts.push(`健康 +${breakdown.healthyContributionBonus}`);
  } else if (platform.totalCount === 0) {
    parts.push('暂无可计数信号');
  }
  return parts.join(' · ');
}

function pickScorePriorityContribution(
  contributions: MemoryCoverageContribution[],
): MemoryCoverageContribution | null {
  return (
    [...contributions]
      .filter((item) => item.state !== 'healthy')
      .sort(
        (left, right) =>
          scorePriorityRank[left.state] - scorePriorityRank[right.state] ||
          (right.count ?? 0) - (left.count ?? 0),
      )[0] ?? null
  );
}

function scorePriorityActionText(contribution: MemoryCoverageContribution): string {
  switch (contribution.state) {
    case 'failing':
      return '先检查最近一次同步或读取错误，再重跑该来源的采集链路。';
    case 'pressure':
      return '先处理积压队列，否则覆盖很多也会难以转成可执行下一步。';
    case 'blocked':
    case 'not_configured':
      return '先确认是否要启用这个通道；未启用时分数只能保持低位。';
    case 'stale':
      return `先确认这个来源近 ${coverage.value?.staleAfterDays ?? 7} 天是否应该继续产生新信号。`;
    case 'sparse':
      return '先补齐样本或确认这是低频来源，避免把少量历史信号误判成健康覆盖。';
    case 'unknown':
      return '先确认数据表、source_type 或同步回执是否存在。';
    case 'partial':
    default:
      return '先打开贡献项明细，确认缺口来自新鲜度、配置还是回执。';
  }
}

function stateLabel(state: MemoryCoverageState): string {
  const labels: Record<MemoryCoverageState, string> = {
    healthy: '健康',
    partial: '部分',
    stale: '陈旧',
    sparse: '稀疏',
    failing: '失败',
    blocked: '关闭',
    pressure: '压力',
    not_configured: '未配置',
    unknown: '未知',
  };
  return labels[state] ?? state;
}

function directionLabel(direction: MemoryCoverageDirection): string {
  const labels: Record<MemoryCoverageDirection, string> = {
    ingest: '平台 → Personal AI',
    push: 'Personal AI → 平台',
    sync: '双向同步',
    derive: '内部派生',
  };
  return labels[direction] ?? direction;
}

function repairPlatformName(platformId: string): string {
  return (
    coverage.value?.platforms.find((platform) => platform.id === platformId)?.name ??
    platformId
  );
}

function showToast(message: string) {
  toastText.value = message;
  window.setTimeout(() => {
    if (toastText.value === message) {
      toastText.value = '';
    }
  }, 3600);
}

async function loadCoverage() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const client = getMemoryServiceClient();
    const result = await client.getMemoryCoverageMap();
    coverage.value = result;
    if (
      !selectedPlatformId.value ||
      !result.platforms.some((platform) => platform.id === selectedPlatformId.value)
    ) {
      selectedPlatformId.value =
        result.platforms.find((platform) => platform.group === 'active')?.id ??
        result.platforms[0]?.id ??
        '';
    }
  } catch (error) {
    console.error('加载记忆覆盖地图失败:', error);
    errorMessage.value =
      error instanceof Error ? error.message : '加载记忆覆盖地图失败';
  } finally {
    loading.value = false;
  }
}

async function exportBackup() {
  exportingBackup.value = true;
  try {
    const result = await getMemoryServiceClient().exportMemory();
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(`已下载记忆备份：${result.fileName}`);
  } catch (error) {
    console.error('下载记忆备份失败:', error);
    showToast(error instanceof Error ? error.message : '下载记忆备份失败');
  } finally {
    exportingBackup.value = false;
  }
}

function openImportDrawer() {
  importDrawerOpen.value = true;
  importStatus.value = '请选择文件，或粘贴文本后查看 dry-run。';
  importError.value = '';
}

function closeImportDrawer() {
  importDrawerOpen.value = false;
}

function resetImportInspection() {
  importInspect.value = null;
  backupPreview.value = null;
  backupRestoreReceipt.value = null;
  importError.value = '';
  importStatus.value = '';
  backupRestoreReviewed.value = false;
  highRiskImportConfirmed.value = false;
}

function switchToPaste() {
  importMode.value = 'paste';
  importFile.value = null;
  resetImportInspection();
}

function openImportFilePicker(mode: ImportMode = 'file') {
  importMode.value = mode;
  importFileInput.value?.click();
}

async function handleImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;

  if (importMode.value !== 'backup') {
    importMode.value = 'file';
  }
  importFile.value = file;
  resetImportInspection();
  await inspectImport();
}

async function inspectImport() {
  importBusy.value = true;
  importError.value = '';
  importStatus.value = '正在分析来源类型和可录入内容...';
  backupPreview.value = null;
  backupRestoreReviewed.value = false;

  try {
    const client = getMemoryServiceClient();
    const result =
      importMode.value === 'paste'
        ? await client.inspectSmartMemoryImportText(importText.value, {
            scope: importScope.value,
          })
        : importFile.value
          ? await client.inspectSmartMemoryImportFile(importFile.value, {
              scope: importScope.value,
            })
          : null;

    if (!result) {
      throw new Error('请先选择文件或粘贴文本');
    }

    importInspect.value = result;
    if (result.detectedKind === 'backup_zip') {
      importMode.value = 'backup';
      importStatus.value = '已识别为 Personal AI 备份 zip，可继续 dry-run 恢复。';
      return;
    }

    const selectedAsBackup = importMode.value === 'backup';
    if (selectedAsBackup) {
      importMode.value = 'file';
    }
    const mismatchPrefix = selectedAsBackup
      ? '未检测到 Personal AI 备份 manifest，已按普通资料预检。'
      : '';

    if (result.status === 'duplicate') {
      importStatus.value = `${mismatchPrefix}这份资料已经录入过，本次不会重复写入。`;
      return;
    }
    if (result.status === 'blocked') {
      importStatus.value = `${mismatchPrefix}没有可录入内容，请查看阻塞原因。`;
      return;
    }
    if ((result.summary.highRisk ?? 0) > 0) {
      importStatus.value = `${mismatchPrefix}dry-run 完成：${importReadySummaryText.value}；提交前需要确认高风险资料。`;
      return;
    }
    importStatus.value = `${mismatchPrefix}dry-run 完成：${importReadySummaryText.value}。`;
  } catch (error) {
    console.error('智能记忆录入分析失败:', error);
    importError.value =
      error instanceof Error ? error.message : '智能记忆录入分析失败';
  } finally {
    importBusy.value = false;
  }
}

async function commitSmartImport() {
  if (!importInspect.value) {
    await inspectImport();
    if (!importInspect.value || importInspect.value.status !== 'ready') {
      return;
    }
  }

  if (hasHighRiskImport.value && !highRiskImportConfirmed.value) {
    importError.value = '请先确认高风险资料仍可作为低权重 shadow memory 导入。';
    return;
  }

  importBusy.value = true;
  importError.value = '';
  importStatus.value = '正在写入 shadow memory...';
  try {
    const client = getMemoryServiceClient();
    const result =
      importMode.value === 'paste'
        ? await client.commitSmartMemoryImportText(importText.value, {
            scope: importScope.value,
          })
        : importFile.value
          ? await client.commitSmartMemoryImportFile(importFile.value, {
              scope: importScope.value,
            })
          : null;

    if (!result) {
      throw new Error('请先选择文件或粘贴文本');
    }

    const receiptPrefix =
      result.detectedKind === 'external_ai_history'
        ? '外部 AI 历史录入完成'
        : '录入完成';
    importStatus.value =
      result.status === 'duplicate'
        ? '这份资料已经录入过，本次未重复写入。'
        : `${receiptPrefix}：${result.importedMessages} 条记忆，${result.importedChunks} 个 chunks。`;
    showToast(importStatus.value);
    await loadCoverage();
  } catch (error) {
    console.error('智能记忆录入失败:', error);
    importError.value =
      error instanceof Error ? error.message : '智能记忆录入失败';
  } finally {
    importBusy.value = false;
  }
}

async function continueBackupRestore() {
  if (!importFile.value) {
    importError.value = '请先选择 Personal AI 备份 zip。';
    return;
  }

  const mode = replaceExisting.value ? 'replace' : 'merge';
  if (
    mode === 'replace' &&
    !backupPreview.value &&
    !window.confirm('replace 会用备份内容替换当前记忆数据库，确认先执行 dry-run？')
  ) {
    return;
  }

  importBusy.value = true;
  importError.value = '';
  try {
    const client = getMemoryServiceClient();
    if (!backupPreview.value) {
      backupPreview.value = await client.previewImportMemory(importFile.value, mode);
      backupRestoreReviewed.value = !backupRestoreReviewRequired.value;
      importStatus.value = `dry-run 完成：${backupPreview.value.backup.includeCount} 个备份条目，模式 ${mode}。`;
      return;
    }

    if (backupRestoreReviewRequired.value && !backupRestoreReviewed.value) {
      importError.value = '请先复核恢复影响路径、恢复模式和提醒。';
      return;
    }

    if (
      mode === 'replace' &&
      !window.confirm('确认按 replace 恢复？当前记忆数据库会被备份内容替换。')
    ) {
      return;
    }

    const result = await client.importMemory(importFile.value, mode);
    backupRestoreReceipt.value = result;
    importStatus.value = `恢复完成：${result.database.action}，写入 ${result.files.written} 个文件，覆盖 ${result.files.overwritten} 个。`;
    showToast(importStatus.value);
    await loadCoverage();
  } catch (error) {
    console.error('恢复记忆备份失败:', error);
    importError.value =
      error instanceof Error ? error.message : '恢复记忆备份失败';
  } finally {
    importBusy.value = false;
  }
}

async function handlePrimaryImportAction() {
  if (isBackupRestoreCandidate.value) {
    await continueBackupRestore();
    return;
  }
  if (!importInspect.value) {
    await inspectImport();
    return;
  }
  await commitSmartImport();
}

onMounted(() => {
  void loadCoverage();
});
</script>

<style scoped>
.coverage-page {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.coverage-header,
.platform-card,
.detail-panel,
.repair-panel,
.timeline-panel,
.summary-card,
.legend-bar {
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  backdrop-filter: blur(12px);
}

.coverage-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem;
}

.eyebrow {
  color: #60a5fa;
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: #f8fafc;
}

h1 {
  margin-top: 0.35rem;
  font-size: 1.55rem;
}

h2 {
  font-size: 1rem;
}

p {
  margin: 0.45rem 0 0;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.55;
}

code {
  color: #93c5fd;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 5px;
  padding: 0.08rem 0.35rem;
  font-size: 0.72rem;
  word-break: break-word;
}

.header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.45rem;
  flex-shrink: 0;
}

.memory-action-row,
.button-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.header-meta {
  color: #94a3b8;
  font-size: 0.74rem;
}

.service-chip,
.pill,
.dir {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  white-space: nowrap;
  border-radius: 999px;
  font-weight: 700;
}

.service-chip {
  padding: 0.35rem 0.65rem;
  color: #4ade80;
  background: rgba(34, 197, 94, 0.14);
  font-size: 0.76rem;
}

.service-chip.stale {
  color: #f87171;
  background: rgba(239, 68, 68, 0.14);
}

.pulse {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: currentColor;
}

.btn {
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 7px;
  background: rgba(59, 130, 246, 0.1);
  color: #93c5fd;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.52rem 0.82rem;
}

.btn.primary {
  color: #082f49;
  background: linear-gradient(135deg, #5eead4, #93c5fd);
  border-color: transparent;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.icon-btn {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 1.2rem;
}

.status-box {
  padding: 0.8rem 1rem;
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 8px;
  color: #bfdbfe;
  background: rgba(59, 130, 246, 0.1);
}

.status-box.error,
.import-status.error {
  color: #fecaca;
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.1);
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.75rem;
}

.summary-card {
  padding: 0.85rem;
}

.summary-card span,
.summary-card em {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  font-style: normal;
}

.summary-card strong {
  display: block;
  margin: 0.38rem 0;
  color: #f8fafc;
  font-size: 1.6rem;
  line-height: 1;
}

.summary-card.good strong {
  color: #4ade80;
}

.summary-card.warn strong {
  color: #fbbf24;
}

.summary-card.pressure strong {
  color: #fb923c;
}

.summary-card.gap strong {
  color: #c4b5fd;
}

.summary-card.muted strong {
  color: #5eead4;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
  gap: 0.85rem;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: flex-start;
}

.hidden-input {
  display: none;
}

.legend-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.65rem 0.85rem;
  color: #94a3b8;
  font-size: 0.76rem;
}

.pill {
  padding: 0.18rem 0.5rem;
  font-size: 0.68rem;
}

.pill.healthy,
.pill.info,
.dir.ingest {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.14);
}

.pill.partial,
.pill.stale,
.pill.sparse,
.dir.push {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.14);
}

.pill.failing,
.pill.blocked {
  color: #f87171;
  background: rgba(239, 68, 68, 0.14);
}

.pill.pressure,
.dir.derive {
  color: #fb923c;
  background: rgba(251, 146, 60, 0.14);
}

.pill.not_configured,
.pill.unknown {
  color: #c4b5fd;
  background: rgba(167, 139, 250, 0.14);
}

.dir {
  padding: 0.16rem 0.46rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  font-size: 0.68rem;
}

.dir.sync {
  color: #5eead4;
  background: rgba(45, 212, 191, 0.14);
}

.platform-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.group-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #94a3b8;
}

.group-title h2 {
  color: #cbd5e1;
  font-size: 0.92rem;
}

.group-title span {
  font-size: 0.74rem;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 0.75rem;
}

.platform-grid.compact {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

.platform-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.9rem;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.platform-card.active {
  border-color: rgba(94, 234, 212, 0.55);
  box-shadow: 0 0 0 1px rgba(94, 234, 212, 0.12);
}

.platform-card.failing,
.platform-card.pressure {
  border-color: rgba(251, 146, 60, 0.32);
}

.platform-top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: start;
}

.platform-icon {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 7px;
  background: rgba(96, 165, 250, 0.14);
  color: #bfdbfe;
  font-size: 0.72rem;
  font-weight: 800;
}

.platform-top strong,
.platform-top em {
  display: block;
}

.platform-top strong {
  color: #f8fafc;
}

.platform-top em {
  margin-top: 0.18rem;
  color: #94a3b8;
  font-size: 0.72rem;
  font-style: normal;
}

.direction-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.score-card-row {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: 0.45rem;
  align-items: baseline;
  padding-top: 0.55rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.score-card-row span {
  color: #94a3b8;
  font-size: 0.7rem;
  font-weight: 700;
}

.score-card-row strong {
  color: #e0f2fe;
  font-size: 0.86rem;
}

.score-card-row em {
  min-width: 0;
  color: #94a3b8;
  font-size: 0.72rem;
  font-style: normal;
  overflow-wrap: anywhere;
}

.score-card-row.good strong {
  color: #5eead4;
}

.score-card-row.warn strong {
  color: #fbbf24;
}

.score-card-row.risk strong {
  color: #f87171;
}

.contribution-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.contribution-list div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: #cbd5e1;
  font-size: 0.76rem;
}

.contribution-list strong {
  color: #f8fafc;
}

.detail-panel,
.repair-panel,
.timeline-panel {
  overflow: hidden;
}

.detail-panel .panel-head,
.repair-panel .panel-head,
.timeline-panel .panel-head {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.detail-body,
.repair-list,
.timeline-list {
  padding: 1rem;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
  margin-bottom: 0.8rem;
}

.metric-row > div,
.contribution-detail article,
.repair-list article,
.timeline-event,
.compact-dropzone,
.analysis-summary > div,
.backup-restore-box,
.entry-list article,
.import-status,
.import-warning-box,
.external-ai-review-box,
.risk-review-box,
.preview-box,
.backup-impact-list,
.restore-receipt,
.backup-warning-list {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.45);
}

.metric-row > div {
  padding: 0.75rem;
}

.metric-row span,
.metric-row strong {
  display: block;
}

.metric-row span {
  color: #94a3b8;
  font-size: 0.72rem;
}

.metric-row strong {
  margin-top: 0.25rem;
  color: #f8fafc;
  font-size: 0.92rem;
}

.score-breakdown {
  margin-bottom: 0.8rem;
  padding: 0.8rem;
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.52);
}

.score-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  color: #f8fafc;
}

.score-head span {
  color: #93c5fd;
  font-size: 0.84rem;
  font-weight: 800;
}

.score-factor-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
  margin: 0.65rem 0;
}

.score-factor-grid > div {
  padding: 0.55rem;
  border-radius: 7px;
  background: rgba(30, 41, 59, 0.62);
}

.score-factor-grid span,
.score-factor-grid strong {
  display: block;
}

.score-factor-grid span {
  color: #94a3b8;
  font-size: 0.68rem;
}

.score-factor-grid strong {
  margin-top: 0.2rem;
  color: #e0f2fe;
  font-size: 0.9rem;
}

.score-priority-hint {
  margin: 0.7rem 0;
  padding: 0.68rem 0.72rem;
  border: 1px solid rgba(251, 191, 36, 0.28);
  border-radius: 7px;
  background: rgba(146, 64, 14, 0.16);
}

.score-priority-hint > span,
.score-priority-hint em {
  display: block;
  color: #fde68a;
  font-size: 0.68rem;
  font-style: normal;
}

.score-priority-hint strong {
  display: block;
  margin-top: 0.18rem;
  color: #fef3c7;
  font-size: 0.86rem;
}

.score-priority-hint p {
  margin: 0.4rem 0;
  color: #e2e8f0;
  font-size: 0.76rem;
  line-height: 1.45;
}

.score-priority-hint code {
  display: block;
  margin-top: 0.35rem;
  white-space: normal;
  word-break: break-word;
}

.score-priority-hint.failing,
.score-priority-hint.pressure {
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(127, 29, 29, 0.18);
}

.score-breakdown ul {
  margin: 0;
  padding-left: 1.05rem;
  color: #cbd5e1;
  font-size: 0.76rem;
  line-height: 1.55;
}

.contribution-detail {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.contribution-detail article {
  padding: 0.75rem;
}

.contribution-detail article > div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.contribution-detail strong {
  color: #f8fafc;
}

.repair-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.repair-scope-controls {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.52);
}

.repair-scope-controls button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.34rem 0.48rem;
  white-space: nowrap;
}

.repair-scope-controls button.active {
  color: #0f172a;
  background: #5eead4;
}

.repair-scope-controls span {
  font-variant-numeric: tabular-nums;
}

.repair-list article {
  padding: 0.75rem;
  border-left: 3px solid rgba(96, 165, 250, 0.5);
}

.repair-list article.warning {
  border-left-color: #f59e0b;
}

.repair-list article.critical {
  border-left-color: #ef4444;
}

.repair-list strong {
  color: #f8fafc;
  font-size: 0.86rem;
}

.repair-action-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  justify-content: space-between;
}

.repair-platform {
  color: #5eead4;
  font-size: 0.7rem;
  font-weight: 800;
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  align-items: center;
  padding: 1rem;
  color: #94a3b8;
  text-align: center;
}

.empty-state p {
  margin: 0;
}

.inline-action {
  border: 1px solid rgba(94, 234, 212, 0.26);
  border-radius: 7px;
  background: rgba(45, 212, 191, 0.12);
  color: #99f6e4;
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  padding: 0.45rem 0.68rem;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.timeline-event {
  display: grid;
  grid-template-columns: 7.2rem minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: center;
  padding: 0.65rem 0.8rem;
  border-left: 3px solid rgba(96, 165, 250, 0.45);
}

.timeline-event.failing,
.timeline-event.pressure {
  border-left-color: #fb923c;
}

.timeline-event span {
  color: #94a3b8;
  font-size: 0.74rem;
}

.timeline-event strong {
  color: #e2e8f0;
  font-size: 0.82rem;
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(2, 6, 23, 0.58);
}

.import-drawer {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 41;
  display: flex;
  width: min(440px, calc(100vw - 1rem));
  height: 100vh;
  flex-direction: column;
  border-left: 1px solid rgba(148, 163, 184, 0.18);
  background: #101827;
  box-shadow: -22px 0 60px rgba(2, 6, 23, 0.35);
}

.drawer-head,
.drawer-footer {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.drawer-footer {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  border-bottom: 0;
}

.drawer-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.85rem;
  overflow: auto;
  padding: 1rem;
}

.source-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.source-chip {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.52);
  color: #cbd5e1;
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 0.42rem 0.68rem;
}

.source-chip.active {
  color: #0f172a;
  background: #5eead4;
}

.compact-dropzone {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
  padding: 0.85rem;
}

.compact-dropzone strong {
  display: block;
  color: #f8fafc;
}

.scope-row,
.replace-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: #cbd5e1;
  font-size: 0.82rem;
  font-weight: 700;
}

.scope-row select {
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 7px;
  background: rgba(15, 23, 42, 0.72);
  color: #f8fafc;
  padding: 0.42rem 0.55rem;
}

.paste-box {
  min-height: 9rem;
  resize: vertical;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.64);
  color: #e2e8f0;
  font: inherit;
  font-size: 0.82rem;
  line-height: 1.55;
  padding: 0.75rem;
}

.analysis-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(82px, 1fr));
  gap: 0.45rem;
}

.analysis-summary > div {
  padding: 0.65rem;
}

.analysis-summary span,
.analysis-summary strong {
  display: block;
}

.analysis-summary span {
  color: #94a3b8;
  font-size: 0.66rem;
}

.analysis-summary strong {
  margin-top: 0.22rem;
  color: #f8fafc;
}

.backup-restore-box,
.entry-list article,
.import-status,
.import-warning-box,
.external-ai-review-box,
.risk-review-box,
.backup-impact-list,
.restore-receipt,
.backup-warning-list {
  padding: 0.75rem;
}

.backup-restore-box {
  border-color: rgba(251, 191, 36, 0.24);
}

.backup-restore-box > strong {
  color: #fef3c7;
}

.import-warning-box,
.backup-warning-list {
  border-color: rgba(96, 165, 250, 0.22);
  color: #bfdbfe;
}

.import-warning-box strong,
.external-ai-review-box strong,
.risk-review-box strong,
.backup-warning-list strong,
.restore-receipt > strong {
  color: #f8fafc;
  font-size: 0.82rem;
}

.import-warning-box ul,
.backup-warning-list ul {
  margin: 0.45rem 0 0;
  padding-left: 1.1rem;
  color: #cbd5e1;
  font-size: 0.76rem;
  line-height: 1.45;
}

.external-ai-review-box {
  color: #c7d2fe;
  font-size: 0.78rem;
  line-height: 1.5;
}

.external-ai-review-box.warn {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(120, 53, 15, 0.16);
  color: #fde68a;
}

.external-ai-review-box p {
  margin: 0.35rem 0 0;
  color: inherit;
}

.risk-review-box {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(120, 53, 15, 0.2);
}

.confirm-option {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  margin-top: 0.65rem;
  color: #fde68a;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.4;
}

.replace-option {
  justify-content: flex-start;
  margin-top: 0.65rem;
}

.preview-box {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.65rem;
  padding: 0.6rem;
  color: #cbd5e1;
  font-size: 0.76rem;
}

.preview-box div,
.restore-receipt div {
  min-width: 0;
}

.preview-box span,
.preview-box strong,
.restore-receipt span,
.restore-receipt strong {
  display: block;
}

.preview-box span,
.restore-receipt span {
  color: #94a3b8;
  font-size: 0.68rem;
}

.preview-box strong,
.restore-receipt strong {
  margin-top: 0.18rem;
  color: #e2e8f0;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.backup-impact-list {
  margin-top: 0.65rem;
  color: #cbd5e1;
}

.backup-impact-list > strong {
  display: block;
  color: #f8fafc;
  font-size: 0.82rem;
  margin-bottom: 0.55rem;
}

.backup-impact-list article {
  border-left: 3px solid rgba(94, 234, 212, 0.54);
  padding-left: 0.65rem;
}

.backup-impact-list article + article {
  margin-top: 0.65rem;
}

.backup-impact-list article.overwrite {
  border-left-color: rgba(251, 191, 36, 0.72);
}

.backup-impact-list article.delete {
  border-left-color: rgba(248, 113, 113, 0.72);
}

.backup-impact-list span {
  display: block;
  color: #e2e8f0;
  font-size: 0.76rem;
  font-weight: 800;
}

.backup-impact-list ul {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0.4rem 0 0;
  padding-left: 1rem;
  font-size: 0.75rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.backup-impact-list em {
  display: block;
  margin-top: 0.35rem;
  color: #94a3b8;
  font-size: 0.72rem;
  font-style: normal;
}

.backup-review-confirm {
  margin-top: 0.65rem;
}

.restore-receipt,
.backup-warning-list {
  margin-top: 0.65rem;
}

.restore-receipt {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  border-color: rgba(94, 234, 212, 0.26);
  background: rgba(20, 83, 45, 0.18);
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.entry-list article.blocked {
  border-color: rgba(239, 68, 68, 0.28);
}

.entry-list article > div {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
}

.entry-list strong {
  color: #f8fafc;
  font-size: 0.82rem;
}

.entry-list span {
  color: #94a3b8;
  font-size: 0.72rem;
  white-space: nowrap;
}

.entry-preview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  color: #bfdbfe;
}

.import-status {
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.45;
}

.toast {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 50;
  max-width: min(26rem, calc(100vw - 2rem));
  border: 1px solid rgba(94, 234, 212, 0.28);
  border-radius: 8px;
  background: #0f172a;
  color: #ccfbf1;
  box-shadow: 0 18px 42px rgba(2, 6, 23, 0.32);
  font-size: 0.82rem;
  padding: 0.75rem 0.9rem;
}

@media (max-width: 1280px) {
  .summary-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .coverage-header,
  .panel-head,
  .compact-dropzone {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    align-items: flex-start;
  }

  .memory-action-row {
    justify-content: flex-start;
  }

  .summary-strip,
  .metric-row,
  .score-factor-grid,
  .analysis-summary,
  .preview-box {
    grid-template-columns: 1fr;
  }

  .timeline-event {
    grid-template-columns: 1fr;
  }
}
</style>
