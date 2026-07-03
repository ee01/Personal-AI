<template>
  <div class="topic-detail">
    <div class="detail-header">
      <button class="back-btn" @click="goBack">
        <span>←</span>
        <span>返回主题列表</span>
      </button>
      <div v-if="topicData" class="topic-header">
        <div class="topic-avatar">💡</div>
        <div class="topic-info">
          <h2>{{ topicData.name }}</h2>
          <div class="topic-meta">
            <span class="meta-item"
              >📈 {{ topicData.statistic?.conversations || 0 }} 条讨论</span
            >
            <span class="meta-item"
              >🔗 {{ topicData.statistic?.projects || 0 }} 个关联项目</span
            >
            <span class="meta-item"
              >👥 {{ topicData.statistic?.participants || 0 }} 位参与者</span
            >
            <span class="meta-item"
              >📚 {{ topicData.statistic?.resources || 0 }} 个资源</span
            >
            <span v-if="topicUnreadCount > 0" class="meta-item unread-meta"
              >● {{ topicUnreadCount }} 条未读</span
            >
            <span v-if="currentTopicMutedState" class="meta-item muted-meta">
              🔕 已静音：{{
                formatMutedReason(currentTopicMutedState.reason)
              }}{{ formatMutedUntil(currentTopicMutedState.until) }}
            </span>
            <span
              v-if="currentTopicDeferredState"
              class="meta-item deferred-meta"
            >
              ⏰ 已稍后到
              {{ formatDeferredUntil(currentTopicDeferredState.until) }}（本机）
            </span>
            <span class="meta-item"
              >⏰ 最后更新：{{ getTopicLastUpdatedLabel(topicData) }}</span
            >
          </div>
          <div
            v-if="showTopicDetailTriageActions"
            class="topic-detail-actions"
          >
            <button
              v-if="currentTopicMutedState"
              type="button"
              class="topic-detail-action-btn topic-detail-mute-restore"
              @click.stop="handleRestoreMuteFromDetail"
            >
              ↩ 取消静音
            </button>
            <button
              v-else-if="currentTopicDeferredState"
              type="button"
              class="topic-detail-action-btn topic-detail-defer-restore"
              @click.stop="handleRestoreDeferFromDetail"
            >
              ↩ 恢复未读
            </button>
            <div
              v-else-if="topicDetailCanStartTriage"
              class="topic-detail-defer-menu"
              @click.stop
            >
              <button
                type="button"
                class="topic-detail-action-btn"
                :aria-expanded="detailDeferMenuOpen"
                @click.stop="toggleDetailDeferMenu"
              >
                ⏰ 稍后处理
              </button>
              <div
                v-if="detailDeferMenuOpen"
                class="topic-detail-defer-options"
                role="menu"
              >
                <div
                  class="topic-detail-boundary-receipt topic-detail-defer-boundary"
                  role="note"
                  aria-label="稍后处理边界"
                >
                  <strong>稍后处理边界</strong>
                  <span>
                    只写入本机浏览器状态；主题会暂时离开未读队列，但不会标记已读，也不会同步
                    Memory Service 或原始聊天平台。到期或恢复未读后回到未读流。
                  </span>
                </div>
                <button
                  v-for="option in detailDeferOptions"
                  :key="option.key"
                  type="button"
                  class="topic-detail-defer-option"
                  role="menuitem"
                  @click.stop="handleDeferTopicFromDetail(option.until)"
                >
                  <span>{{ option.label }}</span>
                  <small>{{ formatDeferredUntil(option.until) }}</small>
                </button>
              </div>
            </div>
            <div
              v-if="topicDetailCanStartTriage"
              class="topic-detail-defer-menu topic-detail-mute-menu"
              @click.stop
            >
              <button
                type="button"
                class="topic-detail-action-btn mute"
                :aria-expanded="detailMuteMenuOpen"
                @click.stop="toggleDetailMuteMenu"
              >
                🔕 静音
              </button>
              <div
                v-if="detailMuteMenuOpen"
                class="topic-detail-defer-options topic-detail-mute-options"
                role="menu"
              >
                <div
                  class="topic-detail-boundary-receipt topic-detail-mute-boundary"
                  role="note"
                  aria-label="静音边界"
                >
                  <strong>静音边界</strong>
                  <span>
                    只调整本机注意力过滤；未读仍保留在主题里，不删除消息，不写回
                    Memory Service 或原始聊天平台。可在静音视图或本页取消静音。
                  </span>
                </div>
                <div class="topic-detail-mute-reasons" role="none">
                  <div class="topic-detail-menu-label">静音原因</div>
                  <div class="topic-detail-mute-reason-grid" role="group">
                    <button
                      v-for="reason in detailMuteReasons"
                      :key="reason.key"
                      type="button"
                      :class="[
                        'topic-detail-mute-reason-option',
                        { active: detailSelectedMuteReason === reason.key },
                      ]"
                      :aria-pressed="detailSelectedMuteReason === reason.key"
                      @click.stop="detailSelectedMuteReason = reason.key"
                    >
                      <span>{{ reason.label }}</span>
                      <small>{{ reason.description }}</small>
                    </button>
                  </div>
                </div>
                <button
                  v-for="option in detailMuteOptions"
                  :key="option.key"
                  type="button"
                  class="topic-detail-defer-option topic-detail-mute-option"
                  role="menuitem"
                  @click.stop="
                    handleMuteTopicFromDetail(
                      option.until,
                      detailSelectedMuteReason,
                    )
                  "
                >
                  <span>{{ option.label }}</span>
                  <small>{{ formatMutedUntil(option.until) }}</small>
                </button>
              </div>
            </div>
            <span
              v-if="currentTopicMutedState && topicUnreadCount === 0"
              class="topic-detail-action-note"
            >
              当前没有未读；本机静音仍会隐藏未来未读。取消静音只删除本机过滤，不同步
              Memory Service 或原始聊天平台。
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="topicReadUndo" class="topic-undo-toast" role="status">
      <span>已将「{{ topicReadUndo.topicName }}」标记为已读</span>
      <button type="button" @click="handleUndoTopicRead">撤销</button>
    </div>

    <div
      v-if="detailDeferredUndo"
      class="topic-undo-toast topic-defer-undo-toast"
      role="status"
    >
      <span>
        已将「{{ detailDeferredUndo.topicName }}」稍后到
        {{ formatDeferredUntil(detailDeferredUndo.until) }}
      </span>
      <button type="button" @click="handleUndoDetailDefer">恢复</button>
    </div>

    <div
      v-if="detailMuteUndo"
      class="topic-undo-toast topic-mute-undo-toast"
      role="status"
    >
      <span>
        已将「{{ detailMuteUndo.topicName }}」静音：{{
          formatMutedReason(detailMuteUndo.reason)
        }}{{ formatMutedUntil(detailMuteUndo.until) }}。本机过滤，未读保留；未同步或标记已读。
      </span>
      <button type="button" @click="handleUndoDetailMute">取消静音</button>
    </div>

    <div
      v-if="conversationReadUndo"
      class="topic-undo-toast conversation-undo-toast"
      role="status"
    >
      <span>
        已将「{{
          formatConversationUndoLabel(conversationReadUndo)
        }}」标记为已读
      </span>
      <button type="button" @click="handleUndoConversationRead">撤销</button>
    </div>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载主题详情...</span>
    </div>

    <div v-else-if="topicData" class="topic-detail-content">
      <div class="tab-navigation">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        v-if="sourceOpenReceipt"
        class="source-open-receipt"
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

      <!-- 相关项目标签页 -->
      <div v-if="activeTab === 'projects'" class="tab-content active">
        <div class="section-header">
          <h3>📂 相关项目</h3>
        </div>
        <div class="items-grid">
          <div
            v-for="project in topicProjects"
            :key="project.id"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-title">
                <span>🚀</span>
                <span>{{ project.name }}</span>
              </div>
            </div>
            <div class="item-content">
              <div style="margin-bottom: 0.5rem">
                <span class="card-badge">{{ project.status }}</span>
              </div>
              <p>{{ project.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 相关资源标签页 -->
      <div v-if="activeTab === 'resources'" class="tab-content active">
        <div class="section-header">
          <h3>📚 相关资源</h3>
        </div>
        <div class="items-grid">
          <div
            v-for="resource in topicResources"
            :key="resource.id"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-title">
                <span>📚</span>
                <span>{{ resource.name }}</span>
              </div>
            </div>
            <div class="item-content">
              <div style="margin-bottom: 0.5rem">
                <span class="card-badge">{{ resource.type }}</span>
              </div>
              <p v-if="getResourceSourceLink(resource)">
                <a
                  :href="getResourceSourceLink(resource)?.url"
                  class="item-link topic-source-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="getResourceSourceLink(resource)?.title"
                  :aria-label="getResourceSourceLink(resource)?.title"
                  @click.stop="
                    handleSourceOpen(
                      getResourceSourceLink(resource),
                      '资源来源',
                    )
                  "
                >
                  <span>{{ getResourceSourceLink(resource)?.label }}</span>
                  <span
                    v-if="getResourceSourceLink(resource)?.host"
                    class="topic-source-host"
                    >{{ getResourceSourceLink(resource)?.host }}</span
                  >
                </a>
                <span
                  v-if="hasFilteredResourceSourceCandidates(resource)"
                  class="topic-source-filtered"
                  :title="getResourceFilteredSourceTitle(resource)"
                  :aria-label="getResourceFilteredSourceTitle(resource)"
                >
                  {{ getResourceFilteredSourceLabel(resource) }}
                </span>
              </p>
              <p
                v-else-if="hasHiddenResourceSourceCandidates(resource)"
                class="item-muted topic-source-hidden"
                :title="getResourceHiddenSourceTitle(resource)"
                :aria-label="getResourceHiddenSourceTitle(resource)"
              >
                {{ getResourceHiddenSourceLabel(resource) }}
              </p>
              <p v-else class="item-muted">暂无可打开链接</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 相关Tickets标签页 -->
      <div v-if="activeTab === 'tickets'" class="tab-content active">
        <div class="section-header">
          <h3>🎯 相关Tickets</h3>
        </div>
        <div class="items-grid">
          <div
            v-for="ticket in topicTickets"
            :key="ticket.id"
            class="item-card"
          >
            <div class="item-header">
              <div class="item-title">
                <span>🎯</span>
                <span>{{ ticket.id }}</span>
              </div>
            </div>
            <div class="item-content">
              <h4 style="margin-bottom: 0.5rem; font-weight: 600">
                {{ ticket.title }}
              </h4>
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem">
                <span class="card-badge">{{ ticket.status }}</span>
                <span
                  class="card-badge"
                  :style="getPriorityStyle(ticket.priority)"
                  >{{ ticket.priority }}</span
                >
              </div>
              <p style="font-size: 0.875rem; color: #94a3b8">
                负责人：{{ ticket.assignee }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 聊天记录标签页 -->
      <div v-if="activeTab === 'conversations'" class="tab-content active">
        <div class="section-header">
          <div class="conversation-section-title">
            <h3>💬 聊天记录</h3>
            <div class="conversation-read-summary" aria-live="polite">
              <span class="read-summary-pill unread"
                >未读 {{ conversationUnreadCount }}</span
              >
              <span class="read-summary-pill"
                >全部 {{ conversationTotalCount }}</span
              >
            </div>
          </div>
          <div class="search-controls">
            <input
              type="text"
              class="search-input"
              placeholder="搜索聊天记录、上下文或来源..."
              v-model="convSearchQuery"
            />
            <select
              class="filter-select read-filter-select"
              v-model="convReadFilter"
              aria-label="按阅读状态筛选聊天记录"
            >
              <option value="all">全部状态</option>
              <option value="unread">仅未读</option>
              <option value="read">已读</option>
            </select>
            <select class="filter-select" v-model="convFilter">
              <option value="all">全部群组</option>
              <option value="team">团队群</option>
              <option value="project">项目群</option>
              <option value="tech">技术讨论</option>
            </select>
            <button
              type="button"
              class="mark-all-read-btn"
              @click="handleMarkAllAsRead"
              title="标记所有消息为已读"
              :disabled="topicUnreadCount === 0"
            >
              ✓ 全部已阅
            </button>
          </div>
        </div>
        <div
          v-if="messageFocusNotice"
          :class="['message-focus-notice', messageFocusNotice.type]"
          role="status"
        >
          <div class="message-focus-notice-header">
            <strong>{{ messageFocusNotice.title }}</strong>
            <span
              v-if="messageFocusNotice.targetLabel"
              class="message-focus-target-chip"
            >
              {{ messageFocusNotice.targetLabel }}
            </span>
          </div>
          <p>{{ messageFocusNotice.summary }}</p>
          <ul>
            <li v-for="detail in messageFocusNotice.details" :key="detail">
              {{ detail }}
            </li>
          </ul>
          <div
            v-if="messageFocusNotice.actions?.length"
            class="message-focus-actions"
          >
            <button
              v-for="action in messageFocusNotice.actions"
              :key="action.kind"
              type="button"
              :class="[
                'message-focus-action',
                { undo: action.kind === 'undoMessageReadSync' },
              ]"
              @click="handleMessageFocusNoticeAction(action.kind)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>
        <div
          class="topic-read-batch-receipt"
          role="note"
          aria-label="阅读批次回执"
        >
          <div class="topic-read-batch-header">
            <strong>阅读批次回执</strong>
            <span class="topic-read-batch-mode">
              {{ conversationReadBatchReceipt.modeLabel }}
            </span>
          </div>
          <p>{{ conversationReadBatchReceipt.summary }}</p>
          <div
            class="topic-read-batch-metrics"
            aria-label="阅读批次构成"
          >
            <span
              v-for="metric in conversationReadBatchReceipt.metrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
          <ul>
            <li
              v-for="detail in conversationReadBatchReceipt.details"
              :key="detail"
            >
              {{ detail }}
            </li>
          </ul>
        </div>
        <div v-if="filteredConversations.length === 0" class="empty-state">
          <div>{{ conversationEmptyText }}</div>
          <div
            v-if="conversationEmptyRecoveryReceipt"
            class="conversation-empty-recovery"
            role="note"
            aria-label="空批次恢复回执"
          >
            <div class="conversation-empty-recovery-head">
              <strong>{{ conversationEmptyRecoveryReceipt.title }}</strong>
              <span>{{ conversationReadBatchReceipt.modeLabel }}</span>
            </div>
            <p>{{ conversationEmptyRecoveryReceipt.summary }}</p>
            <ul>
              <li
                v-for="detail in conversationEmptyRecoveryReceipt.details"
                :key="detail"
              >
                {{ detail }}
              </li>
            </ul>
            <div class="conversation-empty-recovery-actions">
              <button
                v-for="action in conversationEmptyRecoveryReceipt.actions"
                :key="action.kind"
                type="button"
                @click="handleConversationRecoveryAction(action.kind)"
              >
                {{ action.label }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="conversations-list">
          <div
            v-for="(conv, index) in filteredConversations"
            :key="getConversationRenderId(conv, index)"
            class="conversation-item"
            :class="{
              expanded: isConversationExpanded(conv, index),
              unread: isConversationUnread(conv),
              targeted:
                highlightedConversationId ===
                getConversationRenderId(conv, index),
            }"
            :data-conversation-id="getConversationRenderId(conv, index)"
          >
            <div class="conversation-header">
              <div class="conversation-meta">
                <div class="sender-avatar">
                  {{ (conv.sender || '?').charAt(0) }}
                </div>
                <div class="sender-info">
                  <div class="sender-name">
                    {{ conv.sender || '未知用户' }}
                    <span
                      v-if="isConversationUnread(conv)"
                      class="unread-indicator"
                      >●</span
                    >
                  </div>
                  <div class="group-name">
                    {{ conv.groupName || '未知群组' }}
                    <span
                      v-if="doesConversationContextMatch(conv)"
                      class="context-match-badge"
                    >
                      上下文匹配
                    </span>
                  </div>
                </div>
              </div>
              <div class="conversation-side-actions">
                <template v-if="getConversationSourceUrl(conv)">
                  <a
                    class="conversation-source-link"
                    :href="getConversationSourceUrl(conv)"
                    target="_blank"
                    rel="noopener noreferrer"
                    :title="getConversationSourceTitle(conv)"
                    :aria-label="getConversationSourceTitle(conv)"
                    @click.stop="
                      handleSourceOpen(
                        getConversationSourceLink(conv),
                        '消息来源',
                      )
                    "
                  >
                    <span class="conversation-source-label">{{
                      getConversationSourceLabel(conv)
                    }}</span>
                    <span
                      v-if="getConversationSourceHost(conv)"
                      class="conversation-source-host"
                      >{{ getConversationSourceHost(conv) }}</span
                    >
                  </a>
                  <span
                    v-if="hasFilteredConversationSourceCandidates(conv)"
                    class="conversation-source-filtered"
                    :title="getConversationFilteredSourceTitle(conv)"
                    :aria-label="getConversationFilteredSourceTitle(conv)"
                  >
                    {{ getConversationFilteredSourceLabel(conv) }}
                  </span>
                </template>
                <span
                  v-else-if="hasHiddenConversationSourceCandidates(conv)"
                  class="conversation-source-hidden"
                  :title="getConversationHiddenSourceTitle(conv)"
                  :aria-label="getConversationHiddenSourceTitle(conv)"
                >
                  {{ getConversationHiddenSourceLabel(conv) }}
                </span>
                <div class="conversation-time">
                  {{ formatTimeAgo(conv.datetime) || '未知时间' }}
                </div>
              </div>
            </div>
            <div
              class="conversation-summary"
              v-html="
                highlightText(conv.summary || '暂无摘要', convSearchQuery)
              "
            ></div>
            <button
              type="button"
              class="context-indicator"
              :class="{ expanded: isConversationExpanded(conv, index) }"
              @click="toggleConversationExpand(conv, index)"
            >
              <span class="indicator-text">
                {{
                  isConversationExpanded(conv, index)
                    ? '🔼 收起上下文'
                    : getConversationContextLabel(conv)
                }}
              </span>
            </button>
            <div
              v-if="conv.contextMessages"
              class="context-content"
              :class="{ expanded: isConversationExpanded(conv, index) }"
            >
              <div class="context-divider"></div>
              <div
                v-for="(contextMsg, index) in conv.contextMessages"
                :key="index"
                class="context-item"
                :class="{
                  'main-message': contextMsg.isMainMessage,
                  unread: isContextMessageUnread(contextMsg),
                  targeted: isTargetedContextMessage(contextMsg),
                }"
                :data-topic-message-ids="
                  getTopicMessageIdentityAttr(contextMsg)
                "
              >
                <div class="context-header">
                  <div class="context-sender">
                    {{ contextMsg.sender || '未知用户' }}
                    <span
                      v-if="isContextMessageUnread(contextMsg)"
                      class="unread-indicator"
                      >●</span
                    >
                    <span
                      v-if="isTargetedContextMessage(contextMsg)"
                      class="targeted-message-badge"
                    >
                      链接定位
                    </span>
                  </div>
                  <div class="context-time">
                    {{ formatTimeAgo(contextMsg.datetime) || '未知时间' }}
                  </div>
                </div>
                <div
                  class="context-content-text"
                  v-html="
                    highlightText(
                      contextMsg.content || '内容为空',
                      convSearchQuery,
                    )
                  "
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 网页记录标签页 -->
      <div v-if="activeTab === 'webpages'" class="tab-content active">
        <div class="section-header">
          <h3>🌐 网页记录</h3>
          <div class="search-controls">
            <input
              type="text"
              class="search-input"
              placeholder="搜索网页记录..."
              v-model="webSearchQuery"
            />
            <select class="filter-select" v-model="webTypeFilter">
              <option value="all">全部类型</option>
              <option value="jira">Jira</option>
              <option value="confluence">Confluence</option>
              <option value="github">GitHub</option>
              <option value="docs">文档</option>
              <option value="blog">博客</option>
            </select>
          </div>
        </div>
        <div class="webpages-list">
          <div v-if="filteredWebpages.length === 0" class="empty-state">
            暂无匹配网页记录
          </div>
          <div
            v-for="webpage in filteredWebpages"
            :key="webpage.id"
            class="webpage-item"
          >
            <div class="webpage-header">
              <div class="webpage-icon">{{ getWebpageIcon(webpage.type) }}</div>
              <div class="webpage-info">
                <div class="webpage-title">
                  {{ webpage.title || '未知标题' }}
                </div>
                <div
                  :class="[
                    'webpage-url',
                    { hidden: hasHiddenWebpageSourceCandidates(webpage) },
                  ]"
                  :title="getWebpageSourceDisplayTitle(webpage)"
                  :aria-label="getWebpageSourceDisplayTitle(webpage)"
                >
                  {{ getWebpageSourceDisplayText(webpage) }}
                </div>
                <div class="webpage-meta">
                  <span>访问时间：{{ webpage.visitTime || '未知时间' }}</span>
                  <span v-if="webpage.relevanceScore"
                    >相关性：{{
                      (webpage.relevanceScore * 100).toFixed(0)
                    }}%</span
                  >
                </div>
                <a
                  v-if="getWebpageSourceLink(webpage)"
                  class="webpage-open-link topic-source-link"
                  :href="getWebpageSourceLink(webpage)?.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="getWebpageSourceLink(webpage)?.title"
                  :aria-label="getWebpageSourceLink(webpage)?.title"
                  @click.stop="
                    handleSourceOpen(
                      getWebpageSourceLink(webpage),
                      '网页来源',
                    )
                  "
                >
                  <span>{{ getWebpageSourceLink(webpage)?.label }}</span>
                  <span
                    v-if="getWebpageSourceLink(webpage)?.host"
                    class="topic-source-host"
                    >{{ getWebpageSourceLink(webpage)?.host }}</span
                  >
                </a>
                <span
                  v-if="hasFilteredWebpageSourceCandidates(webpage)"
                  class="topic-source-filtered webpage-source-filtered"
                  :title="getWebpageFilteredSourceTitle(webpage)"
                  :aria-label="getWebpageFilteredSourceTitle(webpage)"
                >
                  {{ getWebpageFilteredSourceLabel(webpage) }}
                </span>
                <span
                  v-else-if="hasHiddenWebpageSourceCandidates(webpage)"
                  class="topic-source-hidden webpage-source-hidden"
                  :title="getWebpageHiddenSourceTitle(webpage)"
                  :aria-label="getWebpageHiddenSourceTitle(webpage)"
                >
                  {{ getWebpageHiddenSourceLabel(webpage) }}
                </span>
              </div>
            </div>
            <div class="webpage-content">
              {{ webpage.summary || '暂无摘要' }}
            </div>
            <div v-if="webpage.tags" class="webpage-tags">
              <span
                v-for="tag in webpage.tags"
                :key="tag"
                class="webpage-tag"
                >{{ tag }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getTopicDeferPresetOptions,
  getTopicMutePresetOptions,
  getTopicMuteReasonLabel,
  getTopicMuteReasonOptions,
  useMemoryStore,
  type TopicMuteReasonKey,
} from '../memory-store';
import {
  findTopicConversationByMessageId,
  getTopicConversationUnreadMessageCount,
  getTopicConversationUnreadCount,
  getTopicConversationRenderIdentity,
  getTopicConversationReadSyncId,
  getTopicDetailRecentData,
  getTopicDetailUnreadCount,
  getTopicMessageIdentityCandidates,
  getTopicMessageIdentityValues,
  isTopicMessageExplicitlyUnread,
  isTopicConversationUnread,
  sortTopicConversationsForTriage,
  topicMessageMatchesIdentity,
  topicConversationHasContextMatch,
  topicConversationMatchesQuery,
  type TopicConversationReadFilter,
} from '../topic-detail-data';
import { renderHighlightedText } from '../topic-detail-rendering';
import {
  type ExternalLinkCandidate,
  type SafeExternalLinkPresentation,
  type ExternalUrlSafetyResult,
  getBlockedExternalUrlResults,
  getExternalUrlSafety,
  getFirstSafeExternalLinkPresentation,
  getFirstSafeExternalUrl,
  getHiddenExternalUrlLabel,
  getHiddenExternalUrlTitle,
} from '../topic-link-safety';
import { formatTopicRelativeTime } from '../topic-time';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const topicId = computed(() => route.params.id as string);
const topicData = computed(() => store.topicDetailData);
const isLoading = computed(() => store.isLoading);
const topicReadUndo = computed(() => store.topicReadUndo);
const conversationReadUndo = computed(() => store.conversationReadUndo);
const currentTopicMutedState = computed(() => {
  if (!topicId.value) return null;
  return store.getTopicMutedState(topicId.value) as {
    until: number | null;
    reason?: TopicMuteReasonKey;
  } | null;
});
const currentTopicDeferredState = computed(() => {
  if (!topicId.value) return null;
  return store.getTopicDeferredState(topicId.value) as {
    until: number;
    createdAt?: number;
  } | null;
});
const activeTab = ref('conversations');
const topicUnreadCount = computed(() =>
  getTopicDetailUnreadCount(topicData.value),
);
const showTopicDetailTriageActions = computed(
  () =>
    topicUnreadCount.value > 0 ||
    Boolean(currentTopicMutedState.value) ||
    Boolean(currentTopicDeferredState.value),
);
const topicDetailCanStartTriage = computed(
  () =>
    topicUnreadCount.value > 0 &&
    !currentTopicMutedState.value &&
    !currentTopicDeferredState.value,
);
const topicRecentData = computed(() =>
  getTopicDetailRecentData(topicData.value),
);
const topicConversations = computed(() => topicRecentData.value.conversations);
const topicWebpages = computed(() => topicRecentData.value.webpages);
const topicProjects = computed(() => topicRecentData.value.projects);
const topicResources = computed(() => topicRecentData.value.resources);
const topicTickets = computed(() => topicRecentData.value.jiraTickets);

