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
          <button
            class="btn"
            type="button"
            :title="smartImportEntryActionBoundary"
            :aria-label="smartImportEntryActionBoundary"
            @click="openImportDrawer"
          >
            录入
          </button>
          <button
            class="btn primary"
            type="button"
            :disabled="exportingBackup"
            :title="backupExportActionBoundary"
            :aria-label="backupExportActionBoundary"
            @click="exportBackup"
          >
            {{ exportingBackup ? '下载中...' : '记忆备份' }}
          </button>
          <button
            class="btn primary"
            type="button"
            :disabled="loading"
            :title="manualCoverageRefreshActionBoundary"
            :aria-label="manualCoverageRefreshActionBoundary"
            @click="refreshCoverageManually"
          >
            {{ loading ? '刷新中...' : '重扫覆盖' }}
          </button>
        </div>
      </div>
    </header>

    <section
      v-if="showBackupPreActionReceipt"
      class="backup-preaction-receipt"
      aria-label="备份操作前回执"
    >
      <div>
        <span>备份操作前回执</span>
        <strong>下载前先确认边界</strong>
      </div>
      <p>{{ backupPreActionReceiptText }}</p>
    </section>
    <section
      v-if="showBackupDownloadPendingReceipt"
      class="backup-download-pending-receipt"
      aria-label="备份下载提交中回执"
    >
      <div>
        <span>备份下载提交中回执</span>
        <strong>正在请求 backup zip</strong>
      </div>
      <dl>
        <div
          v-for="item in backupDownloadPendingReceiptItems"
          :key="item.label"
        >
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <div v-if="errorMessage" class="status-box error">
      {{ errorMessage }}
    </div>
    <div v-if="loading && !coverage" class="status-box">加载记忆覆盖状态中...</div>
    <section
      v-if="backupDownloadReceipt"
      class="backup-download-receipt"
      aria-label="备份下载回执"
    >
      <div>
        <span>备份下载回执</span>
        <strong>{{ backupDownloadReceipt.fileName }}</strong>
      </div>
      <div class="backup-receipt-body">
        <p>{{ backupDownloadReceiptText }}</p>
        <dl
          v-if="backupDownloadManifestItems.length > 0"
          class="backup-download-manifest"
          aria-label="备份 manifest 摘要"
        >
          <div
            v-for="item in backupDownloadManifestItems"
            :key="item.label"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </section>
    <section
      v-if="backupDownloadFailureReceipt"
      class="backup-download-failure-receipt"
      aria-label="备份下载失败回执"
    >
      <div>
        <span>备份下载失败回执</span>
        <strong>未保存备份 zip</strong>
      </div>
      <p>{{ backupDownloadFailureReceiptText }}</p>
    </section>

    <template v-if="coverage">
      <section
        class="snapshot-receipt"
        :class="{ warn: Boolean(errorMessage) || coverageSnapshotIsStale, loading }"
        aria-label="覆盖快照回执"
      >
        <div>
          <span>覆盖快照</span>
          <strong>{{ coverageSnapshotReceiptTitle }}</strong>
        </div>
        <p>{{ coverageSnapshotReceiptText }}</p>
      </section>

      <section
        v-if="manualCoverageRefreshReceipt"
        class="manual-refresh-receipt"
        :class="manualCoverageRefreshReceipt.status"
        aria-label="重扫覆盖回执"
      >
        <div>
          <span>重扫覆盖回执</span>
          <strong>{{ manualCoverageRefreshReceiptTitle }}</strong>
        </div>
        <dl>
          <div
            v-for="item in manualCoverageRefreshReceiptItems"
            :key="item.label"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </section>

      <section
        class="coverage-diagnostics"
        :class="{
          loading: coverageDiagnosticsLoading,
          error: Boolean(coverageDiagnosticsError),
        }"
        aria-label="P0 只读诊断切片"
      >
        <header class="coverage-diagnostics-head">
          <div>
            <span>P0 只读诊断切片</span>
            <strong>{{ coverageDiagnosticsTitle }}</strong>
          </div>
          <button
            class="inline-action"
            type="button"
            :disabled="coverageDiagnosticsLoading"
            :title="coverageDiagnosticsRefreshActionBoundary"
            :aria-label="coverageDiagnosticsRefreshActionBoundary"
            @click="refreshCoverageDiagnostics"
          >
            {{ coverageDiagnosticsLoading ? '读取中...' : '刷新切片' }}
          </button>
        </header>
        <p>{{ coverageDiagnosticsText }}</p>
        <div
          v-if="coverageDiagnostics.length > 0"
          class="coverage-diagnostics-grid"
        >
          <article
            v-for="slice in coverageDiagnostics"
            :key="slice.receipt.slice"
            class="coverage-diagnostic-card"
          >
            <div>
              <span>{{ diagnosticSliceLabel(slice.receipt.slice) }}</span>
              <strong>{{ diagnosticSlicePrimaryText(slice) }}</strong>
            </div>
            <dl>
              <div
                v-for="item in diagnosticSliceReceiptItems(slice)"
                :key="item.label"
              >
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
            <p>{{ slice.receipt.boundary }}</p>
          </article>
        </div>
        <div
          v-else
          class="coverage-diagnostics-empty"
          aria-label="P0 只读诊断切片空态"
        >
          {{ coverageDiagnosticsEmptyText }}
        </div>
      </section>

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

      <section
        v-if="qualityFocusPlatform"
        class="quality-focus"
        :class="scoreTone(qualityFocusPlatform.qualityScore)"
        aria-label="质量分焦点"
      >
        <div>
          <span>优先处理</span>
          <strong>
            {{ qualityFocusPlatform.name }} · {{ formatCoverageScore(qualityFocusPlatform.qualityScore) }}
          </strong>
          <p>{{ qualityFocusText }}</p>
          <dl
            v-if="qualityFocusReceiptItems.length"
            class="quality-focus-receipt"
            aria-label="质量分焦点回执"
          >
            <div
              v-for="item in qualityFocusReceiptItems"
              :key="item.label"
            >
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </div>
        <button
          class="inline-action"
          type="button"
          :title="qualityFocusActionBoundary"
          :aria-label="qualityFocusActionBoundary"
          @click="focusQualityPlatform"
        >
          查看平台
        </button>
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
        <div class="platform-sort-control" role="group" aria-label="平台排序">
          <span>排序</span>
          <button
            type="button"
            :class="{ active: platformSortMode === 'default' }"
            :title="defaultSortActionBoundary"
            :aria-label="defaultSortActionBoundary"
            @click="platformSortMode = 'default'"
          >
            默认
          </button>
          <button
            type="button"
            :class="{ active: platformSortMode === 'lowScore' }"
            :title="lowScoreSortActionBoundary"
            :aria-label="lowScoreSortActionBoundary"
            @click="platformSortMode = 'lowScore'"
          >
            低分优先
          </button>
        </div>
      </section>

      <section
        v-if="platformSortMode === 'lowScore'"
        class="sort-receipt"
        aria-label="质量分排序回执"
      >
        <span>质量分排序回执</span>
        <dl>
          <div
            v-for="item in lowScoreSortReceiptItems"
            :key="item.label"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
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
                v-if="scoreSnapshotReceiptItems.length"
                class="score-snapshot-receipt"
                aria-label="质量分快照口径"
              >
                <span>质量分快照口径</span>
                <dl>
                  <div
                    v-for="item in scoreSnapshotReceiptItems"
                    :key="item.label"
                  >
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                  </div>
                </dl>
              </div>
              <div
                v-if="scoreBoundaryItems.length"
                class="score-boundary-receipt"
                aria-label="质量分边界"
              >
                <span>质量分边界</span>
                <dl>
                  <div
                    v-for="item in scoreBoundaryItems"
                    :key="item.label"
                  >
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                  </div>
                </dl>
              </div>
              <div
                v-if="scoreRouteReceiptItems.length"
                class="score-route-receipt"
                aria-label="质量分修复路线"
              >
                <span>质量分修复路线</span>
                <dl>
                  <div
                    v-for="item in scoreRouteReceiptItems"
                    :key="item.label"
                  >
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                  </div>
                </dl>
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
                {{ repairEmptyActionLabel }}
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
        <div
          class="timeline-receipt"
          aria-label="最近覆盖信号回执"
        >
          <strong>{{ timelineReceiptTitle }}</strong>
          <p>{{ timelineReceiptText }}</p>
          <dl
            v-if="timelineReceiptItems.length"
            class="timeline-receipt-grid"
            aria-label="最近覆盖信号切片说明"
          >
            <div
              v-for="item in timelineReceiptItems"
              :key="item.label"
            >
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </div>
        <div v-if="coverage.timeline.length > 0" class="timeline-list">
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
        <div
          v-else
          class="timeline-empty-state"
          aria-label="最近覆盖信号空态"
        >
          <strong>暂无可排序的最近信号</strong>
          <p>
            当前快照没有返回带 lastSeenAt 的平台事件；这只能说明本轮聚合没有可排序的新鲜度线索，不能据此判断所有来源健康。
          </p>
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
      @click="handleImportBackdropClick"
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
        <button
          class="icon-btn"
          type="button"
          :title="importCloseActionBoundary"
          :aria-label="importCloseActionBoundary"
          @click="closeImportDrawer"
        >
          ×
        </button>
      </header>

      <div class="drawer-body">
        <div class="source-toggle" role="group" aria-label="录入来源">
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'paste' }"
            :disabled="importBusy"
            :title="importSourceControlBoundary('粘贴文本')"
            :aria-label="importSourceControlBoundary('粘贴文本')"
            @click="switchToPaste"
          >
            粘贴文本
          </button>
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'file' && detectedImportLabel === '文档' }"
            :disabled="importBusy"
            :title="importSourceControlBoundary('文档')"
            :aria-label="importSourceControlBoundary('文档')"
            @click="openImportFilePicker('file')"
          >
            文档
          </button>
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'file' && detectedImportLabel === '普通 zip' }"
            :disabled="importBusy"
            :title="importSourceControlBoundary('普通 zip')"
            :aria-label="importSourceControlBoundary('普通 zip')"
            @click="openImportFilePicker('file')"
          >
            普通 zip
          </button>
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'file' && detectedImportLabel === '外部 AI 历史' }"
            :disabled="importBusy"
            :title="importSourceControlBoundary('外部 AI')"
            :aria-label="importSourceControlBoundary('外部 AI')"
            @click="openImportFilePicker('file')"
          >
            外部 AI
          </button>
          <button
            type="button"
            class="source-chip"
            :class="{ active: importMode === 'backup' || isBackupRestoreCandidate }"
            :disabled="importBusy"
            :title="backupZipModeButtonBoundary"
            :aria-label="backupZipModeButtonBoundary"
            @click="openImportFilePicker('backup')"
          >
            备份 zip
          </button>
        </div>

        <div
          v-if="showSmartImportScopeReceipt"
          class="smart-import-scope-receipt"
          aria-label="智能录入范围回执"
        >
          <strong>智能录入范围回执</strong>
          <div
            v-for="item in smartImportScopeReceiptItems"
            :key="item.label"
          >
            <span>{{ item.label }}</span>
            <p>{{ item.value }}</p>
          </div>
        </div>

        <div class="compact-dropzone">
          <div>
            <strong>{{ selectedFileName || '选择文件或粘贴文本' }}</strong>
            <p>{{ importHintText }}</p>
          </div>
          <div class="button-row">
            <button
              class="btn"
              type="button"
              :disabled="importBusy"
              :title="importFilePickerBoundary"
              :aria-label="importFilePickerBoundary"
              @click="openImportFilePicker('file')"
            >
              选择文件
            </button>
            <button
              class="btn"
              type="button"
              :disabled="importBusy"
              :title="importSourceControlBoundary('粘贴文本')"
              :aria-label="importSourceControlBoundary('粘贴文本')"
              @click="switchToPaste"
            >
              粘贴文本
            </button>
          </div>
        </div>

        <label v-if="showImportScopeSelector" class="scope-row">
          <span>写入范围</span>
          <select
            v-model="importScope"
            :disabled="importBusy"
            :title="importScopeSelectorBoundary"
            :aria-label="importScopeSelectorBoundary"
          >
            <option value="work">work</option>
            <option value="personal">personal</option>
          </select>
        </label>

        <div
          v-if="showBackupRestoreTargetReceipt"
          class="backup-restore-target-receipt"
          aria-label="备份恢复目标回执"
        >
          <strong>备份恢复目标回执</strong>
          <div
            v-for="item in backupRestoreTargetItems"
            :key="item.label"
          >
            <span>{{ item.label }}</span>
            <p>{{ item.value }}</p>
          </div>
        </div>

        <textarea
          v-if="importMode === 'paste'"
          v-model="importText"
          class="paste-box"
          placeholder="粘贴会议纪要、项目资料、偏好、AI 对话片段或 skill 草稿..."
          :disabled="importBusy"
          :title="importTextInputBoundary"
          :aria-label="importTextInputBoundary"
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
          <div v-if="showDocumentImportReview">
            <span>阻塞文件</span>
            <strong>{{ formatCount(importInspect?.summary.unsupported ?? 0) }}</strong>
          </div>
          <div v-if="documentImportSkippedFiles > 0">
            <span>未预检</span>
            <strong>{{ formatCount(documentImportSkippedFiles) }}</strong>
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
          <div v-if="isExternalAiImport">
            <span>跳过非文本</span>
            <strong>{{ formatCount(importInspect?.summary.externalAiSkippedParts ?? 0) }}</strong>
          </div>
          <div v-if="isExternalAiImport && externalAiIgnoredFiles > 0">
            <span>忽略文件</span>
            <strong>{{ formatCount(externalAiIgnoredFiles) }}</strong>
          </div>
        </div>

        <div
          v-if="showDocumentImportReview"
          class="document-import-review-box"
          :class="{ warn: documentImportHasOmissions }"
        >
          <strong>资料预检回执</strong>
          <p>{{ documentImportReviewText }}</p>
        </div>

        <div
          v-if="showDocumentImportRecoveryReceipt"
          class="smart-import-receipt document-import-recovery-receipt"
          aria-label="资料录入恢复回执"
        >
          <strong>资料录入恢复回执</strong>
          <div
            v-for="item in documentImportRecoveryReceiptItems"
            :key="item.label"
          >
            <span>{{ item.label }}</span>
            <p>{{ item.value }}</p>
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
          :class="{ warn: externalAiHasOmissions }"
        >
          <strong>外部 AI 导入范围</strong>
          <p>{{ externalAiImportReviewText }}</p>
        </div>

        <div
          v-if="isExternalAiImport"
          class="external-ai-decision-box"
          aria-label="外部 AI 提交前回执"
        >
          <strong>提交前会发生什么</strong>
          <div
            v-for="item in externalAiDecisionReceiptItems"
            :key="item.label"
          >
            <span>{{ item.label }}</span>
            <p>{{ item.value }}</p>
          </div>
        </div>

        <div
          v-if="showExternalAiCommitPendingReceipt"
          class="external-ai-pending-box"
          aria-label="外部 AI 写入提交中回执"
        >
          <strong>外部 AI 写入提交中回执</strong>
          <div
            v-for="item in externalAiCommitPendingReceiptItems"
            :key="item.label"
          >
            <span>{{ item.label }}</span>
            <p>{{ item.value }}</p>
          </div>
        </div>

        <div
          v-if="showSmartImportCommitPendingReceipt"
          class="smart-import-receipt smart-import-pending-receipt"
          aria-label="资料写入提交中回执"
        >
          <strong>资料写入提交中回执</strong>
          <div
            v-for="item in smartImportCommitPendingReceiptItems"
            :key="item.label"
          >
            <span>{{ item.label }}</span>
            <p>{{ item.value }}</p>
          </div>
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
          v-if="showDuplicateImportReceipt"
          class="smart-import-receipt duplicate-import-receipt"
          aria-label="重复录入回执"
        >
          <strong>重复录入回执</strong>
          <div
            v-for="item in duplicateImportReceiptDetails"
            :key="item.label"
          >
            <span>{{ item.label }}</span>
            <p>{{ item.value }}</p>
          </div>
        </div>

        <div
          v-if="smartImportReceipt"
          class="smart-import-receipt"
          aria-label="录入完成回执"
        >
          <strong>{{ smartImportReceiptTitle }}</strong>
          <div
            v-for="item in smartImportReceiptDetails"
            :key="item.label"
          >
            <span>{{ item.label }}</span>
            <p>{{ item.value }}</p>
          </div>
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
          <div
            v-if="showBackupRestorePreviewGate"
            class="backup-restore-preview-gate"
            aria-label="备份恢复预览门禁"
          >
            <strong>备份恢复预览门禁</strong>
            <div
              v-for="item in backupRestorePreviewGateItems"
              :key="item.label"
            >
              <span>{{ item.label }}</span>
              <p>{{ item.value }}</p>
            </div>
          </div>
          <div v-if="backupPreview" class="preview-box">
            <div
              v-for="item in backupPreviewDetails"
              :key="item.label"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <div v-if="backupUserMismatch" class="backup-warning-list">
            <strong>跨用户恢复确认</strong>
            <p>
              备份属于 {{ backupPreview?.backup.userId }}，当前恢复目标是
              {{ backupPreview?.backup.targetUserId }}；这适合主动迁移账号，不适合误选文件。
            </p>
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
          <div
            v-if="backupReplaceConfirmRequired"
            class="replace-confirmation-box"
            aria-label="replace 写入确认"
          >
            <strong>replace 写入确认</strong>
            <p>
              dry-run 已按 replace 展示影响范围；真正恢复会用备份内容替换当前记忆数据库，只保留预览里声明保留的文件路径。
            </p>
            <label class="confirm-option">
              <input v-model="replaceRestoreConfirmed" type="checkbox" />
              <span>确认按 replace 替换当前记忆数据库</span>
            </label>
          </div>
          <label
            v-if="backupRestoreReviewRequired"
            class="confirm-option backup-review-confirm"
          >
            <input v-model="backupRestoreReviewed" type="checkbox" />
            <span>
              {{
                backupUserMismatch
                  ? '已复核恢复影响路径、恢复模式和提醒，并确认跨用户恢复'
                  : '已复核恢复影响路径、恢复模式和提醒'
              }}
            </span>
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
          <div
            v-if="backupRestoreFailureReceipt"
            class="restore-failure-receipt"
            aria-label="恢复失败回执"
          >
            <strong>恢复未写入</strong>
            <div
              v-for="item in backupRestoreFailureItems"
              :key="item.label"
            >
              <span>{{ item.label }}</span>
              <p>{{ item.value }}</p>
            </div>
          </div>
          <div
            v-if="backupRestoreReceipt"
            class="restore-next-step-receipt"
            aria-label="恢复后续回执"
          >
            <strong>恢复后续回执</strong>
            <div
              v-for="item in backupRestoreNextStepItems"
              :key="item.label"
            >
              <span>{{ item.label }}</span>
              <p>{{ item.value }}</p>
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
        <button
          class="btn"
          type="button"
          :title="importCloseActionBoundary"
          :aria-label="importCloseActionBoundary"
          @click="closeImportDrawer"
        >
          取消
        </button>
        <button
          class="btn primary"
          type="button"
          :disabled="primaryImportDisabled"
          :title="primaryImportActionBoundary"
          :aria-label="primaryImportActionBoundary"
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
  type MemoryBackupDownloadManifestSummary,
  type MemoryBackupImportResponse,
  type MemoryBackupImportPreviewResponse,
  type MemoryCoverageContribution,
  type MemoryCoverageDiagnosticSliceResponse,
  type MemoryCoverageDirection,
  type MemoryCoverageMapResponse,
  type MemoryCoveragePlatform,
  type MemoryCoveragePlatformGroup,
  type MemoryCoveragePriorityFocus,
  type MemoryCoverageRepairAction,
  type MemoryCoverageSliceName,
  type MemoryCoverageState,
  type SmartMemoryImportCommitResponse,
  type SmartMemoryImportInspectResponse,
} from '../../services/MemoryServiceClient';

