<template>
  <div class="entity-list">
    <div class="entity-header">
      <div class="entity-avatar">{{ getEntityIcon(entityType) }}</div>
      <div class="entity-info">
        <h2>{{ getEntityTypeName(entityType) }}</h2>
        <div class="entity-meta">
          共 {{ entities.length }} 个{{ getEntityTypeName(entityType) }}
          <span v-if="searchQuery"> • 搜索: "{{ searchQuery }}"</span>
        </div>
      </div>
    </div>

    <div v-if="topicReadUndo" class="topic-undo-toast" role="status">
      <span>已将「{{ topicReadUndo.topicName }}」标记为已读</span>
      <button type="button" @click="handleUndoTopicRead">撤销</button>
    </div>

    <div
      v-if="topicDeferredUndo"
      class="topic-undo-toast topic-defer-undo-toast"
      role="status"
    >
      <span>
        已将「{{ topicDeferredUndo.topicName }}」稍后到
        {{ formatDeferredUntil(topicDeferredUndo.until) }}
      </span>
      <div class="topic-undo-actions">
        <button
          type="button"
          :title="getTopicDeferToastViewBoundary(topicDeferredUndo)"
          :aria-label="getTopicDeferToastViewBoundary(topicDeferredUndo)"
          @click="handleViewDeferredTopics"
        >
          查看稍后
        </button>
        <button
          type="button"
          :title="getTopicDeferredRestoreBoundary(topicDeferredUndo)"
          :aria-label="getTopicDeferredRestoreBoundary(topicDeferredUndo)"
          @click="handleUndoTopicDefer"
        >
          恢复
        </button>
      </div>
    </div>

    <div
      v-if="topicDeferRestoreReceipt"
      class="topic-undo-toast topic-defer-restore-receipt"
      role="status"
      aria-live="polite"
    >
      <div class="topic-defer-restore-copy">
        <strong>{{ topicDeferRestoreReceipt.title }}</strong>
        <span>{{ topicDeferRestoreReceipt.summary }}</span>
        <small
          v-for="detail in topicDeferRestoreReceipt.details"
          :key="detail"
        >
          {{ detail }}
        </small>
      </div>
    </div>

    <div
      v-if="topicMuteUndo"
      class="topic-undo-toast topic-mute-undo-toast"
      role="status"
    >
      <span>
        已将「{{ topicMuteUndo.topicName }}」静音：{{
          formatMutedReason(topicMuteUndo.reason)
        }}{{ formatMutedUntil(topicMuteUndo.until) }}。本机过滤，未读保留；未同步或标记已读。
      </span>
      <div class="topic-undo-actions">
        <button
          type="button"
          :title="getTopicMuteToastViewBoundary(topicMuteUndo)"
          :aria-label="getTopicMuteToastViewBoundary(topicMuteUndo)"
          @click="handleViewMutedTopics"
        >
          查看静音
        </button>
        <button
          type="button"
          :title="getTopicMutedRestoreBoundary(topicMuteUndo)"
          :aria-label="getTopicMutedRestoreBoundary(topicMuteUndo)"
          @click="handleUndoTopicMute"
        >
          取消静音
        </button>
      </div>
    </div>

    <div
      v-if="topicMuteRestoreReceipt"
      class="topic-undo-toast topic-mute-restore-receipt"
      role="status"
      aria-live="polite"
    >
      <div class="topic-mute-restore-copy">
        <strong>{{ topicMuteRestoreReceipt.title }}</strong>
        <span>{{ topicMuteRestoreReceipt.summary }}</span>
        <small
          v-for="detail in topicMuteRestoreReceipt.details"
          :key="detail"
        >
          {{ detail }}
        </small>
      </div>
    </div>

    <!-- 过滤控件 -->
    <div v-if="!isLoading && entities.length > 0" class="filter-controls">
      <!-- 主题视图切换 -->
      <div v-if="entityType === 'Topic'" class="view-control">
        <button
          :class="['view-toggle-btn', { active: topicViewMode === 'unread' }]"
          @click="topicViewMode = 'unread'"
        >
          🔴 仅未读
        </button>
        <button
          :class="['view-toggle-btn', { active: topicViewMode === 'all' }]"
          @click="topicViewMode = 'all'"
        >
          📋 全部主题
        </button>
        <button
          :class="['view-toggle-btn', { active: topicViewMode === 'later' }]"
          @click="topicViewMode = 'later'"
        >
          ⏰ 稍后 {{ topicLaterCount > 0 ? topicLaterCount : '' }}
        </button>
        <button
          :class="['view-toggle-btn', { active: topicViewMode === 'muted' }]"
          @click="topicViewMode = 'muted'"
        >
          🔕 静音 {{ topicMutedCount > 0 ? topicMutedCount : '' }}
        </button>
      </div>

      <!-- 排序选择 -->
      <div v-if="entityType === 'Topic'" class="filter-select-wrapper">
        <select class="filter-select" v-model="topicSortMode">
          <option value="triage">优先处理排序</option>
          <option value="time">最新消息排序</option>
          <option value="importance">热度排序</option>
          <option value="unread-count">未读数量排序</option>
        </select>
      </div>

      <div
        v-if="entityType === 'Person' || entityType === 'Project'"
        class="filter-select-wrapper"
      >
        <select class="filter-select" v-model="selectedFilter">
          <option value="all">全部{{ getEntityTypeName(entityType) }}</option>
          <option v-if="entityType === 'Person'" value="recent_contact">
            最近联系
          </option>
          <option v-if="entityType === 'Person'" value="frequent_collaboration">
            频繁协作
          </option>
          <option v-if="entityType === 'Project'" value="highlighted">
            重点项目
          </option>
          <option v-if="entityType === 'Project'" value="active">
            活跃项目
          </option>
        </select>
      </div>

      <!-- 新增：AI 分析按钮（仅在向量搜索模式显示） -->
      <button
        v-if="searchContext.mode === 'entity' && !searchContext.askResult"
        class="ai-analyze-btn"
        @click="handleAskAnalyze"
        :disabled="isAnalyzing"
      >
        <span class="ai-icon">🤖</span>
        <span>{{ isAnalyzing ? '正在分析...' : '整理分析后的结果' }}</span>
      </button>

      <div class="results-count">
        <span v-if="searchQuery">搜索结果：</span>
        显示 {{ filteredEntities.length }} / {{ entities.length }} 项
      </div>

      <div
        v-if="topicUnreadQueueReceipt"
        class="topic-unread-queue-receipt"
        role="status"
      >
        <span class="topic-unread-queue-label">
          {{ topicUnreadQueueReceipt.label }}
        </span>
        <span>{{ topicUnreadQueueReceipt.detail }}</span>
      </div>

      <div
        v-if="topicLoadFailureReceipt"
        class="topic-load-failure-receipt"
        role="status"
      >
        <span class="topic-load-failure-label">
          {{ topicLoadFailureReceiptLabel }}
        </span>
        <span>{{ topicLoadFailureReceiptDetail }}</span>
        <button
          type="button"
          class="topic-load-retry-btn"
          @click="handleRetryEntityLoad"
        >
          重新加载主题
        </button>
      </div>

      <div
        v-if="topicSearchScopeReceipt"
        class="topic-search-scope-receipt"
        role="status"
      >
        <span class="topic-search-scope-label">
          {{ topicSearchScopeReceipt.label }}
        </span>
        <span>{{ topicSearchScopeReceipt.detail }}</span>
      </div>

      <div
        v-if="sourceOpenReceipt"
        class="source-open-receipt topic-list-source-open-receipt"
        role="status"
        aria-live="polite"
      >
        <div class="source-open-receipt-header">
          <strong>{{ sourceOpenReceipt.title }}</strong>
          <span class="source-open-host">{{ sourceOpenReceipt.host }}</span>
        </div>
        <p>{{ sourceOpenReceipt.summary }}</p>
        <ul>
          <li v-for="detail in sourceOpenReceipt.details" :key="detail">
            {{ detail }}
          </li>
        </ul>
      </div>
    </div>

    <!-- AI 分析结果区域（折叠展开） -->
    <div
      v-if="searchContext.askResult && searchContext.mode === 'entity'"
      class="ai-analysis-panel"
    >
      <div class="panel-header" @click="toggleAnalysisPanel">
        <div class="header-left">
          <span class="ai-icon">🤖</span>
          <h4>AI 分析结果</h4>
        </div>
        <button class="toggle-btn">
          {{ isAnalysisPanelExpanded ? '收起 ▲' : '展开 ▼' }}
        </button>
      </div>

      <div v-show="isAnalysisPanelExpanded" class="panel-content">
        <!-- 主要回答（支持 Markdown 渲染） -->
        <div class="answer-main" v-html="renderedAnswer"></div>

        <!-- 结构化信息（如果有） -->
        <div
          v-if="searchContext.askResult.structuredAnswer"
          class="answer-structured"
        >
          <!-- 关键发现 -->
          <div
            v-if="searchContext.askResult.structuredAnswer.keyFindings?.length"
            class="findings-section"
          >
            <h4>🔍 关键发现</h4>
            <ul>
              <li
                v-for="(finding, idx) in searchContext.askResult
                  .structuredAnswer.keyFindings"
                :key="idx"
              >
                {{ finding }}
              </li>
            </ul>
          </div>

          <!-- 时间线 -->
          <div
            v-if="searchContext.askResult.structuredAnswer.timeline?.length"
            class="timeline-section"
          >
            <h4>⏰ 时间线</h4>
            <div class="timeline-items">
              <div
                v-for="(item, idx) in searchContext.askResult.structuredAnswer
                  .timeline"
                :key="idx"
                class="timeline-item"
              >
                <span class="timeline-date">{{ item.date }}</span>
                <span class="timeline-event">{{ item.event }}</span>
              </div>
            </div>
          </div>

          <!-- 深度洞察 -->
          <div
            v-if="searchContext.askResult.structuredAnswer.insights?.length"
            class="insights-section"
          >
            <h4>💡 深度洞察</h4>
            <ul>
              <li
                v-for="(insight, idx) in searchContext.askResult
                  .structuredAnswer.insights"
                :key="idx"
              >
                {{ insight }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 元数据 -->
        <div v-if="searchContext.askResult.metadata" class="answer-metadata">
          <span
            >共分析
            {{ searchContext.askResult.metadata.totalEntities }} 个实体</span
          >
          <span>•</span>
          <span
            >耗时 {{ searchContext.askResult.metadata.processingTime }}ms</span
          >
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载实体数据...</span>
    </div>

    <div v-else class="entities-grid">
      <!-- Topic类型实体卡片 - 带预览 -->
      <template v-if="entityType === 'Topic'">
        <div
          v-for="entity in filteredEntities"
          :key="entity.id"
          class="content-card topic-card"
          :class="{
            unread: getTopicUnreadTotalCount(entity) > 0,
            muted: isTopicMuted(entity.id),
            'menu-open':
              activeDeferTopicId === entity.id || activeMuteTopicId === entity.id,
          }"
          :data-topic-id="entity.id"
          style="position: relative"
          @click="handleEntityClick(entity)"
        >
          <div class="card-header topic-card-header">
            <div class="card-title">
              <span>💡</span>
              <span>{{ entity.name }}</span>
              <span
                v-if="getTopicUnreadTotalCount(entity) > 0"
                class="unread-badge"
              >
                {{ getTopicUnreadTotalCount(entity) }}条未读
              </span>
            </div>
            <div class="card-badge topic-card-badge">
              {{ entity.statistic?.conversations || 0 }} 讨论
            </div>
          </div>

          <div v-if="entity.description" class="card-content">
            {{ entity.description }}
          </div>

          <div class="card-content" style="font-size: 0.875rem; color: #94a3b8">
            <span
              :class="[
                'topic-priority-pill',
                { backlog: isTopicStaleBacklog(entity) },
              ]"
              :title="getTopicPriorityTooltip(entity)"
            >
              {{ getTopicPriorityLabel(entity) }}
            </span>
            <span
              v-if="getTopicPriorityReasonSummary(entity)"
              class="topic-priority-reasons"
            >
              {{ getTopicPriorityReasonSummary(entity) }}
            </span>
            {{
              entity.importance >= 0.8
                ? '🔥 热度' + Math.round(entity.importance * 5) + '/5'
                : ''
            }}
            {{ entity.statistic?.conversations || 0 }}条讨论 •
            {{ getTopicDisplayTime(entity) }}
          </div>

          <div
            v-if="getTopicParticipantSummary(entity)"
            class="topic-participant-row"
            :title="getTopicParticipantSummary(entity)"
            :aria-label="getTopicParticipantSummary(entity)"
          >
            <span class="topic-participant-label">参与</span>
            <span
              v-for="participant in getTopicParticipantChips(entity)"
              :key="participant"
              class="topic-participant-chip"
            >
              {{ participant }}
            </span>
            <span
              v-if="getTopicParticipantOverflowCount(entity) > 0"
              class="topic-participant-more"
            >
              +{{ getTopicParticipantOverflowCount(entity) }}
            </span>
          </div>

          <div
            v-if="getTopicDeferredState(entity.id)"
            class="topic-deferred-note"
          >
            ⏰ 稍后到
            {{ formatDeferredUntil(getTopicDeferredState(entity.id)?.until) }}
          </div>

          <div v-if="getTopicMutedState(entity.id)" class="topic-muted-note">
            <span>
              🔕 已静音：{{
                formatMutedReason(getTopicMutedState(entity.id)?.reason)
              }}{{ formatMutedUntil(getTopicMutedState(entity.id)?.until) }}
            </span>
            <small class="topic-muted-note-detail">
              未读保留在本机静音视图；未同步、未标记已读，点「取消静音」回到未读流。
            </small>
          </div>

          <!-- 未读讨论预览 -->
          <div
            v-if="getTopicUnreadPreviewCount(entity) > 0"
            class="unread-discussions"
          >
            <div class="unread-discussions-title">
              💬 未读讨论 {{ getTopicUnreadPreviewMeta(entity) }}
            </div>
            <button
              v-for="(discussion, idx) in entity.unreadDiscussions.slice(0, 3)"
              :key="getUnreadDiscussionKey(discussion, idx)"
              type="button"
              class="discussion-item discussion-jump"
              :title="getUnreadDiscussionActionTitle(discussion)"
              @click.stop="handleUnreadDiscussionClick(entity, discussion)"
            >
              <span class="discussion-icon">▪</span>
              <span class="discussion-text">
                {{ getUnreadDiscussionText(discussion) }}
              </span>
            </button>
            <div
              v-if="getTopicUnreadRemainingCount(entity) > 0"
              style="
                text-align: center;
                color: #60a5fa;
                font-size: 0.75rem;
                margin-top: 0.5rem;
              "
            >
              还有 {{ getTopicUnreadRemainingCount(entity) }} 条未显示...
            </div>
          </div>

          <!-- 相关资源预览 -->
          <div
            v-if="
              entity.recentDataDetails?.resources &&
              entity.recentDataDetails.resources.length > 0
            "
            class="topic-preview-section"
          >
            <h4 class="preview-section-title">📚 相关资源</h4>
            <ul class="preview-list">
              <li
                v-for="resource in entity.recentDataDetails.resources.slice(
                  0,
                  2,
                )"
                :key="resource.id"
                class="preview-item resource-item"
                :class="{
                  'resource-openable': getSafeExternalUrl(resource.url),
                }"
                :title="getResourcePreviewTitle(resource)"
                @click.stop="handleResourcePreviewClick(entity, resource)"
              >
                <span>📖</span>
                <span class="preview-content resource-preview-content">
                  <span>{{ resource.name }}</span>
                  <small
                    :class="[
                      'resource-source-note',
                      { muted: !getSafeExternalUrl(resource.url) },
                    ]"
                  >
                    {{ getResourcePreviewSourceNote(resource) }}
                  </small>
                </span>
                <span
                  :class="[
                    'preview-action-hint',
                    { muted: !getSafeExternalUrl(resource.url) },
                  ]"
                >
                  {{ getResourcePreviewActionLabel(resource) }}
                </span>
              </li>
            </ul>
          </div>

          <!-- 关联项目预览 -->
          <div
            v-if="
              entity.recentDataDetails?.projects &&
              entity.recentDataDetails.projects.length > 0
            "
            class="topic-preview-section"
          >
            <h4 class="preview-section-title">🚀 关联项目</h4>
            <ul class="preview-list">
              <li
                v-for="project in entity.recentDataDetails.projects.slice(0, 2)"
                :key="project.id"
                class="preview-item project-item"
                @click.stop="navigateToProject(project.id)"
              >
                <span>🚀</span>
                <span class="preview-content">{{ project.name }}</span>
                <span class="project-status">{{ project.status }}</span>
              </li>
            </ul>
          </div>

          <div
            v-if="
              getTopicUnreadTotalCount(entity) > 0 ||
              isTopicDeferred(entity.id) ||
              isTopicMuted(entity.id)
            "
            class="topic-triage-actions"
          >
            <button
              v-if="isTopicMuted(entity.id)"
              type="button"
              class="topic-action-btn restore mute-restore"
              :title="getTopicMutedRestoreBoundary(entity)"
              :aria-label="getTopicMutedRestoreBoundary(entity)"
              @click.stop="handleRestoreMutedTopic(entity.id)"
            >
              ↩ 取消静音
            </button>
            <button
              v-else-if="isTopicDeferred(entity.id)"
              type="button"
              class="topic-action-btn restore"
              :title="getTopicDeferredRestoreBoundary(entity)"
              :aria-label="getTopicDeferredRestoreBoundary(entity)"
              @click.stop="handleRestoreDeferredTopic(entity.id)"
            >
              ↩ 恢复
            </button>
            <template v-else-if="getTopicUnreadTotalCount(entity) > 0">
              <button
                type="button"
                class="topic-action-btn review"
                :aria-label="`只查看 ${entity.name} 的未读讨论`"
                @click.stop="navigateToTopicUnread(entity.id)"
              >
                未读
              </button>
              <div class="topic-defer-menu" @click.stop>
                <button
                  type="button"
                  class="topic-action-btn later"
                  :title="getTopicDeferMenuButtonBoundary(entity)"
                  :aria-label="getTopicDeferMenuButtonBoundary(entity)"
                  :aria-expanded="activeDeferTopicId === entity.id"
                  @click.stop="toggleTopicDeferMenu(entity.id)"
                >
                  ⏰ 稍后
                </button>
                <div
                  v-if="activeDeferTopicId === entity.id"
                  class="topic-defer-options"
                  role="menu"
                >
                  <div
                    class="topic-defer-boundary-receipt"
                    role="note"
                    aria-label="稍后处理边界"
                  >
                    <strong>稍后处理边界</strong>
                    <span>
                      只写入本机浏览器状态；主题会暂时离开未读队列，但不会标记已读，不会同步
                      Memory Service 或改写原始聊天平台。到期或恢复后才回到未读流。
                    </span>
                  </div>
                  <button
                    v-for="option in topicDeferOptions"
                    :key="option.key"
                    type="button"
                    class="topic-defer-option"
                    role="menuitem"
                    :title="getTopicDeferOptionBoundary(entity, option)"
                    :aria-label="
                      getTopicDeferOptionBoundary(entity, option)
                    "
                    @click.stop="
                      handleDeferTopicForLater(entity.id, option.until)
                    "
                  >
                    <span>{{ option.label }}</span>
                    <small>{{ formatDeferredUntil(option.until) }}</small>
                  </button>
                  <div class="topic-custom-defer" role="none">
                    <label :for="`topic-custom-defer-${entity.id}`">
                      自定义时间
                    </label>
                    <div class="topic-custom-defer-row">
                      <input
                        :id="`topic-custom-defer-${entity.id}`"
                        v-model="customDeferValue"
                        type="datetime-local"
                        :min="customDeferMin"
                        :title="getTopicCustomDeferInputBoundary(entity)"
                        :aria-label="getTopicCustomDeferInputBoundary(entity)"
                        @click.stop
                        @keydown.enter.prevent="handleCustomDefer(entity.id)"
                      />
                      <button
                        type="button"
                        :disabled="!customDeferTimestamp"
                        :title="getTopicCustomDeferConfirmBoundary(entity)"
                        :aria-label="getTopicCustomDeferConfirmBoundary(entity)"
                        @click.stop="handleCustomDefer(entity.id)"
                      >
                        确定
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="topic-defer-menu topic-mute-menu" @click.stop>
                <button
                  type="button"
                  class="topic-action-btn mute"
                  :title="getTopicMuteMenuButtonBoundary(entity)"
                  :aria-label="getTopicMuteMenuButtonBoundary(entity)"
                  :aria-expanded="activeMuteTopicId === entity.id"
                  @click.stop="toggleTopicMuteMenu(entity.id)"
                >
                  🔕 静音
                </button>
                <div
                  v-if="activeMuteTopicId === entity.id"
                  class="topic-defer-options topic-mute-options"
                  role="menu"
                >
                  <div
                    class="topic-mute-boundary-receipt"
                    role="note"
                    aria-label="静音边界"
                  >
                    <strong>静音边界</strong>
                    <span>
                      只调整本机未读流和降噪过滤；未读仍保留，不写回 Memory
                      Service，也不会改写原始聊天平台。可在静音视图或本提示取消静音。
                    </span>
                  </div>
                  <div class="topic-mute-reasons" role="none">
                    <div class="topic-menu-label">静音原因</div>
                    <div
                      class="topic-mute-reason-grid"
                      role="group"
                      :aria-label="`${entity.name} 静音原因`"
                    >
                      <button
                        v-for="reason in topicMuteReasons"
                        :key="reason.key"
                        type="button"
                        :class="[
                          'topic-mute-reason-option',
                          { active: selectedMuteReason === reason.key },
                        ]"
                        :title="getTopicMuteReasonBoundary(entity, reason)"
                        :aria-label="getTopicMuteReasonBoundary(entity, reason)"
                        :aria-pressed="selectedMuteReason === reason.key"
                        @click.stop="selectedMuteReason = reason.key"
                      >
                        <span>{{ reason.label }}</span>
                        <small>{{ reason.description }}</small>
                      </button>
                    </div>
                  </div>
                  <button
                    v-for="option in topicMuteOptions"
                    :key="option.key"
                    type="button"
                    class="topic-defer-option topic-mute-option"
                    role="menuitem"
                    :title="getTopicMuteOptionBoundary(entity, option)"
                    :aria-label="getTopicMuteOptionBoundary(entity, option)"
                    @click.stop="
                      handleMuteTopic(
                        entity.id,
                        option.until,
                        selectedMuteReason,
                      )
                    "
                  >
                    <span>{{ option.label }}</span>
                    <small>{{ formatMutedUntil(option.until) }}</small>
                  </button>
                </div>
              </div>
              <button
                type="button"
                class="topic-action-btn read"
                :aria-label="`标记 ${entity.name} 为已读`"
                @click.stop="handleMarkTopicAsRead(entity.id)"
              >
                ✓ 已阅
              </button>
            </template>
          </div>

          <div class="entity-footer">
            <span class="last-accessed">
              最后更新: {{ getTopicDisplayTime(entity) }}
            </span>
          </div>
        </div>
      </template>

      <!-- Person类型实体卡片 - 带人物预览 -->
      <template v-else-if="entityType === 'Person'">
        <div
          v-for="entity in filteredEntities"
          :key="entity.id"
          class="entity-card person-card"
          @click="handlePersonClick(entity)"
        >
          <div class="entity-card-header person-card-header">
            <div class="entity-card-title">
              <span>👤</span>
              <span>{{ entity.name }}</span>
            </div>
            <div class="person-card-badge">
              {{ entity.role || '团队成员' }}
            </div>
          </div>

          <div v-if="entity.description" class="entity-description">
            {{ entity.description }}
          </div>

          <!-- 最近协作预览 -->
          <div
            v-if="
              entity.recentCollaborations &&
              entity.recentCollaborations.length > 0
            "
            class="person-preview-section"
          >
            <h4 class="preview-section-title">🤝 最近协作</h4>
            <ul class="preview-list">
              <li
                v-for="collaboration in entity.recentCollaborations.slice(0, 2)"
                :key="collaboration.id"
                class="preview-item collaboration-item"
                @click.stop="navigateToProject(collaboration.projectId)"
              >
                <span>🚀</span>
                <span class="preview-content">{{
                  collaboration.projectName
                }}</span>
                <span class="preview-time">{{ collaboration.time }}</span>
              </li>
            </ul>
          </div>

          <!-- 专业技能预览 -->
          <div
            v-if="entity.expertise && entity.expertise.length > 0"
            class="person-preview-section"
          >
            <h4 class="preview-section-title">🎯 专业技能</h4>
            <div class="expertise-tags">
              <span
                v-for="skill in entity.expertise.slice(0, 4)"
                :key="skill"
                class="expertise-tag"
              >
                {{ skill }}
              </span>
            </div>
          </div>

          <!-- 最近消息预览 -->
          <div
            v-if="entity.recentMessages && entity.recentMessages.length > 0"
            class="person-preview-section"
          >
            <h4 class="preview-section-title">💬 最近消息</h4>
            <ul class="preview-list">
              <li
                v-for="message in entity.recentMessages.slice(0, 2)"
                :key="message.id"
                class="preview-item message-item"
                @click.stop="navigateToPersonMessage(entity.id, message.id)"
              >
                <span>💭</span>
                <span class="preview-content">{{ message.summary }}</span>
                <span class="preview-time">{{ message.time }}</span>
              </li>
            </ul>
          </div>

          <div class="entity-footer">
            <span class="last-accessed">
              最后联系: {{ formatTime(entity.lastContact || Date.now()) }}
            </span>
            <span v-if="entity.team" class="team-indicator">
              {{ entity.team }}
            </span>
          </div>
        </div>
      </template>

      <!-- Project类型实体卡片 - 带项目操作 -->
      <template v-else-if="entityType === 'Project'">
        <div
          v-for="entity in filteredEntities"
          :key="entity.id"
          class="entity-card project-card"
          @click="handleEntityClick(entity)"
        >
          <div class="entity-card-header">
            <div class="entity-card-title">
              <span>🚀</span>
              <span>{{ entity.name }}</span>
            </div>
            <div
              v-if="entity.importance !== undefined"
              class="importance-indicator"
            >
              <div
                class="importance-bar"
                :style="{ width: entity.importance * 100 + '%' }"
              ></div>
            </div>
          </div>

          <div v-if="entity.description" class="entity-description">
            {{ entity.description }}
          </div>

          <div class="entity-stats">
            <div class="stat-item">
              <span>🔗</span>
              <span>{{ entity.relationshipsCount || 0 }} 关系</span>
            </div>
            <div class="stat-item">
              <span>💬</span>
              <span>{{ entity.relatedMessagesCount || 0 }} 消息</span>
            </div>
            <div class="stat-item">
              <span>🌐</span>
              <span>{{ entity.relatedWebpagesCount || 0 }} 网页</span>
            </div>
            <div class="stat-item">
              <span>👁️</span>
              <span>{{ entity.accessCount || 0 }} 访问</span>
            </div>
          </div>

          <!-- 项目特有操作按钮 -->
          <div class="project-actions">
            <button
              class="project-action-btn highlight"
              @click.stop="handleMarkAsHighlightProject(entity)"
              :class="{ active: entity.isHighlighted }"
              title="标记为重点项目"
            >
              ⭐ {{ entity.isHighlighted ? '已标记' : '重点项目' }}
            </button>
            <button
              class="project-action-btn dashboard"
              @click.stop="openProjectDashboard(entity)"
              title="打开项目仪表盘"
            >
              📊 仪表盘
            </button>
          </div>

          <div v-if="entity.tags && entity.tags.length > 0" class="entity-tags">
            <span
              v-for="(tag, index) in entity.tags.slice(0, 3)"
              :key="index"
              class="entity-tag"
            >
              {{ tag }}
            </span>
            <span v-if="entity.tags.length > 3" class="entity-tag more-tags">
              +{{ entity.tags.length - 3 }}
            </span>
          </div>

          <div class="entity-footer">
            <span class="last-accessed">
              最后访问: {{ formatTime(entity.lastAccessed || Date.now()) }}
            </span>
            <span
              v-if="entity.status"
              :class="'status-indicator ' + entity.status"
            >
              {{ entity.status }}
            </span>
          </div>
        </div>
      </template>

      <!-- 其他类型实体卡片 - 原始布局 -->
      <template v-else>
        <div
          v-for="entity in filteredEntities"
          :key="entity.id"
          class="entity-card"
          @click="handleEntityClick(entity)"
        >
          <div class="entity-card-header">
            <div class="entity-card-title">
              <span>{{ getEntityIcon(entity.type) }}</span>
              <span>{{ entity.name }}</span>
            </div>
            <div
              v-if="entity.importance !== undefined"
              class="importance-indicator"
            >
              <div
                class="importance-bar"
                :style="{ width: entity.importance * 100 + '%' }"
              ></div>
            </div>
          </div>

          <div v-if="entity.description" class="entity-description">
            {{ entity.description }}
          </div>

          <div class="entity-stats">
            <div class="stat-item">
              <span>🔗</span>
              <span>{{ entity.relationshipsCount || 0 }} 关系</span>
            </div>
            <div class="stat-item">
              <span>💬</span>
              <span>{{ entity.relatedMessagesCount || 0 }} 消息</span>
            </div>
            <div class="stat-item">
              <span>🌐</span>
              <span>{{ entity.relatedWebpagesCount || 0 }} 网页</span>
            </div>
            <div class="stat-item">
              <span>👁️</span>
              <span>{{ entity.accessCount || 0 }} 访问</span>
            </div>
          </div>

          <div v-if="entity.tags && entity.tags.length > 0" class="entity-tags">
            <span
              v-for="(tag, index) in entity.tags.slice(0, 3)"
              :key="index"
              class="entity-tag"
            >
              {{ tag }}
            </span>
            <span v-if="entity.tags.length > 3" class="entity-tag more-tags">
              +{{ entity.tags.length - 3 }}
            </span>
          </div>

          <div class="entity-footer">
            <span class="last-accessed">
              最后访问: {{ formatTime(entity.lastAccessed || Date.now()) }}
            </span>
            <span
              v-if="entity.status"
              :class="'status-indicator ' + entity.status"
            >
              {{ entity.status }}
            </span>
          </div>
        </div>
      </template>

      <div
        v-if="filteredEntities.length === 0 && !isLoading"
        class="empty-state"
      >
        <span>{{ getEntityIcon(entityType) }}</span>
        <div
          v-if="entityType === 'Topic' && topicLoadFailureReceipt"
          class="topic-empty-recovery topic-load-failure-empty"
        >
          <p>
            主题列表加载失败，未确认未读状态。
          </p>
          <p>
            {{ topicLoadFailureReceipt.message }} 未展示示例主题，也不会把空列表当成已读完成。
          </p>
          <div class="topic-empty-recovery-actions">
            <button
              class="view-toggle-btn"
              type="button"
              @click="handleRetryEntityLoad"
            >
              重新加载主题
            </button>
          </div>
        </div>
        <p v-else-if="entities.length === 0">
          暂无{{ getEntityTypeName(entityType) }}数据
        </p>
        <p v-else-if="entityType === 'Topic' && searchQuery.trim()">
          当前{{ getTopicViewModeLabel() }}没有匹配项；本页只过滤已加载的
          {{ entities.length }} 个主题，稍后/静音主题仍按当前视图隐藏。
          <br /><br />
          <button
            v-if="topicViewMode !== 'all'"
            class="view-toggle-btn"
            @click="topicViewMode = 'all'"
            style="margin-top: 1rem"
          >
            在全部主题里查找
          </button>
        </p>
        <div
          v-else-if="
            entityType === 'Topic' &&
            topicViewMode === 'unread' &&
            topicHiddenUnreadCount > 0
          "
          class="topic-empty-recovery"
        >
          <p>
            当前没有可处理的未读主题；还有
            {{ topicHiddenUnreadCount }} 个未读主题被本机稍后/静音状态隐藏。
          </p>
          <p>
            稍后/静音不等于已读，不会同步到后端，也不会改写原始聊天平台。
          </p>
          <div class="topic-empty-recovery-actions">
            <button
              v-if="topicDeferredUnreadCount > 0"
              class="view-toggle-btn"
              :title="getTopicHiddenDeferredViewBoundary()"
              :aria-label="getTopicHiddenDeferredViewBoundary()"
              @click="topicViewMode = 'later'"
            >
              查看稍后 {{ topicDeferredUnreadCount }}
            </button>
            <button
              v-if="topicMutedUnreadCount > 0"
              class="view-toggle-btn"
              :title="getTopicHiddenMutedViewBoundary()"
              :aria-label="getTopicHiddenMutedViewBoundary()"
              @click="topicViewMode = 'muted'"
            >
              查看静音 {{ topicMutedUnreadCount }}
            </button>
            <button class="view-toggle-btn" @click="topicViewMode = 'all'">
              查看所有主题
            </button>
          </div>
        </div>
        <p v-else-if="entityType === 'Topic' && topicViewMode === 'unread'">
          ✅ 太棒了！所有主题都已阅读完毕
          <br /><br />
          <button
            class="view-toggle-btn"
            @click="topicViewMode = 'all'"
            style="margin-top: 1rem"
          >
            查看所有主题
          </button>
        </p>
        <p v-else-if="entityType === 'Topic' && topicViewMode === 'later'">
          暂无稍后处理的主题
        </p>
        <p v-else-if="entityType === 'Topic' && topicViewMode === 'muted'">
          暂无静音主题
        </p>
        <p v-else>没有找到匹配的{{ getEntityTypeName(entityType) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch, ref, toRaw } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useMemoryStore,
  ENTITY_TYPE_CONFIG,
  chromeAPI,
  getTopicDeferPresetOptions,
  getTopicMutePresetOptions,
  getTopicMuteReasonLabel,
  getTopicMuteReasonOptions,
  type TopicDeferPresetOption,
  type TopicMutePresetOption,
  type TopicMuteReasonKey,
} from '../memory-store';
import {
  getExternalUrlBlockedReasonLabel,
  getExternalUrlSafety,
  getSafeExternalUrl,
} from '../topic-link-safety';
import {
  getTopicParticipantLabels,
  getTopicParticipantTotalCount,
  topicMatchesListQuery,
} from '../topic-list-search';
import { getTopicTriagePriority, sortTopicsForTriage } from '../topic-triage';
import {
  getTopicUnreadPreviewCount,
  getTopicUnreadPreviewMeta,
  getTopicUnreadRemainingCount,
  getTopicUnreadTotalCount,
  getUnreadDiscussionKey,
  getUnreadDiscussionMessageId,
  getUnreadDiscussionText,
} from '../topic-unread-preview';
import { formatTopicRelativeTime } from '../topic-time';
import { markdownToHtml } from '../utils/markdown';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const entityType = computed(() => route.params.type as string);
const entities = computed(() => store.entities);
const isLoading = computed(() => store.isLoading);
const searchQuery = computed(() => store.searchQuery);
const searchContext = computed(() => store.searchContext);