const convSearchQuery = ref('');
const normalizeReadFilterValue = (
  value: unknown,
): TopicConversationReadFilter => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const normalized = String(normalizedValue || '').trim();
  if (normalized === 'unread' || normalized === 'read') {
    return normalized;
  }
  return 'all';
};
const convReadFilter = ref<TopicConversationReadFilter>(
  normalizeReadFilterValue(route.query.readFilter),
);
const convFilter = ref('all');
const webSearchQuery = ref('');
const webTypeFilter = ref('all');
const expandedConversations = ref<Set<string>>(new Set());
const stickyUnreadConversationIds = ref<Set<string>>(new Set());
const highlightedConversationId = ref<string | null>(null);
const highlightedMessageId = ref<string | null>(null);
type MessageFocusNotice = {
  type: 'info' | 'warning';
  title: string;
  targetLabel?: string;
  summary: string;
  details: string[];
  actions?: MessageFocusAction[];
};
type MessageFocusActionKind =
  | 'showAllConversations'
  | 'dismissFocusNotice'
  | 'undoMessageReadSync';
type MessageFocusAction = {
  kind: MessageFocusActionKind;
  label: string;
};
const messageFocusNotice = ref<MessageFocusNotice | null>(null);
type SourceOpenReceipt = {
  title: string;
  host: string;
  summary: string;
  details: string[];
};
type ConversationReadBatchReceipt = {
  modeLabel: string;
  summary: string;
  metrics: string[];
  details: string[];
};
type ConversationEmptyRecoveryAction =
  | 'clearSearch'
  | 'resetGroup'
  | 'showUnread'
  | 'showAll';