type ImportMode = 'paste' | 'file' | 'backup';
interface BackupDownloadReceipt {
  fileName: string;
  contentType: string;
  downloadedAt: number;
  sizeBytes: number;
  manifest?: MemoryBackupDownloadManifestSummary;
}

interface BackupDownloadFailureReceipt {
  failedAt: number;
  message: string;
}

interface BackupRestoreFailureReceipt {
  stage: 'dry_run' | 'write';
  mode: 'merge' | 'replace';
  failedAt: number;
  fileName: string;
  message: string;
  hadPreview: boolean;
  backupUserId?: string;
  targetUserId?: string;
  includeCount?: number;
  archiveSha256?: string;
}

interface BackupRestoreCoverageRefreshReceipt {
  status: 'refreshing' | 'succeeded' | 'failed';
  at: number;
  message?: string;
}

interface ManualCoverageRefreshReceipt {
  status: 'refreshing' | 'succeeded' | 'failed';
  requestedAt: number;
  completedAt?: number;
  previousGeneratedAt?: number | null;
  previousReadAt?: number | null;
  nextGeneratedAt?: number | null;
  nextReadAt?: number | null;
  summary?: MemoryCoverageMapResponse['summary'];
  message?: string;
}

const coverage = ref<MemoryCoverageMapResponse | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const coverageReadAt = ref<number | null>(null);
const coverageRefreshFailedAt = ref<number | null>(null);
const manualCoverageRefreshReceipt =
  ref<ManualCoverageRefreshReceipt | null>(null);
const coverageDiagnostics = ref<MemoryCoverageDiagnosticSliceResponse[]>([]);
const coverageDiagnosticsLoading = ref(false);
const coverageDiagnosticsError = ref('');
const coverageDiagnosticsReadAt = ref<number | null>(null);
const selectedPlatformId = ref('');
const repairScope = ref<'selected' | 'all'>('selected');
const platformSortMode = ref<'default' | 'lowScore'>('default');
const exportingBackup = ref(false);
const backupExportRequestedAt = ref<number | null>(null);
const backupDownloadReceipt = ref<BackupDownloadReceipt | null>(null);
const backupDownloadFailureReceipt = ref<BackupDownloadFailureReceipt | null>(null);
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
const smartImportCommitPending = ref(false);
const replaceExisting = ref(false);
const backupPreview = ref<MemoryBackupImportPreviewResponse | null>(null);
const backupRestoreReceipt = ref<MemoryBackupImportResponse | null>(null);
const backupRestoreFailureReceipt = ref<BackupRestoreFailureReceipt | null>(null);
const backupRestoreCoverageRefresh =
  ref<BackupRestoreCoverageRefreshReceipt | null>(null);
const smartImportReceipt = ref<SmartMemoryImportCommitResponse | null>(null);
const backupRestoreReviewed = ref(false);
const replaceRestoreConfirmed = ref(false);
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
const TIMELINE_VISIBLE_LIMIT = 8;