// 本地过滤状态
const selectedFilter = ref('all');
const topicViewMode = ref('unread'); // 'unread' | 'all' | 'later' | 'muted'
const topicSortMode = ref('triage'); // 'triage' | 'time' | 'importance' | 'unread-count'
const topicLaterCount = computed(() => store.getDeferredTopics().length);
const topicMutedCount = computed(() => store.getMutedTopics().length);
const topicUnreadTopics = computed(() => {
  if (entityType.value !== 'Topic') return [];
  return entities.value.filter((entity: any) => getTopicUnreadTotalCount(entity) > 0);
});
const topicDeferredUnreadCount = computed(
  () =>
    topicUnreadTopics.value.filter((entity: any) =>
      store.isTopicDeferred(entity.id),
    ).length,
);
const topicMutedUnreadCount = computed(
  () =>
    topicUnreadTopics.value.filter((entity: any) =>
      store.isTopicMuted(entity.id),
    ).length,
);
const topicActiveUnreadCount = computed(
  () =>
    topicUnreadTopics.value.filter(
      (entity: any) =>
        !store.isTopicDeferred(entity.id) && !store.isTopicMuted(entity.id),
    ).length,
);
const topicHiddenUnreadCount = computed(
  () => topicDeferredUnreadCount.value + topicMutedUnreadCount.value,
);
const topicReadUndo = computed(() => store.topicReadUndo);
const topicLoadFailureReceipt = computed(() =>
  entityType.value === 'Topic' ? store.entityLoadFailureReceipt : null,
);
const topicLoadFailureReceiptLabel = computed(() =>
  topicLoadFailureReceipt.value?.previousDataRetained
    ? '刷新失败 · 上次快照'
    : '加载失败 · 未确认',
);
const topicLoadFailureReceiptDetail = computed(() => {
  const receipt = topicLoadFailureReceipt.value;
  if (!receipt) return '';
  if (receipt.previousDataRetained) {
    return `当前显示 ${receipt.retainedCount} 个上次成功加载的主题；最新 Memory Service 状态未确认。${receipt.message}`;
  }
  return `${receipt.message} 当前未展示示例主题，未读状态未确认。`;
});
const topicDeferredUndo = ref<{
  topicId: string;
  topicName: string;
  until: number;
} | null>(null);
const activeDeferTopicId = ref<string | null>(null);
const activeMuteTopicId = ref<string | null>(null);
const topicDeferOptions = ref(getTopicDeferPresetOptions());
const topicMuteOptions = ref(getTopicMutePresetOptions());
const topicMuteReasons = ref(getTopicMuteReasonOptions());
const selectedMuteReason = ref<TopicMuteReasonKey>('not-now');
const topicMuteUndo = ref<{
  topicId: string;
  topicName: string;
  until: number | null;
  reason?: TopicMuteReasonKey;
} | null>(null);
const topicMuteRestoreReceipt = ref<{
  title: string;
  summary: string;
  details: string[];
} | null>(null);
const topicDeferRestoreReceipt = ref<{
  title: string;
  summary: string;
  details: string[];
} | null>(null);
let topicMuteUndoTimer: ReturnType<typeof window.setTimeout> | null = null;
let topicMuteRestoreReceiptTimer:
  | ReturnType<typeof window.setTimeout>
  | null = null;