type ConversationEmptyRecoveryReceipt = {
  title: string;
  summary: string;
  details: string[];
  actions: Array<{
    kind: ConversationEmptyRecoveryAction;
    label: string;
  }>;
};
const sourceOpenReceipt = ref<SourceOpenReceipt | null>(null);
let sourceOpenReceiptTimer: ReturnType<typeof window.setTimeout> | null = null;
const detailDeferMenuOpen = ref(false);
const detailDeferOptions = ref(getTopicDeferPresetOptions());
const detailDeferredUndo = ref<{
  topicId: string;
  topicName: string;
  until: number;
} | null>(null);
let detailDeferredUndoTimer: ReturnType<typeof window.setTimeout> | null = null;
const detailMuteMenuOpen = ref(false);
const detailMuteOptions = ref(getTopicMutePresetOptions());
const detailMuteReasons = ref(getTopicMuteReasonOptions());
const detailSelectedMuteReason = ref<TopicMuteReasonKey>('not-now');
const detailMuteUndo = ref<{
  topicId: string;
  topicName: string;
  until: number | null;
  reason?: TopicMuteReasonKey;
} | null>(null);
let detailMuteUndoTimer: ReturnType<typeof window.setTimeout> | null = null;

const tabs = [
  { key: 'conversations', label: '💬 聊天记录' },
  { key: 'projects', label: '🚀 相关项目' },
  { key: 'resources', label: '📚 相关资源' },
  { key: 'tickets', label: '🎯 相关Tickets' },
  { key: 'webpages', label: '🌐 网页记录' },
];

