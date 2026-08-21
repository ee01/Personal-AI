<template>
  <div class="outreach-page">
    <div class="page-header">
      <div>
        <h2>主动询问</h2>
        <p>
          查看待触发计划、已排程待发出、等待回复和已完成的主动询问。系统内部观察规则采集到的证据会在这里按会话展示。
        </p>
      </div>

      <div class="summary-row">
        <span class="summary-pill"
          >待触发计划 {{ visibleTemplates.length }}</span
        >
        <span class="summary-pill"
          >已排程待发出 {{ queuedSessions.length }}</span
        >
        <span class="summary-pill"
          >等待回复 {{ summary.waitingReplyCount }}</span
        >
        <span class="summary-pill danger"
          >已升级 {{ summary.escalatedCount }}</span
        >
        <span class="summary-pill warn"
          >待审批 {{ summary.pendingApprovalCount }}</span
        >
      </div>
    </div>

    <div v-if="showSetupBanner" class="setup-banner">
      <div>
        <div class="setup-title">{{ setupBannerTitle }}</div>
        <p class="setup-text">{{ setupBannerText }}</p>
      </div>
      <button
        class="setup-btn"
        :title="setupConfigButtonBoundary()"
        :aria-label="setupConfigButtonAriaLabel()"
        @click="openOptionsPage"
      >
        前往主动询问配置
      </button>
    </div>

    <div class="info-banner">
      <div class="info-banner-title">系统观察规则不会进入记忆入口规则列表</div>
      <p class="info-banner-text">
        帮我问 / 自我反思等内部观察命中会在主动询问 session
        中展示为证据状态，而不会写成用户可编辑的记忆入口规则。
      </p>
    </div>

    <div
      v-if="!loading"
      class="triage-banner"
      :class="pageTriageReceipt.tone"
      role="status"
    >
      <div class="triage-copy">
        <div class="triage-title">{{ pageTriageReceipt.title }}</div>
        <ul>
          <li v-for="item in pageTriageReceipt.items" :key="item">
            {{ item }}
          </li>
        </ul>
      </div>
      <div class="triage-stats" aria-label="主动询问当前筛选计数">
        <span>待审批 {{ approvalSessions.length }}</span>
        <span>可重试 {{ retriableSessions.length }}</span>
        <span>等待/延期 {{ waitingSessions.length }}</span>
        <span>已排程 {{ queuedSessions.length }}</span>
        <span>待触发计划 {{ visibleTemplates.length }}</span>
      </div>
    </div>

    <div
      v-if="!loading && focusLane"
      class="focus-lane"
      :class="focusLane.tone"
      role="status"
      aria-label="主动询问本轮处理对象"
    >
      <div class="focus-copy">
        <div class="focus-eyebrow">{{ focusLane.eyebrow }}</div>
        <div class="focus-title">{{ focusLane.title }}</div>
        <h3>{{ focusLane.subject }}</h3>
        <p>{{ focusLane.context }}</p>
        <div class="focus-meta" aria-label="本轮处理对象元信息">
          <span v-for="item in focusLane.meta" :key="item">{{ item }}</span>
        </div>
      </div>
      <div class="focus-action-panel">
        <router-link
          v-if="focusLane.route"
          :to="focusLane.route"
          class="focus-action"
          :title="focusActionBoundary(focusLane)"
          :aria-label="focusActionAriaLabel(focusLane)"
        >
          {{ focusLane.actionLabel }}
        </router-link>
        <div class="focus-boundary-title">处理边界</div>
        <ul>
          <li v-for="item in focusLane.items" :key="item">{{ item }}</li>
        </ul>
      </div>
    </div>

    <div class="filters">
      <select v-model="status" class="filter-select" @change="applyFilters">
        <option value="all">全部状态</option>
        <option value="pending_approval">待审批</option>
        <option value="scheduled">已排程</option>
        <option value="waiting_reply">等待回复</option>
        <option value="deferred">延期等待</option>
        <option value="resolved">已拿到结果</option>
        <option value="no_reply">无回复</option>
        <option value="escalated">已升级</option>
        <option value="cancelled">已取消</option>
        <option value="failed">失败</option>
      </select>
      <select v-model="originKind" class="filter-select" @change="applyFilters">
        <option value="">全部来源</option>
        <option value="manual">手动/定时</option>
        <option value="message_reaction">消息跟进</option>
        <option value="reflection">自我反思</option>
      </select>
      <input
        v-model="templateId"
        class="filter-input"
        placeholder="计划 ID"
        @keydown.enter="applyFilters"
      />
      <input
        v-model="threadId"
        class="filter-input"
        placeholder="threadId"
        @keydown.enter="applyFilters"
      />
      <button
        class="refresh-btn"
        :title="listRefreshButtonBoundary()"
        :aria-label="listRefreshButtonAriaLabel()"
        @click="loadData"
      >
        刷新
      </button>
    </div>

    <div
      class="handoff-receipt filter-scope-receipt"
      :class="filterScopeReceipt.tone"
      role="status"
      aria-label="主动询问筛选范围回执"
    >
      <div class="handoff-title">{{ filterScopeReceipt.title }}</div>
      <ul>
        <li v-for="item in filterScopeReceipt.items" :key="item">
          {{ item }}
        </li>
      </ul>
    </div>

    <div v-if="loadError && !loading" class="load-error-banner" role="alert">
      <div>
        <div class="load-error-title">主动询问数据加载失败</div>
        <p class="load-error-text">{{ loadError }}</p>
        <p v-if="hasLoadedData" class="load-error-text muted">
          当前继续展示上次成功加载的数据，避免把服务错误误看成暂无会话。
        </p>
        <p v-else class="load-error-text muted">
          暂时没有可展示的历史数据，请检查 Memory Service 后重试。
        </p>
      </div>
      <button class="retry-btn" @click="loadData">重试加载</button>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载主动询问会话中...</p>
    </div>

    <div
      v-else-if="
        loadError && sessions.length === 0 && visibleTemplates.length === 0
      "
      class="empty-state error-empty"
    >
      <p>暂时无法加载主动询问数据。</p>
    </div>

    <div
      v-else-if="sessions.length === 0 && visibleTemplates.length === 0"
      class="empty-state"
    >
      <div
        v-if="hasActiveFilters"
        class="filtered-empty-receipt"
        role="status"
        aria-label="主动询问筛选空结果回执"
      >
        <div class="handoff-title">筛选空结果回执</div>
        <p>{{ filteredEmptyReceipt.summary }}</p>
        <ul>
          <li v-for="item in filteredEmptyReceipt.items" :key="item">
            {{ item }}
          </li>
        </ul>
        <button
          class="clear-filter-btn"
          :title="clearFiltersButtonBoundary()"
          :aria-label="clearFiltersButtonAriaLabel()"
          @click="clearFilters"
        >
          清除筛选
        </button>
      </div>
      <p v-else>暂无主动询问会话。</p>
    </div>

    <div v-else>
      <section v-if="visibleTemplates.length > 0" class="group-section">
        <div class="group-head">
          <h3>待触发计划</h3>
          <span class="group-count">{{ visibleTemplates.length }}</span>
        </div>
        <p class="group-desc">
          这些是未来会触发的主动询问计划；循环计划会保留在这里，已发出的每次询问会单独进入历史记录。
        </p>

        <div class="session-list">
          <div
            v-for="item in visibleTemplates"
            :key="item.template.id"
            class="session-card template-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="templateListRoute(item)"
                    class="title-link"
                    :title="templateListLinkBoundary(item)"
                    :aria-label="templateListLinkAriaLabel(item)"
                  >
                    {{
                      item.template.questionTemplate ||
                      item.template.title ||
                      '(空问题)'
                    }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{
                    item.template.contextTemplate || '计划已同步，等待触发。'
                  }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge queued">待触发计划</span>
                <span class="badge muted">{{
                  templateSyncStateLabel(item.template.syncState)
                }}</span>
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ templateStageHint(item) }}
            </div>

            <div
              class="handoff-receipt"
              :class="templateHandoffReceipt(item).tone"
            >
              <div class="handoff-title">
                {{ templateHandoffReceipt(item).title }}
              </div>
              <ul>
                <li
                  v-for="line in templateHandoffReceipt(item).items"
                  :key="line"
                >
                  {{ line }}
                </li>
              </ul>
            </div>

            <div class="card-meta">
              <span
                >将发送给
                {{
                  formatTarget(
                    item.template.targetType,
                    item.template.targetRef,
                  )
                }}</span
              >
              <span
                >目标类型 {{ targetTypeLabel(item.template.targetType) }}</span
              >
              <span>目标状态 {{ templateTargetResolutionLabel(item) }}</span>
              <span v-if="resolveTemplateNextDispatchAt(item)"
                >计划发送
                {{ relativeTime(resolveTemplateNextDispatchAt(item)!) }}</span
              >
              <span v-else>计划时间未解析</span>
              <span v-if="item.latestSession"
                >上次执行
                {{
                  relativeTime(
                    item.latestSession.updatedAt ||
                      item.latestSession.createdAt,
                  )
                }}</span
              >
              <span
                >同步状态
                {{ templateSyncStateLabel(item.template.syncState) }}</span
              >
              <router-link
                v-if="item.latestSession?.id"
                :to="`/outreach/${item.latestSession.id}`"
                class="session-link"
                :title="latestSessionLinkBoundary(item)"
                :aria-label="latestSessionLinkAriaLabel(item)"
                >查看上次执行</router-link
              >
            </div>
          </div>
        </div>
      </section>

      <section v-if="approvalSessions.length > 0" class="group-section">
        <div class="group-head">
          <h3>待审批</h3>
          <span class="group-count">{{ approvalSessions.length }}</span>
        </div>
        <p class="group-desc">
          这些询问已经找到了目标对象，但还没有正式发出。点标题或详情可修改目标对象与计划发送时间。
        </p>
        <div class="session-list">
          <div
            v-for="session in approvalSessions"
            :key="session.id"
            class="session-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="`/outreach/${session.id}`"
                    class="title-link"
                    :title="sessionDetailLinkBoundary(session, '打开待审批详情')"
                    :aria-label="sessionDetailLinkAriaLabel(session, '打开待审批详情')"
                  >
                    {{ session.renderedQuestion || '(空问题)' }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{ session.renderedContext || '无信息目标' }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge" :class="statusClass(session.status)">{{
                  statusLabel(session.status)
                }}</span>
                <span class="badge muted">{{
                  originLabel(session.originKind)
                }}</span>
                <span
                  v-if="evidenceSnapshot(session).stateLabel"
                  class="badge evidence"
                  >{{ evidenceSnapshot(session).stateLabel }}</span
                >
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ sessionStageHint(session) }}
            </div>

            <div
              class="handoff-receipt"
              :class="sessionHandoffReceipt(session).tone"
            >
              <div class="handoff-title">
                {{ sessionHandoffReceipt(session).title }}
              </div>
              <ul>
                <li
                  v-for="item in sessionHandoffReceipt(session).items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="evidenceSnapshot(session).hasEvidence"
              class="evidence-box"
            >
              <div class="evidence-head">
                <span class="evidence-title">证据状态</span>
                <span
                  v-if="evidenceSnapshot(session).phaseLabel"
                  class="evidence-pill"
                  >{{ evidenceSnapshot(session).phaseLabel }}</span
                >
                <span
                  v-if="evidenceSnapshot(session).source"
                  class="evidence-pill muted"
                  >{{ evidenceSnapshot(session).source }}</span
                >
              </div>
              <p
                v-if="evidenceSnapshot(session).summary"
                class="evidence-summary"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).summary"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
              <p
                v-if="
                  evidenceSnapshot(session).relatedMessage &&
                  evidenceSnapshot(session).relatedMessage !==
                    evidenceSnapshot(session).summary
                "
                class="evidence-related"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).relatedMessage"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
            </div>

            <div
              v-if="approvalListReviewReceipt(session)"
              class="handoff-receipt warn pre-approval-review"
              role="status"
              aria-label="主动询问列表发送前复核"
            >
              <div class="handoff-title">
                {{ approvalListReviewReceipt(session)?.title }}
              </div>
              <ul>
                <li
                  v-for="item in approvalListReviewReceipt(session)?.items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="listOperationReceipt(session.id)"
              class="handoff-receipt list-operation-receipt"
              :class="listOperationReceipt(session.id)?.tone"
              role="status"
              aria-label="主动询问列表操作回执"
            >
              <div class="handoff-title">
                {{ listOperationReceipt(session.id)?.title }}
              </div>
              <ul>
                <li
                  v-for="item in listOperationReceipt(session.id)?.items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div class="card-meta">
              <span
                >将发送给
                {{ formatTarget(session.targetType, session.targetRef) }}</span
              >
              <span>目标类型 {{ targetTypeLabel(session.targetType) }}</span>
              <span>目标状态 {{ sessionTargetResolutionLabel(session) }}</span>
              <span>创建于 {{ relativeTime(session.createdAt) }}</span>
              <span
                >追问 {{ session.followupCount }}/{{
                  session.maxFollowup
                }}</span
              >
              <router-link
                v-if="session.threadId"
                :to="`/reflection-threads/${session.threadId}`"
                class="session-link"
                :title="threadLinkBoundary(session)"
                :aria-label="threadLinkAriaLabel(session)"
                >查看线程</router-link
              >
              <a
                v-if="messageReactionSourceUrl(session)"
                :href="messageReactionSourceUrl(session)"
                class="session-link"
                target="_blank"
                rel="noopener noreferrer"
                :title="sourceMessageLinkBoundary(session)"
                :aria-label="sourceMessageLinkAriaLabel(session)"
                >打开原消息</a
              >
              <router-link
                :to="`/outreach/${session.id}`"
                class="session-link"
                :title="sessionDetailLinkBoundary(session, '查看详情')"
                :aria-label="sessionDetailLinkAriaLabel(session, '查看详情')"
                >查看详情</router-link
              >
            </div>

            <div class="card-actions">
              <button
                class="inline-btn primary"
                :disabled="
                  Boolean(busyById[session.id]) ||
                  !canApproveSession(session) ||
                  shouldForceDetailReviewBeforeApprove(session)
                "
                :title="approveButtonTitle(session)"
                :aria-label="approveButtonAriaLabel(session)"
                @click="approveSession(session.id)"
              >
                {{ approveButtonLabel(session) }}
              </button>
              <button
                class="inline-btn ghost"
                :disabled="Boolean(busyById[session.id])"
                :title="listActionButtonTitle('cancel', session)"
                :aria-label="listActionButtonAriaLabel('cancel', session)"
                @click="cancelSession(session.id)"
              >
                取消
              </button>
              <router-link
                :to="`/outreach/${session.id}`"
                class="inline-link"
                :title="
                  sessionDetailLinkBoundary(
                    session,
                    shouldForceDetailReviewBeforeApprove(session)
                      ? '进入详情复核'
                      : '进入详情编辑',
                  )
                "
                :aria-label="
                  sessionDetailLinkAriaLabel(
                    session,
                    shouldForceDetailReviewBeforeApprove(session)
                      ? '进入详情复核'
                      : '进入详情编辑',
                  )
                "
                >{{
                  shouldForceDetailReviewBeforeApprove(session)
                    ? '进入详情复核'
                    : '进入详情编辑'
                }}</router-link
              >
            </div>
          </div>
        </div>
      </section>

      <section v-if="queuedSessions.length > 0" class="group-section">
        <div class="group-head">
          <h3>已排程待发出</h3>
          <span class="group-count">{{ queuedSessions.length }}</span>
        </div>
        <p class="group-desc">
          这些会话已完成审批或无需审批，但还没有真正发出询问。
        </p>
        <div class="session-list">
          <div
            v-for="session in queuedSessions"
            :key="session.id"
            class="session-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="`/outreach/${session.id}`"
                    class="title-link"
                    :title="sessionDetailLinkBoundary(session, '打开已排程详情')"
                    :aria-label="sessionDetailLinkAriaLabel(session, '打开已排程详情')"
                  >
                    {{ session.renderedQuestion || '(空问题)' }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{ session.renderedContext || '无信息目标' }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge" :class="statusClass(session.status)">{{
                  statusLabel(session.status)
                }}</span>
                <span class="badge muted">{{
                  originLabel(session.originKind)
                }}</span>
                <span
                  v-if="evidenceSnapshot(session).stateLabel"
                  class="badge evidence"
                  >{{ evidenceSnapshot(session).stateLabel }}</span
                >
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ sessionStageHint(session) }}
            </div>

            <div
              class="handoff-receipt"
              :class="sessionHandoffReceipt(session).tone"
            >
              <div class="handoff-title">
                {{ sessionHandoffReceipt(session).title }}
              </div>
              <ul>
                <li
                  v-for="item in sessionHandoffReceipt(session).items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="evidenceSnapshot(session).hasEvidence"
              class="evidence-box"
            >
              <div class="evidence-head">
                <span class="evidence-title">证据状态</span>
                <span
                  v-if="evidenceSnapshot(session).phaseLabel"
                  class="evidence-pill"
                  >{{ evidenceSnapshot(session).phaseLabel }}</span
                >
                <span
                  v-if="evidenceSnapshot(session).source"
                  class="evidence-pill muted"
                  >{{ evidenceSnapshot(session).source }}</span
                >
              </div>
              <p
                v-if="evidenceSnapshot(session).summary"
                class="evidence-summary"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).summary"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
              <p
                v-if="
                  evidenceSnapshot(session).relatedMessage &&
                  evidenceSnapshot(session).relatedMessage !==
                    evidenceSnapshot(session).summary
                "
                class="evidence-related"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).relatedMessage"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
            </div>

            <div
              v-if="listOperationReceipt(session.id)"
              class="handoff-receipt list-operation-receipt"
              :class="listOperationReceipt(session.id)?.tone"
              role="status"
              aria-label="主动询问列表操作回执"
            >
              <div class="handoff-title">
                {{ listOperationReceipt(session.id)?.title }}
              </div>
              <ul>
                <li
                  v-for="item in listOperationReceipt(session.id)?.items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div class="card-meta">
              <span
                >将发送给
                {{ formatTarget(session.targetType, session.targetRef) }}</span
              >
              <span>目标类型 {{ targetTypeLabel(session.targetType) }}</span>
              <span>目标状态 {{ sessionTargetResolutionLabel(session) }}</span>
              <span v-if="session.nextCheckAt"
                >计划发送 {{ relativeTime(session.nextCheckAt) }}</span
              >
              <span v-else>等待引擎恢复后发送</span>
              <router-link
                v-if="session.threadId"
                :to="`/reflection-threads/${session.threadId}`"
                class="session-link"
                :title="threadLinkBoundary(session)"
                :aria-label="threadLinkAriaLabel(session)"
                >查看线程</router-link
              >
              <a
                v-if="messageReactionSourceUrl(session)"
                :href="messageReactionSourceUrl(session)"
                class="session-link"
                target="_blank"
                rel="noopener noreferrer"
                :title="sourceMessageLinkBoundary(session)"
                :aria-label="sourceMessageLinkAriaLabel(session)"
                >打开原消息</a
              >
              <router-link
                :to="`/outreach/${session.id}`"
                class="session-link"
                :title="sessionDetailLinkBoundary(session, '查看详情/修改')"
                :aria-label="sessionDetailLinkAriaLabel(session, '查看详情/修改')"
                >查看详情/修改</router-link
              >
            </div>
          </div>
        </div>
      </section>

      <section v-if="waitingSessions.length > 0" class="group-section">
        <div class="group-head">
          <h3>等待对方回复</h3>
          <span class="group-count">{{ waitingSessions.length }}</span>
        </div>
        <p class="group-desc">
          这些询问已经发出，正在等待对方回复或按对方 ETA 延期。
        </p>
        <div class="session-list">
          <div
            v-for="session in waitingSessions"
            :key="session.id"
            class="session-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="`/outreach/${session.id}`"
                    class="title-link"
                    :title="sessionDetailLinkBoundary(session, '打开等待回复详情')"
                    :aria-label="sessionDetailLinkAriaLabel(session, '打开等待回复详情')"
                  >
                    {{ session.renderedQuestion || '(空问题)' }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{ session.renderedContext || '无信息目标' }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge" :class="statusClass(session.status)">{{
                  statusLabel(session.status)
                }}</span>
                <span class="badge muted">{{
                  originLabel(session.originKind)
                }}</span>
                <span
                  v-if="evidenceSnapshot(session).stateLabel"
                  class="badge evidence"
                  >{{ evidenceSnapshot(session).stateLabel }}</span
                >
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ sessionStageHint(session) }}
            </div>

            <div
              class="handoff-receipt"
              :class="sessionHandoffReceipt(session).tone"
            >
              <div class="handoff-title">
                {{ sessionHandoffReceipt(session).title }}
              </div>
              <ul>
                <li
                  v-for="item in sessionHandoffReceipt(session).items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="evidenceSnapshot(session).hasEvidence"
              class="evidence-box"
            >
              <div class="evidence-head">
                <span class="evidence-title">证据状态</span>
                <span
                  v-if="evidenceSnapshot(session).phaseLabel"
                  class="evidence-pill"
                  >{{ evidenceSnapshot(session).phaseLabel }}</span
                >
                <span
                  v-if="evidenceSnapshot(session).source"
                  class="evidence-pill muted"
                  >{{ evidenceSnapshot(session).source }}</span
                >
              </div>
              <p
                v-if="evidenceSnapshot(session).summary"
                class="evidence-summary"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).summary"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
              <p
                v-if="
                  evidenceSnapshot(session).relatedMessage &&
                  evidenceSnapshot(session).relatedMessage !==
                    evidenceSnapshot(session).summary
                "
                class="evidence-related"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).relatedMessage"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
            </div>

            <div class="card-meta">
              <span
                >发送给
                {{ formatTarget(session.targetType, session.targetRef) }}</span
              >
              <span>目标类型 {{ targetTypeLabel(session.targetType) }}</span>
              <span>目标状态 {{ sessionTargetResolutionLabel(session) }}</span>
              <span v-if="session.waitUntil"
                >等待至 {{ relativeTime(session.waitUntil) }}</span
              >
              <span v-if="session.nextCheckAt"
                >下次检查 {{ relativeTime(session.nextCheckAt) }}</span
              >
              <span
                >追问 {{ session.followupCount }}/{{
                  session.maxFollowup
                }}</span
              >
              <router-link
                v-if="session.threadId"
                :to="`/reflection-threads/${session.threadId}`"
                class="session-link"
                :title="threadLinkBoundary(session)"
                :aria-label="threadLinkAriaLabel(session)"
                >查看线程</router-link
              >
              <a
                v-if="messageReactionSourceUrl(session)"
                :href="messageReactionSourceUrl(session)"
                class="session-link"
                target="_blank"
                rel="noopener noreferrer"
                :title="sourceMessageLinkBoundary(session)"
                :aria-label="sourceMessageLinkAriaLabel(session)"
                >打开原消息</a
              >
              <router-link
                :to="`/outreach/${session.id}`"
                class="session-link"
                :title="sessionDetailLinkBoundary(session, '查看详情')"
                :aria-label="sessionDetailLinkAriaLabel(session, '查看详情')"
                >查看详情</router-link
              >
            </div>

            <div v-if="session.replyRawText" class="reply-box">
              <div class="box-title">最近回复</div>
              <p>{{ session.replyRawText }}</p>
            </div>
          </div>
        </div>
      </section>

      <section v-if="historySessions.length > 0" class="group-section">
        <div class="group-head">
          <h3>历史记录</h3>
          <span class="group-count">{{ historySessions.length }}</span>
        </div>
        <p class="group-desc">已完成、失败、无回复或已取消的主动询问会话。</p>
        <div class="session-list">
          <div
            v-for="session in historySessions"
            :key="session.id"
            class="session-card"
          >
            <div class="card-head">
              <div>
                <h3>
                  <router-link
                    :to="`/outreach/${session.id}`"
                    class="title-link"
                    :title="sessionDetailLinkBoundary(session, '打开历史详情')"
                    :aria-label="sessionDetailLinkAriaLabel(session, '打开历史详情')"
                  >
                    {{ session.renderedQuestion || '(空问题)' }}
                  </router-link>
                </h3>
                <p class="context-text">
                  {{ session.renderedContext || '无信息目标' }}
                </p>
              </div>
              <div class="head-badges">
                <span class="badge" :class="statusClass(session.status)">{{
                  statusLabel(session.status)
                }}</span>
                <span class="badge muted">{{
                  originLabel(session.originKind)
                }}</span>
                <span
                  v-if="evidenceSnapshot(session).stateLabel"
                  class="badge evidence"
                  >{{ evidenceSnapshot(session).stateLabel }}</span
                >
              </div>
            </div>

            <div class="stage-line">
              <strong>当前阶段：</strong>{{ sessionStageHint(session) }}
            </div>

            <div
              class="handoff-receipt"
              :class="sessionHandoffReceipt(session).tone"
            >
              <div class="handoff-title">
                {{ sessionHandoffReceipt(session).title }}
              </div>
              <ul>
                <li
                  v-for="item in sessionHandoffReceipt(session).items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>

            <div
              v-if="evidenceSnapshot(session).hasEvidence"
              class="evidence-box"
            >
              <div class="evidence-head">
                <span class="evidence-title">证据状态</span>
                <span
                  v-if="evidenceSnapshot(session).phaseLabel"
                  class="evidence-pill"
                  >{{ evidenceSnapshot(session).phaseLabel }}</span
                >
                <span
                  v-if="evidenceSnapshot(session).source"
                  class="evidence-pill muted"
                  >{{ evidenceSnapshot(session).source }}</span
                >
              </div>
              <p
                v-if="evidenceSnapshot(session).summary"
                class="evidence-summary"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).summary"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
              <p
                v-if="
                  evidenceSnapshot(session).relatedMessage &&
                  evidenceSnapshot(session).relatedMessage !==
                    evidenceSnapshot(session).summary
                "
                class="evidence-related"
              >
                <RichEvidenceText
                  :text="evidenceSnapshot(session).relatedMessage"
                  :mention-labels="evidenceMentionLabels(session)"
                />
              </p>
            </div>

            <div class="card-meta">
              <span
                >发送给
                {{ formatTarget(session.targetType, session.targetRef) }}</span
              >
              <span>目标类型 {{ targetTypeLabel(session.targetType) }}</span>
              <span>目标状态 {{ sessionTargetResolutionLabel(session) }}</span>
              <span
                >最后更新
                {{ relativeTime(session.updatedAt || session.createdAt) }}</span
              >
              <router-link
                v-if="session.threadId"
                :to="`/reflection-threads/${session.threadId}`"
                class="session-link"
                :title="threadLinkBoundary(session)"
                :aria-label="threadLinkAriaLabel(session)"
                >查看线程</router-link
              >
              <a
                v-if="messageReactionSourceUrl(session)"
                :href="messageReactionSourceUrl(session)"
                class="session-link"
                target="_blank"
                rel="noopener noreferrer"
                :title="sourceMessageLinkBoundary(session)"
                :aria-label="sourceMessageLinkAriaLabel(session)"
                >打开原消息</a
              >
              <router-link
                :to="`/outreach/${session.id}`"
                class="session-link"
                :title="sessionDetailLinkBoundary(session, '查看详情')"
                :aria-label="sessionDetailLinkAriaLabel(session, '查看详情')"
                >查看详情</router-link
              >
            </div>

            <div v-if="session.replyRawText" class="reply-box">
              <div class="box-title">最近回复</div>
              <p>{{ session.replyRawText }}</p>
            </div>

            <div
              v-if="session.outcome && Object.keys(session.outcome).length > 0"
              class="result-box"
            >
              <div class="box-title">结构化结果</div>
              <pre>{{ formatJson(session.outcome) }}</pre>
            </div>

            <div
              v-if="canRetrySession(session) || canContinueFollowup(session)"
              class="card-actions"
            >
              <button
                v-if="canRetrySession(session)"
                class="inline-btn primary"
                :disabled="Boolean(busyById[session.id])"
                :title="listActionButtonTitle('retry', session)"
                :aria-label="listActionButtonAriaLabel('retry', session)"
                @click="retrySession(session.id)"
              >
                重试
              </button>
              <button
                v-if="canContinueFollowup(session)"
                class="inline-btn"
                :disabled="Boolean(busyById[session.id])"
                :title="continueFollowupListButtonTitle(session)"
                :aria-label="continueFollowupListButtonAriaLabel(session)"
                @click="openContinueFollowup(session.id)"
              >
                继续追问
              </button>
            </div>

            <div
              v-if="listOperationReceipt(session.id)"
              class="handoff-receipt list-operation-receipt"
              :class="listOperationReceipt(session.id)?.tone"
              role="status"
              aria-label="主动询问列表操作回执"
            >
              <div class="handoff-title">
                {{ listOperationReceipt(session.id)?.title }}
              </div>
              <ul>
                <li
                  v-for="item in listOperationReceipt(session.id)?.items"
                  :key="item"
                >
                  {{ item }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type OutreachSession,
  type OutreachSessionStatus,
  type OutreachSummary,
  type OutreachTemplateRuntimeStatusItem,
  type RuntimeConfigResponse,
} from '../../services/MemoryServiceClient';
import { getOutreachEvidenceSnapshot } from './outreachEvidence';
import { collectEvidenceMentionLabels, RichEvidenceText } from './evidenceText';