let topicDeferRestoreReceiptTimer:
  | ReturnType<typeof window.setTimeout>
  | null = null;
let topicDeferredUndoTimer: ReturnType<typeof window.setTimeout> | null = null;
let topicDeferredReleaseTimer: ReturnType<typeof window.setTimeout> | null =
  null;
const sourceOpenReceipt = ref<{
  title: string;
  host: string;
  summary: string;
  details: string[];
} | null>(null);
let sourceOpenReceiptTimer: ReturnType<typeof window.setTimeout> | null = null;
const formatDateTimeLocal = (timestamp = Date.now() + 60 * 60 * 1000) => {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const customDeferValue = ref(formatDateTimeLocal());
const customDeferMin = computed(() => formatDateTimeLocal(Date.now() + 60_000));
const customDeferTimestamp = computed(() => {
  const timestamp = new Date(customDeferValue.value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now()
    ? timestamp
    : null;
});
const deferredReleaseScheduleKey = computed(() =>
  Object.entries(store.deferredTopics || {})
    .map(([topicId, state]) => `${topicId}:${Number(state?.until || 0)}`)
    .sort()
    .join('|'),
);

// AI 分析状态
const isAnalyzing = ref(false);
const isAnalysisPanelExpanded = ref(true);

const renderedAnswer = computed(() => {
  const ans = searchContext.value.askResult?.answer;
  return ans ? markdownToHtml(ans) : '';
});

const getTopicViewModeLabel = () => {
  switch (topicViewMode.value) {
    case 'all':
      return '全部主题视图';
    case 'later':
      return '稍后视图';
    case 'muted':
      return '静音视图';
    case 'unread':
    default:
      return '仅未读视图';
  }
};

const getTopicBoundaryName = (topic: any): string =>
  String(topic?.topicName || topic?.name || topic?.id || '当前主题');

const getTopicDeferMenuButtonBoundary = (topic: any): string => {
  const topicName = getTopicBoundaryName(topic);
  return `稍后处理边界：点击只打开或收起「${topicName}」的本机稍后时间菜单；选择时间前不会写入本机稍后状态、标记已读、同步 Memory Service 或改写原始聊天平台。`;
};

const getTopicDeferOptionBoundary = (
  topic: any,
  optionOrUntil?: TopicDeferPresetOption | number,
): string => {
  const topicName = getTopicBoundaryName(topic);
  const option =
    typeof optionOrUntil === 'object' && optionOrUntil !== null
      ? optionOrUntil
      : null;
  const until = option ? option.until : optionOrUntil;
  const optionLabel = option?.label ? `${option.label}：` : '';
  const deferTime = formatDeferredUntil(until) || '所选时间';
  return `${optionLabel}稍后处理到 ${deferTime}：只把「${topicName}」写入本机浏览器稍后状态并暂时移出未读队列；不会标记已读、同步 Memory Service、发送、删除或改写原始聊天平台。到期或恢复后回到未读流。`;
};

const getTopicCustomDeferInputBoundary = (topic: any): string => {
  const topicName = getTopicBoundaryName(topic);
  return `为「${topicName}」选择自定义稍后时间；这里只编辑本机表单，点击确定前不会写入稍后状态、标记已读、同步 Memory Service 或改写原始聊天平台。`;
};

const getTopicCustomDeferConfirmBoundary = (topic: any): string => {
  const topicName = getTopicBoundaryName(topic);
  if (!customDeferTimestamp.value) {
    return `自定义稍后时间无效：不会写入「${topicName}」的本机稍后状态、标记已读、同步 Memory Service 或改写原始聊天平台。`;
  }
  return getTopicDeferOptionBoundary(topic, customDeferTimestamp.value);
};

const getTopicDeferredRestoreBoundary = (topic: any): string => {
  const topicName = getTopicBoundaryName(topic);
  return `恢复未读回执：点击只删除「${topicName}」的本机稍后处理状态；未读信号保留，不会标记已读、同步 Memory Service、发送、删除或改写原始聊天平台。`;
};

const getTopicDeferToastViewBoundary = (topic: any): string => {
  const topicName = getTopicBoundaryName(topic);
  return `查看稍后：只切换到本页稍后视图核对「${topicName}」；不会恢复未读、标记已读、同步 Memory Service 或改写原始聊天平台。`;
};

const getTopicHiddenDeferredViewBoundary = (): string =>
  `查看稍后 ${topicDeferredUnreadCount.value}：只切换到本页稍后视图核对被本机隐藏的未读主题；不会恢复未读、标记已读、同步 Memory Service 或改写原始聊天平台。`;

const getTopicMuteMenuButtonBoundary = (topic: any): string => {
  const topicName = getTopicBoundaryName(topic);
  return `静音边界：点击只打开或收起「${topicName}」的本机静音菜单；选择原因和时长前不会写入本机静音状态、标记已读、同步 Memory Service 或改写原始聊天平台。`;
};

const getTopicMuteReasonBoundary = (
  topic: any,
  reason: { key: TopicMuteReasonKey; label: string; description: string },
): string => {
  const topicName = getTopicBoundaryName(topic);
  return `静音原因「${reason.label}」：这里只选择「${topicName}」的本机降噪原因；点击静音时长前不会写入静音状态、标记已读、同步 Memory Service 或改写原始聊天平台。${reason.description}`;
};

const getTopicMuteOptionBoundary = (
  topic: any,
  option: TopicMutePresetOption,
): string => {
  const topicName = getTopicBoundaryName(topic);
  const muteUntil = formatMutedUntil(option.until) || '所选时间';
  const reasonLabel = getTopicMuteReasonLabel(selectedMuteReason.value);
  return `${option.label}：把「${topicName}」写入本机浏览器静音状态${muteUntil}，原因「${reasonLabel}」；未读仍保留，只从本机未读流隐藏，不会标记已读、同步 Memory Service、发送、删除或改写原始聊天平台。可在静音视图或本提示取消静音。`;
};

const getTopicMutedRestoreBoundary = (topic: any): string => {
  const topicName = getTopicBoundaryName(topic);
  return `取消静音回执：点击只删除「${topicName}」的本机静音过滤；未读信号保留，不会标记已读、同步 Memory Service、发送、删除或改写原始聊天平台。`;
};

const getTopicMuteToastViewBoundary = (topic: any): string => {
  const topicName = getTopicBoundaryName(topic);
  return `查看静音：只切换到本页静音视图核对「${topicName}」；不会取消静音、标记已读、同步 Memory Service 或改写原始聊天平台。`;
};

const getTopicHiddenMutedViewBoundary = (): string =>
  `查看静音 ${topicMutedUnreadCount.value}：只切换到本页静音视图核对被本机隐藏的未读主题；不会取消静音、标记已读、同步 Memory Service 或改写原始聊天平台。`;

const getTopicHiddenUnreadText = () => {
  const hiddenPieces: string[] = [];
  if (topicDeferredUnreadCount.value > 0) {
    hiddenPieces.push(`稍后隐藏 ${topicDeferredUnreadCount.value}`);
  }
  if (topicMutedUnreadCount.value > 0) {
    hiddenPieces.push(`静音隐藏 ${topicMutedUnreadCount.value}`);
  }

  return hiddenPieces.length > 0
    ? `另有${hiddenPieces.join('、')}个未读主题。`
    : '没有未读主题被稍后/静音隐藏。';
};

const topicUnreadQueueReceipt = computed(() => {
  if (entityType.value !== 'Topic') return null;
  if (isLoading.value || entities.value.length === 0) return null;

  const stateBoundary =
    '稍后/静音只改变本机未读流，不标记已读，不同步后端或原始聊天平台。';

  switch (topicViewMode.value) {
    case 'later':
      return {
        label: '未读队列口径',
        detail: `稍后视图显示 ${topicLaterCount.value} 个本机稍后主题，其中 ${topicDeferredUnreadCount.value} 个仍有未读；到期或恢复后才回到未读流。${stateBoundary}`,
      };
    case 'muted':
      return {
        label: '未读队列口径',
        detail: `静音视图显示 ${topicMutedCount.value} 个本机静音主题，其中 ${topicMutedUnreadCount.value} 个仍有未读；恢复后才回到未读流。${stateBoundary}`,
      };
    case 'all':
      return {
        label: '未读队列口径',
        detail: `全部主题显示已加载的 ${entities.value.length} 个主题，其中 ${topicUnreadTopics.value.length} 个仍有未读；${getTopicHiddenUnreadText()}${stateBoundary}`,
      };
    case 'unread':
    default:
      return {
        label: '未读队列口径',
        detail: `仅未读显示 ${topicActiveUnreadCount.value} 个可处理未读主题；${getTopicHiddenUnreadText()}${stateBoundary}`,
      };
  }
});

const topicSearchScopeReceipt = computed(() => {
  if (entityType.value !== 'Topic') return null;
  if (!searchQuery.value.trim()) return null;

  const hiddenPieces: string[] = [];
  if (topicViewMode.value === 'unread') {
    if (topicLaterCount.value > 0) hiddenPieces.push(`稍后 ${topicLaterCount.value}`);
    if (topicMutedCount.value > 0) hiddenPieces.push(`静音 ${topicMutedCount.value}`);
  }

  const hiddenText =
    hiddenPieces.length > 0
      ? `；当前视图会继续隐藏${hiddenPieces.join('、')}个主题`
      : '';

  return {
    label: '本页过滤',
    detail: `只查当前已加载的 ${entities.value.length} 个主题和「${getTopicViewModeLabel()}」${hiddenText}；跨全部记忆请点击搜索按钮走后端搜索。`,
  };
});

const handleAskAnalyze = async () => {
  if (!searchQuery.value.trim()) {
    alert('请先进行搜索');
    return;
  }

  isAnalyzing.value = true;
  try {
    await store.performAskSearch(searchQuery.value);
    // 分析完成后自动展开面板
    isAnalysisPanelExpanded.value = true;
  } catch (error) {
    console.error('AI 分析失败:', error);
    alert('AI 分析失败，请稍后重试');
  } finally {
    isAnalyzing.value = false;
  }
};

const toggleAnalysisPanel = () => {
  isAnalysisPanelExpanded.value = !isAnalysisPanelExpanded.value;
};

// 过滤后的实体列表
const filteredEntities = computed(() => {
  let filtered = [...entities.value];

  // 主题未读过滤
  if (entityType.value === 'Topic') {
    if (topicViewMode.value === 'unread') {
      filtered = filtered.filter((entity) => {
        if (isTopicDeferred(entity.id)) return false;
        if (isTopicMuted(entity.id)) return false;
        return getTopicUnreadTotalCount(entity) > 0;
      });
    } else if (topicViewMode.value === 'later') {
      filtered = filtered.filter((entity) => isTopicDeferred(entity.id));
    } else if (topicViewMode.value === 'muted') {
      filtered = filtered.filter((entity) => isTopicMuted(entity.id));
    }
  }

  // 文本搜索过滤（使用顶部搜索框的搜索词）
  if (searchQuery.value.trim()) {
    const query = searchQuery.value;
    filtered = filtered.filter((entity) => {
      if (entityType.value === 'Topic') {
        return topicMatchesListQuery(entity, query);
      }

      const normalizedQuery = query.toLowerCase();
      return (
        entity.name.toLowerCase().includes(normalizedQuery) ||
        (entity.description &&
          entity.description.toLowerCase().includes(normalizedQuery)) ||
        (entity.tags &&
          entity.tags.some((tag) =>
            tag.toLowerCase().includes(normalizedQuery),
          ))
      );
    });
  }

  // 主题排序
  if (entityType.value === 'Topic') {
    switch (topicSortMode.value) {
      case 'triage':
        filtered = sortTopicsForTriage(filtered);
        break;
      case 'time':
        // 按最新消息时间排序
        filtered.sort((a, b) => {
          const timeA = getTopicTriagePriority(a).lastActivityTime || 0;
          const timeB = getTopicTriagePriority(b).lastActivityTime || 0;
          return timeB - timeA;
        });
        break;
      case 'importance':
        // 按热度排序
        filtered.sort((a, b) => {
          const scoreA =
            (a.importance || 0.5) + (a.statistic?.conversations || 0) / 20;
          const scoreB =
            (b.importance || 0.5) + (b.statistic?.conversations || 0) / 20;
          return scoreB - scoreA;
        });
        break;
      case 'unread-count':
        // 按未读数量排序
        filtered.sort((a, b) => {
          const countB = getTopicUnreadTotalCount(b);
          const countA = getTopicUnreadTotalCount(a);
          return countB - countA;
        });
        break;
    }
    return filtered;
  }

  // 其他类型的分类过滤
  if (selectedFilter.value !== 'all') {
    switch (selectedFilter.value) {
      case 'recent_contact':
        // Person: 最近联系
        filtered = filtered.filter(
          (entity) =>
            entity.lastContact && Date.now() - entity.lastContact < 604800000, // 7天内
        );
        break;

      case 'frequent_collaboration':
        // Person: 频繁协作
        filtered = filtered.filter(
          (entity) =>
            entity.recentCollaborations &&
            entity.recentCollaborations.length >= 2,
        );
        break;

      case 'highlighted':
        // Project: 重点项目
        filtered = filtered.filter((entity) => entity.isHighlighted);
        break;

      case 'active':
        // Project: 活跃项目
        filtered = filtered.filter(
          (entity) =>
            entity.status === 'active' &&
            entity.lastAccessed &&
            Date.now() - entity.lastAccessed < 604800000, // 7天内
        );
        break;
    }
  }

  return filtered;
});

const getEntityIcon = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.icon || '📂';
};

const getEntityTypeName = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.name || type;
};