const conversationUnreadCount = computed(() =>
  getTopicConversationUnreadCount(topicConversations.value),
);
const conversationTotalCount = computed(() => topicConversations.value.length);
const conversationEmptyText = computed(() => {
  if (convReadFilter.value === 'unread') return '没有匹配的未读聊天记录';
  if (convReadFilter.value === 'read') return '没有匹配的已读聊天记录';
  return '没有匹配的聊天记录';
});

const conversationReadFilterLabel = computed(() => {
  if (convReadFilter.value === 'unread') return '仅未读视图';
  if (convReadFilter.value === 'read') return '已读视图';
  return '全部状态视图';
});

const conversationGroupFilterLabel = computed(() => {
  switch (convFilter.value) {
    case 'team':
      return '团队群';
    case 'project':
      return '项目群';
    case 'tech':
      return '技术讨论';
    default:
      return '全部群组';
  }
});

const conversationFilterScopeLabel = computed(() => {
  const query = convSearchQuery.value.trim();
  const filters = [
    conversationReadFilterLabel.value,
    conversationGroupFilterLabel.value,
  ];
  if (query) {
    filters.push(`本页搜索「${query}」`);
  }
  return filters.join(' / ');
});

const getConversationRenderId = (conversation: any, index = 0): string => {
  return getTopicConversationRenderIdentity(conversation, index);
};

const getConversationFocusRenderId = (conversation: any): string => {
  if (!conversation) return '';
  const sortedConversations = sortTopicConversationsForTriage(
    topicConversations.value,
  );
  const sortedIndex = sortedConversations.findIndex(
    (candidate) => candidate === conversation,
  );
  return getConversationRenderId(
    conversation,
    sortedIndex >= 0 ? sortedIndex : 0,
  );
};

const shouldKeepConversationForReadFilter = (
  conversation: any,
  sortedIndex = 0,
): boolean => {
  if (convReadFilter.value === 'unread') {
    return (
      isTopicConversationUnread(conversation) ||
      stickyUnreadConversationIds.value.has(
        getConversationRenderId(conversation, sortedIndex),
      )
    );
  }

  if (convReadFilter.value === 'read') {
    return !isTopicConversationUnread(conversation);
  }

  return true;
};

const filteredConversations = computed(() => {
  let filtered = sortTopicConversationsForTriage(topicConversations.value);

  filtered = filtered.filter((conv, index) =>
    shouldKeepConversationForReadFilter(conv, index),
  );

  if (convSearchQuery.value.trim()) {
    filtered = filtered.filter((conv) =>
      topicConversationMatchesQuery(conv, convSearchQuery.value),
    );
  }

  if (convFilter.value !== 'all') {
    filtered = filtered.filter((conv) => {
      switch (convFilter.value) {
        case 'team':
          return (
            (conv.groupName || '').includes('团队') ||
            (conv.groupName || '').includes('Team')
          );
        case 'project':
          return (
            (conv.groupName || '').includes('项目') ||
            (conv.groupName || '').includes('Project')
          );
        case 'tech':
          return (
            (conv.groupName || '').includes('技术') ||
            (conv.groupName || '').includes('Tech') ||
            (conv.groupName || '').includes('开发')
          );
        default:
          return true;
      }
    });
  }

  return filtered;
});

const getConversationReadStateNodes = (conversation: any): any[] => {
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages.filter(Boolean)
    : [];
  return [conversation, ...contextMessages].filter(Boolean);
};

const hasConversationUnknownReadState = (conversation: any): boolean => {
  const readStateNodes = getConversationReadStateNodes(conversation);
  if (readStateNodes.length === 0) return false;
  return readStateNodes.some(
    (message) => message?.isRead !== true && message?.isRead !== false,
  );
};

const conversationReadBatchReceipt = computed<ConversationReadBatchReceipt>(
  () => {
    const visibleCount = filteredConversations.value.length;
    const totalCount = conversationTotalCount.value;
    const unreadConversationCount = conversationUnreadCount.value;
    const topicUnreadSignalCount = topicUnreadCount.value;
    const stickyCount = stickyUnreadConversationIds.value.size;
    const unknownReadStateCount = topicConversations.value.filter(
      hasConversationUnknownReadState,
    ).length;
    const activeLocalState = currentTopicMutedState.value
      ? '当前主题已被本机静音，仍可在本页阅读和恢复；未读没有因此被标记已读。'
      : currentTopicDeferredState.value
        ? '当前主题已被本机稍后处理，仍可在本页阅读和恢复；未读没有因此被标记已读。'
        : '当前主题没有本机稍后或静音过滤状态。';
    const stickyDetail =
      stickyCount > 0
        ? `有 ${stickyCount} 条刚展开的未读讨论被临时留在当前批次，避免已读同步后立刻消失。`
        : '展开未读上下文后，会短暂保留当前讨论以便继续阅读。';
    const unknownReadStateDetail =
      unknownReadStateCount > 0
        ? `有 ${unknownReadStateCount} 条聊天包含未知读状态；缺少明确读状态的历史聊天不会被自动算作未读。`
        : '只有带明确未读标记、未读预览或主题未读计数的内容会进入未读压力。';
    const metrics = [
      `已加载 ${totalCount}`,
      `当前显示 ${visibleCount}`,
      `明确未读聊天 ${unreadConversationCount}`,
      `主题未读信号 ${topicUnreadSignalCount}`,
    ];
    if (stickyCount > 0) metrics.push(`暂留 ${stickyCount}`);
    if (unknownReadStateCount > 0) {
      metrics.push(`未知读状态 ${unknownReadStateCount}`);
    }
    metrics.push('排序：未读优先');

    return {
      modeLabel: conversationReadFilterLabel.value,
      summary: `当前批次显示 ${visibleCount}/${totalCount} 条聊天；其中 ${unreadConversationCount} 条聊天、${topicUnreadSignalCount} 个主题未读信号仍需处理。`,
      metrics,
      details: [
        `筛选口径：${conversationFilterScopeLabel.value}；本页搜索和群组筛选只影响当前已加载详情。`,
        '排序依据：先把明确未读聊天排在前面，同一状态保留详情返回顺序；本页不会补拉历史消息或重排后端主题。',
        '展开上下文才会把对应消息走当前实体缓存路径标记已读；不会改写原始聊天平台。',
        '全部已阅只更新当前主题的已知未读信号，并保留短时间撤销；不会发送、删除或同步外部系统。',
        stickyDetail,
        unknownReadStateDetail,
        activeLocalState,
      ],
    };
  },
);

const conversationEmptyRecoveryReceipt =
  computed<ConversationEmptyRecoveryReceipt | null>(() => {
    if (
      filteredConversations.value.length > 0 ||
      conversationTotalCount.value === 0
    ) {
      return null;
    }

    const query = convSearchQuery.value.trim();
    const actions: ConversationEmptyRecoveryReceipt['actions'] = [];
    const details: string[] = [];

    if (query) {
      details.push(`本页搜索「${query}」没有命中当前已加载聊天。`);
      actions.push({ kind: 'clearSearch', label: '清空本页搜索' });
    }

    if (convFilter.value !== 'all') {
      details.push(
        `群组筛选为「${conversationGroupFilterLabel.value}」，可能隐藏其他讨论。`,
      );
      actions.push({ kind: 'resetGroup', label: '显示全部群组' });
    }

    if (topicUnreadCount.value > 0) {
      actions.push({ kind: 'showUnread', label: '恢复未读批次' });
    }

    actions.push({ kind: 'showAll', label: '查看全部聊天' });

    return {
      title: '空批次恢复回执',
      summary:
        topicUnreadCount.value > 0
          ? `当前本页筛选隐藏了 ${conversationTotalCount.value} 条已加载聊天；主题仍有 ${topicUnreadCount.value} 个未读信号没有因此被标记已读。`
          : `当前本页筛选隐藏了 ${conversationTotalCount.value} 条已加载聊天；没有发现明确未读信号。`,
      details: [
        ...details,
        '这些操作只恢复本页阅读视图，不刷新后端、不同步 Memory Service、不改写原始聊天平台。',
      ],
      actions,
    };
  });

const filteredWebpages = computed(() => {
  let filtered = topicWebpages.value;

  if (webSearchQuery.value.trim()) {
    const query = webSearchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (webpage) =>
        (webpage.title || '').toLowerCase().includes(query) ||
        (webpage.summary || '').toLowerCase().includes(query) ||
        (webpage.url || '').toLowerCase().includes(query),
    );
  }

  if (webTypeFilter.value !== 'all') {
    filtered = filtered.filter(
      (webpage) => webpage.type === webTypeFilter.value,
    );
  }

  return filtered;
});

const goBack = () => {
  router.push('/entity/Topic');
};

const rememberStickyUnreadConversation = (conversationId: string) => {
  stickyUnreadConversationIds.value = new Set([
    ...stickyUnreadConversationIds.value,
    conversationId,
  ]);
};

const forgetStickyUnreadConversation = (conversationId: string) => {
  if (!stickyUnreadConversationIds.value.has(conversationId)) return;
  const next = new Set(stickyUnreadConversationIds.value);
  next.delete(conversationId);
  stickyUnreadConversationIds.value = next;
};

