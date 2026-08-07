<template>
  <div class="search-results-section">
    <div class="search-results-header">
      <h2>🔍 搜索结果</h2>
      <p v-if="searchQuery">关键词: "{{ searchQuery }}"</p>
      <p class="scope-caption">范围: {{ currentScopeLabel }}</p>
    </div>
    
    <!-- AI 智能回答区域（仅 overview 模式显示） -->
    <div v-if="searchContext.mode === 'overview' && searchContext.askResult" class="ai-answer-section">
      <div class="ai-answer-header" @click="toggleAiAnswer">
        <div class="header-left">
          <span class="ai-icon">🤖</span>
          <h3>AI 智能分析</h3>
        </div>
        <button class="toggle-btn">
          {{ isAiAnswerExpanded ? '收起 ▲' : '展开 ▼' }}
        </button>
      </div>
      
      <div v-show="isAiAnswerExpanded" class="ai-answer-content">
        <div
          v-if="askAnswerStatusRail"
          :class="[
            'ask-status-rail',
            `ask-status-rail-${askAnswerStatusRail.tone}`,
          ]"
          role="note"
          :aria-label="askAnswerStatusRailBoundary"
          :title="askAnswerStatusRailBoundary"
        >
          <div class="ask-status-rail-main">
            <span class="ask-status-rail-label">
              {{ askAnswerStatusRail.label }}
            </span>
            <span class="ask-status-rail-detail">
              {{ askAnswerStatusRail.detail }}
            </span>
          </div>
          <div
            v-if="askAnswerStatusRail.metrics.length"
            class="ask-status-rail-metrics"
          >
            <span
              v-for="metric in askAnswerStatusRail.metrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>

        <div
          v-if="askTopicLockReceipt"
          class="ask-topic-lock-receipt"
          role="note"
          :aria-label="askTopicLockReceiptBoundary"
          :title="askTopicLockReceiptBoundary"
        >
          <div class="ask-topic-lock-receipt-main">
            <span class="ask-topic-lock-receipt-label">
              {{ askTopicLockReceipt.label }}
            </span>
            <span class="ask-topic-lock-receipt-detail">
              {{ askTopicLockReceipt.detail }}
            </span>
          </div>
          <div class="ask-topic-lock-receipt-metrics">
            <span
              v-for="metric in askTopicLockReceipt.metrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>

        <div
          v-if="askContinuationReceipt"
          class="ask-continuation-receipt"
          role="note"
          :aria-label="askContinuationReceiptBoundary"
          :title="askContinuationReceiptBoundary"
        >
          <div class="ask-continuation-receipt-main">
            <span class="ask-continuation-receipt-label">
              {{ askContinuationReceipt.label }}
            </span>
            <span class="ask-continuation-receipt-detail">
              {{ askContinuationReceipt.detail }}
            </span>
          </div>
          <div class="ask-continuation-receipt-metrics">
            <span
              v-for="metric in askContinuationReceipt.metrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>

        <div
          v-if="askEvidenceWatchReceipt"
          :class="[
            'answer-memory-receipt',
            `answer-memory-receipt-${askEvidenceWatchReceipt.tone}`,
          ]"
          role="note"
          :aria-label="askEvidenceWatchReceiptBoundary"
          :title="askEvidenceWatchReceiptBoundary"
        >
          <div class="answer-memory-receipt-main">
            <span class="answer-memory-receipt-label">
              {{ askEvidenceWatchReceipt.label }}
            </span>
            <span class="answer-memory-receipt-detail">
              {{ askEvidenceWatchReceipt.detail }}
            </span>
          </div>
          <div
            v-if="askEvidenceWatchReceipt.metrics.length"
            class="answer-memory-receipt-metrics"
          >
            <span
              v-for="metric in askEvidenceWatchReceipt.metrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>

        <div
          v-if="askEvidenceBasisReceipt"
          :class="[
            'answer-memory-receipt',
            `answer-memory-receipt-${askEvidenceBasisReceipt.tone}`,
          ]"
          role="note"
          :aria-label="askEvidenceBasisReceiptBoundary"
          :title="askEvidenceBasisReceiptBoundary"
        >
          <div class="answer-memory-receipt-main">
            <span class="answer-memory-receipt-label">
              {{ askEvidenceBasisReceipt.label }}
            </span>
            <span class="answer-memory-receipt-detail">
              {{ askEvidenceBasisReceipt.detail }}
            </span>
          </div>
          <div
            v-if="askEvidenceBasisReceipt.metrics.length"
            class="answer-memory-receipt-metrics"
          >
            <span
              v-for="metric in askEvidenceBasisReceipt.metrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>

        <!-- 主要回答（支持 Markdown 渲染） -->
        <div class="answer-main" v-html="renderedAnswer"></div>

        <div
          v-if="askClarification"
          class="ask-clarification"
          role="group"
          aria-label="Ask 话题确认"
        >
          <div class="ask-clarification-main">
            <span class="ask-clarification-label">Ask 话题待确认</span>
            <span class="ask-clarification-detail">
              {{ askClarification.summary }}
            </span>
          </div>
          <div
            class="ask-clarification-preflight"
            role="note"
            :aria-label="askClarificationChoiceReceiptBoundary"
            :title="askClarificationChoiceReceiptBoundary"
          >
            <div class="ask-clarification-preflight-main">
              <span class="ask-clarification-preflight-label">
                {{ askClarification.choiceReceipt.label }}
              </span>
              <span class="ask-clarification-preflight-detail">
                {{ askClarification.choiceReceipt.detail }}
              </span>
            </div>
            <div class="ask-clarification-preflight-metrics">
              <span
                v-for="metric in askClarification.choiceReceipt.metrics"
                :key="metric"
              >
                {{ metric }}
              </span>
            </div>
          </div>
          <div class="ask-clarification-actions">
            <button
              v-for="candidate in askClarification.candidates"
              :key="candidate.index"
              type="button"
              class="ask-clarification-button"
              :disabled="isConfirmingAskCandidate || isLoading"
              @click="confirmAskCandidate(candidate)"
            >
              <span class="ask-clarification-index">
                {{ candidate.index }}
              </span>
              <span class="ask-clarification-topic">
                {{ candidate.label }}
              </span>
              <span
                v-if="candidate.reason"
                class="ask-clarification-reason"
              >
                {{ candidate.reason }}
              </span>
            </button>
          </div>
          <p class="ask-clarification-boundary">
            选择后返回的答案仍按本轮证据、查证回执和活答案门控展示。
          </p>
        </div>

        <!-- 缝合证据徽章 (P0-5)：仅当本答案跨 ≥2 来源或 ≥7 天时出现 -->
        <div
          v-if="weaveBadge"
          class="weave-badge"
          :title="weaveBadge.title"
          aria-label="缝合证据"
        >
          <span class="weave-badge-glyph">⊕</span>
          <span class="weave-badge-text">{{ weaveBadge.label }}</span>
        </div>

        <div
          v-if="askScopeReceiptNote"
          :class="[
            'answer-memory-receipt',
            askScopeReceiptIncludesPersonal
              ? 'answer-memory-receipt-warning'
              : 'answer-memory-receipt-info',
          ]"
          role="note"
          :aria-label="askScopeReceiptBoundary"
          :title="askScopeReceiptBoundary"
        >
          <div class="answer-memory-receipt-main">
            <span class="answer-memory-receipt-label">
              检索范围回执
            </span>
            <span class="answer-memory-receipt-detail">
              {{ askScopeReceiptNote }}
            </span>
          </div>
          <div
            v-if="askScopeReceiptMetrics.length"
            class="answer-memory-receipt-metrics"
          >
            <span
              v-for="metric in askScopeReceiptMetrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>

        <div
          v-if="askAttributionReceipt"
          class="answer-memory-receipt answer-memory-receipt-info claim-attribution-receipt"
          role="note"
          :aria-label="askAttributionReceiptBoundary"
          :title="askAttributionReceiptBoundary"
        >
          <div class="answer-memory-receipt-main">
            <span class="answer-memory-receipt-label">归属回执</span>
            <span class="answer-memory-receipt-detail">
              {{ askAttributionReceipt.summary }}
            </span>
            <details
              v-if="askAttributionReceipt.claims?.length"
              class="claim-attribution-details"
            >
              <summary>查看依据或纠正归属</summary>
              <div
                v-for="claim in askAttributionReceipt.claims"
                :key="`${claim.claimId}:${claim.revision}`"
                class="claim-attribution-item"
              >
                <div class="claim-attribution-item-copy">
                  <strong>{{ claim.displayLabel }}</strong>
                  <span>{{ claim.consequence }}</span>
                  <q>{{ claim.excerpt }}</q>
                </div>
                <div
                  v-if="claim.correctionAllowed"
                  class="claim-attribution-actions"
                  aria-label="纠正这条记忆的内容归属"
                >
                  <button
                    v-for="action in claimCorrectionActions"
                    :key="action.value"
                    type="button"
                    :disabled="claimCorrectionPending(claim.claimId)"
                    @click="submitClaimCorrection(claim, action.value)"
                  >
                    {{ action.label }}
                  </button>
                </div>
                <p
                  v-if="claimCorrectionState[claim.claimId]"
                  :class="[
                    'claim-attribution-correction-state',
                    `claim-attribution-correction-${claimCorrectionState[claim.claimId].status}`,
                  ]"
                >
                  {{ claimCorrectionState[claim.claimId].message }}
                </p>
              </div>
            </details>
          </div>
          <div
            v-if="askAttributionReceiptMetrics.length"
            class="answer-memory-receipt-metrics"
          >
            <span
              v-for="metric in askAttributionReceiptMetrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>

        <div
          v-if="answerMemoryReceipt"
          :class="[
            'answer-memory-receipt',
            `answer-memory-receipt-${answerMemoryReceipt.tone || 'info'}`,
          ]"
          role="note"
          :aria-label="answerMemoryReceiptBoundary"
          :title="answerMemoryReceiptBoundary"
        >
          <div class="answer-memory-receipt-main">
            <span class="answer-memory-receipt-label">
              {{ answerMemoryReceipt.label }}
            </span>
            <span class="answer-memory-receipt-detail">
              {{ answerMemoryReceipt.detail }}
            </span>
            <div
              v-if="answerMemoryAuthority"
              :class="[
                'answer-memory-authority',
                `answer-memory-authority-${answerMemoryAuthority.tone}`,
              ]"
              aria-label="活答案权威证据门控"
            >
              <div class="answer-memory-authority-line">
                <span class="answer-memory-authority-label">
                  {{ answerMemoryAuthority.label }}
                </span>
                <span class="answer-memory-authority-summary">
                  {{ answerMemoryAuthority.summary }}
                </span>
              </div>
              <div
                v-if="answerMemoryAuthority.metrics.length"
                class="answer-memory-authority-metrics"
              >
                <span
                  v-for="metric in answerMemoryAuthority.metrics"
                  :key="metric"
                >
                  {{ metric }}
                </span>
              </div>
            </div>
          </div>
          <div class="answer-memory-receipt-metrics">
            <span v-if="answerMemoryReceipt.currentEvidenceCount != null">
              本轮证据 {{ answerMemoryReceipt.currentEvidenceCount }}
            </span>
            <span v-if="answerMemoryReceipt.priorEvidenceCount != null">
              旧证据 {{ answerMemoryReceipt.priorEvidenceCount }}
            </span>
            <span v-if="answerMemoryReceipt.followUpActionCount">
              查证 {{ answerMemoryReceipt.followUpActionCount }}
            </span>
            <span
              v-for="metric in answerMemoryReviewMetrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>

        <div
          v-if="askFollowUpReceipt"
          :class="[
            'answer-memory-receipt',
            `answer-memory-receipt-${askFollowUpReceipt.tone}`,
          ]"
          role="note"
          :aria-label="askFollowUpReceiptBoundary"
          :title="askFollowUpReceiptBoundary"
        >
          <div class="answer-memory-receipt-main">
            <span class="answer-memory-receipt-label">
              {{ askFollowUpReceipt.label }}
            </span>
            <span class="answer-memory-receipt-detail">
              {{ askFollowUpReceipt.detail }}
            </span>
          </div>
          <div
            v-if="askFollowUpReceipt.metrics.length"
            class="answer-memory-receipt-metrics"
          >
            <span
              v-for="metric in askFollowUpReceipt.metrics"
              :key="metric"
            >
              {{ metric }}
            </span>
          </div>
        </div>
        
        <!-- 结构化信息（如果有） -->
        <div v-if="searchContext.askResult.structuredAnswer" class="answer-structured">
          <!-- 关键发现 -->
          <div v-if="searchContext.askResult.structuredAnswer.keyFindings?.length" class="findings-section">
            <h4>🔍 关键发现</h4>
            <ul>
              <li v-for="(finding, idx) in searchContext.askResult.structuredAnswer.keyFindings" :key="idx">
                {{ finding }}
              </li>
            </ul>
          </div>
          
          <!-- 时间线 -->
          <div v-if="searchContext.askResult.structuredAnswer.timeline?.length" class="timeline-section">
            <h4>⏰ 时间线</h4>
            <div class="timeline-items">
              <div v-for="(item, idx) in searchContext.askResult.structuredAnswer.timeline" :key="idx" class="timeline-item">
                <span class="timeline-date">{{ item.date }}</span>
                <span class="timeline-event">{{ item.event }}</span>
              </div>
            </div>
          </div>
          
          <!-- 深度洞察 -->
          <div v-if="searchContext.askResult.structuredAnswer.insights?.length" class="insights-section">
            <h4>💡 深度洞察</h4>
            <ul>
              <li v-for="(insight, idx) in searchContext.askResult.structuredAnswer.insights" :key="idx">
                {{ insight }}
              </li>
            </ul>
          </div>
        </div>

        <div v-if="decisionEvidenceChain" class="decision-chain-section">
          <div class="decision-chain-header">
            <div>
              <h4>决策证据链</h4>
              <p>{{ decisionEvidenceChain.answerSummary }}</p>
            </div>
            <span class="decision-confidence">
              {{ Math.round((decisionEvidenceChain.confidence || 0) * 100) }}%
            </span>
          </div>

          <div v-if="decisionEvidenceChain.decisionStatement" class="decision-statement">
            {{ decisionEvidenceChain.decisionStatement }}
          </div>

          <div class="decision-chain-grid">
            <div v-if="decisionEvidenceChain.then" class="decision-chain-card">
              <h5>当时依据</h5>
              <p class="decision-conclusion">{{ decisionEvidenceChain.then.conclusion }}</p>
              <ul v-if="decisionEvidenceChain.then.rationale?.length">
                <li v-for="item in decisionEvidenceChain.then.rationale" :key="item">
                  {{ item }}
                </li>
              </ul>
            </div>

            <div v-if="decisionEvidenceChain.now" class="decision-chain-card">
              <h5>现在变化</h5>
              <ul v-if="decisionEvidenceChain.now.changed?.length">
                <li v-for="item in decisionEvidenceChain.now.changed" :key="item">
                  {{ item }}
                </li>
              </ul>
              <p v-if="!decisionEvidenceChain.now.changed?.length" class="decision-muted">
                暂未找到明确变化证据。
              </p>
              <div v-if="decisionEvidenceChain.now.missingEvidence?.length" class="decision-missing">
                <strong>缺少证据</strong>
                <span v-for="item in decisionEvidenceChain.now.missingEvidence" :key="item">
                  {{ item }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="decisionEvidenceRefs.length"
            class="decision-evidence-list"
          >
            <h5>引用证据</h5>
            <div
              v-for="ref in decisionEvidenceRefs.slice(0, 4)"
              :key="`${ref.sourceType}-${ref.sourceId}`"
              class="decision-evidence-item"
            >
              <span class="decision-evidence-source">
                {{ ref.sourceTitle || ref.sourceType }}
              </span>
              <span class="decision-evidence-stance">
                {{ getDecisionStanceLabel(ref.stance) }}
              </span>
              <p>{{ ref.snippet }}</p>
              <button
                v-if="getLinkSafetyState(ref).exploreRoute"
                class="decision-link-btn"
                @click.stop="openExploreLink(ref)"
              >
                在记忆中查看
              </button>
              <div
                v-if="getLinkSafetyState(ref).blockedLabels.length"
                class="link-safety-notes"
                aria-label="隐藏的跳转"
              >
                <span
                  v-for="label in getLinkSafetyState(ref).blockedLabels"
                  :key="label"
                  class="link-safety-note"
                >
                  {{ label }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 元数据 -->
        <div v-if="searchContext.askResult.metadata" class="answer-metadata">
          <span>共引用 {{ searchContext.askResult.metadata.totalEntities }} 条证据</span>
          <span>•</span>
          <span>耗时 {{ searchContext.askResult.metadata.processingTime }}ms</span>
        </div>
      </div>
    </div>

    <!-- 关联实体数据标题 -->
    <div v-if="!isLoading && entities.length > 0" class="entities-section-header">
      <h3>{{ getSectionTitle() }}</h3>
    </div>

    <div v-if="feedbackError" class="feedback-error">
      {{ feedbackError }}
    </div>
    
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>正在搜索...</span>
      <div
        v-if="loadingScopeReceipt"
        class="loading-scope-receipt"
        role="note"
        aria-label="搜索范围请求中"
      >
        <strong>{{ loadingScopeReceipt.title }}</strong>
        <span>{{ loadingScopeReceipt.detail }}</span>
        <div class="loading-scope-receipt-metrics">
          <span
            v-for="metric in loadingScopeReceipt.metrics"
            :key="metric"
          >
            {{ metric }}
          </span>
        </div>
      </div>
    </div>
    
    <div v-else-if="entities.length > 0" class="search-results">
      <div class="results-summary">
        <div class="results-overview">
          <span class="results-count">{{ resultsCountLabel }}</span>
          <span v-if="scopeBreakdownLabel" class="results-scope-breakdown">
            命中范围: {{ scopeBreakdownLabel }}
          </span>
          <span
            v-if="scopeExposureNotice"
            class="scope-exposure-notice"
            role="note"
          >
            {{ scopeExposureNotice }}
          </span>
          <span
            v-if="scopeBoundaryNotice"
            class="scope-boundary-notice"
            role="note"
          >
            {{ scopeBoundaryNotice }}
          </span>
          <button
            v-if="showResultsBroadenScopeAction"
            class="scope-broaden-inline"
            type="button"
            @click="broadenSearchScope"
          >
            搜索全部记忆
          </button>
          <div
            v-if="searchResultBatchReceipt"
            :class="[
              'search-result-batch-receipt',
              `search-result-batch-receipt-${searchResultBatchReceipt.tone}`,
            ]"
            role="note"
            aria-label="结果批次回执"
          >
            <div class="search-result-batch-receipt-main">
              <strong>{{ searchResultBatchReceipt.title }}</strong>
              <span>{{ searchResultBatchReceipt.detail }}</span>
            </div>
            <div class="search-result-batch-receipt-metrics">
              <span
                v-for="metric in searchResultBatchReceipt.metrics"
                :key="metric"
              >
                {{ metric }}
              </span>
            </div>
          </div>
          <div
            v-if="sourceCoverageReceipt"
            :class="[
              'source-coverage-receipt',
              `source-coverage-receipt-${sourceCoverageReceipt.tone}`,
            ]"
            role="note"
            aria-label="来源覆盖回执"
          >
            <div class="source-coverage-receipt-main">
              <strong>{{ sourceCoverageReceipt.title }}</strong>
              <span>{{ sourceCoverageReceipt.detail }}</span>
            </div>
            <div class="source-coverage-receipt-metrics">
              <span
                v-for="metric in sourceCoverageReceipt.metrics"
                :key="metric"
              >
                {{ metric }}
              </span>
            </div>
          </div>
          <div
            v-if="typeFilterReceipt"
            :class="[
              'type-filter-receipt',
              `type-filter-receipt-${typeFilterReceipt.tone}`,
            ]"
            role="note"
            aria-label="类型筛选回执"
          >
            <div class="type-filter-receipt-main">
              <strong>{{ typeFilterReceipt.title }}</strong>
              <span>{{ typeFilterReceipt.detail }}</span>
            </div>
            <div class="type-filter-receipt-metrics">
              <span
                v-for="metric in typeFilterReceipt.metrics"
                :key="metric"
              >
                {{ metric }}
              </span>
              <button
                type="button"
                class="type-filter-reset"
                @click="resetTypeFilter"
              >
                显示全部类型
              </button>
            </div>
          </div>
          <div
            v-if="recallChannelReceipt"
            :class="[
              'recall-channel-receipt',
              `recall-channel-receipt-${recallChannelReceipt.tone}`,
            ]"
            aria-label="召回通道回执"
          >
            <strong>{{ recallChannelReceipt.title }}</strong>
            <span>{{ recallChannelReceipt.summary }}</span>
            <div
              v-if="recallChannelReceipt.diagnostics.length"
              class="recall-channel-reasons"
              aria-label="召回通道原因"
            >
              <span
                v-for="diagnostic in recallChannelReceipt.diagnostics"
                :key="diagnostic"
              >
                {{ diagnostic }}
              </span>
            </div>
            <span>{{ recallChannelReceipt.detail }}</span>
          </div>
          <div
            v-if="evidenceChannelOverlapReceipt"
            :class="[
              'evidence-channel-overlap-receipt',
              `evidence-channel-overlap-receipt-${evidenceChannelOverlapReceipt.tone}`,
            ]"
            role="note"
            aria-label="证据通道交叉回执"
          >
            <div class="evidence-channel-overlap-main">
              <strong>{{ evidenceChannelOverlapReceipt.title }}</strong>
              <span>{{ evidenceChannelOverlapReceipt.summary }}</span>
              <span>{{ evidenceChannelOverlapReceipt.detail }}</span>
            </div>
            <div class="evidence-channel-overlap-metrics">
              <span
                v-for="metric in evidenceChannelOverlapReceipt.metrics"
                :key="metric"
              >
                {{ metric }}
              </span>
            </div>
          </div>
          <div
            v-if="recallChannelDiagnostics.length"
            class="channel-diagnostics"
            aria-label="召回通道状态"
          >
            <span
              v-for="diagnostic in recallChannelDiagnostics"
              :key="diagnostic.channel"
              :class="[
                'channel-diagnostic',
                `channel-diagnostic-${diagnostic.tone}`,
              ]"
              :title="diagnostic.title"
            >
              {{ diagnostic.label }}
            </span>
          </div>
        </div>
        <div class="results-filters">
          <button
            v-for="type in availableTypes"
            :key="type.key"
            type="button"
            :class="['type-filter', { active: selectedTypeFilter === type.key }]"
            :aria-pressed="selectedTypeFilter === type.key"
            :aria-label="getTypeFilterButtonLabel(type)"
            :title="getTypeFilterButtonLabel(type)"
            @click="selectedTypeFilter = type.key"
          >
            <span class="type-filter-main">
              {{ type.icon }} {{ type.name }} ({{ type.count }})
            </span>
            <small>{{ getTypeFilterButtonHint(type) }}</small>
          </button>
        </div>
      </div>
      
      <section
        v-if="navigationReceipt"
        :class="[
          'search-navigation-receipt',
          `search-navigation-receipt-${navigationReceipt.tone}`,
        ]"
        aria-live="polite"
        aria-label="搜索结果打开回执"
      >
        <div class="navigation-receipt-title">
          {{ navigationReceipt.title }}
        </div>
        <ul>
          <li v-for="item in navigationReceipt.items" :key="item">
            {{ item }}
          </li>
        </ul>
      </section>

      <div class="search-results-grid">
        <div 
          v-for="entity in filteredResults" 
          :key="getSearchResultKey(entity)"
          class="search-result-card"
          @click="handleResultClick(entity)"
        >
          <div class="result-header">
            <div class="result-type-indicator">
              <span class="type-icon">{{ getEntityIcon(entity.type) }}</span>
              <span class="type-name">{{ getEntityTypeName(entity.type) }}</span>
            </div>
            <div v-if="entity.relevanceScore" class="relevance-score">
              {{ Math.round(entity.relevanceScore * 100) }}% 匹配
            </div>
            <div v-if="entity.scope" class="scope-badge">
              {{ getScopeLabel(entity.scope) }}
            </div>
          </div>
          
          <div class="result-content">
            <h3
              class="result-title"
              v-html="renderSearchHighlight(entity.name)"
            ></h3>
            <p
              v-if="entity.description"
              class="result-description"
              v-html="renderSearchHighlight(entity.description)"
            ></p>
            <div v-if="getResultMeta(entity).length" class="result-meta">
              <span
                v-for="meta in getResultMeta(entity)"
                :key="meta"
                class="result-meta-item"
              >
                {{ meta }}
              </span>
            </div>
            <div
              :class="[
                'memory-link-safety-status',
                `memory-link-safety-status-${getLinkSafetyStatus(entity).tone}`,
              ]"
              aria-label="链接安全状态"
            >
              <strong>{{ getLinkSafetyStatus(entity).label }}</strong>
              <span>{{ getLinkSafetyStatus(entity).detail }}</span>
              <div
                v-if="getLinkSafetyStatus(entity).metrics.length"
                class="memory-link-safety-metrics"
              >
                <em
                  v-for="metric in getLinkSafetyStatus(entity).metrics"
                  :key="metric"
                >
                  {{ metric }}
                </em>
              </div>
            </div>
            <div
              v-if="getResultChannels(entity).length"
              class="match-reasons"
              aria-label="命中通道"
            >
              <span
                v-for="channel in getResultChannels(entity)"
                :key="channel"
                class="match-reason"
              >
                {{ getRecallChannelLabel(channel) }}
              </span>
            </div>
            <div v-if="entity.tags && entity.tags.length > 0" class="result-tags">
              <span 
                v-for="tag in entity.tags.slice(0, 3)" 
                :key="tag" 
                class="result-tag"
              >
                {{ tag }}
              </span>
              <span v-if="entity.tags.length > 3" class="result-tag more-tags">
                +{{ entity.tags.length - 3 }}
              </span>
            </div>
          </div>

          <div
            v-if="canSubmitResultFeedback(entity)"
            class="result-feedback"
            @click.stop
          >
            <span
              v-if="getFeedbackLabel(entity)"
              :class="[
                'feedback-status',
                getFeedbackStatusTone(entity)
                  ? `feedback-status-${getFeedbackStatusTone(entity)}`
                  : '',
              ]"
            >
              {{ getFeedbackLabel(entity) }}
            </span>
            <div
              v-if="getFeedbackFailureReceipt(entity)"
              :class="[
                'feedback-receipt',
                `feedback-receipt-${getFeedbackFailureReceipt(entity)?.tone}`,
              ]"
              role="alert"
            >
              <strong>{{ getFeedbackFailureReceipt(entity)?.label }}</strong>
              <span>{{ getFeedbackFailureReceipt(entity)?.detail }}</span>
              <span
                v-if="getFeedbackFailureReceipt(entity)?.context"
                class="feedback-receipt-context"
              >
                {{ getFeedbackFailureReceipt(entity)?.context }}
              </span>
              <span
                v-for="effect in getFeedbackFailureReceipt(entity)?.effects || []"
                :key="effect"
                class="feedback-receipt-effect"
              >
                {{ effect }}
              </span>
              <span v-if="getFeedbackFailureReceipt(entity)?.nextStep">
                {{ getFeedbackFailureReceipt(entity)?.nextStep }}
              </span>
            </div>
            <div
              v-else-if="getFeedbackPreflightReceipt(entity)"
              class="feedback-receipt feedback-receipt-preview"
              role="note"
            >
              <strong>{{ getFeedbackPreflightReceipt(entity)?.label }}</strong>
              <span>{{ getFeedbackPreflightReceipt(entity)?.detail }}</span>
              <span
                v-if="getFeedbackPreflightReceipt(entity)?.context"
                class="feedback-receipt-context"
              >
                {{ getFeedbackPreflightReceipt(entity)?.context }}
              </span>
              <span
                v-for="effect in getFeedbackPreflightReceipt(entity)?.effects || []"
                :key="effect"
                class="feedback-receipt-effect"
              >
                {{ effect }}
              </span>
              <span v-if="getFeedbackPreflightReceipt(entity)?.nextStep">
                {{ getFeedbackPreflightReceipt(entity)?.nextStep }}
              </span>
            </div>
            <div
              v-else-if="getFeedbackReceipt(entity)"
              :class="[
                'feedback-receipt',
                `feedback-receipt-${getFeedbackReceipt(entity)?.tone}`,
              ]"
              role="note"
            >
              <strong>{{ getFeedbackReceipt(entity)?.label }}</strong>
              <span>{{ getFeedbackReceipt(entity)?.detail }}</span>
              <span
                v-if="getFeedbackReceipt(entity)?.context"
                class="feedback-receipt-context"
              >
                {{ getFeedbackReceipt(entity)?.context }}
              </span>
              <span
                v-for="effect in getFeedbackReceipt(entity)?.effects || []"
                :key="effect"
                class="feedback-receipt-effect"
              >
                {{ effect }}
              </span>
              <span v-if="getFeedbackReceipt(entity)?.nextStep">
                {{ getFeedbackReceipt(entity)?.nextStep }}
              </span>
              <button
                v-if="shouldShowFeedbackRefreshAction(entity)"
                type="button"
                class="feedback-refresh-btn"
                :title="getFeedbackRefreshBoundary(entity)"
                :aria-label="getFeedbackRefreshBoundary(entity)"
                @click.stop="rerunSearchAfterFeedback(entity)"
              >
                用同一条件重新取证
              </button>
            </div>
            <button
              type="button"
              :class="[
                'feedback-btn',
                'feedback-btn-positive',
                { active: isFeedbackActive(entity, 'positive') },
              ]"
              :aria-pressed="isFeedbackActive(entity, 'positive')"
              :disabled="isFeedbackPending(entity)"
              :title="getFeedbackButtonBoundary(entity, 'positive')"
              :aria-label="getFeedbackButtonBoundary(entity, 'positive')"
              @click.stop="submitResultFeedback(entity, 'positive')"
            >
              有用
            </button>
            <button
              type="button"
              :class="[
                'feedback-btn',
                'feedback-btn-negative',
                { active: isFeedbackActive(entity, 'negative') },
              ]"
              :aria-pressed="isFeedbackActive(entity, 'negative')"
              :disabled="isFeedbackPending(entity)"
              :title="getFeedbackButtonBoundary(entity, 'negative')"
              :aria-label="getFeedbackButtonBoundary(entity, 'negative')"
              @click.stop="submitResultFeedback(entity, 'negative')"
            >
              不相关
            </button>
            <button
              v-if="canClearFeedback(entity)"
              type="button"
              class="feedback-btn clear-feedback-btn"
              :disabled="isFeedbackPending(entity)"
              :title="getFeedbackButtonBoundary(entity, 'clear')"
              :aria-label="getFeedbackButtonBoundary(entity, 'clear')"
              @click.stop="submitResultFeedback(entity, 'clear')"
            >
              撤销
            </button>
          </div>
          
          <div class="result-actions">
            <button
              type="button"
              class="action-btn primary result-open-btn"
              :title="getSearchResultOpenActionLabel(entity)"
              :aria-label="getSearchResultOpenActionLabel(entity)"
              @click.stop="handleResultClick(entity)"
            >
              打开结果
            </button>
            <button
              v-if="getLinkSafetyState(entity).exploreRoute"
              type="button"
              class="action-btn primary"
              :title="getSearchResultMemoryRouteButtonBoundary(entity)"
              :aria-label="getSearchResultMemoryRouteButtonBoundary(entity)"
              @click.stop="openExploreLink(entity)"
            >
              在记忆中查看
            </button>
            <button
              v-if="getLinkSafetyState(entity).sourceUrl"
              type="button"
              class="action-btn secondary"
              :title="getSourceButtonTitle(entity)"
              :aria-label="getSourceButtonTitle(entity)"
              @click.stop="openSourceUrl(entity)"
            >
              打开来源
            </button>
            <button
              v-if="shouldShowDetailsFallback(entity)"
              type="button"
              class="action-btn primary"
              :title="getSearchResultDetailsButtonBoundary(entity)"
              :aria-label="getSearchResultDetailsButtonBoundary(entity)"
              @click.stop="openDetailsFallback(entity)"
            >
              查看详情
            </button>
            <button
              v-if="shouldShowLinkRecoveryDiagnostic(entity)"
              type="button"
              class="action-btn secondary"
              :title="getSearchResultRecoveryDiagnosticButtonBoundary(entity)"
              :aria-label="getSearchResultRecoveryDiagnosticButtonBoundary(entity)"
              @click.stop="copyLinkRecoveryDiagnostic(entity)"
            >
              复制安全诊断
            </button>
            <span
              v-for="label in getLinkSafetyState(entity).blockedLabels"
              :key="label"
              class="link-safety-note"
            >
              {{ label }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="searchFailureReceipt"
      class="search-failure-state"
      role="alert"
    >
      <span class="search-failure-icon">!</span>
      <p class="search-failure-title">真实搜索没有完成</p>
      <p class="search-failure-detail">{{ searchFailureDetail }}</p>
      <div class="search-failure-meta">
        <span>查询: "{{ searchFailureReceipt.query }}"</span>
        <span>范围: {{ getScopeLabel(searchFailureReceipt.scope) }}</span>
        <span>{{ searchFailureModeLabel }}</span>
      </div>
      <p class="search-failure-boundary">
        没有展示模拟记忆；请重试真实后端搜索，或在需要时切换搜索范围。
      </p>
      <div class="search-failure-actions">
        <button
          class="empty-action-btn"
          type="button"
          @click="retryFailedSearch"
        >
          重试真实搜索
        </button>
        <button
          v-if="canBroadenSearchScope"
          class="empty-action-btn"
          type="button"
          @click="broadenSearchScope"
        >
          搜索全部记忆
        </button>
      </div>
    </div>

    <div v-else class="empty-search-state">
      <span>🔍</span>
      <p>没有找到相关结果</p>
      <p class="search-tips">
        当前范围是 {{ currentScopeLabel }}，可以切换范围或换一个更具体的关键词
      </p>
      <div
        v-if="emptySearchReceipt"
        :class="[
          'empty-search-receipt',
          `empty-search-receipt-${emptySearchReceipt.tone}`,
        ]"
        role="note"
        aria-label="真实空结果回执"
      >
        <div class="empty-search-receipt-main">
          <strong>{{ emptySearchReceipt.title }}</strong>
          <span>{{ emptySearchReceipt.detail }}</span>
        </div>
        <div class="empty-search-receipt-metrics">
          <span
            v-for="metric in emptySearchReceipt.metrics"
            :key="metric"
          >
            {{ metric }}
          </span>
        </div>
        <ul class="empty-search-recovery">
          <li
            v-for="action in emptySearchReceipt.recoveryActions"
            :key="action"
          >
            {{ action }}
          </li>
        </ul>
      </div>
      <div
        v-if="emptyRecallChannelReceipt"
        :class="[
          'recall-channel-receipt',
          `recall-channel-receipt-${emptyRecallChannelReceipt.tone}`,
        ]"
        aria-label="空结果召回通道回执"
      >
        <strong>{{ emptyRecallChannelReceipt.title }}</strong>
        <span>{{ emptyRecallChannelReceipt.summary }}</span>
        <div
          v-if="emptyRecallChannelReceipt.diagnostics.length"
          class="recall-channel-reasons"
          aria-label="空结果召回通道原因"
        >
          <span
            v-for="diagnostic in emptyRecallChannelReceipt.diagnostics"
            :key="diagnostic"
          >
            {{ diagnostic }}
          </span>
        </div>
        <span>{{ emptyRecallChannelReceipt.detail }}</span>
      </div>
      <div
        v-if="emptyRecallChannelDiagnostics.length"
        class="channel-diagnostics"
        aria-label="空结果召回通道状态"
      >
        <span
          v-for="diagnostic in emptyRecallChannelDiagnostics"
          :key="diagnostic.channel"
          :class="[
            'channel-diagnostic',
            `channel-diagnostic-${diagnostic.tone}`,
          ]"
          :title="diagnostic.title"
        >
          {{ diagnostic.label }}
        </span>
      </div>
      <button
        v-if="canBroadenSearchScope"
        class="empty-action-btn"
        type="button"
        @click="broadenSearchScope"
      >
        搜索全部记忆
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  chromeAPI,
  useMemoryStore,
  ENTITY_TYPE_CONFIG,
  type AskContinuationReceipt,
} from '../memory-store';
import type {
  MemoryFeedbackAction,
  MemoryFeedbackTargetType,
  RecallScope,
  ClaimAttributionReceiptItem,
  MemoryClaimCorrectionRequest,
} from '../../services/MemoryServiceClient';
import {
  MEMORY_RESULT_TYPE_CONFIG,
  buildMemoryLinkRecoveryCopiedReceipt,
  buildMemoryLinkRecoveryCopyFailureReceipt,
  buildMemoryLinkRecoveryDiagnostic,
  buildMemoryOpenReceipt,
  formatMemoryLinkSafetyStatus,
  formatScopeBreakdownLabel,
  formatScopeBoundaryNotice,
  formatScopeExposureNotice,
  formatEmptySearchReceipt,
  formatEvidenceChannelOverlapReceipt,
  formatRecallChannelDiagnostics,
  formatRecallChannelReceipt,
  formatSearchResultBatchReceipt,
  getRecallChannelLabel,
  getResultChannels,
  getResultMeta,
  getSearchResultKey,
  getMemoryLinkSafetyState,
  getScopeLabel,
  formatSourceCoverageReceipt,
  formatTypeFilterChipAriaLabel,
  formatTypeFilterChipHint,
  formatTypeFilterReceipt,
  renderHighlightedSearchText,
  sanitizeMemoryExploreRoute,
  shouldResetTypeFilter,
  type MemoryOpenReceipt,
} from '../searchResultPresentation';
import { markdownToHtml } from '../utils/markdown';

