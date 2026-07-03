<template>
  <div class="user-profile-section">
    <div class="profile-header">
      <div class="header-content">
        <div class="header-text">
          <h2>👤 用户画像分析</h2>
          <p>基于您的行为模式和兴趣偏好生成的个性化画像</p>
        </div>
        <div class="header-actions">
          <div class="export-scope-receipt" aria-live="polite">
            <span class="export-scope-label">导出范围</span>
            <span>{{ profileExportScopeSummary }}</span>
          </div>
          <ul
            class="export-preflight-checklist"
            aria-label="导出前检查"
          >
            <li
              v-for="item in profileExportPreflightItems"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
          <button 
            class="export-btn"
            :disabled="isExporting"
            @click="exportUserProfile"
          >
            <span v-if="!isExporting">📥 导出画像</span>
            <span v-else>⏳ 导出中...</span>
          </button>
        </div>
      </div>

      <div
        v-if="statusMessage"
        class="status-message"
        :class="statusTone"
      >
        <span>{{ statusMessage }}</span>
        <button
          v-if="recentlyRetractedProfileItem"
          type="button"
          class="status-action-btn"
          :disabled="isRestoringProfileItem"
          @click="restoreRetractedProfileItem"
        >
          {{ isRestoringProfileItem ? '恢复中...' : '撤销排除' }}
        </button>
      </div>
      <div
        v-if="profileExportReceipt"
        class="profile-export-receipt"
        :class="`receipt-${profileExportReceipt.tone}`"
        aria-live="polite"
      >
        <div class="profile-export-receipt-copy">
          <span class="profile-export-receipt-label">画像导出回执</span>
          <strong>{{ profileExportReceipt.title }}</strong>
          <p>{{ profileExportReceipt.detail }}</p>
        </div>
        <div class="profile-export-receipt-chips">
          <span
            v-for="chip in profileExportReceipt.chips"
            :key="chip"
          >
            {{ chip }}
          </span>
        </div>
      </div>
      <div
        v-if="profileCalibrationReceipt"
        class="profile-calibration-receipt"
        :class="`receipt-${profileCalibrationReceipt.tone}`"
        aria-live="polite"
      >
        <div class="profile-calibration-receipt-copy">
          <span class="profile-calibration-receipt-label">画像校准回执</span>
          <strong>{{ profileCalibrationReceipt.title }}</strong>
          <p>{{ profileCalibrationReceipt.detail }}</p>
        </div>
        <div class="profile-calibration-receipt-chips">
          <span
            v-for="chip in profileCalibrationReceipt.chips"
            :key="chip"
          >
            {{ chip }}
          </span>
        </div>
      </div>
    </div>
    
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>加载用户画像数据...</span>
    </div>
    
    <div v-else-if="userProfile && userProfileAnalysis" class="profile-content">
      <div class="review-strip">
        <div class="review-summary-card primary">
          <span class="review-label">待确认推断</span>
          <strong>{{ profileHealthMetrics.inferredCount }}</strong>
          <button
            type="button"
            class="review-link"
            :disabled="profileHealthMetrics.inferredCount === 0"
            @click="scrollToSection('profile-predictions')"
          >
            处理
          </button>
        </div>
        <div class="review-summary-card">
          <span class="review-label">确认率</span>
          <strong>{{ profileHealthMetrics.confirmationRate.toFixed(0) }}%</strong>
          <button
            type="button"
            class="review-link"
            @click="scrollToSection('profile-items')"
          >
            查看
          </button>
        </div>
        <div class="review-summary-card">
          <span class="review-label">证据覆盖</span>
          <strong>{{ profileHealthMetrics.evidenceCoverage.toFixed(0) }}%</strong>
          <button
            type="button"
            class="review-link"
            @click="scrollToSection('profile-items')"
          >
            核对
          </button>
        </div>
        <div class="review-summary-card">
          <span class="review-label">最近信号</span>
          <strong class="review-time">{{ formatTime(userProfile.statistics.lastActiveTime) }}</strong>
        </div>
      </div>

      <div class="profile-card">
        <h3>✍️ 主人表达与偏好</h3>
        <p class="profile-card-description">
          显式添加会写入一条手动画像；是否进入每次上下文仍受确认状态、场景和证据预算约束。
        </p>
        <div class="owner-profile-form">
          <select v-model="explicitProfileDraft.itemType">
            <option value="preference">偏好</option>
            <option value="habit">习惯</option>
            <option value="constraint">约束</option>
            <option value="fact">事实</option>
            <option value="interest">兴趣</option>
          </select>
          <select v-model="explicitProfileDraft.itemKey">
            <option value="writing_style.ringcentral.reply">RingCentral 回复风格</option>
            <option value="writing_style.ringcentral.thread_reply">Thread 回复风格</option>
            <option value="writing_style.jira.comment">Jira 评论风格</option>
            <option value="communication_style">通用沟通风格</option>
            <option value="response_style">默认回复风格</option>
            <option value="owner_response_constraint">不要替我说的话</option>
            <option :value="CUSTOM_PROFILE_KEY">自定义画像键</option>
          </select>
          <input
            v-if="explicitProfileDraft.itemKey === CUSTOM_PROFILE_KEY"
            v-model.trim="explicitProfileDraft.customItemKey"
            class="custom-profile-key-input"
            type="text"
            placeholder="例如：project.personal_ai.priority"
          />
          <textarea
            v-model="explicitProfileDraft.itemValue"
            rows="3"
            placeholder="例如：中文回复尽量简短，先给结论，再给一个明确 next step。"
          />
          <div class="explicit-profile-entry-receipt" aria-live="polite">
            <span class="explicit-profile-entry-label">录入范围</span>
            <span>{{ explicitProfileEntryReceipt }}</span>
          </div>
          <button
            type="button"
            class="primary-action-btn"
            :disabled="isCreatingExplicitProfile || !resolvedExplicitProfileItemKey || !explicitProfileDraft.itemValue.trim()"
            @click="createExplicitProfileItem"
          >
            {{ isCreatingExplicitProfile ? '添加中...' : '添加到画像' }}
          </button>
        </div>
      </div>

      <!-- 核心兴趣概览 -->
      <div class="profile-card">
        <h3>🎯 当前关注重点</h3>
        <div class="interest-grid">
          <div class="interest-category">
            <h4>📁 项目</h4>
            <div class="interest-list">
              <div v-if="getProjectsWithImportance().length === 0" class="inline-empty compact">
                暂无项目画像条目
              </div>
              <div 
                v-for="(project, idx) in getProjectsWithImportance()" 
                :key="project.id || idx" 
                class="interest-item"
                :class="{ updating: isItemPending(project.id) }"
              >
                <span class="interest-icon">🚀</span>
                <span class="interest-name">{{ project.name }}</span>
                <div class="importance-rating">
                  <div class="stars">
                    <button
                      v-for="star in 5" 
                      :key="star"
                      type="button"
                      class="star"
                      :class="{
                        active: star <= (project.explicitImportance || 0) * 5,
                        disabled: isItemPending(project.id)
                      }"
                      :disabled="isItemPending(project.id)"
                      :aria-label="`将 ${project.name} 重要性设为 ${star} 星`"
                      :aria-pressed="star <= (project.explicitImportance || 0) * 5"
                      @click="setImportance(project.id, 'project', star / 5)"
                    >
                      ★
                    </button>
                  </div>
                </div>
                <div class="star-calibration-receipt">
                  <span class="star-calibration-label">星级校准</span>
                  <span>{{ getStarCalibrationImpactReceipt(project) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="interest-category">
            <h4>👥 人员</h4>
            <div class="interest-list">
              <div v-if="getPeopleWithImportance().length === 0" class="inline-empty compact">
                暂无人员画像条目
              </div>
              <div 
                v-for="(person, idx) in getPeopleWithImportance()" 
                :key="person.id || idx" 
                class="interest-item"
                :class="{ updating: isItemPending(person.id) }"
              >
                <span class="interest-icon">👤</span>
                <span class="interest-name">{{ person.name }}</span>
                <div class="importance-rating">
                  <div class="stars">
                    <button
                      v-for="star in 5" 
                      :key="star"
                      type="button"
                      class="star"
                      :class="{
                        active: star <= (person.explicitImportance || 0) * 5,
                        disabled: isItemPending(person.id)
                      }"
                      :disabled="isItemPending(person.id)"
                      :aria-label="`将 ${person.name} 重要性设为 ${star} 星`"
                      :aria-pressed="star <= (person.explicitImportance || 0) * 5"
                      @click="setImportance(person.id, 'person', star / 5)"
                    >
                      ★
                    </button>
                  </div>
                </div>
                <div class="star-calibration-receipt">
                  <span class="star-calibration-label">星级校准</span>
                  <span>{{ getStarCalibrationImpactReceipt(person) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="interest-category">
            <h4>💡 主题</h4>
            <div class="interest-list">
              <div v-if="getTopicsWithImportance().length === 0" class="inline-empty compact">
                暂无主题画像条目
              </div>
              <div 
                v-for="(topic, idx) in getTopicsWithImportance()" 
                :key="topic.id || idx" 
                class="interest-item"
                :class="{ updating: isItemPending(topic.id) }"
              >
                <span class="interest-icon">💭</span>
                <span class="interest-name">{{ topic.name }}</span>
                <div class="importance-rating">
                  <div class="stars">
                    <button
                      v-for="star in 5" 
                      :key="star"
                      type="button"
                      class="star"
                      :class="{
                        active: star <= (topic.explicitImportance || 0) * 5,
                        disabled: isItemPending(topic.id)
                      }"
                      :disabled="isItemPending(topic.id)"
                      :aria-label="`将 ${topic.name} 重要性设为 ${star} 星`"
                      :aria-pressed="star <= (topic.explicitImportance || 0) * 5"
                      @click="setImportance(topic.id, 'topic', star / 5)"
                    >
                      ★
                    </button>
                  </div>
                </div>
                <div class="star-calibration-receipt">
                  <span class="star-calibration-label">星级校准</span>
                  <span>{{ getStarCalibrationImpactReceipt(topic) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 行为洞察 -->
      <div class="profile-card">
        <h3>🔍 行为洞察</h3>
        <div class="insights-grid">
          <div class="insight-item">
            <h4>⏰ 工作模式</h4>
            <p>{{ userProfileAnalysis.insights.workingPattern }}</p>
          </div>
          <div class="insight-item">
            <h4>🤝 协作风格</h4>
            <p>{{ userProfileAnalysis.insights.collaborationStyle }}</p>
          </div>
          <div class="insight-item">
            <h4>🎓 专业领域</h4>
            <div class="tag-list">
              <span 
                v-for="(area, idx) in userProfileAnalysis.insights.focusAreas" 
                :key="idx" 
                class="focus-tag"
              >
                {{ area }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 智能推荐 -->
      <div class="profile-card">
        <h3>💡 校准建议</h3>
        <div class="suggestions-list">
          <div 
            v-for="(suggestion, idx) in userProfileAnalysis.insights.suggestedContent" 
            :key="idx" 
            class="suggestion-item"
          >
            <span class="suggestion-icon">📌</span>
            <span>{{ suggestion }}</span>
          </div>
        </div>
      </div>
      
      <!-- 预测兴趣 -->
      <div
        v-if="reviewQueueTotal > 0"
        id="profile-predictions"
        class="profile-card"
      >
        <div class="queue-header">
          <div>
            <h3>🔮 待确认推断</h3>
            <p class="queue-hint">
              按影响排序，确认前不会进入个性化上下文。
            </p>
          </div>
          <div class="review-filter-group" aria-label="待确认推断筛选">
            <button
              v-for="option in reviewFilterOptions"
              :key="option.value"
              type="button"
              class="review-filter-btn"
              :class="{ active: reviewQueueFilter === option.value }"
              :aria-pressed="reviewQueueFilter === option.value"
              @click="reviewQueueFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div v-if="profileReviewQueue.length === 0" class="inline-empty compact">
          当前筛选下没有待处理条目
        </div>
        <div class="predictions-list">
          <div
            v-for="prediction in profileReviewQueue"
            :key="prediction.id"
            class="prediction-item"
            :class="{ updating: isItemPending(prediction.id) }"
          >
            <div class="prediction-header">
              <span class="prediction-type">{{ prediction.type }}</span>
              <span
                class="calibration-priority-pill"
                :class="`priority-${prediction.calibrationPriority}`"
              >
                {{ getCalibrationPriorityLabel(prediction.calibrationPriority) }}
              </span>
              <span class="prediction-confidence">
                置信度: {{ Math.round(prediction.confidence * 100) }}%
              </span>
            </div>
            <div class="prediction-name">{{ prediction.name }}</div>
            <div class="prediction-meta">
              <span>{{ getCategoryDisplayName(prediction.category) }}</span>
              <span>{{ getProfileStatusDisplayName(prediction.status) }}</span>
              <span>{{ getSourceDisplayName(prediction.sourceKind) }}</span>
              <button
                v-if="prediction.evidenceCount > 0"
                type="button"
                class="evidence-toggle-btn"
                :aria-expanded="isEvidenceExpanded(prediction.id)"
                :aria-label="getEvidenceToggleAriaLabel(prediction)"
                :title="getEvidenceToggleAriaLabel(prediction)"
                @click="toggleEvidence(prediction.id)"
              >
                {{ prediction.evidenceCount }} 条证据 · {{ isEvidenceExpanded(prediction.id) ? '收起' : '查看' }}
              </button>
              <span v-else>暂无证据</span>
              <span
                class="context-use-pill"
                :class="{ usable: prediction.canUseForPersonalization }"
              >
                {{ getContextUseLabel(prediction.canUseForPersonalization) }}
              </span>
              <span>{{ formatTime(prediction.lastSeen) }}</span>
            </div>
            <div class="prediction-reason">{{ prediction.reason }}</div>
            <div
              v-if="(prediction.evidencePreview?.length || 0) > 0 && isEvidenceExpanded(prediction.id)"
              class="profile-evidence-panel"
            >
              <div class="profile-evidence-scope-receipt">
                <span class="profile-evidence-scope-label">证据审计</span>
                <span>{{ getEvidenceInspectReceipt(prediction) }}</span>
              </div>
              <component
                :is="evidence.sourceUrl ? 'a' : 'span'"
                v-for="(evidence, evidenceIndex) in (prediction.evidencePreview || []).slice(0, 3)"
                :key="`${prediction.id}-evidence-${evidenceIndex}`"
                class="profile-evidence-item"
                :href="evidence.sourceUrl || undefined"
                :target="evidence.sourceUrl ? '_blank' : undefined"
                :rel="evidence.sourceUrl ? 'noreferrer' : undefined"
              >
                <span class="profile-evidence-label">{{ evidence.label }}</span>
                <span class="profile-evidence-detail">{{ evidence.detail }}</span>
                <span
                  v-if="evidence.sourceUrlHiddenReason"
                  class="profile-evidence-warning"
                >
                  {{ evidence.sourceUrlHiddenReason }}
                </span>
              </component>
            </div>
            <div
              v-if="getProfileActionImpactReceipt(prediction, 'prediction')"
              class="profile-action-impact-receipt"
            >
              <span class="profile-action-impact-label">校准影响</span>
              <span>{{ getProfileActionImpactReceipt(prediction, 'prediction') }}</span>
            </div>
            <div class="prediction-actions">
              <button
                class="secondary-action-btn"
                :disabled="isItemPending(prediction.id)"
                @click="confirmProfileItem(prediction.id)"
              >
                {{ isItemPending(prediction.id) ? '处理中' : '确认' }}
              </button>
              <button
                class="secondary-action-btn influence-action-btn"
                :disabled="isItemPending(prediction.id)"
                @click="setProfileItemInfluence(prediction.id, prediction.type, 0.25, '已降低画像影响', { confirmAfterUpdate: false })"
              >
                {{ isItemPending(prediction.id) ? '处理中' : '降低影响' }}
              </button>
              <button
                class="danger-action-btn"
                :disabled="isItemPending(prediction.id)"
                @click="retractProfileItem(prediction.id)"
              >
                {{ isItemPending(prediction.id) ? '处理中' : '排除' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 统计数据 -->
      <div id="profile-stats" class="profile-card">
        <h3>📊 活动统计</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ userProfile.statistics.totalInteractions }}</div>
            <div class="stat-label">总交互次数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ userProfile.statistics.averageDailyActivity.toFixed(1) }}</div>
            <div class="stat-label">日均活动</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ userProfile.interests.projects.length }}</div>
            <div class="stat-label">关注项目数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ userProfile.interests.people.length }}</div>
            <div class="stat-label">协作人员数</div>
          </div>
        </div>
      </div>

      <div id="profile-items" class="profile-card">
        <div class="items-header">
          <h3>🧭 画像条目</h3>
          <span class="items-count">{{ profileItemsCountLabel }}</span>
        </div>
        <div class="profile-items-toolbar">
          <label class="profile-search-control">
            <span>搜索</span>
            <input
              v-model.trim="profileItemSearchQuery"
              type="search"
              placeholder="名称、键、来源、状态或证据"
            />
          </label>
          <label class="profile-filter-control">
            <span>状态</span>
            <select v-model="profileItemStatusFilter">
              <option
                v-for="option in profileItemStatusOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="profile-filter-control">
            <span>排序</span>
            <select v-model="profileItemSortMode">
              <option
                v-for="option in profileItemSortOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="tertiary-action-btn"
            :disabled="!hasProfileItemFilters"
            @click="clearProfileItemFilters"
          >
            清除
          </button>
          <button
            v-if="profileItemsAreTruncated"
            type="button"
            class="secondary-action-btn load-all-items-btn"
            :disabled="isLoadingAllProfileItems"
            @click="loadAllProfileItems"
          >
            {{ isLoadingAllProfileItems ? '加载中...' : '加载全部' }}
          </button>
          <button
            type="button"
            class="secondary-action-btn retracted-items-toggle-btn"
            :disabled="isLoadingRetractedProfileItems"
            @click="toggleRetractedProfileItems"
          >
            {{ retractedItemsToggleLabel }}
          </button>
        </div>
        <div class="profile-items-summary">{{ profileItemsDisplaySummary }}</div>
        <div
          v-if="profileItemsSearchScopeReceipt"
          class="profile-items-scope-receipt"
          aria-live="polite"
        >
          <span class="profile-items-scope-label">检索范围</span>
          <span>{{ profileItemsSearchScopeReceipt }}</span>
        </div>
        <div v-if="filteredProfileItems.length === 0" class="inline-empty">
          {{ profileItemsEmptyMessage }}
        </div>
        <div v-else class="profile-items-list">
          <div
            v-for="item in visibleProfileItems"
            :key="item.id"
            class="profile-item-row"
            :class="{ updating: isItemPending(item.id) }"
          >
            <div class="profile-item-main">
              <div class="profile-item-title">
                <span class="profile-item-name">{{ item.name }}</span>
                <span class="profile-item-type">{{ getCategoryDisplayName(item.category) }}</span>
                <span
                  class="profile-item-state"
                  :class="{
                    confirmed: item.userConfirmed,
                    pending: item.status === 'pending_confirm'
                  }"
                >
                  {{ getProfileStatusDisplayName(item.status, item.userConfirmed) }}
                </span>
                <span
                  class="calibration-priority-pill"
                  :class="`priority-${item.calibrationPriority}`"
                >
                  {{ getCalibrationPriorityLabel(item.calibrationPriority) }}
                </span>
              </div>
              <div class="profile-item-meta">
                <span>重要性 {{ formatPercent(item.explicitImportance) }}</span>
                <span>命中 {{ item.mentionCount }} 次</span>
                <span>{{ getSourceDisplayName(item.sourceKind) }}</span>
                <button
                  v-if="(item.evidenceRefs?.length || 0) > 0"
                  type="button"
                  class="evidence-toggle-btn"
                  :aria-expanded="isEvidenceExpanded(item.id)"
                  :aria-label="getEvidenceToggleAriaLabel(item)"
                  :title="getEvidenceToggleAriaLabel(item)"
                  @click="toggleEvidence(item.id)"
                >
                  {{ getEvidenceLabel(item) }} · {{ isEvidenceExpanded(item.id) ? '收起' : '查看' }}
                </button>
                <span v-else>{{ getEvidenceLabel(item) }}</span>
                <span
                  class="context-use-pill"
                  :class="{ usable: item.canUseForPersonalization }"
                >
                  {{ getContextUseLabel(item.canUseForPersonalization) }}
                </span>
                <span>{{ formatTime(item.lastSeen) }}</span>
                <span class="profile-calibration-reason">{{ item.calibrationReason }}</span>
              </div>
              <div
                v-if="(item.evidencePreview?.length || 0) > 0 && isEvidenceExpanded(item.id)"
                class="profile-evidence-panel"
              >
                <div class="profile-evidence-scope-receipt">
                  <span class="profile-evidence-scope-label">证据审计</span>
                  <span>{{ getEvidenceInspectReceipt(item) }}</span>
                </div>
                <component
                  :is="evidence.sourceUrl ? 'a' : 'span'"
                  v-for="(evidence, evidenceIndex) in (item.evidencePreview || []).slice(0, 4)"
                  :key="`${item.id}-evidence-${evidenceIndex}`"
                  class="profile-evidence-item"
                  :href="evidence.sourceUrl || undefined"
                  :target="evidence.sourceUrl ? '_blank' : undefined"
                  :rel="evidence.sourceUrl ? 'noreferrer' : undefined"
                >
                  <span class="profile-evidence-label">{{ evidence.label }}</span>
                  <span class="profile-evidence-detail">{{ evidence.detail }}</span>
                  <span
                    v-if="evidence.sourceUrlHiddenReason"
                    class="profile-evidence-warning"
                  >
                    {{ evidence.sourceUrlHiddenReason }}
                  </span>
                </component>
              </div>
              <div
                v-if="getProfileActionImpactReceipt(item, 'row')"
                class="profile-action-impact-receipt"
              >
                <span class="profile-action-impact-label">校准影响</span>
                <span>{{ getProfileActionImpactReceipt(item, 'row') }}</span>
              </div>
            </div>
            <div class="profile-item-actions">
              <button
                v-if="canBoostProfileItem(item)"
                class="secondary-action-btn influence-action-btn"
                :disabled="isItemPending(item.id)"
                @click="setProfileItemInfluence(item.id, item.itemType, 0.95, '已设为重点画像')"
              >
                {{ isItemPending(item.id) ? '处理中' : '设为重点' }}
              </button>
              <button
                v-if="canLowerProfileItem(item)"
                class="secondary-action-btn influence-action-btn"
                :disabled="isItemPending(item.id)"
                @click="setProfileItemInfluence(item.id, item.itemType, 0.25, '已降低画像影响', { confirmAfterUpdate: false })"
              >
                {{ isItemPending(item.id) ? '处理中' : '降低影响' }}
              </button>
              <button
                v-if="!item.userConfirmed"
                class="secondary-action-btn"
                :disabled="isItemPending(item.id)"
                @click="confirmProfileItem(item.id)"
              >
                {{ isItemPending(item.id) ? '处理中' : '确认' }}
              </button>
              <button
                class="danger-action-btn"
                :disabled="isItemPending(item.id)"
                @click="retractProfileItem(item.id)"
              >
                {{ isItemPending(item.id) ? '处理中' : '排除' }}
              </button>
            </div>
          </div>
          <div
            v-if="hiddenProfileItemsCount > 0"
            class="load-more-row"
          >
            <button
              type="button"
              class="secondary-action-btn"
              @click="loadMoreProfileItems"
            >
              显示更多 {{ hiddenProfileItemsCount }} 条
            </button>
          </div>
        </div>
        <div
          v-if="showRetractedProfileItems"
          class="retracted-profile-section"
        >
          <div class="retracted-profile-header">
            <div>
              <h4>已排除画像</h4>
              <p>这些条目不会进入个性化上下文；确认误排后可以恢复。</p>
            </div>
            <span>{{ retractedProfileItems.length }}/{{ retractedProfileItemsTotal }} 条</span>
          </div>
          <div v-if="isLoadingRetractedProfileItems" class="inline-empty compact">
            加载已排除画像...
          </div>
          <div v-else-if="retractedProfileItems.length === 0" class="inline-empty compact">
            暂无已排除画像条目
          </div>
          <div v-else class="profile-items-list retracted-profile-items-list">
            <div
              v-for="item in retractedProfileItems"
              :key="item.id"
              class="profile-item-row retracted-profile-item"
              :class="{ updating: isItemPending(item.id) }"
            >
              <div class="profile-item-main">
                <div class="profile-item-title">
                  <span class="profile-item-name">{{ item.name }}</span>
                  <span class="profile-item-type">{{ getCategoryDisplayName(item.category) }}</span>
                  <span class="profile-item-state retracted">
                    {{ getProfileStatusDisplayName(item.status, item.userConfirmed) }}
                  </span>
                </div>
                <div class="profile-item-meta">
                  <span>重要性 {{ formatPercent(item.explicitImportance) }}</span>
                  <span>命中 {{ item.mentionCount }} 次</span>
                  <span>{{ getSourceDisplayName(item.sourceKind) }}</span>
                  <button
                    v-if="(item.evidenceRefs?.length || 0) > 0"
                    type="button"
                    class="evidence-toggle-btn"
                    :aria-expanded="isEvidenceExpanded(item.id)"
                    :aria-label="getEvidenceToggleAriaLabel(item)"
                    :title="getEvidenceToggleAriaLabel(item)"
                    @click="toggleEvidence(item.id)"
                  >
                    {{ getEvidenceLabel(item) }} · {{ isEvidenceExpanded(item.id) ? '收起' : '查看' }}
                  </button>
                  <span v-else>{{ getEvidenceLabel(item) }}</span>
                  <span class="context-use-pill inactive">已排除，不参与个性化</span>
                  <span>{{ formatTime(item.lastSeen) }}</span>
                  <span class="profile-calibration-reason">{{ item.calibrationReason }}</span>
                </div>
                <div
                  v-if="(item.evidencePreview?.length || 0) > 0 && isEvidenceExpanded(item.id)"
                  class="profile-evidence-panel"
                >
                  <div class="profile-evidence-scope-receipt">
                    <span class="profile-evidence-scope-label">证据审计</span>
                    <span>{{ getEvidenceInspectReceipt(item) }}</span>
                  </div>
                  <component
                    :is="evidence.sourceUrl ? 'a' : 'span'"
                    v-for="(evidence, evidenceIndex) in (item.evidencePreview || []).slice(0, 4)"
                    :key="`${item.id}-retracted-evidence-${evidenceIndex}`"
                    class="profile-evidence-item"
                    :href="evidence.sourceUrl || undefined"
                    :target="evidence.sourceUrl ? '_blank' : undefined"
                    :rel="evidence.sourceUrl ? 'noreferrer' : undefined"
                  >
                    <span class="profile-evidence-label">{{ evidence.label }}</span>
                    <span class="profile-evidence-detail">{{ evidence.detail }}</span>
                    <span
                      v-if="evidence.sourceUrlHiddenReason"
                      class="profile-evidence-warning"
                    >
                      {{ evidence.sourceUrlHiddenReason }}
                    </span>
                  </component>
                </div>
              </div>
              <div class="profile-item-actions">
                <button
                  class="secondary-action-btn"
                  :disabled="isItemPending(item.id)"
                  @click="restoreProfileItemById(item.id, item.name)"
                >
                  {{ isItemPending(item.id) ? '恢复中' : '恢复' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 🆕 行为分析图表 -->
      <div class="profile-card">
        <h3>📊 行为分析</h3>
        <div class="charts-grid">
          <!-- 行为趋势图 -->
          <div class="chart-container">
            <h4>📈 每日活跃度趋势</h4>
            <div class="trend-chart">
              <div class="chart-description">最近7天活动变化</div>
              <div class="trend-bars">
                <div 
                  v-for="day in behaviorTrendData" 
                  :key="day.date"
                  class="trend-bar"
                  :style="{ height: `${day.activity * 100}%` }"
                  :title="`${day.date}: ${day.interactions}次交互`"
                >
                  <span class="bar-label">{{ day.day }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 活跃时间热力图 -->
          <div class="chart-container">
            <h4>🕒 活跃时间热力图</h4>
            <div class="heatmap-chart">
              <div class="chart-description">一周工作时间分布</div>
              <div class="heatmap-grid">
                <div 
                  v-for="cell in heatmapData" 
                  :key="`${cell.day}-${cell.hour}`"
                  class="heatmap-cell"
                  :class="getHeatmapIntensity(cell.intensity)"
                  :title="`${cell.dayName} ${cell.hour}:00 - 活跃度: ${(cell.intensity * 100).toFixed(0)}%`"
                ></div>
              </div>
              <div class="heatmap-legend">
                <span class="legend-label">活跃度:</span>
                <div class="legend-scale">
                  <div class="legend-item low"></div>
                  <div class="legend-item medium"></div>
                  <div class="legend-item high"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 兴趣权重变化 -->
        <div class="chart-container full-width">
          <h4>📊 兴趣权重变化</h4>
          <div class="weight-timeline">
            <div class="chart-description">主要兴趣点权重历史变化</div>
            <div class="timeline-container">
              <div 
                v-for="item in interestTimelineData" 
                :key="item.name"
                class="timeline-item"
              >
                <div class="timeline-header">
                  <span class="interest-name">{{ item.name }}</span>
                  <span class="current-weight">{{ (item.currentWeight * 100).toFixed(1) }}%</span>
                </div>
                <div class="timeline-line">
                  <div 
                    v-for="point in item.history" 
                    :key="point.date"
                    class="timeline-point"
                    :style="{ left: `${point.position}%`, backgroundColor: getWeightColor(point.weight) }"
                    :title="`${point.date}: ${(point.weight * 100).toFixed(1)}%`"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 画像健康度 -->
        <div class="efficiency-metrics">
          <h4>🎯 画像健康度</h4>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-icon">✅</div>
              <div class="metric-content">
                <div class="metric-value">{{ profileHealthMetrics.confirmationRate.toFixed(0) }}%</div>
                <div class="metric-label">已确认比例</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">🧭</div>
              <div class="metric-content">
                <div class="metric-value">{{ profileHealthMetrics.inferredCount }}</div>
                <div class="metric-label">待确认条目</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">📎</div>
              <div class="metric-content">
                <div class="metric-value">{{ profileHealthMetrics.evidenceCoverage.toFixed(0) }}%</div>
                <div class="metric-label">证据覆盖</div>
              </div>
            </div>
            <div class="metric-card">
              <div class="metric-icon">📚</div>
              <div class="metric-content">
                <div class="metric-value">{{ profileHealthMetrics.categoryCoverage }}/6</div>
                <div class="metric-label">类别覆盖</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 🆕 权重衰变设置 -->
      <div class="profile-card">
        <div class="settings-header">
          <h3>⚙️ 高级设置</h3>
          <button 
            class="toggle-settings-btn"
            @click="showAdvancedSettings = !showAdvancedSettings"
          >
            {{ showAdvancedSettings ? '收起设置' : '展开设置' }}
          </button>
        </div>
        
        <div v-if="showAdvancedSettings" class="advanced-settings">
          <!-- 权重衰变配置 -->
          <div class="setting-section">
            <h4>🔧 权重衰变配置</h4>
            <p class="setting-description">
              权重衰变控制兴趣项的重要性如何随时间自动调整。较高的衰变率会让不常用的项目更快降低重要性。
            </p>
            
            <div class="setting-group">
              <label>基础衰变率 (每天)</label>
              <div class="slider-container">
                <input 
                  type="range" 
                  min="0.01" 
                  max="0.2" 
                  step="0.01"
                  v-model.number="weightDecaySettings.baseDecayRate"
                  @input="updateDecayPreview"
                />
                <span class="slider-value">{{ (weightDecaySettings.baseDecayRate * 100).toFixed(1) }}%</span>
              </div>
              <div class="setting-hint">推荐值: 3-8%</div>
            </div>
            
            <div class="setting-group">
              <label>最大权重</label>
              <div class="slider-container">
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.1"
                  v-model.number="weightDecaySettings.maxWeight"
                  @input="updateDecayPreview"
                />
                <span class="slider-value">{{ weightDecaySettings.maxWeight.toFixed(1) }}</span>
              </div>
            </div>
            
            <div class="setting-group">
              <label>最小权重</label>
              <div class="slider-container">
                <input 
                  type="range" 
                  min="0.001" 
                  max="0.1" 
                  step="0.001"
                  v-model.number="weightDecaySettings.minWeight"
                  @input="updateDecayPreview"
                />
                <span class="slider-value">{{ (weightDecaySettings.minWeight * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
          
          <!-- 行为权重配置 -->
          <div class="setting-section">
            <h4>🎯 行为权重配置</h4>
            <p class="setting-description">
              不同行为对兴趣权重的贡献程度。
            </p>
            
            <div class="action-weights">
              <div 
                v-for="(weight, action) in weightDecaySettings.actionWeights" 
                :key="action"
                class="action-weight-item"
              >
                <label>{{ getActionDisplayName(action) }}</label>
                <div class="slider-container">
                  <input 
                    type="range" 
                    min="0.05" 
                    max="0.8" 
                    step="0.05"
                    v-model.number="weightDecaySettings.actionWeights[action]"
                    @input="updateDecayPreview"
                  />
                  <span class="slider-value">{{ (weight * 100).toFixed(0) }}%</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 衰变预览 -->
          <div class="setting-section">
            <h4>📊 衰变效果预览</h4>
            <div class="decay-preview">
              <div class="preview-chart">
                <div class="chart-description">
                  权重衰变示意图 (30天)
                </div>
                <div class="chart-bars">
                  <div 
                    v-for="day in decayPreviewData" 
                    :key="day.day"
                    class="chart-bar"
                    :style="{ height: `${day.weight * 100}%` }"
                    :title="`第${day.day}天: ${(day.weight * 100).toFixed(1)}%`"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 设置操作按钮 -->
          <div class="setting-actions">
            <button 
              class="reset-btn"
              @click="resetToDefaults"
            >
              恢复默认
            </button>
            <button 
              class="apply-btn"
              :disabled="isApplyingSettings"
              @click="applyDecaySettings"
            >
              <span v-if="!isApplyingSettings">应用设置</span>
              <span v-else>⏳ 应用中...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <span>👤</span>
      <p>暂无用户画像数据</p>
      <p class="empty-hint">随着您使用系统，我们将逐步为您建立个性化画像</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, toRaw, watch } from 'vue';
import { chromeAPI } from '../memory-store';
import {
  buildUserProfileViewModel,
  filterAndSortProfileItems,
  normalizeUserProfilePayload,
  type UserProfileAnalysisViewModel,
  type UserProfileCalibrationPriority,
  type UserProfileCategory,
  type UserProfileItemSortMode,
  type UserProfileItemStatusFilter,
  type UserProfileInterestItem,
  type UserProfileReviewQueueItem,
  type UserProfileViewModel,
} from '../../services/userProfileViewModel';

const isLoading = ref(true);
const isExporting = ref(false);
const isLoadingAllProfileItems = ref(false);
const isLoadingRetractedProfileItems = ref(false);
const showAdvancedSettings = ref(false);
const showRetractedProfileItems = ref(false);
const isApplyingSettings = ref(false);
const isCreatingExplicitProfile = ref(false);
const isRestoringProfileItem = ref(false);
const statusMessage = ref('');
const statusTone = ref<'success' | 'error' | 'info'>('info');
const userProfile = ref<UserProfileViewModel | null>(null);
const userProfileAnalysis = ref<UserProfileAnalysisViewModel | null>(null);
const pendingItemIds = ref<Set<string>>(new Set());
const expandedEvidenceItemIds = ref<Set<string>>(new Set());
const recentlyRetractedProfileItem = ref<{ id: string; name: string } | null>(null);
const retractedProfileItems = ref<UserProfileInterestItem[]>([]);
const retractedProfileItemsTotal = ref(0);
const CUSTOM_PROFILE_KEY = '__custom__';
const explicitProfileDraft = ref({
  itemType: 'preference',
  itemKey: 'writing_style.ringcentral.reply',
  customItemKey: '',
  itemValue: '',
});
type ProfileCalibrationReceipt = {
  title: string;
  detail: string;
  tone: 'success' | 'info' | 'warning';
  chips: string[];
};
const profileCalibrationReceipt = ref<ProfileCalibrationReceipt | null>(null);
type ProfileExportReceipt = {
  title: string;
  detail: string;
  tone: 'success' | 'info' | 'warning';
  chips: string[];
};
const profileExportReceipt = ref<ProfileExportReceipt | null>(null);
const PROFILE_ITEMS_PAGE_SIZE = 50;
type ReviewQueueFilter = 'all' | 'pending' | 'withEvidence' | 'withoutEvidence';
const reviewQueueFilter = ref<ReviewQueueFilter>('all');
const reviewFilterOptions: Array<{ value: ReviewQueueFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待确认' },
  { value: 'withEvidence', label: '有证据' },
  { value: 'withoutEvidence', label: '缺证据' },
];
const profileItemSearchQuery = ref('');
const profileItemStatusFilter = ref<UserProfileItemStatusFilter>('all');
const profileItemSortMode = ref<UserProfileItemSortMode>('priority');
const profileItemsVisibleLimit = ref(PROFILE_ITEMS_PAGE_SIZE);
const profileItemStatusOptions: Array<{ value: UserProfileItemStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'needsReview', label: '需校准' },
  { value: 'highImpact', label: '高影响' },
  { value: 'usable', label: '可个性化' },
  { value: 'withoutEvidence', label: '缺证据' },
];
const profileItemSortOptions: Array<{ value: UserProfileItemSortMode; label: string }> = [
  { value: 'priority', label: '优先处理' },
  { value: 'newest', label: '最近更新' },
  { value: 'confidence', label: '置信度' },
  { value: 'evidence', label: '证据数' },
];

const getReviewQueue = (): UserProfileReviewQueueItem[] =>
  userProfileAnalysis.value?.reviewQueue ??
  userProfileAnalysis.value?.predictedInterests ??
  [];

const reviewQueueTotal = computed(() => getReviewQueue().length);
const profileReviewQueue = computed(() => {
  const queue = getReviewQueue();
  switch (reviewQueueFilter.value) {
    case 'pending':
      return queue.filter((item) => item.status === 'pending_confirm');
    case 'withEvidence':
      return queue.filter((item) => item.evidenceCount > 0);
    case 'withoutEvidence':
      return queue.filter((item) => item.evidenceCount === 0);
    default:
      return queue;
  }
});
const filteredProfileItems = computed(() =>
  filterAndSortProfileItems(userProfile.value?.allItems ?? [], {
    query: profileItemSearchQuery.value,
    statusFilter: profileItemStatusFilter.value,
    sortMode: profileItemSortMode.value,
  })
);
const visibleProfileItems = computed(() =>
  filteredProfileItems.value.slice(0, profileItemsVisibleLimit.value)
);
const hiddenProfileItemsCount = computed(() =>
  Math.max(0, filteredProfileItems.value.length - visibleProfileItems.value.length)
);
const profileItemsLoadedCount = computed(() => userProfile.value?.loadedItems ?? userProfile.value?.allItems.length ?? 0);
const profileItemsTotalCount = computed(() => userProfile.value?.totalItems ?? profileItemsLoadedCount.value);
const profileItemsAreTruncated = computed(() =>
  Boolean(userProfile.value?.isTruncated || profileItemsLoadedCount.value < profileItemsTotalCount.value)
);
const profileItemsCountLabel = computed(() =>
  profileItemsAreTruncated.value
    ? `${profileItemsLoadedCount.value}/${profileItemsTotalCount.value} 条`
    : `${profileItemsTotalCount.value} 条`
);
const profileExportScopeSummary = computed(() => {
  const loaded = profileItemsLoadedCount.value;
  const total = profileItemsTotalCount.value;
  const filterHint = hasProfileItemFilters.value ? '当前搜索/筛选不会限制导出；' : '';

  if (total === 0) {
    return `${filterHint}导出会请求全部画像状态，诊断失败只写入 warning。`;
  }

  if (profileItemsAreTruncated.value) {
    return `${filterHint}页面已加载 ${loaded}/${total} 条，导出会重新分页拉取全部状态与已排除审计。`;
  }

  return `${filterHint}导出包含全部画像状态与已排除审计，诊断失败只写入 warning。`;
});
const hasProfileItemFilters = computed(() =>
  Boolean(profileItemSearchQuery.value.trim()) ||
  profileItemStatusFilter.value !== 'all' ||
  profileItemSortMode.value !== 'priority'
);
const profileExportPreflightItems = computed(() => {
  const items = [
    'JSON + manifest 指纹，可对照下载文件',
    profileItemsAreTruncated.value
      ? `重新分页拉取全部状态，不限当前 ${profileItemsLoadedCount.value}/${profileItemsTotalCount.value} 切片`
      : '包含 active/pending/retracted/archived/superseded 全部状态',
    '诊断失败只写入 warning，不阻断画像拿回',
    '只下载本地副本，不恢复、删除、同步或发送画像',
  ];

  if (hasProfileItemFilters.value) {
    return ['当前搜索/筛选不限制导出', ...items];
  }

  return items;
});
const profileItemsDisplaySummary = computed(() => {
  const loaded = profileItemsLoadedCount.value;
  const total = profileItemsTotalCount.value;
  const matched = filteredProfileItems.value.length;
  const visible = visibleProfileItems.value.length;
  if (total === 0) return '0 条';
  const scopeLabel = profileItemsAreTruncated.value
    ? `已加载 ${loaded}/${total} 条`
    : `共 ${total} 条`;
  if (matched === loaded) return `显示 ${visible}/${loaded} 条（${scopeLabel}）`;
  return `显示 ${visible}/${matched} 条匹配结果（${scopeLabel}）`;
});
const profileItemsSearchScopeReceipt = computed(() => {
  const loaded = profileItemsLoadedCount.value;
  const total = profileItemsTotalCount.value;
  if (total === 0) return '';

  if (profileItemsAreTruncated.value) {
    const noMatchHint = hasProfileItemFilters.value && filteredProfileItems.value.length === 0
      ? '当前无匹配只代表已加载切片无结果，不能证明全库没有该画像。'
      : '';
    return `${noMatchHint}当前搜索/筛选只匹配已加载 ${loaded}/${total} 条；先点“加载全部”再做全库判断。本区只读，不确认、排除或写入画像。`;
  }

  if (hasProfileItemFilters.value) {
    return `当前搜索/筛选已覆盖本页全部 ${total} 条画像；它只改变列表显示，不限制导出，也不会确认、排除或写入画像。`;
  }

  return '';
});
const profileItemsEmptyMessage = computed(() => {
  if (profileItemsLoadedCount.value === 0) return '暂无可校准的画像条目';
  if (profileItemsAreTruncated.value) {
    return '当前已加载条目中没有匹配结果，可先加载全部画像后再搜索';
  }
  return '当前筛选没有匹配的画像条目';
});
const retractedItemsToggleLabel = computed(() => {
  if (isLoadingRetractedProfileItems.value) return '加载已排除...';
  return showRetractedProfileItems.value ? '收起已排除' : '查看已排除';
});

watch([profileItemSearchQuery, profileItemStatusFilter, profileItemSortMode], () => {
  profileItemsVisibleLimit.value = PROFILE_ITEMS_PAGE_SIZE;
});

const weightDecaySettings = ref({
  baseDecayRate: 0.05,
  maxWeight: 1.0,
  minWeight: 0.01,
  actionWeights: {
    view: 0.1,
    edit: 0.3,
    create: 0.4,
    link: 0.25,
    mention: 0.2,
    search: 0.15,
    favorite: 0.5
  } as Record<string, number>
});

const decayPreviewData = ref<Array<{ day: number; weight: number }>>([]);
const behaviorTrendData = ref<UserProfileViewModel['activityTrend']>([]);
const heatmapData = ref<UserProfileViewModel['heatmap']>([]);
const interestTimelineData = ref<UserProfileViewModel['interestTimeline']>([]);
const profileHealthMetrics = ref({
  confirmationRate: 0,
  inferredCount: 0,
  evidenceCoverage: 0,
  categoryCoverage: 0
});

const setStatus = (
  message: string,
  tone: 'success' | 'error' | 'info' = 'info',
  options: {
    keepUndoAction?: boolean;
    keepProfileReceipt?: boolean;
    keepExportReceipt?: boolean;
  } = {},
) => {
  statusMessage.value = message;
  statusTone.value = tone;
  if (!options.keepUndoAction) {
    recentlyRetractedProfileItem.value = null;
  }
  if (!options.keepProfileReceipt) {
    profileCalibrationReceipt.value = null;
  }
  if (!options.keepExportReceipt) {
    profileExportReceipt.value = null;
  }
};

const isItemPending = (itemId?: string) => Boolean(itemId && pendingItemIds.value.has(itemId));

const isEvidenceExpanded = (itemId?: string) =>
  Boolean(itemId && expandedEvidenceItemIds.value.has(itemId));

const toggleEvidence = (itemId: string) => {
  const nextExpanded = new Set(expandedEvidenceItemIds.value);
  if (nextExpanded.has(itemId)) {
    nextExpanded.delete(itemId);
  } else {
    nextExpanded.add(itemId);
  }
  expandedEvidenceItemIds.value = nextExpanded;
};

const setItemPending = (itemId: string, pending: boolean) => {
  const nextPending = new Set(pendingItemIds.value);
  if (pending) {
    nextPending.add(itemId);
  } else {
    nextPending.delete(itemId);
  }
  pendingItemIds.value = nextPending;
};

const applyViewModel = (payload: any) => {
  const viewModel = normalizeUserProfilePayload(payload);
  userProfile.value = viewModel.profile;
  userProfileAnalysis.value = viewModel.analysis;
  updateChartData();
};

const loadUserProfile = async (options: { showLoading?: boolean; maxItems?: number | 'all' } = {}) => {
  const showLoading = options.showLoading ?? true;
  if (showLoading) {
    isLoading.value = true;
  }
  try {
    let response = await chromeAPI.sendMessage({
      type: 'GET_FUSED_USER_PROFILE',
      maxItems: options.maxItems,
    });

    if (!response || !(response as any).success) {
      response = await chromeAPI.sendMessage({
        type: 'GET_USER_PROFILE',
        maxItems: options.maxItems,
      });
    }

    if (response && (response as any).success) {
      applyViewModel((response as any).data);
    } else {
      applyViewModel(buildUserProfileViewModel());
      setStatus((response as any)?.error || '用户画像服务暂不可用', 'error');
    }
  } catch (error: any) {
    console.error('加载用户画像失败:', error);
    applyViewModel(buildUserProfileViewModel());
    setStatus(error?.message || '加载用户画像失败', 'error');
  } finally {
    if (showLoading) {
      isLoading.value = false;
    }
  }
};

const getProjectsWithImportance = () => userProfile.value?.interests.projects ?? [];
const getPeopleWithImportance = () => userProfile.value?.interests.people ?? [];
const getTopicsWithImportance = () => [
  ...(userProfile.value?.interests.topics ?? []),
  ...(userProfile.value?.interests.technologies ?? []),
].slice(0, 8);

const scrollToSection = (sectionId: string) => {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
};

const clearProfileItemFilters = () => {
  profileItemSearchQuery.value = '';
  profileItemStatusFilter.value = 'all';
  profileItemSortMode.value = 'priority';
};

const resolvedExplicitProfileItemKey = computed(() => {
  if (explicitProfileDraft.value.itemKey === CUSTOM_PROFILE_KEY) {
    return explicitProfileDraft.value.customItemKey.trim();
  }
  return explicitProfileDraft.value.itemKey.trim();
});

const explicitProfileTypeLabels: Record<string, string> = {
  preference: '偏好',
  habit: '习惯',
  constraint: '约束',
  fact: '事实',
  interest: '兴趣',
};

const explicitProfileKeyLabels: Record<string, string> = {
  'writing_style.ringcentral.reply': 'RingCentral 回复风格',
  'writing_style.ringcentral.thread_reply': 'Thread 回复风格',
  'writing_style.jira.comment': 'Jira 评论风格',
  communication_style: '通用沟通风格',
  response_style: '默认回复风格',
  owner_response_constraint: '不要替我说的话',
};

const getExplicitProfileKeyLabel = (selectedKey: string, resolvedKey: string) => {
  if (selectedKey === CUSTOM_PROFILE_KEY) {
    return resolvedKey || '待填写自定义 key';
  }
  return explicitProfileKeyLabels[selectedKey] || resolvedKey || '待选择画像键';
};

const explicitProfileEntryReceipt = computed(() => {
  const itemTypeLabel = explicitProfileTypeLabels[explicitProfileDraft.value.itemType] ||
    explicitProfileDraft.value.itemType;
  const itemKey = resolvedExplicitProfileItemKey.value;
  const itemKeyLabel = getExplicitProfileKeyLabel(
    explicitProfileDraft.value.itemKey,
    itemKey,
  );
  const hasValue = explicitProfileDraft.value.itemValue.trim().length > 0;
  let readiness = `将创建 ${itemTypeLabel} · ${itemKeyLabel}，来源标记为用户手动录入。`;

  if (!itemKey) {
    readiness = `先补 ${itemTypeLabel} 的稳定 key，避免写到临时或过宽画像。`;
  } else if (!hasValue) {
    readiness = `将创建 ${itemTypeLabel} · ${itemKeyLabel}，先补画像内容。`;
  }

  return `${readiness} 提交后会写入 active + confirmed 画像，成为 USER_CORE、召回、Compose Assist 和 provider context 的场景个性化候选；不会外发、恢复旧画像或跨平台同步。`;
});

const loadMoreProfileItems = () => {
  profileItemsVisibleLimit.value += PROFILE_ITEMS_PAGE_SIZE;
};

const loadAllProfileItems = async () => {
  if (!profileItemsAreTruncated.value || isLoadingAllProfileItems.value) return;
  isLoadingAllProfileItems.value = true;
  try {
    await loadUserProfile({ showLoading: false, maxItems: 'all' });
    profileItemsVisibleLimit.value = PROFILE_ITEMS_PAGE_SIZE;
    setStatus('已加载全部画像条目', 'success');
  } finally {
    isLoadingAllProfileItems.value = false;
  }
};

const loadRetractedProfileItems = async () => {
  if (isLoadingRetractedProfileItems.value) return;
  isLoadingRetractedProfileItems.value = true;
  try {
    const response = await chromeAPI.sendMessage({
      type: 'GET_RETRACTED_PROFILE_ITEMS',
      maxItems: 'all',
    });

    if (response && (response as any).success) {
      const page = (response as any).data ?? {};
      const viewModel = buildUserProfileViewModel({
        items: page.items ?? [],
        totalItems: page.total ?? page.items?.length ?? 0,
        truncated: page.truncated,
        viewLimit: page.viewLimit,
        includeRetracted: true,
      });
      retractedProfileItems.value = viewModel.profile.allItems.filter(
        (item) => item.status === 'retracted'
      );
      retractedProfileItemsTotal.value = page.total ?? retractedProfileItems.value.length;
    } else {
      setStatus((response as any)?.error || '已排除画像加载失败', 'error');
    }
  } catch (error: any) {
    setStatus(error?.message || '已排除画像加载失败', 'error');
  } finally {
    isLoadingRetractedProfileItems.value = false;
  }
};

const toggleRetractedProfileItems = async () => {
  showRetractedProfileItems.value = !showRetractedProfileItems.value;
  if (showRetractedProfileItems.value) {
    await loadRetractedProfileItems();
  }
};

const formatPercent = (value: number) => `${Math.round((value || 0) * 100)}%`;

const formatTime = (timestamp: number) => {
  if (!timestamp) return '暂无时间';
  return new Date(timestamp).toLocaleString('zh-CN');
};

const getCategoryDisplayName = (category: UserProfileCategory): string => {
  const names: Record<UserProfileCategory, string> = {
    projects: '项目',
    people: '人员',
    topics: '主题',
    jiraItems: 'JIRA',
    technologies: '技术',
    documents: '文档'
  };
  return names[category] || category;
};

const getSourceDisplayName = (sourceKind: string): string => {
  const names: Record<string, string> = {
    explicit: '用户录入',
    inferred: '系统推断',
    system: '系统生成',
  };
  return names[sourceKind] || sourceKind || '来源未知';
};

const getProfileStatusDisplayName = (status: string, userConfirmed = false): string => {
  const names: Record<string, string> = {
    pending_confirm: '待确认',
    active: '推断',
    superseded: '已替换',
    archived: '已归档',
    retracted: '已排除',
  };
  if (status !== 'active' && names[status]) return names[status];
  if (userConfirmed) return '已确认';
  return names[status] || '待确认';
};

const getCalibrationPriorityLabel = (priority: UserProfileCalibrationPriority): string => {
  const names: Record<UserProfileCalibrationPriority, string> = {
    critical: '优先复核',
    high: '高影响',
    medium: '需校准',
    low: '低风险',
  };
  return names[priority] || '需校准';
};

  const getEvidenceLabel = (item: UserProfileInterestItem): string => {
    const count = item.evidenceRefs.length;
    return count > 0 ? `${count} 条证据` : '暂无证据';
  };

  const getEvidenceItemCount = (
    item: UserProfileInterestItem | UserProfileReviewQueueItem,
  ): number => {
    if ('evidenceRefs' in item) return item.evidenceRefs.length;
    return item.evidenceCount ?? 0;
  };

  const getEvidenceInspectReceipt = (
    item: UserProfileInterestItem | UserProfileReviewQueueItem,
  ): string => {
    const evidenceCount = getEvidenceItemCount(item);
    const countCopy = evidenceCount > 0
      ? `${evidenceCount} 条已加载证据`
      : '暂无已加载证据';
    return `${countCopy}。只读审计：展开只显示本次已加载的来源、URL 或片段摘要；不会确认画像、写入 USER_CORE、刷新来源、同步外部平台或发送内容。可点击的 http(s) 来源会新标签打开；不安全链接只显示隐藏原因。`;
  };

  const getEvidenceToggleAriaLabel = (
    item: UserProfileInterestItem | UserProfileReviewQueueItem,
  ): string => {
    const action = isEvidenceExpanded(item.id) ? '收起' : '查看';
    const evidenceCount = getEvidenceItemCount(item);
    const evidenceLabel = evidenceCount > 0 ? `${evidenceCount} 条证据` : '暂无证据';
    return `只读${action}${evidenceLabel}；不会确认画像、写入 USER_CORE 或刷新来源`;
  };

  const getContextUseLabel = (canUseForPersonalization: boolean): string =>
    canUseForPersonalization ? '可用于个性化' : '确认前不使用';

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const getRawEvidenceRefs = (rawItem: any): unknown[] => {
  const refs = rawItem?.evidenceRefs ?? rawItem?.evidence_refs;
  if (Array.isArray(refs)) return refs;
  if (typeof refs === 'string') {
    try {
      const parsed = JSON.parse(refs);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getProfileItemReceiptTarget = (itemId: string) =>
  userProfile.value?.allItems.find((item) => item.id === itemId) ??
  retractedProfileItems.value.find((item) => item.id === itemId);

const getRawProfileItemName = (rawItem: any, fallback = '该画像条目') => {
  const value = parseMaybeJson(rawItem?.itemValue ?? rawItem?.item_value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const named = record.name ?? record.title ?? record.value ?? record.label;
    if (named != null && String(named).trim()) return String(named).trim();
  }
  if (value != null && String(value).trim()) return String(value).trim();
  return fallback;
};

const getReceiptStatus = (
  rawItem: any,
  fallbackItem?: UserProfileInterestItem | null,
) => String(rawItem?.status ?? rawItem?.item_status ?? fallbackItem?.status ?? '').trim();

const getReceiptConfirmed = (
  rawItem: any,
  fallbackItem?: UserProfileInterestItem | null,
) => {
  const rawConfirmed = rawItem?.userConfirmed ?? rawItem?.user_confirmed;
  if (rawConfirmed !== undefined) return Boolean(rawConfirmed);
  return Boolean(fallbackItem?.userConfirmed);
};

const getReceiptEvidenceCount = (
  rawItem: any,
  fallbackItem?: UserProfileInterestItem | null,
) => {
  const rawRefs = getRawEvidenceRefs(rawItem);
  if (rawRefs.length > 0) return rawRefs.length;
  return fallbackItem?.evidenceRefs.length ?? 0;
};

const getReceiptPersonalizationChip = (
  rawItem: any,
  fallbackItem?: UserProfileInterestItem | null,
) => {
  const status = getReceiptStatus(rawItem, fallbackItem);
  const confirmed = getReceiptConfirmed(rawItem, fallbackItem);
  if (status === 'retracted') return '已排除，不参与个性化';
  if (status === 'active' && confirmed) return '可用于个性化';
  return '确认前不使用';
};

const getReceiptEvidenceChip = (
  rawItem: any,
  fallbackItem?: UserProfileInterestItem | null,
) => {
  const evidenceCount = getReceiptEvidenceCount(rawItem, fallbackItem);
  return evidenceCount > 0 ? `${evidenceCount} 条证据` : '暂无证据，后续建议补证';
};

const setProfileCalibrationReceipt = (receipt: ProfileCalibrationReceipt) => {
  profileCalibrationReceipt.value = receipt;
};

const buildProfileExportPendingReceipt = (): ProfileExportReceipt => {
  const loaded = profileItemsLoadedCount.value;
  const total = profileItemsTotalCount.value;
  const loadedChip = total > 0
    ? `当前页 ${loaded}/${total} 条`
    : '当前页暂无条目';

  return {
    title: '正在准备画像导出',
    detail: '正在向 Memory Service 重新分页请求全部画像状态并生成本地 JSON 的 manifest；下载尚未开始，manifest ID 尚未生成。当前搜索、筛选或页面切片不会限制导出，本次操作不会恢复、删除、同步或发送画像。',
    tone: 'info',
    chips: [
      loadedChip,
      '请求 status=all',
      '下载尚未开始',
      '等待 manifest ID',
    ],
  };
};

const buildProfileExportReceipt = (exportData: any, fileName: string): ProfileExportReceipt => {
  const pagination = exportData?.exportInfo?.pagination ?? {};
  const manifest = exportData?.exportInfo?.manifest ?? {};
  const warnings = Array.isArray(exportData?.exportInfo?.warnings)
    ? exportData.exportInfo.warnings
    : [];
  const profileAudit = exportData?.exportInfo?.profileAudit ?? {};
  const profileFingerprint = manifest?.integrity?.profileItemsSha256;
  const manifestId = typeof manifest?.manifestId === 'string'
    ? manifest.manifestId.trim()
    : '';
  const shortFingerprint = typeof profileFingerprint === 'string' &&
    profileFingerprint &&
    profileFingerprint !== 'unavailable'
    ? profileFingerprint.slice(0, 12)
    : '';
  const exportedItems = Number(pagination.exportedProfileItems ?? exportData?.exportSummary?.exportedProfileItems ?? 0);
  const totalItems = Number(pagination.totalProfileItems ?? exportData?.exportSummary?.totalProfileItems ?? exportedItems);
  const usableItems = Number(profileAudit.usableProfileItems ?? exportData?.exportSummary?.usableProfileItems ?? 0);
  const heldItems = Number(profileAudit.heldForConfirmationItems ?? exportData?.exportSummary?.heldForConfirmationItems ?? 0);
  const inactiveItems = Number(profileAudit.inactiveAuditItems ?? exportData?.exportSummary?.inactiveAuditItems ?? 0);
  const isTruncated = Boolean(pagination.truncated);
  const chips = [
    `全部状态 ${exportedItems}/${totalItems} 条`,
    `可个性化 ${usableItems} 条`,
    `确认前保留 ${heldItems} 条`,
    inactiveItems > 0 ? `非活跃审计 ${inactiveItems} 条` : '非活跃审计 0 条',
  ];
  if (warnings.length > 0) {
    chips.push(`诊断缺失 ${warnings.length} 项`);
  }
  if (isTruncated) {
    chips.push('分页未完整');
  }
  if (shortFingerprint) {
    chips.push(`指纹 ${shortFingerprint}`);
  }
  if (manifestId) {
    chips.push('manifest ID 已显示');
  }
  const diagnosticDetail = warnings.length > 0
    ? '画像条目已写入本地导出 JSON；缺失的系统健康或实体统计会记录在 exportInfo.warnings。'
    : '系统健康和实体统计诊断已写入本地导出 JSON。';
  const completenessDetail = isTruncated
    ? '本次分页未完整，建议重试导出后再迁移或备份。'
    : '导出已重新分页拉取全部画像状态。';
  const fingerprintDetail = shortFingerprint
    ? ` manifest 指纹 ${shortFingerprint} 可用于对照下载文件。`
    : '';
  const manifestIdDetail = manifestId
    ? ` manifest ID ${manifestId} 可在 exportInfo.manifest.manifestId 中核对。`
    : '';

  return {
    title: warnings.length > 0
      ? `画像已导出，诊断部分缺失：${fileName}`
      : `画像已导出：${fileName}`,
    detail: `${completenessDetail}${diagnosticDetail}${fingerprintDetail}${manifestIdDetail} 本地 JSON 不会恢复、删除、同步或发送画像；个性化仍只读取 active + confirmed 条目。`,
    tone: isTruncated || warnings.length > 0 ? 'info' : 'success',
    chips,
  };
};

const buildConfirmedReceipt = (
  rawItem: any,
  fallbackItem?: UserProfileInterestItem | null,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || getRawProfileItemName(rawItem);
  return {
    title: `已确认画像：${name}`,
    detail: '状态已切换为 active + confirmed，后续 USER_CORE、召回、Compose Assist 和 provider context 可以按场景使用它。',
    tone: 'success',
    chips: [
      getReceiptPersonalizationChip(rawItem, fallbackItem),
      getReceiptEvidenceChip(rawItem, fallbackItem),
      '可继续降权或排除',
    ],
  };
};

const buildInfluenceReceipt = (
  rawItem: any,
  fallbackItem: UserProfileInterestItem | null | undefined,
  importance: number,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || getRawProfileItemName(rawItem);
  const previousImportance = fallbackItem?.explicitImportance ??
    fallbackItem?.confidence ??
    fallbackItem?.salienceScore;
  const delta = Number.isFinite(previousImportance)
    ? importance - Number(previousImportance)
    : 0;
  const actionLabel = importance >= 0.85
    ? '已设为重点'
    : importance <= 0.3
      ? '已降低影响'
      : delta > 0.01
        ? '已提高影响'
        : delta < -0.01
          ? '已降低影响'
          : '已调整影响';
  const tone = actionLabel === '已设为重点' || actionLabel === '已提高影响'
    ? 'success'
    : 'info';
  const status = getReceiptStatus(rawItem, fallbackItem);
  const confirmed = getReceiptConfirmed(rawItem, fallbackItem);
  const canUse = status === 'active' && confirmed;
  const confirmationDetail = canUse
    ? '这次校准同步更新 confidence 和 salience；该条已确认，后续仍只会按场景进入个性化上下文。'
    : '这次校准只更新 confidence 和 salience；该条仍未确认，确认前不会进入 USER_CORE、召回或 provider context。';
  return {
    title: canUse
      ? `${actionLabel}：${name}`
      : `${actionLabel}，仍待确认：${name}`,
    detail: confirmationDetail,
    tone,
    chips: [
      `影响力 ${formatPercent(importance)}`,
      getReceiptPersonalizationChip(rawItem, fallbackItem),
      getReceiptEvidenceChip(rawItem, fallbackItem),
      canUse ? '可继续降权或排除' : '可点确认复核',
    ],
  };
};

const buildInfluencePendingReceipt = (
  fallbackItem: UserProfileInterestItem | null | undefined,
  importance: number,
  confirmAfterUpdate: boolean,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || '当前画像条目';
  const status = fallbackItem?.status ?? '';
  const confirmed = Boolean(fallbackItem?.userConfirmed);
  const alreadyUsable = status === 'active' && confirmed;
  const actionLabel = importance >= 0.85
    ? '正在设为重点'
    : importance <= 0.3
      ? '正在降低影响'
      : '正在调整影响';
  const confirmationDetail = confirmAfterUpdate
    ? alreadyUsable
      ? '这条已确认，本次只会写入新的 confidence/salience。'
      : '会先写入新的 confidence/salience，再尝试把该条确认成 active + confirmed。'
    : '本次只写入新的 confidence/salience，不会自动确认该条。';
  const evidenceCount = fallbackItem?.evidenceRefs.length ?? 0;

  return {
    title: `${actionLabel}：${name}`,
    detail: `${confirmationDetail} 请求完成前还不能证明画像已写入或已进入个性化；不会外发、跨平台同步、恢复、删除或发送任何内容。`,
    tone: 'info',
    chips: [
      `目标影响力 ${formatPercent(importance)}`,
      confirmAfterUpdate ? '会尝试确认' : '不自动确认',
      evidenceCount > 0 ? `${evidenceCount} 条证据保留` : '暂无证据，后续建议补证',
      '等待服务确认',
    ],
  };
};

const buildInfluencePartialReceipt = (
  rawItem: any,
  fallbackItem: UserProfileInterestItem | null | undefined,
  importance: number,
  errorMessage?: string,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || getRawProfileItemName(rawItem);
  const detailSuffix = errorMessage ? `失败原因：${errorMessage}` : '可以稍后重试确认。';
  return {
    title: `已更新影响力，确认未完成：${name}`,
    detail: `confidence 和 salience 已写入，但确认步骤没有完成；确认前这条不会进入 USER_CORE、召回或 provider context。${detailSuffix}`,
    tone: 'warning',
    chips: [
      `影响力 ${formatPercent(importance)}`,
      getReceiptPersonalizationChip(rawItem, fallbackItem),
      getReceiptEvidenceChip(rawItem, fallbackItem),
      '可点确认重试',
    ],
  };
};

const buildInfluenceFailureReceipt = (
  fallbackItem: UserProfileInterestItem | null | undefined,
  importance: number,
  errorMessage?: string,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || '当前画像条目';
  const detailSuffix = errorMessage ? `失败原因：${errorMessage}` : '可以稍后重试。';

  return {
    title: `画像校准未完成：${name}`,
    detail: `服务没有确认新的 confidence/salience 写入；页面已重新拉取画像状态。不会外发、跨平台同步、恢复、删除或发送任何内容。${detailSuffix}`,
    tone: 'warning',
    chips: [
      `目标影响力 ${formatPercent(importance)}`,
      getReceiptPersonalizationChip({}, fallbackItem),
      getReceiptEvidenceChip({}, fallbackItem),
      '可重试校准',
    ],
  };
};

const buildRetractedReceipt = (
  rawItem: any,
  fallbackItem?: UserProfileInterestItem | null,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || getRawProfileItemName(rawItem);
  return {
    title: `已排除画像：${name}`,
    detail: '这条现在不会进入 USER_CORE、召回或 provider context。误排可以立即撤销，也可以稍后在已排除画像审计里恢复。',
    tone: 'warning',
    chips: [
      '不参与个性化',
      getReceiptEvidenceChip(rawItem, fallbackItem),
      '可撤销 / 可恢复',
    ],
  };
};

const buildRestoredReceipt = (
  rawItem: any,
  fallbackItem?: UserProfileInterestItem | null,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || getRawProfileItemName(rawItem);
  const usable = getReceiptStatus(rawItem, fallbackItem) === 'active' &&
    getReceiptConfirmed(rawItem, fallbackItem);
  return {
    title: `已恢复画像：${name}`,
    detail: usable
      ? '这条已恢复为 active + confirmed，会重新按场景参与个性化；仍可再次降低影响或排除。'
      : '这条已恢复到待确认状态，确认前仍不会参与个性化上下文。',
    tone: usable ? 'success' : 'info',
    chips: [
      getReceiptPersonalizationChip(rawItem, fallbackItem),
      getReceiptEvidenceChip(rawItem, fallbackItem),
      usable ? '已回到可用画像' : '仍需确认',
    ],
  };
};

const buildCreatedReceipt = (rawItem: any): ProfileCalibrationReceipt => {
  const name = getRawProfileItemName(rawItem);
  return {
    title: `已添加显式画像：${name}`,
    detail: '这条来自你的手动录入，已写入 active + confirmed 画像，作为 USER_CORE、召回、Compose Assist 和 provider context 的场景个性化候选；不会外发、恢复旧画像或跨平台同步。后续可以在条目列表里降权、排除或导出审计。',
    tone: 'success',
    chips: [
      '用户录入',
      getReceiptPersonalizationChip(rawItem),
      getReceiptEvidenceChip(rawItem),
    ],
  };
};

const buildConfirmPendingReceipt = (
  fallbackItem?: UserProfileInterestItem | null,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || '当前画像条目';
  return {
    title: `正在确认画像：${name}`,
    detail: '请求完成前还不能证明状态已切换为 active + confirmed；确认成功后才可能按场景进入 USER_CORE、召回、Compose Assist 和 provider context。不会外发、跨平台同步、删除或发送内容。',
    tone: 'info',
    chips: [
      getReceiptPersonalizationChip({}, fallbackItem),
      getReceiptEvidenceChip({}, fallbackItem),
      '等待服务确认',
    ],
  };
};

const buildRetractPendingReceipt = (
  fallbackItem?: UserProfileInterestItem | null,
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || '当前画像条目';
  return {
    title: `正在排除画像：${name}`,
    detail: '请求完成前还不能证明这条已退出个性化；服务确认后才会变成 retracted，并从 USER_CORE、召回和 provider context 候选中移除。不会外发、跨平台同步、恢复旧画像或发送内容。',
    tone: 'warning',
    chips: [
      getReceiptPersonalizationChip({}, fallbackItem),
      getReceiptEvidenceChip({}, fallbackItem),
      '等待服务确认',
    ],
  };
};

const buildRestorePendingReceipt = (
  fallbackItem?: UserProfileInterestItem | null,
  fallbackName = '当前画像条目',
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || fallbackName;
  return {
    title: `正在恢复画像：${name}`,
    detail: '请求完成前还不能证明这条已恢复；服务会按原确认状态恢复为 active 或 pending_confirm，只有 active + confirmed 才会再次进入个性化候选。不会外发、跨平台同步或发送内容。',
    tone: 'info',
    chips: [
      getReceiptPersonalizationChip({}, fallbackItem),
      getReceiptEvidenceChip({}, fallbackItem),
      '等待服务确认',
    ],
  };
};

const buildCreatePendingReceipt = (): ProfileCalibrationReceipt => {
  const itemTypeLabel = explicitProfileTypeLabels[explicitProfileDraft.value.itemType] ||
    explicitProfileDraft.value.itemType;
  const itemKeyLabel = getExplicitProfileKeyLabel(
    explicitProfileDraft.value.itemKey,
    resolvedExplicitProfileItemKey.value,
  );

  return {
    title: `正在添加显式画像：${itemKeyLabel}`,
    detail: `请求完成前还不能证明 ${itemTypeLabel} 画像已写入，也不会先进入 USER_CORE、召回、Compose Assist 或 provider context。不会外发、恢复旧画像、跨平台同步或发送内容。`,
    tone: 'info',
    chips: [
      itemTypeLabel,
      '用户手动录入',
      '等待服务确认',
    ],
  };
};

const buildOperationFailureReceipt = (
  actionLabel: string,
  fallbackItem?: UserProfileInterestItem | null,
  errorMessage?: string,
  fallbackName = '当前画像条目',
): ProfileCalibrationReceipt => {
  const name = fallbackItem?.name || fallbackName;
  const detailSuffix = errorMessage ? `失败原因：${errorMessage}` : '可以稍后重试。';
  return {
    title: `${actionLabel}未完成：${name}`,
    detail: `Memory Service 没有确认这次画像状态变更；页面不会把它当作已写入、已确认、已排除或已恢复，也不会外发、跨平台同步或发送内容。${detailSuffix}`,
    tone: 'warning',
    chips: [
      getReceiptPersonalizationChip({}, fallbackItem),
      getReceiptEvidenceChip({}, fallbackItem),
      '可重试操作',
    ],
  };
};

const replaceProfileItem = (itemId: string, updates: Partial<UserProfileInterestItem>) => {
  if (!userProfile.value) return;
  userProfile.value.allItems = userProfile.value.allItems.map((item) =>
    item.id === itemId ? { ...item, ...updates } : item
  );
  for (const category of Object.keys(userProfile.value.interests) as UserProfileCategory[]) {
    userProfile.value.interests[category] = userProfile.value.interests[category].map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    );
  }
};

const canBoostProfileItem = (item: UserProfileInterestItem) =>
  (item.explicitImportance ?? item.confidence ?? 0) < 0.85;

const canLowerProfileItem = (item: UserProfileInterestItem) =>
  (item.explicitImportance ?? item.confidence ?? 0) > 0.3;

const getProfileActionImpactReceipt = (
  item: UserProfileInterestItem | UserProfileReviewQueueItem,
  mode: 'row' | 'prediction',
) => {
  const fullItem = getProfileItemReceiptTarget(item.id);
  const score = fullItem?.explicitImportance ??
    ('explicitImportance' in item ? item.explicitImportance : item.confidence) ??
    0;
  const actions: string[] = [];
  if (mode === 'row' && score < 0.85) actions.push('设为重点(95%)');
  if (score > 0.3) actions.push('降低影响(25%)');
  if (actions.length === 0) return '';

  const status = fullItem?.status ?? item.status;
  const confirmed = fullItem?.userConfirmed ?? false;
  const hasBoostAction = mode === 'row' && score < 0.85;
  const hasLowerAction = score > 0.3;
  let confirmationCopy = '会同时确认该条，确认后才可能进入个性化';
  if (status === 'active' && confirmed) {
    confirmationCopy = '该条已确认，本次只改影响力';
  } else if (hasBoostAction && hasLowerAction) {
    confirmationCopy = '设为重点会同时确认；降低影响只改权重并保持待确认';
  } else if (hasLowerAction) {
    confirmationCopy = '降低影响只改权重并保持待确认';
  }
  const evidenceCount = fullItem?.evidenceRefs.length ??
    ('evidenceCount' in item ? item.evidenceCount : 0);
  const evidenceCopy = evidenceCount > 0
    ? `${evidenceCount} 条证据保留`
    : '暂无证据会继续提示补证';

  return `当前影响力 ${formatPercent(score)}；${actions.join(' / ')} 会更新 confidence/salience；${confirmationCopy}；${evidenceCopy}；只影响后续画像选择，不会改旧回答、刷新证据或外发；active + confirmed 才进入个性化。`;
};

const getStarCalibrationImpactReceipt = (item: UserProfileInterestItem) => {
  const evidenceCopy = item.evidenceRefs.length > 0
    ? `${item.evidenceRefs.length} 条证据保留`
    : '暂无证据会继续提示补证';
  const confirmationCopy = item.status === 'active' && item.userConfirmed
    ? '该条已确认，星级只改影响力'
    : '未确认条目会同时确认，确认后才可能使用';
  const currentInfluence = item.explicitImportance ?? item.confidence ?? item.salienceScore ?? 0;

  return `当前影响力 ${formatPercent(currentInfluence)}；星级会更新 confidence/salience；${confirmationCopy}；${evidenceCopy}；只影响后续画像选择，不会改旧回答、刷新证据或外发；active + confirmed 才进入个性化。`;
};

const setImportance = async (
  itemId: string,
  type: string,
  importance: number,
  options: { successMessage?: string; confirmAfterUpdate?: boolean } = {},
) => {
  if (!itemId) {
    setStatus('缺少画像条目ID，无法设置重要性', 'error');
    return;
  }

  if (isItemPending(itemId)) return;
  setItemPending(itemId, true);
  const targetItem = getProfileItemReceiptTarget(itemId);
  const confirmAfterUpdate = options.confirmAfterUpdate !== false;
  setStatus('正在校准画像影响力...', 'info');
  setProfileCalibrationReceipt(
    buildInfluencePendingReceipt(targetItem, importance, confirmAfterUpdate)
  );

  replaceProfileItem(itemId, {
    explicitImportance: importance,
    confidence: importance,
    salienceScore: importance,
  });

  try {
    const response = await chromeAPI.sendMessage({
      type: 'SET_EXPLICIT_IMPORTANCE',
      itemId,
      itemType: type,
      importance,
      confirmAfterUpdate,
    });

    if (response && (response as any).success) {
      const updatedCanUse = getReceiptStatus((response as any).data, targetItem) === 'active' &&
        getReceiptConfirmed((response as any).data, targetItem);
      setStatus(
        options.successMessage || '重要性已更新',
        updatedCanUse ? 'success' : 'info',
      );
      setProfileCalibrationReceipt(
        buildInfluenceReceipt((response as any).data, targetItem, importance)
      );
      await loadUserProfile({ showLoading: false });
    } else if ((response as any)?.partialSuccess && (response as any)?.phase === 'confirm') {
      setStatus((response as any).message || '影响力已更新，确认未完成', 'info');
      setProfileCalibrationReceipt(
        buildInfluencePartialReceipt(
          (response as any).data,
          targetItem,
          importance,
          (response as any).error,
        )
      );
      await loadUserProfile({ showLoading: false });
    } else {
      setStatus((response as any)?.error || '重要性更新失败', 'error');
      setProfileCalibrationReceipt(
        buildInfluenceFailureReceipt(targetItem, importance, (response as any)?.error)
      );
      await loadUserProfile({ showLoading: false });
    }
  } catch (error: any) {
    console.error('设置重要性时发生错误:', error);
    setStatus(error?.message || '重要性更新失败', 'error');
    setProfileCalibrationReceipt(
      buildInfluenceFailureReceipt(targetItem, importance, error?.message)
    );
    await loadUserProfile({ showLoading: false });
  } finally {
    setItemPending(itemId, false);
  }
};

const setProfileItemInfluence = async (
  itemId: string,
  type: string,
  importance: number,
  successMessage: string,
  options: { confirmAfterUpdate?: boolean } = {},
) => {
  await setImportance(itemId, type || 'profile', importance, {
    successMessage,
    confirmAfterUpdate: options.confirmAfterUpdate,
  });
};

const confirmProfileItem = async (itemId: string) => {
  if (!itemId || isItemPending(itemId)) return;
  const targetItem = getProfileItemReceiptTarget(itemId);
  setItemPending(itemId, true);
  setStatus('正在确认画像条目...', 'info');
  setProfileCalibrationReceipt(buildConfirmPendingReceipt(targetItem));
  try {
    const response = await chromeAPI.sendMessage({
      type: 'CONFIRM_PROFILE_ITEM',
      itemId
    });
    if (response && (response as any).success) {
      replaceProfileItem(itemId, {
        userConfirmed: true,
        status: 'active',
        canUseForPersonalization: true,
        contextUseState: 'usable',
      });
      setStatus('画像条目已确认', 'success');
      setProfileCalibrationReceipt(
        buildConfirmedReceipt((response as any).data, targetItem)
      );
      await loadUserProfile({ showLoading: false });
    } else {
      setStatus((response as any)?.error || '画像条目确认失败', 'error');
      setProfileCalibrationReceipt(
        buildOperationFailureReceipt('画像确认', targetItem, (response as any)?.error)
      );
    }
  } catch (error: any) {
    setStatus(error?.message || '画像条目确认失败', 'error');
    setProfileCalibrationReceipt(
      buildOperationFailureReceipt('画像确认', targetItem, error?.message)
    );
  } finally {
    setItemPending(itemId, false);
  }
};

const retractProfileItem = async (itemId: string) => {
  if (!itemId || isItemPending(itemId)) return;
  const targetItem = userProfile.value?.allItems.find((item) => item.id === itemId);
  setItemPending(itemId, true);
  setStatus('正在排除画像条目...', 'info');
  setProfileCalibrationReceipt(buildRetractPendingReceipt(targetItem));
  try {
    const response = await chromeAPI.sendMessage({
      type: 'RETRACT_PROFILE_ITEM',
      itemId
    });
    if (response && (response as any).success) {
      recentlyRetractedProfileItem.value = {
        id: itemId,
        name: targetItem?.name || '该画像条目',
      };
      setStatus(`已排除“${recentlyRetractedProfileItem.value.name}”`, 'success', {
        keepUndoAction: true,
      });
      setProfileCalibrationReceipt(
        buildRetractedReceipt({ status: 'retracted' }, targetItem)
      );
      await loadUserProfile({ showLoading: false });
      if (showRetractedProfileItems.value) {
        await loadRetractedProfileItems();
      }
    } else {
      setStatus((response as any)?.error || '画像条目排除失败', 'error');
      setProfileCalibrationReceipt(
        buildOperationFailureReceipt('画像排除', targetItem, (response as any)?.error)
      );
    }
  } catch (error: any) {
    setStatus(error?.message || '画像条目排除失败', 'error');
    setProfileCalibrationReceipt(
      buildOperationFailureReceipt('画像排除', targetItem, error?.message)
    );
  } finally {
    setItemPending(itemId, false);
  }
};

const restoreProfileItemById = async (
  itemId: string,
  itemName = '该画像条目',
  options: { fromUndo?: boolean } = {},
) => {
  if (!itemId || isItemPending(itemId)) return;
  if (options.fromUndo && isRestoringProfileItem.value) return;
  const targetItem = getProfileItemReceiptTarget(itemId);

  if (options.fromUndo) {
    isRestoringProfileItem.value = true;
  }
  setItemPending(itemId, true);
  setStatus('正在恢复画像条目...', 'info', {
    keepUndoAction: options.fromUndo,
  });
  setProfileCalibrationReceipt(buildRestorePendingReceipt(targetItem, itemName));
  try {
    const response = await chromeAPI.sendMessage({
      type: 'RESTORE_PROFILE_ITEM',
      itemId,
    });

    if (response && (response as any).success) {
      retractedProfileItems.value = retractedProfileItems.value.filter(
        (candidate) => candidate.id !== itemId
      );
      retractedProfileItemsTotal.value = Math.max(
        0,
        retractedProfileItemsTotal.value - 1
      );
      setStatus(`已恢复“${itemName}”`, 'success');
      setProfileCalibrationReceipt(
        buildRestoredReceipt((response as any).data, targetItem)
      );
      await loadUserProfile({ showLoading: false });
    } else {
      setStatus((response as any)?.error || '画像条目恢复失败', 'error', {
        keepUndoAction: options.fromUndo,
      });
      setProfileCalibrationReceipt(
        buildOperationFailureReceipt('画像恢复', targetItem, (response as any)?.error, itemName)
      );
    }
  } catch (error: any) {
    setStatus(error?.message || '画像条目恢复失败', 'error', {
      keepUndoAction: options.fromUndo,
    });
    setProfileCalibrationReceipt(
      buildOperationFailureReceipt('画像恢复', targetItem, error?.message, itemName)
    );
  } finally {
    setItemPending(itemId, false);
    if (options.fromUndo) {
      isRestoringProfileItem.value = false;
    }
  }
};

const restoreRetractedProfileItem = async () => {
  const item = recentlyRetractedProfileItem.value;
  if (!item) return;
  await restoreProfileItemById(item.id, item.name, { fromUndo: true });
};

const createExplicitProfileItem = async () => {
  const itemValue = explicitProfileDraft.value.itemValue.trim();
  const itemKey = resolvedExplicitProfileItemKey.value;
  if (!itemValue || !itemKey || isCreatingExplicitProfile.value) return;

  isCreatingExplicitProfile.value = true;
  setStatus('正在添加主人表达画像...', 'info');
  setProfileCalibrationReceipt(buildCreatePendingReceipt());
  try {
    const response = await chromeAPI.sendMessage({
      type: 'CREATE_PROFILE_ITEM',
      itemType: explicitProfileDraft.value.itemType,
      itemKey,
      itemValue,
      confidence: 1,
    });

    if (response && (response as any).success) {
      explicitProfileDraft.value.itemValue = '';
      setStatus('主人表达画像已添加', 'success');
      setProfileCalibrationReceipt(buildCreatedReceipt((response as any).data));
      await loadUserProfile({ showLoading: false });
    } else {
      setStatus((response as any)?.error || '画像条目添加失败', 'error');
      setProfileCalibrationReceipt(
        buildOperationFailureReceipt('画像添加', undefined, (response as any)?.error)
      );
    }
  } catch (error: any) {
    setStatus(error?.message || '画像条目添加失败', 'error');
    setProfileCalibrationReceipt(
      buildOperationFailureReceipt('画像添加', undefined, error?.message)
    );
  } finally {
    isCreatingExplicitProfile.value = false;
  }
};

const exportUserProfile = async () => {
  if (isExporting.value) return;

  isExporting.value = true;
  profileExportReceipt.value = buildProfileExportPendingReceipt();
  setStatus(
    '正在准备画像导出：重新分页拉取全部状态，下载尚未开始',
    'info',
    { keepExportReceipt: true },
  );
  try {
    const response = await chromeAPI.sendMessage({
      type: 'EXPORT_USER_PROFILE'
    });

    if (response && (response as any).success) {
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const fileName = `用户画像_${timestamp}.json`;
      const exportData = (response as any).data;
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      const pagination = exportData?.exportInfo?.pagination;
      const warnings = Array.isArray(exportData?.exportInfo?.warnings)
        ? exportData.exportInfo.warnings
        : [];
      const profileAudit = exportData?.exportInfo?.profileAudit ?? {};
      const itemCountLabel = pagination
        ? `（${pagination.exportedProfileItems}/${pagination.totalProfileItems} 条）`
        : '';
      const retractedAuditLabel = Number(profileAudit.retractedItems) > 0
        ? `，含 ${profileAudit.retractedItems} 条已排除审计`
        : '';
      const warningLabel = warnings.length > 0
        ? `；${warnings.length} 个诊断项未同步`
        : '';
      profileExportReceipt.value = buildProfileExportReceipt(exportData, fileName);
      setStatus(
        `画像已导出：${fileName}${itemCountLabel}${retractedAuditLabel}${warningLabel}`,
        warnings.length > 0 ? 'info' : 'success',
        { keepExportReceipt: true },
      );
    } else {
      setStatus((response as any)?.error || '用户画像导出失败', 'error');
    }
  } catch (error: any) {
    console.error('导出用户画像时发生错误:', error);
    setStatus(error?.message || '用户画像导出失败', 'error');
  } finally {
    isExporting.value = false;
  }
};

const getActionDisplayName = (action: string): string => {
  const actionNames: Record<string, string> = {
    view: '📖 查看',
    edit: '✏️ 编辑',
    create: '➕ 创建',
    link: '🔗 关联',
    mention: '💬 提及',
    search: '🔍 搜索',
    favorite: '⭐ 收藏'
  };
  return actionNames[action] || action;
};

const updateDecayPreview = () => {
  const data: Array<{ day: number; weight: number }> = [];
  for (let day = 0; day <= 30; day += 2) {
    const weight = Math.pow(1 - weightDecaySettings.value.baseDecayRate, day);
    data.push({
      day,
      weight: Math.max(weightDecaySettings.value.minWeight, weight)
    });
  }
  decayPreviewData.value = data;
};

const resetToDefaults = () => {
  if (confirm('确定要重置为默认设置吗？')) {
    weightDecaySettings.value = {
      baseDecayRate: 0.05,
      maxWeight: 1.0,
      minWeight: 0.01,
      actionWeights: {
        view: 0.1,
        edit: 0.3,
        create: 0.4,
        link: 0.25,
        mention: 0.2,
        search: 0.15,
        favorite: 0.5
      }
    };
    updateDecayPreview();
    setStatus('权重衰变设置已恢复默认值', 'success');
  }
};

const applyDecaySettings = async () => {
  if (isApplyingSettings.value) return;

  isApplyingSettings.value = true;
  try {
    const rawConfig = toRaw(weightDecaySettings.value);
    const response = await chromeAPI.sendMessage({
      type: 'UPDATE_WEIGHT_DECAY_CONFIG',
      config: rawConfig
    });

    if (response && (response as any).success) {
      setStatus('权重衰变设置已应用', 'success');
      await loadUserProfile();
    } else {
      setStatus((response as any)?.error || '权重衰变设置应用失败', 'error');
    }
  } catch (error: any) {
    console.error('应用权重衰变设置时发生错误:', error);
    setStatus(error?.message || '权重衰变设置应用失败', 'error');
  } finally {
    isApplyingSettings.value = false;
  }
};

const getHeatmapIntensity = (intensity: number): string => {
  if (intensity > 0.7) return 'high';
  if (intensity > 0.4) return 'medium';
  return 'low';
};

const getWeightColor = (weight: number): string => {
  if (weight > 0.8) return '#e74c3c';
  if (weight > 0.6) return '#f39c12';
  if (weight > 0.4) return '#f1c40f';
  if (weight > 0.2) return '#2ecc71';
  return '#95a5a6';
};

const updateChartData = () => {
  const profile = userProfile.value;
  behaviorTrendData.value = profile?.activityTrend ?? [];
  heatmapData.value = profile?.heatmap ?? [];
  interestTimelineData.value = profile?.interestTimeline ?? [];

  if (!profile) {
    profileHealthMetrics.value = {
      confirmationRate: 0,
      inferredCount: 0,
      evidenceCoverage: 0,
      categoryCoverage: 0
    };
    return;
  }

  const totalItems = profile.allItems.length;
  const evidenceBackedItems = profile.allItems.filter((item) => item.evidenceRefs.length > 0).length;
  const coveredCategories = Object.values(profile.interests).filter((items) => items.length > 0).length;

  profileHealthMetrics.value = {
    confirmationRate: totalItems > 0 ? (profile.statistics.confirmedItems / totalItems) * 100 : 0,
    inferredCount: profile.statistics.inferredItems,
    evidenceCoverage: totalItems > 0 ? (evidenceBackedItems / totalItems) * 100 : 0,
    categoryCoverage: coveredCategories
  };
};

onMounted(() => {
  updateDecayPreview();
  loadUserProfile();
});
</script>

<style scoped>
/* 🎨 用户画像页面样式 */
.user-profile-section {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.profile-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.header-text h2 {
  color: #2c3e50;
  margin: 0 0 8px 0;
}

.header-text p {
  color: #7f8c8d;
  margin: 0;
}

/* 🎨 导出按钮样式 */
.header-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: 420px;
}

.export-scope-receipt {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  max-width: 100%;
  color: #5d6d7e;
  font-size: 12px;
  line-height: 1.45;
  text-align: right;
}

.export-scope-label {
  color: #34495e;
  font-size: 11px;
  font-weight: 700;
}

.export-preflight-checklist {
  display: grid;
  gap: 4px;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  list-style: none;
  border: 1px solid #d7e2ec;
  border-radius: 8px;
  background: #f8fbff;
  color: #415466;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
}

.export-preflight-checklist li {
  position: relative;
  padding-left: 14px;
  overflow-wrap: anywhere;
}

.export-preflight-checklist li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.58em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2e7d32;
}

.export-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  display: flex;
  align-items: center;
  gap: 8px;
}

.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
}

.export-btn:active {
  transform: translateY(0);
}

.export-btn:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 4px rgba(149, 165, 166, 0.3);
}

.export-btn:disabled:hover {
  transform: none;
  box-shadow: 0 2px 4px rgba(149, 165, 166, 0.3);
}

.status-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 16px 0;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  border: 1px solid #d7dee5;
  background: #f7fbff;
  color: #34495e;
}

.status-message.success {
  background: #eefaf2;
  border-color: #b7e3c5;
  color: #1f7a3f;
}

.status-message.error {
  background: #fff4f3;
  border-color: #f3c4bd;
  color: #a33a2b;
}

.status-action-btn {
  flex-shrink: 0;
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 5px 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.status-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.profile-calibration-receipt,
.profile-export-receipt {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin: 0 0 16px 0;
  padding: 12px 14px;
  border: 1px solid #cfd9e5;
  border-left: 4px solid #1976d2;
  border-radius: 8px;
  background: #f7fbff;
  color: #2c3e50;
}

.profile-calibration-receipt.receipt-success,
.profile-export-receipt.receipt-success {
  border-left-color: #2e7d32;
  background: #f3fbf5;
}

.profile-calibration-receipt.receipt-info,
.profile-export-receipt.receipt-info {
  border-left-color: #1976d2;
  background: #f4f8ff;
}

.profile-calibration-receipt.receipt-warning,
.profile-export-receipt.receipt-warning {
  border-left-color: #f57c00;
  background: #fff9ee;
}

.profile-calibration-receipt-copy,
.profile-export-receipt-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.profile-calibration-receipt-label,
.profile-export-receipt-label {
  color: #5f6f7f;
  font-size: 11px;
  font-weight: 800;
}

.profile-calibration-receipt-copy strong,
.profile-export-receipt-copy strong {
  color: #243447;
  font-size: 14px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.profile-calibration-receipt-copy p,
.profile-export-receipt-copy p {
  margin: 0;
  color: #51606f;
  font-size: 13px;
  line-height: 1.45;
}

.profile-calibration-receipt-chips,
.profile-export-receipt-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 48%;
  flex-shrink: 0;
}

.profile-calibration-receipt-chips span,
.profile-export-receipt-chips span {
  border: 1px solid #d7dee5;
  border-radius: 12px;
  padding: 3px 8px;
  background: #ffffff;
  color: #34495e;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #7f8c8d;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #ecf0f1;
  border-left: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.review-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.review-summary-card {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "label action"
    "value action";
  align-items: center;
  gap: 4px 12px;
  min-height: 78px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #dfe6ee;
  border-radius: 8px;
}

.review-summary-card.primary {
  border-color: #b7d4f6;
  background: #f2f8ff;
}

.review-label {
  grid-area: label;
  color: #6c757d;
  font-size: 12px;
  font-weight: 700;
}

.review-summary-card strong {
  grid-area: value;
  min-width: 0;
  color: #2c3e50;
  font-size: 22px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.review-summary-card .review-time {
  font-size: 13px;
  font-weight: 700;
}

.review-link {
  grid-area: action;
  border: 1px solid #bdd7f2;
  border-radius: 6px;
  background: #ffffff;
  color: #1565c0;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  padding: 7px 10px;
}

.review-link:hover {
  background: #e3f2fd;
}

.review-link:disabled {
  border-color: #d7dee5;
  color: #8a97a3;
  cursor: not-allowed;
  background: #f8f9fa;
}

.profile-card {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e1e8ed;
}

.profile-card h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #2c3e50;
  font-size: 18px;
}

.profile-card-description {
  margin: -8px 0 16px;
  color: #5f6f7f;
  font-size: 14px;
  line-height: 1.5;
}

.owner-profile-form {
  display: grid;
  grid-template-columns: minmax(120px, 0.7fr) minmax(220px, 1.3fr);
  gap: 12px;
  align-items: start;
}

.owner-profile-form select,
.owner-profile-form textarea,
.owner-profile-form input {
  width: 100%;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #ffffff;
  color: #2c3e50;
  font: inherit;
  min-width: 0;
}

.owner-profile-form select,
.owner-profile-form input {
  height: 38px;
  padding: 0 10px;
}

.custom-profile-key-input {
  grid-column: 1 / -1;
}

.owner-profile-form textarea {
  grid-column: 1 / -1;
  min-height: 88px;
  padding: 10px 12px;
  resize: vertical;
}

.explicit-profile-entry-receipt {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid #dce7f4;
  border-radius: 6px;
  background: #f8fbff;
  color: #51606f;
  font-size: 12px;
  line-height: 1.45;
}

.explicit-profile-entry-label {
  flex-shrink: 0;
  color: #1d4f91;
  font-weight: 800;
}

.owner-profile-form select:focus,
.owner-profile-form textarea:focus,
.owner-profile-form input:focus {
  border-color: #1976d2;
  outline: none;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.12);
}

.primary-action-btn {
  grid-column: 1 / -1;
  justify-self: end;
  border: 1px solid #1565c0;
  border-radius: 6px;
  padding: 8px 14px;
  background: #1976d2;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.primary-action-btn:hover {
  background: #1565c0;
}

.primary-action-btn:disabled {
  border-color: #d7dee5;
  background: #e9ecef;
  color: #8a97a3;
  cursor: not-allowed;
}

/* 🌟 兴趣网格布局 */
.interest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.interest-category h4 {
  margin: 0 0 16px 0;
  color: #34495e;
  font-size: 16px;
}

.interest-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 🌟 兴趣项样式 - 带重要性评分 */
.interest-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "icon name rating"
    "receipt receipt receipt";
  align-items: center;
  gap: 8px 12px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.interest-item:hover {
  background: #e3f2fd;
  border-color: #2196f3;
  transform: translateY(-1px);
}

.interest-item.updating,
.profile-item-row.updating,
.prediction-item.updating {
  opacity: 0.72;
}

.interest-icon {
  grid-area: icon;
  font-size: 16px;
}

.interest-name {
  grid-area: name;
  min-width: 0;
  font-weight: 500;
  color: #2c3e50;
  overflow-wrap: anywhere;
}

/* 🌟 重要性评分星级样式 */
.importance-rating {
  grid-area: rating;
  display: flex;
  align-items: center;
  justify-self: end;
}

.star-calibration-receipt {
  grid-area: receipt;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #ffffff;
  color: #526273;
  font-size: 12px;
  line-height: 1.45;
}

.star-calibration-label {
  flex-shrink: 0;
  color: #2c3e50;
  font-weight: 700;
}

.stars {
  display: flex;
  gap: 2px;
}

.star {
  appearance: none;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  color: #ddd;
  transition: all 0.2s ease;
  user-select: none;
  line-height: 1;
  padding: 0 1px;
}

.star:hover {
  color: #ffd700;
  transform: scale(1.1);
}

.star:focus-visible,
.review-link:focus-visible,
.review-filter-btn:focus-visible,
.primary-action-btn:focus-visible,
.secondary-action-btn:focus-visible,
.danger-action-btn:focus-visible,
.tertiary-action-btn:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.star.active {
  color: #ffd700;
  text-shadow: 0 0 3px rgba(255, 215, 0, 0.5);
}

.star.disabled {
  cursor: wait;
  opacity: 0.6;
  transform: none;
}

.star.disabled:hover {
  color: #ddd;
  transform: none;
}

.star.active.disabled:hover {
  color: #ffd700;
}

/* 洞察网格 */
.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.insight-item h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 16px;
}

.insight-item p {
  color: #7f8c8d;
  line-height: 1.5;
  margin: 0;
}

/* 焦点标签 */
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.focus-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
}

