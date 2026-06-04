<template>
  <div class="relationship-radar-page">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">RM</div>
        <div class="brand-text">
          <h2>Relationship Memory Radar</h2>
          <span>高频人物上下文、偏好、open loop 与关系图谱</span>
        </div>
      </div>

      <div class="top-actions">
        <label class="search">
          <span class="search-icon">Search</span>
          <input
            v-model="searchText"
            type="search"
            placeholder="搜索人物、别名或描述"
            @keydown.enter.prevent="refreshAll"
          />
        </label>
        <button class="ghost-btn" type="button" :disabled="isLoading" @click="refreshAll">
          {{ isLoading ? '刷新中' : '刷新' }}
        </button>
        <button
          class="pill-btn primary"
          type="button"
          :disabled="isConsolidating"
          @click="runConsolidation(false)"
        >
          {{ isConsolidating ? '整理中' : '后台整理' }}
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

    <section class="hero">
      <div class="greeting-strip">
        <div class="greeting-line">
          <i></i>
          <strong>{{ people.length }} 位雷达人物</strong>
          <span>{{ peopleResponse?.coverageNote || '正在读取 Memory Service 的人物关系投影。' }}</span>
        </div>
        <div class="legend">
          <span><i class="hot"></i>需确认</span>
          <span><i class="warn"></i>待跟进</span>
          <span><i class="calm"></i>已沉淀</span>
        </div>
      </div>

      <article :class="['spotlight', { loading: isInitialLoading }]">
        <template v-if="isInitialLoading">
          <div class="spotlight-tag skeleton-pill"></div>
          <div class="skeleton-line title"></div>
          <div class="skeleton-line body wide"></div>
          <div class="skeleton-line body"></div>
          <div class="spotlight-meta skeleton-meta">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="spotlight-actions">
            <span class="skeleton-button"></span>
            <span class="skeleton-button"></span>
          </div>
        </template>
        <template v-else>
          <div class="spotlight-tag">现在最该关注</div>
          <h2>
            <template v-if="spotlightPerson">
              {{ spotlightShortName }} 在 <em>{{ spotlightTopic }}</em> 上还有未闭环事项
            </template>
            <template v-else>
              等待 Memory Service 发现最该关注的人物
            </template>
          </h2>
          <p class="spotlight-body">
            {{ spotlightBody }}
          </p>
          <div v-if="spotlightPerson" class="spotlight-meta">
            <span>{{ spotlightPerson.interactionCount }} 次交互</span>
            <span>{{ spotlightPerson.activeDays }} 个活跃日</span>
            <span>{{ formatDate(spotlightPerson.lastInteractionAt) }}</span>
            <span :class="['chip', stateTone(spotlightPerson.radarState)]">
              {{ stateLabel(spotlightPerson.radarState) }}
            </span>
            <span :class="['chip', qualityTone(spotlightPerson.dataQuality)]">
              {{ qualityLabel(spotlightPerson.dataQuality) }}
            </span>
          </div>
          <div v-else class="spotlight-meta">
            <span>lazy fallback 会先展示索引信号</span>
            <span>后台整理会补齐高质量上下文卡</span>
          </div>
          <div class="spotlight-actions">
            <button
              type="button"
              class="primary"
              :disabled="!spotlightPerson"
              @click="focusSpotlightBrief"
            >
              查看完整 brief
            </button>
            <button
              type="button"
              :disabled="!spotlightPerson || isConsolidating"
              @click="runConsolidation(true, spotlightPerson?.id)"
            >
              强制刷新此人
            </button>
            <button
              type="button"
              :disabled="!isSpotlightContextLoaded"
              @click="copyContextPackage"
            >
              复制给 AI
            </button>
          </div>
        </template>
      </article>

      <div v-if="isInitialLoading" class="stat-strip">
        <div v-for="index in 3" :key="`stat-skeleton-${index}`" class="stat-card skeleton-card">
          <div>
            <span class="skeleton-line label"></span>
            <span class="skeleton-line stat-value"></span>
            <span class="skeleton-line stat-caption"></span>
          </div>
          <span class="stat-icon skeleton-icon"></span>
        </div>
      </div>
      <div v-else class="stat-strip">
        <div class="stat-card">
          <div>
            <span class="label">高频阈值</span>
            <strong>{{ peopleResponse?.threshold.minimumInteractionCount || '-' }}</strong>
            <small>次交互 / {{ peopleResponse?.threshold.minimumActiveDays || '-' }} 活跃日</small>
          </div>
          <span class="stat-icon">T</span>
        </div>
        <div class="stat-card">
          <div>
            <span class="label">待确认事实</span>
            <strong>{{ pendingReviewCount }}</strong>
            <small>确认后写入人物画像</small>
          </div>
          <span class="stat-icon warn">Q</span>
        </div>
        <div class="stat-card">
          <div>
            <span class="label">后台整理</span>
            <strong>{{ consolidationResult?.consolidated ?? generatedPeopleCount }}</strong>
            <small>{{ lastConsolidationText }}</small>
          </div>
          <span class="stat-icon purple">M</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div class="section-title">
          <h3>人物雷达</h3>
          <span>{{ people.length }} / {{ peopleResponse?.totalCandidates || 0 }} 位候选</span>
        </div>
        <div class="section-tools">
          <button
            v-for="option in stateFilterOptions"
            :key="option.value"
            type="button"
            :class="{ active: stateFilter === option.value }"
            @click="setStateFilter(option.value)"
          >
            {{ option.label }}
          </button>
          <button
            type="button"
            :class="{ active: includeBelowThreshold }"
            @click="toggleIncludeBelowThreshold"
          >
            候选
          </button>
        </div>
      </div>

      <div v-if="hasActivePeopleFilters" class="filter-summary">
        <div>
          <span>当前范围</span>
          <strong>{{ peopleFilterSummary }}</strong>
        </div>
        <div class="filter-actions">
          <button
            v-if="!appliedPeopleFilters.includeBelowThreshold"
            type="button"
            class="tiny-btn"
            @click="showCandidatePeople"
          >
            查看候选
          </button>
          <button type="button" class="tiny-btn primary" @click="clearPeopleFilters">
            清空筛选
          </button>
        </div>
      </div>

      <div v-if="isInitialLoading" class="radar-grid loading-grid" aria-busy="true">
        <article
          v-for="index in 6"
          :key="`person-skeleton-${index}`"
          class="person-card skeleton-card"
        >
          <div class="person-head">
            <div class="avatar skeleton-avatar"></div>
            <div class="person-name skeleton-name">
              <span class="skeleton-line name"></span>
              <span class="skeleton-line sub"></span>
            </div>
          </div>
          <span class="skeleton-line body wide"></span>
          <span class="skeleton-line body"></span>
          <div class="person-foot">
            <span class="skeleton-line foot"></span>
            <span class="skeleton-line foot"></span>
          <span class="skeleton-line foot"></span>
          </div>
        </article>
      </div>
      <div v-else-if="people.length === 0" class="empty-state people-empty">
        <strong>{{ peopleEmptyTitle }}</strong>
        <p>{{ peopleEmptyBody }}</p>
        <div v-if="hasActivePeopleFilters" class="empty-actions">
          <button
            v-if="!appliedPeopleFilters.includeBelowThreshold"
            type="button"
            class="tiny-btn"
            @click="showCandidatePeople"
          >
            查看候选
          </button>
          <button type="button" class="tiny-btn primary" @click="clearPeopleFilters">
            清空筛选
          </button>
        </div>
      </div>
      <div v-else class="radar-grid">
        <button
          v-for="(person, index) in people"
          :key="person.id"
          type="button"
          :class="['person-card', toneForPerson(person), { active: person.id === selectedPersonId }]"
          @click="selectPerson(person, { scrollToBrief: true })"
        >
          <div class="person-head">
            <div :class="['avatar', `g-${(index % 5) + 1}`]">
              {{ person.name.slice(0, 1) }}
            </div>
            <div class="person-name">
              <strong>{{ person.name }}</strong>
              <span>{{ stateLabel(person.radarState) }} · {{ qualityLabel(person.dataQuality) }}</span>
            </div>
            <span v-if="person.reviewPendingCount > 0" class="chip hot">
              {{ person.reviewPendingCount }}
            </span>
          </div>
          <p class="person-headline">{{ personCardSummary(person) }}</p>
          <div class="person-foot">
            <span>{{ person.interactionCount }} 次</span>
            <span>{{ person.activeDays }} 天</span>
            <span>{{ formatPercent(person.score) }}</span>
          </div>
        </button>
      </div>
    </section>

    <section class="section detail-anchor" v-if="selectedPerson" ref="detailBriefRef">
      <div class="section-head">
        <div class="section-title stacked">
          <h3>{{ selectedShortName }} 的沟通前 brief</h3>
          <span class="sub">事实 / 推断 / 敏感分栏，证据可追溯，30 秒扫读。</span>
        </div>
        <div class="section-tools detail-tools">
          <button type="button" :class="{ active: activeTab === 'context' }" @click="activeTab = 'context'">
            brief
          </button>
          <button type="button" :class="{ active: activeTab === 'meeting' }" @click="activeTab = 'meeting'">
            meeting
          </button>
          <button type="button" :class="{ active: activeTab === 'review' }" @click="activeTab = 'review'">
            review
          </button>
          <button
            v-if="activeTab === 'context'"
            type="button"
            class="copy-context-action"
            :disabled="!contextCard || isContextLoading"
            @click="copyContextPackage"
          >
            {{ contextCopyActionLabel }}
          </button>
        </div>
      </div>
    </section>

    <section class="detail" v-if="selectedPerson">
      <main class="detail-main">
        <div class="detail-hero">
          <div class="detail-hero-row">
            <div class="detail-identity">
              <div class="avatar large">{{ selectedPerson.name.slice(0, 1) }}</div>
              <div class="detail-name">
                <h2>
                  {{ selectedPerson.name }}
                  <span :class="['chip', stateTone(selectedPerson.radarState)]">
                    {{ stateLabel(selectedPerson.radarState) }}
                  </span>
                  <span :class="['chip', qualityTone(selectedPerson.dataQuality)]">
                    {{ qualityLabel(selectedPerson.dataQuality) }}
                  </span>
                </h2>
                <p>{{ selectedBriefSummary }}</p>
              </div>
            </div>
            <div class="detail-actions">
              <button class="ghost-btn" type="button" @click="activeTab = 'meeting'">
                会议简报
              </button>
              <button class="ghost-btn" type="button" @click="activeTab = 'assistant'">
                回复助手
              </button>
            </div>
          </div>

          <div class="detail-metrics">
            <div class="detail-metric">
              <span>关系分</span>
              <strong>{{ formatPercent(selectedPerson.score) }}</strong>
              <i :style="{ '--pct': formatPercent(selectedPerson.score) }"></i>
            </div>
            <div class="detail-metric">
              <span>近期信号</span>
              <strong>{{ formatPercent(selectedPerson.signals.recent) }}</strong>
              <i :style="{ '--pct': formatPercent(selectedPerson.signals.recent) }"></i>
            </div>
            <div class="detail-metric">
              <span>交互频率</span>
              <strong>{{ formatPercent(selectedPerson.signals.frequency) }}</strong>
              <i :style="{ '--pct': formatPercent(selectedPerson.signals.frequency) }"></i>
            </div>
            <div class="detail-metric">
              <span>来源广度</span>
              <strong>{{ formatPercent(selectedPerson.signals.breadth) }}</strong>
              <i :style="{ '--pct': formatPercent(selectedPerson.signals.breadth) }"></i>
            </div>
          </div>
        </div>

        <nav class="tabs" aria-label="关系雷达详情">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            :class="{ active: activeTab === tab.value }"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
            <span v-if="tab.badge" class="badge">{{ tab.badge }}</span>
          </button>
        </nav>

        <div class="tab-content">
          <div v-if="isContextLoading && activeTab === 'context'" class="loading-state compact">
            正在生成上下文卡...
          </div>

          <template v-else-if="activeTab === 'context' && contextCard">
            <div class="quote">
              <div class="quote-body">{{ contextQuote }}</div>
            </div>

            <section class="action-suggestions">
              <div class="action-head">
                <div>
                  <span>现在建议</span>
                  <strong>先看结论，再看证据</strong>
                </div>
                <span>{{ contextActionSuggestions.length }} 条</span>
              </div>
              <div class="action-grid">
                <article
                  v-for="suggestion in contextActionSuggestions"
                  :key="`${suggestion.title}:${suggestion.reason}`"
                  :class="['action-card', suggestion.tone]"
                >
                  <div class="action-card-title">
                    <span :class="['chip', suggestionTone(suggestion.tone)]">
                      {{ suggestionToneLabel(suggestion.tone) }}
                    </span>
                    <strong>{{ suggestion.title }}</strong>
                  </div>
                  <p>{{ suggestion.body }}</p>
                  <div class="action-card-foot">
                    <span>{{ suggestion.reason }}</span>
                    <button
                      v-if="suggestion.evidenceRef"
                      type="button"
                      class="tiny-btn"
                      @click="openEvidence(suggestion.evidenceRef)"
                    >
                      查看依据
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <div :class="['privacy-strip', contextCard.privacySummary.sensitiveIncluded ? 'warn' : '']">
              <div>
                <strong>{{ contextPrivacyTitle }}</strong>
                <p>{{ contextPrivacySummaryText }}</p>
                <div
                  v-if="contextHiddenSensitiveBreakdown.length > 0"
                  class="privacy-breakdown"
                  aria-label="隐藏敏感上下文类型"
                >
                  <span
                    v-for="item in contextHiddenSensitiveBreakdown"
                    :key="item.key"
                  >
                    {{ item.label }} {{ item.count }}
                  </span>
                </div>
              </div>
              <button
                v-if="!contextCard.privacySummary.sensitiveIncluded && contextHiddenSensitiveCount > 0"
                class="tiny-btn"
                type="button"
                :disabled="isContextLoading"
                @click="setContextSensitiveIncluded(true)"
              >
                临时包含敏感上下文
              </button>
              <button
                v-else-if="contextCard.privacySummary.sensitiveIncluded"
                class="tiny-btn"
                type="button"
                :disabled="isContextLoading"
                @click="setContextSensitiveIncluded(false)"
              >
                恢复默认隐藏
              </button>
            </div>

            <div class="panel-grid">
              <section class="panel">
                <div class="panel-head">
                  <h4><span class="panel-icon">F</span>已知事实</h4>
                  <span>{{ contextCard.knownFacts.length }}</span>
                </div>
                <div class="panel-body">
                  <div v-if="contextCard.knownFacts.length === 0" class="muted-line">
                    还没有沉淀为人物事实。
                  </div>
                  <div
                    v-for="fact in contextCard.knownFacts"
                    :key="`${fact.key}:${fact.value}`"
                    class="item"
                  >
                    <div class="item-row">
                      <strong>{{ fact.key }}</strong>
                      <span :class="['chip', fact.confirmed ? 'ok' : 'warn']">
                        {{ fact.confirmed ? '已确认' : '待确认' }}
                      </span>
                    </div>
                    <p>{{ fact.value }}</p>
                  </div>
                </div>
              </section>

              <section class="panel">
                <div class="panel-head">
                  <h4><span class="panel-icon purple">R</span>关联对象</h4>
                  <span>{{ contextCard.relationshipHints.length }}</span>
                </div>
                <div class="panel-body">
                  <div v-if="contextCard.relationshipHints.length === 0" class="muted-line">
                    暂无稳定关系边。
                  </div>
                  <div
                    v-for="hint in contextCard.relationshipHints"
                    :key="`${hint.targetId}:${hint.relationType}`"
                    class="item relation-item"
                  >
                    <div>
                      <strong>{{ hint.targetName }}</strong>
                      <p>{{ hint.relationType }} · {{ hint.context || hint.targetType }}</p>
                    </div>
                    <span>{{ formatPercent(hint.strength) }}</span>
                  </div>
                </div>
              </section>

              <section class="panel full">
                <div class="panel-head">
                  <h4><span class="panel-icon warn">O</span>可能需要跟进</h4>
                  <span>{{ contextCard.openLoops.length }}</span>
                </div>
                <div class="panel-body">
                  <div v-if="contextCard.openLoops.length === 0" class="muted-line">
                    没有识别到明确 open loop。
                  </div>
                  <button
                    v-for="loop in contextCard.openLoops"
                    :key="loop.id"
                    type="button"
                    class="timeline-item"
                    @click="openEvidence(loop.evidenceRef)"
                  >
                    <span>{{ formatDate(loop.timestamp) }}</span>
                    <strong>{{ loop.title }}</strong>
                    <p>{{ loop.snippet }}</p>
                  </button>
                </div>
              </section>

              <section class="panel full">
                <div class="panel-head">
                  <h4><span class="panel-icon ok">B</span>检索增强提示</h4>
                  <span>{{ contextCard.retrievalHints.boostTerms.length }}</span>
                </div>
                <div class="panel-body boost-cloud">
                  <span
                    v-for="term in contextCard.retrievalHints.boostTerms"
                    :key="term"
                    class="chip blue"
                  >
                    {{ term }}
                  </span>
                </div>
              </section>

              <section v-if="contextCard.doNotAssume.length > 0" class="panel full">
                <div class="panel-head">
                  <h4><span class="panel-icon danger">!</span>不要假设</h4>
                </div>
                <div class="panel-body">
                  <div
                    v-for="note in contextCard.doNotAssume"
                    :key="note"
                    class="item"
                  >
                    <p>{{ note }}</p>
                  </div>
                </div>
              </section>

              <details class="panel full markdown-panel">
                <summary>Memory Context Markdown</summary>
                <pre>{{ contextCard.contextMd }}</pre>
              </details>
            </div>
          </template>

          <template v-else-if="activeTab === 'meeting'">
            <div class="tool-form">
              <label>
                会议标题
                <input v-model="meetingTitle" type="text" placeholder="例如：Relationship Radar 评审" />
              </label>
              <label>
                参会人（每行一个）
                <textarea v-model="meetingAttendeesText" rows="5"></textarea>
              </label>
              <button
                class="pill-btn primary"
                type="button"
                :disabled="isMeetingLoading"
                @click="generateMeetingBrief"
              >
                {{ isMeetingLoading ? '生成中' : '生成会议人物简报' }}
              </button>
            </div>

            <div v-if="meetingBrief" class="panel full">
              <div class="panel-head">
                <h4><span class="panel-icon">M</span>{{ meetingBrief.title }}</h4>
                <button class="tiny-btn primary" type="button" @click="copyMeetingBrief">
                  复制简报
                </button>
              </div>

              <div class="brief-coverage">
                <article class="coverage-card">
                  <span>匹配参会人</span>
                  <strong>
                    {{ meetingBrief.coverage.matchedAttendees }}/{{ meetingBrief.coverage.totalAttendees }}
                  </strong>
                </article>
                <article
                  v-if="meetingBrief.coverage.omittedAttendees > 0"
                  class="coverage-card muted"
                >
                  <span>已分析</span>
                  <strong>
                    {{ meetingBrief.coverage.processedAttendees }}/{{ meetingBrief.coverage.totalAttendees }}
                  </strong>
                </article>
                <article class="coverage-card">
                  <span>可引用证据</span>
                  <strong>{{ meetingBrief.coverage.evidenceRefs }}</strong>
                </article>
                <article class="coverage-card warn">
                  <span>需会中确认</span>
                  <strong>{{ meetingBrief.coverage.unmatchedAttendees }}</strong>
                </article>
                <article
                  v-if="meetingBrief.coverage.identityCheckAttendees > 0"
                  class="coverage-card warn"
                >
                  <span>身份待核对</span>
                  <strong>{{ meetingBrief.coverage.identityCheckAttendees }}</strong>
                </article>
                <p class="coverage-note">{{ meetingBrief.coverage.coverageNote }}</p>
                <div v-if="(meetingBrief.omittedAttendees?.length || 0) > 0" class="coverage-omitted">
                  <strong>未展开参会人</strong>
                  <span
                    v-for="attendee in (meetingBrief.omittedAttendees || []).slice(0, 8)"
                    :key="`${attendee.displayName}:${attendee.email || ''}`"
                  >
                    {{ attendee.displayName }}
                    <small v-if="attendee.email">{{ attendee.email }}</small>
                  </span>
                </div>
              </div>

              <div :class="['brief-readiness', meetingReadinessTone(meetingBrief.readiness.status)]">
                <div class="brief-readiness-head">
                  <div>
                    <span>会前准备状态</span>
                    <strong>{{ meetingReadinessLabel(meetingBrief.readiness.status) }}</strong>
                  </div>
                  <p>{{ meetingBrief.readiness.summary }}</p>
                </div>
                <div class="brief-readiness-grid">
                  <section>
                    <strong>下一步</strong>
                    <p
                      v-for="action in meetingBrief.readiness.nextActions"
                      :key="action"
                    >
                      {{ action }}
                    </p>
                  </section>
                  <section>
                    <strong>成功标准</strong>
                    <p
                      v-for="criterion in meetingBrief.readiness.successCriteria"
                      :key="criterion"
                    >
                      {{ criterion }}
                    </p>
                  </section>
                </div>
              </div>

              <div class="attendee-brief-grid">
                <article
                  v-for="attendee in meetingBrief.attendees"
                  :key="`${attendee.displayName}:${attendee.email || ''}`"
                  :class="['attendee-brief-card', attendee.coverageState]"
                >
                  <div class="attendee-brief-head">
                    <div>
                      <strong>{{ attendee.personName || attendee.displayName }}</strong>
                      <span v-if="attendee.email">{{ attendee.email }}</span>
                    </div>
                    <span :class="['chip', meetingCoverageTone(attendee.coverageState)]">
                      {{ meetingCoverageLabel(attendee.coverageState) }}
                    </span>
                  </div>

                  <div class="match-row">
                    <span :class="['chip', matchTone(attendee.matchedBy)]">
                      {{ matchLabel(attendee.matchedBy) }}
                    </span>
                    <span v-if="attendee.identityCheckRequired" class="chip warn">
                      身份待核对
                    </span>
                    <span>{{ attendee.matchReason }}</span>
                    <span v-if="attendee.matchedBy !== 'none'">
                      {{ Math.round(attendee.matchConfidence * 100) }}%
                    </span>
                  </div>

                  <p v-if="attendee.identityCheckRequired" class="identity-check-note">
                    {{ attendee.identityCheckReason || '这个匹配需要先核对身份，再使用历史上下文。' }}
                  </p>

                  <p>{{ attendee.summary }}</p>

                  <div v-if="attendee.openLoops.length > 0" class="brief-subsection">
                    <strong>Open loop</strong>
                    <button
                      v-for="loop in attendee.openLoops.slice(0, 2)"
                      :key="loop.id"
                      type="button"
                      class="brief-evidence"
                      @click="openEvidence(loop.evidenceRef)"
                    >
                      <span>{{ formatDate(loop.timestamp) }}</span>
                      <p>{{ loop.snippet }}</p>
                    </button>
                  </div>

                  <div class="brief-subsection">
                    <strong>建议问法</strong>
                    <p
                      v-for="question in attendee.suggestedQuestions"
                      :key="question"
                      class="question-line"
                    >
                      {{ question }}
                    </p>
                  </div>

                  <div v-if="attendee.evidenceRefs.length > 0" class="evidence-actions">
                    <button
                      v-for="evidence in attendee.evidenceRefs.slice(0, 3)"
                      :key="`${evidence.sourceKind}:${evidence.sourceId}`"
                      class="tiny-btn"
                      type="button"
                      @click="openEvidence(evidence)"
                    >
                      证据 {{ evidence.sourceKind }}
                    </button>
                  </div>
                </article>
              </div>

              <details class="matrix-details">
                <summary>查看矩阵</summary>
                <div class="matrix">
                  <div class="matrix-head">
                    <span>人物</span>
                    <span>匹配</span>
                    <span>上下文</span>
                    <span>建议问法</span>
                  </div>
                  <div v-for="row in meetingBrief.matrix" :key="row.person" class="matrix-row">
                    <strong>{{ row.person }}</strong>
                    <p>{{ row.matchStatus }}</p>
                    <p>{{ row.recentContext }}</p>
                    <p>{{ row.suggestedAsk }}</p>
                  </div>
                </div>
              </details>
            </div>
          </template>

          <template v-else-if="activeTab === 'assistant'">
            <div class="tool-form">
              <label>
                你要达成什么
                <textarea
                  v-model="assistantGoal"
                  rows="4"
                  placeholder="例如：礼貌跟进上次评审中未确认的 owner 和 deadline"
                ></textarea>
              </label>
              <button
                class="pill-btn primary"
                type="button"
                :disabled="isAssistantLoading"
                @click="generateAssistantDraft"
              >
                {{ isAssistantLoading ? '生成中' : '生成关系感知回复' }}
              </button>
            </div>

            <div v-if="assistantDraft" class="panel full">
              <div class="panel-head">
                <h4><span class="panel-icon purple">A</span>{{ assistantDraft.personName }}</h4>
                <button class="tiny-btn primary" type="button" @click="copyAssistantDraft">
                  复制草稿
                </button>
              </div>
              <div class="draft-box">{{ assistantDraft.draftText }}</div>
              <div v-if="assistantDraft.warnings.length > 0" class="warning-list">
                <strong>发送前注意</strong>
                <p v-for="warning in assistantDraft.warnings" :key="warning">
                  {{ warning }}
                </p>
              </div>
            </div>
          </template>

          <template v-else-if="activeTab === 'graph'">
            <div class="graph-layout">
              <div class="graph-canvas">
                <div
                  v-for="(node, index) in graphPeopleNodes"
                  :key="node.id"
                  :class="['graph-node', node.radarState ? stateTone(node.radarState) : 'muted']"
                  :style="graphNodeStyle(index, graphPeopleNodes.length)"
                >
                  <strong>{{ node.label.slice(0, 2) }}</strong>
                  <span>{{ node.label }}</span>
                </div>
                <div v-if="graphPeopleNodes.length === 0" class="empty-state compact">
                  关系图谱暂无节点。
                </div>
              </div>
              <div class="graph-side">
                <h4>关系动态</h4>
                <div v-if="!graph?.dynamics.length" class="muted-line">
                  暂无显著动态。
                </div>
                <button
                  v-for="dynamic in graph?.dynamics || []"
                  :key="`${dynamic.kind}:${dynamic.title}`"
                  type="button"
                  class="item graph-dynamic"
                  @click="dynamic.personId && selectPersonById(dynamic.personId)"
                >
                  <strong>{{ dynamic.title }}</strong>
                  <p>{{ dynamic.body }}</p>
                </button>

                <h4>强关系边</h4>
                <div v-for="edge in graph?.edges.slice(0, 8) || []" :key="edge.id" class="edge-row">
                  <span>{{ edgeLabel(edge.from) }}</span>
                  <em>{{ edge.label }}</em>
                  <span>{{ edgeLabel(edge.to) }}</span>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeTab === 'review'">
            <div class="review-filter">
              <button
                v-for="option in reviewStatusOptions"
                :key="option.value"
                type="button"
                :class="{ active: reviewStatus === option.value }"
                @click="setReviewStatus(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
            <div class="review-summary">
              <span>{{ reviewTotal }} 条当前筛选</span>
              <span>{{ pendingReviewCount }} 条待确认</span>
              <span>确认后写入人物画像，稍后项到期会重新回到待确认。</span>
            </div>
            <div v-if="reviewItems.length === 0" class="empty-state compact">
              当前筛选下没有关系事实需要处理。
            </div>
            <div class="review-grid">
              <article
                v-for="item in reviewItems"
                :key="item.id"
                class="review-card"
              >
                <div class="item-row">
                  <div class="review-title">
                    <strong>{{ item.title }}</strong>
                    <span>{{ item.personName }} · {{ item.proposedKey }}</span>
                  </div>
                  <span :class="['chip', reviewTone(item.status)]">
                    {{ reviewStatusLabel(item.status) }}
                  </span>
                </div>
                <p>{{ item.reason }}</p>
                <div class="review-meta">
                  <span :class="['chip', priorityTone(item.priority)]">
                    {{ priorityLabel(item.priority) }}
                  </span>
                  <span>{{ formatConfidence(item.confidence) }}</span>
                  <span v-if="formatReviewDue(item)">{{ formatReviewDue(item) }}</span>
                </div>
                <label class="review-field">
                  建议写入内容
                  <textarea
                    v-model="reviewDrafts[item.id]"
                    :disabled="!canActOnReviewItem(item)"
                    rows="3"
                  ></textarea>
                </label>
                <label class="review-field">
                  复核备注
                  <textarea
                    v-model="reviewNoteDrafts[item.id]"
                    :disabled="!canActOnReviewItem(item)"
                    rows="2"
                    placeholder="可记录确认来源、驳回原因或稍后原因"
                  ></textarea>
                </label>
                <div v-if="item.evidenceRefs.length > 0" class="review-evidence">
                  <button
                    v-for="evidence in item.evidenceRefs.slice(0, 3)"
                    :key="`${item.id}:${evidence.sourceKind}:${evidence.sourceId}`"
                    type="button"
                    class="tiny-btn"
                    @click="openEvidence(evidence)"
                  >
                    {{ evidenceLabel(evidence) }}
                  </button>
                </div>
                <div class="review-actions">
                  <button
                    class="tiny-btn primary"
                    type="button"
                    :disabled="!canActOnReviewItem(item) || isReviewActionLoading(item.id)"
                    @click="applyReviewAction(item, 'confirm')"
                  >
                    确认
                  </button>
                  <button
                    class="tiny-btn"
                    type="button"
                    :disabled="!canActOnReviewItem(item) || isReviewActionLoading(item.id)"
                    @click="applyReviewAction(item, 'snooze')"
                  >
                    稍后 7 天
                  </button>
                  <button
                    class="tiny-btn danger"
                    type="button"
                    :disabled="!canActOnReviewItem(item) || isReviewActionLoading(item.id)"
                    @click="applyReviewAction(item, 'reject')"
                  >
                    驳回
                  </button>
                </div>
              </article>
            </div>
          </template>
        </div>
      </main>

      <aside class="detail-side">
        <section class="side-panel">
          <div class="side-head">
            <h4>确认队列</h4>
            <button type="button" @click="openPendingReviewTab">查看全部</button>
          </div>
          <div v-if="pendingReviewItems.length === 0" class="muted-line">
            当前没有需要确认的关系事实。
          </div>
          <article
            v-for="item in pendingReviewItems.slice(0, 3)"
            :key="item.id"
            class="side-review"
          >
            <strong>{{ item.personName }}</strong>
            <p>{{ item.proposedValue }}</p>
            <div class="review-meta compact">
              <span>{{ formatConfidence(item.confidence) }}</span>
              <span>{{ item.evidenceRefs.length }} 条证据</span>
            </div>
            <div class="review-actions">
              <button
                class="tiny-btn primary"
                type="button"
                :disabled="isReviewActionLoading(item.id)"
                @click="applyReviewAction(item, 'confirm')"
              >
                确认
              </button>
              <button
                class="tiny-btn"
                type="button"
                :disabled="isReviewActionLoading(item.id)"
                @click="applyReviewAction(item, 'snooze')"
              >
                稍后 7 天
              </button>
            </div>
          </article>
        </section>

        <section class="side-panel">
          <div class="side-head">
            <h4>存储形态</h4>
          </div>
          <dl class="storage-list">
            <div>
              <dt>雷达投影</dt>
              <dd>relationship_radar_people</dd>
            </div>
            <div>
              <dt>上下文卡</dt>
              <dd>relationship_context_cards</dd>
            </div>
            <div>
              <dt>事件索引</dt>
              <dd>relationship_event_index</dd>
            </div>
            <div>
              <dt>人工确认</dt>
              <dd>relationship_review_items → entity_properties</dd>
            </div>
          </dl>
        </section>

        <section class="side-panel">
          <div class="side-head">
            <h4>数据接力</h4>
          </div>
          <ol class="flow-list">
            <li>打开页面时使用 lazy fallback，先从 Person、message、relationship 索引即时构建。</li>
            <li>每日 memory service 后台整理高频人物，写入更稳定的 context card 与事件索引。</li>
            <li>用户确认关键事实后，升级为 confirmed，并反哺聊天、会议、外部 AI 对话检索。</li>
          </ol>
        </section>
      </aside>
    </section>

    <div v-if="copyMessage" class="copy-toast" role="status">{{ copyMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type RelationshipAssistantDraft,
  type RelationshipContextCard,
  type RelationshipConsolidationResult,
  type RelationshipDataQuality,
  type RelationshipEvidenceRef,
  type RelationshipGraph,
  type RelationshipMeetingBrief,
  type RelationshipPeopleResponse,
  type RelationshipPersonSummary,
  type RelationshipRadarState,
  type RelationshipReviewAction,
  type RelationshipReviewItem,
  type RelationshipReviewStatus,
} from '../../services/MemoryServiceClient';
import {
  sanitizeContextExternalUrl,
  sanitizeExploreRoute,
} from '../../web-intelligence/contextRecallGuards';
import { useMemoryStore } from '../memory-store';

type RadarStateFilter = RelationshipRadarState | 'all';
type ReviewStatusFilter = RelationshipReviewStatus | 'all';
type DetailTab = 'context' | 'meeting' | 'assistant' | 'graph' | 'review';
type ContextActionSuggestion = NonNullable<
  RelationshipContextCard['actionSuggestions']
>[number];

const client = getMemoryServiceClient();
const router = useRouter();
const store = useMemoryStore();

const isLoading = ref(false);
const isContextLoading = ref(false);
const isConsolidating = ref(false);
const isMeetingLoading = ref(false);
const isAssistantLoading = ref(false);
const errorMessage = ref('');
const searchText = ref('');
const includeBelowThreshold = ref(false);
const stateFilter = ref<RadarStateFilter>('all');
const appliedPeopleFilters = ref<{
  search: string;
  state: RadarStateFilter;
  includeBelowThreshold: boolean;
}>({
  search: '',
  state: 'all',
  includeBelowThreshold: false,
});
const peopleResponse = ref<RelationshipPeopleResponse | null>(null);
const selectedPersonId = ref('');
const activeTab = ref<DetailTab>('context');
const contextCard = ref<RelationshipContextCard | null>(null);
const contextIncludeSensitive = ref(false);
const graph = ref<RelationshipGraph | null>(null);
const reviewStatus = ref<ReviewStatusFilter>('pending');
const reviewItems = ref<RelationshipReviewItem[]>([]);
const pendingReviewItems = ref<RelationshipReviewItem[]>([]);
const reviewTotal = ref(0);
const pendingReviewTotal = ref(0);
const reviewDrafts = ref<Record<string, string>>({});
const reviewNoteDrafts = ref<Record<string, string>>({});
const reviewActionLoadingId = ref('');
const copyMessage = ref('');
const consolidationResult = ref<RelationshipConsolidationResult | null>(null);
const meetingTitle = ref('');
const meetingAttendeesText = ref('');
const meetingTitleAutoValue = ref('');
const meetingAttendeesAutoValue = ref('');
const meetingBrief = ref<RelationshipMeetingBrief | null>(null);
const assistantGoal = ref('');
const assistantDraft = ref<RelationshipAssistantDraft | null>(null);
const detailBriefRef = ref<HTMLElement | null>(null);

const stateFilterOptions: Array<{ value: RadarStateFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'core', label: '核心' },
  { value: 'active', label: '活跃' },
  { value: 'rising', label: '升温' },
  { value: 'dormant', label: '沉默' },
  { value: 'watch', label: '候选' },
];