const platformGroups = computed(() => {
  const platforms = coverage.value?.platforms ?? [];
  return groupOrder
    .map((group) => ({
      ...group,
      items: sortPlatformsForGroup(
        platforms.filter((platform) => platform.group === group.key),
        group.key,
      ),
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

function isCoverageGapAction(action: MemoryCoverageRepairAction): boolean {
  return action.severity !== 'info';
}

const selectedRepairActionCount = computed(() => {
  if (!coverage.value || !selectedPlatform.value) return 0;
  return coverage.value.repairActions.filter(
    (action) => action.platformId === selectedPlatform.value?.id,
  ).length;
});

const globalRepairActionCount = computed(() => coverage.value?.repairActions.length ?? 0);

const selectedCoverageGapActionCount = computed(() => {
  if (!coverage.value || !selectedPlatform.value) return 0;
  return coverage.value.repairActions.filter(
    (action) =>
      action.platformId === selectedPlatform.value?.id && isCoverageGapAction(action),
  ).length;
});

const globalCoverageGapActionCount = computed(
  () => coverage.value?.repairActions.filter(isCoverageGapAction).length ?? 0,
);

const selectedPlanningActionCount = computed(() => {
  if (!coverage.value || !selectedPlatform.value) return 0;
  return coverage.value.repairActions.filter(
    (action) =>
      action.platformId === selectedPlatform.value?.id && action.severity === 'info',
  ).length;
});

const globalPlanningActionCount = computed(
  () =>
    coverage.value?.repairActions.filter((action) => action.severity === 'info')
      .length ?? 0,
);

const lowScoreSortedPlatformCount = computed(
  () =>
    coverage.value?.platforms.filter(
      (platform) => platform.group === 'active' || platform.group === 'derived',
    ).length ?? 0,
);

const lowScoreExcludedPlatformCount = computed(
  () =>
    coverage.value?.platforms.filter(
      (platform) => platform.group === 'inactive' || platform.group === 'system',
    ).length ?? 0,
);

const lowScoreSortReceiptItems = computed(() => [
  {
    label: '排序范围',
    value: `当前快照中 ${formatCount(
      lowScoreSortedPlatformCount.value,
    )} 个已激活 / 派生平台在各自分组内按质量分升序排列。`,
  },
  {
    label: '排除项',
    value: `${formatCount(
      lowScoreExcludedPlatformCount.value,
    )} 个未启用通道 / 系统入口保持原分组口径；info 规划项不算当前覆盖故障。`,
  },
  {
    label: '分数口径',
    value:
      '质量分只衡量可读覆盖状态、贡献项健康、新鲜度和失败/积压惩罚，不判断内容事实正确性或是否足够进入回复/画像。',
  },
  {
    label: '无副作用',
    value:
      '切换排序只重排当前前端快照，不重扫 Coverage API、不重跑 provider sync、不写库、不标记已读，也不外发。',
  },
]);

const defaultSortActionBoundary = computed(() => {
  if (platformSortMode.value === 'default') {
    return '默认排序：当前已经按 Coverage API 返回顺序和平台分组展示；再次点击不会重扫 Coverage API、重算质量分、重跑 provider sync、写库、标记已读或外发。';
  }
  return '默认排序：只把当前前端快照恢复为 Coverage API 返回顺序和平台分组；不会重扫 Coverage API、重算质量分、重跑 provider sync、写库、标记已读或外发。';
});

const lowScoreSortActionBoundary = computed(() => {
  const sortedCount = formatCount(lowScoreSortedPlatformCount.value);
  const excludedCount = formatCount(lowScoreExcludedPlatformCount.value);
  if (platformSortMode.value === 'lowScore') {
    return `低分优先：当前已把 ${sortedCount} 个已激活 / 派生平台按当前 qualityScore 升序排列，${excludedCount} 个未启用通道 / 系统入口仍按原分组展示；再次点击不会重扫 Coverage API、重算质量分、重跑 provider sync、写库、标记已读或外发。`;
  }
  return `低分优先：只把当前前端快照里的 ${sortedCount} 个已激活 / 派生平台按当前 qualityScore 升序重排，${excludedCount} 个未启用通道 / 系统入口不参与低分故障排序；不会重扫 Coverage API、重算质量分、重跑 provider sync、写库、标记已读或外发。`;
});

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
    if (globalCoverageGapActionCount.value > 0 && globalPlanningActionCount.value > 0) {
      return `全部下一步：${formatCount(globalCoverageGapActionCount.value)} 个需处理缺口，${formatCount(globalPlanningActionCount.value)} 个可选规划项；不会自动改同步设置。`;
    }
    if (globalCoverageGapActionCount.value > 0) {
      return `全部 ${formatCount(globalCoverageGapActionCount.value)} 个需处理缺口；不会自动改同步设置。`;
    }
    if (globalPlanningActionCount.value > 0) {
      return `当前只有 ${formatCount(globalPlanningActionCount.value)} 个可选规划项；不算覆盖缺口，也不会自动改同步设置。`;
    }
    return '当前没有需要处理的覆盖缺口。';
  }
  const name = selectedPlatform.value?.name ?? '当前平台';
  if (selectedCoverageGapActionCount.value > 0 && selectedPlanningActionCount.value > 0) {
    return `${name}：${formatCount(selectedCoverageGapActionCount.value)} 个需处理缺口，${formatCount(selectedPlanningActionCount.value)} 个可选规划项；可切到全部查看其他平台。`;
  }
  if (selectedCoverageGapActionCount.value > 0) {
    return `${name} 有 ${formatCount(selectedCoverageGapActionCount.value)} 个需处理缺口；可切到全部查看其他平台。`;
  }
  if (selectedPlanningActionCount.value > 0) {
    return `${name} 只有 ${formatCount(selectedPlanningActionCount.value)} 个可选规划项；不算覆盖故障。`;
  }
  if (globalCoverageGapActionCount.value > 0) {
    return `${name} 当前没有修复项；全局还有 ${formatCount(globalCoverageGapActionCount.value)} 个需处理缺口。`;
  }
  if (globalPlanningActionCount.value > 0) {
    return `${name} 当前没有修复项；全局只有 ${formatCount(globalPlanningActionCount.value)} 个可选规划项，不算覆盖故障。`;
  }
  return `${name} 当前没有需要处理的覆盖缺口。`;
});

const repairEmptyText = computed(() => {
  if (repairScope.value === 'all') {
    return '当前没有需要处理的覆盖缺口或可选规划项。';
  }
  if (globalCoverageGapActionCount.value > 0) {
    return '当前平台没有修复项，但全局仍有需处理的覆盖缺口。';
  }
  if (globalPlanningActionCount.value > 0) {
    return '当前平台没有修复项；全局只有可选规划项，不算当前覆盖故障。';
  }
  return '当前平台没有需要处理的覆盖缺口或可选规划项。';
});

const repairEmptyActionLabel = computed(() =>
  globalCoverageGapActionCount.value > 0 ? '查看全部修复项' : '查看全部规划项',
);

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

const coverageSnapshotAgeSeconds = computed(() => {
  const generatedAt = coverage.value?.generatedAt;
  if (!generatedAt) return null;
  return Math.max(0, Math.floor(Date.now() / 1000) - generatedAt);
});

const coverageSnapshotAgeText = computed(() =>
  formatDuration(coverageSnapshotAgeSeconds.value),
);

const coverageSnapshotIsStale = computed(() => {
  const currentCoverage = coverage.value;
  const ageSeconds = coverageSnapshotAgeSeconds.value;
  if (!currentCoverage || ageSeconds === null) return false;
  return ageSeconds > currentCoverage.staleAfterDays * 86400;
});

const coverageSnapshotReceiptTitle = computed(() => {
  if (errorMessage.value && coverage.value) return '显示上次成功快照';
  if (loading.value && coverage.value) return '正在重扫，先保留当前快照';
  if (coverageSnapshotIsStale.value) return '覆盖快照已过期';
  return '当前快照可用';
});

const coverageSnapshotReceiptText = computed(() => {
  const generatedAt = coverage.value?.generatedAt;
  const readAt = coverageReadAt.value;
  const mapReceipt = coverage.value?.receipt;
  const generatedText = formatTime(generatedAt);
  const readText = formatTime(readAt);
  const ageText = coverageSnapshotAgeText.value;
  const staleWindowDays = coverage.value?.staleAfterDays ?? 7;
  const ageBoundaryText = coverageSnapshotIsStale.value
    ? `快照年龄${ageText}，已超过 ${staleWindowDays} 天新鲜度窗口；质量分和平台卡片仍来自旧快照，先点击重扫覆盖确认当前状态。`
    : `快照年龄${ageText}，仍在 ${staleWindowDays} 天新鲜度窗口内。`;
  const receiptSummaryText = mapReceipt
    ? `本轮聚合 ${formatCount(
        mapReceipt.summary.activeDerivedPlatformCount,
      )} 个 active / derived 平台、${formatCount(
        mapReceipt.summary.coverageGapCount,
      )} 个覆盖缺口、${formatCount(
        mapReceipt.summary.infoPlanningActionCount,
      )} 个可选规划项。`
    : '';
  if (errorMessage.value && coverage.value) {
    const failedText = formatTime(coverageRefreshFailedAt.value);
    return `重扫失败于 ${failedText}；当前仍显示服务端 ${generatedText} 生成、本机 ${readText} 读取的上次成功快照。${ageBoundaryText}不会用失败结果覆盖平台卡片。`;
  }
  if (loading.value && coverage.value) {
    return `正在重新读取 Coverage API；重扫完成前，平台卡片仍来自服务端 ${generatedText} 生成、本机 ${readText} 读取的快照。${ageBoundaryText}`;
  }
  if (mapReceipt) {
    return `本页显示 Coverage API 聚合快照：服务端生成于 ${generatedText}，本机读取于 ${readText}；${ageBoundaryText}${mapReceipt.boundary} 重扫只刷新覆盖状态，不会自动改同步设置或写入外部平台。${receiptSummaryText}`;
  }
  return `本页显示 Coverage API 聚合快照：服务端生成于 ${generatedText}，本机读取于 ${readText}；${ageBoundaryText}重扫只刷新覆盖状态，不会自动改同步设置或写入外部平台。`;
});

const manualCoverageRefreshReceiptTitle = computed(() => {
  const receipt = manualCoverageRefreshReceipt.value;
  if (!receipt) return '';
  if (receipt.status === 'refreshing') return '正在读取 Coverage API';
  if (receipt.status === 'failed') return '重扫失败，旧快照仍保留';
  return '重扫完成，平台卡片已更新';
});

const manualCoverageRefreshReceiptItems = computed(() => {
  const receipt = manualCoverageRefreshReceipt.value;
  if (!receipt) return [];
  const previousText = receipt.previousGeneratedAt
    ? `上次服务端 ${formatTime(receipt.previousGeneratedAt)} / 本机 ${formatTime(
        receipt.previousReadAt,
      )}`
    : '此前没有可用覆盖快照';
  const completedText = receipt.completedAt
    ? formatTime(receipt.completedAt)
    : '尚未完成';
  const nextText = receipt.nextGeneratedAt
    ? `本次服务端 ${formatTime(receipt.nextGeneratedAt)} / 本机 ${formatTime(
        receipt.nextReadAt,
      )}`
    : '未取得新快照';
  const summaryText = receipt.summary
    ? `${formatCount(receipt.summary.totalMessages)} messages · ${formatCount(
        receipt.summary.totalChunks,
      )} chunks · ${formatCount(receipt.summary.totalEntities)} entities；覆盖缺口 ${formatCount(
        receipt.summary.coverageGaps,
      )} 个。`
    : '本次未返回新的 messages / chunks / entities 读数。';
  const resultText =
    receipt.status === 'refreshing'
      ? '请求已发出；完成前继续显示旧平台卡片，避免把加载中误读成已重扫成功。'
      : receipt.status === 'failed'
        ? `失败结果不会覆盖平台卡片；错误：${receipt.message || '未知错误'}。`
        : '本次 Coverage API 响应已经替换平台卡片、修复队列、时间线和质量分焦点。';

  return [
    {
      label: '请求时间',
      value: `${formatTime(receipt.requestedAt)} 发起；${completedText} 结束。`,
    },
    {
      label: '快照替换',
      value: `${previousText}；${nextText}。${resultText}`,
    },
    {
      label: '本次读数',
      value: summaryText,
    },
    {
      label: '操作边界',
      value:
        '重扫只重新读取 /coverage/map；没有重跑 provider sync、没有写库、没有标记已读，也没有同步或外发到任何平台。',
    },
  ];
});

const manualCoverageRefreshActionBoundary = computed(() => {
  if (loading.value && coverage.value) {
    return '重扫覆盖：正在重新读取 /coverage/map；完成前继续显示旧平台卡片、质量分焦点、修复队列和时间线，不会重跑 provider sync、写库、标记已读、改配置或外发。';
  }
  if (loading.value) {
    return '重扫覆盖：正在读取 /coverage/map；成功前不会把加载中当作当前质量分，也不会重跑 provider sync、写库、标记已读、改配置或外发。';
  }
  if (coverage.value) {
    return '重扫覆盖：只重新读取 /coverage/map；成功后才替换平台卡片、质量分焦点、修复队列和时间线，不会重跑 provider sync、写库、标记已读、改配置或外发。';
  }
  return '重扫覆盖：只读取 /coverage/map 生成覆盖快照和质量分；不会重跑 provider sync、写库、标记已读、改配置或外发。';
});

const coverageDiagnosticsTitle = computed(() => {
  if (coverageDiagnosticsLoading.value && coverageDiagnostics.value.length === 0) {
    return '正在读取四个 P0 切片';
  }
  if (coverageDiagnosticsLoading.value) {
    return '正在刷新，先保留上次切片';
  }
  if (coverageDiagnosticsError.value && coverageDiagnostics.value.length === 0) {
    return '切片读取失败';
  }
  if (coverageDiagnosticsError.value) {
    return '显示上次成功切片';
  }
  if (coverageDiagnostics.value.length > 0) {
    return '切片已读取';
  }
  return '等待主快照后读取';
});

const coverageDiagnosticsText = computed(() => {
  const sliceCount = coverageDiagnostics.value.length;
  const latestGeneratedAt = latestDiagnosticGeneratedAt();
  const generatedText = latestGeneratedAt
    ? `服务端最新生成于 ${formatTime(latestGeneratedAt)}`
    : '尚未取得服务端生成时间';
  const readText = coverageDiagnosticsReadAt.value
    ? `本机读取于 ${formatTime(coverageDiagnosticsReadAt.value)}`
    : '本机尚未读取成功';
  const boundary =
    '这里只读取 messages、provider jobs、压力队列和技能同步四个诊断切片；不会写入记忆、重跑 provider sync、修复配置、标记已读或外发。';

  if (coverageDiagnosticsLoading.value && sliceCount > 0) {
    return `正在重新读取 P0 诊断切片；完成前保留 ${formatCount(sliceCount)} 个上次成功切片。${boundary}`;
  }
  if (coverageDiagnosticsError.value && sliceCount > 0) {
    return `切片读取失败，主覆盖地图不受影响；当前仍显示 ${generatedText}、${readText} 的上次成功只读切片。失败原因：${coverageDiagnosticsError.value}。${boundary}`;
  }
  if (coverageDiagnosticsError.value) {
    return `P0 诊断切片读取失败，主覆盖地图不受影响；失败原因：${coverageDiagnosticsError.value}。${boundary}`;
  }
  if (sliceCount > 0) {
    return `已读取 ${formatCount(sliceCount)} 个 P0 诊断切片，${generatedText}，${readText}。${boundary}`;
  }
  return `主覆盖快照加载后会读取 P0 诊断切片；${boundary}`;
});

const coverageDiagnosticsRefreshActionBoundary = computed(() => {
  if (coverageDiagnosticsLoading.value && coverageDiagnostics.value.length > 0) {
    return `刷新切片：正在重新读取四个 P0 诊断切片；完成前保留 ${formatCount(
      coverageDiagnostics.value.length,
    )} 个上次成功切片，不会重扫 /coverage/map、不会替换质量分、不会重跑 provider sync、不会写库、不会修复配置、不会标记已读或外发。`;
  }
  if (coverageDiagnosticsLoading.value) {
    return '刷新切片：正在读取 messages、provider jobs、压力队列和技能同步四个 P0 诊断切片；不会重扫 /coverage/map、不会替换质量分、不会重跑 provider sync、不会写库、不会修复配置、不会标记已读或外发。';
  }
  if (coverageDiagnosticsError.value && coverageDiagnostics.value.length > 0) {
    return '刷新切片：只重试四个 P0 诊断切片并继续保留上次成功切片；不会重扫 /coverage/map、不会替换质量分、不会重跑 provider sync、不会写库、不会修复配置、不会标记已读或外发。';
  }
  return '刷新切片：只重新读取 messages、provider jobs、压力队列和技能同步四个 P0 诊断切片；不会重扫 /coverage/map、不会替换质量分、不会重跑 provider sync、不会写库、不会修复配置、不会标记已读或外发。';
});

const coverageDiagnosticsEmptyText = computed(() => {
  if (coverageDiagnosticsLoading.value) {
    return '正在读取只读诊断切片；这一步不会替你重扫外部平台或写入 Memory Service。';
  }
  if (coverageDiagnosticsError.value) {
    return '切片读取失败；主覆盖快照仍可继续使用，修复服务连接后可点「刷新切片」重试。';
  }
  return '尚未返回诊断切片；等待主快照读取完成。';
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

const showImportScopeSelector = computed(
  () => importMode.value !== 'backup' && !isBackupRestoreCandidate.value,
);

const showSmartImportScopeReceipt = computed(
  () => showImportScopeSelector.value && !smartImportReceipt.value,
);

const showBackupRestoreTargetReceipt = computed(
  () => importMode.value === 'backup' || isBackupRestoreCandidate.value,
);

const smartImportEntryActionBoundary = computed(
  () =>
    '录入：只打开本页记忆录入抽屉；不会读取本机文件、创建 import batch、messages、chunks、恢复备份、同步外部平台或外发内容。后续仍需选择来源并先 dry-run，确认后才可能写入。',
);

const smartImportScopeReceiptItems = computed(() => {
  const sourceLabel =
    importMode.value === 'paste'
      ? '粘贴文本'
      : selectedFileName.value
        ? `${detectedImportLabel.value} · ${selectedFileName.value}`
        : '待选择文件';
  const hasPreview = Boolean(importInspect.value);
  const previewState = hasPreview
    ? `当前 dry-run 状态是 ${importInspect.value?.status ?? '未知'}；`
    : '尚未 dry-run；';
  const omissionBoundary = isExternalAiImport.value
    ? '外部 AI 只读取已上传归档里的 conversations.json 文本消息；截断、非文本附件和非对话文件不会在提交时自动补写。'
    : detectedImportLabel.value === '普通 zip'
      ? '普通 zip 最多预检前 80 个文件；未预检、阻塞、空文件或重复来源不会在提交时自动写入。'
      : '阻塞、空内容、重复来源或 dry-run 未标记为 ready 的条目不会在提交时自动写入。';

  return [
    {
      label: '当前输入',
      value: `${sourceLabel}；当前选择 ${importScope.value} 范围。${previewState}切换来源或范围会清空本次预览。`,
    },
    {
      label: '查看 dry-run',
      value:
        '只读取本次输入并返回类型、可录入条目、风险词和遗漏统计；不会创建 import batch、messages、chunks，也不会恢复、同步或外发。',
    },
    {
      label: '提交录入',
      value:
        '只有 dry-run ready 且你点击「提交录入」后，才写入 manual shadow memory；高风险内容仍需要勾选确认。',
    },
    {
      label: '遗漏边界',
      value: omissionBoundary,
    },
  ];
});

function importSourceControlBoundary(label: string): string {
  if (importBusy.value) {
    return `${label}：当前录入请求处理中；本次请求仍使用点击时的输入/文件和 ${importScope.value} 范围，完成前不能切换来源，避免把旧 dry-run 或写入结果挂到新来源。`;
  }
  return `${label}：切换来源会清空本次 dry-run、提交中和完成回执；选择后需要重新 dry-run，不会自动写入、恢复、同步或外发。`;
}

const importFilePickerBoundary = computed(() => {
  if (importBusy.value) {
    return `选择文件：当前录入请求处理中；本次请求仍使用点击时的输入/文件和 ${importScope.value} 范围，完成前不能选择新文件，避免把旧 dry-run 或写入结果挂到新文件。`;
  }
  return '选择文件：只打开本机文件选择器；选中文档、普通 zip、外部 AI 历史或备份 zip 后仍会先 dry-run，不会自动写入、恢复、同步或外发。';
});

const importScopeSelectorBoundary = computed(() => {
  if (importBusy.value) {
    return `写入范围：当前录入请求处理中；本次请求仍使用点击时的 ${importScope.value} 范围，完成前不能切换 work/personal，避免旧结果挂到新范围。`;
  }
  return '写入范围：切换 work/personal 会清空本次 dry-run、提交中和完成回执；新范围必须重新 dry-run 后才可能提交。';
});

const importTextInputBoundary = computed(() => {
  if (importBusy.value) {
    return `粘贴文本：当前录入请求处理中；本次请求仍使用点击时的文本快照和 ${importScope.value} 范围，完成前不能编辑，避免旧结果挂到新文本。`;
  }
  return '粘贴文本：修改内容会清空本次 dry-run、提交中和完成回执；新文本必须重新 dry-run，不会自动写入或外发。';
});

const busyImportCloseStatusText = computed(() => {
  if (smartImportCommitPending.value) {
    return `当前正在提交录入到 ${importScope.value} manual shadow memory；关闭或取消不会撤回已发出的请求。为避免误读为已取消，抽屉会保持打开直到服务端返回结果。`;
  }
  if (isBackupRestoreCandidate.value) {
    return '当前备份恢复 dry-run 或写入请求处理中；关闭或取消不会撤回已发出的请求。为避免误读为已取消，抽屉会保持打开直到服务端返回结果。';
  }
  return `当前 dry-run 请求处理中；关闭或取消不会撤回已发出的请求。为避免把等待状态误读成取消，抽屉会保持打开直到服务端返回结果。`;
});

const importCloseActionBoundary = computed(() => {
  if (importBusy.value) {
    return `关闭/取消：${busyImportCloseStatusText.value}`;
  }
  if (smartImportReceipt.value) {
    return '关闭/取消：只关闭本地录入抽屉；不会撤销已写入的 manual shadow memory、删除 import batch、重新同步外部平台或外发内容。';
  }
  if (backupRestoreReceipt.value) {
    return '关闭/取消：只关闭本地录入抽屉；不会撤销已完成的备份恢复，也不会重新恢复、同步外部平台或外发内容。';
  }
  return '关闭/取消：只关闭本地录入抽屉并保留 Coverage 主视图；不会提交 dry-run、写入 manual shadow memory、恢复备份、同步外部平台或外发内容。';
});

const smartImportReceiptTitle = computed(() => {
  const receipt = smartImportReceipt.value;
  if (!receipt) return '';
  if (receipt.status === 'duplicate') return '录入完成回执 · 已跳过重复来源';
  if (receipt.detectedKind === 'external_ai_history') {
    return '录入完成回执 · 外部 AI 历史';
  }
  return '录入完成回执';
});

const showDuplicateImportReceipt = computed(
  () =>
    importInspect.value?.status === 'duplicate' &&
    !smartImportReceipt.value &&
    !isBackupRestoreCandidate.value,
);

const duplicateImportReceiptDetails = computed(() => {
  const inspect = importInspect.value;
  if (!inspect || inspect.status !== 'duplicate') return [];
  const sourceHash = shortId(inspect.sourceHash);
  const batchId = inspect.existingBatchId ?? '未知';
  const readyCount = isExternalAiImport.value
    ? (inspect.summary.externalAiConversations ?? inspect.summary.readyFiles)
    : inspect.summary.readyFiles;
  const sourcePath =
    isExternalAiImport.value && inspect.summary.externalAiSourcePath
      ? ` · ${inspect.summary.externalAiSourcePath}`
      : '';

  return [
    {
      label: '已有记录',
      value: `source hash ${sourceHash} 已匹配既有 batch ${batchId}${sourcePath}；本次 dry-run 未新增 messages 或 chunks。`,
    },
    {
      label: '不会发生',
      value:
        '不会覆盖、删除、降权或重新同步已录入内容，也不会写回外部平台。',
    },
    {
      label: '复查方式',
      value: `需要复查时按 memory_import_batches.source_hash、batch id 或 source import:${
        inspect.existingBatchId ?? '未知'
      } 定位；如要更新，请选择新的导出或资料来源。`,
    },
    {
      label: '范围边界',
      value: `${importScope.value} 范围只用于新写入；重复命中不会改变既有记录的范围、权重或审计路径。${formatCount(
        readyCount,
      )} 个可录入对象已被去重保护拦截。`,
    },
  ];
});

const smartImportReceiptDetails = computed(() => {
  const receipt = smartImportReceipt.value;
  if (!receipt) return [];
  const inspect = importInspect.value;
  const sourceHash = inspect?.sourceHash ? shortId(inspect.sourceHash) : '未知';
  const batchId = shortId(receipt.batchId);
  const warningCount = receipt.warnings.filter((warning) => warning.trim()).length;
  const sourcePath = inspect?.summary.externalAiSourcePath;
  const sourceBoundary =
    receipt.detectedKind === 'external_ai_history'
      ? `只读取用户上传归档里的 ${sourcePath || 'conversations.json'}；不会继续同步原平台，也不会外发回 ChatGPT / Claude / Gemini。`
      : '只写入这次 dry-run 标记为可录入的条目；未预检、阻塞或重复内容不会自动补写。';

  if (receipt.status === 'duplicate') {
    return [
      {
        label: '写入结果',
        value: `source hash ${sourceHash} 已存在；沿用 batch ${batchId}，本次未新增 messages 或 chunks。`,
      },
      {
        label: '审计路径',
        value: `可按 memory_import_batches.source_hash 或既有 batch ${batchId} 复查，不靠重复导入覆盖删除。`,
      },
      {
        label: '边界',
        value: sourceBoundary,
      },
    ];
  }

  return [
    {
      label: '写入结果',
      value: `${formatCount(receipt.importedMessages)} 条记忆 / ${formatCount(
        receipt.importedChunks,
      )} 个 chunks；跳过 ${formatCount(receipt.skippedEntries)} 个条目。`,
    },
    {
      label: '写入范围',
      value: `${importScope.value} · manual shadow memory · low salience / temporary consolidation；不会直接升级为 confirmed 画像、skill 或项目事实。`,
    },
    {
      label: '审计路径',
      value: `source import:${receipt.batchId} · batch ${batchId} · source hash ${sourceHash}；需要复查或移除时按 import batch / source 路径定位。`,
    },
    {
      label: '边界',
      value: `${sourceBoundary}${
        warningCount > 0 ? ` 保留 ${formatCount(warningCount)} 条提交提醒。` : ''
      }`,
    },
    ...(receipt.detectedKind === 'external_ai_history'
      ? [
          {
            label: '事实边界',
            value:
              '已写入的用户原话和旧 assistant 回答仍只是可追溯对话证据；后续召回、画像、skill 或项目事实需要各自证据门控。',
          },
        ]
      : []),
  ];
});

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

const externalAiIgnoredFiles = computed(
  () => importInspect.value?.summary.externalAiIgnoredFiles ?? 0,
);

const externalAiHasOmissions = computed(
  () =>
    externalAiHasTruncation.value ||
    (importInspect.value?.summary.externalAiSkippedParts ?? 0) > 0 ||
    externalAiIgnoredFiles.value > 0,
);

const showDocumentImportReview = computed(
  () =>
    Boolean(importInspect.value) &&
    !isExternalAiImport.value &&
    !isBackupRestoreCandidate.value,
);

const showDocumentImportRecoveryReceipt = computed(
  () =>
    showDocumentImportReview.value &&
    importInspect.value?.status !== 'duplicate' &&
    !smartImportReceipt.value,
);

const documentImportSkippedFiles = computed(
  () => importInspect.value?.summary.zipSkippedFiles ?? 0,
);

const documentImportHasOmissions = computed(() => {
  const summary = importInspect.value?.summary;
  if (!summary) return false;
  return (summary.unsupported ?? 0) > 0 || documentImportSkippedFiles.value > 0;
});

const documentImportReviewText = computed(() => {
  const summary = importInspect.value?.summary;
  if (!summary) return '';
  const readyFiles = summary.readyFiles ?? 0;
  const blockedFiles = summary.unsupported ?? 0;
  const chunks = summary.chunks ?? 0;
  const zipTotalFiles = summary.zipTotalFiles;
  if (typeof zipTotalFiles === 'number' && zipTotalFiles > 0) {
    const inspectedFiles = summary.zipInspectedFiles ?? summary.files ?? readyFiles;
    const skippedFiles = summary.zipSkippedFiles ?? 0;
    const skippedText =
      skippedFiles > 0 ? `，${formatCount(skippedFiles)} 个未预检` : '';
    return `${detectedImportLabel.value} 里预检 ${formatCount(
      inspectedFiles,
    )}/${formatCount(zipTotalFiles)} 个文件；${formatCount(
      readyFiles,
    )} 个可录入，${formatCount(blockedFiles)} 个阻塞${skippedText}，约 ${formatCount(
      chunks,
    )} 个 chunks。`;
  }
  return `${detectedImportLabel.value}：${formatCount(
    readyFiles,
  )} 个可录入，${formatCount(blockedFiles)} 个阻塞，约 ${formatCount(
    chunks,
  )} 个 chunks。`;
});

const documentImportRecoveryReceiptItems = computed(() => {
  const inspect = importInspect.value;
  if (!inspect) return [];
  const summary = inspect.summary;
  const readyFiles = summary.readyFiles ?? 0;
  const blockedFiles = summary.unsupported ?? 0;
  const skippedFiles = summary.zipSkippedFiles ?? 0;
  const chunks = summary.chunks ?? 0;
  const readyText =
    inspect.status === 'ready'
      ? `现在提交只会写入 dry-run 标记为 ready 的 ${formatCount(
          readyFiles,
        )} 个条目，约 ${formatCount(chunks)} 个 chunks。`
      : '当前 dry-run 没有 ready 条目，提交按钮保持禁用，不会创建 import batch、messages 或 chunks。';
  const omissionParts: string[] = [];
  if (blockedFiles > 0) {
    omissionParts.push(`${formatCount(blockedFiles)} 个阻塞/不支持条目`);
  }
  if (skippedFiles > 0) {
    omissionParts.push(`${formatCount(skippedFiles)} 个 zip 内未预检文件`);
  }
  const omissionText =
    omissionParts.length > 0
      ? `${omissionParts.join('、')}不会在本次提交里写入，也不会被后台自动补扫。`
      : '本次 dry-run 没有发现阻塞或未预检条目；仍只会写入当前 ready 结果。';
  const recoveryText =
    skippedFiles > 0
      ? '如需纳入未预检内容，请把大型 zip 拆成更小的归档或只保留目标文件后重新 dry-run；阻塞条目需改成支持的文本/PDF 格式或补齐可抽取文本。'
      : blockedFiles > 0
        ? '如需纳入阻塞条目，请把不支持、空文件或扫描件改成支持的文本/PDF 文本流后重新 dry-run。'
        : '如需改变范围或来源，请切换 work/personal、选择新文件或修改粘贴内容后重新 dry-run。';

  return [
    {
      label: '可提交范围',
      value: readyText,
    },
    {
      label: '遗漏处理',
      value: omissionText,
    },
    {
      label: '恢复动作',
      value: recoveryText,
    },
    {
      label: '边界',
      value:
        '恢复动作需要用户重新提供资料并再次 dry-run；本页不会覆盖旧 batch、自动同步外部平台、确认画像/skill/项目事实或外发导入内容。',
    },
  ];
});

const externalAiImportReviewText = computed(() => {
  const summary = importInspect.value?.summary;
  if (!summary) return '';
  const conversations = summary.externalAiConversations ?? summary.readyFiles;
  const importedMessages = summary.externalAiImportedMessages ?? 0;
  const totalMessages = summary.externalAiTotalMessages ?? importedMessages;
  const truncatedConversations = summary.externalAiTruncatedConversations ?? 0;
  const truncatedMessages = summary.externalAiTruncatedMessages ?? 0;
  const skippedParts = summary.externalAiSkippedParts ?? 0;
  const sourcePath = summary.externalAiSourcePath;
  const ignoredFiles = summary.externalAiIgnoredFiles ?? 0;
  const sourceText = sourcePath
    ? `读取 ${sourcePath}；`
    : '读取 conversations.json；';
  const truncationText =
    truncatedConversations > 0
      ? `；${formatCount(truncatedConversations)} 个长会话超过上限，后续 ${formatCount(
          truncatedMessages,
        )} 条消息不会写入。`
      : '；未检测到长会话截断。';
  const skippedPartsText =
    skippedParts > 0
      ? `；跳过 ${formatCount(skippedParts)} 个非文本附件或消息部件。`
      : '';
  const ignoredFilesText =
    ignoredFiles > 0
      ? `；忽略 ${formatCount(ignoredFiles)} 个非 conversations.json 归档文件。`
      : '';
  return `${sourceText}${formatCount(conversations)} 个会话，纳入 ${formatCount(
    importedMessages,
  )}/${formatCount(totalMessages)} 条消息${truncationText}${skippedPartsText}${ignoredFilesText}`;
});

const externalAiDecisionReceiptItems = computed(() => {
  const summary = importInspect.value?.summary;
  if (!summary || !isExternalAiImport.value) return [];
  const conversations = summary.externalAiConversations ?? summary.readyFiles;
  const importedMessages = summary.externalAiImportedMessages ?? 0;
  const totalMessages = summary.externalAiTotalMessages ?? importedMessages;
  const sourcePath = summary.externalAiSourcePath || 'conversations.json';
  const omittedParts =
    (summary.externalAiTruncatedMessages ?? 0) +
    (summary.externalAiSkippedParts ?? 0) +
    (summary.externalAiIgnoredFiles ?? 0);
  const omissionText =
    omittedParts > 0
      ? `；本次未写入 ${formatCount(omittedParts)} 个截断/非文本/非对话归档项`
      : '';

  return [
    {
      label: '写入对象',
      value: `${formatCount(conversations)} 个会话、${formatCount(
        importedMessages,
      )}/${formatCount(totalMessages)} 条文本消息会写入 ${importScope.value} 范围${omissionText}。`,
    },
    {
      label: '记忆权重',
      value:
        '写入为 manual shadow memory，低 salience、temporary consolidation；不会直接变成 confirmed 画像、skill 或项目事实。',
    },
    {
      label: '来源边界',
      value: `只读取用户上传 zip 里的 ${sourcePath}；不会自动抓取 ChatGPT / Claude / Gemini，也不会把内容外发回原平台。`,
    },
    {
      label: '事实边界',
      value:
        '历史对话只作为来源证据：用户原话不等于当前偏好永久确认，旧 assistant 回答不等于事实确认；Ask / Profile / Skill / Project 仍需后续证据门控。',
    },
    {
      label: '恢复与去重',
      value:
        '同一归档会按 source hash 去重；需要移除或复查时按 import batch / source 路径审计，不靠重复导入自动覆盖删除。',
    },
  ];
});

const showExternalAiCommitPendingReceipt = computed(
  () =>
    smartImportCommitPending.value &&
    isExternalAiImport.value &&
    !smartImportReceipt.value,
);

const externalAiCommitPendingReceiptItems = computed(() => {
  const inspect = importInspect.value;
  const summary = inspect?.summary;
  if (!inspect || !summary || !isExternalAiImport.value) return [];
  const conversations = summary.externalAiConversations ?? summary.readyFiles;
  const importedMessages = summary.externalAiImportedMessages ?? 0;
  const totalMessages = summary.externalAiTotalMessages ?? importedMessages;
  const omittedParts =
    (summary.externalAiTruncatedMessages ?? 0) +
    (summary.externalAiSkippedParts ?? 0) +
    (summary.externalAiIgnoredFiles ?? 0);
  const omittedText =
    omittedParts > 0
      ? `；${formatCount(omittedParts)} 个截断/非文本/非对话归档项仍不会写入`
      : '';
  return [
    {
      label: '当前请求',
      value: `已提交 ${formatCount(conversations)} 个会话、${formatCount(
        importedMessages,
      )}/${formatCount(totalMessages)} 条文本消息到 ${importScope.value} 范围；服务端尚未返回写入确认${omittedText}。`,
    },
    {
      label: '等待边界',
      value:
        '提交中不代表已经写入成功；完成前不会生成新的 batch id，也不会把旧 dry-run 当作成功回执。',
    },
    {
      label: '来源边界',
      value: `本次仍只使用上传 zip 里的 ${
        summary.externalAiSourcePath || 'conversations.json'
      }；不会继续抓取 ChatGPT / Claude / Gemini，也不会把内容外发回原平台。`,
    },
    {
      label: '事实边界',
      value:
        '提交中仍只是把历史对话作为来源证据；旧 assistant 回答不会在服务端确认后直接变成事实、画像、skill 或项目事实。',
    },
    {
      label: '写入边界',
      value:
        '如果服务端确认成功，也只是 manual shadow memory；不会直接升级为 confirmed 画像、skill、项目事实或外部同步结果。',
    },
  ];
});

const showSmartImportCommitPendingReceipt = computed(
  () =>
    smartImportCommitPending.value &&
    !isExternalAiImport.value &&
    !isBackupRestoreCandidate.value &&
    !smartImportReceipt.value,
);

const smartImportReadyObjectText = computed(() => {
  const inspect = importInspect.value;
  if (!inspect) return '当前 ready 条目';
  const readyFiles = inspect.summary.readyFiles ?? 0;
  const unit = inspect.detectedKind === 'text' ? '个粘贴来源' : '个资料条目';
  return `${formatCount(readyFiles)} ${unit}`;
});

const smartImportOmissionBoundaryText = computed(() => {
  const inspect = importInspect.value;
  if (!inspect) return '未预检、阻塞、空内容或重复来源不会写入。';
  const blockedFiles = inspect.summary.unsupported ?? 0;
  const skippedFiles = inspect.summary.zipSkippedFiles ?? 0;
  const omissions: string[] = [];
  if (blockedFiles > 0) {
    omissions.push(`${formatCount(blockedFiles)} 个阻塞/不支持条目`);
  }
  if (skippedFiles > 0) {
    omissions.push(`${formatCount(skippedFiles)} 个 zip 内未预检文件`);
  }
  if (omissions.length === 0) {
    return '本次只会写入当前 dry-run 标记为 ready 的条目；空内容、重复来源或之后切换输入不会自动补写。';
  }
  return `${omissions.join('、')}不会在本次提交里写入，也不会被后台自动补扫。`;
});

const smartImportCommitPendingReceiptItems = computed(() => {
  const inspect = importInspect.value;
  if (!inspect) return [];
  const chunks = inspect.summary.chunks ?? 0;
  const highRisk = inspect.summary.highRisk ?? 0;
  return [
    {
      label: '当前请求',
      value: `已提交 ${smartImportReadyObjectText.value}、约 ${formatCount(
        chunks,
      )} 个 chunks 到 ${importScope.value} 范围；服务端尚未返回写入确认。`,
    },
    {
      label: '等待边界',
      value:
        '提交中不代表已经写入成功；完成前不会生成新的 batch id，也不会把旧 dry-run 当作成功回执。',
    },
    {
      label: '写入范围',
      value:
        '如果服务端确认成功，也只会写入 manual shadow memory，低 salience、temporary consolidation；不会直接升级为 confirmed 画像、skill 或项目事实。',
    },
    {
      label: '遗漏边界',
      value: smartImportOmissionBoundaryText.value,
    },
    {
      label: '高风险确认',
      value:
        highRisk > 0
          ? `本次包含 ${formatCount(highRisk)} 个高风险词，提交请求已带上用户确认；服务端仍会重新校验。`
          : '本次 dry-run 没有高风险词；服务端仍会按提交内容重新校验风险。',
    },
    {
      label: '无副作用',
      value:
        '不会自动同步外部平台、覆盖旧 batch、确认画像/skill/项目事实、发送消息或外发导入内容。',
    },
  ];
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
  if (
    isBackupRestoreCandidate.value &&
    backupReplaceConfirmRequired.value &&
    !replaceRestoreConfirmed.value
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

const primaryImportActionBoundary = computed(() => {
  const label = primaryImportLabel.value;
  if (importBusy.value && smartImportCommitPending.value) {
    return `${label}：正在提交 ${smartImportReadyObjectText.value} 到 ${importScope.value} manual shadow memory；服务端确认前不会生成 batch id、不会把旧 dry-run 当作成功，也不会同步外部平台或确认画像/skill/项目事实。`;
  }
  if (importBusy.value) {
    return `${label}：正在处理当前请求；完成前不会把等待状态当作成功回执，也不会自动同步外部平台、写入未确认结果或外发内容。`;
  }
  if (backupRestoreReceipt.value) {
    return `${label}：本次备份恢复已完成，按钮保持禁用；再次恢复必须重新选择备份 zip 并重新 dry-run。`;
  }
  if (importMode.value === 'backup' && !isBackupRestoreCandidate.value) {
    return `${label}：请先选择 Personal AI 备份 zip；这一步不会恢复、删除、替换、同步或外发任何记忆。`;
  }
  if (isBackupRestoreCandidate.value) {
    const mode = replaceExisting.value ? 'replace' : 'merge';
    if (!backupPreview.value) {
      return `${label}：只会按 ${mode} 请求备份恢复 dry-run，读取 manifest、archive 指纹、DB 行数和文件影响；不会写入 Memory Service、删除文件、同步外部平台或外发。`;
    }
    return `${label}：会按已复核的 ${mode} 预览请求备份恢复写入；不会自动启用未配置通道、同步外部平台或替用户发送内容。`;
  }
  if (!importInspect.value) {
    return `${label}：只读取当前${
      importMode.value === 'paste' ? '粘贴文本' : '选择文件'
    }并返回类型、ready 条目、风险词和遗漏统计；不会创建 import batch、messages、chunks，也不会恢复、同步或外发。`;
  }
  if (importInspect.value.status === 'duplicate') {
    return `${label}：source hash 已匹配既有 batch，本次不会提交、覆盖、删除、降权、重新同步或写回外部平台。`;
  }
  if (importInspect.value.status === 'blocked') {
    return `${label}：当前 dry-run 没有 ready 条目，按钮禁用；不会创建 import batch、messages 或 chunks。`;
  }
  if (hasHighRiskImport.value && !highRiskImportConfirmed.value) {
    return `${label}：当前 dry-run ready，但包含 ${formatCount(
      importInspect.value.summary.highRisk ?? 0,
    )} 个高风险词；必须先勾选确认，才会提交为低权重 manual shadow memory。`;
  }
  if (isExternalAiImport.value) {
    const summary = importInspect.value.summary;
    const conversations = summary.externalAiConversations ?? summary.readyFiles;
    const importedMessages = summary.externalAiImportedMessages ?? 0;
    const totalMessages = summary.externalAiTotalMessages ?? importedMessages;
    return `${label}：会把 ${formatCount(conversations)} 个会话、${formatCount(
      importedMessages,
    )}/${formatCount(
      totalMessages,
    )} 条文本消息写入 ${importScope.value} manual shadow memory；不会继续抓取原平台、外发回原平台或直接确认画像/skill/项目事实。`;
  }
  return `${label}：会把 ${smartImportReadyObjectText.value}、约 ${formatCount(
    importInspect.value.summary.chunks ?? 0,
  )} 个 chunks 写入 ${importScope.value} manual shadow memory；${smartImportOmissionBoundaryText.value}不会自动同步外部平台、覆盖旧 batch、确认画像/skill/项目事实或外发导入内容。`;
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

const qualityAttentionPlatforms = computed(() =>
  (coverage.value?.platforms ?? [])
    .filter(
      (platform) =>
        (platform.group === 'active' || platform.group === 'derived') &&
        (scoreValue(platform) < 80 || platform.state !== 'healthy'),
    )
    .sort(
      (left, right) =>
        scoreValue(left) - scoreValue(right) ||
        left.name.localeCompare(right.name, 'zh-CN'),
    ),
);

const servicePriorityFocus = computed<{
  focus: MemoryCoveragePriorityFocus;
  platform: MemoryCoveragePlatform;
  contribution: MemoryCoverageContribution | null;
} | null>(() => {
  const focus = coverage.value?.priorityFocus;
  if (!focus || !coverage.value) return null;
  const platform = coverage.value.platforms.find(
    (item) => item.id === focus.platformId,
  );
  if (!platform) return null;
  const contribution =
    platform.contributions.find((item) => item.id === focus.contributionId) ??
    null;
  return { focus, platform, contribution };
});

const qualityFocusPlatform = computed<MemoryCoveragePlatform | null>(
  () =>
    servicePriorityFocus.value?.platform ??
    qualityAttentionPlatforms.value[0] ??
    null,
);

const qualityFocusContribution = computed(() => {
  if (servicePriorityFocus.value) {
    return servicePriorityFocus.value.contribution;
  }
  const platform = qualityFocusPlatform.value;
  return platform ? pickScorePriorityContribution(platform.contributions) : null;
});

const qualityFocusText = computed(() => {
  const platform = qualityFocusPlatform.value;
  const serviceFocus = servicePriorityFocus.value;
  if (serviceFocus && platform?.id === serviceFocus.platform.id) {
    return `${serviceFocus.focus.contributionLabel} · ${stateLabel(
      serviceFocus.focus.contributionState,
    )}：${serviceFocus.focus.reason}`;
  }
  const contribution = qualityFocusContribution.value;
  if (!platform) return '';
  if (!contribution) {
    return platform.headline;
  }
  return `${contribution.label} · ${stateLabel(contribution.state)}：${scorePriorityActionText(
    contribution,
  )}`;
});

const qualityFocusReceiptItems = computed(() => {
  const platform = qualityFocusPlatform.value;
  if (!platform) return [];
  const serviceFocus = servicePriorityFocus.value;
  const contribution = qualityFocusContribution.value;
  const contributionLabel =
    serviceFocus?.focus.contributionLabel ?? contribution?.label ?? '平台贡献项';
  const contributionState = serviceFocus
    ? stateLabel(serviceFocus.focus.contributionState)
    : contribution
      ? stateLabel(contribution.state)
      : stateLabel(platform.state);
  const source =
    serviceFocus?.focus.source ??
    contribution?.evidence ??
    platform.contributions[0]?.evidence ??
    'coverage aggregate';
  const focusSource =
    serviceFocus?.platform.id === platform.id
      ? '服务端 priorityFocus'
      : '本地低分回退';
  const items = [
    {
      label: '焦点来源',
      value: `${focusSource}；${platform.name} ${formatCoverageScore(
        platform.qualityScore,
      )}`,
    },
    {
      label: '诊断依据',
      value: `${contributionLabel} · ${contributionState}；source ${source}`,
    },
  ];
  if (serviceFocus?.platform.id === platform.id) {
    const focus = serviceFocus.focus;
    if (focus.selectionBasis) {
      items.push({
        label: '筛选路线',
        value: `${focus.selectionBasis}本轮比较 ${formatCount(
          focus.comparedPlatformCount,
        )} 个候选，排除 ${formatCount(
          focus.ignoredInfoActionCount,
        )} 个 info 规划项。`,
      });
    }
  }
  items.push(
    {
      label: '查看边界',
      value:
        serviceFocus?.platform.id === platform.id && serviceFocus.focus.boundary
          ? serviceFocus.focus.boundary
          : '点击「查看平台」只会定位当前覆盖快照和修复队列，不会重跑同步、改配置、写入记忆、标记已读或外发。',
    },
  );
  return items;
});

const qualityFocusActionBoundary = computed(() => {
  const platform = qualityFocusPlatform.value;
  if (!platform) {
    return '查看平台：等待 Coverage 快照选择质量分焦点；点击不会重扫 Coverage API、刷新诊断切片、重跑 provider sync、写库、标记已读或外发。';
  }
  const source =
    servicePriorityFocus.value?.platform.id === platform.id
      ? '服务端 priorityFocus'
      : '本地低分回退';
  const contribution = qualityFocusContribution.value;
  const contributionText = contribution
    ? `，焦点贡献项是「${contribution.label}」`
    : '';
  return `查看平台：只把 ${platform.name} 定位为当前 Coverage 快照里的选中平台和修复队列${contributionText}；焦点来自 ${source}，不会重扫 Coverage API、刷新诊断切片、重跑 provider sync、改配置、写库、标记已读或外发。`;
});

watch(importScope, () => resetImportInspection());
watch(replaceExisting, () => {
  if (backupRestoreReceipt.value) return;
  backupPreview.value = null;
  backupRestoreFailureReceipt.value = null;
  backupRestoreReviewed.value = false;
  replaceRestoreConfirmed.value = false;
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
      label: '备份指纹',
      value: formatArchiveFingerprint(preview.backup.archiveSha256),
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
      label: '备份快照',
      value: receipt.backup
        ? `${receipt.backup.userId} -> ${receipt.backup.targetUserId} · ${formatArchiveFingerprint(
            receipt.backup.archiveSha256,
          )}`
        : '服务端未返回备份快照身份；请以本次恢复结果和 dry-run 预览为准。',
    },
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

const backupRestoreFailureItems = computed(() => {
  const receipt = backupRestoreFailureReceipt.value;
  if (!receipt) return [];
  const previewText =
    receipt.hadPreview && receipt.includeCount !== undefined
      ? `保留本次 dry-run 预览：${formatCount(receipt.includeCount)} 个备份条目，备份用户 ${
          receipt.backupUserId || '未知'
        }，目标 ${receipt.targetUserId || '当前用户'}，指纹 ${formatArchiveFingerprint(
          receipt.archiveSha256,
        )}。`
      : 'dry-run 阶段失败；没有进入真实写入，也没有覆盖当前记忆。';
  return [
    {
      label: '失败阶段',
      value:
        receipt.stage === 'write'
          ? `按 ${receipt.mode} 写入时失败，服务端没有返回确认写入回执。`
          : `按 ${receipt.mode} dry-run 时失败，恢复流程停在预检。`,
    },
    {
      label: '当前状态',
      value: `未确认写入；当前 Memory Service 数据仍是权威状态。${previewText}`,
    },
    {
      label: '失败原因',
      value: receipt.message,
    },
    {
      label: '恢复路径',
      value: `可修正 ${receipt.fileName} 或服务连接后重试同一备份；再次点击前不会自动切换 merge/replace、删除文件或同步外部平台。`,
    },
  ];
});

const backupDownloadReceiptText = computed(() => {
  const receipt = backupDownloadReceipt.value;
  if (!receipt) return '';
  const manifestText = receipt.manifest
    ? `Manifest 摘要已随响应头返回：${formatCount(
        receipt.manifest.includeCount,
      )} 个清单路径，用户空间 ${receipt.manifest.userId}，指纹 ${formatArchiveFingerprint(
        receipt.manifest.archiveSha256,
      )}。`
    : 'Memory Service 未返回 manifest 摘要头；本页只确认文件名、大小和下载边界，恢复前仍会重新 dry-run 校验 manifest。';
  return `下载于 ${formatDateTimeString(
    new Date(receipt.downloadedAt * 1000).toISOString(),
  )}；${receipt.contentType || 'application/zip'} · ${formatCount(
    receipt.sizeBytes,
  )} bytes。${manifestText}这个文件是本机保存的 Personal AI backup zip；不会自动恢复、删除、同步或外发。恢复必须从「录入 > 备份 zip」重新选择文件并先 dry-run。`;
});

const backupDownloadFailureReceiptText = computed(() => {
  const receipt = backupDownloadFailureReceipt.value;
  if (!receipt) return '';
  return `失败于 ${formatDateTimeString(
    new Date(receipt.failedAt * 1000).toISOString(),
  )}；本次没有生成或保存 Personal AI backup zip，没有恢复、删除、同步或外发任何记忆。请确认 Memory Service 可用后重试。失败原因：${receipt.message}`;
});

const backupDownloadManifestItems = computed(() => {
  const manifest = backupDownloadReceipt.value?.manifest;
  if (!manifest) return [];
  return [
    {
      label: '备份用户',
      value: manifest.userId,
    },
    {
      label: '导出时间',
      value: formatDateTimeString(manifest.exportedAt),
    },
    {
      label: '备份指纹',
      value: formatArchiveFingerprint(manifest.archiveSha256),
    },
    {
      label: '备份清单',
      value: `${formatCount(manifest.includeCount)} 个路径 · format v${
        manifest.formatVersion
      }`,
    },
    {
      label: '层级',
      value: `A ${formatCount(manifest.layers.A)} · B ${formatCount(
        manifest.layers.B,
      )} · C ${formatCount(manifest.layers.C.generated)} 生成 / ${formatCount(
        manifest.layers.C.failed,
      )} 失败 / ${formatCount(manifest.layers.C.skipped)} 跳过`,
    },
  ];
});

const backupExportActionBoundary = computed(() => {
  if (exportingBackup.value) {
    return '记忆备份：正在向当前 Memory Service 发起 POST /export；完成前还没有新 zip、manifest 摘要或 archive 指纹，不会恢复、删除、替换、同步或外发任何记忆。';
  }
  if (backupDownloadReceipt.value) {
    return `记忆备份：再次点击会请求新的 backup zip；下方 ${backupDownloadReceipt.value.fileName} 只是上一次下载结果，新请求成功前不会代表新备份，也不会恢复、删除、替换、同步或外发任何记忆。`;
  }
  if (backupDownloadFailureReceipt.value) {
    return `记忆备份：上次下载失败于 ${formatTime(
      backupDownloadFailureReceipt.value.failedAt,
    )}；再次点击只会重试 POST /export，不会恢复、删除、替换、同步或外发任何记忆。`;
  }
  return '记忆备份：只会向当前 Memory Service 请求 backup zip 并保存到本机；不会恢复、删除、替换、同步或外发任何记忆，恢复仍需在录入里选择备份 zip 并先 dry-run。';
});

const showBackupPreActionReceipt = computed(
  () =>
    !exportingBackup.value &&
    !backupDownloadReceipt.value &&
    !backupDownloadFailureReceipt.value,
);

const backupPreActionReceiptText = computed(
  () =>
    '点击「记忆备份」只会向当前 Memory Service 请求 backup zip 并保存到本机；不会恢复、删除、替换、同步或外发任何记忆。恢复必须从「录入 > 备份 zip」重新选择文件，先 dry-run，再按 merge/replace 影响预览确认。',
);

const showBackupDownloadPendingReceipt = computed(() => exportingBackup.value);

const backupDownloadPendingReceiptItems = computed(() => {
  const requestedText = backupExportRequestedAt.value
    ? formatTime(backupExportRequestedAt.value)
    : '刚刚';
  const previousState = backupDownloadReceipt.value
    ? `下方旧下载回执仍然只是 ${backupDownloadReceipt.value.fileName} 的上一次结果，不代表本次已经保存新 zip。`
    : backupDownloadFailureReceipt.value
      ? `下方失败回执仍然只是上一次错误；本次请求还没有返回成功或失败。`
      : '页面已隐藏下载前回执，改为展示本次请求的等待状态。';
  return [
    {
      label: '请求状态',
      value: `${requestedText} 已向当前 Memory Service 发起 POST /export；完成前还没有新文件名、大小或 manifest 摘要。`,
    },
    {
      label: '当前屏幕',
      value: previousState,
    },
    {
      label: '无副作用',
      value:
        '等待导出期间不会恢复、删除、替换、同步或外发任何记忆；失败也不会覆盖当前 Memory Service 数据。',
    },
    {
      label: '下一步',
      value:
        '请求成功后浏览器才保存新的 backup zip 并显示下载回执；失败则显示下载失败回执。恢复仍需从「录入 > 备份 zip」重新 dry-run。',
    },
  ];
});

const backupZipModeActionBoundary = computed(() => {
  const fileName = selectedFileName.value;
  if (isBackupRestoreCandidate.value) {
    return `备份 zip：已识别 ${
      fileName || '当前文件'
    } 为 Personal AI 备份；点击只会重新选择备份 zip，选择后仍先做 schema 识别和 restore dry-run，不会直接恢复、删除、替换、同步或外发。`;
  }
  if (importMode.value === 'backup') {
    return '备份 zip：打开文件选择器并把所选 zip 当作 Personal AI 备份候选检查；选择文件本身不会恢复、删除、替换、同步或外发任何记忆。';
  }
  return '备份 zip：切换到备份恢复文件选择；只检查 Personal AI backup schema，不使用普通资料 work/personal 范围，也不会直接恢复或写入。';
});

const backupZipModeButtonBoundary = computed(() =>
  importBusy.value ? importSourceControlBoundary('备份 zip') : backupZipModeActionBoundary.value,
);

const backupRestoreNextStepItems = computed(() => {
  const receipt = backupRestoreReceipt.value;
  if (!receipt) return [];
  const layerText = receipt.restoredLayers.length
    ? `Layer ${receipt.restoredLayers.join('/')}`
    : '已声明运行层';
  const refreshReceipt = backupRestoreCoverageRefresh.value;
  const refreshText =
    refreshReceipt?.status === 'refreshing'
      ? '恢复写入已确认，正在自动重新读取 Coverage Map；刷新期间主视图仍保留当前可见快照，不会把未确认的刷新结果当作新状态。'
      : refreshReceipt?.status === 'failed'
        ? `恢复写入已确认，但自动刷新 Coverage Map 失败于 ${formatTime(
            refreshReceipt.at,
          )}；当前主视图可能仍是旧快照，请点「重扫覆盖」或修复服务连接后重试。失败原因：${
            refreshReceipt.message || '未知'
          }`
        : '恢复完成后已确认重新读取 Coverage Map；如果平台状态仍像旧快照，可点「重扫覆盖」重新拉取服务端聚合。';
  return [
    {
      label: '恢复范围',
      value: `已按 ${receipt.mode} 写入 ${layerText}；${
        receipt.backup?.archiveSha256
          ? `本次写入备份指纹 ${formatArchiveFingerprint(receipt.backup.archiveSha256)}；`
          : ''
      }derived 快照不会作为运行数据恢复，后续仍以当前 Memory Service 重扫结果为准。`,
    },
    {
      label: '覆盖刷新',
      value: refreshText,
    },
    {
      label: '再次恢复',
      value:
        '当前确认按钮已禁用，避免重复提交同一个归档；再次恢复需要重新选择备份 zip 并重新 dry-run。',
    },
    {
      label: '权限边界',
      value:
        '恢复只写入本用户 Memory Service 数据与受支持的本地 markdown；不会自动同步到外部平台、启用未配置通道或替用户发送内容。',
    },
  ];
});

const backupRestoreTargetItems = computed(() => {
  const mode = replaceExisting.value ? 'replace' : 'merge';
  const target = backupPreview.value?.backup.targetUserId;
  return [
    {
      label: '目标空间',
      value: target
        ? `恢复目标是当前 Memory Service 用户空间 ${target}；不是普通资料导入的 work/personal 范围。`
        : '恢复目标由 Memory Service dry-run 返回的当前用户空间决定；不会使用普通资料导入的 work/personal 范围。',
    },
    {
      label: '恢复模式',
      value:
        mode === 'replace'
          ? '当前选择 replace；真正写入前仍需要 dry-run 影响预览和 replace 确认。'
          : '当前选择 merge；真正写入前仍需要 dry-run 影响预览。',
    },
    {
      label: '边界',
      value:
        '选择或预检备份 zip 不会自动恢复、删除、同步外部平台或替用户发送内容；普通资料范围控件只在文档/zip/外部 AI 导入时出现。',
    },
  ];
});

const showBackupRestorePreviewGate = computed(
  () =>
    isBackupRestoreCandidate.value &&
    !backupPreview.value &&
    !backupRestoreReceipt.value,
);

const backupRestorePreviewGateItems = computed(() => {
  const mode = replaceExisting.value ? 'replace' : 'merge';
  const fileName = selectedFileName.value || '已选择的备份 zip';
  return [
    {
      label: '当前文件',
      value: `${fileName} 已被识别为 Personal AI backup schema；当前还没有恢复 dry-run 影响预览。`,
    },
    {
      label: '下一步',
      value: `点击「继续恢复」只会按 ${mode} 请求 restore dry-run，读取 manifest、archive 指纹、DB 行数和文件影响；不会写入 Memory Service。`,
    },
    {
      label: '模式边界',
      value:
        mode === 'replace'
          ? 'replace 只是当前预览模式；真正写入前还必须看到影响预览，并勾选 replace 写入确认。'
          : 'merge 是当前预览模式；真正写入前仍要先看到影响预览，必要时复核覆盖、删除或跨用户提醒。',
    },
    {
      label: '不会发生',
      value:
        '识别备份 zip 和生成 dry-run 预览都不会恢复、删除、替换、同步外部平台、启用未配置通道或替用户发送内容。',
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

const backupUserMismatch = computed(() => {
  const preview = backupPreview.value;
  if (!preview) return false;
  return preview.backup.userId !== preview.backup.targetUserId;
});

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
    backupUserMismatch.value ||
    backupWarningList.value.length > 0 ||
    preview.files.overwritten > 0 ||
    preview.files.deleted > 0
  );
});

const backupReplaceConfirmRequired = computed(
  () =>
    Boolean(backupPreview.value) &&
    replaceExisting.value &&
    !backupRestoreReceipt.value,
);

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

const scoreSnapshotReceiptItems = computed(() => {
  const currentCoverage = coverage.value;
  const platform = selectedPlatform.value;
  const breakdown = platform?.qualityScoreBreakdown;
  if (!currentCoverage || !platform || !breakdown) return [];
  const recentRatioText = `${Math.round(breakdown.recentRatio * 100)}%`;
  const snapshotAgeText = coverageSnapshotAgeText.value;
  const staleText = coverageSnapshotIsStale.value
    ? `已超过 ${currentCoverage.staleAfterDays} 天新鲜度窗口`
    : `仍在 ${currentCoverage.staleAfterDays} 天新鲜度窗口内`;
  return [
    {
      label: '快照来源',
      value: `分数来自服务端 ${formatTime(
        currentCoverage.generatedAt,
      )} 生成、本机 ${formatTime(coverageReadAt.value)} 读取的当前 Coverage 快照。`,
    },
    {
      label: '新鲜度基准',
      value: `当前快照年龄${snapshotAgeText}，${staleText}；${platform.name} 最近信号 ${formatTime(
        platform.lastSeenAt,
      )}，近 ${currentCoverage.staleAfterDays} 天信号占比 ${recentRatioText}。`,
    },
    {
      label: '重新计算',
      value:
        '切换平台、排序或查看修复路线只读当前快照；只有重扫覆盖取得新的 /coverage/map 响应后，质量分、平台卡片和优先处理才会替换。',
    },
  ];
});

const scoreBoundaryItems = computed(() => {
  const platform = selectedPlatform.value;
  if (!platform?.qualityScoreBreakdown) return [];
  const isRuntimeCoverage =
    platform.group === 'active' || platform.group === 'derived';
  return [
    {
      label: '衡量范围',
      value: `只看 ${stateLabel(
        platform.state,
      )} 状态、贡献项健康、新鲜度和失败/积压惩罚；${
        isRuntimeCoverage
          ? '未启用的可选通道不会混进当前平台低分。'
          : '未启用通道先作为规划项展示，启用后失败才进入覆盖缺口。'
      }`,
    },
    {
      label: '不代表',
      value:
        '不判断内容事实是否正确、是否足够完整，也不代表已经能安全进入回复、画像或外部同步。',
    },
    {
      label: '下一步',
      value: isRuntimeCoverage
        ? '优先处理只指向该平台的可读短板；修复仍需要用户检查来源或执行显式录入/同步动作。'
        : '可以先决定是否启用；当前页面不会自动抓取外部平台、改设置或写回来源。',
    },
  ];
});

const scoreRouteReceiptItems = computed(() => {
  const platform = selectedPlatform.value;
  if (!platform?.qualityScoreBreakdown) return [];
  const serviceFocus = servicePriorityFocus.value;
  if (serviceFocus?.platform.id === platform.id) {
    const focus = serviceFocus.focus;
    return [
      {
        label: '筛选路线',
        value:
          focus.selectionBasis ??
          '服务端优先选择 active / derived 平台中的 warning / critical 修复项，再按低分和状态排序。',
      },
      {
        label: '比较范围',
        value: `本轮比较 ${formatCount(
          focus.comparedPlatformCount,
        )} 个候选平台，排除 ${formatCount(
          focus.ignoredInfoActionCount,
        )} 个 info 规划项；未启用可选通道不会被当成当前故障。`,
      },
      {
        label: '当前下一步',
        value: `${focus.contributionLabel} · ${stateLabel(
          focus.contributionState,
        )}：${focus.reason}`,
      },
      {
        label: '路线边界',
        value:
          focus.boundary ??
          '这是只读诊断路线；查看平台不会重跑同步、改配置、写入记忆、标记已读或外发。',
      },
    ];
  }
  if (
    (platform.group === 'active' || platform.group === 'derived') &&
    platform.qualityScoreBreakdown.finalScore < 80
  ) {
    const contribution = pickScorePriorityContribution(platform.contributions);
    return [
      {
        label: '本地回退',
        value:
          '当前 Coverage API 没有返回 priorityFocus；页面按低分和贡献项严重度做本地定位，只用于查看当前快照。',
      },
      {
        label: '当前下一步',
        value: contribution
          ? `${contribution.label} · ${stateLabel(
              contribution.state,
            )}：${scorePriorityActionText(contribution)}`
          : '先查看贡献项明细，确认缺口来自新鲜度、配置还是回执。',
      },
      {
        label: '路线边界',
        value:
          '本地回退不会重跑同步、改配置、写入记忆、标记已读或外发；修复仍需要显式操作。',
      },
    ];
  }
  return [];
});

const timelineLatestAt = computed(() => {
  const events = coverage.value?.timeline ?? [];
  const timestamps = events
    .map((event) => event.at)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
});

const timelineStaleEventCount = computed(() => {
  const currentCoverage = coverage.value;
  if (!currentCoverage) return 0;
  const cutoff = currentCoverage.generatedAt - currentCoverage.staleAfterDays * 86400;
  return currentCoverage.timeline.filter((event) => event.at > 0 && event.at < cutoff)
    .length;
});

const timelineReceiptTitle = computed(() => {
  const currentCoverage = coverage.value;
  if (!currentCoverage) return '等待覆盖快照';
  const count = currentCoverage.timeline.length;
  if (count === 0) return '没有可显示的 lastSeenAt';
  return `${formatCount(count)} 条平台信号 · 最新 ${formatTime(timelineLatestAt.value)}`;
});

const timelineReceiptText = computed(() => {
  const currentCoverage = coverage.value;
  if (!currentCoverage) {
    return '等待 Coverage API 返回平台事件；本区不会触发同步、写库、标记已读或外发。';
  }
  if (currentCoverage.timeline.length === 0) {
    return `最近覆盖信号只展示带 lastSeenAt 的平台事件；当前快照没有可排序事件，不代表来源全部健康或全部失联。下方回执说明空切片边界。`;
  }
  const staleCount = timelineStaleEventCount.value;
  const staleText =
    staleCount > 0
      ? `其中 ${formatCount(staleCount)} 条已超过 ${currentCoverage.staleAfterDays} 天新鲜度窗口。`
      : `所有展示事件都在 ${currentCoverage.staleAfterDays} 天新鲜度窗口内。`;
  return `最近覆盖信号是 Coverage API 返回的可见切片，用来辅助判断地图新鲜度；${staleText}下方回执说明切片上限、证明范围和无副作用边界。`;
});

const timelineReceiptItems = computed(() => {
  const currentCoverage = coverage.value;
  if (!currentCoverage) {
    return [
      {
        label: '读取状态',
        value:
          '等待 /coverage/map 返回 timeline；当前没有可用切片，也没有执行同步或写入。',
      },
      {
        label: '无副作用',
        value: '本区不会触发同步、写库、标记已读或外发。',
      },
    ];
  }
  const visibleCount = currentCoverage.timeline.length;
  const cappedText =
    visibleCount >= TIMELINE_VISIBLE_LIMIT
      ? `已达到 ${TIMELINE_VISIBLE_LIMIT} 条上限，后面可能还有更早的平台事件未显示。`
      : `未达到 ${TIMELINE_VISIBLE_LIMIT} 条上限，但仍只是当前返回的可见切片。`;
  const latestText = timelineLatestAt.value
    ? `最新可见事件 ${formatTime(timelineLatestAt.value)}。`
    : '当前没有可见事件。';
  const staleText =
    visibleCount > 0
      ? `${formatCount(timelineStaleEventCount.value)} 条超过 ${currentCoverage.staleAfterDays} 天窗口。`
      : `没有事件可与 ${currentCoverage.staleAfterDays} 天窗口比较。`;

  return [
    {
      label: '可见切片',
      value: `当前显示 ${formatCount(
        visibleCount,
      )} 条按 lastSeenAt 排序的平台事件；Coverage API 最多返回 ${TIMELINE_VISIBLE_LIMIT} 条。${cappedText}`,
    },
    {
      label: '新鲜度基准',
      value: `${latestText}新鲜度按服务端快照 generatedAt 和 ${currentCoverage.staleAfterDays} 天窗口判断；${staleText}`,
    },
    {
      label: '不能证明',
      value:
        '这不是完整同步日志，不能证明所有平台已重扫、权限 / ACL 已校验、错误日志完整或内容事实正确。',
    },
    {
      label: '无副作用',
      value:
        '这里只读取当前覆盖快照；不会重跑 provider sync、写库、标记已读、修复配置或外发。',
    },
  ];
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

function latestDiagnosticGeneratedAt(): number | null {
  const timestamps = coverageDiagnostics.value
    .map((slice) => slice.generatedAt)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function diagnosticSliceLabel(slice: MemoryCoverageSliceName): string {
  const labels: Record<MemoryCoverageSliceName, string> = {
    'messages-by-source': '消息来源',
    pressure: '压力队列',
    'provider-jobs-recent': 'Provider jobs',
    'skills-sync': '技能同步',
  };
  return labels[slice] ?? slice;
}

function diagnosticSlicePrimaryText(
  slice: MemoryCoverageDiagnosticSliceResponse,
): string {
  const summary = slice.receipt.summary;
  const parts = [`${formatCount(summary.itemCount)} 行`];
  if (typeof summary.totalCount === 'number') {
    parts.push(`${formatCount(summary.totalCount)} 总量`);
  }
  if (typeof summary.recentCount === 'number') {
    parts.push(`${formatCount(summary.recentCount)} 近 7 天`);
  }
  if (typeof summary.failureCount === 'number') {
    parts.push(`${formatCount(summary.failureCount)} 失败`);
  }
  if (typeof summary.enabledCount === 'number') {
    parts.push(`${formatCount(summary.enabledCount)} 启用`);
  }
  return parts.join(' · ');
}

function diagnosticSliceReceiptItems(
  slice: MemoryCoverageDiagnosticSliceResponse,
) {
  const summary = slice.receipt.summary;
  const latestText = summary.latestAt
    ? formatTime(summary.latestAt)
    : '本切片没有可排序最新时间';
  const countParts = [
    `行数 ${formatCount(summary.itemCount)}`,
    typeof summary.totalCount === 'number'
      ? `总量 ${formatCount(summary.totalCount)}`
      : '',
    typeof summary.recentCount === 'number'
      ? `近 7 天 ${formatCount(summary.recentCount)}`
      : '',
    typeof summary.failureCount === 'number'
      ? `失败 ${formatCount(summary.failureCount)}`
      : '',
    typeof summary.enabledCount === 'number'
      ? `启用 ${formatCount(summary.enabledCount)}`
      : '',
  ].filter(Boolean);

  return [
    {
      label: '来源',
      value: slice.receipt.source,
    },
    {
      label: '窗口',
      value: `${summary.windowLabel}；最新时间 ${latestText}。`,
    },
    {
      label: '读数',
      value: countParts.join('；'),
    },
    {
      label: '空态解释',
      value: summary.emptyState,
    },
    {
      label: '诊断说明',
      value: slice.receipt.note,
    },
  ];
}

function formatDuration(value: number | undefined | null): string {
  if (typeof value !== 'number') return '未知';
  if (value < 60) return '不到 1 分钟';
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return `约 ${formatCount(minutes)} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `约 ${formatCount(hours)} 小时`;
  return `约 ${formatCount(Math.floor(hours / 24))} 天`;
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

function shortId(value: string | undefined | null): string {
  if (!value) return '未知';
  return value.length > 12 ? value.slice(0, 12) : value;
}

function formatArchiveFingerprint(value: string | undefined | null): string {
  return value ? `sha256:${shortId(value)}` : '未返回';
}

function scoreTone(score: number | undefined | null): string {
  if (typeof score !== 'number') return 'unknown';
  if (score >= 80) return 'good';
  if (score >= 55) return 'warn';
  return 'risk';
}

function scoreValue(platform: MemoryCoveragePlatform): number {
  return typeof platform.qualityScore === 'number' ? platform.qualityScore : 100;
}

function sortPlatformsForGroup(
  items: MemoryCoveragePlatform[],
  groupKey: MemoryCoveragePlatformGroup,
): MemoryCoveragePlatform[] {
  if (
    platformSortMode.value !== 'lowScore' ||
    (groupKey !== 'active' && groupKey !== 'derived')
  ) {
    return items;
  }
  return [...items].sort(
    (left, right) =>
      scoreValue(left) - scoreValue(right) ||
      left.name.localeCompare(right.name, 'zh-CN'),
  );
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

function focusQualityPlatform() {
  if (!qualityFocusPlatform.value) return;
  selectedPlatformId.value = qualityFocusPlatform.value.id;
  repairScope.value = 'selected';
}

function showToast(message: string) {
  toastText.value = message;
  window.setTimeout(() => {
    if (toastText.value === message) {
      toastText.value = '';
    }
  }, 3600);
}

async function loadCoverageDiagnostics(): Promise<void> {
  coverageDiagnosticsLoading.value = true;
  coverageDiagnosticsError.value = '';
  try {
    const client = getMemoryServiceClient();
    coverageDiagnostics.value = await client.getMemoryCoverageDiagnosticSlices();
    coverageDiagnosticsReadAt.value = Math.floor(Date.now() / 1000);
  } catch (error) {
    console.error('加载 Coverage P0 诊断切片失败:', error);
    coverageDiagnosticsError.value =
      error instanceof Error ? error.message : '加载 Coverage P0 诊断切片失败';
  } finally {
    coverageDiagnosticsLoading.value = false;
  }
}

async function refreshCoverageDiagnostics(): Promise<void> {
  await loadCoverageDiagnostics();
}

async function loadCoverage(
  options: { manual?: boolean } = {},
): Promise<boolean> {
  const requestedAt = Math.floor(Date.now() / 1000);
  const previousGeneratedAt = coverage.value?.generatedAt ?? null;
  const previousReadAt = coverageReadAt.value;
  if (options.manual) {
    manualCoverageRefreshReceipt.value = {
      status: 'refreshing',
      requestedAt,
      previousGeneratedAt,
      previousReadAt,
    };
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    const client = getMemoryServiceClient();
    const result = await client.getMemoryCoverageMap();
    const readAt = Math.floor(Date.now() / 1000);
    coverage.value = result;
    coverageReadAt.value = readAt;
    coverageRefreshFailedAt.value = null;
    if (options.manual) {
      manualCoverageRefreshReceipt.value = {
        status: 'succeeded',
        requestedAt,
        completedAt: readAt,
        previousGeneratedAt,
        previousReadAt,
        nextGeneratedAt: result.generatedAt,
        nextReadAt: readAt,
        summary: result.summary,
      };
    }
    if (
      !selectedPlatformId.value ||
      !result.platforms.some((platform) => platform.id === selectedPlatformId.value)
    ) {
      selectedPlatformId.value =
        result.platforms.find((platform) => platform.group === 'active')?.id ??
        result.platforms[0]?.id ??
        '';
    }
    await loadCoverageDiagnostics();
    return true;
  } catch (error) {
    console.error('加载记忆覆盖地图失败:', error);
    const failedAt = Math.floor(Date.now() / 1000);
    coverageRefreshFailedAt.value = failedAt;
    const message =
      error instanceof Error ? error.message : '加载记忆覆盖地图失败';
    errorMessage.value = message;
    if (options.manual) {
      manualCoverageRefreshReceipt.value = {
        status: 'failed',
        requestedAt,
        completedAt: failedAt,
        previousGeneratedAt,
        previousReadAt,
        message,
      };
    }
    return false;
  } finally {
    loading.value = false;
  }
}

async function refreshCoverageManually(): Promise<void> {
  await loadCoverage({ manual: true });
}

async function exportBackup() {
  exportingBackup.value = true;
  backupExportRequestedAt.value = Math.floor(Date.now() / 1000);
  try {
    const result = await getMemoryServiceClient().exportMemory();
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    backupDownloadReceipt.value = {
      fileName: result.fileName,
      contentType: result.contentType,
      downloadedAt: Math.floor(Date.now() / 1000),
      sizeBytes: result.blob.size,
      manifest: result.manifest,
    };
    backupDownloadFailureReceipt.value = null;
    showToast(`已下载记忆备份：${result.fileName}`);
  } catch (error) {
    console.error('下载记忆备份失败:', error);
    const message = error instanceof Error ? error.message : '下载记忆备份失败';
    backupDownloadReceipt.value = null;
    backupDownloadFailureReceipt.value = {
      failedAt: Math.floor(Date.now() / 1000),
      message,
    };
    showToast(message);
  } finally {
    exportingBackup.value = false;
    backupExportRequestedAt.value = null;
  }
}

function openImportDrawer() {
  importDrawerOpen.value = true;
  importStatus.value = '请选择文件，或粘贴文本后查看 dry-run。';
  importError.value = '';
}

function closeImportDrawer() {
  if (importBusy.value) {
    importStatus.value = busyImportCloseStatusText.value;
    return;
  }
  importDrawerOpen.value = false;
}

function handleImportBackdropClick() {
  closeImportDrawer();
}

function resetImportInspection() {
  importInspect.value = null;
  backupPreview.value = null;
  backupRestoreReceipt.value = null;
  backupRestoreFailureReceipt.value = null;
  backupRestoreCoverageRefresh.value = null;
  smartImportReceipt.value = null;
  importError.value = '';
  smartImportCommitPending.value = false;
  importStatus.value = '';
  backupRestoreReviewed.value = false;
  replaceRestoreConfirmed.value = false;
  highRiskImportConfirmed.value = false;
}

function switchToPaste() {
  if (importBusy.value) return;
  importMode.value = 'paste';
  importFile.value = null;
  resetImportInspection();
}

function openImportFilePicker(mode: ImportMode = 'file') {
  if (importBusy.value) return;
  importMode.value = mode;
  importFileInput.value?.click();
}

async function handleImportFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (importBusy.value) return;
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
  smartImportCommitPending.value = false;
  backupPreview.value = null;
  backupRestoreFailureReceipt.value = null;
  backupRestoreReviewed.value = false;
  replaceRestoreConfirmed.value = false;
  smartImportReceipt.value = null;

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
      importStatus.value = `${mismatchPrefix}这份资料已经录入过，本次不会重复写入；请查看重复录入回执。`;
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
  smartImportCommitPending.value = true;
  try {
    const client = getMemoryServiceClient();
    const result =
      importMode.value === 'paste'
        ? await client.commitSmartMemoryImportText(importText.value, {
            scope: importScope.value,
            confirmHighRisk: hasHighRiskImport.value && highRiskImportConfirmed.value,
          })
        : importFile.value
          ? await client.commitSmartMemoryImportFile(importFile.value, {
              scope: importScope.value,
              confirmHighRisk: hasHighRiskImport.value && highRiskImportConfirmed.value,
            })
          : null;

    if (!result) {
      throw new Error('请先选择文件或粘贴文本');
    }

    smartImportReceipt.value = result;
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
    smartImportCommitPending.value = false;
    importBusy.value = false;
  }
}

async function continueBackupRestore() {
  if (!importFile.value) {
    importError.value = '请先选择 Personal AI 备份 zip。';
    return;
  }

  const mode = replaceExisting.value ? 'replace' : 'merge';

  importBusy.value = true;
  importError.value = '';
  backupRestoreFailureReceipt.value = null;
  if (!backupRestoreReceipt.value) {
    backupRestoreCoverageRefresh.value = null;
  }
  const failureStage = backupPreview.value ? 'write' : 'dry_run';
  try {
    const client = getMemoryServiceClient();
    if (!backupPreview.value) {
      backupPreview.value = await client.previewImportMemory(importFile.value, mode);
      backupRestoreFailureReceipt.value = null;
      backupRestoreReviewed.value = !backupRestoreReviewRequired.value;
      replaceRestoreConfirmed.value = !backupReplaceConfirmRequired.value;
      importStatus.value = `dry-run 完成：${backupPreview.value.backup.includeCount} 个备份条目，模式 ${mode}。`;
      return;
    }

    if (backupRestoreReviewRequired.value && !backupRestoreReviewed.value) {
      importError.value = '请先复核恢复影响路径、恢复模式和提醒。';
      return;
    }

    if (backupReplaceConfirmRequired.value && !replaceRestoreConfirmed.value) {
      importError.value = '请先确认按 replace 替换当前记忆数据库。';
      return;
    }

    const result = await client.importMemory(importFile.value, mode, {
      confirmUserMismatch: backupUserMismatch.value,
    });
    backupRestoreReceipt.value = result;
    backupRestoreFailureReceipt.value = null;
    importStatus.value = `恢复完成：${result.database.action}，写入 ${result.files.written} 个文件，覆盖 ${result.files.overwritten} 个。`;
    showToast(importStatus.value);
    backupRestoreCoverageRefresh.value = {
      status: 'refreshing',
      at: Math.floor(Date.now() / 1000),
    };
    const refreshed = await loadCoverage();
    backupRestoreCoverageRefresh.value = {
      status: refreshed ? 'succeeded' : 'failed',
      at: Math.floor(Date.now() / 1000),
      message: refreshed ? undefined : errorMessage.value,
    };
  } catch (error) {
    console.error('恢复记忆备份失败:', error);
    const message = error instanceof Error ? error.message : '恢复记忆备份失败';
    importError.value = message;
    backupRestoreFailureReceipt.value = {
      stage: failureStage,
      mode,
      failedAt: Math.floor(Date.now() / 1000),
      fileName: importFile.value.name,
      message,
      hadPreview: Boolean(backupPreview.value),
      backupUserId: backupPreview.value?.backup.userId,
      targetUserId: backupPreview.value?.backup.targetUserId,
      includeCount: backupPreview.value?.backup.includeCount,
      archiveSha256: backupPreview.value?.backup.archiveSha256,
    };
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
.snapshot-receipt,
.manual-refresh-receipt,
.coverage-diagnostics,
.backup-preaction-receipt,
.backup-download-pending-receipt,
.backup-download-receipt,
.backup-download-failure-receipt,
.quality-focus,
.legend-bar,
.sort-receipt {
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

.snapshot-receipt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.82rem 1rem;
  border-color: rgba(20, 184, 166, 0.28);
  background: rgba(15, 118, 110, 0.16);
}

.snapshot-receipt.warn {
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(127, 29, 29, 0.2);
}

.snapshot-receipt.loading {
  border-color: rgba(96, 165, 250, 0.3);
  background: rgba(30, 64, 175, 0.16);
}

.snapshot-receipt div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 11rem;
}

.snapshot-receipt span {
  color: #5eead4;
  font-size: 0.72rem;
  font-weight: 800;
}

.snapshot-receipt.warn span {
  color: #fca5a5;
}

.snapshot-receipt.loading span {
  color: #93c5fd;
}

.snapshot-receipt strong {
  color: #f8fafc;
  font-size: 0.9rem;
}

.snapshot-receipt p {
  margin: 0;
  color: #cbd5e1;
  text-align: right;
}

.manual-refresh-receipt {
  display: grid;
  grid-template-columns: minmax(12rem, 0.38fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
  padding: 0.82rem 1rem;
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(30, 64, 175, 0.14);
}

.manual-refresh-receipt.succeeded {
  border-color: rgba(34, 197, 94, 0.28);
  background: rgba(22, 101, 52, 0.16);
}

.manual-refresh-receipt.failed {
  border-color: rgba(248, 113, 113, 0.34);
  background: rgba(127, 29, 29, 0.18);
}

.manual-refresh-receipt span,
.manual-refresh-receipt strong {
  display: block;
}

.manual-refresh-receipt span {
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 800;
}

.manual-refresh-receipt.succeeded span {
  color: #86efac;
}

.manual-refresh-receipt.failed span {
  color: #fca5a5;
}

.manual-refresh-receipt strong {
  color: #f8fafc;
  margin-top: 0.22rem;
}

.manual-refresh-receipt dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 0;
}

.manual-refresh-receipt dt {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 800;
}

.manual-refresh-receipt dd {
  margin: 0.18rem 0 0;
  color: #dbeafe;
  font-size: 0.82rem;
  line-height: 1.45;
}

.coverage-diagnostics {
  padding: 1rem;
}

.coverage-diagnostics.loading {
  border-color: rgba(96, 165, 250, 0.34);
}

.coverage-diagnostics.error {
  border-color: rgba(248, 113, 113, 0.34);
}

.coverage-diagnostics-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.coverage-diagnostics-head > div {
  display: grid;
  gap: 0.22rem;
}

.coverage-diagnostics-head span,
.coverage-diagnostic-card span {
  color: #38bdf8;
  font-size: 0.73rem;
  font-weight: 800;
}

.coverage-diagnostics.error .coverage-diagnostics-head span {
  color: #fca5a5;
}

.coverage-diagnostics-head strong {
  color: #f8fafc;
  font-size: 0.95rem;
}

.coverage-diagnostics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.72rem;
  margin-top: 0.85rem;
}

.coverage-diagnostic-card {
  display: grid;
  align-content: start;
  gap: 0.72rem;
  min-width: 0;
  padding: 0.82rem;
  border: 1px solid rgba(56, 189, 248, 0.16);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.28);
}

.coverage-diagnostic-card > div {
  display: grid;
  gap: 0.22rem;
}

.coverage-diagnostic-card strong {
  color: #f8fafc;
  font-size: 0.88rem;
  line-height: 1.35;
}

.coverage-diagnostic-card dl {
  display: grid;
  gap: 0.52rem;
  margin: 0;
}

.coverage-diagnostic-card dt {
  color: #94a3b8;
  font-size: 0.68rem;
  font-weight: 800;
}

.coverage-diagnostic-card dd {
  margin: 0.16rem 0 0;
  color: #e2e8f0;
  font-size: 0.76rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.coverage-diagnostic-card p,
.coverage-diagnostics-empty {
  color: #bfdbfe;
  font-size: 0.76rem;
  line-height: 1.5;
}

.coverage-diagnostics-empty {
  margin-top: 0.75rem;
  padding: 0.78rem;
  border: 1px dashed rgba(148, 163, 184, 0.22);
  border-radius: 8px;
}

.backup-preaction-receipt,
.backup-download-pending-receipt,
.backup-download-receipt,
.backup-download-failure-receipt {
  display: grid;
  grid-template-columns: minmax(12rem, 0.5fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
  padding: 0.82rem 1rem;
  border-color: rgba(96, 165, 250, 0.26);
  background: rgba(30, 64, 175, 0.14);
}

.backup-preaction-receipt {
  border-color: rgba(94, 234, 212, 0.24);
  background: rgba(13, 148, 136, 0.12);
}

.backup-download-pending-receipt {
  border-color: rgba(125, 211, 252, 0.3);
  background: rgba(8, 47, 73, 0.18);
}

.backup-download-failure-receipt {
  border-color: rgba(248, 113, 113, 0.34);
  background: rgba(127, 29, 29, 0.18);
}

.backup-preaction-receipt span,
.backup-preaction-receipt strong,
.backup-download-pending-receipt span,
.backup-download-pending-receipt strong,
.backup-download-receipt span,
.backup-download-receipt strong,
.backup-download-failure-receipt span,
.backup-download-failure-receipt strong {
  display: block;
}

.backup-preaction-receipt span,
.backup-download-pending-receipt span,
.backup-download-receipt span,
.backup-download-failure-receipt span {
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 800;
}

.backup-preaction-receipt span {
  color: #5eead4;
}

.backup-download-pending-receipt span {
  color: #7dd3fc;
}

.backup-download-failure-receipt span {
  color: #fca5a5;
}

.backup-preaction-receipt strong,
.backup-download-pending-receipt strong,
.backup-download-receipt strong,
.backup-download-failure-receipt strong {
  margin-top: 0.2rem;
  color: #f8fafc;
  font-size: 0.86rem;
  overflow-wrap: anywhere;
}

.backup-preaction-receipt p,
.backup-download-receipt p,
.backup-download-failure-receipt p {
  margin: 0;
  color: #cbd5e1;
  text-align: right;
}

.backup-download-pending-receipt dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.52rem;
  margin: 0;
}

.backup-download-pending-receipt dt {
  color: #bae6fd;
  font-size: 0.68rem;
  font-weight: 800;
}

.backup-download-pending-receipt dd {
  margin: 0.18rem 0 0;
  color: #dbeafe;
  font-size: 0.72rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.backup-receipt-body {
  min-width: 0;
}

.backup-download-manifest {
  display: grid;
  gap: 0.36rem;
  margin: 0.55rem 0 0;
}

.backup-download-manifest div {
  display: grid;
  grid-template-columns: minmax(4.8rem, auto) minmax(0, 1fr);
  gap: 0.52rem;
  align-items: start;
}

.backup-download-manifest dt {
  color: #bfdbfe;
  font-size: 0.7rem;
  font-weight: 800;
  text-align: left;
}

.backup-download-manifest dd {
  margin: 0;
  color: #dbeafe;
  font-size: 0.72rem;
  line-height: 1.45;
  text-align: right;
  overflow-wrap: anywhere;
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

.quality-focus {
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  align-items: flex-start;
  padding: 0.82rem 0.9rem;
  border-left: 3px solid rgba(251, 191, 36, 0.72);
}

.quality-focus > div {
  min-width: 0;
  flex: 1;
}

.quality-focus.risk {
  border-left-color: rgba(248, 113, 113, 0.78);
}

.quality-focus.good {
  border-left-color: rgba(94, 234, 212, 0.62);
}

.quality-focus span,
.quality-focus strong {
  display: block;
}

.quality-focus span {
  color: #fde68a;
  font-size: 0.7rem;
  font-weight: 800;
}

.quality-focus strong {
  margin-top: 0.2rem;
  color: #f8fafc;
  font-size: 0.94rem;
}

.quality-focus p {
  margin-top: 0.35rem;
  font-size: 0.78rem;
}

.quality-focus-receipt {
  display: grid;
  gap: 0.42rem;
  margin: 0.58rem 0 0;
}

.quality-focus-receipt div {
  display: grid;
  grid-template-columns: minmax(4.4rem, auto) minmax(0, 1fr);
  gap: 0.52rem;
}

.quality-focus-receipt dt {
  color: #fef3c7;
  font-size: 0.68rem;
  font-weight: 800;
}

.quality-focus-receipt dd {
  margin: 0;
  color: #dbeafe;
  font-size: 0.72rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
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

.sort-receipt {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.7rem;
  align-items: start;
  padding: 0.72rem 0.85rem;
  border-color: rgba(125, 211, 252, 0.22);
  background: rgba(8, 47, 73, 0.14);
}

.sort-receipt > span {
  color: #7dd3fc;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sort-receipt dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.52rem;
  margin: 0;
}

.sort-receipt div {
  min-width: 0;
}

.sort-receipt dt {
  color: #bae6fd;
  font-size: 0.68rem;
  font-weight: 800;
}

.sort-receipt dd {
  margin: 0.18rem 0 0;
  color: #dbeafe;
  font-size: 0.72rem;
  line-height: 1.42;
  overflow-wrap: anywhere;
}

.platform-sort-control {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  padding: 0.18rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.52);
}

.platform-sort-control > span {
  padding: 0 0.38rem;
  color: #94a3b8;
  font-size: 0.7rem;
  font-weight: 800;
}

.platform-sort-control button {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.32rem 0.48rem;
}

.platform-sort-control button.active {
  color: #0f172a;
  background: #5eead4;
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

.timeline-receipt,
.timeline-empty-state {
  margin: 1rem 1rem 0;
  padding: 0.72rem 0.78rem;
  border: 1px solid rgba(125, 211, 252, 0.2);
  border-radius: 8px;
  background: rgba(8, 47, 73, 0.16);
}

.timeline-receipt strong,
.timeline-empty-state strong {
  display: block;
  color: #e0f2fe;
  font-size: 0.84rem;
}

.timeline-receipt p,
.timeline-empty-state p {
  margin-top: 0.32rem;
  color: #cbd5e1;
  font-size: 0.76rem;
  line-height: 1.48;
}

.timeline-receipt-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  margin: 0.68rem 0 0;
}

.timeline-receipt-grid div {
  min-width: 0;
  padding: 0.58rem 0.62rem;
  border: 1px solid rgba(125, 211, 252, 0.14);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.36);
}

.timeline-receipt-grid dt {
  color: #7dd3fc;
  font-size: 0.68rem;
  font-weight: 700;
}

.timeline-receipt-grid dd {
  margin: 0.22rem 0 0;
  color: #cbd5e1;
  font-size: 0.73rem;
  line-height: 1.45;
}

.timeline-empty-state {
  border-color: rgba(251, 191, 36, 0.28);
  background: rgba(120, 53, 15, 0.14);
}

.timeline-empty-state strong {
  color: #fef3c7;
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
.document-import-review-box,
.external-ai-review-box,
.external-ai-decision-box,
.external-ai-pending-box,
.backup-restore-target-receipt,
.backup-restore-preview-gate,
.smart-import-receipt,
.risk-review-box,
.replace-confirmation-box,
.preview-box,
.backup-impact-list,
.restore-receipt,
.restore-failure-receipt,
.restore-next-step-receipt,
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

.score-snapshot-receipt,
.score-boundary-receipt,
.score-route-receipt {
  margin: 0.68rem 0;
  padding: 0.68rem 0.72rem;
  border: 1px solid rgba(125, 211, 252, 0.2);
  border-radius: 7px;
  background: rgba(8, 47, 73, 0.16);
}

.score-snapshot-receipt {
  border-color: rgba(45, 212, 191, 0.24);
  background: rgba(20, 83, 45, 0.14);
}

.score-route-receipt {
  border-color: rgba(167, 139, 250, 0.24);
  background: rgba(46, 16, 101, 0.16);
}

.score-snapshot-receipt > span,
.score-boundary-receipt > span,
.score-route-receipt > span {
  display: block;
  color: #bae6fd;
  font-size: 0.68rem;
  font-weight: 800;
}

.score-snapshot-receipt > span {
  color: #99f6e4;
}

.score-route-receipt > span {
  color: #ddd6fe;
}

.score-snapshot-receipt dl,
.score-boundary-receipt dl,
.score-route-receipt dl {
  display: grid;
  gap: 0.42rem;
  margin: 0.45rem 0 0;
}

.score-snapshot-receipt div,
.score-boundary-receipt div,
.score-route-receipt div {
  display: grid;
  grid-template-columns: minmax(3.8rem, auto) minmax(0, 1fr);
  gap: 0.5rem;
}

.score-snapshot-receipt dt,
.score-boundary-receipt dt,
.score-route-receipt dt {
  color: #7dd3fc;
  font-size: 0.72rem;
  font-weight: 800;
}

.score-snapshot-receipt dt {
  color: #5eead4;
}

.score-route-receipt dt {
  color: #c4b5fd;
}

.score-snapshot-receipt dd,
.score-boundary-receipt dd,
.score-route-receipt dd {
  margin: 0;
  color: #dbeafe;
  font-size: 0.74rem;
  line-height: 1.45;
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

.source-chip:disabled {
  cursor: not-allowed;
  opacity: 0.52;
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

.scope-row select:disabled,
.paste-box:disabled {
  cursor: not-allowed;
  opacity: 0.58;
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
.document-import-review-box,
.external-ai-review-box,
.external-ai-decision-box,
.external-ai-pending-box,
.backup-restore-target-receipt,
.backup-restore-preview-gate,
.smart-import-scope-receipt,
.smart-import-receipt,
.risk-review-box,
.backup-impact-list,
.restore-receipt,
.restore-failure-receipt,
.restore-next-step-receipt,
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
.document-import-review-box strong,
.external-ai-review-box strong,
.external-ai-decision-box strong,
.external-ai-pending-box strong,
.backup-restore-target-receipt strong,
.backup-restore-preview-gate strong,
.smart-import-scope-receipt strong,
.smart-import-receipt strong,
.risk-review-box strong,
.backup-warning-list strong,
.restore-receipt > strong,
.restore-failure-receipt > strong,
.restore-next-step-receipt > strong {
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

.document-import-review-box {
  color: #c7d2fe;
  font-size: 0.78rem;
  line-height: 1.5;
}

.document-import-review-box.warn {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(120, 53, 15, 0.16);
  color: #fde68a;
}

.document-import-review-box p {
  margin: 0.35rem 0 0;
  color: inherit;
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

.external-ai-decision-box {
  display: grid;
  gap: 0.55rem;
  border-color: rgba(94, 234, 212, 0.26);
  background: rgba(13, 148, 136, 0.1);
}

.external-ai-pending-box {
  display: grid;
  gap: 0.55rem;
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(120, 53, 15, 0.16);
}

.smart-import-scope-receipt {
  display: grid;
  gap: 0.55rem;
  border-color: rgba(125, 211, 252, 0.24);
  background: rgba(8, 47, 73, 0.16);
}

.smart-import-receipt {
  display: grid;
  gap: 0.55rem;
  border-color: rgba(45, 212, 191, 0.28);
  background: rgba(8, 145, 178, 0.12);
}

.backup-restore-target-receipt {
  display: grid;
  gap: 0.55rem;
  border-color: rgba(125, 211, 252, 0.24);
  background: rgba(8, 47, 73, 0.16);
}

.backup-restore-preview-gate {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.65rem;
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(120, 53, 15, 0.16);
}

.external-ai-decision-box div,
.external-ai-pending-box div,
.backup-restore-target-receipt div,
.backup-restore-preview-gate div,
.smart-import-scope-receipt div,
.smart-import-receipt div {
  display: grid;
  grid-template-columns: 5.4rem minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
}

.external-ai-decision-box span,
.external-ai-pending-box span,
.backup-restore-target-receipt span,
.backup-restore-preview-gate span,
.smart-import-scope-receipt span,
.smart-import-receipt span {
  color: #5eead4;
  font-size: 0.72rem;
  font-weight: 800;
}

.backup-restore-preview-gate span {
  color: #fcd34d;
}

.external-ai-pending-box span {
  color: #fcd34d;
}

.external-ai-decision-box p,
.external-ai-pending-box p,
.backup-restore-target-receipt p,
.backup-restore-preview-gate p,
.smart-import-scope-receipt p,
.smart-import-receipt p {
  margin: 0;
  color: #dbeafe;
  font-size: 0.76rem;
  line-height: 1.45;
}

.risk-review-box {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(120, 53, 15, 0.2);
}

.replace-confirmation-box {
  margin-top: 0.65rem;
  padding: 0.75rem;
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
}

.replace-confirmation-box strong {
  display: block;
  color: #fee2e2;
  font-size: 0.82rem;
}

.replace-confirmation-box p {
  margin: 0.35rem 0 0;
  color: #fecaca;
  font-size: 0.76rem;
  line-height: 1.45;
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
.restore-failure-receipt,
.restore-next-step-receipt,
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

.restore-next-step-receipt {
  display: grid;
  gap: 0.55rem;
  border-color: rgba(96, 165, 250, 0.24);
  background: rgba(30, 64, 175, 0.14);
}

.restore-failure-receipt {
  display: grid;
  gap: 0.55rem;
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(127, 29, 29, 0.18);
}

.restore-failure-receipt div {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
}

.restore-failure-receipt span {
  color: #fca5a5;
  font-size: 0.72rem;
  font-weight: 800;
}

.restore-failure-receipt p {
  margin: 0;
  color: #fee2e2;
  font-size: 0.76rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.restore-next-step-receipt div {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
}

.restore-next-step-receipt span {
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 800;
}

.restore-next-step-receipt p {
  margin: 0;
  color: #dbeafe;
  font-size: 0.76rem;
  line-height: 1.45;
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

  .coverage-diagnostics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .coverage-header,
  .panel-head,
  .compact-dropzone,
  .snapshot-receipt,
  .coverage-diagnostics-head,
  .quality-focus {
    flex-direction: column;
    align-items: flex-start;
  }

  .backup-preaction-receipt,
  .manual-refresh-receipt,
  .backup-download-pending-receipt,
  .backup-download-receipt,
  .backup-download-failure-receipt {
    grid-template-columns: 1fr;
  }

  .manual-refresh-receipt dl {
    grid-template-columns: 1fr;
  }

  .sort-receipt,
  .sort-receipt dl {
    grid-template-columns: 1fr;
  }

  .snapshot-receipt div {
    min-width: 0;
  }

  .snapshot-receipt p,
  .backup-preaction-receipt p,
  .backup-download-receipt p,
  .backup-download-failure-receipt p,
  .backup-download-pending-receipt dd {
    text-align: left;
  }

  .header-actions {
    align-items: flex-start;
  }

  .memory-action-row {
    justify-content: flex-start;
  }

  .platform-sort-control {
    width: 100%;
    margin-left: 0;
  }

  .summary-strip,
  .metric-row,
  .score-factor-grid,
  .analysis-summary,
  .preview-box,
  .coverage-diagnostics-grid,
  .timeline-receipt-grid {
    grid-template-columns: 1fr;
  }

  .timeline-event {
    grid-template-columns: 1fr;
  }
}
</style>