declare const chrome: any;

const client = getMemoryServiceClient();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const sessions = ref<OutreachSession[]>([]);
const allSessionsSnapshot = ref<OutreachSession[]>([]);
const allSessionsSnapshotLoaded = ref(false);
const templateItems = ref<OutreachTemplateRuntimeStatusItem[]>([]);
const summary = ref<OutreachSummary>({
  upcomingCount: 0,
  waitingReplyCount: 0,
  escalatedCount: 0,
  pendingApprovalCount: 0,
});
const runtimeConfig = ref<RuntimeConfigResponse | null>(null);
const busyById = reactive<Record<string, boolean>>({});
const listOperationReceipts = reactive<Record<string, HandoffReceipt | undefined>>({});
const loadError = ref('');
const hasLoadedData = ref(false);
const TERMINAL_OUTREACH_STATUSES = new Set([
  'resolved',
  'no_reply',
  'escalated',
  'cancelled',
  'failed',
]);
type HandoffReceiptTone = 'default' | 'success' | 'warn' | 'danger';

interface HandoffReceipt {
  title: string;
  tone: HandoffReceiptTone;
  items: string[];
}

interface FocusLane {
  eyebrow: string;
  title: string;
  tone: HandoffReceiptTone;
  subject: string;
  context: string;
  meta: string[];
  route: string;
  actionLabel: string;
  items: string[];
}