const reviewStatusOptions: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: 'pending', label: '待确认' },
  { value: 'snoozed', label: '稍后' },
  { value: 'confirmed', label: '已确认' },
  { value: 'rejected', label: '已驳回' },
  { value: 'all', label: '全部' },
];

const people = computed(() => peopleResponse.value?.items || []);
const isInitialLoading = computed(() => isLoading.value && !peopleResponse.value);
const hasActivePeopleFilters = computed(
  () =>
    Boolean(appliedPeopleFilters.value.search) ||
    appliedPeopleFilters.value.state !== 'all' ||
    appliedPeopleFilters.value.includeBelowThreshold,
);
const peopleFilterSummary = computed(() => {
  const filters: string[] = [];
  if (appliedPeopleFilters.value.search) {
    filters.push(`搜索：${appliedPeopleFilters.value.search}`);
  }
  if (appliedPeopleFilters.value.state !== 'all') {
    filters.push(`状态：${stateFilterLabel(appliedPeopleFilters.value.state)}`);
  }
  if (appliedPeopleFilters.value.includeBelowThreshold) {
    filters.push('包含低频候选');
  }
  return filters.join(' · ') || '全部人物';
});
const peopleEmptyTitle = computed(() =>
  hasActivePeopleFilters.value ? '当前筛选没有匹配人物' : '暂未发现雷达人物',
);
const peopleEmptyBody = computed(() => {
  if (hasActivePeopleFilters.value) {
    return '可以清空筛选回到全部人物，或打开低频候选检查别名、邮箱和新出现的人物。';
  }
  return '打开候选可查看低频人物；后台整理会在每日 consolidation 后补充更高质量的投影。';
});
const selectedPerson = computed(() =>
  people.value.find((person) => person.id === selectedPersonId.value),
);
const spotlightPerson = computed(() => {
  const candidates = [...people.value];
  candidates.sort((left, right) => spotlightPriority(right) - spotlightPriority(left));
  return candidates[0] || null;
});
const spotlightShortName = computed(() =>
  spotlightPerson.value ? shortPersonName(spotlightPerson.value.name) : '',
);
const spotlightTopic = computed(() => spotlightTopicForPerson(spotlightPerson.value));
const spotlightBody = computed(() => {
  const person = spotlightPerson.value;
  if (!person) {
    return '当 Memory Service 发现高频人物后，会先用 lazy fallback 展示索引级信号，再由后台整理生成更稳定的上下文卡。';
  }
  return compactText(
    person.contextBullets[0] || person.reason || person.description || '近期有高频交互，建议先扫一遍上下文再沟通。',
    168,
  );
});
const selectedShortName = computed(() =>
  selectedPerson.value ? shortPersonName(selectedPerson.value.name) : '',
);
const selectedBriefSummary = computed(() => {
  const person = selectedPerson.value;
  if (!person) return '';
  return compactText(
    person.contextBullets[0] || person.reason || person.description || '这张 brief 会把事实、推断和敏感项拆开，方便沟通前快速扫读。',
    180,
  );
});
const contextActionSuggestions = computed<ContextActionSuggestion[]>(() => {
  const card = contextCard.value;
  if (!card) return [];
  if (card.actionSuggestions && card.actionSuggestions.length > 0) {
    return card.actionSuggestions.slice(0, 4);
  }
  return buildFallbackActionSuggestions(card);
});
const contextQuote = computed(() =>
  compactText(
    contextActionSuggestions.value[0]
      ? `${contextActionSuggestions.value[0].title}：${contextActionSuggestions.value[0].body}`
      : contextCard.value?.bullets[0] ||
      selectedPerson.value?.reason ||
      selectedPerson.value?.description ||
      '上下文卡正在整理，稍后会补齐可追溯证据。',
    240,
  ),
);
const isSpotlightContextLoaded = computed(
  () =>
    Boolean(contextCard.value && spotlightPerson.value) &&
    contextCard.value?.person.id === spotlightPerson.value?.id,
);
const pendingReviewCount = computed(() =>
  Math.max(pendingReviewTotal.value, pendingReviewItems.value.length),
);
const contextHiddenSensitiveCount = computed(() => {
  const summary = contextCard.value?.privacySummary;
  if (!summary) return 0;
  return (
    summary.redactedAliases +
    summary.redactedFacts +
    summary.redactedRelationshipHints +
    summary.redactedEvidenceRefs +
    summary.redactedOpenLoops +
    summary.redactedRetrievalHints
  );
});
const contextPrivacyTitle = computed(() => {
  const summary = contextCard.value?.privacySummary;
  if (summary?.sensitiveIncluded) return '已临时包含敏感上下文';
  if (contextHiddenSensitiveCount.value > 0) return '已隐藏敏感上下文';
  return '默认不含敏感上下文';
});
const contextHiddenSensitiveBreakdown = computed(() => {
  const summary = contextCard.value?.privacySummary;
  if (!summary || summary.sensitiveIncluded) return [];
  return [
    { key: 'aliases', label: '别名', count: summary.redactedAliases },
    { key: 'facts', label: '事实', count: summary.redactedFacts },
    { key: 'relationships', label: '关系', count: summary.redactedRelationshipHints },
    { key: 'evidence', label: '证据', count: summary.redactedEvidenceRefs },
    { key: 'openLoops', label: '跟进', count: summary.redactedOpenLoops },
    { key: 'retrieval', label: '检索', count: summary.redactedRetrievalHints },
  ].filter((item) => item.count > 0);
});
const contextPrivacySummaryText = computed(() => {
  const summary = contextCard.value?.privacySummary;
  if (summary?.sensitiveIncluded) {
    return '这张卡包含敏感事实或证据，复制给外部 AI 前需要人工复核。';
  }
  if (summary?.redactionNote) return summary.redactionNote;
  return '这张卡没有检测到需要默认隐藏的人物上下文。';
});
const contextCopyActionLabel = computed(() =>
  contextCard.value?.privacySummary.sensitiveIncluded
    ? '复制含敏感上下文'
    : '复制当前上下文',
);
const generatedPeopleCount = computed(
  () => people.value.filter((person) => person.projectionSource !== 'lazy').length,
);
const lastConsolidationText = computed(() => {
  if (!consolidationResult.value) return `${generatedPeopleCount.value} 人已有整理投影`;
  return `${consolidationResult.value.skipped} 跳过 · ${formatDate(consolidationResult.value.generatedAt)}`;
});
const tabs = computed<Array<{ value: DetailTab; label: string; badge?: number }>>(() => [
  { value: 'context', label: '上下文卡' },
  { value: 'meeting', label: '会议简报' },
  { value: 'assistant', label: '回复助手' },
  { value: 'graph', label: '关系图谱', badge: graph.value?.nodes.length },
  { value: 'review', label: '人工确认', badge: pendingReviewCount.value },
]);
const graphPeopleNodes = computed(() =>
  (graph.value?.nodes || [])
    .filter((node) => node.type === 'Person')
    .slice(0, 9),
);