const clearStickyUnreadConversations = () => {
  if (stickyUnreadConversationIds.value.size === 0) return;
  stickyUnreadConversationIds.value = new Set();
};

const isConversationExpanded = (conversation: any, index = 0): boolean => {
  return expandedConversations.value.has(
    getConversationRenderId(conversation, index),
  );
};

const toggleConversationExpand = (conversation: any, index = 0) => {
  const conversationId = getConversationRenderId(conversation, index);
  const newExpanded = new Set(expandedConversations.value);
  if (newExpanded.has(conversationId)) {
    newExpanded.delete(conversationId);
    forgetStickyUnreadConversation(conversationId);
  } else {
    const wasUnread = isConversationUnread(conversation);
    newExpanded.clear();
    newExpanded.add(conversationId);
    const messageId = getTopicConversationReadSyncId(conversation);
    if (convReadFilter.value === 'unread' && wasUnread) {
      rememberStickyUnreadConversation(conversationId);
    }
    if (messageId && wasUnread) {
      void store.markConversationAsRead(topicId.value, messageId);
    }
  }
  expandedConversations.value = newExpanded;
};

const handleMarkAllAsRead = async () => {
  if (topicId.value) {
    await store.markTopicAsRead(topicId.value);
    clearStickyUnreadConversations();
  }
};

const handleConversationRecoveryAction = (
  action: ConversationEmptyRecoveryAction,
) => {
  if (action === 'clearSearch') {
    convSearchQuery.value = '';
    return;
  }
  if (action === 'resetGroup') {
    convFilter.value = 'all';
    return;
  }
  convSearchQuery.value = '';
  convFilter.value = 'all';
  convReadFilter.value = action === 'showUnread' ? 'unread' : 'all';
};

const handleUndoTopicRead = async () => {
  await store.undoLastTopicRead();
};

const handleUndoConversationRead = async () => {
  await store.undoLastConversationRead();
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

const clearDetailDeferredUndo = () => {
  detailDeferredUndo.value = null;
  if (detailDeferredUndoTimer !== null) {
    window.clearTimeout(detailDeferredUndoTimer);
    detailDeferredUndoTimer = null;
  }
};

const showDetailDeferredUndo = (
  undoState: NonNullable<typeof detailDeferredUndo.value>,
) => {
  clearDetailDeferredUndo();
  detailDeferredUndo.value = undoState;
  detailDeferredUndoTimer = window.setTimeout(clearDetailDeferredUndo, 10_000);
};

const clearDetailMuteUndo = () => {
  detailMuteUndo.value = null;
  if (detailMuteUndoTimer !== null) {
    window.clearTimeout(detailMuteUndoTimer);
    detailMuteUndoTimer = null;
  }
};

const showDetailMuteUndo = (
  undoState: NonNullable<typeof detailMuteUndo.value>,
) => {
  clearDetailMuteUndo();
  detailMuteUndo.value = undoState;
  detailMuteUndoTimer = window.setTimeout(clearDetailMuteUndo, 10_000);
};

const toggleDetailDeferMenu = () => {
  if (detailDeferMenuOpen.value) {
    detailDeferMenuOpen.value = false;
    return;
  }

  detailMuteMenuOpen.value = false;
  detailDeferOptions.value = getTopicDeferPresetOptions();
  detailDeferMenuOpen.value = true;
};

const toggleDetailMuteMenu = () => {
  if (detailMuteMenuOpen.value) {
    detailMuteMenuOpen.value = false;
    return;
  }

  detailDeferMenuOpen.value = false;
  detailMuteOptions.value = getTopicMutePresetOptions();
  detailMuteReasons.value = getTopicMuteReasonOptions();
  detailSelectedMuteReason.value = 'not-now';
  detailMuteMenuOpen.value = true;
};

const handleDeferTopicFromDetail = async (until?: number) => {
  if (!topicId.value) return;

  detailDeferMenuOpen.value = false;
  await store.deferTopicForLater(topicId.value, until);
  const deferredState = store.getTopicDeferredState(topicId.value) as {
    until: number;
  } | null;
  showDetailDeferredUndo({
    topicId: topicId.value,
    topicName: String(topicData.value?.name || topicId.value),
    until: deferredState?.until || Number(until) || Date.now(),
  });
};

const handleUndoDetailDefer = () => {
  const undoState = detailDeferredUndo.value;
  if (!undoState) return;

  store.restoreDeferredTopic(undoState.topicId);
  clearDetailDeferredUndo();
};

const handleRestoreDeferFromDetail = () => {
  if (!topicId.value) return;
  store.restoreDeferredTopic(topicId.value);
  if (detailDeferredUndo.value?.topicId === topicId.value) {
    clearDetailDeferredUndo();
  }
};

const handleMuteTopicFromDetail = async (
  until?: number | null,
  reason: TopicMuteReasonKey = detailSelectedMuteReason.value,
) => {
  if (!topicId.value) return;

  detailMuteMenuOpen.value = false;
  await store.muteTopic(topicId.value, until, reason);
  const mutedState = store.getTopicMutedState(topicId.value) as {
    until: number | null;
    reason?: TopicMuteReasonKey;
  } | null;
  showDetailMuteUndo({
    topicId: topicId.value,
    topicName: String(topicData.value?.name || topicId.value),
    until: mutedState?.until ?? null,
    reason: mutedState?.reason || reason,
  });
};

const handleRestoreMuteFromDetail = () => {
  if (!topicId.value) return;
  store.restoreMutedTopic(topicId.value);
  if (detailMuteUndo.value?.topicId === topicId.value) {
    clearDetailMuteUndo();
  }
};

const handleUndoDetailMute = () => {
  const undoState = detailMuteUndo.value;
  if (!undoState) return;

  store.restoreMutedTopic(undoState.topicId);
  clearDetailMuteUndo();
};

const doesConversationContextMatch = (conversation: any): boolean => {
  return topicConversationHasContextMatch(conversation, convSearchQuery.value);
};

const isConversationUnread = (conversation: any): boolean => {
  return isTopicConversationUnread(conversation);
};

const getConversationContextLabel = (conversation: any): string => {
  const contextCount = conversation?.contextMessages?.length || 0;
  const unreadCount = getTopicConversationUnreadMessageCount(conversation);
  const unreadSuffix = unreadCount > 0 ? ` · ${unreadCount} 未读` : '';
  return `🔍 查看上下文 (${contextCount} 条相关消息${unreadSuffix})`;
};

const isContextMessageUnread = (contextMessage: any): boolean => {
  return isTopicMessageExplicitlyUnread(contextMessage);
};

const formatConversationUndoLabel = (undoState: any): string => {
  const label =
    undoState?.conversationLabel || undoState?.conversationId || '这条讨论';
  const normalizedLabel = String(label).replace(/\s+/g, ' ').trim();
  return normalizedLabel.length > 36
    ? `${normalizedLabel.slice(0, 36)}...`
    : normalizedLabel;
};

const normalizeQueryValue = (value: unknown): string => {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
};

const doesTopicMessageMatchId = (message: any, messageId: string): boolean => {
  return topicMessageMatchesIdentity(message, messageId);
};

const getTopicMessageIdentityAttr = (message: any): string =>
  getTopicMessageIdentityValues(message).map(encodeURIComponent).join(' ');

const doesTopicMessageIdentityAttrMatch = (
  identityAttr: string | undefined,
  messageId: string,
): boolean => {
  const encodedMessageIds =
    getTopicMessageIdentityCandidates(messageId).map(encodeURIComponent);
  if (encodedMessageIds.length === 0) return false;
  const identityAttrSet = new Set(String(identityAttr || '').split(/\s+/));
  return encodedMessageIds.some((encodedMessageId) =>
    identityAttrSet.has(encodedMessageId),
  );
};

const isTargetedContextMessage = (message: any): boolean => {
  const messageId = highlightedMessageId.value;
  if (!messageId) return false;
  return doesTopicMessageMatchId(message, messageId);
};

const MESSAGE_FOCUS_ID_PARAM_KEYS = [
  'messageId',
  'message_id',
  'conversationId',
  'conversation_id',
  'sourceMessageId',
  'source_message_id',
  'externalMessageId',
  'external_message_id',
  'id',
  'msg',
  'ts',
  'thread_ts',
] as const;

const truncateMessageFocusIdentity = (value: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
};

const formatMessageFocusIdentity = (value: unknown): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '未知';

  try {
    const url = new URL(normalized);
    const safeHost = url.host || url.hostname || 'unknown-host';
    const matchedParam = MESSAGE_FOCUS_ID_PARAM_KEYS.map((key) => ({
      key,
      value: url.searchParams.get(key),
    })).find((entry) => entry.value);
    if (matchedParam?.value) {
      return truncateMessageFocusIdentity(
        `${safeHost}?${matchedParam.key}=${matchedParam.value}`,
      );
    }
    const pathTail =
      url.pathname
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .pop() || '';
    return truncateMessageFocusIdentity(
      pathTail ? `${safeHost}/.../${pathTail}` : safeHost,
    );
  } catch (_error) {
    return truncateMessageFocusIdentity(normalized);
  }
};

const getFocusedTargetMessage = (conversation: any, messageId: string): any => {
  if (doesTopicMessageMatchId(conversation, messageId)) {
    return conversation;
  }
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];
  return (
    contextMessages.find((contextMessage: any) =>
      doesTopicMessageMatchId(contextMessage, messageId),
    ) || conversation
  );
};