const approvalSessions = computed(() =>
  sessions.value.filter((session) => session.status === 'pending_approval'),
);
const queuedSessions = computed(() =>
  sessions.value.filter((session) => session.status === 'scheduled'),
);
const waitingSessions = computed(() =>
  sessions.value.filter(
    (session) =>
      session.status === 'waiting_reply' || session.status === 'deferred',
  ),
);
const historySessions = computed(() =>
  sessions.value.filter((session) =>
    ['resolved', 'no_reply', 'escalated', 'cancelled', 'failed'].includes(
      session.status,
    ),
  ),
);
const retriableSessions = computed(() =>
  sessions.value.filter((session) => canRetrySession(session)),
);
const visibleTemplates = computed(() =>
  pendingTemplates.value.filter((item) => matchesTemplateFilters(item)),
);
const pendingTemplates = computed(() =>
  sortTemplatesForDisplay(templateItems.value.filter(isPendingTemplate)),
);
const hasActiveFilters = computed(
  () =>
    status.value !== 'all' ||
    Boolean(originKind.value.trim()) ||
    Boolean(templateId.value.trim()) ||
    Boolean(threadId.value.trim()),
);
const hiddenSessionCount = computed(() =>
  Math.max(0, allSessionsSnapshot.value.length - sessions.value.length),
);
const hiddenTemplateCount = computed(() =>
  Math.max(0, pendingTemplates.value.length - visibleTemplates.value.length),
);
const filteredEmptyReceipt = computed(() => buildFilteredEmptyReceipt());
const showSetupBanner = computed(() => {
  if (!runtimeConfig.value) return false;
  return (
    !runtimeConfig.value.outreachEnabled ||
    !isRingCentralReady(runtimeConfig.value)
  );
});
const setupBannerTitle = computed(() => {
  if (!runtimeConfig.value?.outreachEnabled) return '主动询问引擎尚未开启';
  return 'RingCentral 配置尚未完成';
});
const setupBannerText = computed(() => {
  if (!runtimeConfig.value?.outreachEnabled) {
    return '当前页面显示的是历史记录或待触发计划，但引擎关闭时不会真正派发新的主动询问。请先到 Options 页面开启。';
  }
  return '你已经进入了主动询问页面，但缺少发送所需的 RingCentral 配置。补齐后，待审批和待发送会话才会继续推进。';
});
const pageTriageReceipt = computed<HandoffReceipt>(() =>
  buildPageTriageReceipt(),
);
const focusLane = computed<FocusLane | null>(() => buildFocusLane());
const filterScopeReceipt = computed<HandoffReceipt>(() =>
  buildFilterScopeReceipt(),
);

const status = ref<OutreachSessionStatus | 'all'>('all');
const originKind = ref('');
const templateId = ref('');
const threadId = ref('');

onMounted(() => {
  hydrateFilters();
  void loadData();
});

watch(
  () => route.fullPath,
  () => {
    hydrateFilters();
    void loadData();
  },
);