onMounted(() => {
  store.clearSearchContext();
  void refreshAll();
});

async function refreshAll() {
  await Promise.all([loadPeople(), loadReviewItems(), loadPendingReviewItems(), loadGraph()]);
}

async function loadPeople() {
  isLoading.value = true;
  errorMessage.value = '';
  const requestFilters = {
    search: searchText.value.trim(),
    state: stateFilter.value,
    includeBelowThreshold: includeBelowThreshold.value,
  };
  try {
    const response = await client.getRelationshipPeople({
      limit: 36,
      state: requestFilters.state,
      search: requestFilters.search || undefined,
      includeBelowThreshold: requestFilters.includeBelowThreshold,
    });
    peopleResponse.value = response;
    appliedPeopleFilters.value = requestFilters;
    const stillSelected = response.items.some(
      (person) => person.id === selectedPersonId.value,
    );
    selectedPersonId.value = stillSelected
      ? selectedPersonId.value
      : response.items[0]?.id || '';
    if (selectedPersonId.value) {
      const person = response.items.find((item) => item.id === selectedPersonId.value);
      syncDefaultInputs(person);
      contextIncludeSensitive.value = false;
      await loadContextCard(selectedPersonId.value);
    } else {
      contextCard.value = null;
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '加载关系雷达失败';
  } finally {
    isLoading.value = false;
  }
}

async function loadContextCard(personId: string) {
  isContextLoading.value = true;
  try {
    contextCard.value = await client.getRelationshipContextCard({
      personId,
      surface: 'memory_exploring_person_tab',
      tokenBudget: 1200,
      includeSensitive: contextIncludeSensitive.value,
    });
  } catch (error: any) {
    errorMessage.value = error?.message || '生成上下文卡失败';
    contextCard.value = null;
  } finally {
    isContextLoading.value = false;
  }
}

async function loadGraph() {
  try {
    graph.value = await client.getRelationshipGraph({ limit: 36 });
  } catch (error: any) {
    errorMessage.value = error?.message || '加载关系图谱失败';
  }
}

async function loadReviewItems() {
  try {
    const response = await client.getRelationshipReviewItems({
      status: reviewStatus.value,
      limit: 24,
    });
    reviewItems.value = response.items;
    reviewTotal.value = response.total;
    syncReviewDrafts(response.items);
  } catch (error: any) {
    errorMessage.value = error?.message || '加载审核项失败';
  }
}

async function loadPendingReviewItems() {
  try {
    const response = await client.getRelationshipReviewItems({
      status: 'pending',
      limit: 6,
    });
    pendingReviewItems.value = response.items;
    pendingReviewTotal.value = response.total;
    syncReviewDrafts(response.items);
  } catch (error: any) {
    errorMessage.value = error?.message || '加载待确认项失败';
  }
}

function syncReviewDrafts(items: RelationshipReviewItem[]) {
  for (const item of items) {
    if (!reviewDrafts.value[item.id]) {
      reviewDrafts.value[item.id] = item.proposedValue;
    }
    if (!reviewNoteDrafts.value[item.id]) {
      reviewNoteDrafts.value[item.id] = item.userNote || '';
    }
  }
}

async function runConsolidation(force: boolean, personId?: string) {
  isConsolidating.value = true;
  errorMessage.value = '';
  try {
    consolidationResult.value = await client.consolidateRelationships({
      limit: 40,
      personIds: force && (personId || selectedPersonId.value)
        ? [personId || selectedPersonId.value]
        : undefined,
      force,
    });
    await refreshAll();
  } catch (error: any) {
    errorMessage.value = error?.message || '后台整理失败';
  } finally {
    isConsolidating.value = false;
  }
}

function setStateFilter(next: RadarStateFilter) {
  stateFilter.value = next;
  void loadPeople();
}

function toggleIncludeBelowThreshold() {
  includeBelowThreshold.value = !includeBelowThreshold.value;
  void loadPeople();
}

function showCandidatePeople() {
  includeBelowThreshold.value = true;
  void loadPeople();
}

function clearPeopleFilters() {
  searchText.value = '';
  stateFilter.value = 'all';
  includeBelowThreshold.value = false;
  void loadPeople();
}

function setReviewStatus(next: ReviewStatusFilter) {
  reviewStatus.value = next;
  void loadReviewItems();
}

function openPendingReviewTab() {
  activeTab.value = 'review';
  if (reviewStatus.value !== 'pending') {
    reviewStatus.value = 'pending';
    void loadReviewItems();
  }
}

function selectPerson(
  person: RelationshipPersonSummary,
  options: { scrollToBrief?: boolean } = {},
) {
  selectedPersonId.value = person.id;
  syncDefaultInputs(person);
  activeTab.value = 'context';
  contextIncludeSensitive.value = false;
  void loadContextCard(person.id);
  if (options.scrollToBrief) {
    void scrollToBrief();
  }
}

function selectPersonById(personId: string) {
  const person = people.value.find((item) => item.id === personId);
  if (person) selectPerson(person, { scrollToBrief: true });
}

function focusSpotlightBrief() {
  const person = spotlightPerson.value;
  if (!person) return;
  if (person.id !== selectedPersonId.value) {
    selectPerson(person, { scrollToBrief: true });
    return;
  }
  activeTab.value = 'context';
  void scrollToBrief();
}

async function scrollToBrief() {
  await nextTick();
  const target = detailBriefRef.value;
  if (!target) return;
  const scrollContainer = target.closest('.main-content') as HTMLElement | null;
  if (scrollContainer) {
    const targetTop = target.getBoundingClientRect().top;
    const containerTop = scrollContainer.getBoundingClientRect().top;
    scrollContainer.scrollTo({
      top: scrollContainer.scrollTop + targetTop - containerTop - 12,
      behavior: 'smooth',
    });
    return;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function syncDefaultInputs(person?: RelationshipPersonSummary) {
  if (!person) return;

  const nextAttendees = person.name;
  const nextTitle = `与 ${person.name} 同步`;
  if (
    !meetingAttendeesText.value.trim() ||
    meetingAttendeesText.value === meetingAttendeesAutoValue.value
  ) {
    meetingAttendeesText.value = nextAttendees;
  }
  if (
    !meetingTitle.value.trim() ||
    meetingTitle.value === meetingTitleAutoValue.value
  ) {
    meetingTitle.value = nextTitle;
  }
  meetingAttendeesAutoValue.value = nextAttendees;
  meetingTitleAutoValue.value = nextTitle;
}

function setContextSensitiveIncluded(next: boolean) {
  contextIncludeSensitive.value = next;
  if (selectedPersonId.value) {
    void loadContextCard(selectedPersonId.value);
  }
}

async function generateMeetingBrief() {
  isMeetingLoading.value = true;
  errorMessage.value = '';
  try {
    meetingBrief.value = await client.getRelationshipMeetingBrief({
      title: meetingTitle.value.trim() || undefined,
      attendees: parseAttendees(meetingAttendeesText.value),
    });
  } catch (error: any) {
    errorMessage.value = error?.message || '生成会议简报失败';
  } finally {
    isMeetingLoading.value = false;
  }
}

async function generateAssistantDraft() {
  if (!selectedPerson.value) return;
  isAssistantLoading.value = true;
  errorMessage.value = '';
  try {
    assistantDraft.value = await client.getRelationshipAssistantDraft({
      personId: selectedPerson.value.id,
      scenario: 'follow_up_message',
      userGoal: assistantGoal.value.trim() || undefined,
    });
  } catch (error: any) {
    errorMessage.value = error?.message || '生成回复草稿失败';
  } finally {
    isAssistantLoading.value = false;
  }
}

async function applyReviewAction(
  item: RelationshipReviewItem,
  action: RelationshipReviewAction,
) {
  reviewActionLoadingId.value = item.id;
  try {
    const snoozeUntil =
      action === 'snooze'
        ? Math.floor(Date.now() / 1000) + 7 * 86400
        : undefined;
    await client.updateRelationshipReviewItem(item.id, action, {
      editedValue: reviewDrafts.value[item.id] || item.proposedValue,
      userNote: reviewNoteDrafts.value[item.id] || undefined,
      snoozeUntil,
    });
    await Promise.all([
      loadReviewItems(),
      loadPendingReviewItems(),
      loadPeople(),
      loadGraph(),
    ]);
  } catch (error: any) {
    errorMessage.value = error?.message || '更新审核项失败';
  } finally {
    reviewActionLoadingId.value = '';
  }
}

function isReviewActionLoading(id: string) {
  return reviewActionLoadingId.value === id;
}

function canActOnReviewItem(item: RelationshipReviewItem) {
  return item.status === 'pending' || item.status === 'snoozed';
}

async function copyContextPackage() {
  if (!contextCard.value) return;
  const message = contextCard.value.privacySummary.sensitiveIncluded
    ? '已复制含敏感上下文，外发前请复核'
    : '已复制上下文包';
  await copyText(contextCard.value.contextMd, message);
}

async function copyAssistantDraft() {
  if (!assistantDraft.value) return;
  await copyText(assistantDraft.value.draftText, '已复制回复草稿');
}

async function copyMeetingBrief() {
  if (!meetingBrief.value) return;
  const brief = meetingBrief.value;
  const omittedAttendees = brief.omittedAttendees || [];
  const lines = [
    `# ${brief.title}`,
    '',
    brief.coverage.coverageNote,
    '',
    `匹配: ${brief.coverage.matchedAttendees}/${brief.coverage.totalAttendees}；证据: ${brief.coverage.evidenceRefs}；需确认: ${brief.coverage.unmatchedAttendees}；身份待核对: ${brief.coverage.identityCheckAttendees || 0}`,
    '',
    `会前准备状态: ${meetingReadinessLabel(brief.readiness.status)}`,
    brief.readiness.summary,
    '',
    '下一步:',
    ...brief.readiness.nextActions.map((action) => `- ${action}`),
    '',
    '成功标准:',
    ...brief.readiness.successCriteria.map((criterion) => `- ${criterion}`),
    '',
  ];

  if (brief.coverage.omittedAttendees > 0) {
    lines.push(
      `已分析: ${brief.coverage.processedAttendees}/${brief.coverage.totalAttendees}；未分析: ${brief.coverage.omittedAttendees}`,
      '未展开参会人:',
      ...omittedAttendees.map((attendee) =>
        `- ${attendee.displayName}${attendee.email ? ` <${attendee.email}>` : ''}: ${attendee.reason}`,
      ),
      '',
    );
  }

  for (const attendee of brief.attendees) {
    lines.push(
      `## ${attendee.personName || attendee.displayName}`,
      `- 匹配: ${attendee.matchReason} (${Math.round(attendee.matchConfidence * 100)}%)`,
      `- 状态: ${meetingCoverageLabel(attendee.coverageState)}`,
      `- 上下文: ${attendee.summary}`,
    );
    if (attendee.openLoops[0]) {
      lines.push(`- Open loop: ${attendee.openLoops[0].snippet}`);
    }
    if (attendee.identityCheckRequired) {
      lines.push(
        `- 身份核对: ${attendee.identityCheckReason || '这个匹配需要先核对身份，再使用历史上下文。'}`,
      );
    }
    if (attendee.suggestedQuestions[0]) {
      lines.push(`- 建议问法: ${attendee.suggestedQuestions[0]}`);
    }
    lines.push('');
  }

  await copyText(lines.join('\n'), '已复制会议简报');
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    showToast('当前环境无法写入剪贴板');
  }
}

function openEvidence(evidence: RelationshipEvidenceRef) {
  const exploreRoute = sanitizeExploreRoute(evidence.exploreLink);
  if (exploreRoute) {
    void router.push(exploreRoute.slice(1));
    return;
  }
  const sourceUrl = sanitizeContextExternalUrl(evidence.sourceUrl);
  if (sourceUrl) {
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  showToast('证据链接不可打开或已被安全策略拦截');
}

function showToast(message: string) {
  copyMessage.value = message;
  window.setTimeout(() => {
    if (copyMessage.value === message) {
      copyMessage.value = '';
    }
  }, 2200);
}

function parseAttendees(text: string): Array<{ name: string; email?: string }> {
  return text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s*<([^>]+)>$/);
      if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
      }
      return { name: line };
    });
}