const route = useRoute();
const router = useRouter();
const store = useMemoryStore();

const searchQuery = computed(() => route.query.q as string || '');
const entities = computed(() => store.entities);
const isLoading = computed(() => store.isLoading);
const searchContext = computed(() => store.searchContext);
const selectedTypeFilter = ref('all');
const isAiAnswerExpanded = ref(true);
const feedbackError = ref('');
const isConfirmingAskCandidate = ref(false);
const navigationReceipt = ref<MemoryOpenReceipt | null>(null);

type SearchFeedbackChoice = Extract<
  MemoryFeedbackAction,
  'positive' | 'negative'
>;
type SearchFeedbackState = SearchFeedbackChoice | 'pending' | 'cleared';
type SearchFeedbackReceiptTone = Exclude<SearchFeedbackState, 'pending'> | 'error';

interface SearchFeedbackReceipt {
  tone: SearchFeedbackReceiptTone;
  label: string;
  detail: string;
  context?: string;
  nextStep?: string;
  effects?: string[];
}

interface SearchFeedbackResponseEffect {
  action: MemoryFeedbackAction;
  previousAction?: MemoryFeedbackAction;
  appliedDelta?: number;
  relevancePatchStatus?: 'patched' | 'cleared' | 'ignored';
  relevancePatchAction?: string;
  clearedPatchCount?: number;
}

interface SearchFeedbackConditionSnapshot {
  query: string;
  scope: RecallScope;
  scopeLabel: string;
  mode: string;
  entityType?: string;
  selectedTypeFilter: string;
  selectedTypeFilterLabel?: string;
  resultPosition?: number;
  visibleCount: number;
  totalCount: number;
  surfaceLabel: string;
  contextLine: string;
}

interface SearchFeedbackFailure {
  action: MemoryFeedbackAction;
  message: string;
  previousState?: SearchFeedbackState;
}

type AnswerMemoryAuthorityDecision =
  | 'authorized_change'
  | 'same_meaning_no_change'
  | 'supporting_only'
  | 'wait_for_authority_source';
type AnswerMemoryAuthorityTone = 'info' | 'success' | 'warning' | 'muted';

interface AnswerMemoryAuthorityView {
  label: string;
  summary: string;
  tone: AnswerMemoryAuthorityTone;
  metrics: string[];
}

type AskFollowUpReceiptTone = 'info' | 'success' | 'warning' | 'muted';

interface AskFollowUpReceiptView {
  label: string;
  detail: string;
  tone: AskFollowUpReceiptTone;
  metrics: string[];
}