const getMessageFocusMatchBasisDetail = (
  messageId: string,
  targetMessage: any,
): string => {
  const requestCandidates = getTopicMessageIdentityCandidates(messageId);
  const targetCandidates = getTopicMessageIdentityValues(targetMessage);
  const requestSet = new Set(requestCandidates);
  const matchedTargetIdentity = targetCandidates.find((candidate) =>
    requestSet.has(candidate),
  );

  if (!matchedTargetIdentity) {
    return `定位请求：${formatMessageFocusIdentity(
      messageId,
    )}；命中当前目标，但没有可展示的稳定身份交集。`;
  }

  const normalizedRequest = String(messageId || '').trim();
  const usedAlias =
    matchedTargetIdentity !== normalizedRequest ||
    requestCandidates.length > 1 ||
    targetCandidates.length > 1;
  const aliasSuffix = usedAlias ? '（含 URL 参数、编码值或 Slack 别名归一化）' : '';
  return `定位请求：${formatMessageFocusIdentity(
    messageId,
  )}；命中依据：${formatMessageFocusIdentity(matchedTargetIdentity)}${aliasSuffix}。`;
};

const buildMessageFocusSuccessNotice = (
  targetLabel: string,
  didSyncReadState: boolean,
  messageId: string,
  targetMessage: any,
): MessageFocusNotice => ({
  type: 'info',
  title: '消息定位回执',
  targetLabel,
  summary: didSyncReadState
    ? `已定位到链接里的${targetLabel}，并同步为已读。`
    : `已定位到链接里的${targetLabel}；当前没有明确未读状态需要同步。`,
  details: [
    getMessageFocusMatchBasisDetail(messageId, targetMessage),
    '已临时切到聊天记录，并清空搜索、状态和群组筛选。',
    '定位会匹配 messageId、来源 permalink、URL 参数/路径别名和 Slack timestamp 口径。',
    '已展开父讨论并高亮链接目标；高亮约 6 秒后自动淡出，定位回执会保留到收起或打开新的深链。',
    didSyncReadState
      ? '已读同步走当前实体缓存路径，不代表原始聊天平台已被改写。'
      : '未改写已读计数，也不会影响原始聊天平台状态。',
  ],
  actions: didSyncReadState
    ? [
        {
          kind: 'undoMessageReadSync',
          label: '撤销这次已读',
        },
        {
          kind: 'dismissFocusNotice',
          label: '收起定位回执',
        },
      ]
    : [
        {
          kind: 'dismissFocusNotice',
          label: '收起定位回执',
        },
      ],
});

const buildMessageFocusMissingNotice = (): MessageFocusNotice => ({
  type: 'warning',
  title: '消息定位未完成',
  summary: '当前主题详情没有返回链接里的消息，已显示全部聊天记录。',
  details: [
    '可能是后端详情只返回了最近片段，或这个 messageId 来自未加载的历史消息。',
    '没有标记任何消息已读，也没有改写未读计数。',
    '需要跨全部记忆查找时，请使用后端搜索或回到原始来源链接。',
  ],
  actions: [
    {
      kind: 'showAllConversations',
      label: '查看全部聊天记录',
    },
  ],
});

const handleShowAllConversationsFromFocusReceipt = () => {
  activeTab.value = 'conversations';
  convFilter.value = 'all';
  convReadFilter.value = 'all';
  convSearchQuery.value = '';
};

const clearMessageFocusHighlight = () => {
  highlightedConversationId.value = null;
  highlightedMessageId.value = null;
};

const handleMessageFocusNoticeAction = async (
  actionKind: MessageFocusActionKind,
) => {
  if (actionKind === 'showAllConversations') {
    handleShowAllConversationsFromFocusReceipt();
    return;
  }
  if (actionKind === 'undoMessageReadSync') {
    await store.undoLastConversationRead();
    clearMessageFocusHighlight();
    messageFocusNotice.value = null;
    return;
  }
  if (actionKind === 'dismissFocusNotice') {
    clearMessageFocusHighlight();
    messageFocusNotice.value = null;
  }
};

const focusConversationFromQuery = async (messageIdValue: unknown) => {
  const messageId = normalizeQueryValue(messageIdValue);
  if (!messageId) {
    highlightedConversationId.value = null;
    highlightedMessageId.value = null;
    messageFocusNotice.value = null;
    return;
  }
  if (!topicId.value || !topicData.value) return;

  const targetConversation = findTopicConversationByMessageId(
    topicData.value,
    messageId,
  );
  const targetConversationId = getConversationFocusRenderId(targetConversation);
  if (!targetConversationId) {
    activeTab.value = 'conversations';
    convFilter.value = 'all';
    convReadFilter.value = 'all';
    convSearchQuery.value = '';
    highlightedConversationId.value = null;
    highlightedMessageId.value = null;
    messageFocusNotice.value = buildMessageFocusMissingNotice();
    return;
  }

  const isConversationTarget = doesTopicMessageMatchId(
    targetConversation,
    messageId,
  );
  const targetMessage = getFocusedTargetMessage(targetConversation, messageId);
  activeTab.value = 'conversations';
  convFilter.value = 'all';
  convReadFilter.value = 'all';
  convSearchQuery.value = '';

  expandedConversations.value = new Set([targetConversationId]);
  highlightedConversationId.value = targetConversationId;
  highlightedMessageId.value = messageId;
  const didSyncReadState = await store.markConversationAsRead(
    topicId.value,
    messageId,
  );
  const targetLabel = isConversationTarget ? '聊天记录' : '上下文消息';
  messageFocusNotice.value = buildMessageFocusSuccessNotice(
    targetLabel,
    didSyncReadState,
    messageId,
    targetMessage,
  );
  await nextTick();

  const targetElement = Array.from(
    document.querySelectorAll<HTMLElement>('[data-conversation-id]'),
  ).find((element) => element.dataset.conversationId === targetConversationId);
  const targetMessageElement = Array.from(
    document.querySelectorAll<HTMLElement>('[data-topic-message-ids]'),
  ).find((element) =>
    doesTopicMessageIdentityAttrMatch(
      element.dataset.topicMessageIds,
      messageId,
    ),
  );
  (targetMessageElement || targetElement)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  window.setTimeout(() => {
    if (highlightedConversationId.value === targetConversationId) {
      highlightedConversationId.value = null;
    }
    if (highlightedMessageId.value === messageId) {
      highlightedMessageId.value = null;
    }
  }, 6000);
};

const highlightText = (text: string, searchQuery: string) => {
  return renderHighlightedText(text, searchQuery);
};

const getConversationSourceUrl = (conversation: any): string => {
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  return getFirstSafeExternalUrl(
    conversation?.teamUrl,
    conversation?.sourceUrl,
    conversation?.permalink,
    conversation?.url,
    ...contextMessages.flatMap((contextMessage: any) => [
      contextMessage?.teamUrl,
      contextMessage?.sourceUrl,
      contextMessage?.permalink,
      contextMessage?.url,
    ]),
  );
};

type ConversationSourceOrigin = 'conversation' | 'context';

interface ConversationSourceCandidate {
  url: unknown;
  origin: ConversationSourceOrigin;
}

const getConversationSourceCandidates = (
  conversation: any,
): ConversationSourceCandidate[] => {
  const contextMessages = Array.isArray(conversation?.contextMessages)
    ? conversation.contextMessages
    : [];

  return [
    { url: conversation?.teamUrl, origin: 'conversation' },
    { url: conversation?.sourceUrl, origin: 'conversation' },
    { url: conversation?.permalink, origin: 'conversation' },
    { url: conversation?.url, origin: 'conversation' },
    ...contextMessages.flatMap((contextMessage: any) => [
      { url: contextMessage?.teamUrl, origin: 'context' as const },
      { url: contextMessage?.sourceUrl, origin: 'context' as const },
      { url: contextMessage?.permalink, origin: 'context' as const },
      { url: contextMessage?.url, origin: 'context' as const },
    ]),
  ];
};

const getConversationSourceLink = (conversation: any) =>
  getFirstSafeExternalLinkPresentation(
    getConversationSourceCandidates(conversation).map((candidate) => ({
      url: candidate.url,
      label: candidate.origin === 'context' ? '上下文来源' : '来源',
      titleLabel: candidate.origin === 'context' ? '上下文来源' : '原始来源',
    })),
    '来源',
    '原始来源',
  );

const getConversationSourceLabel = (conversation: any): string =>
  getConversationSourceLink(conversation)?.label || '来源';

const getConversationSourceTitle = (conversation: any): string =>
  getConversationSourceLink(conversation)?.title || '没有可信来源链接';

const getConversationSourceHost = (conversation: any): string =>
  getConversationSourceLink(conversation)?.host || '';

const clearSourceOpenReceiptTimer = () => {
  if (sourceOpenReceiptTimer) {
    window.clearTimeout(sourceOpenReceiptTimer);
    sourceOpenReceiptTimer = null;
  }
};