function hydrateFilters() {
  status.value = normalizeStatus(route.query.status);
  originKind.value =
    typeof route.query.originKind === 'string' ? route.query.originKind : '';
  templateId.value =
    typeof route.query.templateId === 'string' ? route.query.templateId : '';
  threadId.value =
    typeof route.query.threadId === 'string' ? route.query.threadId : '';
}

function normalizeStatus(value: unknown): OutreachSessionStatus | 'all' {
  if (typeof value !== 'string' || value.length === 0) return 'all';
  const allowed: Array<OutreachSessionStatus | 'all'> = [
    'all',
    'pending_approval',
    'scheduled',
    'waiting_reply',
    'deferred',
    'resolved',
    'no_reply',
    'escalated',
    'cancelled',
    'failed',
  ];
  return allowed.includes(value as OutreachSessionStatus | 'all')
    ? (value as OutreachSessionStatus | 'all')
    : 'all';
}

function applyFilters() {
  const query: Record<string, string> = {};
  if (status.value !== 'all') query.status = status.value;
  if (originKind.value.trim()) query.originKind = originKind.value.trim();
  if (templateId.value.trim()) query.templateId = templateId.value.trim();
  if (threadId.value.trim()) query.threadId = threadId.value.trim();

  void router.replace({ path: '/outreach', query });
}

async function loadData() {
  loading.value = true;
  loadError.value = '';
  const needsUnfilteredSnapshot = hasActiveFilters.value;
  try {
    const results = await Promise.allSettled([
      client.getRuntimeConfig(),
      client.getOutreachSummary(),
      client.getOutreachTemplateRuntimeStatus(undefined, 100),
      client.getOutreachSessions({
        status: status.value,
        originKind: originKind.value || undefined,
        templateId: templateId.value || undefined,
        threadId: threadId.value || undefined,
        limit: 50,
      }),
      needsUnfilteredSnapshot
        ? client.getOutreachSessions({ limit: 50 })
        : Promise.resolve(null),
    ] as const);

    const failures: string[] = [];
    const [
      configResult,
      summaryResult,
      templateResult,
      listResult,
      unfilteredListResult,
    ] = results;

    if (configResult.status === 'fulfilled') {
      runtimeConfig.value = configResult.value;
    } else {
      failures.push(formatLoadFailure('运行配置', configResult.reason));
    }

    if (summaryResult.status === 'fulfilled') {
      summary.value = summaryResult.value;
    } else {
      failures.push(formatLoadFailure('统计摘要', summaryResult.reason));
    }

    if (templateResult.status === 'fulfilled') {
      templateItems.value = templateResult.value.items;
    } else {
      failures.push(formatLoadFailure('待触发计划', templateResult.reason));
    }

    if (listResult.status === 'fulfilled') {
      sessions.value = sortSessionsForDisplay(listResult.value.items);
    } else {
      failures.push(formatLoadFailure('会话列表', listResult.reason));
    }

    if (needsUnfilteredSnapshot) {
      if (
        unfilteredListResult.status === 'fulfilled' &&
        unfilteredListResult.value
      ) {
        allSessionsSnapshot.value = sortSessionsForDisplay(
          unfilteredListResult.value.items,
        );
        allSessionsSnapshotLoaded.value = true;
      } else {
        allSessionsSnapshotLoaded.value = false;
      }
    } else if (listResult.status === 'fulfilled') {
      allSessionsSnapshot.value = sessions.value;
      allSessionsSnapshotLoaded.value = true;
    }

    if (failures.length > 0) {
      loadError.value = failures.join('；');
      console.error('Failed to load outreach sessions:', failures.join('; '));
    }
    if (
      templateResult.status === 'fulfilled' ||
      listResult.status === 'fulfilled'
    ) {
      hasLoadedData.value =
        sessions.value.length > 0 || templateItems.value.length > 0;
    }
  } finally {
    loading.value = false;
  }
}

function formatLoadFailure(label: string, error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/^MemoryService\s+\d+:\s*/i, '').trim();
  return `${label}：${message || 'unknown error'}`;
}

function buildPageTriageReceipt(): HandoffReceipt {
  const scopeLine = `范围：${triageFilterLabel()}，可见会话 ${sessions.value.length} 条、待触发计划 ${visibleTemplates.value.length} 条。`;
  const boundary =
    '边界：刷新和筛选只读取 Memory Service 状态，不会批准、发送、追问、重试或写回 RingCentral。';

  if (loadError.value && !hasLoadedData.value) {
    return {
      title: '本页优先级',
      tone: 'danger',
      items: [
        `先恢复数据加载：${loadError.value}`,
        scopeLine,
        boundary,
      ],
    };
  }

  if (loadError.value) {
    return {
      title: '本页优先级',
      tone: 'danger',
      items: [
        `先重试加载：当前继续展示上次成功数据，最新错误是 ${loadError.value}`,
        scopeLine,
        boundary,
      ],
    };
  }

  if (showSetupBanner.value) {
    return {
      title: '本页优先级',
      tone: 'warn',
      items: [
        `先修复配置：${setupBannerTitle.value}；待审批和已排程会话不会继续外发。`,
        scopeLine,
        boundary,
      ],
    };
  }

  if (retriableSessions.value.length > 0) {
    return {
      title: '本页优先级',
      tone: 'danger',
      items: [
        `先处理 ${retriableSessions.value.length} 个失败、无回复或已升级终态；重试前核对旧失败原因和目标是否仍可用。`,
        scopeLine,
        boundary,
      ],
    };
  }

  if (approvalSessions.value.length > 0) {
    return {
      title: '本页优先级',
      tone: 'warn',
      items: [
        `先处理 ${approvalSessions.value.length} 个待审批会话；批准前确认目标、问题和计划时间。`,
        scopeLine,
        boundary,
      ],
    };
  }

  if (waitingSessions.value.length > 0) {
    return {
      title: '本页优先级',
      tone: 'default',
      items: [
        `当前重点是等待 ${waitingSessions.value.length} 个已发出会话的回复；系统不会在等待窗口内重复打扰同一目标。`,
        scopeLine,
        boundary,
      ],
    };
  }

  if (queuedSessions.value.length > 0) {
    return {
      title: '本页优先级',
      tone: 'default',
      items: [
        `当前有 ${queuedSessions.value.length} 个已排程会话；发出前仍可进入详情修改或取消。`,
        scopeLine,
        boundary,
      ],
    };
  }

  if (visibleTemplates.value.length > 0) {
    return {
      title: '本页优先级',
      tone: 'default',
      items: [
        `当前只有 ${visibleTemplates.value.length} 个待触发计划；它们还不是已发出的外部消息。`,
        scopeLine,
        boundary,
      ],
    };
  }

  return {
    title: '本页优先级',
    tone: 'success',
    items: [
      '当前筛选下没有需要你立即处理的主动询问。',
      scopeLine,
      boundary,
    ],
  };
}

function buildFocusLane(): FocusLane | null {
  if (loadError.value && !hasLoadedData.value) return null;

  const retriable = retriableSessions.value[0];
  if (retriable) {
    const failureReason =
      retriable.errorMessage || extractOutcomeSummary(retriable.outcome);
    return sessionFocusLane(retriable, {
      eyebrow: '本轮处理对象 · 终态恢复',
      title: '先核对旧失败，再决定是否重试',
      tone: 'danger',
      actionLabel: '打开重试详情',
      items: [
        '下一步：打开详情核对旧失败原因、目标对象和最近事件后，再决定是否重试。',
        '边界：本卡只定位会话；不会调用重试、重新发送、写入 RingCentral 或修改 Memory Service。',
        failureReason
          ? `旧原因：${failureReason}`
          : '恢复：重试会保留旧终态和 retried 审计事件，不会伪装成新建会话。',
      ],
    });
  }

  const approval = approvalSessions.value[0];
  if (approval) {
    return sessionFocusLane(approval, {
      eyebrow: '本轮处理对象 · 待审批',
      title:
        approval.targetResolutionStatus === 'resolved'
          ? '先确认发送范围'
          : '先确认唯一目标',
      tone: 'warn',
      actionLabel: '进入详情审批',
      items: [
        '下一步：打开详情确认目标、问题和计划时间，再决定是否批准发送。',
        '边界：本卡不批准、不发送；真正的批准动作仍要在详情或会话卡按钮执行。',
        '恢复：目标不明确时先编辑目标或取消，不要让自动化猜收件人。',
      ],
    });
  }

  const waiting = waitingSessions.value[0];
  if (waiting) {
    return sessionFocusLane(waiting, {
      eyebrow: '本轮处理对象 · 等待回复',
      title: isMessageReactionSession(waiting)
        ? '先核对原消息线程'
        : '先看等待窗口',
      tone: 'default',
      actionLabel: '查看回复归因',
      items: [
        '下一步：打开详情查看回复归因、等待窗口和追问额度。',
        '边界：查看不会追问、结束会话或发送新消息；引擎只按等待窗口继续检查。',
        isMessageReactionSession(waiting)
          ? '恢复：必要时从详情或原消息链接核对上下文，避免重复追问已经答过的问题。'
          : '恢复：如果等待窗口或目标不合理，再进入详情取消或重新发起。',
      ],
    });
  }

  const queued = queuedSessions.value[0];
  if (queued) {
    return sessionFocusLane(queued, {
      eyebrow: '本轮处理对象 · 已排程',
      title: '先复核发出时间',
      tone: 'default',
      actionLabel: '查看排程详情',
      items: [
        '下一步：打开详情确认发出时间、目标和是否需要取消或修改。',
        '边界：本卡不会立即发送，也不会跳过目标解析或写回 RingCentral。',
        '恢复：发出前仍可在详情调整目标、问题、计划时间或取消这次会话。',
      ],
    });
  }

  const template = visibleTemplates.value[0];
  if (template) {
    return templateFocusLane(template);
  }

  return null;
}

function sessionFocusLane(
  session: OutreachSession,
  options: Pick<
    FocusLane,
    'eyebrow' | 'title' | 'tone' | 'actionLabel' | 'items'
  >,
): FocusLane {
  return {
    ...options,
    subject: session.renderedQuestion || '(空问题)',
    context: session.renderedContext || sessionStageHint(session),
    route: `/outreach/${session.id}`,
    meta: sessionFocusMeta(session),
  };
}

function sessionFocusMeta(session: OutreachSession) {
  const meta = [
    `状态 ${statusLabel(session.status)}`,
    originLabel(session.originKind),
    `目标 ${formatTarget(session.targetType, session.targetRef)}`,
    sessionTargetResolutionLabel(session),
  ];
  if (session.waitUntil) meta.push(`等待至 ${relativeTime(session.waitUntil)}`);
  if (session.nextCheckAt) {
    meta.push(`${nextSessionTimeLabel(session.status)} ${relativeTime(session.nextCheckAt)}`);
  }
  const evidence = evidenceSnapshot(session).stateLabel;
  if (evidence) meta.push(evidence);
  return meta;
}

function nextSessionTimeLabel(statusValue: OutreachSessionStatus) {
  if (statusValue === 'scheduled') return '计划发送';
  if (statusValue === 'waiting_reply' || statusValue === 'deferred')
    return '下次检查';
  if (statusValue === 'pending_approval') return '审批后计划';
  return '更新时间';
}