function formatPercent(value: number | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function formatDate(timestamp?: number) {
  if (!timestamp) return '未知时间';
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function stateLabel(state: RelationshipRadarState) {
  const labels: Record<RelationshipRadarState, string> = {
    core: '核心',
    active: '活跃',
    rising: '升温',
    dormant: '沉默',
    watch: '候选',
  };
  return labels[state];
}

function stateFilterLabel(state: RadarStateFilter) {
  if (state === 'all') return '全部';
  return stateLabel(state);
}

function qualityLabel(quality: RelationshipDataQuality | undefined) {
  const labels: Record<RelationshipDataQuality, string> = {
    indexed: '索引级',
    generated: '后台整理',
    confirmed: '已确认',
    stale: '待刷新',
  };
  return quality ? labels[quality] : '未知';
}

function reviewStatusLabel(status: RelationshipReviewStatus) {
  const labels: Record<RelationshipReviewStatus, string> = {
    pending: '待确认',
    confirmed: '已确认',
    rejected: '已驳回',
    snoozed: '稍后',
  };
  return labels[status];
}

function toneForPerson(person: RelationshipPersonSummary) {
  if (person.reviewPendingCount > 0) return 'tone-hot';
  if (person.dataQuality === 'confirmed' || person.dataQuality === 'generated') {
    return 'tone-calm';
  }
  return person.radarState === 'dormant' ? 'tone-quiet' : 'tone-warn';
}

function stateTone(state: RelationshipRadarState) {
  const tones: Record<RelationshipRadarState, string> = {
    core: 'blue',
    active: 'ok',
    rising: 'warn',
    dormant: 'muted',
    watch: 'muted',
  };
  return tones[state];
}

function qualityTone(quality: RelationshipDataQuality | undefined) {
  if (quality === 'confirmed') return 'ok';
  if (quality === 'generated') return 'blue';
  if (quality === 'stale') return 'warn';
  return 'muted';
}

function suggestionTone(tone: ContextActionSuggestion['tone']) {
  const tones: Record<ContextActionSuggestion['tone'], string> = {
    hot: 'hot',
    warn: 'warn',
    ok: 'ok',
    muted: 'muted',
  };
  return tones[tone];
}

function suggestionToneLabel(tone: ContextActionSuggestion['tone']) {
  const labels: Record<ContextActionSuggestion['tone'], string> = {
    hot: '优先',
    warn: '确认',
    ok: '可用',
    muted: '轻量',
  };
  return labels[tone];
}

function reviewTone(status: RelationshipReviewStatus) {
  const tones: Record<RelationshipReviewStatus, string> = {
    pending: 'warn',
    confirmed: 'ok',
    rejected: 'muted',
    snoozed: 'blue',
  };
  return tones[status];
}

function priorityLabel(priority: string) {
  if (priority === 'high') return '高优先级';
  if (priority === 'low') return '低优先级';
  return '普通优先级';
}

function priorityTone(priority: string) {
  if (priority === 'high') return 'warn';
  if (priority === 'low') return 'muted';
  return 'blue';
}

function formatConfidence(value: number | undefined) {
  return `置信度 ${Math.round((value ?? 0) * 100)}%`;
}

function formatReviewDue(item: RelationshipReviewItem) {
  if (item.status === 'snoozed' && item.snoozeUntil) {
    return `稍后至 ${formatDateTime(item.snoozeUntil)}`;
  }
  if (item.confirmedAt) return `确认于 ${formatDateTime(item.confirmedAt)}`;
  if (item.rejectedAt) return `驳回于 ${formatDateTime(item.rejectedAt)}`;
  return '';
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function compactText(text: string | undefined, maxLength = 180) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function shortPersonName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function personCardSummary(person: RelationshipPersonSummary) {
  return compactText(
    person.contextBullets[0] || person.reason || person.description || '等待后台整理补齐关系上下文。',
    112,
  );
}

function spotlightPriority(person: RelationshipPersonSummary) {
  const stateWeight: Record<RelationshipRadarState, number> = {
    core: 80,
    rising: 70,
    active: 58,
    watch: 38,
    dormant: 24,
  };
  const qualityWeight: Partial<Record<RelationshipDataQuality, number>> = {
    stale: 36,
    indexed: 18,
    generated: 10,
    confirmed: 4,
  };
  return (
    person.reviewPendingCount * 120 +
    stateWeight[person.radarState] +
    (qualityWeight[person.dataQuality] || 0) +
    person.signals.recent * 35 +
    Math.min(person.interactionCount, 80) * 0.35 +
    Math.min(person.activeDays, 45) * 0.7 +
    person.score * 25
  );
}

function spotlightTopicForPerson(person: RelationshipPersonSummary | null) {
  if (!person) return '人物关系投影';
  if (person.reviewPendingCount > 0) return '关系事实确认';
  if (person.radarState === 'rising') return '近期协作升温';
  if (person.radarState === 'dormant' || person.dataQuality === 'stale') {
    return '关系上下文刷新';
  }
  if (person.radarState === 'core') return '高频协作上下文';
  return '近期协作上下文';
}

function buildFallbackActionSuggestions(
  card: RelationshipContextCard,
): ContextActionSuggestion[] {
  const suggestions: ContextActionSuggestion[] = [];
  const firstOpenLoop = card.openLoops[0];
  const strongRelationships = card.relationshipHints
    .filter((hint) => hint.strength >= 0.45)
    .slice(0, 3);
  const unconfirmedFacts = card.knownFacts.filter((fact) => !fact.confirmed);
  const confirmedFacts = card.knownFacts.filter((fact) => fact.confirmed);

  if (firstOpenLoop) {
    suggestions.push({
      title: `先闭环：${compactText(firstOpenLoop.title, 34)}`,
      body:
        `${compactText(firstOpenLoop.snippet, 96)}。沟通前先确认 owner、下一步或是否已经关闭，避免把旧 open loop 带进新对话。`,
      tone: 'hot',
      reason: `来自 ${formatDate(firstOpenLoop.timestamp)} 的未闭环线索`,
      evidenceRef: firstOpenLoop.evidenceRef,
    });
  }

  if (strongRelationships.length > 0) {
    const names = strongRelationships.map((hint) => hint.targetName).join('、');
    suggestions.push({
      title: '带着关联对象一起判断',
      body:
        `${card.person.name} 的上下文经常和 ${names} 一起出现。推进相关事项前，先确认这些对象的 owner、边界或依赖是否仍成立。`,
      tone: firstOpenLoop ? 'warn' : 'hot',
      reason: `关系图谱中有 ${strongRelationships.length} 条较强关联边`,
      evidenceRef: firstOpenLoop?.evidenceRef,
    });
  }

  if (unconfirmedFacts.length > 0) {
    const fact = unconfirmedFacts[0];
    suggestions.push({
      title: '把推断升级成可用事实',
      body:
        `系统推断了「${compactText(`${fact.key}: ${fact.value}`, 96)}」，但还没有确认。建议先核对后再用于强个性化检索。`,
      tone: 'warn',
      reason: `${unconfirmedFacts.length} 条人物事实仍待确认`,
    });
  } else if (confirmedFacts.length > 0) {
    suggestions.push({
      title: '可直接用于沟通前准备',
      body:
        `已有 ${confirmedFacts.length} 条确认事实。生成回复或会议 brief 时，可以优先带入这些事实，但仍要保留证据入口。`,
      tone: 'ok',
      reason: '存在用户确认过的人物画像信息',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: '先轻量确认，不要过度个性化',
      body:
        card.person.radarState === 'dormant'
          ? '近期互动偏少，先看最新证据再恢复上下文。'
          : '当前主要是交互统计，还缺少明确事项。下一次沟通先确认对方当前关注点，再决定是否写入画像。',
      tone: card.person.radarState === 'dormant' ? 'muted' : 'warn',
      reason: '缺少明确 open loop 或已确认事实',
    });
  }

  if (card.person.radarState === 'core' && suggestions.length < 4) {
    suggestions.push({
      title: '高频关系要维护上下文连续性',
      body:
        `${card.person.name} 是高频人物。每次重要沟通前建议先扫 30 秒 brief，把最近未闭环、不要假设和确认事实都带上。`,
      tone: 'ok',
      reason: `${card.person.interactionCount} 次交互，覆盖 ${card.person.activeDays} 个活跃日`,
    });
  }

  return suggestions.slice(0, 4);
}

function evidenceLabel(evidence: RelationshipEvidenceRef) {
  const labels: Record<RelationshipEvidenceRef['sourceKind'], string> = {
    message: '消息证据',
    entity_property: '人物事实',
    relationship: '关系边',
  };
  return labels[evidence.sourceKind] || '证据';
}

function meetingCoverageLabel(
  state: RelationshipMeetingBrief['attendees'][number]['coverageState'],
) {
  const labels: Record<
    RelationshipMeetingBrief['attendees'][number]['coverageState'],
    string
  > = {
    ready: '证据就绪',
    thin: '上下文较薄',
    missing: '未匹配',
  };
  return labels[state];
}

function meetingCoverageTone(
  state: RelationshipMeetingBrief['attendees'][number]['coverageState'],
) {
  const tones: Record<
    RelationshipMeetingBrief['attendees'][number]['coverageState'],
    string
  > = {
    ready: 'ok',
    thin: 'warn',
    missing: 'danger',
  };
  return tones[state];
}

function meetingReadinessLabel(status: RelationshipMeetingBrief['readiness']['status']) {
  const labels: Record<RelationshipMeetingBrief['readiness']['status'], string> = {
    ready: '准备就绪',
    partial: '部分就绪',
    attention: '需要补齐',
    empty: '缺少参会人',
  };
  return labels[status];
}

function meetingReadinessTone(status: RelationshipMeetingBrief['readiness']['status']) {
  const tones: Record<RelationshipMeetingBrief['readiness']['status'], string> = {
    ready: 'ready',
    partial: 'partial',
    attention: 'attention',
    empty: 'empty',
  };
  return tones[status];
}

function matchLabel(matchedBy: RelationshipMeetingBrief['attendees'][number]['matchedBy']) {
  const labels: Record<RelationshipMeetingBrief['attendees'][number]['matchedBy'], string> = {
    name: '显示名',
    alias: '别名',
    email: '邮箱',
    email_local_part: '邮箱前缀',
    none: '未匹配',
  };
  return labels[matchedBy];
}

function matchTone(matchedBy: RelationshipMeetingBrief['attendees'][number]['matchedBy']) {
  if (matchedBy === 'none') return 'danger';
  if (matchedBy === 'email_local_part') return 'warn';
  if (matchedBy === 'email') return 'ok';
  return 'blue';
}

function graphNodeStyle(index: number, total: number) {
  const radius = 38;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius;
  return {
    left: `${x}%`,
    top: `${y}%`,
  };
}

function edgeLabel(nodeId: string) {
  return graph.value?.nodes.find((node) => node.id === nodeId)?.label || nodeId;
}
</script>

<style scoped>
.relationship-radar-page {
  --bg-deep: #07080f;
  --bg-mid: #0f1729;
  --ink: #f1f5f9;
  --ink-mid: #cbd5e1;
  --ink-low: #94a3b8;
  --ink-quiet: #64748b;
  --line: rgba(148, 163, 184, 0.12);
  --line-strong: rgba(148, 163, 184, 0.2);
  --glass: rgba(15, 23, 42, 0.55);
  --glass-soft: rgba(15, 23, 42, 0.36);
  --accent: #60a5fa;
  --accent-2: #a78bfa;
  --accent-soft: rgba(96, 165, 250, 0.14);
  --accent-line: rgba(96, 165, 250, 0.32);
  --accent-glow: rgba(96, 165, 250, 0.45);
  --warn: #f59e0b;
  --warn-soft: rgba(245, 158, 11, 0.12);
  --warn-line: rgba(245, 158, 11, 0.32);
  --danger: #ef4444;
  --danger-soft: rgba(239, 68, 68, 0.12);
  --danger-line: rgba(239, 68, 68, 0.32);
  --ok: #22c55e;
  --ok-soft: rgba(34, 197, 94, 0.12);
  --ok-line: rgba(34, 197, 94, 0.32);
  --radius-lg: 20px;
  --radius-md: 14px;
  --radius-sm: 10px;
  --shadow-soft: 0 12px 40px rgba(8, 14, 32, 0.4);
  --shadow-strong: 0 24px 80px rgba(7, 12, 28, 0.55);
  min-height: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px clamp(20px, 4vw, 40px) 80px;
  color: var(--ink);
  background:
    radial-gradient(1200px 600px at 12% -10%, rgba(96, 165, 250, 0.18), transparent 60%),
    radial-gradient(900px 500px at 95% 5%, rgba(167, 139, 250, 0.16), transparent 65%),
    radial-gradient(700px 500px at 50% 110%, rgba(45, 212, 191, 0.1), transparent 60%),
    linear-gradient(180deg, #07080f 0%, #0c1124 45%, #0f1733 100%);
  overflow-x: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 8px 0 28px;
  flex-wrap: wrap;
}

.brand,
.top-actions,
.spotlight-meta,
.spotlight-actions,
.detail-actions,
.legend,
.greeting-line,
.section-title,
.section-tools,
.review-actions {
  display: flex;
  align-items: center;
}

.brand {
  gap: 14px;
  min-width: 0;
}

.brand-mark,
.avatar,
.stat-icon,
.panel-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 13px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6 62%, #ec4899);
  box-shadow:
    0 6px 24px rgba(99, 102, 241, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 18px;
  font-weight: 800;
}

.brand-text h2,
.spotlight h2,
.detail-name h2,
.section-title h3,
.panel-head h4,
.side-head h4,
p {
  margin: 0;
}

.brand-text h2 {
  font-size: 17px;
  line-height: 1.2;
  letter-spacing: 0;
}

.brand-text span,
.section-title span,
.greeting-line span,
.legend,
.muted-line {
  color: #94a3b8;
}

.brand-text span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
}

.top-actions {
  gap: 10px;
  flex-wrap: wrap;
}

.search {
  position: relative;
  width: clamp(220px, 32vw, 380px);
}

.search input,
.tool-form input,
.tool-form textarea,
.review-card textarea {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.58);
  color: #f8fafc;
  outline: none;
}

.search input {
  height: 40px;
  padding: 0 38px 0 76px;
  font-size: 13.5px;
}

.search input:focus,
.tool-form input:focus,
.tool-form textarea:focus,
.review-card textarea:focus {
  border-color: rgba(96, 165, 250, 0.55);
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.12);
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

button {
  font: inherit;
}

.ghost-btn,
.pill-btn,
.spotlight-actions button,
.section-tools button,
.side-head button {
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.56);
  color: #e2e8f0;
  cursor: pointer;
  font-weight: 700;
  transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
}

.ghost-btn,
.pill-btn {
  min-height: 40px;
  padding: 0 16px;
  font-size: 13px;
}

.ghost-btn:hover,
.pill-btn:hover,
.spotlight-actions button:hover,
.section-tools button:hover,
.side-head button:hover {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(20, 32, 60, 0.72);
  transform: translateY(-1px);
}

.ghost-btn:disabled,
.pill-btn:disabled,
.spotlight-actions button:disabled,
.tiny-btn:disabled {
  cursor: not-allowed;
  opacity: 0.56;
  transform: none;
}

.pill-btn.primary,
.spotlight-actions .primary {
  border-color: transparent;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  box-shadow: 0 0.55rem 1.75rem rgba(99, 102, 241, 0.32);
}

.error-banner {
  margin-bottom: 1rem;
  border: 1px solid rgba(239, 68, 68, 0.38);
  border-radius: 0.75rem;
  background: rgba(127, 29, 29, 0.25);
  color: #fecaca;
  padding: 0.8rem 1rem;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 18px;
  margin-bottom: 22px;
}

.greeting-strip {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.greeting-line {
  gap: 10px;
  color: var(--ink-mid);
  font-size: 13px;
}

.greeting-line i,
.legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0.8rem rgba(34, 197, 94, 0.55);
}

.legend {
  gap: 14px;
  font-size: 12px;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.legend i.hot {
  background: #ef4444;
  box-shadow: 0 0 0.8rem rgba(239, 68, 68, 0.5);
}

.legend i.warn {
  background: #f59e0b;
  box-shadow: 0 0 0.8rem rgba(245, 158, 11, 0.5);
}

.legend i.calm {
  background: #22c55e;
}

.spotlight,
.stat-card,
.person-card,
.detail-main,
.side-panel {
  border: 1px solid var(--line);
  background: var(--glass);
  backdrop-filter: blur(18px);
}

.spotlight {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  padding: 26px 26px 22px;
  background:
    radial-gradient(600px 300px at 10% 0%, rgba(239, 68, 68, 0.18), transparent 60%),
    radial-gradient(500px 280px at 100% 100%, rgba(167, 139, 250, 0.18), transparent 65%),
    linear-gradient(135deg, rgba(20, 30, 60, 0.85), rgba(15, 23, 42, 0.7));
  border-color: rgba(239, 68, 68, 0.22);
  box-shadow: var(--shadow-strong);
}

.spotlight::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--danger), transparent);
  opacity: 0.55;
}