const handleEntityClick = (entity: any) => {
  if (entity.type === 'Topic') {
    router.push(`/topic/${entity.id}`);
  } else if (entity.type === 'Person') {
    router.push(`/person/${entity.id}`);
  } else {
    console.log('点击实体:', entity);
  }
};

const handlePersonClick = (entity: any) => {
  router.push(`/person/${entity.id}`);
};

const navigateToPersonMessage = (personId: string, messageId: string) => {
  router.push(`/person/${personId}?messageId=${messageId}`);
};

const navigateToTopicDiscussion = (topicId: string, messageId: string) => {
  router.push({
    path: `/topic/${topicId}`,
    query: { messageId },
  });
};

const navigateToTopicUnread = (topicId: string) => {
  router.push({
    path: `/topic/${topicId}`,
    query: { readFilter: 'unread' },
  });
};

const getUnreadDiscussionActionTitle = (discussion: any) => {
  return getUnreadDiscussionMessageId(discussion)
    ? '打开并定位这条未读讨论'
    : '打开主题详情';
};

const handleUnreadDiscussionClick = (topic: any, discussion: any) => {
  const messageId = getUnreadDiscussionMessageId(discussion);
  if (messageId) {
    navigateToTopicDiscussion(topic.id, messageId);
    return;
  }

  handleEntityClick(topic);
};