function templateFocusLane(
  item: OutreachTemplateRuntimeStatusItem,
): FocusLane {
  const nextDispatchAt = resolveTemplateNextDispatchAt(item);
  const target = formatTarget(item.template.targetType, item.template.targetRef);
  const latest = item.latestSession;
  return {
    eyebrow: '本轮处理对象 · 待触发计划',
    title: '先确认下一次计划是否仍有效',
    tone: 'default',
    subject:
      item.template.questionTemplate || item.template.title || '(空问题)',
    context: item.template.contextTemplate || '计划已同步，等待触发。',
    route: templateListRoute(item),
    actionLabel: '查看计划会话',
    meta: [
      `目标 ${target}`,
      `同步 ${templateSyncStateLabel(item.template.syncState)}`,
      nextDispatchAt ? `下次 ${relativeTime(nextDispatchAt)}` : '计划时间未解析',
      latest ? `上次 ${statusLabel(latest.status)}` : '尚未生成会话',
    ],
    items: [
      nextDispatchAt
        ? `下一步：${relativeTime(nextDispatchAt)} 由 Outreach 引擎生成下一次会话。`
        : '下一步：先修复计划时间，当前不会生成下一次会话。',
      '边界：本卡只是计划视图，不会立即发送、创建会话、审批、追问或写回 RingCentral。',
      latest?.id
        ? '恢复：可查看上次执行或回到定时消息计划调整目标、问题和时间。'
        : '恢复：需要调整目标、问题或时间时，回到定时消息计划修改。',
    ],
  };
}

function triageFilterLabel() {
  const statusText =
    status.value === 'all' ? '全部状态' : `状态 ${statusLabel(status.value)}`;
  const originText = originKind.value
    ? `来源 ${originLabel(originKind.value)}`
    : '全部来源';
  const templateText = templateId.value.trim()
    ? `计划 ${templateId.value.trim()}`
    : '';
  const threadText = threadId.value.trim()
    ? `线程 ${threadId.value.trim()}`
    : '';
  return [statusText, originText, templateText, threadText]
    .filter(Boolean)
    .join(' / ');
}

function buildFilterScopeReceipt(): HandoffReceipt {
  const items = [`当前筛选：${triageFilterLabel()}。`];

  if (loading.value) {
    items.push(
      '正在按当前筛选重新读取 Memory Service；返回前，下方卡片仍可能是上次成功读取的列表快照，不应当作本次筛选结果。',
    );
  } else {
    items.push(
      `本次可见 ${sessions.value.length} 条会话、${visibleTemplates.value.length} 个待触发计划。`,
    );
  }

  if (hasActiveFilters.value) {
    if (loading.value) {
      items.push(
        '有筛选时会额外读取未筛选快照，用来说明哪些会话或计划被当前筛选隐藏。',
      );
    } else if (allSessionsSnapshotLoaded.value) {
      items.push(
        `隐藏依据：未筛选快照里有 ${hiddenSessionCount.value} 条会话和 ${hiddenTemplateCount.value} 个待触发计划被当前筛选隐藏。`,
      );
    } else {
      items.push(
        '隐藏依据：未筛选快照暂不可用；清除筛选或刷新后再判断全量队列。',
      );
    }
  } else {
    items.push(
      '当前是全部状态与全部来源视图；计划 ID 和 threadId 未限制列表范围。',
    );
  }

  items.push(
    '边界：筛选、清除筛选或刷新只同步 URL 并读取状态，不会批准、取消、发送、追问、重试、写用户画像或写回 RingCentral。',
  );

  return {
    title: loading.value ? '筛选请求中' : '筛选范围回执',
    tone: loading.value ? 'warn' : hasActiveFilters.value ? 'default' : 'success',
    items,
  };
}

function buildFilteredEmptyReceipt() {
  const items = [
    `当前筛选：${triageFilterLabel()}。`,
    allSessionsSnapshotLoaded.value
      ? hiddenSessionCount.value > 0 || hiddenTemplateCount.value > 0
        ? `未筛选快照里还有 ${hiddenSessionCount.value} 条会话和 ${hiddenTemplateCount.value} 个待触发计划被当前筛选隐藏。`
        : '未筛选快照也没有可展示的会话或待触发计划。'
      : '未筛选会话快照暂时不可用；可以清除筛选后重新读取全部列表。',
    '恢复：清除筛选会回到全部状态、全部来源、全部计划和全部线程视图。',
    '边界：清除筛选或刷新只会重新读取 Memory Service，不会批准、发送、追问、重试或写回 RingCentral。',
  ];

  return {
    summary: '当前筛选没有匹配的主动询问会话或待触发计划。',
    items,
  };
}

function clearFilters() {
  status.value = 'all';
  originKind.value = '';
  templateId.value = '';
  threadId.value = '';
  void router.replace({ path: '/outreach' });
}

async function approveSession(id: string) {
  const session = findSessionById(id);
  if (session) {
    listOperationReceipts[id] = buildListOperationPendingReceipt(
      'approve',
      session,
    );
  }
  busyById[id] = true;
  try {
    const response = await client.approveOutreachSession(id);
    await loadData();
    listOperationReceipts[id] = buildListOperationSuccessReceipt(
      'approve',
      findSessionById(id) || response.session || session,
    );
  } catch (error) {
    listOperationReceipts[id] = buildListOperationFailureReceipt(
      '批准发送',
      error,
      session,
    );
  } finally {
    busyById[id] = false;
  }
}

async function cancelSession(id: string) {
  if (!window.confirm('确认取消这个主动询问会话吗？')) return;
  const session = findSessionById(id);
  if (session) {
    listOperationReceipts[id] = buildListOperationPendingReceipt(
      'cancel',
      session,
    );
  }
  busyById[id] = true;
  try {
    const response = await client.cancelOutreachSession(
      id,
      'Cancelled from outreach list UI',
    );
    await loadData();
    listOperationReceipts[id] = buildListOperationSuccessReceipt(
      'cancel',
      findSessionById(id) || response.session || session,
    );
  } catch (error) {
    listOperationReceipts[id] = buildListOperationFailureReceipt(
      '取消主动询问',
      error,
      session,
    );
  } finally {
    busyById[id] = false;
  }
}

async function retrySession(id: string) {
  const session = findSessionById(id);
  if (session) {
    listOperationReceipts[id] = buildListOperationPendingReceipt(
      'retry',
      session,
    );
  }
  busyById[id] = true;
  try {
    const response = await client.retryOutreachSession(id);
    await loadData();
    listOperationReceipts[id] = buildListOperationSuccessReceipt(
      'retry',
      findSessionById(id) || response.session || session,
    );
  } catch (error) {
    listOperationReceipts[id] = buildListOperationFailureReceipt(
      '重试主动询问',
      error,
      session,
    );
  } finally {
    busyById[id] = false;
  }
}

function findSessionById(id: string) {
  return sessions.value.find((session) => session.id === id) || null;
}

function listOperationReceipt(id: string) {
  return listOperationReceipts[id] || null;
}

function buildListOperationPendingReceipt(
  action: 'approve' | 'cancel' | 'retry',
  session: OutreachSession,
): HandoffReceipt {
  const actionText = listOperationActionText(action);
  const pendingTruth =
    action === 'approve'
      ? '审批结果、排程状态、dispatched 事件、sentPostId 和等待回复状态'
      : action === 'cancel'
        ? '取消状态、后续检查是否停止和事件时间线'
        : '重置后的状态、retried 审计事件和下一轮排程';
  return {
    title: `列表操作提交中：${actionText}请求已提交`,
    tone: 'warn',
    items: [
      `当前卡片仍是上次成功读取的状态：${statusLabel(session.status)}；目标：${formatTarget(session.targetType, session.targetRef)}。`,
      `${pendingTruth}要等 Memory Service 返回并刷新列表后才能确认；按钮临时锁定只是防止重复提交。`,
      '这条提交中回执不代表 RingCentral 已发送、对方已回复、会话已取消、会话已重试、用户画像已写入或来源证据已删除。',
    ],
  };
}

function buildListOperationSuccessReceipt(
  action: 'approve' | 'cancel' | 'retry',
  session: OutreachSession | null | undefined,
): HandoffReceipt {
  const actionText = listOperationActionText(action);
  const statusText = session ? statusLabel(session.status) : '等待刷新确认';
  const targetText = session
    ? formatTarget(session.targetType, session.targetRef)
    : '本轮列表未返回该会话';
  const resultLine =
    action === 'approve'
      ? '这只确认批准请求已被 Memory Service 处理；是否已经真正外发仍以 dispatched 事件、sentPostId 和等待回复状态为准。'
      : action === 'cancel'
        ? '这只确认取消请求已被 Memory Service 处理；不会撤回已经发出的 RingCentral 消息，也不会删除来源证据。'
        : '这只确认重试请求已被 Memory Service 处理；新的外发、等待回复或失败状态仍以刷新后的会话事件为准。';
  return {
    title: `列表操作回执：${actionText}已处理`,
    tone: 'success',
    items: [
      `刷新后状态：${statusText}；目标：${targetText}。`,
      resultLine,
      '这次列表操作不会写用户画像、不确认答案、不向其它外部系统同步，也不会清除原始证据。',
    ],
  };
}

function buildListOperationFailureReceipt(
  actionText: string,
  error: unknown,
  session: OutreachSession | null,
): HandoffReceipt {
  const message = formatActionError(error);
  return {
    title: `列表操作失败：${actionText}未确认`,
    tone: 'danger',
    items: [
      message ? `失败原因：${message}` : '失败原因：unknown error。',
      session
        ? `页面继续保留上次成功读取的状态：${statusLabel(session.status)}；目标：${formatTarget(session.targetType, session.targetRef)}。`
        : '页面没有找到这条会话的上次快照；请刷新列表后再判断当前状态。',
      '这次失败不会被当成已批准、已发送、已取消、已重试、已拿到回复或已写回 RingCentral。',
    ],
  };
}

function listOperationActionText(action: 'approve' | 'cancel' | 'retry') {
  if (action === 'approve') return '批准发送';
  if (action === 'cancel') return '取消主动询问';
  return '重试主动询问';
}

function formatActionError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || '');
  return raw.replace(/^MemoryService\s+\d+:\s*/i, '').trim();
}

function setupConfigButtonBoundary() {
  return '打开 Options 的主动询问配置页，用于查看或补齐本机 Outreach / RingCentral 设置；点击本按钮不会启用引擎、批准会话、发送消息、追问、重试、取消或写回 RingCentral。';
}

function setupConfigButtonAriaLabel() {
  return `前往主动询问配置：${setupConfigButtonBoundary()}`;
}

function listRefreshButtonBoundary() {
  return '重新读取主动询问运行配置、统计摘要、待触发计划和当前筛选会话；不会批准、取消、发送、追问、重试、写用户画像或写回 RingCentral。';
}

function listRefreshButtonAriaLabel() {
  return `刷新：${listRefreshButtonBoundary()}`;
}

function clearFiltersButtonBoundary() {
  return '清除状态、来源、计划和线程筛选，并回到主动询问全部视图；只更新本页 URL 和重新读取列表，不会批准、发送、追问、重试、取消或写回 RingCentral。';
}

function clearFiltersButtonAriaLabel() {
  return `清除筛选：${clearFiltersButtonBoundary()}`;
}

function focusActionBoundary(lane: FocusLane) {
  return `${lane.actionLabel}只打开本轮处理对象对应页面，帮助核对状态、证据和下一步；不会执行卡片建议、批准、取消、发送、追问、重试、创建会话或写回 RingCentral。`;
}