type AskEvidenceWatchReceiptTone = 'info' | 'success' | 'warning' | 'muted';

interface AskEvidenceWatchReceiptView {
  label: string;
  detail: string;
  tone: AskEvidenceWatchReceiptTone;
  statusMetric: string;
  metrics: string[];
}

type AskEvidenceBasisReceiptTone = 'info' | 'warning' | 'muted';

interface AskEvidenceBasisReceiptView {
  label: string;
  detail: string;
  tone: AskEvidenceBasisReceiptTone;
  metrics: string[];
}

type AskAnswerStatusRailTone = 'info' | 'success' | 'warning' | 'muted';

interface AskAnswerStatusRailView {
  label: string;
  detail: string;
  tone: AskAnswerStatusRailTone;
  metrics: string[];
}

interface AskAnswerMemoryGateStatus {
  detail: string;
  tone: AskAnswerStatusRailTone;
  metric: string;
}

interface AskClarificationCandidateView {
  index: number;
  label: string;
  reason?: string;
}

interface AskClarificationView {
  summary: string;
  candidates: AskClarificationCandidateView[];
  choiceReceipt: {
    label: string;
    detail: string;
    metrics: string[];
  };
}

interface AskContinuationReceiptView {
  label: string;
  detail: string;
  metrics: string[];
}

interface AskTopicLockReceiptView {
  label: string;
  detail: string;
  metrics: string[];
}

interface LoadingScopeReceiptView {
  title: string;
  detail: string;
  metrics: string[];
}

const feedbackByResultKey = ref<Record<string, SearchFeedbackState>>({});
const feedbackEffectByResultKey = ref<
  Record<string, SearchFeedbackResponseEffect>
>({});
const feedbackConditionByResultKey = ref<
  Record<string, SearchFeedbackConditionSnapshot>
>({});
const feedbackFailureByResultKey = ref<Record<string, SearchFeedbackFailure>>(
  {},
);
const searchFailureReceipt = computed(() => store.searchFailureReceipt);
const claimCorrectionState = ref<
  Record<
    string,
    { status: 'pending' | 'success' | 'error'; message: string }
  >
>({});
const claimCorrectionActions: Array<{
  value: MemoryClaimCorrectionRequest['correction'];
  label: string;
}> = [
  { value: 'not_my_view', label: '不是我的观点' },
  { value: 'reported_speech', label: '这是转述' },
  { value: 'hypothesis', label: '这是建议或假设' },
  { value: 'my_decision', label: '这是我的决定' },
];

const renderedAnswer = computed(() => {
  const ans = searchContext.value.askResult?.answer;
  return ans ? markdownToHtml(ans) : '';
});

const answerMemoryReceipt = computed(() =>
  searchContext.value.askResult?.answerMemory?.receipt,
);

const answerMemoryReviewMetrics = computed(() =>
  formatAnswerMemoryReviewMetrics(answerMemoryReceipt.value),
);

const askScopeReceipt = computed(() => searchContext.value.askResult?.scopeReceipt);

const askAttributionReceipt = computed(
  () => searchContext.value.askResult?.attributionReceipt,
);

const askAttributionReceiptMetrics = computed(() => {
  const receipt = askAttributionReceipt.value;
  if (!receipt) return [];
  const count = (buckets: Array<{ count?: number }> | undefined) =>
    (buckets || []).reduce((total, bucket) => total + (bucket.count || 0), 0);
  const used = count(receipt.used);
  const background = count(receipt.backgroundOnly);
  const blocked = count(receipt.blocked);
  return [
    used > 0 ? `采用 ${used}` : '',
    background > 0 ? `仅作背景 ${background}` : '',
    blocked > 0 ? `未使用 ${blocked}` : '',
    receipt.correctedCount > 0 ? `已纠正 ${receipt.correctedCount}` : '',
  ].filter(Boolean);
});

const askAttributionReceiptBoundary = computed(
  () =>
    askAttributionReceipt.value?.boundary ||
    '归属回执只影响 Personal AI 如何使用派生记忆，不修改原始消息或外部系统。',
);

const claimCorrectionPending = (claimId: string) =>
  claimCorrectionState.value[claimId]?.status === 'pending';

async function submitClaimCorrection(
  claim: ClaimAttributionReceiptItem,
  correction: MemoryClaimCorrectionRequest['correction'],
) {
  if (claimCorrectionPending(claim.claimId)) return;
  claimCorrectionState.value[claim.claimId] = {
    status: 'pending',
    message: '正在更新派生归属…',
  };
  try {
    const idempotencyKey =
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : '') || `ask-claim-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const response = (await chromeAPI.sendMessage({
      type: 'MEMORY_CLAIM_CORRECTION',
      claimId: claim.claimId,
      correction: {
        correction,
        expectedRevision: claim.revision,
        source: 'ask_receipt',
        idempotencyKey,
      },
    })) as any;
    if (!response?.success) {
      throw new Error(response?.error || 'claim_correction_failed');
    }
    claim.revision = response.result.revision;
    claim.corrected = true;
    claimCorrectionState.value[claim.claimId] = {
      status: 'success',
      message: response.result.rawSourceChanged === false
        ? '已更新派生归属；原始消息未修改。'
        : '归属已更新。',
    };
  } catch (error) {
    claimCorrectionState.value[claim.claimId] = {
      status: 'error',
      message:
        error instanceof Error
          ? `未更新：${error.message}`
          : '未更新，请稍后再试。',
    };
  }
}

const askScopeReceiptNote = computed(() => {
  const note = askScopeReceipt.value?.note;
  return typeof note === 'string' ? note.trim() : '';
});

const askScopeReceiptIncludesPersonal = computed(
  () => askScopeReceipt.value?.includesPersonal === true,
);

const askScopeReceiptMetrics = computed(() => {
  const receipt = askScopeReceipt.value;
  if (!receipt) return [];
  const returned = receipt.returned || {};
  const candidates = receipt.candidates || {};
  return [
    typeof returned.total === 'number' ? `返回 ${returned.total}` : '',
    typeof returned.work === 'number' ? `工作 ${returned.work}` : '',
    typeof returned.personal === 'number' && returned.personal > 0
      ? `个人 ${returned.personal}`
      : '',
    typeof candidates.total === 'number' && candidates.total !== returned.total
      ? `候选 ${candidates.total}`
      : '',
  ].filter(Boolean);
});

const answerMemoryAuthority = computed(() =>
  formatAnswerMemoryAuthority(
    searchContext.value.askResult?.answerMemory?.authority,
  ),
);

const answerMemoryReceiptBoundary = computed(() =>
  formatAnswerMemoryReceiptBoundary(
    answerMemoryReceipt.value,
    answerMemoryAuthority.value,
    answerMemoryReviewMetrics.value,
  ),
);

const askFollowUpReceipt = computed(() =>
  formatAskFollowUpReceipt(searchContext.value.askResult),
);

const askFollowUpReceiptBoundary = computed(() =>
  formatAskReceiptCardBoundary({
    label: askFollowUpReceipt.value
      ? `Ask 查证与缺口回执：${askFollowUpReceipt.value.label}`
      : undefined,
    detail: askFollowUpReceipt.value?.detail,
    metrics: askFollowUpReceipt.value?.metrics,
    fallbackLabel: 'Ask 查证与缺口回执',
    boundary:
      '这是本轮 Ask 的查证与缺口状态；查看这张卡不会执行队列动作、创建新的查证动作、确认结论、代表你发消息、写活答案或外部写入。',
  }),
);

const askEvidenceWatchReceipt = computed(() =>
  formatAskEvidenceWatchReceipt(searchContext.value.askResult?.evidenceWatch),
);

const askEvidenceWatchReceiptBoundary = computed(() =>
  formatAskReceiptCardBoundary({
    label: askEvidenceWatchReceipt.value
      ? `Ask 证据守望回执：${askEvidenceWatchReceipt.value.label}`
      : undefined,
    detail: askEvidenceWatchReceipt.value?.detail,
    metrics: askEvidenceWatchReceipt.value?.metrics,
    fallbackLabel: 'Ask 证据守望回执',
    boundary:
      '这是本轮 Ask response 返回的证据守望状态；查看这张卡不会新增 run、重新触达权威来源、更新最近复核时间、创建外部动作、确认事实或发送消息。',
  }),
);

const askEvidenceBasisReceipt = computed(() =>
  formatAskEvidenceBasisReceipt(searchContext.value.askResult),
);

const askEvidenceBasisReceiptBoundary = computed(() =>
  formatAskReceiptCardBoundary({
    label: askEvidenceBasisReceipt.value?.label,
    detail: askEvidenceBasisReceipt.value?.detail,
    metrics: askEvidenceBasisReceipt.value?.metrics,
    fallbackLabel: 'Ask 证据来源回执',
    boundary:
      '这是当前 Ask response 的可见 evidence 切片摘要；查看这张卡不会重新读取全库或连接器、不确认事实、不写活答案、不创建查证动作或外部写入。',
  }),
);

const askAnswerStatusRail = computed(() =>
  formatAskAnswerStatusRail(
    searchContext.value.askResult,
    answerMemoryAuthority.value,
    askFollowUpReceipt.value,
    askEvidenceWatchReceipt.value,
  ),
);

const askAnswerStatusRailBoundary = computed(() =>
  formatAskReceiptCardBoundary({
    label: askAnswerStatusRail.value?.label,
    detail: askAnswerStatusRail.value?.detail,
    metrics: askAnswerStatusRail.value?.metrics,
    fallbackLabel: 'Ask 本轮状态',
    boundary:
      '这是本轮 Ask 的答案状态快照；查看这张卡不会重新读取记忆、确认事实、写活答案、创建查证动作、代表你发消息或执行外部写入。',
  }),
);

const askTopicLockReceipt = computed(() =>
  formatAskTopicLockReceipt(searchContext.value.askResult),
);

const askTopicLockReceiptBoundary = computed(() =>
  formatAskReceiptCardBoundary({
    label: askTopicLockReceipt.value?.label,
    detail: askTopicLockReceipt.value?.detail,
    metrics: askTopicLockReceipt.value?.metrics,
    fallbackLabel: 'Ask 话题锁定回执',
    boundary:
      '这是本轮 Ask 的检索锚点解释；查看这张卡不会改变锁定 topic、重跑 Ask、确认事实、写活答案、创建查证动作、代表你发送消息或外部写入。',
  }),
);

const askClarification = computed(() =>
  formatAskClarification(searchContext.value.askResult),
);

const askClarificationChoiceReceiptBoundary = computed(() =>
  formatAskReceiptCardBoundary({
    label: askClarification.value
      ? `Ask ${askClarification.value.choiceReceipt.label}`
      : undefined,
    detail: askClarification.value?.choiceReceipt.detail,
    metrics: askClarification.value?.choiceReceipt.metrics,
    fallbackLabel: 'Ask 候选选择回执',
    boundary:
      '这是候选选择前的点击边界；查看这张卡不会提交候选，点击候选也只是继续 Ask，不会确认事实、写活答案、创建外部查证动作、发送消息或外部写入。',
  }),
);

const askContinuationReceipt = computed(() =>
  formatAskContinuationReceipt(
    searchContext.value.askResult?.continuationReceipt,
  ),
);

const askContinuationReceiptBoundary = computed(() =>
  formatAskReceiptCardBoundary({
    label: askContinuationReceipt.value
      ? `Ask ${askContinuationReceipt.value.label}`
      : undefined,
    detail: askContinuationReceipt.value?.detail,
    metrics: askContinuationReceipt.value?.metrics,
    fallbackLabel: 'Ask 承接候选回执',
    boundary:
      '这是上一轮候选选择如何进入本轮检索的解释；查看这张卡不会再次提交 Ask、确认事实、写活答案、创建查证动作、代表你发送消息或外部写入。',
  }),
);

const askScopeReceiptBoundary = computed(() =>
  formatAskReceiptCardBoundary({
    label: 'Ask 检索范围回执',
    detail: askScopeReceiptNote.value,
    metrics: askScopeReceiptMetrics.value,
    fallbackLabel: 'Ask 检索范围回执',
    boundary:
      '这是服务端返回的本轮 Ask 范围快照；查看这张卡不会切换范围、重新搜索、同步外部来源、写反馈、写活答案或确认事实。',
  }),
);

const decisionEvidenceChainBlock = computed(() =>
  searchContext.value.askResult?.blocks?.find(
    (block: any) => block?.type === 'decision_evidence_chain',
  ),
);

const decisionEvidenceChain = computed(
  () => decisionEvidenceChainBlock.value?.payload,
);

const decisionEvidenceRefs = computed(() => {
  const payload = decisionEvidenceChain.value;
  const refs = [
    ...(payload?.then?.evidenceRefs || []),
    ...(payload?.now?.contradictedBy || []),
  ];
  const seen = new Set<string>();
  return refs.filter((ref: any) => {
    const key = `${ref.sourceType}-${ref.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

function isAnswerMemoryAuthorityDecision(
  value: unknown,
): value is AnswerMemoryAuthorityDecision {
  return (
    value === 'authorized_change' ||
    value === 'same_meaning_no_change' ||
    value === 'supporting_only' ||
    value === 'wait_for_authority_source'
  );
}

function formatAnswerMemoryAuthority(
  authority: unknown,
): AnswerMemoryAuthorityView | null {
  if (!authority || typeof authority !== 'object') return null;
  const record = authority as Record<string, any>;
  if (!isAnswerMemoryAuthorityDecision(record.decision)) return null;

  const labels: Record<
    AnswerMemoryAuthorityDecision,
    { label: string; tone: AnswerMemoryAuthorityTone }
  > = {
    authorized_change: {
      label: '权威证据允许更新',
      tone: 'success',
    },
    same_meaning_no_change: {
      label: '同证据同义复核',
      tone: 'info',
    },
    supporting_only: {
      label: '仅辅助证据',
      tone: 'warning',
    },
    wait_for_authority_source: {
      label: '等待新的权威证据',
      tone: 'warning',
    },
  };
  const evidenceRoleLabels: Record<string, string> = {
    authority: '当前权威',
    supporting: '辅助',
    derived: '派生',
    query: '本轮问题',
    prior: '旧 prior',
  };
  const stanceLabels: Record<string, string> = {
    positive: 'ready/已完成',
    negative_or_pending: '未完成/等待',
    partial: '部分完成',
    unknown: '未知',
    informational: '信息型',
  };
  const roleMetrics = Array.isArray(record.evidenceRoles)
    ? record.evidenceRoles
        .filter(
          (role: any) =>
            role &&
            typeof role.role === 'string' &&
            typeof role.count === 'number' &&
            Number.isFinite(role.count) &&
            role.count > 0,
        )
        .map(
          (role: any) =>
            `${evidenceRoleLabels[role.role] || role.role} ${role.count}`,
        )
    : [];
  const currentStance =
    typeof record.currentStance === 'string' ? record.currentStance : '';
  const priorStance =
    typeof record.priorStance === 'string' ? record.priorStance : '';
  const metrics = [
    ...roleMetrics,
    currentStance
      ? `本轮状态 ${stanceLabels[currentStance] || currentStance}`
      : '',
    priorStance ? `旧状态 ${stanceLabels[priorStance] || priorStance}` : '',
    record.suppressedUpdate ? '未写新版本' : '',
  ].filter(Boolean);
  const summary =
    typeof record.summary === 'string' && record.summary.trim()
      ? record.summary
      : labels[record.decision].label;

  return {
    ...labels[record.decision],
    summary,
    metrics,
  };
}

function formatAskResolutionState(value: unknown): string {
  if (value === 'complete') return '已回答';
  if (value === 'partial') return '部分回答';
  if (value === 'insufficient') return '证据不足';
  if (value === 'deferred') return '已转待查';
  return '';
}

function compactAskReceiptText(value: unknown, maxLength = 88): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatAskReceiptCardBoundary(input: {
  label?: unknown;
  detail?: unknown;
  metrics?: unknown;
  fallbackLabel: string;
  boundary: string;
}): string {
  const label =
    compactAskReceiptText(input.label, 48) || input.fallbackLabel;
  const detail = compactAskReceiptText(input.detail, 156);
  const metrics = Array.isArray(input.metrics)
    ? input.metrics
        .map((metric) => compactAskReceiptText(metric, 42))
        .filter(Boolean)
    : [];
  const metricText = metrics.length ? metrics.slice(0, 10).join('；') : '';
  return [label, detail, metricText, input.boundary]
    .filter(Boolean)
    .join(' ');
}

function formatAskWatchTime(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }
  const milliseconds = value > 1_000_000_000_000 ? value : value * 1000;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAnswerMemoryReviewMetrics(receipt: any): string[] {
  if (!receipt || typeof receipt !== 'object') return [];
  const lastVerified = formatAskWatchTime(receipt.lastVerifiedAt);
  const staleAfter = formatAskWatchTime(receipt.staleAfter);
  return [
    lastVerified ? `上次复核 ${lastVerified}` : '',
    staleAfter
      ? receipt.stale
        ? `复核已到期 ${staleAfter}`
        : `下次复核 ${staleAfter}`
      : '',
  ].filter(Boolean);
}

function formatAnswerMemoryReceiptBoundary(
  receipt: any,
  authority: AnswerMemoryAuthorityView | null,
  reviewMetrics: string[],
): string {
  if (!receipt || typeof receipt !== 'object') return '活答案回执';
  const label = compactAskReceiptText(receipt.label, 44) || '活答案回执';
  const detail = compactAskReceiptText(receipt.detail, 124);
  const currentEvidenceCount = readFiniteCount(receipt.currentEvidenceCount);
  const priorEvidenceCount = readFiniteCount(receipt.priorEvidenceCount);
  const followUpActionCount = readFiniteCount(receipt.followUpActionCount);
  const missingInfoCount = readFiniteCount(receipt.missingInfoCount);
  const metrics = [
    currentEvidenceCount != null ? `本轮证据 ${currentEvidenceCount}` : '',
    priorEvidenceCount != null ? `旧 prior ${priorEvidenceCount}` : '',
    followUpActionCount ? `查证动作 ${followUpActionCount}` : '',
    missingInfoCount ? `缺口 ${missingInfoCount}` : '',
    ...reviewMetrics,
    authority?.label ? `门控 ${authority.label}` : '',
    ...(authority?.metrics || []),
  ].filter(Boolean);
  const metricText = metrics.length ? metrics.slice(0, 10).join('；') : '';
  const boundary =
    '这是活答案回执：旧 prior 如有仅作召回和对比提示；查看这张卡不会重新确认当前事实、再次写新版本、创建外部查证动作、代表你发消息或执行外部写入。';
  return [`活答案回执：${label}`, detail, metricText, boundary]
    .filter(Boolean)
    .join(' ');
}

function formatAskEvidenceWatchRunState(value: string): string {
  if (value === 'created') return '已建立';
  if (value === 'checked_no_change') return '已复核无变化';
  if (value === 'checked_changed') return '已发现变化';
  if (value === 'blocked') return '来源阻塞';
  if (value === 'skipped_budget') return '预算跳过';
  if (value === 'skipped_duplicate') return '复用队列';
  if (value === 'needs_user_decision') return '需用户决策';
  return '';
}

function formatAskEvidenceWatchReceipt(
  receipt: any,
): AskEvidenceWatchReceiptView | null {
  if (!receipt || typeof receipt !== 'object') return null;
  const label =
    compactAskReceiptText(receipt.label, 42) || '证据守望回执';
  const serviceDetail = compactAskReceiptText(receipt.detail, 120);
  const subjectKey = compactAskReceiptText(receipt.subjectKey, 54);
  const state = typeof receipt.state === 'string' ? receipt.state : '';
  const duplicateSuppressedCount =
    readFiniteCount(receipt.duplicateSuppressedCount) ?? 0;
  const nextCheck = formatAskWatchTime(receipt.nextCheckAt);
  const lastChecked = formatAskWatchTime(receipt.lastCheckedAt);
  const lastRunState =
    typeof receipt.lastRunState === 'string' ? receipt.lastRunState : '';
  const lastRunLabel = formatAskEvidenceWatchRunState(lastRunState);
  const duplicateSuppressionRun = lastRunState === 'skipped_duplicate';
  const hasConfirmRequest =
    typeof receipt.confirmRequestId === 'string' &&
    receipt.confirmRequestId.trim().length > 0;

  const tone: AskEvidenceWatchReceiptTone =
    duplicateSuppressionRun
      ? 'warning'
      : state === 'authority_changed'
      ? 'success'
      : state === 'source_blocked' || state === 'due' || state === 'paused'
        ? 'warning'
        : state === 'archived'
          ? 'muted'
          : 'info';
  const statusMetric =
    duplicateSuppressionRun
      ? '守望复用队列'
      : state === 'authority_changed'
      ? '守望发现变化'
      : state === 'source_blocked'
        ? '守望来源阻塞'
        : state === 'due'
          ? '守望待复核'
          : state === 'quiet_no_change'
            ? '守望无变化'
            : state === 'paused'
              ? '守望已暂停'
              : state === 'archived'
                ? '守望已归档'
                : '证据守望';
  const duplicateSuppressionDetail = duplicateSuppressionRun
    ? ' 本轮 run 是重复查证抑制：只复用已有队列动作，没有重新触达权威来源，也不会更新最近复核时间。'
    : '';

  return {
    label,
    detail: `${serviceDetail || '本轮 Ask 已建立或命中证据守望契约。'}${duplicateSuppressionDetail} 这只是后续复核/去重状态，不会自动确认事实、代表你发消息、执行外部写入，或把旧答案写成当前事实。`,
    tone,
    statusMetric,
    metrics: [
      receipt.created === true ? '本轮新建' : '命中已有守望',
      subjectKey ? `对象 ${subjectKey}` : '',
      duplicateSuppressionRun ? '本轮未复核来源' : '',
      lastRunLabel ? `run ${lastRunLabel}` : '',
      hasConfirmRequest ? '有确认项' : '',
      duplicateSuppressedCount > 0
        ? `已抑制重复 ${duplicateSuppressedCount}`
        : '',
      nextCheck ? `下次 ${nextCheck}` : '',
      lastChecked ? `上次 ${lastChecked}` : '',
      !lastRunLabel && typeof receipt.runId === 'string' && receipt.runId.trim()
        ? '有本轮 run'
        : '',
    ].filter(Boolean),
  };
}

function getAskEvidenceTypeLabel(evidence: any): string {
  const type = typeof evidence?.type === 'string' ? evidence.type.trim() : '';
  if (!type) return '未标明类型';
  return MEMORY_RESULT_TYPE_CONFIG[type]?.name || compactAskReceiptText(type, 24);
}

function getAskEvidenceSourceLabel(evidence: any): string {
  const sourceTitle =
    typeof evidence?.sourceTitle === 'string' ? evidence.sourceTitle.trim() : '';
  if (sourceTitle) return compactAskReceiptText(sourceTitle, 42);

  const source =
    typeof evidence?.source === 'string' ? evidence.source.trim() : '';
  if (source) return compactAskReceiptText(source, 42);

  const sourceUrl =
    typeof evidence?.sourceUrl === 'string' ? evidence.sourceUrl.trim() : '';
  if (sourceUrl) {
    try {
      return compactAskReceiptText(new URL(sourceUrl).host, 42);
    } catch (_error) {
      // Keep the explicit unknown bucket for unsupported source URL strings.
    }
  }

  return '未标明来源';
}

function getAskEvidenceChannels(evidence: any): string[] {
  const channels = new Set<string>();
  for (const channel of getResultChannels(evidence)) {
    const normalized = channel.trim();
    if (normalized) channels.add(normalized);
  }

  const metadataChannels = evidence?.metadata?.channels;
  if (Array.isArray(metadataChannels)) {
    for (const channel of metadataChannels) {
      if (typeof channel !== 'string') continue;
      const normalized = channel.trim();
      if (normalized) channels.add(normalized);
    }
  }

  return Array.from(channels);
}

function countAskEvidenceValues(
  evidenceItems: any[],
  getValue: (evidence: any) => string,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const evidence of evidenceItems) {
    const label = getValue(evidence);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label, 'zh-Hans-CN');
    });
}