.spotlight-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--danger-line);
  border-radius: 99px;
  background: var(--danger-soft);
  color: #fca5a5;
  padding: 5px 12px 5px 10px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.spotlight-tag::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 8px var(--danger);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.4); }
}

.spotlight h2 {
  margin: 14px 0 10px;
  font-size: 26px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: 0;
}

.spotlight h2 em {
  background: linear-gradient(135deg, #93c5fd, #c4b5fd);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-style: normal;
}

.spotlight-body {
  max-width: 56ch;
  margin: 0 0 18px;
  color: var(--ink-mid);
  font-size: 14px;
  line-height: 1.65;
}

.spotlight-meta,
.spotlight-actions {
  gap: 10px;
  flex-wrap: wrap;
}

.spotlight-meta {
  gap: 8px 14px;
  margin-bottom: 18px;
  color: var(--ink-low);
  font-size: 12.5px;
}

.spotlight-actions button {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

.stat-strip {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border-radius: var(--radius-md);
  padding: 16px 18px;
  box-shadow: var(--shadow-soft);
}

.stat-card .label {
  display: block;
  color: var(--ink-low);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.stat-card strong {
  display: block;
  margin-top: 4px;
  font-size: 22px;
  letter-spacing: 0;
}

.stat-card small {
  display: block;
  margin-top: 4px;
  color: var(--ink-low);
  line-height: 1.35;
}

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 800;
}

.stat-icon.warn {
  background: rgba(245, 158, 11, 0.12);
  color: #fcd34d;
}

.stat-icon.purple {
  background: rgba(167, 139, 250, 0.14);
  color: #c4b5fd;
}

.section {
  margin-bottom: 22px;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.section-title {
  gap: 10px;
}

.section-title h3 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
}

.section-title.stacked {
  display: grid;
  align-items: start;
  gap: 4px;
}

.section-title .sub {
  color: var(--ink-low);
  font-size: 12.5px;
}

.section-tools,
.review-filter {
  display: inline-flex;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--glass-soft);
  padding: 4px;
  flex-wrap: wrap;
}

.section-tools button,
.review-filter button {
  min-height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 0 12px;
  color: var(--ink-low);
  font-size: 12.5px;
  font-weight: 600;
}

.section-tools button.active,
.review-filter button.active {
  border-color: transparent;
  background: rgba(96, 165, 250, 0.18);
  color: #93c5fd;
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.32);
}