function focusActionAriaLabel(lane: FocusLane) {
  return `${lane.actionLabel}：${focusActionBoundary(lane)}`;
}

function templateListLinkBoundary(item: OutreachTemplateRuntimeStatusItem) {
  const subject =
    item.template.questionTemplate || item.template.title || '(空问题)';
  return `按计划 ${item.template.id} 筛选主动询问列表，查看「${truncateInlineText(subject, 42)}」的待触发和历史会话；只更新 URL 和读取状态，不会立即生成会话、审批、发送、追问或写回 RingCentral。`;
}

function templateListLinkAriaLabel(item: OutreachTemplateRuntimeStatusItem) {
  return `查看计划会话：${templateListLinkBoundary(item)}`;
}

function latestSessionLinkBoundary(item: OutreachTemplateRuntimeStatusItem) {
  const latest = item.latestSession;
  if (!latest) {
    return '查看上次执行入口当前没有会话；不会生成新会话、发送消息或写回 RingCentral。';
  }
  return `打开这条计划的上次 Outreach 会话详情；当前上次状态是「${statusLabel(latest.status)}」，只读取时间线和证据，不会重试、重新发送、取消、确认答案或写回 RingCentral。`;
}

function latestSessionLinkAriaLabel(item: OutreachTemplateRuntimeStatusItem) {
  return `查看上次执行：${latestSessionLinkBoundary(item)}`;
}

function sessionDetailLinkBoundary(session: OutreachSession, label: string) {
  return `${label}只打开 Outreach 会话详情，读取当前状态、时间线、目标、证据和可用操作；不会批准、取消、发送、追问、重试、保存草稿、确认答案、写用户画像或写回 RingCentral。当前状态：${statusLabel(session.status)}。`;
}

function sessionDetailLinkAriaLabel(session: OutreachSession, label: string) {
  return `${label}：${sessionDetailLinkBoundary(session, label)}`;
}

function threadLinkBoundary(session: OutreachSession) {
  const thread = session.threadId || '关联线程';
  return `打开自我反思线程 ${thread}，用于核对这条主动询问的来源和阻塞原因；这是只读导航，不会推进反思、批准/取消 Outreach、发送消息、追问或写回 RingCentral。`;
}

function threadLinkAriaLabel(session: OutreachSession) {
  return `查看线程：${threadLinkBoundary(session)}`;
}

function sourceMessageLinkBoundary(session: OutreachSession) {
  return `在新标签页打开这条消息跟进的原消息链接，用于核对原始上下文；不会发送新追问、标记已回复、更新 Outreach 状态、写用户画像或写回 RingCentral。当前状态：${statusLabel(session.status)}。`;
}

function sourceMessageLinkAriaLabel(session: OutreachSession) {
  return `打开原消息：${sourceMessageLinkBoundary(session)}`;
}

function openOptionsPage() {
  const url = chrome?.runtime?.getURL
    ? chrome.runtime.getURL('options.html#outreach-config')
    : 'options.html#outreach-config';
  window.open(url, '_blank');
}

function relativeTime(ts: number) {
  const normalized = normalizeTimestamp(ts);
  if (!normalized) return '-';
  const diff = normalized - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60000);
  if (minutes < 1) return diff >= 0 ? '即将' : '刚刚';
  if (minutes < 60) return diff >= 0 ? `${minutes}分钟后` : `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diff >= 0 ? `${hours}小时后` : `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return diff >= 0 ? `${days}天后` : `${days}天前`;
}