const handleSourceOpen = (
  link: SafeExternalLinkPresentation | null,
  sourceKind: string,
) => {
  if (!link) return;

  clearSourceOpenReceiptTimer();
  const host = link.host || '安全 http/https 来源';
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

const hasHiddenConversationSourceCandidates = (conversation: any): boolean =>
  getBlockedConversationSourceResults(conversation).length > 0;

const getBlockedConversationSourceResults = (
  conversation: any,
): ExternalUrlSafetyResult[] =>
  getBlockedExternalUrlResults(
    ...getConversationSourceCandidates(conversation).map(
      (candidate) => candidate.url,
    ),
  );

const getConversationHiddenSourceLabel = (conversation: any): string => {
  const blockedResults = getBlockedConversationSourceResults(conversation);
  return getHiddenExternalUrlLabel(blockedResults, '来源已隐藏');
};

const getConversationHiddenSourceTitle = (conversation: any): string => {
  const blockedResults = getBlockedConversationSourceResults(conversation);
  return getHiddenExternalUrlTitle(blockedResults, '来源链接');
};

const hasFilteredConversationSourceCandidates = (
  conversation: any,
): boolean =>
  Boolean(getConversationSourceLink(conversation)) &&
  getBlockedConversationSourceResults(conversation).length > 0;

const getConversationFilteredSourceLabel = (conversation: any): string =>
  getHiddenExternalUrlLabel(
    getBlockedConversationSourceResults(conversation),
    '候选已过滤',
  );

const getConversationFilteredSourceTitle = (conversation: any): string =>
  getHiddenExternalUrlTitle(
    getBlockedConversationSourceResults(conversation),
    '来源候选',
  );

const getSingleSourceCandidates = (
  url: unknown,
  label: string,
  titleLabel: string,
): ExternalLinkCandidate[] => [
  {
    url,
    label,
    titleLabel,
  },
];

const getResourceSourceLink = (resource: any) =>
  getFirstSafeExternalLinkPresentation(
    getSingleSourceCandidates(resource?.url, '查看资源', '资源'),
    '查看资源',
    '资源',
  );

const getBlockedResourceSourceResults = (
  resource: any,
): ExternalUrlSafetyResult[] => getBlockedExternalUrlResults(resource?.url);

const hasHiddenResourceSourceCandidates = (resource: any): boolean =>
  getBlockedResourceSourceResults(resource).length > 0;

const getResourceHiddenSourceLabel = (resource: any): string =>
  getHiddenExternalUrlLabel(
    getBlockedResourceSourceResults(resource),
    '来源已隐藏',
  );

const getResourceHiddenSourceTitle = (resource: any): string =>
  getHiddenExternalUrlTitle(
    getBlockedResourceSourceResults(resource),
    '资源链接',
  );

const hasFilteredResourceSourceCandidates = (resource: any): boolean =>
  Boolean(getResourceSourceLink(resource)) &&
  getBlockedResourceSourceResults(resource).length > 0;

const getResourceFilteredSourceLabel = (resource: any): string =>
  getHiddenExternalUrlLabel(
    getBlockedResourceSourceResults(resource),
    '候选已过滤',
  );

const getResourceFilteredSourceTitle = (resource: any): string =>
  getHiddenExternalUrlTitle(
    getBlockedResourceSourceResults(resource),
    '资源候选',
  );

const getWebpageSourceLink = (webpage: any) =>
  getFirstSafeExternalLinkPresentation(
    getSingleSourceCandidates(webpage?.url, '打开来源', '网页来源'),
    '打开来源',
    '网页来源',
  );

const getBlockedWebpageSourceResults = (
  webpage: any,
): ExternalUrlSafetyResult[] => getBlockedExternalUrlResults(webpage?.url);

const hasHiddenWebpageSourceCandidates = (webpage: any): boolean =>
  getBlockedWebpageSourceResults(webpage).length > 0;

const getWebpageHiddenSourceLabel = (webpage: any): string =>
  getHiddenExternalUrlLabel(
    getBlockedWebpageSourceResults(webpage),
    '来源已隐藏',
  );

const getWebpageHiddenSourceTitle = (webpage: any): string =>
  getHiddenExternalUrlTitle(
    getBlockedWebpageSourceResults(webpage),
    '网页来源链接',
  );

const hasFilteredWebpageSourceCandidates = (webpage: any): boolean =>
  Boolean(getWebpageSourceLink(webpage)) &&
  getBlockedWebpageSourceResults(webpage).length > 0;

const getWebpageFilteredSourceLabel = (webpage: any): string =>
  getHiddenExternalUrlLabel(
    getBlockedWebpageSourceResults(webpage),
    '候选已过滤',
  );

const getWebpageFilteredSourceTitle = (webpage: any): string =>
  getHiddenExternalUrlTitle(
    getBlockedWebpageSourceResults(webpage),
    '网页来源候选',
  );

const getWebpageSourceDisplayText = (webpage: any): string => {
  const safety = getExternalUrlSafety(webpage?.url);
  if (safety.safeUrl) return safety.safeUrl;
  if (safety.blocked) return getWebpageHiddenSourceLabel(webpage);
  return '暂无来源链接';
};

const getWebpageSourceDisplayTitle = (webpage: any): string => {
  const safety = getExternalUrlSafety(webpage?.url);
  if (safety.safeUrl) {
    return safety.hostname ? `网页来源：${safety.hostname}` : '网页来源';
  }
  if (safety.blocked) return getWebpageHiddenSourceTitle(webpage);
  return '暂无可信来源链接';
};

const getWebpageIcon = (type: string) => {
  const icons = {
    jira: '🎯',
    confluence: '📝',
    github: '🐙',
    docs: '📄',
    blog: '📰',
  };
  return icons[type] || '🌐';
};

const getPriorityStyle = (priority: string) => {
  const styles = {
    高: { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
    中: { background: 'rgba(251, 191, 36, 0.2)', color: '#f59e0b' },
    低: { background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  };
  return styles[priority] || styles['中'];
};

/**
 * 格式化时间为相对时间
 */
const formatTimeAgo = (timestamp: unknown): string => {
  return formatTopicRelativeTime(timestamp);
};

const getTopicLastUpdatedLabel = (topic: any): string => {
  return (
    formatTimeAgo(
      topic?.readStatus?.lastUpdateTime ?? topic?.updated ?? topic?.cachedAt,
    ) || '未知时间'
  );
};

watch(
  topicId,
  async (newId) => {
    if (newId) {
      clearStickyUnreadConversations();
      if (!normalizeQueryValue(route.query.messageId)) {
        convReadFilter.value = normalizeReadFilterValue(
          route.query.readFilter,
        );
      }
      await store.loadTopicDetail(newId);
      await focusConversationFromQuery(route.query.messageId);
    }
  },
  { immediate: true },
);

watch(
  () => route.query.messageId,
  (messageId) => {
    focusConversationFromQuery(messageId);
  },
);

watch(
  () => route.query.readFilter,
  (readFilter) => {
    if (normalizeQueryValue(route.query.messageId)) return;
    convReadFilter.value = normalizeReadFilterValue(readFilter);
  },
);

watch(convReadFilter, (readFilter) => {
  if (readFilter !== 'unread') {
    clearStickyUnreadConversations();
  }
});

onBeforeUnmount(() => {
  clearDetailDeferredUndo();
  clearDetailMuteUndo();
  clearSourceOpenReceiptTimer();
});
</script>

<style scoped>
.topic-undo-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1rem;
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

.conversation-undo-toast {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(245, 158, 11, 0.1);
  color: #fde68a;
}

.topic-defer-undo-toast {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(245, 158, 11, 0.1);
  color: #fde68a;
}

.topic-mute-undo-toast {
  border-color: rgba(148, 163, 184, 0.3);
  background: rgba(51, 65, 85, 0.42);
  color: #cbd5e1;
}

.topic-detail-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.topic-detail-defer-menu {
  position: relative;
}

.topic-detail-action-note {
  flex-basis: 100%;
  max-width: 38rem;
  color: #cbd5e1;
  font-size: 0.76rem;
  line-height: 1.4;
}

.topic-detail-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.25rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(245, 158, 11, 0.32);
  border-radius: 0.5rem;
  background: rgba(245, 158, 11, 0.1);
  color: #fde68a;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.2;
}

.topic-detail-action-btn.mute,
.topic-detail-mute-restore,
.topic-detail-defer-restore {
  border-color: rgba(148, 163, 184, 0.32);
  background: rgba(51, 65, 85, 0.36);
  color: #cbd5e1;
}

.topic-detail-action-btn:hover,
.topic-detail-action-btn:focus-visible {
  outline: none;
  background: rgba(245, 158, 11, 0.18);
  border-color: rgba(245, 158, 11, 0.48);
}

.topic-detail-defer-options {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.4rem);
  left: 0;
  display: grid;
  gap: 0.35rem;
  width: min(18rem, 78vw);
  padding: 0.55rem;
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.96);
  box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.22);
}

.topic-detail-boundary-receipt {
  display: grid;
  gap: 0.25rem;
  padding: 0.55rem 0.6rem;
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.66);
  color: #cbd5e1;
  font-size: 0.75rem;
  line-height: 1.35;
}

.topic-detail-boundary-receipt strong {
  color: #bfdbfe;
  font-size: 0.76rem;
}

.source-open-receipt {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.5rem;
  background: rgba(37, 99, 235, 0.12);
  color: #bfdbfe;
  font-size: 0.875rem;
  line-height: 1.45;
}

.source-open-receipt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
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
  margin: 0.5rem 0 0;
  padding-left: 1.05rem;
}

.source-open-receipt li + li {
  margin-top: 0.2rem;
}

.topic-detail-mute-boundary {
  border-color: rgba(148, 163, 184, 0.28);
}

.topic-detail-mute-boundary strong {
  color: #e2e8f0;
}

.topic-detail-defer-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.25rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 0.4rem;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.82rem;
  text-align: left;
}

.topic-detail-defer-option small {
  flex: 0 0 auto;
  color: #fbbf24;
  font-size: 0.75rem;
}

.topic-detail-defer-option:hover,
.topic-detail-defer-option:focus-visible {
  outline: none;
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.12);
}

.topic-detail-mute-options {
  width: min(21rem, 82vw);
  border-color: rgba(148, 163, 184, 0.28);
}

.topic-detail-mute-reasons {
  display: grid;
  gap: 0.4rem;
  padding-bottom: 0.4rem;
}

.topic-detail-menu-label {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 700;
}

.topic-detail-mute-reason-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
}