.section-tools button.copy-context-action {
  border: 1px solid rgba(96, 165, 250, 0.28);
  background: rgba(59, 130, 246, 0.12);
  color: #bfdbfe;
}

.section-tools button:disabled,
.review-filter button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.filter-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: -0.2rem 0 0.85rem;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 0.85rem;
  background: rgba(96, 165, 250, 0.08);
  padding: 0.75rem 0.85rem;
  flex-wrap: wrap;
}

.filter-summary div:first-child {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.filter-summary span {
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 800;
}

.filter-summary strong {
  color: #e2e8f0;
  font-size: 0.84rem;
  overflow-wrap: anywhere;
}

.filter-actions,
.empty-actions {
  display: inline-flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.radar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.person-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 170px;
  padding: 18px;
  border-radius: var(--radius-md);
  color: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.person-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  border-radius: inherit 0 0 inherit;
  background: #94a3b8;
  opacity: 0.45;
}

.person-card.tone-hot::before {
  background: #ef4444;
  opacity: 1;
}

.person-card.tone-warn::before {
  background: #f59e0b;
  opacity: 1;
}

.person-card.tone-calm::before {
  background: #22c55e;
  opacity: 0.9;
}

.person-card.tone-quiet::before {
  background: var(--ink-low);
  opacity: 0.45;
}

.person-card:hover {
  border-color: var(--accent-line);
  background: rgba(20, 32, 60, 0.7);
  transform: translateY(-3px);
}

.person-card.active {
  border-color: var(--accent);
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.16), rgba(167, 139, 250, 0.12));
  box-shadow:
    0 12px 40px rgba(96, 165, 250, 0.18),
    inset 0 0 0 1px rgba(96, 165, 250, 0.4);
}