function normalizeTimestamp(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return null;
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusClass(statusValue: string) {
  if (statusValue === 'resolved') return 'resolved';
  if (statusValue === 'waiting_reply' || statusValue === 'deferred')
    return 'waiting';
  if (statusValue === 'pending_approval' || statusValue === 'scheduled')
    return 'queued';
  if (statusValue === 'escalated' || statusValue === 'failed') return 'error';
  if (statusValue === 'no_reply') return 'warn';
  return 'muted';
}

function statusLabel(statusValue: string) {
  if (statusValue === 'pending_approval') return '待审批';
  if (statusValue === 'scheduled') return '已排程';
  if (statusValue === 'waiting_reply') return '等待回复';
  if (statusValue === 'deferred') return '延期等待';
  if (statusValue === 'resolved') return '已拿到结果';
  if (statusValue === 'no_reply') return '无回复';
  if (statusValue === 'escalated') return '已升级';
  if (statusValue === 'cancelled') return '已取消';
  if (statusValue === 'failed') return '失败';
  return statusValue || '未知';
}

function originLabel(originKind?: string) {
  if (originKind === 'reflection_action' || originKind === 'reflection')
    return '自我反思';
  if (originKind === 'message_reaction') return '消息跟进';
  if (originKind === 'scheduled_template' || originKind === 'manual_action')
    return '手动/定时';
  return originKind || '未知来源';
}

function isMessageReactionSession(session: OutreachSession) {
  return session.originKind === 'message_reaction';
}

function messageReactionSourceUrl(session: OutreachSession): string {
  if (!isMessageReactionSession(session)) return '';
  const raw = session.outcome?.messageUrl;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function formatTarget(targetType?: string, targetRef?: string) {
  const normalizedRef = targetRef?.trim();
  if (!normalizedRef) return '未指定目标';
  if (
    (targetType === 'person' || targetType === 'private') &&
    normalizedRef === 'user'
  ) {
    return '当前用户';
  }
  return normalizedRef;
}

function templateTargetResolutionLabel(
  item: OutreachTemplateRuntimeStatusItem,
) {
  if (item.latestSession?.targetResolutionStatus === 'resolved') {
    return `已确认：${
      item.latestSession.targetResolvedLabel || item.latestSession.targetRef
    }`;
  }
  if (item.latestSession?.targetResolutionStatus === 'ambiguous') {
    return '待你确认目标';
  }
  return '运行时解析';
}

function templateStageHint(item: OutreachTemplateRuntimeStatusItem) {
  const nextDispatchAt = resolveTemplateNextDispatchAt(item);
  const latest = item.latestSession;
  if (!nextDispatchAt) {
    return '计划时间暂未解析，不会自动生成下一次主动询问会话。';
  }
  if (latest && TERMINAL_OUTREACH_STATUSES.has(latest.status)) {
    return `上次执行${statusLabel(
      latest.status,
    )}；这条计划仍保留，下一次预计 ${relativeTime(nextDispatchAt)} 重新进入处理。`;
  }
  return `计划尚未生成下一次会话；预计 ${relativeTime(
    nextDispatchAt,
  )} 进入 Outreach 引擎处理。`;
}

function templateHandoffReceipt(
  item: OutreachTemplateRuntimeStatusItem,
): HandoffReceipt {
  const nextDispatchAt = resolveTemplateNextDispatchAt(item);
  const target = formatTarget(item.template.targetType, item.template.targetRef);
  const latest = item.latestSession;
  const targetBoundary =
    latest?.targetResolutionStatus === 'ambiguous' ||
    latest?.targetResolutionStatus === 'unresolved'
      ? '边界：上次目标未唯一确认，下一次仍会停在待审批/详情确认，不会跳过目标确认。'
      : '边界：这只是待触发计划，还不是已经发出的消息；刷新列表不会立即发送。';
  const latestRecovery = latest?.id
    ? `恢复：可查看上次执行（${statusLabel(
        latest.status,
      )}）或回到定时消息计划调整目标、问题和时间。`
    : '恢复：需要调整目标、问题或时间时，回到定时消息计划修改。';

  return {
    title: '计划推进回执',
    tone: 'default',
    items: [
      nextDispatchAt
        ? `下一步：预计 ${relativeTime(nextDispatchAt)} 由 Outreach 引擎为 ${target} 生成下一次会话。`
        : '下一步：先修复计划时间，当前不会生成下一次会话。',
      targetBoundary,
      latestRecovery,
    ],
  };
}

function sessionTargetResolutionLabel(session: OutreachSession) {
  if (session.targetResolutionStatus === 'resolved') {
    return `已确认：${session.targetResolvedLabel || session.targetRef}`;
  }
  if (session.targetResolutionStatus === 'ambiguous') {
    return '待你确认目标';
  }
  if (session.targetResolutionStatus === 'unresolved') {
    return '目标未解析';
  }
  return '原始目标文本';
}

function canApproveSession(session: OutreachSession) {
  return session.targetResolutionStatus === 'resolved';
}

function preDispatchEvidenceLabel(session: OutreachSession) {
  if (session.status !== 'pending_approval' && session.status !== 'scheduled') {
    return '';
  }
  const snapshot = evidenceSnapshot(session);
  return (
    extractOutcomeSummary(session.outcome) ||
    session.replyRawText?.trim() ||
    snapshot.summary ||
    snapshot.relatedMessage ||
    (snapshot.hasEvidence ? '已有结构化证据或回复线索' : '')
  );
}

function shouldForceDetailReviewBeforeApprove(session: OutreachSession) {
  return (
    session.status === 'pending_approval' &&
    canApproveSession(session) &&
    Boolean(preDispatchEvidenceLabel(session))
  );
}

function approvalListReviewReceipt(session: OutreachSession): HandoffReceipt | null {
  const evidenceLabel = preDispatchEvidenceLabel(session);
  if (!evidenceLabel || session.status !== 'pending_approval') {
    return null;
  }
  return {
    title: '列表发送前复核',
    tone: 'warn',
    items: [
      `已有证据/回复线索：${truncateInlineText(evidenceLabel)}。`,
      '下一步：先进详情页核对发送前复核，再决定批准、取消或编辑问题。',
      '边界：列表不会在已有线索时直接批准发送，避免绕过详情复核重复打扰外部对象。',
    ],
  };
}

function approveButtonLabel(session: OutreachSession) {
  if (!canApproveSession(session)) return '先确认目标';
  if (shouldForceDetailReviewBeforeApprove(session)) return '先到详情复核';
  return '批准发送';
}

function approveButtonTitle(session: OutreachSession) {
  if (!canApproveSession(session)) {
    return '目标未确认，进入详情选择唯一 RingCentral 用户或群组后才能批准。';
  }
  if (shouldForceDetailReviewBeforeApprove(session)) {
    return '这条会话已有证据或回复线索，请先进详情复核后再决定是否批准发送。';
  }
  return '批准后才会交给 Outreach 引擎处理；是否已发出仍以事件和等待回复状态为准。';
}

function approveButtonAriaLabel(session: OutreachSession) {
  return `${approveButtonLabel(session)}：${approveButtonTitle(session)}`;
}

function listActionButtonTitle(
  action: 'cancel' | 'retry',
  session: OutreachSession,
) {
  if (action === 'cancel') {
    return '取消会请求 Memory Service 停止这条主动询问后续发送、检查和追问；不会撤回已发 RingCentral 消息、删除来源证据或写用户画像。';
  }
  const nextStatus = session.requiresApproval ? '待审批' : '已排程';
  return `重试会请求 Memory Service 将这个终态会话重置为「${nextStatus}」并写入 retried 审计；不会直接发送、确认回复或清除旧错误。`;
}

function listActionButtonAriaLabel(
  action: 'cancel' | 'retry',
  session: OutreachSession,
) {
  const label = action === 'cancel' ? '取消' : '重试';
  return `${label}：${listActionButtonTitle(action, session)}`;
}

function truncateInlineText(value: string, maxLength = 96) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function canRetrySession(session: OutreachSession) {
  return (
    session.status === 'failed' ||
    session.status === 'no_reply' ||
    session.status === 'escalated'
  );
}

function canContinueFollowup(session: OutreachSession) {
  return (
    Boolean(session.sentChatId) &&
    (session.status === 'resolved' ||
      session.status === 'no_reply' ||
      session.status === 'escalated' ||
      session.status === 'failed')
  );
}

function openContinueFollowup(sessionId: string) {
  void router.push({
    path: `/outreach/${encodeURIComponent(sessionId)}`,
    query: { continueFollowup: '1' },
  });
}

function continueFollowupListButtonTitle(session: OutreachSession) {
  return `打开会话详情配置下次追问间隔和次数；当前状态是「${statusLabel(session.status)}」。这次点击不会发送消息或重发原问题。`;
}

function continueFollowupListButtonAriaLabel(session: OutreachSession) {
  return `继续追问：${continueFollowupListButtonTitle(session)}`;
}

function targetTypeLabel(targetType?: string) {
  if (targetType === 'private') return '私聊';
  if (targetType === 'group') return '群组';
  if (targetType === 'person') return '联系人';
  return targetType || '未知目标';
}

function templateSyncStateLabel(syncState?: string) {
  if (syncState === 'synced' || !syncState) return '已同步';
  if (syncState === 'sync_error') return '同步失败';
  if (syncState === 'paused') return '已暂停';
  if (syncState === 'cancelled') return '已取消';
  return syncState;
}

function templateListRoute(item: OutreachTemplateRuntimeStatusItem) {
  return `/outreach?templateId=${encodeURIComponent(item.template.id)}`;
}

function resolveTemplateNextDispatchAt(
  item: OutreachTemplateRuntimeStatusItem,
): number | null {
  const raw = item.template.scheduleSpec?.nextDispatchAt;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const scheduleDate =
    typeof item.template.scheduleSpec?.scheduleDate === 'string'
      ? item.template.scheduleSpec.scheduleDate
      : '';
  const scheduleTime =
    typeof item.template.scheduleSpec?.scheduleTime === 'string'
      ? item.template.scheduleSpec.scheduleTime
      : '09:00';
  const repeatEvery = Number(item.template.scheduleSpec?.repeatEvery);
  const repeatUnit =
    typeof item.template.scheduleSpec?.repeatUnit === 'string'
      ? item.template.scheduleSpec.repeatUnit
      : '';
  if (!scheduleDate) return null;
  const date = new Date(
    `${scheduleDate}T${
      scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime
    }`,
  );
  if (Number.isNaN(date.getTime())) return null;
  const baseline = Math.floor(Date.now() / 1000);

  if (Number.isFinite(repeatEvery) && repeatEvery > 0 && repeatUnit) {
    const candidate = new Date(date.getTime());
    while (Math.floor(candidate.getTime() / 1000) <= baseline) {
      if (repeatUnit === 'Day') {
        candidate.setDate(candidate.getDate() + repeatEvery);
      } else if (repeatUnit === 'Week') {
        candidate.setDate(candidate.getDate() + repeatEvery * 7);
      } else if (repeatUnit === 'Month') {
        candidate.setMonth(candidate.getMonth() + repeatEvery);
      } else if (repeatUnit === 'Year') {
        candidate.setFullYear(candidate.getFullYear() + repeatEvery);
      } else {
        break;
      }
    }
    const nextAt = Math.floor(candidate.getTime() / 1000);
    return nextAt > baseline ? nextAt : null;
  }

  const nextAt = Math.floor(date.getTime() / 1000);
  return nextAt > baseline ? nextAt : null;
}

function isPendingTemplate(item: OutreachTemplateRuntimeStatusItem): boolean {
  const template = item.template;
  const nextDispatchAt = resolveTemplateNextDispatchAt(item);
  if (template.enabled === false) return false;
  if (template.syncState && template.syncState !== 'synced') return false;
  if (!nextDispatchAt) return false;
  return (
    !item.latestSession ||
    TERMINAL_OUTREACH_STATUSES.has(item.latestSession.status)
  );
}

function matchesTemplateFilters(
  item: OutreachTemplateRuntimeStatusItem,
): boolean {
  if (status.value !== 'all' && status.value !== 'scheduled') return false;
  if (originKind.value && originKind.value !== 'manual') return false;
  if (threadId.value.trim()) return false;
  if (templateId.value.trim() && item.template.id !== templateId.value.trim())
    return false;
  return true;
}

function sortTemplatesForDisplay(items: OutreachTemplateRuntimeStatusItem[]) {
  return [...items].sort((a, b) => {
    const aNext = resolveTemplateNextDispatchAt(a) ?? Number.MAX_SAFE_INTEGER;
    const bNext = resolveTemplateNextDispatchAt(b) ?? Number.MAX_SAFE_INTEGER;
    return aNext - bNext;
  });
}

function sortSessionsForDisplay(items: OutreachSession[]): OutreachSession[] {
  const priority = new Map<string, number>([
    ['pending_approval', 0],
    ['waiting_reply', 1],
    ['deferred', 2],
    ['scheduled', 3],
    ['escalated', 4],
    ['no_reply', 5],
    ['failed', 6],
    ['resolved', 7],
    ['cancelled', 8],
  ]);

  return [...items].sort((a, b) => {
    if (status.value === 'all') {
      const statusDiff =
        (priority.get(a.status) ?? 99) - (priority.get(b.status) ?? 99);
      if (statusDiff !== 0) {
        return statusDiff;
      }
    }

    const aTime = normalizeTimestamp(a.updatedAt || a.createdAt || 0) ?? 0;
    const bTime = normalizeTimestamp(b.updatedAt || b.createdAt || 0) ?? 0;
    return bTime - aTime;
  });
}

function isRingCentralReady(config: RuntimeConfigResponse) {
  return (
    Boolean(config.ringCentralServerUrl?.trim()) &&
    Boolean(config.ringCentralClientId?.trim()) &&
    Boolean(config.ringCentralClientSecretConfigured) &&
    Boolean(config.ringCentralJwtConfigured)
  );
}

function sessionStageHint(session: OutreachSession) {
  const summary = extractOutcomeSummary(session.outcome);
  if (session.status === 'pending_approval') {
    if (session.targetResolutionStatus !== 'resolved') {
      return '目标还没有解析成明确的 RingCentral 用户/群组，需先进入详情确认目标。';
    }
    if (session.nextCheckAt) {
      return `已找到询问对象 ${formatTarget(
        session.targetType,
        session.targetRef,
      )}。批准后会按计划在 ${relativeTime(session.nextCheckAt)} 发出。`;
    }
    return `已找到询问对象 ${formatTarget(
      session.targetType,
      session.targetRef,
    )}，等待你确认是否真的发出。`;
  }
  if (session.status === 'scheduled') {
    if (session.nextCheckAt) {
      return `已完成审批或无需审批，计划在 ${relativeTime(
        session.nextCheckAt,
      )} 发出。`;
    }
    return '已完成审批或无需审批，等待引擎真正发出。';
  }
  if (session.status === 'waiting_reply') {
    if (isMessageReactionSession(session)) {
      return '这条跟进来自原始消息；系统会先检查当前会话是否已有满足目标的回复，没命中才在等待时间后追问。';
    }
    return '消息已发出，当前正在等待对方回复。';
  }
  if (session.status === 'deferred') {
    return '对方表示稍后回复，系统会按新的等待时间继续跟进。';
  }
  if (session.status === 'resolved') {
    const resolutionState =
      typeof session.outcome?.resolutionState === 'string'
        ? session.outcome.resolutionState
        : '';
    if (resolutionState === 'partial') {
      return summary || '已经拿到部分可用结果，系统正在继续查证。';
    }
    if (resolutionState === 'insufficient') {
      return summary || '已经收到线索，但仍需继续查证或等待人工判断。';
    }
    return summary ? `已经拿到可用结果。${summary}` : '已经拿到可用结果。';
  }
  if (session.status === 'no_reply') {
    return summary || '已经超过追问额度，仍然没有收到回复。';
  }
  if (session.status === 'escalated') {
    return summary || '系统判断需要你介入决定下一步。';
  }
  if (session.status === 'failed') {
    return session.errorMessage || '发送或推进过程中失败。';
  }
  if (session.status === 'cancelled') {
    return '这条主动询问已被取消。';
  }
  return '状态未知。';
}

function sessionHandoffReceipt(session: OutreachSession): HandoffReceipt {
  const target = formatTarget(session.targetType, session.targetRef);
  if (session.status === 'pending_approval') {
    if (session.targetResolutionStatus !== 'resolved') {
      return {
        title: '会话推进回执',
        tone: 'warn',
        items: [
          '下一步：进入详情确认唯一 RingCentral 用户或群组后才能批准。',
          '边界：目标未确认前不会发送外部消息，也不会自动追问。',
          '恢复：可取消这次询问，或保留在待审批队列稍后处理。',
        ],
      };
    }
    return {
      title: '会话推进回执',
      tone: 'warn',
      items: [
        `下一步：你批准后才会向 ${target} 发出询问。`,
        '边界：批准发送不等于确认答案，后续仍会等待回复或追问。',
        '恢复：发送前仍可进入详情修改目标、问题或计划时间。',
      ],
    };
  }

  if (session.status === 'scheduled') {
    const sendTiming = session.nextCheckAt
      ? `计划在 ${relativeTime(session.nextCheckAt)} 由引擎发出。`
      : '等待 Outreach 引擎恢复后发出。';
    return {
      title: '会话推进回执',
      tone: 'default',
      items: [
        `下一步：${sendTiming}`,
        '边界：刷新列表不会立即发送，也不会跳过目标解析结果。',
        '恢复：发出前可进入详情修改或取消这次会话。',
      ],
    };
  }

  if (session.status === 'waiting_reply' || session.status === 'deferred') {
    const waitWindow = session.waitUntil
      ? `等待窗口到 ${relativeTime(session.waitUntil)}。`
      : '当前没有明确等待截止时间。';
    const nextCheck = session.nextCheckAt
      ? `下次检查在 ${relativeTime(session.nextCheckAt)}。`
      : '暂未排定下次检查。';
    return {
      title: '会话推进回执',
      tone: 'warn',
      items: [
        isMessageReactionSession(session)
          ? '下一步：先检查原消息线程是否已有满足目标的回复，未命中才继续追问。'
          : `下一步：${waitWindow} ${nextCheck}`,
        '边界：不会在等待窗口内重复打扰同一目标。',
        messageReactionSourceUrl(session)
          ? '恢复：可打开原消息核对上下文，或进入详情检查回复归因。'
          : '恢复：可进入详情检查回复归因、追问额度和时间线。',
      ],
    };
  }

  if (session.status === 'resolved') {
    return {
      title: '会话推进回执',
      tone: 'success',
      items: [
        '下一步：结果已进入这条会话的结构化结果或回复记录。',
        '边界：已完成会话不会自动再次发送外部消息。',
        '恢复：如果结果不足，进入详情复核后再决定是否重新发起。',
      ],
    };
  }

  if (canRetrySession(session)) {
    const failureReason =
      session.errorMessage || extractOutcomeSummary(session.outcome);
    return {
      title: '会话推进回执',
      tone: 'danger',
      items: [
        '下一步：可点重试，把这条终态会话重置到新一轮处理。',
        failureReason
          ? `边界：重试前先确认旧失败原因：${failureReason}`
          : '边界：重试会保留旧终态和 retried 审计事件，不会伪装成新建会话。',
        '恢复：先确认 RingCentral、目标对象或原消息仍可用，再重试。',
      ],
    };
  }

  if (session.status === 'cancelled') {
    return {
      title: '会话推进回执',
      tone: 'default',
      items: [
        '下一步：这条会话已停止推进。',
        '边界：取消状态不会自动恢复或重新发送。',
        '恢复：需要时从原始场景重新发起新的主动询问。',
      ],
    };
  }

  return {
    title: '会话推进回执',
    tone: 'default',
    items: [
      '下一步：进入详情查看时间线和最新事件。',
      '边界：列表只展示当前状态，不会替你发送或确认答案。',
      '恢复：根据详情里的目标、回复和错误记录决定下一步。',
    ],
  };
}

function extractOutcomeSummary(outcome?: Record<string, unknown>) {
  if (!outcome) return '';
  const candidates = [
    outcome.resolvedConclusion,
    outcome.summary,
    outcome.reason,
    outcome.answer,
    outcome.answerText,
    outcome.reply,
  ];
  const found = candidates.find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
  return typeof found === 'string' ? found.trim() : '';
}

function evidenceSnapshot(session: OutreachSession) {
  return getOutreachEvidenceSnapshot(session);
}

function evidenceMentionLabels(
  session: OutreachSession,
): Record<string, string> {
  return collectEvidenceMentionLabels(session);
}
</script>

<style scoped>
.outreach-page {
  animation: fadeInUp 0.5s ease-out;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.page-header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.35rem;
}

.page-header p {
  color: #94a3b8;
  font-size: 0.9rem;
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: flex-start;
}

.summary-pill {
  padding: 0.24rem 0.62rem;
  border-radius: 999px;
  font-size: 0.78rem;
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
}

.summary-pill.warn {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
}

.summary-pill.danger {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.setup-banner {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.setup-title {
  font-weight: 700;
  color: #fcd34d;
  margin-bottom: 0.35rem;
}

.setup-text {
  margin: 0;
  color: #fde68a;
  line-height: 1.5;
}

.setup-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 1rem;
  cursor: pointer;
  background: #f59e0b;
  color: #111827;
  font-weight: 600;
}

.info-banner {
  margin-bottom: 1rem;
  padding: 0.95rem 1.05rem;
  border-radius: 1rem;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(129, 140, 248, 0.24);
}

.info-banner-title {
  font-weight: 700;
  color: #c4b5fd;
  margin-bottom: 0.35rem;
}

.info-banner-text {
  margin: 0;
  color: #ddd6fe;
  line-height: 1.55;
}

.triage-banner {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 0.8rem;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(125, 211, 252, 0.22);
}

.triage-banner.warn {
  background: rgba(120, 53, 15, 0.2);
  border-color: rgba(245, 158, 11, 0.28);
}

.triage-banner.danger {
  background: rgba(127, 29, 29, 0.22);
  border-color: rgba(248, 113, 113, 0.3);
}

.triage-banner.success {
  background: rgba(20, 83, 45, 0.16);
  border-color: rgba(34, 197, 94, 0.24);
}

.triage-copy {
  min-width: 0;
}

.triage-title {
  color: #e2e8f0;
  font-size: 0.84rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.triage-banner ul {
  margin: 0;
  padding-left: 1.1rem;
  color: #cbd5e1;
  line-height: 1.55;
  font-size: 0.84rem;
}

.triage-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.42rem;
  max-width: 23rem;
}

.triage-stats span {
  padding: 0.2rem 0.52rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  font-size: 0.75rem;
  white-space: nowrap;
}

.focus-lane {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 28rem);
  gap: 1rem;
  align-items: stretch;
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 0.8rem;
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(125, 211, 252, 0.24);
}

.focus-lane.warn {
  background: rgba(120, 53, 15, 0.18);
  border-color: rgba(245, 158, 11, 0.3);
}

.focus-lane.danger {
  background: rgba(127, 29, 29, 0.2);
  border-color: rgba(248, 113, 113, 0.34);
}

.focus-lane.success {
  background: rgba(20, 83, 45, 0.14);
  border-color: rgba(34, 197, 94, 0.24);
}

.focus-copy {
  min-width: 0;
}

.focus-eyebrow {
  color: #7dd3fc;
  font-size: 0.76rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.focus-lane.warn .focus-eyebrow {
  color: #fcd34d;
}

.focus-lane.danger .focus-eyebrow {
  color: #fca5a5;
}

.focus-title {
  color: #e2e8f0;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.focus-copy h3 {
  margin: 0 0 0.45rem;
  color: #f8fafc;
  font-size: 1rem;
  line-height: 1.35;
}

.focus-copy p {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.55;
}

.focus-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.8rem;
}

.focus-meta span {
  padding: 0.2rem 0.52rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  font-size: 0.75rem;
}

.focus-action-panel {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem;
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.56);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.focus-action {
  align-self: flex-start;
  padding: 0.55rem 0.8rem;
  border-radius: 0.65rem;
  background: #38bdf8;
  color: #082f49;
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
}

.focus-boundary-title {
  color: #e2e8f0;
  font-size: 0.8rem;
  font-weight: 700;
}

.focus-action-panel ul {
  margin: 0;
  padding-left: 1.1rem;
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.5;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.filter-select,
.filter-input,
.refresh-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 0.95rem;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
}

.filter-input {
  min-width: 9rem;
}

.refresh-btn {
  cursor: pointer;
  background: rgba(30, 41, 59, 0.84);
}

.filter-scope-receipt {
  margin-bottom: 1rem;
}

.load-error-banner {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.05rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: rgba(127, 29, 29, 0.26);
  border: 1px solid rgba(248, 113, 113, 0.32);
}

.load-error-title {
  font-weight: 700;
  color: #fecaca;
  margin-bottom: 0.35rem;
}

.load-error-text {
  margin: 0;
  color: #fee2e2;
  line-height: 1.5;
}

.load-error-text.muted {
  color: #fca5a5;
  margin-top: 0.25rem;
}

.retry-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.72rem 1rem;
  cursor: pointer;
  background: #ef4444;
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
}

.error-empty p {
  color: #fecaca;
}

.title-link {
  color: #e2e8f0;
  text-decoration: none;
}

.title-link:hover {
  text-decoration: underline;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-section {
  margin-bottom: 1.25rem;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.3rem;
}

.group-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.group-count {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
  font-size: 0.76rem;
}

.group-desc {
  margin: 0 0 0.85rem;
  color: #94a3b8;
  font-size: 0.84rem;
}

.session-card {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  padding: 1.1rem;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.card-head h3 {
  margin-bottom: 0.45rem;
}

.context-text {
  color: #cbd5e1;
  line-height: 1.55;
}

.head-badges,
.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.head-badges {
  align-self: flex-start;
  align-items: center;
  justify-content: flex-end;
  max-width: 60%;
}

.card-meta {
  margin-top: 0.8rem;
  color: #94a3b8;
  font-size: 0.82rem;
}

.stage-line {
  margin-top: 0.8rem;
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.5;
}

.handoff-receipt {
  margin-top: 0.72rem;
  padding: 0.78rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(30, 41, 59, 0.56);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.handoff-receipt.warn {
  background: rgba(120, 53, 15, 0.2);
  border-color: rgba(245, 158, 11, 0.26);
}

.handoff-receipt.success {
  background: rgba(20, 83, 45, 0.18);
  border-color: rgba(34, 197, 94, 0.24);
}

.handoff-receipt.danger {
  background: rgba(127, 29, 29, 0.22);
  border-color: rgba(248, 113, 113, 0.28);
}

.handoff-title {
  color: #e2e8f0;
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 0.42rem;
}

.handoff-receipt ul {
  margin: 0;
  padding-left: 1.05rem;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.55;
}

.handoff-receipt li + li {
  margin-top: 0.2rem;
}

.evidence-box {
  margin-top: 0.8rem;
  padding: 0.9rem 1rem;
  border-radius: 0.95rem;
  background: rgba(15, 23, 42, 0.54);
  border: 1px solid rgba(96, 165, 250, 0.16);
}

.evidence-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-bottom: 0.55rem;
}

.evidence-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #bfdbfe;
}

.evidence-pill {
  padding: 0.2rem 0.56rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
  font-size: 0.74rem;
}

.evidence-pill.muted {
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}

.evidence-summary,
.evidence-related {
  margin: 0;
  color: #e2e8f0;
  line-height: 1.55;
}

.evidence-related {
  margin-top: 0.45rem;
  color: #cbd5e1;
  font-size: 0.86rem;
}

:deep(.rich-evidence-text) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

:deep(.rich-evidence-link) {
  color: #7dd3fc;
  text-decoration: underline;
  text-underline-offset: 0.16em;
}

.badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0.01em;
  white-space: nowrap;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.24);
}