.topic-detail-mute-reason-option {
  display: grid;
  gap: 0.15rem;
  min-height: 3.4rem;
  padding: 0.45rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.4rem;
  background: rgba(15, 23, 42, 0.34);
  color: #dbeafe;
  cursor: pointer;
  text-align: left;
}

.topic-detail-mute-reason-option span {
  font-size: 0.78rem;
  font-weight: 700;
}

.topic-detail-mute-reason-option small {
  color: #94a3b8;
  font-size: 0.68rem;
  line-height: 1.25;
}

.topic-detail-mute-reason-option:hover,
.topic-detail-mute-reason-option:focus-visible {
  outline: none;
  border-color: rgba(148, 163, 184, 0.38);
  background: rgba(51, 65, 85, 0.46);
}

.topic-detail-mute-reason-option.active {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(37, 99, 235, 0.18);
}

.conversation-section-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.conversation-read-summary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.read-summary-pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0.18rem 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.42);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

.read-summary-pill.unread {
  border-color: rgba(248, 113, 113, 0.3);
  color: #fecaca;
  background: rgba(127, 29, 29, 0.18);
}

.read-filter-select {
  min-width: 7.5rem;
}

.conversation-side-actions {
  display: grid;
  justify-items: end;
  gap: 0.25rem;
  margin-left: 1rem;
}

.conversation-source-link {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  max-width: min(18rem, 48vw);
  color: #93c5fd;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
  text-align: right;
}

.conversation-source-link:hover,
.conversation-source-link:focus-visible {
  color: #bfdbfe;
  text-decoration: underline;
}

.conversation-source-label,
.conversation-source-host {
  overflow-wrap: anywhere;
}

.conversation-source-host {
  padding: 0.08rem 0.3rem;
  border: 1px solid rgba(147, 197, 253, 0.22);
  border-radius: 999px;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.52);
  font-size: 0.68rem;
  line-height: 1.1;
}

.conversation-source-hidden {
  padding: 0.1rem 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 999px;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.44);
  cursor: help;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.1;
  max-width: min(14rem, 42vw);
  text-align: right;
  white-space: normal;
}

.conversation-source-filtered,
.topic-source-filtered {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: min(14rem, 42vw);
  padding: 0.1rem 0.35rem;
  border: 1px solid rgba(251, 191, 36, 0.24);
  border-radius: 999px;
  color: #fcd34d;
  background: rgba(120, 53, 15, 0.24);
  cursor: help;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
  white-space: normal;
}

.topic-source-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  max-width: 100%;
}

.topic-source-host {
  padding: 0.08rem 0.3rem;
  border: 1px solid rgba(147, 197, 253, 0.22);
  border-radius: 999px;
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.52);
  font-size: 0.68rem;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.topic-source-hidden {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  padding: 0.1rem 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 999px;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.44);
  cursor: help;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
  white-space: normal;
}

.webpage-url.hidden {
  color: #94a3b8;
}

.webpage-source-hidden {
  margin-top: 0.35rem;
}

.webpage-source-filtered {
  margin-top: 0.35rem;
}

.item-link,
.webpage-open-link {
  color: #60a5fa;
  font-weight: 700;
  text-decoration: none;
}

.item-link:hover,
.item-link:focus-visible,
.webpage-open-link:hover,
.webpage-open-link:focus-visible {
  color: #bfdbfe;
  text-decoration: underline;
}

.item-muted {
  color: #64748b;
}

.context-indicator {
  display: block;
  width: 100%;
  color: inherit;
  font: inherit;
  text-align: left;
}

/* 全部已阅按钮 */
.mark-all-read-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 0.5rem;
  color: #22c55e;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.mark-all-read-btn:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
}

.mark-all-read-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.mark-all-read-btn:disabled:hover {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}

.unread-meta {
  color: #f87171;
  font-weight: 600;
}

.muted-meta {
  color: #cbd5e1;
  font-weight: 600;
}

.deferred-meta {
  color: #fbbf24;
  font-weight: 600;
}

/* 未读指示器 */
.unread-indicator {
  color: #ef4444;
  font-size: 0.5rem;
  margin-left: 0.25rem;
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* 未读消息样式 */
.conversation-item.unread {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.03);
}

.conversation-item.unread .sender-name {
  color: #60a5fa;
  font-weight: 600;
}

.context-item.unread {
  border-left: 2px solid rgba(248, 113, 113, 0.55);
  padding-left: 0.75rem;
}

.context-item.targeted {
  border-left: 3px solid rgba(96, 165, 250, 0.82);
  padding-left: 0.75rem;
  background: rgba(37, 99, 235, 0.12);
  border-radius: 0.375rem;
}

.context-match-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
  padding: 0.08rem 0.35rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 999px;
  color: #93c5fd;
  background: rgba(37, 99, 235, 0.12);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
  vertical-align: middle;
}

.targeted-message-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.45rem;
  padding: 0.08rem 0.35rem;
  border: 1px solid rgba(96, 165, 250, 0.32);
  border-radius: 999px;
  color: #bfdbfe;
  background: rgba(37, 99, 235, 0.16);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
  vertical-align: middle;
}

.conversation-item.targeted {
  outline: 2px solid rgba(96, 165, 250, 0.75);
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.12);
}

.message-focus-notice {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.45;
}

.message-focus-notice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.message-focus-notice p {
  margin: 0;
}

.message-focus-notice ul {
  margin: 0.5rem 0 0;
  padding-left: 1.05rem;
}

.message-focus-notice li + li {
  margin-top: 0.2rem;
}

.message-focus-target-chip {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 0.12rem 0.42rem;
  border-radius: 999px;
  border: 1px solid rgba(147, 197, 253, 0.28);
  color: #dbeafe;
  background: rgba(30, 41, 59, 0.52);
  font-size: 0.72rem;
  font-weight: 700;
}

.message-focus-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.message-focus-action {
  margin-top: 0.75rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid rgba(245, 158, 11, 0.34);
  border-radius: 0.45rem;
  background: rgba(245, 158, 11, 0.12);
  color: #fde68a;
  font-weight: 700;
  cursor: pointer;
}

.message-focus-actions .message-focus-action {
  margin-top: 0;
}

.message-focus-action.undo {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(37, 99, 235, 0.16);
  color: #bfdbfe;
}

.message-focus-action:hover {
  background: rgba(245, 158, 11, 0.2);
}

.message-focus-action.undo:hover {
  background: rgba(37, 99, 235, 0.26);
}

.message-focus-notice.info {
  color: #bfdbfe;
  border: 1px solid rgba(96, 165, 250, 0.28);
  background: rgba(37, 99, 235, 0.12);
}

.message-focus-notice.warning {
  color: #fde68a;
  border: 1px solid rgba(245, 158, 11, 0.32);
  background: rgba(245, 158, 11, 0.1);
}

.topic-read-batch-receipt {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(20, 184, 166, 0.28);
  border-radius: 0.5rem;
  background: rgba(13, 148, 136, 0.1);
  color: #ccfbf1;
  font-size: 0.85rem;
  line-height: 1.45;
}

.topic-read-batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.topic-read-batch-mode {
  display: inline-flex;
  flex: 0 0 auto;
  max-width: min(14rem, 50vw);
  padding: 0.12rem 0.42rem;
  border: 1px solid rgba(94, 234, 212, 0.28);
  border-radius: 999px;
  color: #f0fdfa;
  background: rgba(15, 23, 42, 0.42);
  font-size: 0.72rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.topic-read-batch-receipt p {
  margin: 0;
}

.topic-read-batch-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.55rem;
}

.topic-read-batch-metrics span {
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  padding: 0.16rem 0.48rem;
  border: 1px solid rgba(94, 234, 212, 0.24);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.3);
  color: #ecfeff;
  font-size: 0.72rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.topic-read-batch-receipt ul {
  margin: 0.5rem 0 0;
  padding-left: 1.05rem;
}

.topic-read-batch-receipt li + li {
  margin-top: 0.2rem;
}

.empty-state {
  padding: 1.5rem;
  color: #94a3b8;
  text-align: center;
  border: 1px dashed rgba(148, 163, 184, 0.25);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.24);
}

.conversation-empty-recovery {
  max-width: 42rem;
  margin: 1rem auto 0;
  padding: 0.85rem 1rem;
  color: #dbeafe;
  text-align: left;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.5rem;
  background: rgba(30, 64, 175, 0.16);
}

.conversation-empty-recovery-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.conversation-empty-recovery-head span {
  flex: 0 0 auto;
  padding: 0.12rem 0.42rem;
  border: 1px solid rgba(147, 197, 253, 0.28);
  border-radius: 999px;
  color: #eff6ff;
  background: rgba(15, 23, 42, 0.4);
  font-size: 0.72rem;
  font-weight: 700;
}

.conversation-empty-recovery p {
  margin: 0;
  line-height: 1.45;
}

.conversation-empty-recovery ul {
  margin: 0.5rem 0 0;
  padding-left: 1.05rem;
  line-height: 1.45;
}

.conversation-empty-recovery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.conversation-empty-recovery-actions button {
  padding: 0.38rem 0.62rem;
  border: 1px solid rgba(147, 197, 253, 0.34);
  border-radius: 0.45rem;
  color: #eff6ff;
  background: rgba(37, 99, 235, 0.18);
  font-weight: 700;
  cursor: pointer;
}

.conversation-empty-recovery-actions button:hover,
.conversation-empty-recovery-actions button:focus-visible {
  background: rgba(37, 99, 235, 0.3);
}

@media (max-width: 640px) {
  .conversation-empty-recovery-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .conversation-empty-recovery-actions button {
    flex: 1 1 11rem;
  }
}
</style>