function formatAskEvidenceBasisReceipt(
  result: any,
): AskEvidenceBasisReceiptView | null {
  const evidenceItems = Array.isArray(result?.evidence)
    ? result.evidence.filter(
        (evidence: any) => evidence && typeof evidence === 'object',
      )
    : [];
  if (evidenceItems.length === 0) return null;

  const typeCounts = countAskEvidenceValues(
    evidenceItems,
    getAskEvidenceTypeLabel,
  );
  const sourceCounts = countAskEvidenceValues(
    evidenceItems,
    getAskEvidenceSourceLabel,
  );
  const channelCounts = countAskEvidenceValues(evidenceItems, (evidence) => {
    const channels = getAskEvidenceChannels(evidence);
    return channels.map(getRecallChannelLabel).join('+');
  }).filter((item) => item.label);
  const topType = typeCounts[0];
  const topSource = sourceCounts[0];
  const topChannel = channelCounts[0];
  const sourceSummary = topSource
    ? `Top 来源 ${topSource.label} ${topSource.count} 条`
    : '未标明来源';
  const typeSummary = topType
    ? `Top 类型 ${topType.label} ${topType.count} 条`
    : '未标明类型';
  const channelSummary = topChannel
    ? `Top 通道 ${topChannel.label} ${topChannel.count} 条`
    : '未标明召回通道';
  const singleSource =
    evidenceItems.length > 1 && sourceCounts.length === 1 && Boolean(topSource);

  return {
    label: 'Ask 证据来源回执',
    detail:
      `本轮答案前先汇总当前 Ask response 返回的 ${evidenceItems.length} 条 evidence：${typeSummary}，${sourceSummary}，${channelSummary}。` +
      '这只是当前可见证据切片，不代表全库或全部连接器覆盖，不确认事实、不写活答案，也不创建或执行外部动作。',
    tone: singleSource ? 'warning' : 'info',
    metrics: [
      `证据 ${evidenceItems.length}`,
      `类型 ${typeCounts.length}`,
      `来源 ${sourceCounts.length}`,
      channelCounts.length > 0 ? `通道 ${channelCounts.length}` : '',
      topSource ? `Top 来源 ${topSource.label}` : '',
      topChannel ? `Top 通道 ${topChannel.label}` : '',
      '当前返回切片',
    ].filter(Boolean),
  };
}

function normalizeAskActionStatus(action: any): string {
  return typeof action?.queueStatus === 'string'
    ? action.queueStatus.toLowerCase()
    : '';
}

function formatAskFollowUpReceipt(result: any): AskFollowUpReceiptView | null {
  if (!result || typeof result !== 'object') return null;
  const actions = Array.isArray(result.followUpActions)
    ? result.followUpActions.filter(
        (action: any) => action && typeof action === 'object',
      )
    : [];
  const missingInfo = Array.isArray(result.missingInfo)
    ? result.missingInfo
        .map((item: unknown) => compactAskReceiptText(item, 96))
        .filter(Boolean)
    : [];
  const externalEvidenceCount = Array.isArray(result.externalEvidence)
    ? result.externalEvidence.length
    : 0;
  const resolutionState = result.resolutionState;
  const resolutionLabel = formatAskResolutionState(resolutionState);
  const hasIncompleteState =
    resolutionState === 'partial' ||
    resolutionState === 'insufficient' ||
    resolutionState === 'deferred';

  if (
    actions.length === 0 &&
    missingInfo.length === 0 &&
    externalEvidenceCount === 0 &&
    !hasIncompleteState
  ) {
    return null;
  }

  const completedCount = actions.filter((action: any) =>
    /^(completed|done|success|succeeded|executed)$/iu.test(
      normalizeAskActionStatus(action),
    ),
  ).length;
  const queuedCount = actions.filter((action: any) =>
    /^(queued|pending|ready|scheduled)$/iu.test(normalizeAskActionStatus(action)),
  ).length;
  const failedCount = actions.filter(
    (action: any) =>
      /fail|error|blocked|rejected/iu.test(normalizeAskActionStatus(action)) ||
      (typeof action?.lastError === 'string' && action.lastError.trim()),
  ).length;
  const manualCount = actions.filter(
    (action: any) => action?.executionMode === 'manual',
  ).length;

  const metrics = [
    resolutionLabel ? `状态 ${resolutionLabel}` : '',
    actions.length > 0 ? `查证动作 ${actions.length}` : '',
    completedCount > 0 ? `已完成 ${completedCount}` : '',
    queuedCount > 0 ? `队列中 ${queuedCount}` : '',
    failedCount > 0 ? `失败 ${failedCount}` : '',
    manualCount > 0 ? `需人工 ${manualCount}` : '',
    externalEvidenceCount > 0 ? `外部证据 ${externalEvidenceCount}` : '',
    missingInfo.length > 0 ? `缺口 ${missingInfo.length}` : '',
  ].filter(Boolean);

  if (actions.length > 0) {
    const label = failedCount > 0 ? 'Ask 查证需处理' : 'Ask 查证回执';
    const tone: AskFollowUpReceiptTone =
      failedCount > 0
        ? 'warning'
        : completedCount > 0 || externalEvidenceCount > 0
          ? 'success'
          : 'info';
    const detail =
      failedCount > 0
        ? `有 ${failedCount} 个 Ask 查证动作失败或未完成；回答仍只按当前证据展示，不会自动确认结论、代表你发消息，或把缺口写成长期事实。`
        : externalEvidenceCount > 0
          ? `已返回 ${externalEvidenceCount} 条外部证据，并留下 ${actions.length} 个查证动作回执；它们只表示查证/待确认状态，不会自动确认结论、代表你发消息，或把缺口写成长期事实。`
          : `已留下 ${actions.length} 个后续查证动作回执；它们只表示查证/待确认状态，不会自动确认结论、代表你发消息，或把缺口写成长期事实。`;
    return {
      label,
      detail,
      tone,
      metrics,
    };
  }

  const missingSnippet = missingInfo[0] ? `：${missingInfo[0]}` : '';
  return {
    label:
      externalEvidenceCount > 0 ? 'Ask 外部证据回执' : 'Ask 缺口回执',
    detail:
      missingInfo.length > 0
        ? `本轮仍缺少 ${missingInfo.length} 项信息${missingSnippet}。没有创建后续查证动作；回答只基于当前证据，也不会把缺口写成长期事实。`
        : `本轮状态是${resolutionLabel || '未完整回答'}；没有创建后续查证动作，回答只基于当前证据。`,
    tone: hasIncompleteState ? 'warning' : 'muted',
    metrics,
  };
}

function readFiniteCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function getAskResultArrayLength(result: any, key: string): number {
  const value = result?.[key];
  return Array.isArray(value) ? value.length : 0;
}

function readAnswerMemoryState(result: any): string {
  return typeof result?.answerMemory?.state === 'string'
    ? result.answerMemory.state
    : '';
}

function readAnswerMemorySkipReason(result: any): string {
  return typeof result?.answerMemory?.skipReason === 'string'
    ? result.answerMemory.skipReason
    : '';
}

function readAnswerMemoryAuthorityDecision(result: any): string {
  return typeof result?.answerMemory?.authority?.decision === 'string'
    ? result.answerMemory.authority.decision
    : '';
}

function formatAskAnswerMemoryGateStatus(
  result: any,
): AskAnswerMemoryGateStatus | null {
  if (!result || typeof result !== 'object') return null;
  const state = readAnswerMemoryState(result);
  const decision = readAnswerMemoryAuthorityDecision(result);

  if (state === 'updated') {
    return {
      detail:
        '本轮当前权威证据已通过门控并写入活答案新版本；旧 prior 只作对比，不代表外部发送或写入。',
      tone: 'success',
      metric: '活答案已写新版本',
    };
  }

  if (state === 'promoted') {
    return {
      detail:
        '重复问题已合并为活答案 thread；本轮答案仍按当前证据展示，不代表外部发送或写入。',
      tone: 'success',
      metric: '已建立活答案',
    };
  }

  if (decision === 'same_meaning_no_change') {
    return {
      detail:
        '同一组当前权威证据下答案语义未变化；本轮只记录复核，不写新版本，旧 prior 仍只是召回提示。',
      tone: 'info',
      metric: '未写新版本',
    };
  }

  if (decision === 'supporting_only') {
    return {
      detail:
        '本轮只有辅助或派生证据，不能改写长期答案；旧 prior 只作召回提示，等待当前权威证据。',
      tone: 'warning',
      metric: '仅辅助证据',
    };
  }

  if (decision === 'wait_for_authority_source') {
    return {
      detail:
        '本轮等待新的权威证据，不能用旧 prior 或一次生成结果改写长期答案。',
      tone: 'warning',
      metric: '等待权威证据',
    };
  }

  if (decision === 'authorized_change') {
    return {
      detail:
        '本轮包含当前权威证据，允许创建、提升或更新活答案；是否已写版本以活答案回执为准。',
      tone: 'success',
      metric: '权威证据通过',
    };
  }

  return null;
}

function formatAskAnswerStatusRail(
  result: any,
  authority: AnswerMemoryAuthorityView | null,
  followUpReceipt: AskFollowUpReceiptView | null,
  evidenceWatchReceipt: AskEvidenceWatchReceiptView | null,
): AskAnswerStatusRailView | null {
  if (!result || typeof result !== 'object') return null;

  const resolutionState = result.resolutionState;
  const resolutionLabel = formatAskResolutionState(resolutionState);
  const receipt = result.answerMemory?.receipt;
  const currentEvidenceCount =
    readFiniteCount(receipt?.currentEvidenceCount) ??
    getAskResultArrayLength(result, 'evidence');
  const priorEvidenceCount = readFiniteCount(receipt?.priorEvidenceCount);
  const followUpActionCount =
    readFiniteCount(receipt?.followUpActionCount) ??
    getAskResultArrayLength(result, 'followUpActions');
  const externalEvidenceCount = getAskResultArrayLength(
    result,
    'externalEvidence',
  );
  const missingInfoCount =
    readFiniteCount(receipt?.missingInfoCount) ??
    getAskResultArrayLength(result, 'missingInfo');
  const ambiguous = result.contextMatch?.state === 'ambiguous';
  const answerMemoryState = readAnswerMemoryState(result);
  const answerMemorySkipReason = readAnswerMemorySkipReason(result);
  const unverifiedPrior =
    answerMemoryState === 'skipped' &&
    answerMemorySkipReason === 'no_evidence' &&
    (priorEvidenceCount ?? 0) > 0;
  const incomplete =
    resolutionState === 'partial' ||
    resolutionState === 'insufficient' ||
    resolutionState === 'deferred';
  const authorityDecision = readAnswerMemoryAuthorityDecision(result);
  const warningAuthority =
    authorityDecision === 'supporting_only' ||
    authorityDecision === 'wait_for_authority_source';
  const gateStatus = formatAskAnswerMemoryGateStatus(result);

  const metrics = [
    resolutionLabel ? `状态 ${resolutionLabel}` : '',
    currentEvidenceCount > 0 || unverifiedPrior
      ? `本轮证据 ${currentEvidenceCount}`
      : '',
    priorEvidenceCount != null ? `旧 prior ${priorEvidenceCount}` : '',
    unverifiedPrior ? '旧答案未复核' : '',
    followUpActionCount > 0 ? `查证动作 ${followUpActionCount}` : '',
    externalEvidenceCount > 0 ? `外部证据 ${externalEvidenceCount}` : '',
    missingInfoCount > 0 ? `缺口 ${missingInfoCount}` : '',
    authority?.label || '',
    gateStatus?.metric || '',
    ...formatAnswerMemoryReviewMetrics(receipt),
    evidenceWatchReceipt?.statusMetric || '',
    evidenceWatchReceipt?.metrics.includes('有确认项') ? '守望确认项' : '',
  ].filter(Boolean);

  if (ambiguous) {
    return {
      label: 'Ask 本轮状态',
      detail:
        '先确认话题；点击候选只会继续 Ask，不确认事实、不写活答案，也不创建外部查证动作。',
      tone: 'warning',
      metrics,
    };
  }

  if (unverifiedPrior) {
    return {
      label: 'Ask 本轮状态',
      detail:
        '命中过往活答案，但本轮没有当前证据；旧答案只作召回提示，不确认当前事实、不写新版本，也不代表你发消息或执行外部动作。',
      tone: 'warning',
      metrics,
    };
  }

  if (incomplete || followUpReceipt || warningAuthority) {
    return {
      label: 'Ask 本轮状态',
      detail: gateStatus
        ? `${gateStatus.detail} 回答仍按本轮证据和查证状态展示；不会自动确认结论、代表你发消息或执行外部写入。`
        : evidenceWatchReceipt
          ? '回答先按本轮证据、查证状态和证据守望契约展示；守望只表示后续复核/去重状态，不会自动确认事实、代表你发消息、执行外部写入，或把缺口写成长期事实。'
          : '回答先按本轮证据和查证状态展示；不会自动确认结论、代表你发消息、执行外部写入，或把缺口写成长期事实。',
      tone: warningAuthority ? 'warning' : gateStatus?.tone || 'warning',
      metrics,
    };
  }

  if (evidenceWatchReceipt) {
    return {
      label: 'Ask 本轮状态',
      detail:
        '回答基于本轮召回证据，同时命中证据守望；守望只表示后续复核/去重状态，不会自动确认事实、代表你发消息或执行外部写入。',
      tone: evidenceWatchReceipt.tone,
      metrics,
    };
  }

  if (gateStatus) {
    return {
      label: 'Ask 本轮状态',
      detail: gateStatus.detail,
      tone: gateStatus.tone,
      metrics,
    };
  }

  return {
    label: 'Ask 本轮状态',
    detail:
      '回答基于本轮召回证据；旧活答案只作召回提示，不会因为本次展示自动发送、外部写入或跳过权威证据门控。',
    tone:
      resolutionState === 'complete' && authority?.tone === 'success'
        ? 'success'
        : 'info',
    metrics,
  };
}