.badge.muted {
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.22);
}

.badge.evidence {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.28);
}

.badge.queued {
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
  border-color: rgba(14, 165, 233, 0.28);
}

.badge.waiting {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.28);
}

.badge.resolved {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.28);
}

.badge.error {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.28);
}

.badge.warn {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
  border-color: rgba(245, 158, 11, 0.28);
}

.session-link {
  color: #7dd3fc;
  text-decoration: none;
}

.session-link:hover {
  text-decoration: underline;
}

.card-actions {
  display: flex;
  gap: 0.7rem;
  margin-top: 0.9rem;
}

.inline-btn {
  border: none;
  border-radius: 0.7rem;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
  font-size: 0.84rem;
}

.inline-btn.primary {
  background: #22c55e;
  color: #052e16;
  font-weight: 700;
}

.inline-btn.ghost {
  background: rgba(148, 163, 184, 0.16);
  color: #e2e8f0;
}

.inline-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.inline-link {
  display: inline-flex;
  align-items: center;
  color: #7dd3fc;
  text-decoration: none;
  font-size: 0.84rem;
}

.inline-link:hover {
  text-decoration: underline;
}

.reply-box,
.result-box {
  margin-top: 0.8rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.8rem;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.box-title {
  margin-bottom: 0.4rem;
  font-weight: 600;
  color: #cbd5e1;
  font-size: 0.85rem;
}

.result-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.55;
}

.loading-container,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.filtered-empty-receipt {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem 1.1rem;
  text-align: left;
  border-radius: 1rem;
  background: rgba(30, 41, 59, 0.56);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.filtered-empty-receipt p {
  margin: 0 0 0.55rem;
  color: #cbd5e1;
  line-height: 1.5;
}

.filtered-empty-receipt ul {
  margin: 0;
  padding-left: 1.05rem;
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.55;
}

.filtered-empty-receipt li + li {
  margin-top: 0.22rem;
}

.clear-filter-btn {
  margin-top: 0.85rem;
  border: none;
  border-radius: 0.8rem;
  padding: 0.68rem 0.95rem;
  cursor: pointer;
  background: #38bdf8;
  color: #082f49;
  font-weight: 700;
}

.loading-spinner {
  width: 2.3rem;
  height: 2.3rem;
  border: 2px solid rgba(56, 189, 248, 0.18);
  border-top: 2px solid #38bdf8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@media (max-width: 900px) {
  .page-header,
  .card-head {
    flex-direction: column;
  }

  .focus-lane {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