const getResourcePreviewHost = (resource: any): string => {
  const safety = getExternalUrlSafety(resource?.url);
  return safety.safeUrl
    ? safety.hostname || getSourceOpenHost(safety.safeUrl)
    : '';
};

const getResourcePreviewSourceNote = (resource: any): string => {
  const safety = getExternalUrlSafety(resource?.url);
  if (safety.safeUrl) {
    const host = safety.hostname || getSourceOpenHost(safety.safeUrl);
    return `来源 ${host} · 仅打开标签页`;
  }
  if (safety.blocked) {
    return `来源已隐藏 · ${getExternalUrlBlockedReasonLabel(safety.reason)}`;
  }
  return '无可信外链 · 打开详情';
};

const getResourcePreviewActionLabel = (resource: any): string =>
  getSafeExternalUrl(resource?.url) ? '打开' : '详情';

const getResourcePreviewTitle = (resource: any) => {
  const safety = getExternalUrlSafety(resource?.url);
  if (safety.safeUrl) {
    const host = getResourcePreviewHost(resource);
    return `打开资源来源：${host}；只请求外部标签页，不重新读取、不同步、不标记已读或写回原始平台。`;
  }
  if (safety.blocked) {
    return `资源来源已隐藏：${getExternalUrlBlockedReasonLabel(
      safety.reason,
    )}；点击查看主题详情中的资源上下文。`;
  }
  return '无可信外链；查看主题详情中的资源上下文';
};