function compactAskClarificationText(value: unknown, maxLength = 92): string {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatAskClarification(result: any): AskClarificationView | null {
  const contextMatch = result?.contextMatch;
  if (contextMatch?.state !== 'ambiguous') return null;
  const candidates = Array.isArray(contextMatch.candidates)
    ? contextMatch.candidates
        .map((candidate: any, index: number) => {
          const label = compactAskClarificationText(candidate?.label, 72);
          if (!label) return null;
          const reasons = Array.isArray(candidate?.reasons)
            ? candidate.reasons
                .map((reason: unknown) =>
                  compactAskClarificationText(reason, 38),
                )
                .filter(Boolean)
            : [];
          return {
            index: index + 1,
            label,
            reason: reasons.slice(0, 2).join('、') || undefined,
          };
        })
        .filter(Boolean)
    : [];
  if (candidates.length === 0) return null;
  return {
    summary:
      compactAskClarificationText(contextMatch.userFacingSummary, 120) ||
      '这个短问句可能指向多个近期话题，需要先确认锚点。',
    candidates,
    choiceReceipt: {
      label: '候选选择回执',
      detail:
        '选择候选只是把本轮短问句绑定到对应话题后继续 Ask；不会确认事实、不写活答案 observation/thread，也不会创建外部查证动作。',
      metrics: [
        `候选 ${candidates.length}`,
        '等待用户确认',
        '无外部动作',
      ],
    },
  };
}

function formatAskTopicLockReceipt(
  result: any,
): AskTopicLockReceiptView | null {
  const contextMatch = result?.contextMatch;
  const selectedTopic = contextMatch?.selectedTopic;
  if (contextMatch?.state !== 'locked' || !selectedTopic) return null;

  const label = compactAskClarificationText(selectedTopic.label, 80);
  if (!label) return null;
  const reasons = Array.isArray(selectedTopic.reasons)
    ? selectedTopic.reasons
        .map((reason: unknown) => compactAskClarificationText(reason, 42))
        .filter(Boolean)
    : [];
  const anchors = Array.isArray(selectedTopic.anchors)
    ? selectedTopic.anchors
        .map((anchor: unknown) => compactAskClarificationText(anchor, 36))
        .filter(Boolean)
    : [];
  const roleTerms = Array.isArray(selectedTopic.roleTerms)
    ? selectedTopic.roleTerms
        .map((term: unknown) => compactAskClarificationText(term, 28))
        .filter(Boolean)
    : [];
  const sourceIdCount = Array.isArray(selectedTopic.sourceIds)
    ? selectedTopic.sourceIds.length
    : 0;
  const reasonText = reasons.slice(0, 2).join('、') || '近期记忆匹配度最高';

  return {
    label: 'Ask 话题锁定回执',
    detail:
      `Memory Service 已先把这个短问句锁定到“${label}”（${reasonText}）。` +
      '这只是检索锚点补全，不确认事实、不写活答案、不创建外部查证动作，也不代表你发消息或执行外部写入；答案仍必须按本轮证据展示。',
    metrics: [
      `锁定 ${label}`,
      ...reasons.slice(0, 2).map((reason) => `依据 ${reason}`),
      anchors.length > 0 ? `锚点 ${anchors[0]}` : '',
      roleTerms.length > 0 ? `角色词 ${roleTerms.slice(0, 2).join('/')}` : '',
      sourceIdCount > 0 ? `来源 ${sourceIdCount}` : '',
      '只补检索锚点',
    ].filter(Boolean),
  };
}

function formatAskContinuationReceipt(
  receipt: AskContinuationReceipt | undefined,
): AskContinuationReceiptView | null {
  if (!receipt || receipt.source !== 'candidate_clarification') return null;
  const originalQuery = compactAskClarificationText(receipt.originalQuery, 84);
  const selectedLabel = compactAskClarificationText(
    receipt.selectedCandidateLabel,
    72,
  );
  if (!originalQuery || !selectedLabel) return null;

  return {
    label: '承接候选回执',
    detail: `这轮 Ask 承接上一轮短问句“${originalQuery}”，先按你选择的“${selectedLabel}”继续检索；候选选择只是补锚点，不会确认事实、写活答案或创建外部查证动作。`,
    metrics: [
      `候选 ${receipt.selectedCandidateIndex}`,
      receipt.contextAttached ? '已带上轮上下文' : '未带上轮上下文',
      '仍按本轮证据回答',
    ],
  };
}

const normalizeScope = (scope: unknown) => {
  const value = Array.isArray(scope) ? scope[0] : scope;
  if (value === 'both' || value === 'all') return 'all';
  if (value === 'personal') {
    return value;
  }
  return 'work';
};

const currentScopeValue = computed(() =>
  normalizeScope(route.query.scope || searchContext.value.scope),
);

const currentScopeLabel = computed(() =>
  getScopeLabel(currentScopeValue.value),
);

function compactLoadingScopeQuery(value: unknown): string {
  const text =
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!text) return '';
  return text.length > 72 ? `${text.slice(0, 71).trimEnd()}...` : text;
}

const loadingScopeReceipt = computed<LoadingScopeReceiptView | null>(() => {
  if (!isLoading.value) return null;
  const query = compactLoadingScopeQuery(
    searchContext.value.query || searchQuery.value,
  );
  const modeLabel =
    searchContext.value.mode === 'overview'
      ? 'Ask 智能搜索'
      : searchContext.value.entityType
      ? `实体搜索 ${getEntityTypeName(searchContext.value.entityType)}`
      : '记忆搜索';
  const previousCount = entities.value.length;
  const previousSnapshotLine =
    previousCount > 0
      ? `上一次可见快照 ${previousCount} 条已暂时隐藏，返回前不会把它当成本轮证据。`
      : '当前没有可保留的上一次结果快照。';

  return {
    title: '搜索范围请求中',
    detail: `正在按${currentScopeLabel.value}请求 Memory Service${
      query ? `：“${query}”` : ''
    }；${previousSnapshotLine}这次只读取当前范围，不会写入、删除、同步外部来源、写反馈或确认事实。`,
    metrics: [
      `范围 ${currentScopeLabel.value}`,
      modeLabel,
      previousCount > 0 ? `旧快照 ${previousCount}` : '无旧快照',
      '只读请求',
    ],
  };
});

const searchFailureModeLabel = computed(() => {
  const receipt = searchFailureReceipt.value;
  if (!receipt) return '';
  if (receipt.mode === 'overview') return 'Ask 智能搜索';
  if (receipt.entityType) {
    return `实体搜索: ${getEntityTypeName(receipt.entityType)}`;
  }
  return '记忆搜索';
});

const searchFailureDetail = computed(() => {
  const receipt = searchFailureReceipt.value;
  if (!receipt) return '';
  const sourceLabel = receipt.source === 'ask' ? 'Ask' : '召回';
  return `Memory Service ${sourceLabel} 没有返回真实结果：${receipt.message}`;
});

const emptySearchResult = computed(() => searchContext.value.emptyResult);

const emptySearchReceipt = computed(() => {
  const receipt = emptySearchResult.value;
  if (!receipt) return null;
  return formatEmptySearchReceipt({
    mode: receipt.mode,
    query: receipt.query,
    scope: receipt.scope,
    source: receipt.source,
    entityTypeLabel: receipt.entityType
      ? getEntityTypeName(receipt.entityType)
      : '',
    resultCount: entities.value.length,
    channelDiagnostics: receipt.channelDiagnostics,
  });
});

const scopeBreakdownLabel = computed(() =>
  formatScopeBreakdownLabel(entities.value),
);

const scopeExposureNotice = computed(() =>
  formatScopeExposureNotice(entities.value, currentScopeValue.value),
);

const scopeBoundaryNotice = computed(() =>
  formatScopeBoundaryNotice(entities.value, currentScopeValue.value),
);

const recallChannelDiagnostics = computed(() =>
  formatRecallChannelDiagnostics(
    searchContext.value.askResult?.channelDiagnostics,
  ),
);

const recallChannelReceipt = computed(() =>
  formatRecallChannelReceipt(searchContext.value.askResult?.channelDiagnostics),
);

const emptyRecallChannelDiagnostics = computed(() =>
  formatRecallChannelDiagnostics(emptySearchResult.value?.channelDiagnostics),
);

const emptyRecallChannelReceipt = computed(() =>
  formatRecallChannelReceipt(emptySearchResult.value?.channelDiagnostics),
);

// 缝合证据徽章 (P0-5)：后端只在跨 ≥2 来源或 ≥7 天时返回 weave；前端只负责渲染。
const weaveBadge = computed(() => {
  const weave = searchContext.value.askResult?.weave;
  if (!weave || !weave.crossSource) return null;
  const parts: string[] = [];
  if (weave.sourceCount >= 2) parts.push(`${weave.sourceCount} 来源`);
  if (weave.daySpanDays >= 7) parts.push(`${weave.daySpanDays} 天`);
  if (parts.length === 0) return null;
  const kinds = (weave.sourceKinds || []).slice(0, 6).join(' · ');
  return {
    label: `缝合 ${parts.join(' × ')}`,
    title: kinds ? `跨来源缝合：${kinds}` : '跨来源缝合证据',
  };
});

const canBroadenSearchScope = computed(
  () =>
    searchQuery.value.trim().length >= 2 &&
    currentScopeValue.value !== 'all' &&
    currentScopeValue.value !== 'both',
);

const showResultsBroadenScopeAction = computed(
  () => Boolean(scopeBoundaryNotice.value) && canBroadenSearchScope.value,
);

// 自动设置筛选器：如果是从实体列表页搜索过来的，自动选中该实体类型
watch(() => searchContext.value.entityType, (entityType) => {
  if (entityType && searchContext.value.mode === 'entity') {
    selectedTypeFilter.value = entityType;
  } else {
    selectedTypeFilter.value = 'all';
  }
}, { immediate: true });

const toggleAiAnswer = () => {
  isAiAnswerExpanded.value = !isAiAnswerExpanded.value;
};

const getSectionTitle = () => {
  if (searchContext.value.mode === 'overview') {
    return '📚 相关记忆证据';
  } else if (searchContext.value.entityType) {
    const typeName = ENTITY_TYPE_CONFIG[searchContext.value.entityType]?.name || '实体';
    return `🔍 向量匹配查询到的${typeName}`;
  }
  return '🔍 搜索结果';
};

// 获取可用的实体类型及其数量
const availableTypes = computed(() => {
  const typeMap = new Map();
  typeMap.set('all', { key: 'all', name: '全部', icon: '📁', count: entities.value.length });
  
  entities.value.forEach(entity => {
    const config = ENTITY_TYPE_CONFIG[entity.type] || MEMORY_RESULT_TYPE_CONFIG[entity.type];
    if (config) {
      const existing = typeMap.get(entity.type) || { 
        key: entity.type, 
        name: config.name, 
        icon: config.icon, 
        count: 0 
      };
      existing.count++;
      typeMap.set(entity.type, existing);
    }
  });
  
  return Array.from(typeMap.values()).filter(type => type.count > 0);
});

function getTypeFilterButtonHint(type: any): string {
  return formatTypeFilterChipHint({
    key: type?.key,
    name: type?.name,
    count: type?.count,
    totalCount: entities.value.length,
    selectedTypeFilter: selectedTypeFilter.value,
  });
}

function getTypeFilterButtonLabel(type: any): string {
  return formatTypeFilterChipAriaLabel({
    key: type?.key,
    name: type?.name,
    count: type?.count,
    totalCount: entities.value.length,
    selectedTypeFilter: selectedTypeFilter.value,
  });
}

watch(
  availableTypes,
  (types) => {
    if (shouldResetTypeFilter(selectedTypeFilter.value, types)) {
      selectedTypeFilter.value = 'all';
    }
  },
  { immediate: true },
);

watch(
  entities,
  (results) => hydrateFeedbackStateFromResults(results),
  { immediate: true },
);

// 根据类型过滤的结果
const filteredResults = computed(() => {
  if (selectedTypeFilter.value === 'all') {
    return entities.value;
  }
  return entities.value.filter(entity => entity.type === selectedTypeFilter.value);
});

const evidenceChannelOverlapReceipt = computed(() =>
  formatEvidenceChannelOverlapReceipt({
    visibleResults: filteredResults.value,
  }),
);

const selectedTypeFilterLabel = computed(() =>
  selectedTypeFilter.value === 'all'
    ? '全部'
    : getEntityTypeName(selectedTypeFilter.value),
);

const resultsCountLabel = computed(() => {
  if (selectedTypeFilter.value === 'all') {
    return `找到 ${entities.value.length} 个相关结果`;
  }
  return `显示 ${filteredResults.value.length}/${entities.value.length} 个相关结果`;
});

const typeFilterReceipt = computed(() =>
  formatTypeFilterReceipt({
    selectedTypeFilter: selectedTypeFilter.value,
    selectedTypeLabel: selectedTypeFilterLabel.value,
    visibleCount: filteredResults.value.length,
    totalCount: entities.value.length,
  }),
);

const searchResultBatchReceipt = computed(() =>
  formatSearchResultBatchReceipt({
    query: searchContext.value.query || searchQuery.value,
    scope: currentScopeValue.value,
    mode: searchContext.value.mode,
    entityTypeLabel: searchContext.value.entityType
      ? getEntityTypeName(searchContext.value.entityType)
      : undefined,
    selectedTypeFilter: selectedTypeFilter.value,
    selectedTypeLabel: selectedTypeFilterLabel.value,
    visibleCount: filteredResults.value.length,
    totalCount: entities.value.length,
    channelDiagnostics: searchContext.value.askResult?.channelDiagnostics,
  }),
);

const sourceCoverageReceipt = computed(() =>
  formatSourceCoverageReceipt({
    visibleResults: filteredResults.value,
    totalResults: entities.value,
    selectedTypeFilter: selectedTypeFilter.value,
    selectedTypeLabel: selectedTypeFilterLabel.value,
  }),
);

const resetTypeFilter = () => {
  selectedTypeFilter.value = 'all';
};

function getFeedbackKey(entity: any): string {
  return getSearchResultKey(entity);
}

function getFeedbackTargetType(
  entity: any,
): MemoryFeedbackTargetType | undefined {
  const recallType = entity?.recallType;
  if (
    recallType === 'message' ||
    recallType === 'chunk' ||
    recallType === 'entity' ||
    recallType === 'source_memory'
  ) {
    return recallType;
  }

  if (
    entity?.type === 'message' ||
    entity?.type === 'chunk' ||
    entity?.type === 'entity'
  ) {
    return entity.type;
  }

  if (entity?.type && ENTITY_TYPE_CONFIG[entity.type]) return 'entity';
  return undefined;
}

function getFeedbackTargetId(
  entity: any,
  targetType: MemoryFeedbackTargetType,
): string {
  const rawId =
    targetType === 'source_memory'
      ? entity?.sourceMemoryCapsuleId || entity?.source_memory_capsule_id || entity?.id
      : entity?.id;
  const id = String(rawId || '').trim();
  return targetType === 'source_memory'
    ? id.replace(/^source-memory:/, '')
    : id;
}