/* 推荐列表 */
.suggestions-list,
.predictions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.queue-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.queue-header h3 {
  margin-bottom: 6px;
}

.queue-hint {
  margin: 0;
  color: #6c757d;
  font-size: 13px;
  line-height: 1.4;
}

.review-filter-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.review-filter-btn {
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #ffffff;
  color: #34495e;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  min-height: 32px;
  padding: 6px 10px;
}

.review-filter-btn:hover {
  background: #e3f2fd;
  border-color: #90caf9;
  color: #1565c0;
}

.review-filter-btn.active {
  background: #1976d2;
  border-color: #1565c0;
  color: #ffffff;
}

.suggestion-item,
.prediction-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.prediction-item {
  flex-direction: column;
  gap: 8px;
}

.suggestion-icon {
  margin-right: 12px;
  font-size: 16px;
  color: #3498db;
}

/* 预测兴趣样式 */
.prediction-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}

.prediction-type {
  background: #e8f5e8;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.prediction-confidence {
  background: #fff3e0;
  color: #f57c00;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.prediction-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.prediction-reason {
  color: #7f8c8d;
  font-size: 14px;
}

.prediction-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #6c757d;
  font-size: 12px;
}

.context-use-pill {
  padding: 2px 8px;
  border-radius: 12px;
  background: #fff8e1;
  color: #8a5a00;
  font-weight: 600;
}