.person-card.active::after {
  content: '';
  position: absolute;
  top: 14px;
  right: 14px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}

.person-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.avatar.large {
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 1rem;
  font-size: 1.25rem;
}

.avatar.g-2 { background: linear-gradient(135deg, #f97316, #ec4899); }
.avatar.g-3 { background: linear-gradient(135deg, #06b6d4, #6366f1); }
.avatar.g-4 { background: linear-gradient(135deg, #14b8a6, #3b82f6); }
.avatar.g-5 { background: linear-gradient(135deg, #a855f7, #ec4899); }

.person-name {
  min-width: 0;
  flex: 1;
}

.person-name strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person-name span {
  display: block;
  margin-top: 2px;
  color: var(--ink-low);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.person-headline {
  color: var(--ink-mid);
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  min-height: calc(1.5em * 2);
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.person-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  border-top: 1px dashed var(--line);
  padding-top: 8px;
  color: var(--ink-low);
  font-size: 11.5px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line-strong);
  border-radius: 99px;
  background: rgba(15, 23, 42, 0.55);
  color: var(--ink-mid);
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.chip.hot,
.chip.danger {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
}

.chip.warn {
  border-color: rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.12);
  color: #fcd34d;
}

.chip.ok {
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.12);
  color: #86efac;
}

.chip.blue {
  border-color: rgba(96, 165, 250, 0.35);
  background: rgba(96, 165, 250, 0.13);
  color: #bfdbfe;
}

.chip.muted {
  color: #94a3b8;
}

.detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  scroll-margin-top: 18px;
}

.detail-main,
.side-panel {
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-soft);
}

.detail-hero {
  position: relative;
  padding: 24px 26px 20px;
  border-bottom: 1px solid var(--line);
  background:
    radial-gradient(460px 240px at 0 0, rgba(96, 165, 250, 0.16), transparent 64%),
    radial-gradient(360px 220px at 100% 100%, rgba(167, 139, 250, 0.14), transparent 64%);
}

.detail-hero-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
}

.detail-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.detail-name h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0;
}

.detail-name p {
  margin-top: 6px;
  max-width: 60ch;
  color: var(--ink-low);
  font-size: 13px;
  line-height: 1.5;
}

.detail-actions {
  gap: 0.5rem;
  align-self: flex-start;
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.detail-metric {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.6);
  padding: 12px 14px;
}

.detail-metric span {
  display: block;
  color: var(--ink-low);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.detail-metric strong {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  letter-spacing: 0;
}

.detail-metric i {
  display: block;
  height: 4px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(148, 163, 184, 0.14);
}

.detail-metric i::before {
  content: '';
  display: block;
  width: var(--pct, 0);
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
}

.tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.35);
  padding: 8px 14px 0;
}

.tabs button {
  position: relative;
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--ink-low);
  cursor: pointer;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.tabs button.active {
  color: var(--ink);
}

.tabs button.active::after {
  content: '';
  position: absolute;
  left: 0.7rem;
  right: 0.7rem;
  bottom: -1px;
  height: 2px;
  border-radius: 99px;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
}

.badge {
  margin-left: 0.35rem;
  border-radius: 99px;
  background: rgba(96, 165, 250, 0.18);
  color: #bfdbfe;
  padding: 0.05rem 0.42rem;
  font-size: 0.7rem;
}

.tab-content {
  padding: 22px 26px 26px;
}

.quote {
  position: relative;
  margin-bottom: 18px;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.1), rgba(167, 139, 250, 0.08));
  padding: 16px 18px;
  color: var(--ink);
  font-size: 14.5px;
  line-height: 1.7;
}

.quote::before {
  content: '"';
  position: absolute;
  left: 14px;
  top: 4px;
  color: rgba(167, 139, 250, 0.5);
  font-size: 36px;
  font-family: Georgia, serif;
}

.quote-body {
  padding-left: 24px;
}

.action-suggestions {
  margin-bottom: 18px;
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 14px;
  background:
    radial-gradient(420px 180px at 8% 0%, rgba(96, 165, 250, 0.12), transparent 66%),
    rgba(15, 23, 42, 0.5);
  overflow: hidden;
}

.action-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.42);
  padding: 12px 14px;
}

.action-head span {
  display: block;
  color: var(--ink-low);
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.action-head strong {
  display: block;
  margin-top: 3px;
  color: var(--ink);
  font-size: 14px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15.5rem, 1fr));
  gap: 12px;
  padding: 14px;
}

.action-card {
  position: relative;
  display: grid;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(8, 14, 32, 0.46);
  padding: 14px;
  overflow: hidden;
}

.action-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--ink-low);
  opacity: 0.45;
}

.action-card.hot::before {
  background: var(--danger);
  opacity: 1;
}

.action-card.warn::before {
  background: var(--warn);
  opacity: 1;
}

.action-card.ok::before {
  background: var(--ok);
  opacity: 0.9;
}

.action-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.action-card-title strong {
  color: var(--ink);
  font-size: 13.5px;
  line-height: 1.35;
}

.action-card p {
  color: var(--ink-mid);
  font-size: 13px;
  line-height: 1.6;
}

.action-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  border-top: 1px dashed var(--line);
  padding-top: 10px;
}

.action-card-foot span {
  color: var(--ink-low);
  font-size: 11.5px;
}

.privacy-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin: 0 0 0.9rem;
  border: 1px solid rgba(34, 197, 94, 0.22);
  border-radius: 0.8rem;
  background: rgba(34, 197, 94, 0.08);
  padding: 0.75rem 0.85rem;
}

.privacy-strip.warn {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(245, 158, 11, 0.08);
}

.privacy-strip strong {
  color: #f8fafc;
}

.privacy-strip p {
  margin: 0.18rem 0 0;
  color: #cbd5e1;
  font-size: 0.78rem;
  line-height: 1.45;
}

.privacy-breakdown {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.55rem;
}

.privacy-breakdown span {
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.42);
  color: #bbf7d0;
  padding: 0.16rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.panel {
  border: 1px solid rgba(148, 163, 184, 0.13);
  border-radius: 0.9rem;
  background: rgba(15, 23, 42, 0.48);
  overflow: hidden;
}

.panel.full {
  grid-column: 1 / -1;
}

.panel-head,
.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  padding: 0.75rem 0.85rem;
}

.panel-head h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.86rem;
}

.panel-head > span {
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 800;
}

.panel-icon {
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 0.48rem;
  background: rgba(96, 165, 250, 0.13);
  color: #93c5fd;
  font-size: 0.72rem;
  font-weight: 800;
}