function compactFeedbackDetailValue(
  value: unknown,
  maxLength = 160,
): string | undefined {
  const normalized =
    typeof value === 'string'
      ? value.replace(/\s+/g, ' ').trim()
      : value == null
      ? ''
      : String(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trimEnd()}...`
    : normalized;
}

function getCurrentFeedbackQuery(): string {
  const value = searchQuery.value || searchContext.value.query;
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function getFeedbackResultPosition(entity: any): {
  position?: number;
  visibleCount: number;
  totalCount: number;
} {
  const key = getFeedbackKey(entity);
  const visibleResults = filteredResults.value;
  const index = visibleResults.findIndex(
    (result) => getFeedbackKey(result) === key,
  );
  return {
    position: index >= 0 ? index + 1 : undefined,
    visibleCount: visibleResults.length,
    totalCount: entities.value.length,
  };
}

function buildFeedbackContextLine(input: {
  query?: string;
  selectedTypeFilter?: string;
  selectedTypeFilterLabel?: string;
  resultPosition?: number;
  visibleCount: number;
}): string {
  const filterLabel =
    input.selectedTypeFilter && input.selectedTypeFilter !== 'all'
      ? `，筛选 ${
          input.selectedTypeFilterLabel ||
          getEntityTypeName(input.selectedTypeFilter)
        }`
      : '';
  const positionLabel =
    input.resultPosition && input.visibleCount
      ? `，第 ${input.resultPosition}/${input.visibleCount} 条`
      : '';

  if (input.query) {
    return `本次查询：“${input.query}”${filterLabel}${positionLabel}`;
  }
  if (filterLabel || positionLabel) {
    return `当前结果${filterLabel}${positionLabel}`;
  }
  return '';
}

function getFeedbackQueryContextLine(entity: any): string {
  const query = compactFeedbackDetailValue(getCurrentFeedbackQuery(), 80);
  const resultPosition = getFeedbackResultPosition(entity);
  return buildFeedbackContextLine({
    query,
    selectedTypeFilter: selectedTypeFilter.value,
    selectedTypeFilterLabel:
      selectedTypeFilter.value !== 'all'
        ? getEntityTypeName(selectedTypeFilter.value)
        : undefined,
    resultPosition: resultPosition.position,
    visibleCount: resultPosition.visibleCount,
  });
}

function buildSearchResultFeedbackDetail(
  entity: any,
  targetType: MemoryFeedbackTargetType,
  action: MemoryFeedbackAction,
): string {
  const surface =
    searchContext.value.mode === 'overview'
      ? 'ask_evidence'
      : 'memory_search';
  const query = compactFeedbackDetailValue(
    searchQuery.value || searchContext.value.query,
    180,
  );
  const scope = compactFeedbackDetailValue(currentScopeValue.value, 40);
  const mode = compactFeedbackDetailValue(searchContext.value.mode, 60);
  const signature = [
    'memory-exploring',
    surface,
    mode,
    scope,
    query,
  ]
      .filter(Boolean)
      .join(':');
  const resultPosition = getFeedbackResultPosition(entity);
  const linkState = getLinkSafetyState(entity);
  const rawSourceUrl =
    typeof entity?.sourceUrl === 'string' && entity.sourceUrl.trim()
      ? entity.sourceUrl.trim()
      : '';
  const safeSourceUrl = compactFeedbackDetailValue(linkState.sourceUrl, 220);
  const sourceUrlBlocked = Boolean(rawSourceUrl && !safeSourceUrl);
  const detail = {
    version: '1',
    interaction:
      action === 'negative'
        ? 'memory_relevance_trainer'
        : 'context_recall_feedback',
    surface,
    action,
    auto_applied: action === 'negative' ? 'true' : undefined,
    feedback_reason:
      action === 'negative'
        ? surface === 'ask_evidence'
          ? 'ask_evidence_mismatch'
          : 'search_context_mismatch'
        : undefined,
    scene_anchor_signature: compactFeedbackDetailValue(signature, 240),
    query,
    scope,
    mode,
    selected_type_filter:
      selectedTypeFilter.value !== 'all' ? selectedTypeFilter.value : undefined,
    result_position: resultPosition.position
      ? String(resultPosition.position)
      : undefined,
    visible_result_count: resultPosition.visibleCount
      ? String(resultPosition.visibleCount)
      : undefined,
    total_result_count: resultPosition.totalCount
      ? String(resultPosition.totalCount)
      : undefined,
    target_type: targetType,
    result_key: compactFeedbackDetailValue(getSearchResultKey(entity), 180),
    source_label: compactFeedbackDetailValue(
      entity?.sourceLabel || entity?.source,
      100,
    ),
    source_title: compactFeedbackDetailValue(entity?.sourceTitle, 140),
    source_url: safeSourceUrl,
    source_url_host: compactFeedbackDetailValue(linkState.sourceHost, 80),
    source_url_included:
      safeSourceUrl || rawSourceUrl
        ? safeSourceUrl
          ? 'true'
          : 'false'
        : undefined,
    source_url_boundary: sourceUrlBlocked
      ? 'hidden_non_http_source'
      : undefined,
    current_title: compactFeedbackDetailValue(document.title, 120),
  };

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(detail).filter(([, value]) => Boolean(value)),
    ),
  );
}

function getInitialFeedbackAction(entity: any): SearchFeedbackChoice | undefined {
  const value = entity?.feedbackAction || entity?.recallFeedback;
  return value === 'positive' || value === 'negative' ? value : undefined;
}

function canSubmitResultFeedback(entity: any): boolean {
  const targetType = getFeedbackTargetType(entity);
  return Boolean(targetType && getFeedbackTargetId(entity, targetType));
}

function setFeedbackState(
  entity: any,
  state: SearchFeedbackState | undefined,
) {
  const key = getFeedbackKey(entity);
  const next = { ...feedbackByResultKey.value };
  if (state) {
    next[key] = state;
  } else {
    delete next[key];
  }
  feedbackByResultKey.value = next;
}

function setFeedbackEffect(
  entity: any,
  effect: SearchFeedbackResponseEffect | undefined,
) {
  const key = getFeedbackKey(entity);
  const next = { ...feedbackEffectByResultKey.value };
  if (effect) {
    next[key] = effect;
  } else {
    delete next[key];
  }
  feedbackEffectByResultKey.value = next;
}

function setFeedbackConditionSnapshot(
  entity: any,
  snapshot: SearchFeedbackConditionSnapshot | undefined,
) {
  const key = getFeedbackKey(entity);
  const next = { ...feedbackConditionByResultKey.value };
  if (snapshot) {
    next[key] = snapshot;
  } else {
    delete next[key];
  }
  feedbackConditionByResultKey.value = next;
}

function setFeedbackFailure(
  entity: any,
  failure: SearchFeedbackFailure | undefined,
) {
  const key = getFeedbackKey(entity);
  const next = { ...feedbackFailureByResultKey.value };
  if (failure) {
    next[key] = failure;
  } else {
    delete next[key];
  }
  feedbackFailureByResultKey.value = next;
}

function hydrateFeedbackStateFromResults(results: any[]) {
  const next = { ...feedbackByResultKey.value };
  const visibleKeys = new Set(results.map(getFeedbackKey));

  for (const key of Object.keys(next)) {
    if (!visibleKeys.has(key) || next[key] === 'cleared') {
      delete next[key];
    }
  }
  const nextEffects = { ...feedbackEffectByResultKey.value };
  for (const key of Object.keys(nextEffects)) {
    if (!visibleKeys.has(key)) {
      delete nextEffects[key];
    }
  }
  const nextConditions = { ...feedbackConditionByResultKey.value };
  for (const key of Object.keys(nextConditions)) {
    if (!visibleKeys.has(key)) {
      delete nextConditions[key];
    }
  }
  const nextFailures = { ...feedbackFailureByResultKey.value };
  for (const key of Object.keys(nextFailures)) {
    if (!visibleKeys.has(key)) {
      delete nextFailures[key];
    }
  }

  for (const entity of results) {
    const key = getFeedbackKey(entity);
    delete nextFailures[key];
    const feedbackAction = getInitialFeedbackAction(entity);
    if (feedbackAction) {
      next[key] = feedbackAction;
    } else if (next[key] !== 'pending') {
      delete next[key];
      delete nextEffects[key];
      delete nextConditions[key];
    }
  }

  feedbackByResultKey.value = next;
  feedbackEffectByResultKey.value = nextEffects;
  feedbackConditionByResultKey.value = nextConditions;
  feedbackFailureByResultKey.value = nextFailures;
}

function getFeedbackLabel(entity: any): string {
  const state = feedbackByResultKey.value[getFeedbackKey(entity)];
  if (state === 'pending') return '提交中...';
  if (state === 'positive') return '已记录为有用';
  if (state === 'negative') return '已记录为不相关';
  if (state === 'cleared') return '已撤销反馈';
  return '';
}

function getFeedbackStatusTone(entity: any): SearchFeedbackState | undefined {
  return feedbackByResultKey.value[getFeedbackKey(entity)];
}

function getFeedbackTargetTypeLabel(
  targetType: MemoryFeedbackTargetType | undefined,
): string {
  switch (targetType) {
    case 'message':
      return '消息记忆';
    case 'chunk':
      return '资料片段';
    case 'entity':
      return '实体记忆';
    case 'source_memory':
      return '资料记忆';
    default:
      return '当前结果';
  }
}

function formatFeedbackDelta(delta: number): string {
  const percentage = Math.round(Math.abs(delta) * 100);
  if (percentage <= 0) return '';
  return `${delta > 0 ? '提高' : '降低'}显著性 ${percentage}%`;
}

function normalizeFeedbackResponseEffect(
  response: any,
  action: MemoryFeedbackAction,
): SearchFeedbackResponseEffect | undefined {
  const result = response?.data || response?.result || response;
  if (!result || typeof result !== 'object') return undefined;
  const relevancePatch = result.relevancePatch;
  const patchStatus =
    relevancePatch?.status === 'patched' ||
    relevancePatch?.status === 'cleared' ||
    relevancePatch?.status === 'ignored'
      ? relevancePatch.status
      : undefined;
  const patchAction =
    typeof relevancePatch?.patch?.action === 'string'
      ? relevancePatch.patch.action
      : undefined;
  const clearedPatchCount = Array.isArray(relevancePatch?.clearedPatchIds)
    ? relevancePatch.clearedPatchIds.length
    : undefined;
  const previousAction =
    result.previousAction === 'positive' ||
    result.previousAction === 'negative' ||
    result.previousAction === 'clear'
      ? result.previousAction
      : undefined;
  const appliedDelta =
    typeof result.appliedDelta === 'number' &&
    Number.isFinite(result.appliedDelta)
      ? result.appliedDelta
      : undefined;

  if (
    patchStatus ||
    previousAction ||
    appliedDelta !== undefined ||
    clearedPatchCount !== undefined
  ) {
    return {
      action,
      previousAction,
      appliedDelta,
      relevancePatchStatus: patchStatus,
      relevancePatchAction: patchAction,
      clearedPatchCount,
    };
  }
  return undefined;
}

function getFeedbackConditionSnapshot(
  entity: any,
): SearchFeedbackConditionSnapshot | undefined {
  return feedbackConditionByResultKey.value[getFeedbackKey(entity)];
}

function captureFeedbackConditionSnapshot(
  entity: any,
): SearchFeedbackConditionSnapshot {
  const query = getCurrentFeedbackQuery();
  const displayQuery = compactFeedbackDetailValue(query, 80);
  const resultPosition = getFeedbackResultPosition(entity);
  const scope = currentScopeValue.value as RecallScope;
  const mode = searchContext.value.mode || 'overview';
  const entityType =
    typeof searchContext.value.entityType === 'string'
      ? searchContext.value.entityType
      : undefined;
  const selectedFilter = selectedTypeFilter.value;
  const selectedFilterLabel =
    selectedFilter !== 'all' ? getEntityTypeName(selectedFilter) : undefined;
  const contextLine = buildFeedbackContextLine({
    query: displayQuery,
    selectedTypeFilter: selectedFilter,
    selectedTypeFilterLabel: selectedFilterLabel,
    resultPosition: resultPosition.position,
    visibleCount: resultPosition.visibleCount,
  });

  return {
    query,
    scope,
    scopeLabel: currentScopeLabel.value,
    mode,
    entityType,
    selectedTypeFilter: selectedFilter,
    selectedTypeFilterLabel: selectedFilterLabel,
    resultPosition: resultPosition.position,
    visibleCount: resultPosition.visibleCount,
    totalCount: resultPosition.totalCount,
    surfaceLabel: getFeedbackSurfaceLabel(),
    contextLine,
  };
}

function isFeedbackConditionSnapshotCurrent(
  snapshot: SearchFeedbackConditionSnapshot | undefined,
): boolean {
  if (!snapshot) return true;
  const currentQuery =
    getCurrentFeedbackQuery();
  const currentEntityType =
    typeof searchContext.value.entityType === 'string'
      ? searchContext.value.entityType
      : undefined;
  return (
    snapshot.query === currentQuery &&
    snapshot.scope === currentScopeValue.value &&
    snapshot.mode === searchContext.value.mode &&
    snapshot.entityType === currentEntityType &&
    snapshot.selectedTypeFilter === selectedTypeFilter.value
  );
}

function getFeedbackReceiptContext(entity: any): string {
  const snapshot = getFeedbackConditionSnapshot(entity);
  const line = snapshot?.contextLine || getFeedbackQueryContextLine(entity);
  if (snapshot && line && !isFeedbackConditionSnapshotCurrent(snapshot)) {
    return `${line}（反馈时条件；当前页条件已变化）`;
  }
  return line;
}

function getFeedbackEffectLines(entity: any): string[] {
  const effect = feedbackEffectByResultKey.value[getFeedbackKey(entity)];
  const snapshot = getFeedbackConditionSnapshot(entity);
  const lines: string[] = [];

  if (effect?.relevancePatchStatus === 'patched') {
    const actionLabel =
      effect.relevancePatchAction === 'demote_for_scene'
        ? '降权'
        : '隐藏或降权';
    lines.push(`服务端已创建相近场景修正：同类场景会${actionLabel}这条结果。`);
  } else if (effect?.relevancePatchStatus === 'cleared') {
    const count = effect.clearedPatchCount;
    lines.push(
      count && count > 0
        ? `服务端已清除 ${count} 条相近场景修正。`
        : '服务端已检查并清除这条结果的相近场景修正。',
    );
  }

  if (effect?.appliedDelta != null && effect.appliedDelta !== 0) {
    lines.push(
      `排序信号已${formatFeedbackDelta(effect.appliedDelta)}，只影响后续召回排序。`,
    );
  } else if (
    effect?.action === 'negative' &&
    effect.relevancePatchStatus === 'patched'
  ) {
    lines.push('没有做全局显著性降权，避免一次负反馈变成全局排除。');
  }

  if (
    effect?.action === 'clear' &&
    effect.appliedDelta === 0 &&
    effect.relevancePatchStatus !== 'cleared'
  ) {
    lines.push('没有额外排序回滚；当前结果已回到普通召回信号。');
  }

  lines.push(
    snapshot && !isFeedbackConditionSnapshotCurrent(snapshot)
      ? '当前页不会即时重排；当前条件已变化，重新取证仍会按反馈时 query 和范围重新请求 Memory Service。'
      : '当前页不会即时重排；重新取证会用同一 query 和范围重新请求 Memory Service。',
  );
  return lines;
}

function getFeedbackSurfaceLabel(
  snapshot?: SearchFeedbackConditionSnapshot,
): string {
  if (snapshot?.surfaceLabel) return snapshot.surfaceLabel;
  return searchContext.value.mode === 'overview' ? 'Ask 证据' : '记忆搜索';
}

function getFeedbackReceipt(entity: any): SearchFeedbackReceipt | undefined {
  const state = feedbackByResultKey.value[getFeedbackKey(entity)];
  if (!state || state === 'pending') return undefined;

  const targetType = getFeedbackTargetType(entity);
  const snapshot = getFeedbackConditionSnapshot(entity);
  const scopePart = snapshot?.scopeLabel || currentScopeLabel.value;
  const targetPart = getFeedbackTargetTypeLabel(targetType);
  const surfacePart = getFeedbackSurfaceLabel(snapshot);
  const detailPrefix = `${surfacePart} / ${scopePart} / ${targetPart}`;

  if (state === 'negative') {
    return {
      tone: 'negative',
      label: '不相关修正范围',
      detail: `${detailPrefix}；只降低相近场景排序，不删除这条记忆。`,
      context: getFeedbackReceiptContext(entity),
      nextStep:
        '点“撤销”会移除这次修正；原记忆仍可从搜索、时间轴或来源打开。',
      effects: getFeedbackEffectLines(entity),
    };
  }

  if (state === 'positive') {
    return {
      tone: 'positive',
      label: '有用信号范围',
      detail: `${detailPrefix}；会提高这条证据在相近召回里的优先级。`,
      context: getFeedbackReceiptContext(entity),
      nextStep:
        '这不会把它固定成唯一答案，后续仍会和当前证据一起复核。',
      effects: getFeedbackEffectLines(entity),
    };
  }

  return {
    tone: 'cleared',
    label: '反馈已撤销',
    detail: `${detailPrefix}；已移除这条结果的正负标记和相近场景修正。`,
    context: getFeedbackReceiptContext(entity),
    nextStep:
      '后续排序回到向量、全文、图谱和时间等召回信号。',
    effects: getFeedbackEffectLines(entity),
  };
}

function getFeedbackPreflightReceipt(
  entity: any,
): SearchFeedbackReceipt | undefined {
  const state = feedbackByResultKey.value[getFeedbackKey(entity)];
  if (state || getFeedbackFailureReceipt(entity)) return undefined;

  const targetType = getFeedbackTargetType(entity);
  if (!targetType) return undefined;

  const scopePart = currentScopeLabel.value;
  const targetPart = getFeedbackTargetTypeLabel(targetType);
  const surfacePart = getFeedbackSurfaceLabel();

  return {
    tone: 'cleared',
    label: '反馈范围',
    detail: `${surfacePart} / ${scopePart} / ${targetPart}；点击会写入 Memory Service 召回质量信号，不会删除记忆或立即重排当前页。`,
    context: getFeedbackQueryContextLine(entity),
    effects: [
      '有用：提高这条证据在相近召回里的优先级。',
      '不相关：可能创建相近场景修正；只降低同类场景排序，不做全局排除。',
    ],
    nextStep:
      '反馈不会外发、同步来源系统或确认答案；写错后可用“撤销”移除这次修正。',
  };
}

function getFeedbackActionScopeLine(entity: any): string {
  const targetType = getFeedbackTargetType(entity);
  const scopePart = currentScopeLabel.value;
  const targetPart = getFeedbackTargetTypeLabel(targetType);
  const surfacePart = getFeedbackSurfaceLabel();
  const context = getFeedbackQueryContextLine(entity);
  return `${surfacePart} / ${scopePart} / ${targetPart}${context ? `；${context}` : ''}`;
}

function getFeedbackButtonBoundary(
  entity: any,
  action: MemoryFeedbackAction,
): string {
  const title = compactFeedbackDetailValue(
    getSearchResultOpenTitle(entity),
    80,
  ) || '当前结果';
  const actionScope = getFeedbackActionScopeLine(entity);

  if (isFeedbackPending(entity)) {
    return `反馈提交中：正在按当前反馈条件写入 Memory Service 召回质量信号；按钮暂时锁定，避免重复提交。对象：${title}。不会删除记忆、外发内容、同步来源系统、确认答案或立即重排当前页。`;
  }

  if (action === 'positive') {
    return `有用反馈：把「${title}」标记为本次 ${actionScope} 的有用证据，写入 Memory Service recall_quality；后续相近召回会提高优先级。不会确认答案、不会固定唯一结果、不会立即重排当前页、不会外发、不会同步来源系统、不会删除记忆。`;
  }

  if (action === 'negative') {
    return `不相关反馈：把「${title}」标记为本次 ${actionScope} 的不相关证据，写入 Memory Service recall_quality；可能创建相近场景修正，只降低同类场景排序，不做全局排除。不会删除或隐藏当前记忆、不会确认答案、不会立即重排当前页、不会外发、不会同步来源系统。`;
  }

  return `撤销反馈：移除「${title}」这次正负反馈和相近场景修正，让后续排序回到普通召回信号。对象：${actionScope}。不会删除记忆、不会恢复外部来源、不会重新召回、不会外发、不会同步来源系统、不会确认答案。`;
}

function getFeedbackRefreshBoundary(entity: any): string {
  const snapshot = getFeedbackConditionSnapshot(entity);
  const query = compactFeedbackDetailValue(
    snapshot?.query || getCurrentFeedbackQuery(),
    80,
  ) || '当前查询';
  const scope = snapshot?.scopeLabel || currentScopeLabel.value;
  const mode = getFeedbackSurfaceLabel(snapshot);
  const title = compactFeedbackDetailValue(
    getSearchResultOpenTitle(entity),
    80,
  ) || '当前结果';

  return `用同一条件重新取证：重新请求 Memory Service 的 ${mode}，query 为「${query}」，范围为${scope}，用于复核「${title}」反馈后的结果。不会再写一条反馈、不会删除记忆、不会同步来源系统、不会外发、不会确认答案。`;
}

function getFeedbackActionLabel(action: MemoryFeedbackAction): string {
  if (action === 'positive') return '有用反馈';
  if (action === 'negative') return '不相关反馈';
  return '撤销反馈';
}

function getFeedbackRestoredStateLabel(
  state: SearchFeedbackState | undefined,
): string {
  if (state === 'positive') return '已恢复为“有用”状态';
  if (state === 'negative') return '已恢复为“不相关”状态';
  if (state === 'cleared') return '仍保持“已撤销反馈”状态';
  return '没有写入新的反馈标记';
}

function getFeedbackFailureReceipt(
  entity: any,
): SearchFeedbackReceipt | undefined {
  const failure = feedbackFailureByResultKey.value[getFeedbackKey(entity)];
  if (!failure) return undefined;

  return {
    tone: 'error',
    label: '反馈未提交',
    detail: `${getFeedbackActionLabel(failure.action)}没有写入服务端；${getFeedbackRestoredStateLabel(failure.previousState)}。`,
    context: getFeedbackReceiptContext(entity),
    effects: [
      '没有创建相近场景修正、没有改变显著性，也没有删除这条记忆。',
      `错误：${compactFeedbackDetailValue(failure.message, 120) || 'feedback_request_failed'}`,
    ],
    nextStep:
      '请稍后重试；需要继续查证时，可先打开来源或调整搜索条件。',
  };
}

function isFeedbackPending(entity: any): boolean {
  return feedbackByResultKey.value[getFeedbackKey(entity)] === 'pending';
}

function isFeedbackActive(
  entity: any,
  action: SearchFeedbackChoice,
): boolean {
  return feedbackByResultKey.value[getFeedbackKey(entity)] === action;
}

function canClearFeedback(entity: any): boolean {
  const state = feedbackByResultKey.value[getFeedbackKey(entity)];
  return state === 'positive' || state === 'negative';
}

function shouldShowFeedbackRefreshAction(entity: any): boolean {
  const state = feedbackByResultKey.value[getFeedbackKey(entity)];
  return state === 'positive' || state === 'negative' || state === 'cleared';
}

function rerunSearchAfterFeedback(entity: any) {
  const snapshot = getFeedbackConditionSnapshot(entity);
  const query = (
    snapshot?.query ||
    searchContext.value.query ||
    searchQuery.value
  ).trim();
  if (!query) return;

  const scope = snapshot?.scope || (currentScopeValue.value as RecallScope);
  const mode = snapshot?.mode || searchContext.value.mode;
  const entityType = snapshot?.entityType || searchContext.value.entityType;
  if (mode === 'entity' && entityType) {
    store.performEntityVectorSearch(query, entityType, scope);
  } else {
    store.performAskSearch(query, scope);
  }

  router.replace({
    path: '/search',
    query: { ...route.query, q: query, scope },
  });
}

async function submitResultFeedback(
  entity: any,
  action: MemoryFeedbackAction,
) {
  const targetType = getFeedbackTargetType(entity);
  const targetId = targetType
    ? getFeedbackTargetId(entity, targetType)
    : '';
  if (!targetType || !targetId) return;

  const previousState = feedbackByResultKey.value[getFeedbackKey(entity)];
  if (
    action === 'clear' &&
    previousState !== 'positive' &&
    previousState !== 'negative'
  ) {
    return;
  }
  if (previousState === 'pending' || previousState === action) return;

  const previousEffect =
    feedbackEffectByResultKey.value[getFeedbackKey(entity)];
  const conditionSnapshot = captureFeedbackConditionSnapshot(entity);
  setFeedbackState(entity, 'pending');
  setFeedbackConditionSnapshot(entity, conditionSnapshot);
  setFeedbackFailure(entity, undefined);
  try {
    const response = (await chromeAPI.sendMessage({
      type: 'SUBMIT_MEMORY_FEEDBACK',
      feedbackType: 'recall_quality',
      targetId,
      targetType,
      action,
      detail: buildSearchResultFeedbackDetail(entity, targetType, action),
    })) as any;

    if (!response?.success) {
      throw new Error(response?.error || 'feedback_request_failed');
    }

    feedbackError.value = '';
    setFeedbackEffect(
      entity,
      normalizeFeedbackResponseEffect(response, action),
    );
    setFeedbackFailure(entity, undefined);
    setFeedbackState(entity, action === 'clear' ? 'cleared' : action);
  } catch (error: any) {
    setFeedbackState(
      entity,
      previousState === 'positive' ||
        previousState === 'negative' ||
        previousState === 'cleared'
        ? previousState
        : undefined,
    );
    setFeedbackEffect(entity, previousEffect);
    if (!previousEffect && !previousState) {
      setFeedbackConditionSnapshot(entity, conditionSnapshot);
    }
    setFeedbackFailure(entity, {
      action,
      message: error?.message || 'feedback_request_failed',
      previousState:
        previousState === 'pending' ? undefined : previousState,
    });
    feedbackError.value =
      error?.message || '反馈暂时无法提交，请稍后再试。';
  }
}

const getEntityIcon = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.icon || MEMORY_RESULT_TYPE_CONFIG[type]?.icon || '📂';
};

const getEntityTypeName = (type: string) => {
  return ENTITY_TYPE_CONFIG[type]?.name || MEMORY_RESULT_TYPE_CONFIG[type]?.name || type;
};

const renderSearchHighlight = (text: unknown) =>
  renderHighlightedSearchText(text, searchQuery.value);

const getLinkSafetyState = (target: any) =>
  getMemoryLinkSafetyState({
    exploreLink: target?.exploreLink,
    sourceUrl: target?.sourceUrl,
  });

const getLinkSafetyStatus = (target: any) =>
  formatMemoryLinkSafetyStatus(getLinkSafetyState(target));

const getSourceButtonTitle = (target: any) => {
  const host = getLinkSafetyState(target).sourceHost || '安全 http/https 来源';
  return `打开来源：${host}；在新标签页打开已净化来源，使用 noopener/noreferrer；不会重新读取、同步或确认来源内容。`;
};

const getSearchResultOpenTitle = (entity: any): string => {
  const candidates = [
    entity?.name,
    entity?.displayTitle,
    entity?.sourceTitle,
    entity?.description,
    entity?.id,
  ];
  const title = candidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim(),
  );
  return typeof title === 'string' ? title : '当前结果';
};

const getSearchResultOpenActionLabel = (entity: any): string => {
  const title = getSearchResultOpenTitle(entity);
  const linkState = getLinkSafetyState(entity);
  let routeLabel = '显示暂无可打开目标回执';
  if (linkState.exploreRoute) {
    routeLabel = `进入记忆内定位 ${linkState.exploreRoute}，不打开外部网页`;
  } else if (linkState.sourceUrl) {
    routeLabel = `在新标签页打开安全来源 ${linkState.sourceHost || 'http/https 来源'}，使用 noopener/noreferrer`;
  } else if (shouldShowDetailsFallback(entity)) {
    routeLabel = '查看 Memory Exploring 详情页 fallback';
  } else if (linkState.blockedLabels.length > 0) {
    routeLabel = `显示链接安全拦截回执（${linkState.blockedLabels.length} 项原因）`;
  }
  return `打开结果：${title}；${routeLabel}；不会写入记忆、反馈或来源系统，也不会重新读取、同步或确认来源内容`;
};

const getSearchResultMemoryRouteButtonBoundary = (entity: any): string => {
  const title = getSearchResultOpenTitle(entity);
  const route = getLinkSafetyState(entity).exploreRoute || '记忆内路由';
  return `在记忆中查看：${title}；只切换 Memory Exploring 内部视图 ${route}，不会打开外部网页、写入反馈、同步来源或确认事实。`;
};

const getSearchResultDetailsButtonBoundary = (entity: any): string => {
  const title = getSearchResultOpenTitle(entity);
  const route = getDetailsFallbackRoute(entity) || '详情页';
  return `查看详情：${title}；只打开 Memory Exploring ${route} fallback，不会打开外部网页、写入记忆、写反馈、同步来源或确认事实。`;
};

const getSearchResultRecoveryDiagnosticButtonBoundary = (
  entity: any,
): string => {
  const title = getSearchResultOpenTitle(entity);
  const linkState = getLinkSafetyState(entity);
  const status = linkState.blockedLabels.length > 0
    ? `${linkState.blockedLabels.length} 项拦截原因`
    : '没有安全内链、详情页或 http/https 来源';
  return `复制安全诊断：${title}；只复制标题、搜索条件、范围、结果 key、来源标签和${status}，不复制被拦截原始 URL，也不会写入、同步、确认或重新读取来源。`;
};

const getDetailsFallbackRoute = (entity: any): string | null => {
  const id = String(entity?.id || '').trim();
  switch (entity?.type) {
    case 'Topic':
      return id ? `/topic/${id}` : null;
    case 'Person':
      return id ? `/person/${id}` : null;
    case 'Project':
      return id ? `/project/${id}` : null;
    default:
      return ENTITY_TYPE_CONFIG[entity?.type] ? `/entity/${entity.type}` : null;
  }
};

const shouldShowDetailsFallback = (entity: any) => {
  const linkState = getLinkSafetyState(entity);
  return (
    Boolean(getDetailsFallbackRoute(entity)) &&
    !linkState.exploreRoute &&
    !linkState.sourceUrl &&
    linkState.blockedLabels.length === 0
  );
};

const shouldShowLinkRecoveryDiagnostic = (entity: any) => {
  const linkState = getLinkSafetyState(entity);
  return (
    !linkState.exploreRoute &&
    !linkState.sourceUrl &&
    !shouldShowDetailsFallback(entity)
  );
};

const getDecisionStanceLabel = (stance: string) => {
  switch (stance) {
    case 'supports':
      return '支撑';
    case 'contradicts':
      return '变化';
    case 'open_question':
      return '待确认';
    default:
      return '背景';
  }
};

const showOpenReceipt = (
  entity: any,
  input: Parameters<typeof buildMemoryOpenReceipt>[0],
) => {
  navigationReceipt.value = buildMemoryOpenReceipt({
    resultTitle: getSearchResultOpenTitle(entity),
    ...input,
  });
};

async function writeSearchClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error('clipboard_unavailable');
  }
}

async function copyLinkRecoveryDiagnostic(entity: any) {
  const linkState = getLinkSafetyState(entity);
  const title = getSearchResultOpenTitle(entity);
  const diagnostic = buildMemoryLinkRecoveryDiagnostic({
    result: entity,
    blockedLabels: linkState.blockedLabels,
    queryLabel: searchQuery.value || searchContext.value.query || '当前搜索',
    scopeLabel: currentScopeLabel.value,
    modeLabel: searchFailureModeLabel.value || getFeedbackSurfaceLabel(),
    typeFilterLabel: selectedTypeFilterLabel.value,
  });

  try {
    await writeSearchClipboardText(diagnostic);
    navigationReceipt.value = buildMemoryLinkRecoveryCopiedReceipt({
      resultTitle: title,
    });
  } catch (_error) {
    navigationReceipt.value = buildMemoryLinkRecoveryCopyFailureReceipt({
      resultTitle: title,
    });
  }
}

const openExploreLink = (entity: any) => {
  const safeExploreRoute = sanitizeMemoryExploreRoute(entity?.exploreLink);
  if (!safeExploreRoute) return false;
  router.push(safeExploreRoute.slice(1));
  showOpenReceipt(entity, {
    action: 'memory_route',
    exploreRoute: safeExploreRoute,
  });
  return true;
};

const openSourceUrl = (entity: any) => {
  const linkState = getLinkSafetyState(entity);
  const safeSourceUrl = linkState.sourceUrl;
  if (!safeSourceUrl) return false;
  window.open(safeSourceUrl, '_blank', 'noopener,noreferrer');
  showOpenReceipt(entity, {
    action: 'source_url',
    sourceHost: linkState.sourceHost,
  });
  return true;
};

const openDetailsFallback = (entity: any) => {
  const routePath = getDetailsFallbackRoute(entity);
  if (!routePath) return false;
  router.push(routePath);
  showOpenReceipt(entity, {
    action: 'memory_route',
    exploreRoute: routePath,
  });
  return true;
};

const broadenSearchScope = () => {
  const query = searchQuery.value.trim();
  if (!query) return;

  const nextScope = 'all';
  if (searchContext.value.mode === 'entity') {
    store.performEntityVectorSearch(
      query,
      searchContext.value.entityType,
      nextScope,
    );
  } else {
    store.performAskSearch(query, nextScope);
  }

  router.replace({
    path: '/search',
    query: { ...route.query, q: query, scope: nextScope },
  });
};

const retryFailedSearch = () => {
  const receipt = searchFailureReceipt.value;
  const query = (receipt?.query || searchQuery.value).trim();
  if (!query) return;

  const scope = (receipt?.scope || currentScopeValue.value) as RecallScope;
  if (receipt?.mode === 'entity') {
    store.performEntityVectorSearch(query, receipt.entityType, scope);
  } else {
    store.performAskSearch(query, scope);
  }

  router.replace({
    path: '/search',
    query: { ...route.query, q: query, scope },
  });
};

const confirmAskCandidate = async (
  candidate: AskClarificationCandidateView,
) => {
  const currentAsk = searchContext.value.askResult;
  const originalQuery =
    (searchContext.value.query || searchQuery.value || '').trim();
  const previousAnswer =
    typeof currentAsk?.answer === 'string' ? currentAsk.answer.trim() : '';
  if (!originalQuery || !previousAnswer || isConfirmingAskCandidate.value) {
    return;
  }

  const followupContext = [
    `User: ${originalQuery}`,
    `Assistant: ${previousAnswer}`,
  ].join('\n');
  const displayQuery = `${originalQuery} · 选择话题：${candidate.label}`;
  isConfirmingAskCandidate.value = true;
  try {
    await store.performAskSearch(
      String(candidate.index),
      currentScopeValue.value,
      followupContext,
      displayQuery,
      {
        source: 'candidate_clarification',
        originalQuery,
        selectedCandidateIndex: candidate.index,
        selectedCandidateLabel: candidate.label,
        contextAttached: Boolean(followupContext),
      },
    );
  } finally {
    isConfirmingAskCandidate.value = false;
  }
};

const handleResultClick = (entity: any) => {
  const linkState = getLinkSafetyState(entity);
  if (openExploreLink(entity)) return;
  if (openSourceUrl(entity)) return;
  if (openDetailsFallback(entity)) return;

  showOpenReceipt(entity, {
    action: linkState.blockedLabels.length > 0 ? 'blocked' : 'unavailable',
    blockedLabels: linkState.blockedLabels,
  });
};
</script>

<style scoped>
.search-results-section {
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeInUp 0.6s ease-out;
}

.search-results-header {
  text-align: center;
  margin-bottom: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 1rem;
  backdrop-filter: blur(10px);
}

/* AI 智能回答区域 */
.ai-answer-section {
  margin-bottom: 2rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(147, 51, 234, 0.08));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 1rem;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.ai-answer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  cursor: pointer;
  transition: background 0.3s ease;
  border-bottom: 1px solid rgba(59, 130, 246, 0.1);
}

.ai-answer-header:hover {
  background: rgba(59, 130, 246, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ai-icon {
  font-size: 1.5rem;
}

.ai-answer-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #60a5fa;
  margin: 0;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.toggle-btn:hover {
  background: rgba(59, 130, 246, 0.2);
}

.ai-answer-content {
  padding: 1.5rem;
}

.answer-main {
  margin-bottom: 1.5rem;
}

.answer-main p {
  color: #e2e8f0;
  font-size: 1rem;
  line-height: 1.8;
  margin: 0 0 0.75rem 0;
}

.answer-main p:last-child {
  margin-bottom: 0;
}

.answer-main strong {
  font-weight: 600;
  color: #f1f5f9;
}

.answer-main a {
  color: #60a5fa;
  text-decoration: none;
}

.answer-main a:hover {
  text-decoration: underline;
}

.ask-status-rail {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1.25rem;
  padding: 0.95rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.52);
}

.ask-status-rail-info {
  border-color: rgba(96, 165, 250, 0.32);
  background: rgba(30, 64, 175, 0.12);
}

.ask-status-rail-success {
  border-color: rgba(34, 197, 94, 0.32);
  background: rgba(21, 128, 61, 0.12);
}

.ask-status-rail-warning {
  border-color: rgba(251, 191, 36, 0.4);
  background: rgba(180, 83, 9, 0.12);
}

.ask-status-rail-muted {
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(51, 65, 85, 0.28);
}

.ask-status-rail-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.ask-status-rail-label {
  color: #f8fafc;
  font-size: 0.92rem;
  font-weight: 700;
}

.ask-status-rail-detail {
  color: #e2e8f0;
  font-size: 0.84rem;
  line-height: 1.55;
}

.ask-status-rail-metrics {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-content: flex-start;
  gap: 0.35rem;
  max-width: 330px;
}

.ask-status-rail-metrics span {
  white-space: nowrap;
  color: #fde68a;
  font-size: 0.78rem;
  line-height: 1.2;
  padding: 0.24rem 0.45rem;
  border-radius: 0.375rem;
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.ask-topic-lock-receipt {
  display: flex;
  justify-content: space-between;
  gap: 0.85rem;
  margin: -0.35rem 0 1.25rem;
  padding: 0.82rem 0.95rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(45, 212, 191, 0.28);
  background: rgba(13, 148, 136, 0.1);
}

.ask-topic-lock-receipt-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.24rem;
}

.ask-topic-lock-receipt-label {
  color: #ccfbf1;
  font-size: 0.84rem;
  font-weight: 700;
}

.ask-topic-lock-receipt-detail {
  color: #e2e8f0;
  font-size: 0.8rem;
  line-height: 1.5;
}

.ask-topic-lock-receipt-metrics {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-content: flex-start;
  gap: 0.35rem;
  max-width: 320px;
}

.ask-topic-lock-receipt-metrics span {
  white-space: nowrap;
  color: #ccfbf1;
  font-size: 0.72rem;
  font-weight: 650;
  padding: 0.18rem 0.4rem;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.22);
  border: 1px solid rgba(45, 212, 191, 0.2);
}

.ask-continuation-receipt {
  display: flex;
  justify-content: space-between;
  gap: 0.85rem;
  margin: -0.35rem 0 1.25rem;
  padding: 0.82rem 0.95rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  background: rgba(14, 116, 144, 0.1);
}

.ask-continuation-receipt-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.24rem;
}

.ask-continuation-receipt-label {
  color: #dbeafe;
  font-size: 0.84rem;
  font-weight: 700;
}

.ask-continuation-receipt-detail {
  color: #e2e8f0;
  font-size: 0.8rem;
  line-height: 1.5;
}

.ask-continuation-receipt-metrics {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-content: flex-start;
  gap: 0.35rem;
  max-width: 300px;
}

.ask-continuation-receipt-metrics span {
  white-space: nowrap;
  color: #bfdbfe;
  font-size: 0.72rem;
  font-weight: 650;
  padding: 0.18rem 0.4rem;
  border-radius: 999px;
  background: rgba(30, 64, 175, 0.24);
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.ask-clarification {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin: 0 0 1.25rem;
  padding: 0.95rem 1rem;
  border: 1px solid rgba(251, 191, 36, 0.34);
  border-radius: 0.5rem;
  background: rgba(217, 119, 6, 0.08);
}

.ask-clarification-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ask-clarification-label {
  color: #f8fafc;
  font-size: 0.9rem;
  font-weight: 650;
}

.ask-clarification-detail {
  color: #fde68a;
  font-size: 0.84rem;
  line-height: 1.55;
}

.ask-clarification-preflight {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.72rem 0.8rem;
  border: 1px solid rgba(251, 191, 36, 0.26);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.38);
}

.ask-clarification-preflight-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.ask-clarification-preflight-label {
  color: #fef3c7;
  font-size: 0.8rem;
  font-weight: 700;
}

.ask-clarification-preflight-detail {
  color: #e2e8f0;
  font-size: 0.78rem;
  line-height: 1.48;
}

.ask-clarification-preflight-metrics {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-content: flex-start;
  gap: 0.35rem;
}

.ask-clarification-preflight-metrics span {
  white-space: nowrap;
  color: #fef3c7;
  font-size: 0.72rem;
  font-weight: 650;
  padding: 0.18rem 0.38rem;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.14);
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.ask-clarification-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.55rem;
}

.ask-clarification-button {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.35rem 0.55rem;
  align-items: center;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(251, 191, 36, 0.36);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.46);
  color: #f8fafc;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.ask-clarification-button:hover:not(:disabled) {
  border-color: rgba(251, 191, 36, 0.7);
  background: rgba(120, 53, 15, 0.24);
}

.ask-clarification-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.ask-clarification-index {
  width: 1.55rem;
  height: 1.55rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.18);
  color: #fef3c7;
  font-size: 0.78rem;
  font-weight: 700;
}

.ask-clarification-topic {
  min-width: 0;
  color: #f8fafc;
  font-size: 0.86rem;
  font-weight: 620;
  overflow-wrap: anywhere;
}

.ask-clarification-reason {
  grid-column: 2;
  color: #fcd34d;
  font-size: 0.74rem;
  line-height: 1.35;
}

.ask-clarification-boundary {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.5;
}

.answer-memory-receipt {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1.25rem;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(15, 23, 42, 0.4);
}

.answer-memory-receipt-info {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(37, 99, 235, 0.08);
}

.answer-memory-receipt-success {
  border-color: rgba(34, 197, 94, 0.28);
  background: rgba(22, 163, 74, 0.08);
}

.answer-memory-receipt-warning {
  border-color: rgba(251, 191, 36, 0.34);
  background: rgba(217, 119, 6, 0.08);
}

.answer-memory-receipt-muted {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(51, 65, 85, 0.22);
}

.answer-memory-receipt-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.answer-memory-receipt-label {
  color: #f8fafc;
  font-size: 0.9rem;
  font-weight: 650;
}

.answer-memory-receipt-detail {
  color: #cbd5e1;
  font-size: 0.84rem;
  line-height: 1.55;
}

.answer-memory-authority {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.35rem;
  padding: 0.6rem 0.7rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.36);
}

.answer-memory-authority-success {
  border-color: rgba(34, 197, 94, 0.26);
}

.answer-memory-authority-info {
  border-color: rgba(96, 165, 250, 0.24);
}

.answer-memory-authority-warning {
  border-color: rgba(251, 191, 36, 0.3);
}

.answer-memory-authority-muted {
  border-color: rgba(148, 163, 184, 0.18);
}

.answer-memory-authority-line {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  min-width: 0;
}

.answer-memory-authority-label {
  flex: 0 0 auto;
  color: #e0f2fe;
  font-size: 0.78rem;
  font-weight: 650;
}

.answer-memory-authority-summary {
  min-width: 0;
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.5;
}

.answer-memory-authority-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.answer-memory-authority-metrics span {
  color: #dbeafe;
  font-size: 0.73rem;
  line-height: 1.2;
  padding: 0.2rem 0.4rem;
  border-radius: 0.35rem;
  background: rgba(30, 41, 59, 0.64);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.answer-memory-receipt-metrics {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-content: flex-start;
  gap: 0.35rem;
  max-width: 260px;
}

.answer-memory-receipt-metrics span {
  white-space: nowrap;
  color: #bfdbfe;
  font-size: 0.78rem;
  line-height: 1.2;
  padding: 0.24rem 0.45rem;
  border-radius: 0.375rem;
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.claim-attribution-receipt {
  align-items: flex-start;
}

.claim-attribution-details {
  margin-top: 0.35rem;
  color: #cbd5e1;
  font-size: 0.78rem;
}

.claim-attribution-details summary {
  width: fit-content;
  cursor: pointer;
  color: #bfdbfe;
}

.claim-attribution-item {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.55rem;
  padding: 0.65rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.34);
}

.claim-attribution-item-copy {
  display: grid;
  gap: 0.2rem;
}

.claim-attribution-item-copy strong {
  color: #e0f2fe;
}

.claim-attribution-item-copy q {
  color: #94a3b8;
  font-style: normal;
}

.claim-attribution-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.claim-attribution-actions button {
  padding: 0.3rem 0.48rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(96, 165, 250, 0.25);
  color: #dbeafe;
  background: rgba(30, 64, 175, 0.16);
  cursor: pointer;
}

.claim-attribution-actions button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.claim-attribution-correction-state {
  margin: 0;
  font-size: 0.76rem;
}

.claim-attribution-correction-success {
  color: #86efac;
}

.claim-attribution-correction-error {
  color: #fca5a5;
}

.answer-structured {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.findings-section h4,
.timeline-section h4,
.insights-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.findings-section ul,
.insights-section ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.findings-section li,
.insights-section li {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: rgba(30, 41, 59, 0.4);
  border-left: 3px solid #60a5fa;
  border-radius: 0.25rem;
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.6;
}

.timeline-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 0.5rem;
}

.timeline-date {
  font-size: 0.875rem;
  font-weight: 600;
  color: #60a5fa;
  min-width: 100px;
}

.timeline-event {
  flex: 1;
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
}

.answer-metadata {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  font-size: 0.875rem;
  color: #94a3b8;
}

.decision-chain-section {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid rgba(20, 184, 166, 0.28);
  border-radius: 0.75rem;
  background: rgba(15, 118, 110, 0.12);
}

.decision-chain-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.decision-chain-header h4 {
  margin: 0 0 0.35rem;
  color: #5eead4;
  font-size: 1rem;
}

.decision-chain-header p,
.decision-chain-card p,
.decision-evidence-item p {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.6;
  font-size: 0.875rem;
}

.decision-confidence {
  flex: 0 0 auto;
  padding: 0.25rem 0.55rem;
  border: 1px solid rgba(94, 234, 212, 0.4);
  border-radius: 999px;
  color: #99f6e4;
  font-size: 0.8rem;
  font-weight: 600;
}

.decision-statement {
  margin-bottom: 1rem;
  padding: 0.85rem;
  border-left: 3px solid #5eead4;
  border-radius: 0.35rem;
  background: rgba(15, 23, 42, 0.42);
  color: #e2e8f0;
  line-height: 1.6;
}

.decision-chain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.85rem;
}

.decision-chain-card {
  padding: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.34);
}

.decision-chain-card h5,
.decision-evidence-list h5 {
  margin: 0 0 0.65rem;
  color: #99f6e4;
  font-size: 0.9rem;
}

.decision-chain-card ul {
  margin: 0.65rem 0 0;
  padding-left: 1.1rem;
  color: #cbd5e1;
  line-height: 1.6;
  font-size: 0.875rem;
}

.decision-conclusion {
  color: #e2e8f0;
}

.decision-muted {
  color: #94a3b8;
}

.decision-missing {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.75rem;
  color: #fbbf24;
  font-size: 0.8rem;
}

.decision-evidence-list {
  margin-top: 1rem;
}

.decision-evidence-item {
  padding: 0.8rem;
  margin-top: 0.6rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.32);
}

.decision-evidence-source,
.decision-evidence-stance {
  display: inline-flex;
  margin: 0 0.4rem 0.5rem 0;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.8);
  color: #94a3b8;
  font-size: 0.75rem;
}

.decision-evidence-stance {
  color: #5eead4;
}

.decision-link-btn {
  margin-top: 0.65rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid rgba(94, 234, 212, 0.35);
  border-radius: 0.4rem;
  background: rgba(20, 184, 166, 0.08);
  color: #5eead4;
  cursor: pointer;
}

.link-safety-notes {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}

/* 关联实体数据标题 */
.entities-section-header {
  margin-bottom: 1.5rem;
}

.entities-section-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid rgba(59, 130, 246, 0.3);
}

.search-results-header h2 {
  font-size: 1.75rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #ffffff;
}

.search-results-header p {
  color: #cbd5e1;
  font-size: 1rem;
}

.search-results-header .scope-caption {
  margin-top: 0.5rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.85rem;
  padding: 3rem;
  color: #94a3b8;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid rgba(59, 130, 246, 0.3);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-scope-receipt {
  display: grid;
  gap: 0.45rem;
  width: min(100%, 48rem);
  padding: 0.82rem 0.95rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.48);
  color: #dbeafe;
  text-align: left;
  font-size: 0.84rem;
  line-height: 1.45;
}

.loading-scope-receipt strong {
  color: #f8fafc;
  font-size: 0.86rem;
}

.loading-scope-receipt-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.loading-scope-receipt-metrics span {
  padding: 0.2rem 0.46rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.42rem;
  background: rgba(30, 41, 59, 0.62);
  color: #bfdbfe;
  font-size: 0.76rem;
}

.results-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.results-overview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.results-count {
  color: #94a3b8;
  font-size: 0.875rem;
}

.results-scope-breakdown {
  color: #cbd5e1;
  font-size: 0.875rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.38);
}

.scope-exposure-notice {
  color: #fde68a;
  font-size: 0.875rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 0.45rem;
  background: rgba(120, 53, 15, 0.32);
}

.scope-boundary-notice {
  color: #cbd5e1;
  font-size: 0.875rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.44);
}

.scope-broaden-inline {
  min-height: 1.9rem;
  padding: 0.32rem 0.6rem;
  border: 1px solid rgba(96, 165, 250, 0.38);
  border-radius: 0.45rem;
  background: rgba(37, 99, 235, 0.18);
  color: #bfdbfe;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.scope-broaden-inline:hover,
.scope-broaden-inline:focus-visible {
  border-color: rgba(147, 197, 253, 0.58);
  background: rgba(37, 99, 235, 0.28);
  outline: none;
}

.search-result-batch-receipt {
  display: grid;
  gap: 0.45rem;
  max-width: min(100%, 48rem);
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(125, 211, 252, 0.28);
  border-radius: 0.5rem;
  background: rgba(8, 47, 73, 0.2);
  color: #bae6fd;
  font-size: 0.82rem;
  line-height: 1.4;
}

.search-result-batch-receipt-warning {
  border-color: rgba(245, 158, 11, 0.38);
  background: rgba(120, 53, 15, 0.2);
  color: #fed7aa;
}

.search-result-batch-receipt-main {
  display: grid;
  gap: 0.2rem;
}

.search-result-batch-receipt-main strong {
  color: inherit;
}

.search-result-batch-receipt-metrics {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.search-result-batch-receipt-metrics span {
  padding: 0.16rem 0.42rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.34);
  color: inherit;
  font-size: 0.74rem;
}

.source-coverage-receipt {
  display: grid;
  gap: 0.45rem;
  max-width: min(100%, 48rem);
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.5rem;
  background: rgba(30, 64, 175, 0.16);
  color: #dbeafe;
  font-size: 0.82rem;
  line-height: 1.4;
}

.source-coverage-receipt-warning {
  border-color: rgba(245, 158, 11, 0.38);
  background: rgba(120, 53, 15, 0.2);
  color: #fed7aa;
}

.source-coverage-receipt-main {
  display: grid;
  gap: 0.2rem;
}

.source-coverage-receipt-main strong {
  color: inherit;
}

.source-coverage-receipt-metrics {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.source-coverage-receipt-metrics span {
  padding: 0.16rem 0.42rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.34);
  color: inherit;
  font-size: 0.74rem;
}

.type-filter-receipt {
  display: grid;
  gap: 0.45rem;
  max-width: min(100%, 48rem);
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(45, 212, 191, 0.28);
  border-radius: 0.5rem;
  background: rgba(20, 83, 45, 0.16);
  color: #d1fae5;
  font-size: 0.82rem;
  line-height: 1.4;
}

.type-filter-receipt-warning {
  border-color: rgba(245, 158, 11, 0.38);
  background: rgba(120, 53, 15, 0.2);
  color: #fed7aa;
}

.type-filter-receipt-main {
  display: grid;
  gap: 0.2rem;
}

.type-filter-receipt-main strong {
  color: #f8fafc;
  font-size: 0.78rem;
}

.type-filter-receipt-metrics {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.type-filter-receipt-metrics span {
  padding: 0.2rem 0.45rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.4rem;
  background: rgba(15, 23, 42, 0.34);
  color: #cbd5e1;
  font-size: 0.76rem;
}

.type-filter-reset {
  min-height: 1.75rem;
  padding: 0.26rem 0.55rem;
  border: 1px solid rgba(45, 212, 191, 0.34);
  border-radius: 0.42rem;
  background: rgba(20, 184, 166, 0.14);
  color: #99f6e4;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
}

.type-filter-reset:hover,
.type-filter-reset:focus-visible {
  border-color: rgba(94, 234, 212, 0.56);
  background: rgba(20, 184, 166, 0.22);
  outline: none;
}

.recall-channel-receipt {
  display: grid;
  gap: 0.25rem;
  max-width: min(100%, 46rem);
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.48);
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.35;
}

.recall-channel-receipt strong {
  color: #e2e8f0;
  font-size: 0.78rem;
  letter-spacing: 0;
}

.recall-channel-reasons {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.recall-channel-reasons span {
  display: inline-flex;
  max-width: 100%;
  padding: 0.22rem 0.45rem;
  border: 1px solid rgba(245, 158, 11, 0.32);
  border-radius: 0.38rem;
  background: rgba(120, 53, 15, 0.2);
  color: #fde68a;
  font-size: 0.76rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.recall-channel-receipt-ok {
  border-color: rgba(34, 197, 94, 0.34);
  background: rgba(22, 163, 74, 0.12);
}

.recall-channel-receipt-warning {
  border-color: rgba(245, 158, 11, 0.36);
  background: rgba(146, 64, 14, 0.18);
}

.recall-channel-receipt-danger {
  border-color: rgba(248, 113, 113, 0.4);
  background: rgba(127, 29, 29, 0.2);
}

.evidence-channel-overlap-receipt {
  display: grid;
  gap: 0.45rem;
  max-width: min(100%, 46rem);
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(14, 165, 233, 0.3);
  border-radius: 0.5rem;
  background: rgba(8, 47, 73, 0.2);
  color: #bae6fd;
  font-size: 0.82rem;
  line-height: 1.35;
}

.evidence-channel-overlap-main {
  display: grid;
  gap: 0.22rem;
}

.evidence-channel-overlap-main strong {
  color: #e0f2fe;
  font-size: 0.78rem;
  letter-spacing: 0;
}

.evidence-channel-overlap-metrics {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.evidence-channel-overlap-metrics span {
  display: inline-flex;
  padding: 0.2rem 0.45rem;
  border: 1px solid rgba(125, 211, 252, 0.24);
  border-radius: 999px;
  background: rgba(12, 74, 110, 0.26);
  color: inherit;
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.2;
}

.evidence-channel-overlap-receipt-warning {
  border-color: rgba(245, 158, 11, 0.34);
  background: rgba(120, 53, 15, 0.16);
  color: #fde68a;
}

.evidence-channel-overlap-receipt-warning
  .evidence-channel-overlap-main
  strong {
  color: #fef3c7;
}

.evidence-channel-overlap-receipt-warning
  .evidence-channel-overlap-metrics
  span {
  border-color: rgba(251, 191, 36, 0.28);
  background: rgba(120, 53, 15, 0.22);
}

.channel-diagnostics {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}

.channel-diagnostic {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  padding: 0.28rem 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.42);
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.2;
  white-space: nowrap;
}

.weave-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.5rem 0 0.25rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid rgba(56, 132, 255, 0.34);
  border-radius: 999px;
  background: rgba(36, 89, 166, 0.16);
  color: #bfdbfe;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.weave-badge-glyph {
  font-size: 0.9rem;
  opacity: 0.9;
}

.channel-diagnostic-ok {
  border-color: rgba(34, 197, 94, 0.34);
  color: #bbf7d0;
  background: rgba(22, 163, 74, 0.14);
}

.channel-diagnostic-warning {
  border-color: rgba(245, 158, 11, 0.38);
  color: #fde68a;
  background: rgba(146, 64, 14, 0.2);
}

.channel-diagnostic-danger {
  border-color: rgba(248, 113, 113, 0.42);
  color: #fecaca;
  background: rgba(127, 29, 29, 0.22);
}

.channel-diagnostic-muted {
  color: #94a3b8;
}

.results-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.type-filter {
  display: inline-grid;
  gap: 0.15rem;
  justify-items: start;
  min-width: 8.75rem;
  padding: 0.55rem 0.85rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  line-height: 1.2;
  white-space: nowrap;
  text-align: left;
}

.type-filter:hover {
  background: rgba(59, 130, 246, 0.2);
}

.type-filter.active {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
}

.type-filter-main {
  font-weight: 700;
}

.type-filter small {
  color: #bfdbfe;
  font-size: 0.7rem;
  font-weight: 600;
}

.search-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1rem;
}

.search-navigation-receipt {
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.66);
  color: #dbeafe;
}

.search-navigation-receipt-info {
  border-color: rgba(59, 130, 246, 0.32);
  background: rgba(30, 64, 175, 0.16);
}

.search-navigation-receipt-warning {
  border-color: rgba(245, 158, 11, 0.38);
  background: rgba(120, 53, 15, 0.18);
  color: #fed7aa;
}

.navigation-receipt-title {
  margin-bottom: 0.4rem;
  font-size: 0.86rem;
  font-weight: 700;
}

.search-navigation-receipt ul {
  margin: 0;
  padding-left: 1.1rem;
}

.search-navigation-receipt li {
  margin: 0.18rem 0;
  font-size: 0.8rem;
  line-height: 1.5;
}

.search-result-card {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: all 0.3s ease;
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.search-result-card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
}

.search-result-card:focus-within {
  border-color: rgba(96, 165, 250, 0.45);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.result-type-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 1rem;
}

.type-icon {
  font-size: 1rem;
}

.type-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: #60a5fa;
}

.relevance-score {
  font-size: 0.75rem;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}

.scope-badge {
  font-size: 0.75rem;
  color: #34d399;
  background: rgba(16, 185, 129, 0.16);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}

.result-content {
  margin-bottom: 1rem;
}

.result-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #e2e8f0;
}

.result-description {
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 0.75rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-title :deep(.search-highlight),
.result-description :deep(.search-highlight) {
  padding: 0.08rem 0.18rem;
  border-radius: 0.24rem;
  background: rgba(251, 191, 36, 0.28);
  color: #fde68a;
  font-weight: 700;
}

.result-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  color: #94a3b8;
  font-size: 0.75rem;
}

.result-meta-item {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.result-meta-item + .result-meta-item::before {
  content: '·';
  margin-right: 0.5rem;
  color: #475569;
}

.memory-link-safety-status {
  display: grid;
  gap: 0.3rem;
  margin: 0.65rem 0 0.75rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.44);
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.35;
}

.memory-link-safety-status strong {
  color: #e2e8f0;
  font-size: 0.8rem;
}

.memory-link-safety-status span {
  overflow-wrap: anywhere;
}

.memory-link-safety-status-ready {
  border-color: rgba(45, 212, 191, 0.3);
  background: rgba(20, 83, 45, 0.16);
  color: #ccfbf1;
}

.memory-link-safety-status-warning {
  border-color: rgba(251, 191, 36, 0.34);
  background: rgba(120, 53, 15, 0.18);
  color: #fde68a;
}

.memory-link-safety-status-muted {
  color: #94a3b8;
}

.memory-link-safety-metrics {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.memory-link-safety-metrics em {
  padding: 0.16rem 0.42rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.32);
  color: inherit;
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 600;
}

.match-reasons {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.match-reason {
  padding: 0.2rem 0.45rem;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 0.375rem;
  color: #bfdbfe;
  background: rgba(37, 99, 235, 0.12);
  font-size: 0.72rem;
  line-height: 1.2;
}

.result-tags {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.result-tag {
  padding: 0.25rem 0.5rem;
  background: rgba(147, 51, 234, 0.2);
  color: #a78bfa;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.result-tag.more-tags {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.result-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.result-open-btn {
  margin-right: auto;
}

.link-safety-note {
  padding: 0.32rem 0.55rem;
  border: 1px solid rgba(251, 191, 36, 0.24);
  border-radius: 0.45rem;
  background: rgba(120, 53, 15, 0.16);
  color: #fde68a;
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.result-feedback {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.feedback-status {
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.3;
  margin-right: 0.15rem;
}

.feedback-status-pending {
  color: #fde68a;
}

.feedback-status-positive {
  color: #bbf7d0;
}

.feedback-status-negative {
  color: #fecaca;
}

.feedback-status-cleared {
  color: #cbd5e1;
}

.feedback-receipt {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.44);
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.45;
}

.feedback-receipt strong {
  color: #f8fafc;
  font-size: 0.8rem;
  font-weight: 700;
}

.feedback-receipt-effect {
  color: #e2e8f0;
}

.feedback-receipt-context {
  color: #bfdbfe;
}

.feedback-receipt-positive {
  border-color: rgba(34, 197, 94, 0.26);
  background: rgba(22, 163, 74, 0.08);
}

.feedback-receipt-negative {
  border-color: rgba(248, 113, 113, 0.28);
  background: rgba(127, 29, 29, 0.12);
}

.feedback-receipt-cleared {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(51, 65, 85, 0.16);
}

.feedback-receipt-preview {
  border-color: rgba(125, 211, 252, 0.24);
  background: rgba(8, 47, 73, 0.18);
}

.feedback-receipt-error {
  border-color: rgba(248, 113, 113, 0.34);
  background: rgba(127, 29, 29, 0.18);
}

.feedback-refresh-btn {
  align-self: flex-start;
  min-height: 1.9rem;
  padding: 0.34rem 0.65rem;
  border: 1px solid rgba(125, 211, 252, 0.28);
  border-radius: 0.45rem;
  background: rgba(8, 47, 73, 0.32);
  color: #bae6fd;
  cursor: pointer;
  font-size: 0.77rem;
  font-weight: 700;
  line-height: 1.2;
}

.feedback-refresh-btn:hover {
  border-color: rgba(125, 211, 252, 0.5);
  color: #e0f2fe;
}

.feedback-btn {
  min-height: 2rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.62);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.2;
  transition: all 0.2s ease;
}

.feedback-btn:hover:not(:disabled) {
  border-color: rgba(96, 165, 250, 0.42);
  color: #dbeafe;
}

.feedback-btn-positive.active {
  border-color: rgba(34, 197, 94, 0.46);
  background: rgba(22, 163, 74, 0.18);
  color: #bbf7d0;
}

.feedback-btn-negative.active {
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(127, 29, 29, 0.2);
  color: #fecaca;
}

.feedback-btn:disabled {
  cursor: wait;
  opacity: 0.68;
}

.clear-feedback-btn {
  color: #94a3b8;
}

.feedback-error {
  margin-bottom: 1rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 0.5rem;
  background: rgba(127, 29, 29, 0.22);
  color: #fecaca;
  font-size: 0.875rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.5rem;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.action-btn.primary {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}

.action-btn.secondary {
  color: #cbd5e1;
  border-color: rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.08);
}

.action-btn:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
}

.action-btn:focus-visible {
  outline: 2px solid rgba(147, 197, 253, 0.82);
  outline-offset: 2px;
}

.empty-search-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  text-align: center;
}

.search-failure-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 2rem;
  text-align: center;
  border: 1px solid rgba(248, 113, 113, 0.22);
  border-radius: 0.75rem;
  background: rgba(127, 29, 29, 0.12);
  color: #fecaca;
}

.search-failure-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(248, 113, 113, 0.32);
  border-radius: 999px;
  background: rgba(127, 29, 29, 0.22);
  color: #fecaca;
  font-size: 1.5rem;
  font-weight: 700;
}

.search-failure-title {
  margin: 0 0 0.5rem;
  color: #fee2e2;
  font-size: 1.05rem;
  font-weight: 700;
}

.search-failure-detail {
  max-width: 44rem;
  margin: 0 0 0.75rem;
  color: #fecaca;
  font-size: 0.92rem;
  line-height: 1.55;
}

.search-failure-meta {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.search-failure-meta span {
  padding: 0.3rem 0.55rem;
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.28);
  color: #fde2e2;
  font-size: 0.82rem;
}

.search-failure-boundary {
  max-width: 40rem;
  margin: 0;
  color: #fca5a5;
  font-size: 0.86rem;
  line-height: 1.5;
}

.search-failure-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.empty-search-state > span {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-search-state p {
  margin-bottom: 0.5rem;
}

.search-tips {
  font-size: 0.875rem;
  color: #64748b;
}

.empty-search-receipt {
  display: grid;
  gap: 0.55rem;
  width: min(100%, 48rem);
  margin-top: 1rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 0.55rem;
  background: rgba(15, 23, 42, 0.48);
  color: #cbd5e1;
  text-align: left;
}

.empty-search-receipt-warning {
  border-color: rgba(245, 158, 11, 0.36);
  background: rgba(146, 64, 14, 0.18);
}

.empty-search-receipt-main {
  display: grid;
  gap: 0.28rem;
  font-size: 0.86rem;
  line-height: 1.45;
}

.empty-search-receipt-main strong {
  color: #e2e8f0;
  font-size: 0.8rem;
}

.empty-search-receipt-metrics {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.empty-search-receipt-metrics span {
  padding: 0.22rem 0.45rem;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 0.38rem;
  background: rgba(15, 23, 42, 0.36);
  color: #dbeafe;
  font-size: 0.76rem;
}

.empty-search-recovery {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding-left: 1rem;
  color: #bfdbfe;
  font-size: 0.82rem;
  line-height: 1.45;
}

.empty-search-state > .recall-channel-receipt,
.empty-search-state > .channel-diagnostics {
  width: min(100%, 48rem);
  margin-top: 0.75rem;
  text-align: left;
}

.empty-action-btn {
  margin-top: 1rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 0.5rem;
  background: rgba(59, 130, 246, 0.16);
  color: #bfdbfe;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
}

.empty-action-btn:hover {
  border-color: rgba(147, 197, 253, 0.55);
  background: rgba(59, 130, 246, 0.25);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .ask-status-rail {
    flex-direction: column;
  }

  .ask-status-rail-metrics {
    justify-content: flex-start;
    max-width: none;
  }

  .ask-topic-lock-receipt {
    flex-direction: column;
  }

  .ask-topic-lock-receipt-metrics {
    justify-content: flex-start;
    max-width: none;
  }

  .ask-continuation-receipt {
    flex-direction: column;
  }

  .ask-continuation-receipt-metrics {
    justify-content: flex-start;
    max-width: none;
  }

  .ask-clarification-preflight {
    flex-direction: column;
  }

  .ask-clarification-preflight-metrics {
    justify-content: flex-start;
  }

  .answer-memory-receipt {
    flex-direction: column;
  }

  .answer-memory-receipt-metrics {
    justify-content: flex-start;
    max-width: none;
  }

  .answer-memory-authority-line {
    flex-direction: column;
    gap: 0.25rem;
  }

  .search-results-grid {
    grid-template-columns: 1fr;
  }
  
  .results-summary {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .results-filters {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