.context-use-pill.usable {
  background: #e8f5e9;
  color: #2e7d32;
}

.context-use-pill.inactive {
  background: #f1f3f5;
  color: #5f6f7f;
}

.prediction-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  width: 100%;
}

/* 统计数据网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.items-header h3 {
  margin-bottom: 0;
}

.items-count {
  color: #6c757d;
  font-size: 13px;
  font-weight: 600;
}

.profile-items-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(140px, auto) minmax(140px, auto) auto auto auto;
  gap: 10px;
  align-items: end;
  margin-bottom: 10px;
}

.profile-search-control,
.profile-filter-control {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  color: #5f6f7f;
  font-size: 12px;
  font-weight: 700;
}

.profile-search-control input,
.profile-filter-control select {
  width: 100%;
  height: 36px;
  border: 1px solid #d7dee5;
  border-radius: 6px;
  background: #ffffff;
  color: #2c3e50;
  font: inherit;
  font-size: 13px;
  min-width: 0;
}

.profile-search-control input {
  padding: 0 10px;
}

.profile-filter-control select {
  padding: 0 8px;
}

.profile-search-control input:focus,
.profile-filter-control select:focus {
  border-color: #1976d2;
  outline: none;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.12);
}

.profile-items-summary {
  margin-bottom: 8px;
  color: #6c757d;
  font-size: 12px;
  font-weight: 600;
}

.profile-items-scope-receipt {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border: 1px solid #dce7f4;
  border-radius: 6px;
  background: #f7fbff;
  color: #51606f;
  font-size: 12px;
  line-height: 1.45;
}

.profile-items-scope-label {
  color: #1d4f91;
  font-weight: 800;
  flex-shrink: 0;
}

.inline-empty {
  padding: 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  color: #6c757d;
  font-size: 14px;
}

.inline-empty.compact {
  padding: 10px 12px;
  font-size: 13px;
}

.profile-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.profile-item-main {
  min-width: 0;
  flex: 1;
}

.profile-item-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.profile-item-name {
  min-width: 0;
  color: #2c3e50;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.profile-item-type,
.profile-item-state {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #e9ecef;
  color: #495057;
}

.profile-item-state.confirmed {
  background: #e8f5e9;
  color: #2e7d32;
}

.profile-item-state.pending {
  background: #fff8e1;
  color: #8a5a00;
}

.profile-item-state.retracted {
  background: #f1f3f5;
  color: #5f6f7f;
}

.calibration-priority-pill {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  background: #eef2f7;
  color: #4b5563;
  white-space: nowrap;
}

.calibration-priority-pill.priority-critical {
  background: #fdecea;
  color: #b42318;
}

.calibration-priority-pill.priority-high {
  background: #fff4db;
  color: #8a5a00;
}

.calibration-priority-pill.priority-medium {
  background: #e8f1ff;
  color: #1557a8;
}

.profile-calibration-reason {
  flex-basis: 100%;
  color: #51606f;
  line-height: 1.35;
}

.profile-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: #6c757d;
  font-size: 12px;
}

.evidence-toggle-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: #1565c0;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.evidence-toggle-btn:hover {
  color: #0d47a1;
  text-decoration: underline;
}

.profile-evidence-panel {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  background: #ffffff;
  border: 1px solid #dfe7ef;
  border-radius: 6px;
}

.profile-evidence-item {
  display: grid;
  gap: 3px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.profile-evidence-scope-receipt {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid #dce7f4;
  border-radius: 6px;
  background: #f7fbff;
  color: #51606f;
  font-size: 12px;
  line-height: 1.45;
}

.profile-evidence-scope-label {
  color: #1d4f91;
  font-weight: 800;
  flex-shrink: 0;
}

a.profile-evidence-item:hover .profile-evidence-label {
  color: #1565c0;
  text-decoration: underline;
}

.profile-evidence-label {
  color: #34495e;
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.profile-evidence-detail {
  color: #6c757d;
  font-size: 12px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.profile-evidence-warning {
  color: #8a5a00;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
}

.profile-action-impact-receipt {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #dce7f4;
  border-radius: 6px;
  background: #f8fbff;
  color: #51606f;
  font-size: 12px;
  line-height: 1.45;
}

.profile-action-impact-label {
  color: #1d4f91;
  font-weight: 800;
  flex-shrink: 0;
}

.profile-item-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.secondary-action-btn,
.danger-action-btn,
.tertiary-action-btn {
  border: 1px solid #d7dee5;
  border-radius: 6px;
  padding: 7px 12px;
  background: white;
  color: #34495e;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.secondary-action-btn:hover {
  background: #e3f2fd;
  border-color: #90caf9;
  color: #1565c0;
}

.danger-action-btn:hover {
  background: #fff4f3;
  border-color: #f3c4bd;
  color: #a33a2b;
}

.tertiary-action-btn:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.influence-action-btn {
  border-color: #d7e3f4;
  background: #f8fbff;
  color: #1d4f91;
}

.influence-action-btn:hover {
  background: #e8f2ff;
  border-color: #9ec5fe;
  color: #0d47a1;
}

.secondary-action-btn:disabled,
.danger-action-btn:disabled,
.tertiary-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.secondary-action-btn:disabled:hover,
.danger-action-btn:disabled:hover,
.tertiary-action-btn:disabled:hover {
  background: white;
  border-color: #d7dee5;
  color: #34495e;
}

.profile-item-row.updating .secondary-action-btn:disabled,
.profile-item-row.updating .danger-action-btn:disabled,
.prediction-item.updating .secondary-action-btn:disabled,
.prediction-item.updating .danger-action-btn:disabled {
  cursor: wait;
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding-top: 6px;
}

.load-all-items-btn {
  white-space: nowrap;
}

.retracted-items-toggle-btn {
  white-space: nowrap;
}

.retracted-profile-section {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #e9ecef;
}

.retracted-profile-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}

.retracted-profile-header h4 {
  margin: 0 0 4px 0;
  color: #2c3e50;
  font-size: 15px;
}

.retracted-profile-header p {
  margin: 0;
  color: #6c757d;
  font-size: 12px;
  line-height: 1.4;
}

.retracted-profile-header span {
  flex-shrink: 0;
  color: #6c757d;
  font-size: 12px;
  font-weight: 700;
}

.retracted-profile-item {
  background: #fbfcfd;
}

.stat-card {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 8px;
}

.stat-label {
  color: #7f8c8d;
  font-size: 14px;
  font-weight: 500;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #7f8c8d;
}

.empty-state span {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 8px 0;
  font-size: 16px;
}

.empty-hint {
  font-size: 14px;
  opacity: 0.7;
}

/* 🆕 图表相关样式 */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.chart-container {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e9ecef;
}