.panel-icon.warn { background: rgba(245, 158, 11, 0.12); color: #fcd34d; }
.panel-icon.danger { background: rgba(239, 68, 68, 0.12); color: #fca5a5; }
.panel-icon.ok { background: rgba(34, 197, 94, 0.12); color: #86efac; }
.panel-icon.purple { background: rgba(167, 139, 250, 0.14); color: #c4b5fd; }

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem;
}

.item,
.timeline-item,
.review-card,
.side-review,
.edge-row {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.72rem;
  background: rgba(8, 14, 32, 0.45);
  padding: 0.75rem;
}

.item-row,
.relation-item,
.edge-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.item p,
.timeline-item p,
.review-card p,
.side-review p,
.graph-dynamic p {
  margin-top: 0.35rem;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.55;
}

.relation-item > span {
  color: #bfdbfe;
  font-weight: 800;
}

.timeline-item {
  width: 100%;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.timeline-item span {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  margin-bottom: 0.25rem;
}

.boost-cloud {
  flex-direction: row;
  flex-wrap: wrap;
}

.markdown-panel summary {
  cursor: pointer;
  padding: 0.9rem;
  color: #bfdbfe;
  font-weight: 800;
}

.markdown-panel pre {
  margin: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding: 0.9rem;
  color: #cbd5e1;
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.55;
}

.tool-form {
  display: grid;
  gap: 0.85rem;
  margin-bottom: 1rem;
}

.tool-form label {
  display: grid;
  gap: 0.35rem;
  color: #cbd5e1;
  font-size: 0.82rem;
  font-weight: 800;
}

.tool-form input,
.tool-form textarea,
.review-card textarea {
  resize: vertical;
  padding: 0.75rem;
  line-height: 1.55;
}

.brief-coverage {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  padding: 0.85rem 0.85rem 0;
}

.coverage-card {
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 0.72rem;
  background: rgba(96, 165, 250, 0.08);
  padding: 0.75rem;
}

.coverage-card.warn {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(245, 158, 11, 0.08);
}

.coverage-card.muted {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(148, 163, 184, 0.08);
}

.coverage-card span {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 800;
}

.coverage-card strong {
  display: block;
  margin-top: 0.25rem;
  color: #f8fafc;
  font-size: 1.3rem;
}

.coverage-note {
  grid-column: 1 / -1;
  margin: 0;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.72rem;
  background: rgba(8, 14, 32, 0.36);
  color: #cbd5e1;
  padding: 0.75rem;
  line-height: 1.55;
}

.coverage-omitted {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  border: 1px dashed rgba(148, 163, 184, 0.18);
  border-radius: 0.72rem;
  background: rgba(15, 23, 42, 0.34);
  padding: 0.65rem 0.75rem;
}

.coverage-omitted strong {
  color: #e2e8f0;
  font-size: 0.78rem;
}

.coverage-omitted span {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
  color: #cbd5e1;
  padding: 0.22rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
}

.coverage-omitted small {
  color: #94a3b8;
  font-size: inherit;
  font-weight: 700;
}

.brief-readiness {
  display: grid;
  gap: 0.75rem;
  margin: 0.85rem 0.85rem 0;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 0.72rem;
  background: rgba(8, 14, 32, 0.46);
  padding: 0.85rem;
}

.brief-readiness.ready {
  border-color: rgba(34, 197, 94, 0.24);
}

.brief-readiness.partial {
  border-color: rgba(96, 165, 250, 0.24);
}

.brief-readiness.attention {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(39, 27, 10, 0.34);
}

.brief-readiness.empty {
  border-color: rgba(148, 163, 184, 0.22);
}

.brief-readiness-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.brief-readiness-head span,
.brief-readiness-grid strong {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 800;
}

.brief-readiness-head strong {
  display: block;
  margin-top: 0.2rem;
  color: #f8fafc;
  font-size: 1rem;
}

.brief-readiness-head p,
.brief-readiness-grid p {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.55;
}

.brief-readiness-head p {
  max-width: 34rem;
}

.brief-readiness-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.brief-readiness-grid section {
  display: grid;
  gap: 0.4rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.65rem;
  background: rgba(15, 23, 42, 0.36);
  padding: 0.7rem;
}

.attendee-brief-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  gap: 0.75rem;
  padding: 0.85rem;
}

.attendee-brief-card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.82rem;
  background: rgba(8, 14, 32, 0.42);
  padding: 0.85rem;
}

.attendee-brief-card.ready {
  border-color: rgba(34, 197, 94, 0.24);
}

.attendee-brief-card.thin {
  border-color: rgba(245, 158, 11, 0.24);
}

.attendee-brief-card.missing {
  border-color: rgba(239, 68, 68, 0.24);
}

.attendee-brief-head,
.match-row,
.evidence-actions {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.attendee-brief-head {
  justify-content: space-between;
}

.attendee-brief-head strong,
.brief-subsection strong {
  display: block;
  color: #f8fafc;
}

.attendee-brief-head span,
.match-row,
.brief-subsection {
  color: #94a3b8;
  font-size: 0.78rem;
}

.attendee-brief-card > p {
  color: #cbd5e1;
  line-height: 1.55;
}

.identity-check-note {
  margin: 0;
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 0.65rem;
  background: rgba(245, 158, 11, 0.08);
  color: #fde68a;
  padding: 0.55rem 0.65rem;
  line-height: 1.5;
}

.match-row {
  align-items: center;
}

.brief-subsection {
  display: grid;
  gap: 0.45rem;
}

.brief-evidence {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.65rem;
  background: rgba(15, 23, 42, 0.46);
  color: inherit;
  cursor: pointer;
  padding: 0.6rem;
  text-align: left;
}

.brief-evidence span {
  color: #94a3b8;
  font-size: 0.7rem;
}

.brief-evidence p,
.question-line {
  margin: 0.25rem 0 0;
  color: #cbd5e1;
  line-height: 1.45;
}

.evidence-actions {
  margin-top: auto;
}

.matrix-details {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.matrix-details summary {
  cursor: pointer;
  padding: 0.85rem;
  color: #bfdbfe;
  font-weight: 800;
}

.matrix {
  padding: 0.85rem;
}

.matrix-head,
.matrix-row {
  display: grid;
  grid-template-columns: 0.75fr 1fr 1.2fr 1.2fr;
  gap: 0.75rem;
  align-items: start;
}

.matrix-head {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0 0 0.5rem;
}

.matrix-row {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding: 0.75rem 0;
}

.matrix-row p {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.45;
  font-size: 0.8rem;
}

.draft-box {
  margin: 0.85rem;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 0.75rem;
  background: rgba(8, 14, 32, 0.5);
  color: #e2e8f0;
  white-space: pre-wrap;
  line-height: 1.7;
  padding: 0.9rem;
}

.warning-list {
  margin: 0 0.85rem 0.85rem;
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: 0.75rem;
  background: rgba(245, 158, 11, 0.08);
  padding: 0.8rem;
}

.warning-list p {
  margin: 0.35rem 0 0;
  color: #fcd34d;
  line-height: 1.5;
}

.graph-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(17rem, 0.9fr);
  gap: 1rem;
}

.graph-canvas {
  position: relative;
  min-height: 26rem;
  border: 1px solid rgba(148, 163, 184, 0.13);
  border-radius: 1rem;
  background:
    radial-gradient(circle at center, rgba(96, 165, 250, 0.16), transparent 34%),
    rgba(8, 14, 32, 0.45);
  overflow: hidden;
}

.graph-canvas::before,
.graph-canvas::after {
  content: '';
  position: absolute;
  inset: 18%;
  border: 1px dashed rgba(148, 163, 184, 0.18);
  border-radius: 50%;
}

.graph-canvas::after {
  inset: 32%;
}

.graph-node {
  position: absolute;
  z-index: 1;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  gap: 0.2rem;
  min-width: 4.8rem;
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 0.85rem;
  background: rgba(15, 23, 42, 0.82);
  padding: 0.55rem;
  box-shadow: 0 0.75rem 2rem rgba(8, 14, 32, 0.45);
}

.graph-node strong {
  color: #f8fafc;
}

.graph-node span {
  max-width: 6rem;
  overflow: hidden;
  color: #cbd5e1;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.graph-side {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.graph-side h4 {
  margin: 0.25rem 0 0;
}

.graph-dynamic {
  width: 100%;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.edge-row {
  align-items: center;
  color: #cbd5e1;
  font-size: 0.8rem;
}

.edge-row em {
  color: #93c5fd;
  font-style: normal;
}

.review-filter {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
}

.review-summary,
.review-meta,
.review-evidence {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.review-summary {
  margin: -0.2rem 0 0.85rem;
  color: #94a3b8;
  font-size: 0.78rem;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 0.85rem;
}

.review-card {
  display: grid;
  gap: 0.65rem;
}

.review-title {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.review-title span,
.review-meta {
  color: #94a3b8;
  font-size: 0.74rem;
}

.review-meta.compact {
  margin-top: 0.45rem;
}

.review-field {
  display: grid;
  gap: 0.35rem;
  color: #cbd5e1;
  font-size: 0.76rem;
  font-weight: 800;
}

.review-evidence {
  align-items: flex-start;
}

.review-actions {
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tiny-btn {
  min-height: 1.75rem;
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.56);
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 800;
  padding: 0 0.6rem;
}

.tiny-btn.primary {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(96, 165, 250, 0.16);
  color: #bfdbfe;
}

.tiny-btn.danger {
  border-color: rgba(239, 68, 68, 0.35);
  color: #fca5a5;
}

.detail-side {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

.side-panel {
  padding-bottom: 0.8rem;
}

.side-head h4 {
  font-size: 0.92rem;
}

.side-head button {
  min-height: 1.8rem;
  padding: 0 0.65rem;
  color: #bfdbfe;
  font-size: 0.76rem;
}

.side-review {
  margin: 0.75rem 0.8rem 0;
}

.storage-list {
  display: grid;
  gap: 0.65rem;
  margin: 0;
  padding: 0.8rem;
}

.storage-list div {
  display: grid;
  gap: 0.25rem;
}

.storage-list dt {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 800;
}

.storage-list dd {
  margin: 0;
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.flow-list {
  margin: 0;
  padding: 0.8rem 0.8rem 0.8rem 1.9rem;
  color: #cbd5e1;
  line-height: 1.6;
  font-size: 0.82rem;
}

.loading-state,
.empty-state {
  border: 1px dashed rgba(148, 163, 184, 0.16);
  border-radius: 0.9rem;
  color: #94a3b8;
  padding: 1.25rem;
  text-align: center;
}

.loading-state.compact,
.empty-state.compact {
  padding: 0.85rem;
}

.people-empty {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
}

.people-empty strong {
  color: #e2e8f0;
  font-size: 0.96rem;
}

.people-empty p {
  max-width: 36rem;
  color: #94a3b8;
  line-height: 1.6;
}

.loading-grid .person-card {
  cursor: default;
  transform: none;
}

.skeleton-card {
  pointer-events: none;
}

.skeleton-card::before {
  background: rgba(148, 163, 184, 0.16);
}

.skeleton-line,
.skeleton-button,
.skeleton-avatar,
.skeleton-icon,
.skeleton-meta span,
.skeleton-pill {
  position: relative;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.12);
}

.skeleton-line::after,
.skeleton-button::after,
.skeleton-avatar::after,
.skeleton-icon::after,
.skeleton-meta span::after,
.skeleton-pill::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.13),
    transparent
  );
  animation: shimmer 1.35s ease-in-out infinite;
}

@keyframes shimmer {
  100% { transform: translateX(100%); }
}

.skeleton-pill {
  width: 124px;
  height: 30px;
  display: inline-flex;
}

.skeleton-pill::before {
  display: none;
}

.skeleton-line {
  display: block;
  height: 12px;
}

.skeleton-line.title {
  width: min(520px, 82%);
  height: 32px;
  margin-top: 18px;
  border-radius: 10px;
}

.skeleton-line.body {
  width: min(420px, 72%);
  height: 14px;
  margin-top: 12px;
  border-radius: 8px;
}

.skeleton-line.body.wide {
  width: min(620px, 94%);
}

.skeleton-meta span {
  width: 96px;
  height: 18px;
  display: inline-flex;
}

.skeleton-button {
  width: 128px;
  height: 36px;
  display: inline-flex;
  border-radius: 10px;
}

.stat-card .skeleton-line.label {
  width: 72px;
  height: 12px;
}

.skeleton-line.stat-value {
  width: 48px;
  height: 24px;
  margin-top: 9px;
  border-radius: 8px;
}

.skeleton-line.stat-caption {
  width: 124px;
  height: 12px;
  margin-top: 9px;
}

.skeleton-icon {
  background: rgba(96, 165, 250, 0.12);
}

.skeleton-avatar {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: rgba(96, 165, 250, 0.13);
  box-shadow: none;
}

.skeleton-name {
  display: grid;
  gap: 8px;
}

.skeleton-name .name {
  width: 128px;
  height: 16px;
}

.skeleton-name .sub {
  width: 92px;
  height: 11px;
}

.person-foot .skeleton-line.foot {
  width: 48px;
  height: 11px;
}

.copy-toast {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 20;
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.92);
  color: #bfdbfe;
  padding: 0.75rem 0.9rem;
  box-shadow: 0 1rem 3rem rgba(8, 14, 32, 0.42);
}

@media (max-width: 1100px) {
  .hero,
  .detail,
  .graph-layout {
    grid-template-columns: 1fr;
  }

  .stat-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .detail-side {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  }
}

@media (max-width: 760px) {
  .relationship-radar-page {
    padding: 0.9rem;
  }

  .topbar,
  .top-actions,
  .search {
    width: 100%;
  }

  .hero,
  .brief-coverage,
  .brief-readiness-grid,
  .panel-grid,
  .detail-metrics,
  .stat-strip {
    grid-template-columns: 1fr;
  }

  .brief-readiness-head {
    flex-direction: column;
  }

  .privacy-strip {
    align-items: stretch;
    flex-direction: column;
  }

  .matrix-head {
    display: none;
  }

  .matrix-row {
    grid-template-columns: 1fr;
  }
}
</style>