const handleResourcePreviewClick = (topic: any, resource: any) => {
  const safeUrl = getSafeExternalUrl(resource?.url);
  if (safeUrl) {
    showSourceOpenReceipt(safeUrl, '资源来源');
    window.open(safeUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  handleEntityClick(topic);
};

const getSourceOpenHost = (safeUrl: string) => {
  try {
    return new URL(safeUrl).hostname || '安全 http/https 来源';
  } catch (error) {
    return '安全 http/https 来源';
  }
};

const clearSourceOpenReceiptTimer = () => {
  if (sourceOpenReceiptTimer !== null) {
    window.clearTimeout(sourceOpenReceiptTimer);
    sourceOpenReceiptTimer = null;
  }
};

const showSourceOpenReceipt = (safeUrl: string, sourceKind: string) => {
  clearSourceOpenReceiptTimer();
  const host = getSourceOpenHost(safeUrl);
  sourceOpenReceipt.value = {
    title: '来源打开回执',
    host,
    summary: `已请求浏览器打开${sourceKind}：${host}。`,
    details: [
      '只打开外部标签页，不会重新读取原始消息、网页或资源。',
      '不会同步 Memory Service、标记已读、确认结论或写回原始平台。',
    ],
  };
  sourceOpenReceiptTimer = window.setTimeout(() => {
    sourceOpenReceipt.value = null;
    sourceOpenReceiptTimer = null;
  }, 9000);
};

const getTopicPriorityLabel = (topic: any) => {
  return getTopicTriagePriority(topic).label;
};

const getTopicPriorityTooltip = (topic: any) => {
  const priority = getTopicTriagePriority(topic);
  return priority.reasons.join('、');
};

const getTopicPriorityReasonSummary = (topic: any) => {
  const priority = getTopicTriagePriority(topic);
  const summary = priority.reasons
    .filter((reason) => reason !== '按未读、热度和时间综合排序')
    .slice(0, 2)
    .join(' · ');
  return summary;
};

const getTopicParticipantChips = (topic: any) => {
  return getTopicParticipantLabels(topic, 3);
};

const getTopicParticipantOverflowCount = (topic: any) => {
  return Math.max(0, getTopicParticipantTotalCount(topic) - 3);
};

const getTopicParticipantSummary = (topic: any) => {
  const labels = getTopicParticipantLabels(topic, Number.POSITIVE_INFINITY);
  if (labels.length === 0) return '';
  return `参与者/来源人：${labels.join('、')}`;
};

const isTopicStaleBacklog = (topic: any) => {
  return getTopicTriagePriority(topic).isStaleBacklog;
};

const getTopicDisplayTime = (topic: any) => {
  const priority = getTopicTriagePriority(topic);
  return formatTopicRelativeTime(priority.lastActivityTime) || '未知时间';
};

const navigateToProject = (projectId: string) => {
  router.push(`/project/${projectId}`);
};

const isTopicDeferred = (topicId: string) => {
  return store.isTopicDeferred(topicId);
};

const getTopicDeferredState = (topicId: string) => {
  return store.getTopicDeferredState(topicId);
};

const isTopicMuted = (topicId: string) => {
  return store.isTopicMuted(topicId);
};

const getTopicMutedState = (topicId: string) => {
  return store.getTopicMutedState(topicId);
};

const formatDeferredUntil = (timestamp?: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (date.toDateString() === now.toDateString()) {
    return `今天 ${time}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `明天 ${time}`;
  }
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMutedUntil = (timestamp?: number | null) => {
  if (timestamp === null) return '，直到手动恢复';
  if (!timestamp) return '';
  return `到 ${formatDeferredUntil(timestamp)}`;
};

const formatMutedReason = (reason?: string) => {
  return getTopicMuteReasonLabel(reason);
};

const handleMarkAsHighlightProject = async (entity: any) => {
  try {
    // 通过Chrome API获取现有的重点项目列表
    const response = await chromeAPI.sendMessage({
      type: 'GET_HIGHLIGHT_PROJECTS',
    });

    const highlightProjects = response?.data || [];
    const isAlreadyHighlighted = highlightProjects.some(
      (p: any) => p.id === entity.id,
    );

    if (isAlreadyHighlighted) {
      // 移除重点标记
      await chromeAPI.sendMessage({
        type: 'REMOVE_HIGHLIGHT_PROJECT',
        projectId: entity.id,
      });
      entity.isHighlighted = false;
      console.log(`已移除重点项目标记: ${entity.name}`);
    } else {
      // 添加重点标记
      // 使用 toRaw 确保传递的是原始对象
      const rawEntity = toRaw(entity);
      await chromeAPI.sendMessage({
        type: 'ADD_HIGHLIGHT_PROJECT',
        project: {
          id: rawEntity.id,
          name: rawEntity.name,
          type: rawEntity.type,
          description: rawEntity.description,
          addedAt: Date.now(),
        },
      });
      entity.isHighlighted = true;
      console.log(`已标记为重点项目: ${entity.name}`);
    }
  } catch (error) {
    console.error('标记重点项目失败:', error);
    alert('操作失败，请稍后重试');
  }
};

const openProjectDashboard = async (entity: any) => {
  try {
    // 先确保项目在重点项目列表中
    const response = await chromeAPI.sendMessage({
      type: 'GET_HIGHLIGHT_PROJECTS',
    });

    const highlightProjects = response?.data || [];
    const isHighlighted = highlightProjects.some(
      (p: any) => p.id === entity.id,
    );

    if (!isHighlighted) {
      // 如果不在重点项目中，询问是否添加
      const shouldAdd = confirm(
        `"${entity.name}" 不在重点项目列表中，是否添加并打开仪表盘？`,
      );
      if (shouldAdd) {
        await handleMarkAsHighlightProject(entity);
      }
    }

    // 通过Chrome API打开项目仪表盘
    await chromeAPI.sendMessage({
      type: 'OPEN_PROJECT_DASHBOARD',
      projectId: entity.id,
      projectName: entity.name,
    });
  } catch (error) {
    console.error('打开项目仪表盘失败:', error);
    alert('打开项目仪表盘失败，请稍后重试');
  }
};

const formatTime = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString();
};

const handleMarkTopicAsRead = async (topicId: string) => {
  // 找到对应的DOM元素
  const cardElement = document.querySelector(
    `[data-topic-id="${topicId}"]`,
  ) as HTMLElement;

  if (cardElement) {
    // 添加淡出动画class
    cardElement.classList.add('fade-out');

    // 等待动画完成(300ms)后再标记已读
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 标记已读(这会触发Vue的响应式更新)
    await store.markTopicAsRead(topicId);
  } else {
    // 如果找不到元素,直接标记已读
    await store.markTopicAsRead(topicId);
  }
};

const toggleTopicDeferMenu = (topicId: string) => {
  if (activeDeferTopicId.value === topicId) {
    activeDeferTopicId.value = null;
    return;
  }

  activeMuteTopicId.value = null;
  topicDeferOptions.value = getTopicDeferPresetOptions();
  customDeferValue.value = formatDateTimeLocal();
  activeDeferTopicId.value = topicId;
};

const toggleTopicMuteMenu = (topicId: string) => {
  if (activeMuteTopicId.value === topicId) {
    activeMuteTopicId.value = null;
    return;
  }

  activeDeferTopicId.value = null;
  topicMuteOptions.value = getTopicMutePresetOptions();
  topicMuteReasons.value = getTopicMuteReasonOptions();
  selectedMuteReason.value = 'not-now';
  activeMuteTopicId.value = topicId;
};

const handleDeferTopicForLater = async (topicId: string, until?: number) => {
  activeDeferTopicId.value = null;
  clearTopicDeferRestoreReceipt();
  const topic = entities.value.find((entity) => entity.id === topicId);
  const cardElement = document.querySelector(
    `[data-topic-id="${topicId}"]`,
  ) as HTMLElement;

  if (cardElement) {
    cardElement.classList.add('fade-out');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  await store.deferTopicForLater(topicId, until);
  const deferredState = store.getTopicDeferredState(topicId) as {
    until: number;
  } | null;
  showTopicDeferredUndo({
    topicId,
    topicName: String(topic?.name || topicId),
    until: deferredState?.until || Number(until) || Date.now(),
  });
};

const handleMuteTopic = async (
  topicId: string,
  until?: number | null,
  reason: TopicMuteReasonKey = selectedMuteReason.value,
) => {
  activeMuteTopicId.value = null;
  clearTopicMuteRestoreReceipt();
  const topic = entities.value.find((entity) => entity.id === topicId);
  const cardElement = document.querySelector(
    `[data-topic-id="${topicId}"]`,
  ) as HTMLElement;

  if (cardElement) {
    cardElement.classList.add('fade-out');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  await store.muteTopic(topicId, until, reason);
  const mutedState = store.getTopicMutedState(topicId) as {
    until: number | null;
    reason?: TopicMuteReasonKey;
  } | null;
  showTopicMuteUndo({
    topicId,
    topicName: String(topic?.name || topicId),
    until: mutedState?.until ?? null,
    reason: mutedState?.reason || reason,
  });
};

const handleCustomDefer = async (topicId: string) => {
  if (!customDeferTimestamp.value) return;
  await handleDeferTopicForLater(topicId, customDeferTimestamp.value);
};

const handleRestoreDeferredTopic = (topicId: string) => {
  activeDeferTopicId.value = null;
  const topic = entities.value.find((entity) => entity.id === topicId);
  const topicName = String(topic?.name || topicId);
  store.restoreDeferredTopic(topicId);
  if (topicDeferredUndo.value?.topicId === topicId) {
    clearTopicDeferredUndo();
  }
  showTopicDeferRestoreReceipt(topicName);
};

const handleRestoreMutedTopic = (topicId: string) => {
  activeMuteTopicId.value = null;
  const topic = entities.value.find((entity) => entity.id === topicId);
  const topicName = String(topic?.name || topicId);
  store.restoreMutedTopic(topicId);
  if (topicMuteUndo.value?.topicId === topicId) {
    clearTopicMuteUndo();
  }
  showTopicMuteRestoreReceipt(topicName);
};

const handleUndoTopicRead = async () => {
  await store.undoLastTopicRead();
};

const handleRetryEntityLoad = () => {
  if (!entityType.value) return;
  void store.loadEntitiesByType(entityType.value);
};

const clearTopicDeferredUndo = () => {
  topicDeferredUndo.value = null;
  if (topicDeferredUndoTimer !== null) {
    window.clearTimeout(topicDeferredUndoTimer);
    topicDeferredUndoTimer = null;
  }
};

const showTopicDeferredUndo = (
  undoState: NonNullable<typeof topicDeferredUndo.value>,
) => {
  clearTopicDeferredUndo();
  topicDeferredUndo.value = undoState;
  topicDeferredUndoTimer = window.setTimeout(clearTopicDeferredUndo, 10_000);
};

const handleUndoTopicDefer = () => {
  const undoState = topicDeferredUndo.value;
  if (!undoState) return;

  store.restoreDeferredTopic(undoState.topicId);
  clearTopicDeferredUndo();
  showTopicDeferRestoreReceipt(undoState.topicName);
  if (entityType.value === 'Topic' && topicViewMode.value === 'later') {
    topicViewMode.value = 'unread';
  }
};

const clearTopicMuteUndo = () => {
  topicMuteUndo.value = null;
  if (topicMuteUndoTimer !== null) {
    window.clearTimeout(topicMuteUndoTimer);
    topicMuteUndoTimer = null;
  }
};

const clearTopicMuteRestoreReceipt = () => {
  topicMuteRestoreReceipt.value = null;
  if (topicMuteRestoreReceiptTimer !== null) {
    window.clearTimeout(topicMuteRestoreReceiptTimer);
    topicMuteRestoreReceiptTimer = null;
  }
};

const clearTopicDeferRestoreReceipt = () => {
  topicDeferRestoreReceipt.value = null;
  if (topicDeferRestoreReceiptTimer !== null) {
    window.clearTimeout(topicDeferRestoreReceiptTimer);
    topicDeferRestoreReceiptTimer = null;
  }
};

const clearTopicDeferredReleaseTimer = () => {
  if (topicDeferredReleaseTimer !== null) {
    window.clearTimeout(topicDeferredReleaseTimer);
    topicDeferredReleaseTimer = null;
  }
};

const scheduleTopicDeferredReleaseRefresh = () => {
  clearTopicDeferredReleaseTimer();
  if (entityType.value !== 'Topic') return;

  const nextReleaseAt = store.getNextDeferredTopicReleaseAt();
  if (!nextReleaseAt) return;

  const delay = Math.min(
    Math.max(nextReleaseAt - Date.now() + 250, 250),
    2_147_483_647,
  );
  topicDeferredReleaseTimer = window.setTimeout(() => {
    store.refreshDeferredTopics();
    scheduleTopicDeferredReleaseRefresh();
  }, delay);
};

const showTopicMuteUndo = (
  undoState: NonNullable<typeof topicMuteUndo.value>,
) => {
  clearTopicMuteUndo();
  topicMuteUndo.value = undoState;
  topicMuteUndoTimer = window.setTimeout(clearTopicMuteUndo, 10_000);
};

const showTopicMuteRestoreReceipt = (topicName: string) => {
  clearTopicMuteRestoreReceipt();
  const displayName = topicName || '当前主题';
  topicMuteRestoreReceipt.value = {
    title: '取消静音回执',
    summary: `已取消「${displayName}」的本机静音。`,
    details: [
      '只删除本机静音过滤；未读信号保留，不会标记已读。',
      '没有同步 Memory Service、发送、删除或改写原始聊天平台。',
      '如果这个主题仍有未读，它会重新进入未读流；当前页面仍按你选中的视图显示。',
    ],
  };
  topicMuteRestoreReceiptTimer = window.setTimeout(
    clearTopicMuteRestoreReceipt,
    10_000,
  );
};

const showTopicDeferRestoreReceipt = (topicName: string) => {
  clearTopicDeferRestoreReceipt();
  const displayName = topicName || '当前主题';
  topicDeferRestoreReceipt.value = {
    title: '恢复未读回执',
    summary: `已把「${displayName}」移回未读流（本机）。`,
    details: [
      '只删除本机稍后处理状态；未读信号保留，不会标记已读。',
      '没有同步 Memory Service、发送、删除或改写原始聊天平台。',
      '如果这个主题仍有未读，它会重新进入未读队列；当前页面仍按你选中的视图显示。',
    ],
  };
  topicDeferRestoreReceiptTimer = window.setTimeout(
    clearTopicDeferRestoreReceipt,
    10_000,
  );
};

const handleUndoTopicMute = () => {
  const undoState = topicMuteUndo.value;
  if (!undoState) return;

  store.restoreMutedTopic(undoState.topicId);
  clearTopicMuteUndo();
  showTopicMuteRestoreReceipt(undoState.topicName);
  if (entityType.value === 'Topic' && topicViewMode.value === 'muted') {
    topicViewMode.value = 'unread';
  }
};

const handleViewMutedTopics = () => {
  activeDeferTopicId.value = null;
  activeMuteTopicId.value = null;
  topicViewMode.value = 'muted';
};

const handleViewDeferredTopics = () => {
  activeDeferTopicId.value = null;
  activeMuteTopicId.value = null;
  topicViewMode.value = 'later';
};

onBeforeUnmount(() => {
  clearTopicDeferredUndo();
  clearTopicDeferRestoreReceipt();
  clearTopicMuteUndo();
  clearTopicMuteRestoreReceipt();
  clearTopicDeferredReleaseTimer();
  clearSourceOpenReceiptTimer();
});

watch(
  entityType,
  (newType) => {
    if (newType) {
      // 清空搜索上下文，确保加载的是该类型的实体而不是搜索结果
      store.clearSearchContext();
      store.loadEntitiesByType(newType);
    }
  },
  { immediate: true },
);

watch(
  [entityType, deferredReleaseScheduleKey],
  scheduleTopicDeferredReleaseRefresh,
  { immediate: true },
);
</script>

<style scoped>
/* AI 分析按钮 */
.ai-analyze-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(
    135deg,
    rgba(147, 51, 234, 0.1),
    rgba(59, 130, 246, 0.1)
  );
  border: 1px solid rgba(147, 51, 234, 0.3);
  border-radius: 0.5rem;
  color: #a78bfa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.ai-analyze-btn:hover:not(:disabled) {
  background: linear-gradient(
    135deg,
    rgba(147, 51, 234, 0.2),
    rgba(59, 130, 246, 0.2)
  );
  border-color: rgba(147, 51, 234, 0.5);
  transform: translateY(-1px);
}

.ai-analyze-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-analyze-btn .ai-icon {
  font-size: 1rem;
}

.topic-search-scope-receipt,
.topic-unread-queue-receipt,
.topic-load-failure-receipt {
  display: flex;
  flex-basis: 100%;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.45;
}

.topic-load-failure-receipt {
  border-color: rgba(251, 191, 36, 0.32);
  background: rgba(69, 26, 3, 0.34);
  color: #fde68a;
}

.topic-search-scope-label,
.topic-unread-queue-label,
.topic-load-failure-label {
  flex: 0 0 auto;
  padding: 0.14rem 0.45rem;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.18);
  color: #bfdbfe;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.topic-load-failure-label {
  background: rgba(180, 83, 9, 0.24);
  color: #fde68a;
}

.source-open-receipt {
  flex-basis: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.5rem;
  background: rgba(37, 99, 235, 0.12);
  color: #bfdbfe;
  font-size: 0.82rem;
  line-height: 1.45;
}

.source-open-receipt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.3rem;
}

.source-open-host {
  display: inline-flex;
  flex: 0 0 auto;
  max-width: min(18rem, 54vw);
  padding: 0.12rem 0.42rem;
  border: 1px solid rgba(147, 197, 253, 0.28);
  border-radius: 999px;
  color: #dbeafe;
  background: rgba(30, 41, 59, 0.52);
  font-size: 0.72rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.source-open-receipt p {
  margin: 0;
}

.source-open-receipt ul {
  margin: 0.45rem 0 0;
  padding-left: 1.05rem;
}

.source-open-receipt li + li {
  margin-top: 0.2rem;
}

.topic-load-retry-btn {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 0.32rem 0.7rem;
  border: 1px solid rgba(251, 191, 36, 0.34);
  border-radius: 0.45rem;
  background: rgba(120, 53, 15, 0.42);
  color: #fef3c7;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.topic-load-retry-btn:hover,
.topic-load-retry-btn:focus-visible {
  border-color: rgba(251, 191, 36, 0.58);
  background: rgba(146, 64, 14, 0.5);
}

.topic-empty-recovery {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: #cbd5e1;
}

.topic-empty-recovery p {
  margin: 0;
  max-width: 42rem;
  line-height: 1.55;
}

.topic-empty-recovery-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.topic-priority-pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  margin-right: 0.45rem;
  padding: 0.12rem 0.45rem;
  border: 1px solid rgba(96, 165, 250, 0.26);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.14);
  color: #bfdbfe;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.topic-priority-pill.backlog {
  border-color: rgba(148, 163, 184, 0.32);
  background: rgba(71, 85, 105, 0.28);
  color: #cbd5e1;
}

.topic-priority-reasons {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  margin-right: 0.45rem;
  color: #cbd5e1;
  font-size: 0.75rem;
  line-height: 1.2;
}

.topic-participant-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.65rem;
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.35;
}

.topic-participant-label {
  color: #94a3b8;
  font-weight: 700;
}

.topic-participant-chip,
.topic-participant-more {
  display: inline-flex;
  align-items: center;
  max-width: 12rem;
  min-height: 1.35rem;
  padding: 0.12rem 0.45rem;
  border: 1px solid rgba(20, 184, 166, 0.26);
  border-radius: 0.45rem;
  background: rgba(20, 184, 166, 0.1);
  color: #99f6e4;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-participant-more {
  border-color: rgba(148, 163, 184, 0.26);
  background: rgba(148, 163, 184, 0.08);
  color: #cbd5e1;
}

/* AI 分析结果面板 */
.ai-analysis-panel {
  margin-bottom: 2rem;
  background: linear-gradient(
    135deg,
    rgba(147, 51, 234, 0.08),
    rgba(59, 130, 246, 0.08)
  );
  border: 1px solid rgba(147, 51, 234, 0.2);
  border-radius: 1rem;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  cursor: pointer;
  transition: background 0.3s ease;
  border-bottom: 1px solid rgba(147, 51, 234, 0.1);
}

.panel-header:hover {
  background: rgba(147, 51, 234, 0.05);
}

.panel-header .header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.panel-header .ai-icon {
  font-size: 1.5rem;
}

.panel-header h4 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #a78bfa;
  margin: 0;
}

.panel-header .toggle-btn {
  padding: 0.5rem 1rem;
  background: rgba(147, 51, 234, 0.1);
  border: 1px solid rgba(147, 51, 234, 0.3);
  border-radius: 0.5rem;
  color: #a78bfa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.panel-header .toggle-btn:hover {
  background: rgba(147, 51, 234, 0.2);
}

.panel-content {
  padding: 1.5rem;
}

.panel-content .answer-main {
  margin-bottom: 1.5rem;
}

.panel-content .answer-main p {
  color: #e2e8f0;
  font-size: 1rem;
  line-height: 1.8;
  margin: 0 0 0.75rem 0;
}

.panel-content .answer-main p:last-child {
  margin-bottom: 0;
}

.panel-content .answer-main strong {
  font-weight: 600;
  color: #f1f5f9;
}

.panel-content .answer-main a {
  color: #60a5fa;
  text-decoration: none;
}

.panel-content .answer-main a:hover {
  text-decoration: underline;
}

.panel-content .answer-structured {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.panel-content .findings-section h4,
.panel-content .timeline-section h4,
.panel-content .insights-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #a78bfa;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.panel-content .findings-section ul,
.panel-content .insights-section ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.panel-content .findings-section li,
.panel-content .insights-section li {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: rgba(30, 41, 59, 0.4);
  border-left: 3px solid #a78bfa;
  border-radius: 0.25rem;
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.6;
}

.panel-content .timeline-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel-content .timeline-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.5rem;
}

.panel-content .timeline-date {
  font-size: 0.875rem;
  font-weight: 600;
  color: #a78bfa;
  min-width: 100px;
}

.panel-content .timeline-event {
  flex: 1;
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
}

.panel-content .answer-metadata {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  font-size: 0.875rem;
  color: #94a3b8;
}

/* "阅"字按钮样式 */
.mark-read-btn {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.2),
    rgba(16, 185, 129, 0.2)
  );
  border: 2px solid rgba(34, 197, 94, 0.4);
  color: #22c55e;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 0;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  z-index: 10;
}

.content-card:hover .mark-read-btn,
.topic-card:hover .mark-read-btn,
.mark-read-btn:focus-visible {
  opacity: 1;
}

.mark-read-btn:hover {
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.3),
    rgba(16, 185, 129, 0.3)
  );
  border-color: #22c55e;
  transform: scale(1.1);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
}

.mark-read-btn:active {
  transform: scale(0.95);
}

.mark-read-btn:focus-visible {
  outline: 2px solid rgba(96, 165, 250, 0.75);
  outline-offset: 2px;
}

/* 未读徽章 */
.unread-badge {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  padding: 0.25rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  animation: pulse 2s infinite;
  margin-left: 0.5rem;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.6);
  }
}

/* 主题卡片未读状态 */
.content-card.unread,
.topic-card.unread {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.topic-card.muted {
  border-left-color: #64748b;
  background: rgba(100, 116, 139, 0.06);
}

.topic-card.menu-open {
  z-index: 40;
}

.topic-deferred-note,
.topic-muted-note {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  line-height: 1.4;
}

.topic-deferred-note {
  border: 1px solid rgba(245, 158, 11, 0.24);
  background: rgba(245, 158, 11, 0.08);
  color: #fbbf24;
}

.topic-muted-note {
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(100, 116, 139, 0.1);
  color: #cbd5e1;
  display: grid;
  gap: 0.28rem;
}

.topic-muted-note-detail {
  color: #94a3b8;
  font-size: 0.74rem;
  line-height: 1.35;
}

.resource-openable {
  cursor: pointer;
}

.resource-preview-content {
  display: inline-flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
}

.resource-source-note {
  color: #bfdbfe;
  font-size: 0.7rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.resource-source-note.muted {
  color: #94a3b8;
}

.preview-action-hint {
  margin-left: auto;
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.preview-action-hint.muted {
  color: #94a3b8;
}

.topic-triage-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.topic-defer-menu {
  position: relative;
}

.topic-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2rem;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.72);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.topic-action-btn:hover,
.topic-action-btn:focus-visible {
  border-color: rgba(96, 165, 250, 0.55);
  background: rgba(30, 41, 59, 0.95);
  color: #ffffff;
}

.topic-action-btn.later,
.topic-action-btn.restore {
  border-color: rgba(245, 158, 11, 0.32);
  color: #fbbf24;
}

.topic-action-btn.mute,
.topic-action-btn.mute-restore {
  border-color: rgba(148, 163, 184, 0.34);
  color: #cbd5e1;
}

.topic-action-btn.read {
  border-color: rgba(34, 197, 94, 0.36);
  color: #22c55e;
}

.topic-action-btn.review {
  border-color: rgba(96, 165, 250, 0.38);
  color: #93c5fd;
}

.topic-undo-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.88);
  color: #dbeafe;
  font-size: 0.875rem;
}

.topic-undo-toast button {
  flex: 0 0 auto;
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(96, 165, 250, 0.42);
  border-radius: 0.375rem;
  background: rgba(37, 99, 235, 0.18);
  color: #93c5fd;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
}

.topic-undo-toast button:hover,
.topic-undo-toast button:focus-visible {
  outline: none;
  background: rgba(37, 99, 235, 0.32);
  color: #ffffff;
}

.topic-undo-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

.topic-mute-restore-receipt {
  align-items: flex-start;
  border-color: rgba(148, 163, 184, 0.3);
  color: #e2e8f0;
}

.topic-defer-restore-receipt {
  align-items: flex-start;
  border-color: rgba(34, 197, 94, 0.28);
  background: rgba(22, 163, 74, 0.1);
  color: #bbf7d0;
}

.topic-mute-restore-copy {
  display: grid;
  gap: 0.22rem;
}

.topic-mute-restore-copy strong {
  color: #cbd5e1;
}

.topic-mute-restore-copy small {
  color: #94a3b8;
  line-height: 1.35;
}

.topic-defer-restore-copy {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
  line-height: 1.4;
}

.topic-defer-restore-copy strong {
  color: #dcfce7;
}

.topic-defer-restore-copy small {
  color: inherit;
  opacity: 0.9;
}

.topic-defer-options {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 30;
  display: grid;
  min-width: 11rem;
  padding: 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.98);
  box-shadow: 0 12px 30px rgba(2, 6, 23, 0.35);
}

.topic-defer-option {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: 0;
  border-radius: 0.375rem;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1.25;
  text-align: left;
}

.topic-defer-option small {
  color: #94a3b8;
  font-size: 0.72rem;
}

.topic-defer-option:hover,
.topic-defer-option:focus-visible {
  outline: none;
  background: rgba(245, 158, 11, 0.12);
  color: #ffffff;
}

.topic-menu-label {
  margin: 0.15rem 0.65rem 0.35rem;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 700;
}

.topic-defer-boundary-receipt,
.topic-mute-boundary-receipt {
  display: grid;
  gap: 0.25rem;
  margin: 0.1rem 0 0.35rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.66);
  color: #cbd5e1;
  font-size: 0.74rem;
  line-height: 1.35;
}

.topic-defer-boundary-receipt strong,
.topic-mute-boundary-receipt strong {
  color: #e2e8f0;
  font-size: 0.76rem;
}

.topic-mute-reasons {
  padding: 0.2rem 0 0.4rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.topic-mute-reason-grid {
  display: grid;
  gap: 0.3rem;
}

.topic-mute-reason-option {
  display: grid;
  gap: 0.12rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
  text-align: left;
}

.topic-mute-reason-option span {
  font-size: 0.8rem;
  font-weight: 700;
}

.topic-mute-reason-option small {
  color: #94a3b8;
  font-size: 0.72rem;
  line-height: 1.3;
}

.topic-mute-reason-option:hover,
.topic-mute-reason-option:focus-visible {
  outline: none;
  border-color: rgba(148, 163, 184, 0.3);
  background: rgba(100, 116, 139, 0.12);
}

.topic-mute-reason-option.active {
  border-color: rgba(96, 165, 250, 0.36);
  background: rgba(37, 99, 235, 0.16);
  color: #bfdbfe;
}

.topic-custom-defer {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.35rem;
  padding: 0.55rem 0.65rem 0.65rem;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.topic-custom-defer label {
  color: #cbd5e1;
  font-size: 0.75rem;
  font-weight: 700;
}

.topic-custom-defer-row {
  display: grid;
  grid-template-columns: minmax(9rem, 1fr) auto;
  gap: 0.4rem;
}

.topic-custom-defer input {
  min-width: 0;
  padding: 0.4rem 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 0.375rem;
  background: rgba(2, 6, 23, 0.42);
  color: #e2e8f0;
  font-size: 0.75rem;
}

.topic-custom-defer button {
  padding: 0.4rem 0.55rem;
  border: 1px solid rgba(245, 158, 11, 0.34);
  border-radius: 0.375rem;
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
}

.topic-custom-defer button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .topic-defer-options {
    right: auto;
    left: 0;
  }

  .topic-custom-defer-row {
    grid-template-columns: 1fr;
  }
}

/* 未读讨论列表样式 */
.unread-discussions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.unread-discussions-title {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.discussion-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem;
  margin: 0.25rem 0;
  border: 0;
  background: rgba(59, 130, 246, 0.05);
  border-left: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.25rem;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #cbd5e1;
  text-align: left;
  transition: all 0.2s ease;
}

.discussion-jump {
  cursor: pointer;
}

.discussion-item:hover,
.discussion-item:focus-visible {
  outline: none;
  background: rgba(59, 130, 246, 0.1);
  border-left-color: #60a5fa;
}

.discussion-icon {
  color: #60a5fa;
  flex-shrink: 0;
}

.discussion-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 视图切换控制 */
.view-control {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.view-toggle-btn {
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.5rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
}

.view-toggle-btn.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.view-toggle-btn:hover:not(.active) {
  background: rgba(59, 130, 246, 0.1);
}

/* 淡出动画 */
.fade-out {
  animation: fadeOutCard 0.3s ease forwards;
}

@keyframes fadeOutCard {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
}
</style>