.chart-container.full-width {
  grid-column: 1 / -1;
}

.chart-container h4 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 16px;
}

.chart-description {
  color: #6c757d;
  font-size: 12px;
  margin-bottom: 12px;
}

/* 行为趋势图样式 */
.trend-chart {
  padding: 16px 0;
}

.trend-bars {
  display: flex;
  align-items: end;
  gap: 8px;
  height: 120px;
  padding: 0 4px;
}

.trend-bar {
  flex: 1;
  background: linear-gradient(to top, #3498db, #5dade2);
  border-radius: 4px 4px 0 0;
  min-height: 20px;
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trend-bar:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
}

.bar-label {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #6c757d;
  white-space: nowrap;
}

/* 热力图样式 */
.heatmap-chart {
  padding: 16px 0;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 12px;
}

.heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.heatmap-cell:hover {
  transform: scale(1.2);
  border: 1px solid #333;
}

.heatmap-cell.low {
  background-color: #e8f5e8;
}

.heatmap-cell.medium {
  background-color: #81c784;
}

.heatmap-cell.high {
  background-color: #4caf50;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.legend-label {
  color: #6c757d;
}

.legend-scale {
  display: flex;
  gap: 4px;
}

.legend-item {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-item.low {
  background-color: #e8f5e8;
}

.legend-item.medium {
  background-color: #81c784;
}

.legend-item.high {
  background-color: #4caf50;
}

/* 兴趣权重时间线样式 */
.weight-timeline {
  padding: 16px 0;
}

.timeline-container {
  background: white;
  border-radius: 6px;
  padding: 16px;
  border: 1px solid #e9ecef;
}

.timeline-item {
  margin-bottom: 16px;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.interest-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.current-weight {
  font-size: 12px;
  color: #6c757d;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
}

.timeline-line {
  position: relative;
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  overflow: visible;
}

.timeline-point {
  position: absolute;
  top: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.timeline-point:hover {
  transform: scale(1.3);
}

/* 效率指标样式 */
.efficiency-metrics {
  margin-top: 24px;
}

.efficiency-metrics h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 16px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.metric-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.metric-content {
  flex: 1;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 12px;
  color: #6c757d;
  margin: 0;
}

/* 🆕 权重衰变设置样式 */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toggle-settings-btn {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-settings-btn:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.advanced-settings {
  border-top: 2px solid #e9ecef;
  padding-top: 24px;
}

.setting-section {
  margin-bottom: 32px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.setting-section h4 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 16px;
}

.setting-description {
  color: #6c757d;
  font-size: 14px;
  margin: 0 0 20px 0;
  line-height: 1.5;
}

.setting-group {
  margin-bottom: 20px;
}

.setting-group label {
  display: block;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  font-size: 14px;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.slider-container input[type="range"] {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #e9ecef;
  outline: none;
  -webkit-appearance: none;
}

.slider-container input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #007bff;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,123,255,0.3);
}

.slider-container input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #007bff;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0,123,255,0.3);
}

.slider-value {
  min-width: 50px;
  text-align: right;
  font-weight: 600;
  color: #007bff;
  font-size: 14px;
}

.setting-hint {
  color: #6c757d;
  font-size: 12px;
  font-style: italic;
}

/* 行为权重配置样式 */
.action-weights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.action-weight-item {
  background: white;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.action-weight-item label {
  margin-bottom: 8px;
  font-size: 14px;
}

/* 衰变预览图表样式 */
.decay-preview {
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e9ecef;
}

.preview-chart {
  text-align: center;
}

.chart-description {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 16px;
}

.chart-bars {
  display: flex;
  align-items: end;
  justify-content: space-between;
  height: 120px;
  padding: 0 8px;
  background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 4px;
  gap: 2px;
}

.chart-bar {
  background: linear-gradient(to top, #007bff 0%, #6610f2 100%);
  min-height: 2px;
  flex: 1;
  border-radius: 2px 2px 0 0;
  transition: all 0.3s ease;
  opacity: 0.8;
}

.chart-bar:hover {
  opacity: 1;
  transform: scaleY(1.05);
}

/* 设置操作按钮样式 */
.setting-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 24px;
  border-top: 1px solid #e9ecef;
}

.reset-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.apply-btn {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.apply-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
}

.apply-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }
  
  .header-actions {
    align-self: flex-start;
    align-items: stretch;
    width: 100%;
    max-width: none;
  }

  .export-scope-receipt {
    align-items: flex-start;
    text-align: left;
  }

  .export-preflight-checklist {
    max-width: none;
  }
  
  .export-btn {
    width: auto;
    padding: 10px 20px;
    font-size: 14px;
  }

  .profile-calibration-receipt,
  .profile-export-receipt {
    flex-direction: column;
  }

  .profile-calibration-receipt-chips,
  .profile-export-receipt-chips {
    max-width: none;
    justify-content: flex-start;
  }
  
  .interest-grid {
    grid-template-columns: 1fr;
  }
  
  .insights-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .interest-item {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      "icon name"
      "rating rating"
      "receipt receipt";
  }
  
  .importance-rating {
    justify-self: end;
  }
  
  /* 设置页面响应式 */
  .action-weights {
    grid-template-columns: 1fr;
  }
  
  .setting-actions {
    justify-content: stretch;
  }
  
  .setting-actions button {
    flex: 1;
  }
  
  /* 🆕 图表响应式 */
  .charts-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .chart-container.full-width {
    grid-column: 1;
  }
  
  .trend-bars {
    height: 100px;
  }
  
  .heatmap-grid {
    grid-template-columns: repeat(12, 1fr);
  }
  
  .heatmap-cell {
    width: 8px;
    height: 8px;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .metric-card {
    padding: 12px;
  }

  .profile-item-row {
    align-items: stretch;
    flex-direction: column;
  }

  .profile-item-actions {
    justify-content: flex-end;
  }

  .profile-items-toolbar {
    grid-template-columns: 1fr 1fr;
  }

  .profile-search-control {
    grid-column: 1 / -1;
  }

  .queue-header {
    flex-direction: column;
  }

  .review-filter-group {
    justify-content: flex-start;
  }
  
  .metric-icon {
    width: 32px;
    height: 32px;
    font-size: 20px;
  }
  
  .metric-value {
    font-size: 18px;
  }
}

@media (max-width: 480px) {
  .user-profile-section {
    padding: 16px;
  }
  
  .export-btn {
    width: 100%;
    justify-content: center;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .settings-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .toggle-settings-btn {
    align-self: center;
  }

  .profile-items-toolbar {
    grid-template-columns: 1fr;
  }
  
  .setting-section {
    padding: 16px;
  }
  
  .slider-value {
    min-width: 45px;
    font-size: 13px;
  }
  
  .chart-bars {
    height: 80px;
  }
}
</style>
