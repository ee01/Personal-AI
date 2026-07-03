<template>
  <div class="skills-page">
    <header class="page-header skills-header">
      <div>
        <div class="page-eyebrow">Personal Skill Foundry</div>
        <h1 class="page-title">
          <span class="page-title-mark">🧪</span>
          <span>个人技能炼金台</span>
        </h1>
        <p class="page-subtitle">
          你的真源技能库：从 Codex / Claude / OpenClaw / Jira /
          会议中沉淀「做事方法」，再以一句安装指引 + URL 的方式快速绑定到任意
          agent 平台。
        </p>
      </div>
      <div class="header-actions">
        <span class="capture-chip">
          <span class="pulse"></span>
          Flight Recorder 已联通
        </span>
        <button class="btn secondary secondary-btn" @click="openSyncDialog">
          ⚙ 平台级自动同步
        </button>
      </div>
    </header>

    <section
      v-if="showSuggestionDecisionOverview"
      class="suggestion-decision-overview"
      aria-live="polite"
    >
      <div class="decision-overview-head">
        <span>建议决策总览</span>
        <strong>{{ suggestionDecisionOverviewTitle }}</strong>
      </div>
      <div class="decision-overview-grid">
        <div
          v-for="row in suggestionDecisionOverviewRows"
          :key="`suggestion-overview:${row.label}`"
          :class="['decision-overview-row', row.tone || '']"
        >
          <span class="label">{{ row.label }}</span>
          <span>{{ row.text }}</span>
        </div>
      </div>
    </section>
    <section
      v-else-if="showSuggestionEmptyReceipt"
      class="suggestion-empty-receipt"
      aria-live="polite"
    >
      <div class="empty-receipt-head">
        <span>建议队列空回执</span>
        <strong>当前没有待审 suggestion</strong>
      </div>
      <div class="empty-receipt-grid">
        <div
          v-for="row in suggestionEmptyReceiptRows"
          :key="`suggestion-empty:${row.label}`"
          :class="['empty-receipt-row', row.tone || '']"
        >
          <span class="label">{{ row.label }}</span>
          <span>{{ row.text }}</span>
        </div>
      </div>
    </section>

    <section
      v-if="suggestions.length > 0"
      class="inbox-bar"
      :class="{ collapsed: !inboxExpanded }"
    >
      <div class="inbox-bar-head" @click="inboxExpanded = !inboxExpanded">
        <span class="icon">{{ inboxSourceMeta.icon }}</span>
        <span class="title">
          {{ inboxSourceMeta.label }} · {{ suggestions.length }} 条待决策
          <span class="bell-dot"></span>
        </span>
        <span class="meta">{{ inboxSourceMeta.meta }}</span>
        <button class="toggle" type="button" aria-label="切换萃取建议">
          {{ inboxExpanded ? '▴' : '▾' }}
        </button>
      </div>
      <div v-if="inboxExpanded" class="inbox-bar-body">
        <div class="inbox-push-hint">
          <span class="icon">{{ inboxSourceMeta.hintIcon }}</span>
          <span>
            <strong>{{ inboxSourceMeta.title }}</strong>
            {{ inboxSourceMeta.description }}
          </span>
        </div>
        <div v-if="suggestionPriorityInsight" class="inbox-priority">
          <div class="priority-main">
            <div class="priority-kicker">
              <span>{{ suggestionPriorityInsight.label }}</span>
              <em>{{ suggestionPriorityInsight.score }} 分</em>
            </div>
            <strong>{{ suggestionPriorityInsight.suggestion.title }}</strong>
            <p>{{ suggestionPriorityInsight.reason }}</p>
            <div class="priority-facts">
              <span
                v-for="reason in suggestionPriorityInsight.reasons"
                :key="`priority:${suggestionPriorityInsight.suggestion.id}:${reason}`"
              >
                {{ reason }}
              </span>
            </div>
          </div>
          <button
            class="btn primary"
            type="button"
            :disabled="
              suggestionWriteLocked(suggestionPriorityInsight.suggestion.id)
            "
            @click.stop="
              handleSuggestionPrimary(suggestionPriorityInsight.suggestion.id)
            "
          >
            {{ suggestionPriorityInsight.actionLabel }}
          </button>
        </div>
        <div class="suggestion-groups">
          <section
            v-for="group in suggestionGroups"
            :key="group.key"
            class="suggestion-group"
          >
            <div class="suggestion-group-head">
              <span>{{ group.icon }}</span>
              <strong>{{ group.title }}</strong>
              <em>{{ group.items.length }} 条</em>
            </div>
            <div class="suggestion-list" role="list">
              <article
                v-for="suggestion in group.items"
                :key="suggestion.id"
                class="suggestion-card"
                :class="{
                  active: selectedId === suggestion.id,
                  pending: isPendingSuggestionAction(suggestion.id),
                }"
                role="button"
                tabindex="0"
                @click="selectSkill(suggestion.id)"
                @keydown.enter="selectSkill(suggestion.id)"
                @keydown.space.prevent="selectSkill(suggestion.id)"
              >
                <div class="top">
                  <div class="title">{{ suggestion.title }}</div>
                  <span class="when">{{
                    suggestionSourceLabel(suggestion)
                  }}</span>
                  <span v-if="suggestion.reviewRequired" class="review-chip">
                    需审核
                  </span>
                  <span
                    v-if="isExternalChangeSuggestion(suggestion)"
                    class="change-chip"
                  >
                    变更
                  </span>
                </div>
                <div class="desc">{{ suggestion.summary || '暂无摘要' }}</div>
                <div class="source">
                  <span>{{
                    isExternalChangeSuggestion(suggestion) ? '变更' : '来源'
                  }}</span>
                  <span class="source-link">
                    {{ suggestionOriginText(suggestion) }}
                  </span>
                </div>
                <div
                  v-if="requiresReview(suggestion)"
                  class="review-preview"
                  :class="{ ready: canConfirmSuggestion(suggestion) }"
                >
                  <div class="review-preview-head">
                    <span>{{
                      canConfirmSuggestion(suggestion)
                        ? '已查看证据'
                        : '待审核摘要'
                    }}</span>
                    <em>{{ reviewReasonCountLabel(suggestion) }}</em>
                  </div>
                  <ul>
                    <li
                      v-for="reason in reviewReasonPreview(suggestion)"
                      :key="`${suggestion.id}:${reason}`"
                    >
                      {{ reason }}
                    </li>
                  </ul>
                  <div class="review-preview-pills">
                    <span
                      v-for="fact in suggestionReviewFacts(suggestion)"
                      :key="`${suggestion.id}:${fact}`"
                    >
                      {{ fact }}
                    </span>
                  </div>
                </div>
                <div class="actions">
                  <button
                    class="btn primary"
                    type="button"
                    :disabled="suggestionWriteLocked(suggestion.id)"
                    @click.stop="handleSuggestionPrimary(suggestion.id)"
                  >
                    {{ suggestionPrimaryLabel(suggestion) }}
                  </button>
                  <button
                    class="btn danger"
                    type="button"
                    :disabled="suggestionWriteLocked(suggestion.id)"
                    @click.stop="dismissSuggestion(suggestion.id)"
                  >
                    ✕ 丢弃
                  </button>
                  <button
                    class="btn secondary"
                    type="button"
                    :disabled="suggestionWriteLocked(suggestion.id)"
                    @click.stop="snoozeSuggestion(suggestion.id)"
                  >
                    稍后审
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>

    <section v-if="snoozedSuggestions.length > 0" class="snoozed-inbox">
      <div class="snoozed-inbox-head">
        <div>
          <strong>稍后建议</strong>
          <span
            >{{ snoozedSuggestions.length }} 条已暂缓，仍可随时恢复审阅</span
          >
        </div>
      </div>
      <div class="snoozed-suggestion-list" role="list">
        <article
          v-for="suggestion in snoozedSuggestions"
          :key="suggestion.id"
          class="snoozed-suggestion-card"
          :class="{
            active: selectedId === suggestion.id,
            pending: isPendingSuggestionAction(suggestion.id),
          }"
          role="button"
          tabindex="0"
          @click="selectSkill(suggestion.id)"
          @keydown.enter="selectSkill(suggestion.id)"
          @keydown.space.prevent="selectSkill(suggestion.id)"
        >
          <div class="snoozed-card-main">
            <strong>{{ suggestion.title }}</strong>
            <span>{{ suggestionOriginText(suggestion) }}</span>
          </div>
          <div class="snoozed-card-meta">
            <span
              >回到 Inbox
              {{ formatSnoozedUntil(suggestion.snoozedUntil) }}</span
            >
            <span v-if="suggestion.reviewRequired">需审核</span>
          </div>
          <div class="snoozed-card-actions">
            <button
              class="btn primary"
              type="button"
              :disabled="suggestionWriteLocked(suggestion.id)"
              @click.stop="unsnoozeSuggestion(suggestion.id)"
            >
              现在审
            </button>
            <button
              class="btn danger"
              type="button"
              :disabled="suggestionWriteLocked(suggestion.id)"
              @click.stop="dismissSuggestion(suggestion.id)"
            >
              丢弃
            </button>
          </div>
        </article>
      </div>
    </section>

    <div v-if="errorMessage" class="status-box error">{{ errorMessage }}</div>
    <div v-if="actionMessage" class="status-box info">{{ actionMessage }}</div>
    <div
      v-if="currentSkillActionReceipt"
      :class="[
        'skill-action-receipt',
        'sync-result-receipt',
        'status-box',
        currentSkillActionReceipt.tone,
      ]"
      aria-live="polite"
    >
      <div class="sync-result-head">
        <span>{{ currentSkillActionReceipt.heading || '入库回执' }}</span>
        <strong>{{ currentSkillActionReceipt.title }}</strong>
      </div>
      <p>{{ currentSkillActionReceipt.summary }}</p>
      <div class="sync-result-grid">
        <div
          v-for="row in currentSkillActionReceipt.rows"
          :key="`skill-action:${row.label}`"
          :class="['sync-result-row', row.tone || '']"
        >
          <span class="label">{{ row.label }}</span>
          <span>{{ row.text }}</span>
        </div>
      </div>
    </div>
    <div v-if="loading" class="status-box">加载个人技能中...</div>

    <div class="foundry-grid">
      <section class="panel rail skills-rail">
        <div class="rail-head rail-tools">
          <input
            v-model="searchQuery"
            class="rail-search"
            placeholder="搜索技能 / 平台..."
            aria-label="搜索技能"
          />
          <div
            class="rail-segmented segmented"
            role="group"
            aria-label="技能过滤"
          >
            <button
              :class="{ active: filter === 'active' }"
              @click="setFilter('active')"
            >
              在用
            </button>
            <button
              :class="{ active: filter === 'all' }"
              @click="setFilter('all')"
            >
              全部
            </button>
            <button
              :class="{ active: filter === 'dismissed' }"
              @click="setFilter('dismissed')"
            >
              已丢弃
            </button>
          </div>
        </div>

        <div v-if="filteredSkills.length === 0" class="empty-card">
          {{
            filter === 'dismissed'
              ? '目前没有已丢弃的技能。'
              : '还没有在用技能。'
          }}
        </div>
        <div class="candidate-list">
          <button
            v-for="skill in filteredSkills"
            :key="skill.id"
            type="button"
            class="candidate skill-card"
            :class="{ active: selectedId === skill.id }"
            @click="selectSkill(skill.id)"
          >
            <div class="candidate-top skill-card-head">
              <h3>{{ skill.title }}</h3>
              <span :class="['risk', skill.risk]">{{ skill.risk }}</span>
            </div>
            <p>{{ skill.summary }}</p>
            <div class="candidate-bindings binding-pills">
              <span class="label">绑定</span>
              <span
                v-for="binding in visibleBindings(skill)"
                :key="`${skill.id}:${binding.platform}`"
                :class="['binding-pill', binding.state]"
              >
                <span class="dot"></span>
                {{ platformLabel(binding.platform) }}
              </span>
              <span
                v-if="visibleBindings(skill).length === 0"
                class="binding-pill muted"
              >
                <span class="dot"></span>
                未绑定
              </span>
            </div>
            <div class="candidate-status card-foot">
              <span :class="['badge', skill.status]">{{
                statusLabel(skill.status)
              }}</span>
              <span>{{ skill.currentVersion || 'no version' }}</span>
            </div>
          </button>
        </div>
      </section>

      <section class="panel workspace skill-workspace">
        <template v-if="selectedSkill">
          <header class="workspace-head">
            <div class="workspace-title">
              <div class="eyebrow workspace-eyebrow">
                {{ workspaceStatusLabel(selectedSkill) }}
                <span
                  v-if="selectedSkillHealthReceipt"
                  :class="[
                    'health-gate-chip',
                    selectedSkillHealthReceipt.tone,
                  ]"
                >
                  {{ selectedSkillHealthReceipt.chip }}
                </span>
              </div>
              <h2>{{ selectedSkill.title }}</h2>
              <p>{{ selectedSkill.summary }}</p>
            </div>
            <div class="workspace-actions">
              <button
                v-if="
                  selectedSkill.status === 'suggestion' &&
                  isSnoozedSuggestion(selectedSkill)
                "
                class="btn secondary secondary-btn"
                :disabled="suggestionWriteLocked(selectedSkill.id)"
                @click="unsnoozeSuggestion(selectedSkill.id)"
              >
                现在审
              </button>
              <button
                v-if="
                  selectedSkill.status === 'suggestion' &&
                  requiresReview(selectedSkill) &&
                  !canConfirmSuggestion(selectedSkill)
                "
                class="btn secondary secondary-btn"
                @click="prepareSuggestionReview(selectedSkill.id)"
              >
                查看证据
              </button>
              <button
                v-if="
                  selectedSkill.status === 'suggestion' &&
                  !isSnoozedSuggestion(selectedSkill)
                "
                class="btn primary primary-btn"
                :disabled="suggestionWriteLocked(selectedSkill.id)"
                @click="handleSuggestionPrimary(selectedSkill.id)"
              >
                {{ suggestionPrimaryLabel(selectedSkill) }}
              </button>
              <button
                v-if="selectedSkill.status === 'suggestion'"
                class="btn danger secondary-btn"
                :disabled="suggestionWriteLocked(selectedSkill.id)"
                @click="dismissSuggestion(selectedSkill.id)"
              >
                ✕ 丢弃
              </button>
            </div>
          </header>

          <section
            v-if="selectedSkillHealthReceipt"
            :class="[
              'skill-health-receipt',
              selectedSkillHealthReceipt.tone,
            ]"
            aria-live="polite"
          >
            <div class="skill-health-head">
              <span>质量门控</span>
              <strong>{{ selectedSkillHealthReceipt.title }}</strong>
            </div>
            <p>{{ selectedSkillHealthReceipt.summary }}</p>
            <div class="skill-health-grid">
              <div
                v-for="row in selectedSkillHealthReceipt.rows"
                :key="`skill-health:${selectedSkill.id}:${row.label}`"
                class="skill-health-row"
              >
                <span class="label">{{ row.label }}</span>
                <span>{{ row.text }}</span>
              </div>
            </div>
          </section>

          <nav class="workspace-tabs" aria-label="技能详情">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="tab-btn"
              :class="{ active: activeTab === tab.key }"
              @click="setActiveTab(tab.key)"
            >
              {{ tab.label }}
              <span v-if="tabCount(tab.key)" class="tab-badge tab-count">{{
                tabCount(tab.key)
              }}</span>
            </button>
          </nav>

          <section
            v-if="
              selectedSkill.status === 'suggestion' &&
              isSnoozedSuggestion(selectedSkill)
            "
            class="review-gate snoozed-review-gate"
          >
            <div class="review-gate-icon">i</div>
            <div class="review-gate-body">
              <strong>已放入稍后建议</strong>
              <p>
                这条建议暂时不参与 Inbox 决策；恢复到 Inbox 后再确认使用或覆盖。
              </p>
              <div class="review-audit-summary">
                <span class="review-audit-state">
                  回到 Inbox {{ formatSnoozedUntil(selectedSkill.snoozedUntil) }}
                </span>
                <span>{{ suggestionOriginText(selectedSkill) }}</span>
                <span v-if="requiresReview(selectedSkill)">需审核</span>
              </div>
            </div>
            <div class="review-gate-actions">
              <button
                class="btn primary mini"
                type="button"
                :disabled="suggestionWriteLocked(selectedSkill.id)"
                @click="unsnoozeSuggestion(selectedSkill.id)"
              >
                现在审
              </button>
            </div>
          </section>

          <section
            v-if="
              selectedSkill.status === 'suggestion' &&
              requiresReview(selectedSkill)
            "
            class="review-gate"
          >
            <div class="review-gate-icon">!</div>
            <div class="review-gate-body">
              <strong>{{ reviewGateTitle(selectedSkill) }}</strong>
              <p>{{ reviewGateDescription(selectedSkill) }}</p>
              <div
                class="review-audit-summary"
                :class="{ ready: canConfirmSuggestion(selectedSkill) }"
                aria-live="polite"
              >
                <span class="review-audit-state">
                  {{
                    canConfirmSuggestion(selectedSkill)
                      ? '证据已查看，可以确认'
                      : '需先查看证据和风险'
                  }}
                </span>
                <span
                  v-for="fact in reviewAuditFacts(selectedSkill)"
                  :key="`${selectedSkill.id}:${fact}`"
                >
                  {{ fact }}
                </span>
              </div>
              <ul>
                <li
                  v-for="reason in reviewReasons(selectedSkill)"
                  :key="reason"
                >
                  {{ reason }}
                </li>
              </ul>
            </div>
            <div class="review-gate-actions">
              <button
                v-if="!canConfirmSuggestion(selectedSkill)"
                class="btn secondary mini"
                type="button"
                @click="prepareSuggestionReview(selectedSkill.id)"
              >
                查看证据
              </button>
              <button
                v-else-if="!isSnoozedSuggestion(selectedSkill)"
                class="btn primary mini"
                type="button"
                :disabled="suggestionWriteLocked(selectedSkill.id)"
                @click="
                  useSuggestion(selectedSkill.id, { reviewConfirmed: true })
                "
              >
                {{ suggestionPrimaryLabel(selectedSkill) }}
              </button>
            </div>
          </section>

          <section
            v-if="
              selectedSkill.status === 'suggestion' &&
              !isSnoozedSuggestion(selectedSkill)
            "
            class="decision-receipt"
            aria-live="polite"
          >
            <div class="decision-receipt-head">
              <span>确认后会发生什么</span>
              <strong>{{ suggestionDecisionReceiptTitle(selectedSkill) }}</strong>
            </div>
            <div class="decision-receipt-grid">
              <div
                v-for="row in suggestionDecisionReceiptRows(selectedSkill)"
                :key="`${selectedSkill.id}:decision:${row.label}`"
                class="decision-receipt-row"
              >
                <span class="label">{{ row.label }}</span>
                <span>{{ row.text }}</span>
              </div>
            </div>
          </section>

          <div class="workspace-content">
            <section v-if="activeTab === 'workflow'" class="detail-section">
              <section class="section">
                <div class="section-head">
                  <h3>
                    <span class="icon">🔁</span>工作流（{{
                      selectedSkill.workflow.length
                    }}
                    步）
                  </h3>
                  <span class="status draft">{{
                    selectedSkill.currentVersion || 'no version'
                  }}</span>
                </div>
                <div class="section-body">
                  <div class="kv">
                    <div class="label">触发</div>
                    <div class="value">
                      {{ selectedSkill.trigger || '未配置触发条件' }}
                    </div>
                  </div>
                  <div class="kv">
                    <div class="label">不要触发</div>
                    <div class="value">
                      {{ selectedSkill.notUse || '未配置排除条件' }}
                    </div>
                  </div>
                  <div class="kv">
                    <div class="label">来源</div>
                    <div class="value">
                      <div class="pill-row">
                        <span
                          v-for="source in selectedSkill.sources"
                          :key="source"
                          class="pill"
                        >
                          {{ source }}
                        </span>
                        <span
                          v-if="selectedSkill.sources.length === 0"
                          class="pill muted"
                        >
                          未标注
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="kv">
                    <div class="label">风险策略</div>
                    <div class="value">
                      {{ selectedSkill.riskBrief || selectedSkill.risk }}
                    </div>
                  </div>
                  <div class="steps">
                    <article
                      v-for="(step, index) in selectedSkill.workflow"
                      :key="`${step.title}:${index}`"
                      class="step"
                    >
                      <div class="step-num">{{ index + 1 }}</div>
                      <div class="step-body">
                        <strong>{{ step.title }}</strong>
                        <p>{{ step.desc }}</p>
                        <div v-if="step.tools?.length" class="step-tools">
                          <span
                            v-for="tool in step.tools"
                            :key="tool"
                            class="pill muted"
                            >{{ tool }}</span
                          >
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </section>

              <section class="section">
                <div class="section-head">
                  <h3>
                    <span class="icon">🛫</span>来源 episode（Flight Recorder）
                  </h3>
                  <span class="status muted"
                    >{{ selectedSkill.sourceEpisodes.length }} 条</span
                  >
                </div>
                <div class="section-body compact">
                  <div
                    v-if="selectedSkill.sourceEpisodes.length === 0"
                    class="empty-card"
                  >
                    尚未链接到来源 episode。
                  </div>
                  <article
                    v-for="episode in selectedSkill.sourceEpisodes"
                    :key="episode.id"
                    class="binding-card"
                  >
                    <div class="binding-head">
                      <div class="binding-name-block">
                        <span class="binding-icon">🛫</span>
                        <div>
                          <strong>{{ episode.title }}</strong>
                          <p>
                            {{ episode.date || '无日期' }} · {{ episode.id }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </section>

            <section
              v-else-if="activeTab === 'evidence'"
              class="detail-section"
            >
              <section class="section">
                <div class="section-head">
                  <h3>
                    <span class="icon">🧾</span>证据链（{{
                      selectedSkill.evidence.length
                    }}
                    refs）
                  </h3>
                  <span class="status muted">来源证据</span>
                </div>
                <div class="section-body">
                  <div class="evidence-list">
                    <article
                      v-for="evidence in selectedSkill.evidence"
                      :key="`${evidence.title}:${evidence.episodeId || ''}`"
                      class="evidence-card evidence"
                    >
                      <div class="evidence-head evidence-top">
                        <h3>{{ evidence.title }}</h3>
                        <span class="pill muted">{{
                          evidence.kind || 'memory'
                        }}</span>
                      </div>
                      <p>{{ evidence.desc }}</p>
                      <div class="evidence-foot">
                        <span
                          :class="[
                            'status',
                            evidenceStateClass(evidence.evidenceState),
                          ]"
                        >
                          {{ evidenceStateLabel(evidence.evidenceState) }}
                        </span>
                        <span v-if="evidence.episodeId"
                          >episode {{ evidence.episodeId }}</span
                        >
                        <span v-else>无来源 episode</span>
                      </div>
                    </article>
                  </div>
                  <div
                    v-if="selectedSkill.evidence.length === 0"
                    class="empty-card"
                  >
                    暂无证据。
                  </div>
                </div>
              </section>
            </section>

            <section
              v-else-if="activeTab === 'versions'"
              class="detail-section"
            >
              <section class="section">
                <div class="section-head">
                  <h3>
                    <span class="icon">🪜</span>版本历史（{{
                      selectedSkill.versions.length
                    }}）
                  </h3>
                  <span class="status muted"
                    >当前
                    {{ selectedSkill.currentVersion || 'no version' }}</span
                  >
                </div>
                <div class="section-body">
                  <div class="version-list">
                    <article
                      v-for="version in selectedSkill.versions"
                      :key="version.id"
                      class="version-card version"
                    >
                      <div class="version-head version-top">
                        <h3>{{ version.version }}</h3>
                        <span class="pill muted">
                          {{ formatDate(version.createdAt) }} ·
                          {{ version.createdFrom || 'personal_ai' }}
                        </span>
                      </div>
                      <p>{{ version.changelog || '无变更说明' }}</p>
                      <div class="version-diff">
                        <div class="diff-line context">
                          <span class="marker"> </span>
                          <span>sha256 {{ version.sha256.slice(0, 16) }}</span>
                        </div>
                        <div v-if="version.isActive" class="diff-line add">
                          <span class="marker">+</span>
                          <span>active version</span>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </section>
            </section>

            <section v-else class="detail-section">
              <div class="install-banner">
                <div class="install-banner-icon">🔗</div>
                <div class="install-banner-body">
                  <div class="install-url-head">
                    <div class="install-url-copy">
                      <strong>展示短链：</strong>
                      <code>{{ displaySkillUrl }}</code>
                    </div>
                    <div class="install-url-actions">
                      <button
                        class="btn secondary mini"
                        type="button"
                        :disabled="!selectedSkill.share"
                        @click="copySkillUrl"
                      >
                        复制可访问 URL
                      </button>
                      <button
                        class="btn secondary mini"
                        type="button"
                        :disabled="!selectedSkill.share"
                        @click="openSkillPreview"
                      >
                        打开预览
                      </button>
                    </div>
                  </div>
                    <p v-if="selectedSkill.shareError" class="share-error">
                      {{ selectedSkill.shareError }}
                    </p>
                    <p>
                      短链只用于识别 slug/version；直接打开或给 agent
                      安装时会使用带 token 的可访问 URL，拉取 SKILL.md
                      和资源。已绑定状态由后台同步程序异步更新。
                    </p>
                    <div class="share-receipt" aria-live="polite">
                      <div class="share-receipt-head">
                        <span>分享回执</span>
                        <strong>{{ skillShareReceiptTitle(selectedSkill) }}</strong>
                      </div>
                      <div class="share-receipt-grid">
                        <div
                          v-for="row in skillShareReceiptRows(selectedSkill)"
                          :key="`share:${selectedSkill.id}:${row.label}`"
                          class="share-receipt-row"
                        >
                          <span class="label">{{ row.label }}</span>
                          <span>{{ row.text }}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      v-if="currentShareCopyReceipt"
                      :class="[
                        'share-copy-receipt',
                        currentShareCopyReceipt.tone,
                      ]"
                      aria-live="polite"
                    >
                      <div class="share-copy-head">
                        <span>复制回执</span>
                        <strong>{{ currentShareCopyReceipt.title }}</strong>
                      </div>
                      <p>{{ currentShareCopyReceipt.summary }}</p>
                      <div class="share-copy-grid">
                        <div
                          v-for="row in currentShareCopyReceipt.rows"
                          :key="`share-copy:${row.label}`"
                          class="share-copy-row"
                        >
                          <span class="label">{{ row.label }}</span>
                          <span>{{ row.text }}</span>
                        </div>
                      </div>
                    </div>
                    <span class="install-banner-scope">
                      自动同步开关在平台维度，不是单条技能；开启后同步所有 active
                      技能。
                    </span>
                </div>
              </div>

              <section class="section">
                <div class="section-head">
                  <h3>
                    <span class="icon">🔌</span>平台绑定（{{
                      bindingCards.length
                    }}）
                  </h3>
                  <button
                    class="btn secondary mini"
                    type="button"
                    @click="openSyncDialog"
                  >
                    ⚙ 平台级自动同步
                  </button>
                </div>
                <div class="section-body">
                  <div
                    v-if="showDesktopAppBindingNotice"
                    class="binding-tab-notice warn"
                  >
                    <span class="binding-hint-icon" aria-hidden="true">!</span>
                    <div>
                      <strong>需要 Desktop App 才能读取本机平台状态</strong>
                      <p>
                        Codex CLI / Claude Code / Cursor 的 skill
                        目录在本机文件系统里。 安装并运行最新版 Desktop App
                        后，Personal AI 才能判断是否已安装并执行双向同步。
                      </p>
                      <a
                        :href="DESKTOP_APP_RELEASE_URL"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        下载 Desktop App
                      </a>
                    </div>
                  </div>
                  <div class="bindings-grid">
                    <article
                      v-for="binding in bindingCards"
                      :key="binding.platform"
                      class="binding-card"
                    >
                      <div class="binding-head binding-card-top">
                        <div class="binding-name-block">
                          <span class="binding-icon">{{
                            platformIcon(binding.platform)
                          }}</span>
                          <div>
                            <strong>{{
                              platformLabel(binding.platform)
                            }}</strong>
                            <p>{{ platformNote(binding.platform) }}</p>
                          </div>
                        </div>
                        <span
                          :class="['binding-state', bindingStateClass(binding)]"
                        >
                          {{ bindingStatusLabel(binding) }}
                        </span>
                      </div>
                      <div
                        v-if="bindingHint(binding)"
                        :class="['binding-hint', bindingHint(binding)?.tone]"
                      >
                        <span class="binding-hint-icon" aria-hidden="true">
                          {{ bindingHint(binding)?.icon }}
                        </span>
                        <div class="binding-hint-body">
                          <strong>{{ bindingHint(binding)?.title }}</strong>
                          <p>{{ bindingHint(binding)?.text }}</p>
                          <a
                            v-if="bindingHint(binding)?.href"
                            :href="bindingHint(binding)?.href"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {{ bindingHint(binding)?.cta }}
                          </a>
                          <button
                            v-else-if="
                              bindingHint(binding)?.action === 'sync-settings'
                            "
                            type="button"
                            class="text-action"
                            @click="openSyncDialog"
                          >
                            {{ bindingHint(binding)?.cta }}
                          </button>
                        </div>
                      </div>
                      <div
                        v-if="binding.platform !== 'personal_ai'"
                        class="install-command binding-instruction"
                      >
                        <span class="text">{{
                          installCommand(binding.platform)
                        }}</span>
                        <button
                          class="btn secondary mini"
                          :disabled="!selectedSkill.share"
                          @click="copyInstallCommand(binding.platform)"
                        >
                          复制
                        </button>
                      </div>
                      <div class="binding-meta binding-meta-row">
                        <span>{{ syncTag(binding.platform) }}</span>
                        <span v-if="binding.installedVersion"
                          >已安装 {{ binding.installedVersion }}</span
                        >
                        <span v-if="localSkillSourceSummary(binding)">
                          来源 {{ localSkillSourceSummary(binding) }}
                        </span>
                        <span v-if="localSkillPackageSummary(binding)">
                          {{ localSkillPackageSummary(binding) }}
                        </span>
                        <span v-if="binding.lastError">{{
                          binding.lastError
                        }}</span>
                      </div>
                    </article>
                  </div>
                </div>
              </section>
            </section>
          </div>
        </template>
        <div v-else class="empty-workspace">
          选择一条技能查看工作流、证据、版本和绑定。
        </div>
      </section>
    </div>

    <div
      v-if="syncDialogOpen"
      class="dialog-backdrop"
      @click.self="closeSyncDialog"
    >
      <div class="sync-dialog" role="dialog" aria-label="平台级自动同步">
        <header>
          <div>
            <h3>平台级自动同步</h3>
            <p>
              开关按平台生效，不按单条技能生效。开启后该平台会跟随推送所有
              active 技能。
            </p>
          </div>
          <div class="dialog-actions">
            <button class="secondary-btn" @click="closeSyncDialog">关闭</button>
          </div>
        </header>
        <div
          v-if="syncResultReceipt"
          :class="[
            'sync-result-receipt',
            'status-box',
            syncResultReceipt.tone,
          ]"
          aria-live="polite"
        >
          <div class="sync-result-head">
            <span>{{ syncResultReceipt.heading || '同步回执' }}</span>
            <strong>{{ syncResultReceipt.title }}</strong>
          </div>
          <p>{{ syncResultReceipt.summary }}</p>
          <div class="sync-result-grid">
            <div
              v-for="row in syncResultReceipt.rows"
              :key="`sync-result:${row.label}`"
              :class="['sync-result-row', row.tone || '']"
            >
              <span class="label">{{ row.label }}</span>
              <span>{{ row.text }}</span>
            </div>
          </div>
        </div>
        <div v-else-if="syncResultMessage" class="status-box">
          {{ syncResultMessage }}
        </div>
        <div class="sync-scope-overview" aria-live="polite">
          <div class="sync-result-head sync-scope-overview-head">
            <span>本次范围总览</span>
            <strong>{{ syncScopeOverviewTitle }}</strong>
          </div>
          <div class="sync-result-grid">
            <div
              v-for="row in syncScopeOverviewRows"
              :key="`sync-overview:${row.label}`"
              :class="['sync-result-row', row.tone || '']"
            >
              <span class="label">{{ row.label }}</span>
              <span>{{ row.text }}</span>
            </div>
          </div>
        </div>
        <div class="conflict-note">
          sha256 相同视为已对齐；远端 mtime
          晚于真源时进入萃取建议审稿，不自动覆盖。
        </div>
        <div class="sync-rows">
          <article
            v-for="setting in syncSettings"
            :key="setting.platform"
            class="sync-row"
          >
            <div class="sync-row-icon">
              {{ platformIcon(setting.platform) }}
            </div>
            <div class="sync-row-body">
              <strong>{{ platformLabel(setting.platform) }}</strong>
              <p>{{ syncDescription(setting) }}</p>
              <span class="mode">{{ setting.mode }}</span>
              <span class="scope sync-scope">{{ syncScope(setting) }}</span>
              <div
                v-if="syncDiagnostics(setting).length > 0"
                class="sync-diagnostics"
              >
                <span
                  v-for="diagnostic in syncDiagnostics(setting)"
                  :key="`${setting.platform}:${diagnostic.text}`"
                  :class="['sync-diagnostic', diagnostic.tone]"
                >
                  {{ diagnostic.text }}
                </span>
              </div>
            </div>
            <div class="sync-row-actions">
              <button
                v-if="setting.platform === 'openclaw'"
                class="icon-btn sync-now-btn"
                :disabled="
                  syncRunning || isAnySyncTogglePending() || !setting.enabled
                "
                :title="
                  syncRunning || isAnySyncTogglePending()
                    ? '同步设置保存中'
                    : '立即同步 OpenClaw'
                "
                aria-label="立即同步 OpenClaw"
                @click="runOpenClawSync"
              >
                <span aria-hidden="true">⟳</span>
              </button>
              <button
                v-else-if="localDesktopPlatforms.includes(setting.platform)"
                class="icon-btn sync-now-btn"
                :disabled="
                  syncRunning ||
                  isAnySyncTogglePending() ||
                  !setting.enabled ||
                  !desktopAppInstalled
                "
                :title="
                  syncRunning || isAnySyncTogglePending()
                    ? '同步中'
                    : `立即同步 ${platformLabel(setting.platform)}`
                "
                :aria-label="`立即同步 ${platformLabel(setting.platform)}`"
                @click="runDesktopSkillSync(setting.platform)"
              >
                <span aria-hidden="true">⟳</span>
              </button>
              <label class="switch">
                <input
                  type="checkbox"
                  :checked="syncToggleChecked(setting)"
                  :disabled="syncWriteDisabled(setting)"
                  @change="toggleSync(setting, $event)"
                />
                <span>{{ syncControlLabel(setting) }}</span>
              </label>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  getMemoryServiceClient,
  type PersonalSkillDetail,
  type PersonalSkillListItem,
  type SkillHealth,
  type SkillPlatformBinding,
  type SkillSyncSetting,
} from '../../services/MemoryServiceClient';
import { DesktopAppClient } from '../../services/DesktopAppClient';

type SkillFilter = 'active' | 'all' | 'dismissed';
type SkillTab = 'workflow' | 'evidence' | 'versions' | 'bindings';
type UseSuggestionOptions = { reviewConfirmed?: boolean };
type SuggestionActionKind = 'use' | 'dismiss' | 'snooze' | 'unsnooze';
type DecisionReceiptRow = { label: string; text: string };
type ShareReceiptRow = { label: string; text: string };
type ShareCopyKind = 'url' | 'install';
type ShareCopySnapshot = {
  kind: ShareCopyKind;
  platform?: string;
  skillId: string;
  skillTitle: string;
  displayUrl: string;
  shareUrl: string;
  version: string;
  sha: string;
  tokenTail: string;
  copiedAt: number;
};
type ShareCopyReceipt = {
  title: string;
  summary: string;
  tone: 'success' | 'warn';
  rows: ShareReceiptRow[];
  snapshot?: ShareCopySnapshot;
};
type SyncResultReceiptTone = 'success' | 'warn' | 'failed' | 'info';
type SyncResultReceiptRow = {
  label: string;
  text: string;
  tone?: SyncResultReceiptTone;
};
type SyncResultReceipt = {
  heading?: string;
  title: string;
  summary: string;
  tone: SyncResultReceiptTone;
  rows: SyncResultReceiptRow[];
};
type SkillHealthReceipt = {
  chip: string;
  title: string;
  summary: string;
  tone: 'success' | 'warn' | 'info';
  rows: Array<{ label: string; text: string }>;
};
type SyncTogglePending = {
  platform: string;
  enabled: boolean;
};
type ReviewableSkill = Pick<
  PersonalSkillListItem,
  'id' | 'slug' | 'reviewRequired' | 'reviewReasons' | 'bindings'
>;
type SyncReceiptPlatformResult = {
  platform: string;
  status?: string;
  totalRemote?: number | null;
  candidates?: number;
  processed?: number;
  imported?: number;
  updated?: number;
  pulled?: number;
  pushed?: number;
  externalChanges?: number;
  skipped?: number;
  hasMore?: boolean;
  root?: string;
  scanned?: number;
  errors?: Array<{ slug?: string; error: string }>;
  note?: string;
};
type PendingSuggestionAction = {
  id: string;
  action: SuggestionActionKind;
  title: string;
};

const client = getMemoryServiceClient();
const desktopClient = new DesktopAppClient();
const loading = ref(false);
const errorMessage = ref('');
const actionMessage = ref('');
const skillActionReceipt = ref<SyncResultReceipt | null>(null);
const pendingSuggestionAction = ref<PendingSuggestionAction | null>(null);
const currentSkillActionReceipt = computed(() => {
  const pending = pendingSuggestionAction.value;
  return pending ? buildSuggestionPendingReceipt(pending) : skillActionReceipt.value;
});
const skills = ref<PersonalSkillListItem[]>([]);
const activeSkillTotal = ref(0);
const suggestions = ref<PersonalSkillListItem[]>([]);
const snoozedSuggestions = ref<PersonalSkillListItem[]>([]);
const selectedSkill = ref<PersonalSkillDetail | null>(null);
const selectedSkillHealth = ref<SkillHealth | null>(null);
const selectedId = ref('');
const activeTab = ref<SkillTab>('workflow');
const reviewedSuggestionIds = ref<Set<string>>(new Set());
const filter = ref<SkillFilter>('active');
const searchQuery = ref('');
const inboxExpanded = ref(true);
const syncDialogOpen = ref(false);
const syncRunning = ref(false);
const syncTogglePending = ref<SyncTogglePending | null>(null);
const syncResultMessage = ref('');
const syncResultReceipt = ref<SyncResultReceipt | null>(null);
const syncSettings = ref<SkillSyncSetting[]>([]);
const desktopAppInstalled = ref(false);
const shareCopyReceipt = ref<ShareCopyReceipt | null>(null);
const DESKTOP_APP_RELEASE_URL =
  'https://github.com/ee01/personal-ai/releases/latest';
const localDesktopPlatforms = ['codex', 'claude_code', 'cursor'];
const manualOnlyPlatforms = ['chatgpt_gpts', 'claude_skills_web'];

const tabs: Array<{ key: SkillTab; label: string }> = [
  { key: 'workflow', label: '工作流' },
  { key: 'evidence', label: '证据' },
  { key: 'versions', label: '版本' },
  { key: 'bindings', label: '绑定' },
];

const platformMeta: Record<
  string,
  { label: string; note: string; icon: string }
> = {
  personal_ai: {
    label: 'Personal AI',
    icon: '🧠',
    note: '技能真源，永远 active',
  },
  openclaw: {
    label: 'OpenClaw remote',
    icon: '🐾',
    note: '通过 /v1/responses + skills.* RPC 同步',
  },
  codex: { label: 'Codex CLI', icon: '🤖', note: '本机 ~/.codex/skills' },
  claude_code: {
    label: 'Claude Code',
    icon: '🪶',
    note: '本机 ~/.claude/skills 或用户绑定目录',
  },
  cursor: { label: 'Cursor', icon: '🅒', note: 'Cursor user rules + skills' },
  chatgpt_gpts: {
    label: 'ChatGPT / GPTs',
    icon: '💬',
    note: '纯 Web，不可写文件',
  },
  claude_skills_web: {
    label: 'Claude.ai Skills',
    icon: '🅰',
    note: 'Web 版本，不可写文件',
  },
};

const platformOrder = [
  'personal_ai',
  'openclaw',
  'codex',
  'claude_code',
  'cursor',
  'chatgpt_gpts',
  'claude_skills_web',
];

const filteredSkills = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return skills.value.filter((skill) => {
    if (skill.status === 'suggestion') return false;
    if (filter.value === 'active' && skill.status !== 'active') return false;
    if (filter.value === 'dismissed' && skill.status !== 'dismissed')
      return false;
    if (!q) return true;
    const platforms = (skill.bindings || [])
      .map((binding) => platformLabel(binding.platform))
      .join(' ');
    return [skill.title, skill.summary, skill.trigger, platforms]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
});

const activeSkillCount = computed(() => activeSkillTotal.value);

const inboxSourceMeta = computed(() => {
  const sourceSet = new Set(
    suggestions.value
      .flatMap((suggestion) => [
        suggestion.suggestedFrom,
        ...(suggestion.sources || []),
      ])
      .filter(Boolean),
  );
  const normalizedSources = Array.from(sourceSet).map((source) =>
    String(source).toLowerCase(),
  );
  const isLocalOnlyInbox =
    normalizedSources.length > 0 &&
    normalizedSources.every((source) => localDesktopPlatforms.includes(source));
  if (sourceSet.size === 1 && sourceSet.has('openclaw')) {
    return {
      label: 'OpenClaw 导入建议',
      icon: '🐾',
      hintIcon: '🔌',
      title: 'OpenClaw remote 已安装技能导入',
      meta: '由 OpenClaw remote 的 installed skills 同步导入',
      description:
        '这些建议来自 OpenClaw 远端已有技能包，不是记忆或 Flight Recorder 萃取；使用后才会进入 Personal AI 真源技能库。',
    };
  }
  if (sourceSet.size === 1 && sourceSet.has('flight_recorder')) {
    return {
      label: '萃取建议',
      icon: '📥',
      hintIcon: '🛫',
      title: 'Flight Recorder 操作轨迹萃取',
      meta: '由 Flight Recorder 从真实操作 episode 萃取',
      description: '这些建议来自真实操作 episode；可以直接使用、丢弃或稍后审。',
    };
  }
  if (isLocalOnlyInbox) {
    const platformNames = normalizedSources
      .map((source) => platformLabel(source))
      .join(' / ');
    return {
      label: '本地 agent 导入建议',
      icon: '💻',
      hintIcon: '🗂',
      title: `${platformNames || '本地 agent'} skill 目录扫描`,
      meta: '由 Desktop App 从本机 agent skill 目录扫描导入',
      description:
        '这些建议来自 Codex / Claude Code / Cursor 的本机 skill 目录；使用后才会进入 Personal AI 真源技能库，确认前需要先看目录来源、资源文件和脚本风险。',
    };
  }
  return {
    label: '技能建议',
    icon: '📥',
    hintIcon: '🧪',
    title: '多来源技能建议',
    meta: '由 OpenClaw / Flight Recorder / 其他 agent 平台汇入',
    description:
      '这些建议来自不同输入源；点击卡片查看详情，使用后进入 Personal AI 真源技能库。',
  };
});

const rankedSuggestions = computed(() => {
  return [...suggestions.value].sort((left, right) => {
    const priorityDelta =
      suggestionPriorityScore(right) - suggestionPriorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    const updatedDelta = (right.updatedAt || 0) - (left.updatedAt || 0);
    if (updatedDelta !== 0) return updatedDelta;
    return left.title.localeCompare(right.title);
  });
});

const suggestionPriorityInsight = computed(() => {
  const suggestion = rankedSuggestions.value[0];
  if (!suggestion) return null;
  const reasons = suggestionPriorityReasons(suggestion);
  return {
    suggestion,
    score: suggestionPriorityScore(suggestion),
    label: suggestionPriorityLabel(suggestion),
    reason: reasons[0] || '这条建议最影响当前技能库判断。',
    reasons: reasons.slice(0, 3),
    actionLabel: suggestionPrimaryLabel(suggestion),
  };
});

const showSuggestionDecisionOverview = computed(() => {
  return suggestions.value.length > 0 || snoozedSuggestions.value.length > 0;
});

const showSuggestionEmptyReceipt = computed(() => {
  return (
    !loading.value &&
    !errorMessage.value &&
    suggestions.value.length === 0 &&
    snoozedSuggestions.value.length === 0
  );
});

const selectedSkillHealthReceipt = computed<SkillHealthReceipt | null>(() => {
  const skill = selectedSkill.value;
  const health = selectedSkillHealth.value;
  if (!skill || !health) return null;
  return buildSkillHealthReceipt(skill, health);
});

const suggestionDecisionOverviewTitle = computed(() => {
  const readyCount = suggestions.value.length;
  const snoozedCount = snoozedSuggestions.value.length;
  const reviewCount = suggestions.value.filter((skill) =>
    requiresReview(skill),
  ).length;
  return [
    `${readyCount} 条可审`,
    `${snoozedCount} 条稍后`,
    reviewCount ? `${reviewCount} 条需审核` : '无强审核',
  ].join(' · ');
});

const suggestionDecisionOverviewRows = computed<SyncResultReceiptRow[]>(() => {
  const readyCount = suggestions.value.length;
  const snoozedCount = snoozedSuggestions.value.length;
  const reviewCount = suggestions.value.filter((skill) =>
    requiresReview(skill),
  ).length;
  const quickCount = Math.max(0, readyCount - reviewCount);
  const externalChangeCount = suggestions.value.filter((skill) =>
    isExternalChangeSuggestion(skill),
  ).length;
  const localImportCount = suggestions.value.filter((skill) =>
    localSkillSourceBinding(skill),
  ).length;
  const scriptOrDependencyCount = suggestions.value.filter((skill) =>
    suggestionHasReviewReason(skill, /可执行脚本|安装|下载|MCP|外部依赖/),
  ).length;
  const priority = suggestionPriorityInsight.value;
  const rows: SyncResultReceiptRow[] = [
    {
      label: '当前 Inbox',
      text: readyCount
        ? [
            `${readyCount} 条可审`,
            `${quickCount} 条可直接处理`,
            `${reviewCount} 条需要先看证据或风险`,
            externalChangeCount
              ? `${externalChangeCount} 条会覆盖 active 真源`
              : '',
          ]
            .filter(Boolean)
            .join('；')
        : '当前没有可审 suggestion；可以从稍后建议恢复，或等待新的导入/萃取。',
      tone: reviewCount || externalChangeCount ? 'warn' : 'info',
    },
    {
      label: '稍后队列',
      text: snoozedCount
        ? `${snoozedCount} 条仍是 suggestion；只能现在审或丢弃，恢复到 Inbox 前不能确认使用或覆盖。`
        : '没有暂缓 suggestion；稍后审只会移出当前 Inbox，不会入库、覆盖或同步。',
      tone: snoozedCount ? 'info' : 'success',
    },
    {
      label: '风险线索',
      text: [
        localImportCount ? `${localImportCount} 条来自本机 agent 目录` : '',
        scriptOrDependencyCount
          ? `${scriptOrDependencyCount} 条涉及脚本、安装、下载或 MCP 依赖`
          : '',
        priority
          ? `${priority.label}：${priority.suggestion.title}。${priority.reason}`
          : '没有需要优先处理的风险线索',
      ]
        .filter(Boolean)
        .join('；'),
      tone: localImportCount || scriptOrDependencyCount ? 'warn' : 'info',
    },
    {
      label: '操作边界',
      text: '查看、搜索、展开详情和切换过滤只读；只有使用/确认覆盖、丢弃、稍后审、现在审会写入 suggestion 状态。',
      tone: 'info',
    },
  ];
  return rows;
});

const suggestionEmptyReceiptRows = computed<SyncResultReceiptRow[]>(() => {
  const activeCount = activeSkillCount.value;
  return [
    {
      label: '当前 Inbox',
      text: `ready suggestion 与稍后 suggestion 都为空；${activeCount} 条 active 真源技能仍可查看、复制或按平台同步。`,
      tone: 'success',
    },
    {
      label: '读取口径',
      text: '这是 ready / snoozed 两个 suggestion 列表成功返回后的空结果；不是加载失败、过滤隐藏、质量门控降级或同步开关关闭。',
      tone: 'info',
    },
    {
      label: '后续来源',
      text: '新的 Flight Recorder、OpenClaw 或 Desktop App 本机扫描结果仍会先进入 suggestion 审核队列。',
      tone: 'info',
    },
    {
      label: '操作边界',
      text: '空队列回执只读；不会创建 suggestion、提升 active、触发 OpenClaw / Desktop App 同步、写外部平台或执行 skill。',
      tone: 'info',
    },
  ];
});

const suggestionGroups = computed(() => {
  const groups = new Map<
    string,
    { key: string; icon: string; title: string; items: PersonalSkillListItem[] }
  >();
  const ensure = (key: string, icon: string, title: string) => {
    if (!groups.has(key)) groups.set(key, { key, icon, title, items: [] });
    return groups.get(key)!;
  };
  for (const suggestion of rankedSuggestions.value) {
    if (
      suggestion.suggestedFrom === 'openclaw' ||
      suggestion.sources?.includes('openclaw')
    ) {
      ensure('openclaw', '🐾', 'OpenClaw 导入').items.push(suggestion);
    } else if (
      suggestion.suggestedFrom === 'flight_recorder' ||
      suggestion.sources?.includes('flight_recorder')
    ) {
      ensure('flight_recorder', '🛫', 'Flight Recorder 萃取').items.push(
        suggestion,
      );
    } else if (
      suggestion.sources?.some((source) =>
        ['codex', 'claude_code', 'cursor'].includes(source),
      )
    ) {
      ensure('local_agent', '💻', '本地 agent 导入').items.push(suggestion);
    } else {
      ensure('other', '🧪', '其他建议').items.push(suggestion);
    }
  }
  return Array.from(groups.values());
});

const displaySkillUrl = computed(() => {
  if (!selectedSkill.value?.share) return '使用后生成 tokenized skill URL';
  return client.buildPublicSkillUrl(selectedSkill.value.share.displayUrl);
});

const actualSkillUrl = computed(() => {
  if (!selectedSkill.value?.share) return '';
  return client.buildPublicSkillUrl(selectedSkill.value.share.urlPath);
});

const currentShareCopyReceipt = computed<ShareCopyReceipt | null>(() => {
  const receipt = shareCopyReceipt.value;
  if (!receipt) return null;
  const snapshot = receipt.snapshot;
  if (!snapshot) return receipt;
  const skill = selectedSkill.value;
  if (!skill || skill.id !== snapshot.skillId) return null;
  const currentSnapshot = buildShareCopySnapshot(
    snapshot.kind,
    snapshot.platform,
    skill,
  );
  if (!currentSnapshot) {
    return staleShareCopyReceipt(
      receipt,
      snapshot,
      '当前详情没有可访问 token URL',
    );
  }
  if (
    currentSnapshot.shareUrl === snapshot.shareUrl &&
    currentSnapshot.version === snapshot.version &&
    currentSnapshot.sha === snapshot.sha
  ) {
    return receipt;
  }
  return staleShareCopyReceipt(receipt, snapshot, currentSnapshot);
});

const bindingCards = computed<SkillPlatformBinding[]>(() => {
  if (!selectedSkill.value) return [];
  const existing = new Map(
    selectedSkill.value.bindings.map((binding) => [binding.platform, binding]),
  );
  return platformOrder.map((platform) => {
    return (
      existing.get(platform) || {
        id: `${selectedSkill.value?.id}:${platform}`,
        skillId: selectedSkill.value?.id || '',
        platform,
        state: 'not_installed',
        metadata: {},
        createdAt: 0,
        updatedAt: 0,
      }
    );
  });
});

const showDesktopAppBindingNotice = computed(() => {
  return (
    !desktopAppInstalled.value &&
    bindingCards.value.some((binding) =>
      isLocalDesktopPlatform(binding.platform),
    )
  );
});

const syncScopeOverviewTitle = computed(() => {
  const enabledTargets = syncSettings.value.filter(
    (setting) =>
      setting.enabled &&
      ['api', 'fs_via_desktop_app'].includes(setting.capability),
  ).length;
  const failedTargets = syncSettings.value.filter((setting) =>
    truncateSyncError(setting.lastError),
  ).length;
  return [
    `${activeSkillCount.value} 条 active`,
    `${enabledTargets} 个可同步平台`,
    failedTargets ? `${failedTargets} 个有失败` : '',
  ]
    .filter(Boolean)
    .join(' · ');
});

const syncScopeOverviewRows = computed<SyncResultReceiptRow[]>(() => {
  const apiEnabled = syncSettings.value.filter(
    (setting) => setting.enabled && setting.capability === 'api',
  );
  const desktopEnabled = syncSettings.value.filter(
    (setting) =>
      setting.enabled && setting.capability === 'fs_via_desktop_app',
  );
  const manualOnly = syncSettings.value.filter(
    (setting) => setting.capability === 'manual_only',
  );
  const failedTargets = syncSettings.value.filter((setting) =>
    truncateSyncError(setting.lastError),
  );
  const rows: SyncResultReceiptRow[] = [
    {
      label: '自动写入',
      text: apiEnabled.length
        ? `${platformLabels(
            apiEnabled,
          )} 已开启；每次同步作用域是所有 active 技能（${
            activeSkillCount.value
          } 条），不是单条技能。`
        : `没有远端 API 平台开启；OpenClaw 不会自动推送 ${activeSkillCount.value} 条 active 技能。`,
      tone: apiEnabled.length ? 'success' : 'info',
    },
    {
      label: '本机目录',
      text: desktopEnabled.length
        ? desktopAppInstalled.value
          ? `${platformLabels(
              desktopEnabled,
            )} 已开启；由 Desktop App 扫描和写回本机 skill 目录。`
          : `${platformLabels(
              desktopEnabled,
            )} 已开启但 Desktop App 未运行；页面不会直接读写本机目录。`
        : 'Codex CLI / Claude Code / Cursor 未开启或等待 Desktop App；当前页面不会直接写本机目录。',
      tone: desktopEnabled.length
        ? desktopAppInstalled.value
          ? 'success'
          : 'warn'
        : 'info',
    },
    {
      label: '仅手动',
      text: manualOnly.length
        ? `${platformLabels(
            manualOnly,
          )} 不参与自动同步，只能复制带 token 的安装指引。`
        : '没有 manual-only 平台参与本次配置。',
      tone: 'info',
    },
    {
      label: '失败/审核',
      text: failedTargets.length
        ? `${failedTargets.length} 个平台有最近失败：${failedSyncPreview(
            failedTargets,
          )}。同步回拉的外部变更仍只进 Inbox，不会覆盖 active 真源。`
        : '没有最近失败记录；同步回拉的外部变更仍只进 Inbox 审核，不会自动覆盖 active 真源。',
      tone: failedTargets.length ? 'warn' : 'success',
    },
  ];
  return rows;
});

async function loadData(preferredId?: string) {
  loading.value = true;
  errorMessage.value = '';
  try {
    const skillListRequest = client.getPersonalSkills({ filter: filter.value });
    const activeSkillListRequest =
      filter.value === 'active'
        ? skillListRequest
        : client.getPersonalSkills({ filter: 'active' });
    const [
      skillList,
      activeSkillList,
      suggestionList,
      snoozedSuggestionList,
      settings,
    ] = await Promise.all([
      skillListRequest,
      activeSkillListRequest,
      client.getSkillSuggestions(),
      client.getSkillSuggestions({ view: 'snoozed' }),
      client.getSkillSyncSettings(),
    ]);
    skills.value = skillList.items;
    activeSkillTotal.value = activeSkillList.total;
    suggestions.value = suggestionList.items;
    snoozedSuggestions.value = snoozedSuggestionList.items;
    syncSettings.value = settings.items;
    const visibleIds = new Set([
      ...skills.value.map((skill) => skill.id),
      ...suggestions.value.map((skill) => skill.id),
      ...snoozedSuggestions.value.map((skill) => skill.id),
    ]);
    const preferredVisibleId =
      preferredId && visibleIds.has(preferredId) ? preferredId : '';
    const currentVisibleId =
      selectedId.value && visibleIds.has(selectedId.value)
        ? selectedId.value
        : '';
    const nextId =
      preferredVisibleId ||
      currentVisibleId ||
      skills.value.find((skill) => skill.status === 'active')?.id ||
      suggestions.value[0]?.id ||
      '';
    if (nextId) await selectSkill(nextId);
    else {
      selectedId.value = '';
      selectedSkill.value = null;
      selectedSkillHealth.value = null;
      shareCopyReceipt.value = null;
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '加载个人技能失败';
  } finally {
    loading.value = false;
  }
}

async function selectSkill(id: string) {
  const switchingSkill = selectedId.value !== id;
  selectedId.value = id;
  selectedSkillHealth.value = null;
  if (switchingSkill) {
    activeTab.value = 'workflow';
    shareCopyReceipt.value = null;
  }
  try {
    selectedSkill.value = (await client.getPersonalSkill(id)).skill;
    try {
      selectedSkillHealth.value = (await client.getSkillHealth(id)).health;
    } catch {
      selectedSkillHealth.value = null;
    }
    if (
      switchingSkill &&
      selectedSkill.value?.status === 'suggestion' &&
      isSnoozedSuggestion(selectedSkill.value)
    ) {
      activeTab.value = 'evidence';
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '加载技能详情失败';
  }
}

function visibleSkillById(id: string) {
  if (selectedSkill.value?.id === id) return selectedSkill.value;
  return (
    suggestions.value.find((skill) => skill.id === id) ||
    snoozedSuggestions.value.find((skill) => skill.id === id) ||
    skills.value.find((skill) => skill.id === id)
  );
}

function externalChangeBinding(
  skill?: Pick<PersonalSkillListItem, 'bindings'> | null,
) {
  return (skill?.bindings || []).find((binding) => {
    const targetId = binding.metadata?.externalChangeFor;
    return typeof targetId === 'string' && targetId.trim().length > 0;
  });
}

function isExternalChangeSuggestion(
  skill?: Pick<PersonalSkillListItem, 'bindings'> | null,
) {
  return Boolean(externalChangeBinding(skill));
}

function externalChangeOriginalSlug(skill?: ReviewableSkill | null) {
  const originalSlug = externalChangeBinding(skill)?.metadata?.originalSlug;
  return typeof originalSlug === 'string' && originalSlug.trim()
    ? originalSlug.trim()
    : skill?.slug || 'active skill';
}

function externalChangePlatformLabel(skill?: ReviewableSkill | null) {
  const platform = externalChangeBinding(skill)?.platform;
  return platform ? platformLabel(platform) : '外部平台';
}

function requiresReview(
  skill?: Pick<
    PersonalSkillListItem,
    'reviewRequired' | 'reviewReasons'
  > | null,
) {
  return Boolean(skill?.reviewRequired || skill?.reviewReasons?.length);
}

function markSuggestionReviewed(id: string) {
  if (reviewedSuggestionIds.value.has(id)) return;
  reviewedSuggestionIds.value = new Set([...reviewedSuggestionIds.value, id]);
}

function canConfirmSuggestion(
  skill?: Pick<
    PersonalSkillListItem,
    'id' | 'reviewRequired' | 'reviewReasons'
  > | null,
) {
  if (!skill) return false;
  return !requiresReview(skill) || reviewedSuggestionIds.value.has(skill.id);
}

function suggestionPrimaryLabel(skill?: ReviewableSkill | null) {
  if (!skill || !requiresReview(skill)) return '✓ 使用';
  if (isExternalChangeSuggestion(skill)) {
    return canConfirmSuggestion(skill) ? '确认覆盖' : '查看变更';
  }
  return canConfirmSuggestion(skill) ? '确认使用' : '查看风险';
}

function reviewGateTitle(skill?: ReviewableSkill | null) {
  return isExternalChangeSuggestion(skill)
    ? '外部变更需要审核'
    : '使用前需要审核';
}

function reviewGateDescription(skill?: ReviewableSkill | null) {
  if (isExternalChangeSuggestion(skill)) {
    return `${externalChangePlatformLabel(
      skill,
    )} 检测到 ${externalChangeOriginalSlug(
      skill,
    )} 的新版本；确认后才会覆盖 Personal AI 的 active 真源版本。`;
  }
  return '这条建议可能会影响外部 agent 行为；先确认来源、证据和风险后再入库。';
}

function reviewReasons(skill: Pick<PersonalSkillListItem, 'reviewReasons'>) {
  return skill.reviewReasons?.length
    ? skill.reviewReasons
    : ['来源或风险信息需要人工确认'];
}

function reviewReasonCountLabel(
  skill: Pick<PersonalSkillListItem, 'reviewReasons'>,
) {
  const count = reviewReasons(skill).length;
  return `${count} 项原因`;
}

function reviewReasonPreview(
  skill: Pick<PersonalSkillListItem, 'reviewReasons'>,
) {
  return reviewReasons(skill).slice(0, 3);
}

function suggestionReviewFacts(skill: PersonalSkillListItem) {
  const facts = [
    isExternalChangeSuggestion(skill)
      ? `覆盖 ${externalChangeOriginalSlug(skill)}`
      : suggestionSourceLabel(skill),
    ...localSkillSourceFacts(skill),
    skill.currentVersion ? `版本 ${skill.currentVersion}` : '',
    `风险 ${skill.risk}`,
  ];
  return facts.filter(Boolean);
}

function suggestionReviewReasonText(skill: PersonalSkillListItem) {
  return reviewReasons(skill).join(' ');
}

function suggestionHasReviewReason(
  skill: PersonalSkillListItem,
  pattern: RegExp,
) {
  return pattern.test(suggestionReviewReasonText(skill));
}

function suggestionIsExternalAgentSource(skill: PersonalSkillListItem) {
  const sources = [skill.suggestedFrom, ...(skill.sources || [])]
    .filter(Boolean)
    .map((source) => String(source).toLowerCase());
  return sources.some((source) =>
    ['openclaw', 'codex', 'claude_code', 'cursor'].includes(source),
  );
}

function suggestionPriorityScore(skill: PersonalSkillListItem) {
  let score = 0;
  if (isExternalChangeSuggestion(skill)) score += 72;
  if (skill.risk === 'high') score += 30;
  else if (skill.risk === 'medium') score += 10;
  if (requiresReview(skill)) score += 24;
  score += Math.min(20, reviewReasons(skill).length * 5);
  if (suggestionIsExternalAgentSource(skill)) score += 10;
  if (localSkillSourceBinding(skill)) score += 8;
  if (suggestionHasReviewReason(skill, /可执行脚本|命令|权限/)) score += 18;
  if (suggestionHasReviewReason(skill, /安装|下载|MCP|外部依赖/)) score += 14;
  if (suggestionHasReviewReason(skill, /越界|重复资源/)) score += 12;
  if (suggestionHasReviewReason(skill, /未发现.*验证线索/)) score += 12;
  if (suggestionHasReviewReason(skill, /证据链|完整确认|推断/)) score += 10;
  if (suggestionHasReviewReason(skill, /工具调用/)) score += 8;
  return score;
}

function suggestionPriorityLabel(skill: PersonalSkillListItem) {
  if (isExternalChangeSuggestion(skill)) return '优先审覆盖';
  if (skill.risk === 'high') return '高风险先审';
  if (suggestionHasReviewReason(skill, /可执行脚本|命令|权限/)) {
    return '先看脚本';
  }
  if (suggestionHasReviewReason(skill, /安装|下载|MCP|外部依赖/)) {
    return '先看依赖';
  }
  if (suggestionHasReviewReason(skill, /未发现.*验证线索/)) {
    return '先看验证';
  }
  if (localSkillSourceBinding(skill)) return '先确认来源';
  if (requiresReview(skill)) return '先审证据';
  return '可快速处理';
}

function suggestionPriorityReasons(skill: PersonalSkillListItem) {
  const reasons: string[] = [];
  if (isExternalChangeSuggestion(skill)) {
    reasons.push(
      `${externalChangePlatformLabel(skill)} 变更会覆盖 ${externalChangeOriginalSlug(
        skill,
      )}`,
    );
  }
  if (skill.risk === 'high') {
    reasons.push('高风险技能会改变 agent 行为');
  }
  if (suggestionHasReviewReason(skill, /可执行脚本|命令|权限/)) {
    reasons.push('包含可执行脚本或权限敏感步骤');
  }
  if (suggestionHasReviewReason(skill, /安装|下载|MCP|外部依赖/)) {
    reasons.push('包含安装、下载或 MCP 连接指令');
  }
  if (suggestionHasReviewReason(skill, /越界|重复资源/)) {
    reasons.push('本机包有被忽略的越界或重复资源路径');
  }
  if (suggestionHasReviewReason(skill, /未发现.*验证线索/)) {
    reasons.push('本机包缺少测试、eval、fixture 或 verify 线索');
  }
  if (localSkillSourceBinding(skill)) {
    const summary = localSkillSourceSummary(localSkillSourceBinding(skill)!);
    if (summary) reasons.push(`来自本机目录 ${summary}`);
  }
  if (suggestionHasReviewReason(skill, /证据链|完整确认|推断/)) {
    reasons.push('证据链还不是完整确认状态');
  }
  if (requiresReview(skill) && reasons.length === 0) {
    reasons.push('需要先看来源、证据和风险');
  }
  if (reasons.length === 0) {
    reasons.push('无需强审核，可以快速入库或丢弃');
  }
  return Array.from(new Set(reasons));
}

function reviewAuditFacts(skill: PersonalSkillDetail) {
  const facts = [
    isExternalChangeSuggestion(skill)
      ? `${externalChangePlatformLabel(skill)} -> ${externalChangeOriginalSlug(
          skill,
        )}`
      : `来源 ${suggestionSourceLabel(skill)}`,
    ...localSkillSourceFacts(skill),
    skill.currentVersion ? `版本 ${skill.currentVersion}` : '',
    `风险 ${skill.risk}`,
    `${skill.evidence.length} 条证据`,
    `${skill.workflow.length} 个步骤`,
  ];
  const fileCount = skill.activeVersion?.files?.length || 0;
  if (fileCount > 0) facts.push(`${fileCount} 个资源文件`);
  return facts.filter(Boolean);
}

function openClawSyncEnabled() {
  return Boolean(
    syncSettings.value.find(
      (setting) =>
        setting.platform === 'openclaw' &&
        setting.enabled &&
        setting.capability === 'api',
    ),
  );
}

function enabledDesktopSyncPlatformLabels() {
  return syncSettings.value
    .filter(
      (setting) =>
        setting.enabled &&
        setting.capability === 'fs_via_desktop_app',
    )
    .map((setting) => platformLabel(setting.platform));
}

function suggestionDecisionReceiptTitle(skill: PersonalSkillDetail) {
  return isExternalChangeSuggestion(skill)
    ? '确认覆盖才会改写 active 真源'
    : '确认使用才会进入 active 真源';
}

function suggestionDecisionReceiptRows(
  skill: PersonalSkillDetail,
): DecisionReceiptRow[] {
  const rows: DecisionReceiptRow[] = [];
  rows.push({
    label: '动作',
    text: isExternalChangeSuggestion(skill)
      ? `${externalChangePlatformLabel(
          skill,
        )} 变更会覆盖 ${externalChangeOriginalSlug(
          skill,
        )}；未确认前只保留为 suggestion。`
      : '确认后这条 suggestion 才会提升为 active 技能；未确认前不会分发到其他平台。',
  });

  if (requiresReview(skill)) {
    rows.push({
      label: '审核',
      text: canConfirmSuggestion(skill)
        ? '证据页已打开；点击确认会立即执行入库或覆盖。'
        : '需要先查看证据、版本和风险；当前按钮只会进入审核页。',
    });
  } else {
    rows.push({
      label: '审核',
      text: '这条建议不需要强审核；仍可先查看证据和版本再使用。',
    });
  }

  const localBinding = localSkillSourceBinding(skill);
  const localSummary = localBinding ? localSkillSourceSummary(localBinding) : '';
  const localPackage = localBinding ? localSkillPackageSummary(localBinding) : '';
  const localValidation = localBinding
    ? localSkillValidationSummary(localBinding)
    : '';
  if (localSummary || localPackage || localValidation) {
    rows.push({
      label: '来源',
      text: [
        localSummary ? `本机目录 ${localSummary}` : '',
        localPackage,
        localValidation,
      ]
        .filter(Boolean)
        .join('；'),
    });
  }
  if (localBinding) {
    rows.push({
      label: '本机导入边界',
      text: localSkillImportBoundaryText(localBinding),
    });
  }

  const desktopPlatforms = enabledDesktopSyncPlatformLabels();
  const syncParts = [
    openClawSyncEnabled()
      ? '确认后会立即尝试把这条 active skill 同步到 OpenClaw remote。'
      : '本次确认不会触发 OpenClaw 即时同步。',
    desktopPlatforms.length > 0
      ? `${desktopPlatforms.join(
          '、',
        )} 已开启时等待 Desktop App 同步，不由这次点击直接写本机目录。`
      : '',
    'manual-only 平台仍只提供复制安装指引。',
  ].filter(Boolean);
  rows.push({
    label: '同步',
    text: syncParts.join(' '),
  });

  rows.push({
    label: '恢复',
    text: isExternalChangeSuggestion(skill)
      ? '不想覆盖时可丢弃或稍后审；确认覆盖后后续修正走新的 skill 版本记录。'
      : '不想入库时可丢弃或稍后审；确认入库后后续修正走 active skill 的版本记录。',
  });

  return rows;
}

function activeSkillVersionText(skill: PersonalSkillDetail) {
  const version = skill.currentVersion || skill.activeVersion?.version || 'no version';
  const sha = skill.currentSha256 || skill.activeVersion?.sha256 || '';
  const fileCount = skill.activeVersion?.files?.length || 0;
  return `${version} · sha256 ${sha ? sha.slice(0, 16) : '未返回'} · ${fileCount} 个资源文件`;
}

function skillHealthGateLabel(health: SkillHealth) {
  if (health.gateState === 'candidate') return '候选质量门控';
  if (health.gateState === 'active') return '质量门控 active';
  if (health.gateState === 'degraded') return '质量门控降级';
  if (health.gateState === 'retired') return '质量门控退役';
  return '用户钉住';
}

function skillHealthTone(health: SkillHealth): SkillHealthReceipt['tone'] {
  if (health.gateState === 'degraded' || health.gateState === 'retired') {
    return 'warn';
  }
  if (health.gateState === 'active' || health.gateState === 'user_pinned') {
    return 'success';
  }
  return 'info';
}

function skillHealthRecommendation(health: SkillHealth) {
  if (health.gateState === 'candidate') {
    return '仍在积累执行证据；可以手动查看或使用，但不要把它当成已验证稳定技能。';
  }
  if (health.gateState === 'active') {
    return '执行证据已达标，可继续作为可推荐的 active 技能使用。';
  }
  if (health.gateState === 'degraded') {
    return '已从自动推荐和注入面停用；仍可手动查看、复制安装或后续修订。';
  }
  if (health.gateState === 'retired') {
    return '已进入退役状态；不再自动推荐，后续应生成修订版本或手动复活。';
  }
  return '用户已钉住，豁免自动降级；后续执行证据仍会继续记录。';
}

function buildSkillHealthReceipt(
  skill: PersonalSkillDetail,
  health: SkillHealth,
): SkillHealthReceipt {
  const score = Number.isFinite(health.health)
    ? health.health.toFixed(2)
    : '未返回';
  const chip = skillHealthGateLabel(health);
  return {
    chip,
    title: `${chip} · ${skill.title}`,
    summary:
      '这条回执来自 Skill Quality Gate 执行账本，帮助判断技能是否适合继续推荐。',
    tone: skillHealthTone(health),
    rows: [
      {
        label: '状态',
        text: `gate_state=${health.gateState}；健康分 ${score}；成功 ${health.successCount} / 失败 ${health.failureCount}；连续失败 ${health.consecutiveFailures}。`,
      },
      {
        label: '推荐',
        text: skillHealthRecommendation(health),
      },
      {
        label: '计分',
        text: 'unknown outcome 不计入健康分母；小样本使用保守 Wilson 下界，避免过早晋升。',
      },
      {
        label: '边界',
        text: '这是只读健康回执；不会执行 skill、改变 active/suggestion/dismissed 状态、触发同步或写外部平台。',
      },
    ],
  };
}

function promotedShareReceiptText(skill: PersonalSkillDetail) {
  if (skill.share) {
    return `已生成带 token 的只读 Skill URL；短链 ${skill.share.displayUrl} 只作识别，复制安装会使用 token URL。`;
  }
  if (skill.shareError) {
    return `分享已阻断：${truncateSyncError(skill.shareError)}。`;
  }
  return '未返回可访问 URL；绑定页会继续显示分享状态。';
}

function suggestionActionVerb(
  action: SuggestionActionKind,
  skill?: PersonalSkillListItem | PersonalSkillDetail | null,
) {
  if (action === 'use') {
    return isExternalChangeSuggestion(skill) ? '确认覆盖' : '确认使用';
  }
  if (action === 'dismiss') return '丢弃';
  if (action === 'snooze') return '稍后审';
  return '现在审';
}

function buildSuggestionPendingReceipt(
  pending: PendingSuggestionAction,
): SyncResultReceipt {
  const action = suggestionActionVerb(pending.action);
  return {
    heading: '决策处理中',
    title: `正在${action} ${pending.title}`,
    summary: '请求已提交到 Memory Service，返回前写入类按钮保持锁定。',
    tone: 'info',
    rows: [
      {
        label: '状态',
        text: '等待服务端返回；本页不会重复发送使用、丢弃、稍后审或现在审请求。',
      },
      {
        label: '结果',
        text: '完成前不把这条 suggestion 当成 active、dismissed、snoozed 或已恢复。',
      },
      {
        label: '边界',
        text: '处理中回执只表示请求在途，不代表已经入库、覆盖、同步、执行 skill 或写入外部平台。',
      },
    ],
  };
}

function buildSuggestionActionFailureReceipt(
  before: PersonalSkillListItem | PersonalSkillDetail | null | undefined,
  action: SuggestionActionKind,
  errorText: string,
): SyncResultReceipt {
  const title = before?.title || '这条技能建议';
  const actionLabel = suggestionActionVerb(action, before);
  return {
    heading: `${actionLabel}失败回执`,
    title: `${actionLabel}未完成：${title}`,
    summary: 'Memory Service 没有确认这次 suggestion 决策，页面保持可重试。',
    tone: 'failed',
    rows: [
      {
        label: '状态',
        text: '未确认写入；请按当前列表状态重新判断是否重试。',
      },
      {
        label: '原因',
        text: truncateSyncError(errorText) || '请求失败，未返回详细原因。',
        tone: 'failed',
      },
      {
        label: '边界',
        text: '失败不会提升 active 真源、不会丢弃或暂缓 suggestion、不会触发同步，也不会执行 skill。',
      },
    ],
  };
}

function suggestionUseSyncReceiptText(sync?: SyncReceiptPlatformResult) {
  if (sync) {
    const writes = syncCountList([
      ['推送', sync.pushed],
      ['回拉', sync.pulled],
      ['更新绑定', sync.updated],
      ['待审核变更', sync.externalChanges],
    ]);
    const skipped = numericSyncField(sync.skipped);
    const errorSummary = syncErrorSummary(sync);
    return [
      `OpenClaw 即时同步${syncStatusLabel(sync.status)}`,
      writes || '没有需要写入远端的 skill package',
      skipped > 0 ? `跳过 ${skipped} 条` : '',
      sync.note || '',
      errorSummary,
    ]
      .filter(Boolean)
      .join('；');
  }

  const desktopPlatforms = enabledDesktopSyncPlatformLabels();
  return [
    '没有触发 OpenClaw 即时同步',
    desktopPlatforms.length > 0
      ? `${desktopPlatforms.join('、')} 等待 Desktop App 下一次同步，不由这次点击直接写本机目录`
      : '',
    'manual-only 平台不会自动写入',
  ]
    .filter(Boolean)
    .join('；');
}

function buildSuggestionUseReceipt(
  before: PersonalSkillListItem | PersonalSkillDetail | null | undefined,
  after: PersonalSkillDetail,
  sync?: SyncReceiptPlatformResult,
): SyncResultReceipt {
  const externalChange = isExternalChangeSuggestion(before);
  const target = externalChange ? externalChangeOriginalSlug(before) : after.slug;
  const syncTone = sync ? syncResultTone(sync) : 'info';
  const topTone: SyncResultReceiptTone =
    syncTone === 'failed' || after.shareError ? 'warn' : 'success';
  const rows: SyncResultReceiptRow[] = [
    {
      label: '动作',
      text: externalChange
        ? `${externalChangePlatformLabel(
            before,
          )} 的外部变更已写入 ${target} 的 active 真源；原 suggestion 已结束。`
        : 'Suggestion 已提升为 active 真源；不再留在 Inbox，也不会作为待决策建议重复出现。',
      tone: 'success',
    },
    {
      label: '真源版本',
      text: activeSkillVersionText(after),
      tone: 'success',
    },
    {
      label: '分享',
      text: promotedShareReceiptText(after),
      tone: after.shareError ? 'warn' : 'success',
    },
  ];
  const localBinding = localSkillSourceBinding(before) || localSkillSourceBinding(after);
  if (localBinding) {
    rows.push({
      label: '本机导入',
      text: localSkillImportBoundaryText(localBinding),
      tone: 'info',
    });
  }
  rows.push(
    {
      label: '同步',
      text: suggestionUseSyncReceiptText(sync),
      tone: syncTone,
    },
    {
      label: '边界',
      text: '这次点击只改变 Personal AI 技能库和已声明的同步路径；不会执行 skill、不会分析历史消息，也不会自动写入 manual-only 平台。',
    },
  );
  return {
    heading: '入库回执',
    title: externalChange ? `已确认覆盖 ${target}` : `已入库 ${after.title}`,
    summary: externalChange
      ? '外部变更已从待审 suggestion 变成 active 真源版本。'
      : '技能建议已从 Inbox 提升为 active 真源技能。',
    tone: topTone,
    rows,
  };
}

function buildSuggestionSnoozeReceipt(
  before: PersonalSkillListItem | PersonalSkillDetail | null | undefined,
  after: PersonalSkillDetail,
): SyncResultReceipt {
  const title = before?.title || after.title;
  const reviewText = requiresReview(before || after)
    ? '审核原因和证据状态已保留；恢复到 Inbox 后仍需按原 gate 查看证据或确认。'
    : '这条建议不需要强审核；恢复后仍只是待决策 suggestion。';
  return {
    heading: '稍后审回执',
    title: `已暂缓 ${title}`,
    summary: '这条技能建议已移出当前 Inbox，但还没有被使用或丢弃。',
    tone: 'info',
    rows: [
      {
        label: '状态',
        text: `仍是 suggestion；${formatSnoozedUntil(
          after.snoozedUntil,
        )} 前不参与当前待决策 Inbox。`,
      },
      {
        label: '审核',
        text: reviewText,
      },
      {
        label: '恢复',
        text: '可从“稍后建议”点“现在审”立即清除暂缓并回到 Inbox；也可以直接丢弃。',
      },
      {
        label: '边界',
        text: '稍后审没有提升 active 真源、没有覆盖现有技能、没有触发 OpenClaw 或 Desktop App 同步，也不会执行 skill 或写入 manual-only 平台。',
      },
    ],
  };
}

function buildSuggestionUnsnoozeReceipt(
  before: PersonalSkillListItem | PersonalSkillDetail | null | undefined,
  after: PersonalSkillDetail,
): SyncResultReceipt {
  const title = before?.title || after.title;
  const nextStep = requiresReview(after)
    ? '下一步仍需查看证据/风险，确认后才会入库或覆盖。'
    : '下一步可以继续查看详情、使用或丢弃。';
  return {
    heading: '恢复审阅回执',
    title: `已恢复 ${title}`,
    summary: '暂缓标记已清除，建议重新回到可审 Inbox。',
    tone: 'info',
    rows: [
      {
        label: '状态',
        text: '仍是 suggestion；snoozed_until 已清除，不再停留在稍后建议队列。',
      },
      {
        label: '下一步',
        text: nextStep,
      },
      {
        label: '边界',
        text: '现在审只恢复审阅入口，不会提升 active 真源、不会覆盖技能、不会触发同步，也不会执行 skill。',
      },
    ],
  };
}

function buildSuggestionDismissReceipt(
  before: PersonalSkillListItem | PersonalSkillDetail | null | undefined,
  after: PersonalSkillDetail,
): SyncResultReceipt {
  const title = before?.title || after.title;
  const clusterText = after.dismissReason
    ? `丢弃原因 ${after.dismissReason} 已记录；同来源重复建议会按冷却去重处理。`
    : '同来源重复建议会按冷却去重处理。';
  return {
    heading: '丢弃回执',
    title: `已丢弃 ${title}`,
    summary: '这条技能建议已结束，不再作为待决策或稍后建议出现。',
    tone: 'warn',
    rows: [
      {
        label: '状态',
        text: '状态已变为 dismissed；已从 Inbox 和稍后建议队列移除。',
      },
      {
        label: '冷却',
        text: clusterText,
      },
      {
        label: '恢复',
        text: '如需复查，可切到“已丢弃”过滤器查看记录；后续修正应重新生成或导入新的 suggestion。',
      },
      {
        label: '边界',
        text: '丢弃没有删除 active 技能、没有改写外部平台或本机目录、没有触发同步，也不会执行 skill。',
      },
    ],
  };
}

function setActiveTab(tab: SkillTab) {
  activeTab.value = tab;
  if (
    tab === 'evidence' &&
    selectedSkill.value?.status === 'suggestion' &&
    requiresReview(selectedSkill.value)
  ) {
    markSuggestionReviewed(selectedSkill.value.id);
  }
}

async function prepareSuggestionReview(id: string) {
  await selectSkill(id);
  setActiveTab('evidence');
}

function isPendingSuggestionAction(id: string) {
  return pendingSuggestionAction.value?.id === id;
}

function suggestionWriteLocked(id?: string) {
  const pending = pendingSuggestionAction.value;
  if (!pending) return false;
  return id ? Boolean(pending.id) : true;
}

function beginSuggestionAction(
  id: string,
  action: SuggestionActionKind,
  candidate: PersonalSkillListItem | PersonalSkillDetail | null | undefined,
) {
  if (pendingSuggestionAction.value) return false;
  pendingSuggestionAction.value = {
    id,
    action,
    title: candidate?.title || id,
  };
  skillActionReceipt.value = null;
  actionMessage.value = '';
  errorMessage.value = '';
  return true;
}

function finishSuggestionAction(id: string) {
  if (pendingSuggestionAction.value?.id === id) {
    pendingSuggestionAction.value = null;
  }
}

async function handleSuggestionPrimary(id: string) {
  if (pendingSuggestionAction.value) return;
  const candidate = visibleSkillById(id);
  if (isSnoozedSuggestion(candidate)) {
    await unsnoozeSuggestion(id);
    return;
  }
  if (requiresReview(candidate) && !canConfirmSuggestion(candidate)) {
    await prepareSuggestionReview(id);
    return;
  }
  await useSuggestion(id, {
    reviewConfirmed: requiresReview(candidate),
  });
}

async function useSuggestion(id: string, options: UseSuggestionOptions = {}) {
  const candidate = visibleSkillById(id);
  if (isSnoozedSuggestion(candidate)) {
    await unsnoozeSuggestion(id);
    return;
  }
  if (!options.reviewConfirmed && requiresReview(candidate)) {
    await prepareSuggestionReview(id);
    return;
  }
  if (!beginSuggestionAction(id, 'use', candidate)) return;

  try {
    const response = await client.useSkillSuggestion(id, {
      reviewConfirmed: Boolean(options.reviewConfirmed),
    });
    errorMessage.value = '';
    actionMessage.value = '';
    skillActionReceipt.value = buildSuggestionUseReceipt(
      candidate,
      response.skill,
      response.sync,
    );
    filter.value = 'active';
    await loadData(response.skill.id);
  } catch (error: any) {
    const message = error?.message || '使用技能建议失败';
    if (/Review required/i.test(error?.message || '')) {
      await prepareSuggestionReview(id);
      errorMessage.value = '使用前需要先确认审核项。';
      skillActionReceipt.value = buildSuggestionActionFailureReceipt(
        candidate,
        'use',
        '使用前需要先确认审核项。',
      );
      return;
    }
    errorMessage.value = message;
    skillActionReceipt.value = buildSuggestionActionFailureReceipt(
      candidate,
      'use',
      message,
    );
  } finally {
    finishSuggestionAction(id);
  }
}

async function dismissSuggestion(id: string) {
  const candidate = visibleSkillById(id);
  if (!beginSuggestionAction(id, 'dismiss', candidate)) return;
  try {
    const response = await client.dismissSkillSuggestion(id);
    skillActionReceipt.value = buildSuggestionDismissReceipt(
      candidate,
      response.skill,
    );
    actionMessage.value = '';
    await loadData(response.skill.id);
  } catch (error: any) {
    const message = error?.message || '丢弃技能建议失败';
    errorMessage.value = message;
    skillActionReceipt.value = buildSuggestionActionFailureReceipt(
      candidate,
      'dismiss',
      message,
    );
  } finally {
    finishSuggestionAction(id);
  }
}

async function snoozeSuggestion(id: string) {
  const candidate = visibleSkillById(id);
  if (!beginSuggestionAction(id, 'snooze', candidate)) return;
  try {
    const response = await client.snoozeSkillSuggestion(id);
    skillActionReceipt.value = buildSuggestionSnoozeReceipt(
      candidate,
      response.skill,
    );
    actionMessage.value = '';
    selectedId.value = '';
    await loadData();
  } catch (error: any) {
    const message = error?.message || '稍后审技能建议失败';
    errorMessage.value = message;
    skillActionReceipt.value = buildSuggestionActionFailureReceipt(
      candidate,
      'snooze',
      message,
    );
  } finally {
    finishSuggestionAction(id);
  }
}

async function unsnoozeSuggestion(id: string) {
  const candidate = visibleSkillById(id);
  if (!beginSuggestionAction(id, 'unsnooze', candidate)) return;
  try {
    const response = await client.unsnoozeSkillSuggestion(id);
    skillActionReceipt.value = buildSuggestionUnsnoozeReceipt(
      candidate,
      response.skill,
    );
    actionMessage.value = '';
    await loadData(response.skill.id);
  } catch (error: any) {
    const message = error?.message || '恢复技能建议失败';
    errorMessage.value = message;
    skillActionReceipt.value = buildSuggestionActionFailureReceipt(
      candidate,
      'unsnooze',
      message,
    );
  } finally {
    finishSuggestionAction(id);
  }
}

function setFilter(next: SkillFilter) {
  filter.value = next;
  void loadData();
}

function visibleBindings(skill: PersonalSkillListItem) {
  return (skill.bindings || [])
    .filter(
      (binding) =>
        binding.state === 'installed' || binding.state === 'outdated',
    )
    .slice(0, 4);
}

function tabCount(tab: SkillTab) {
  if (!selectedSkill.value) return 0;
  if (tab === 'evidence') return selectedSkill.value.evidence.length;
  if (tab === 'versions') return selectedSkill.value.versions.length;
  if (tab === 'bindings') return selectedSkill.value.bindings.length;
  return 0;
}

function platformLabel(platform: string) {
  return platformMeta[platform]?.label || platform;
}

function platformNote(platform: string) {
  return platformMeta[platform]?.note || '';
}

function platformIcon(platform: string) {
  return platformMeta[platform]?.icon || '🔌';
}

function suggestionSourceLabel(suggestion: PersonalSkillListItem) {
  if (isExternalChangeSuggestion(suggestion)) {
    return `${externalChangePlatformLabel(suggestion)} 变更`;
  }
  const localBinding = localSkillSourceBinding(suggestion);
  if (localBinding) return platformLabel(localBinding.platform);
  if (
    suggestion.suggestedFrom === 'openclaw' ||
    suggestion.sources?.includes('openclaw')
  ) {
    return 'OpenClaw';
  }
  if (
    suggestion.suggestedFrom === 'flight_recorder' ||
    suggestion.sources?.includes('flight_recorder')
  ) {
    return 'Flight Recorder';
  }
  return suggestion.suggestedFrom || suggestion.sources?.[0] || 'Suggestion';
}

function suggestionOriginText(suggestion: PersonalSkillListItem) {
  if (isExternalChangeSuggestion(suggestion)) {
    return `将覆盖 ${externalChangeOriginalSlug(suggestion)}，需先审核`;
  }
  const localBinding = localSkillSourceBinding(suggestion);
  const localSource = localBinding ? localSkillSourceSummary(localBinding) : '';
  if (localSource) return `本机目录 ${localSource}`;
  if (
    suggestion.suggestedFrom === 'openclaw' ||
    suggestion.sources?.includes('openclaw')
  ) {
    return 'OpenClaw installed skill';
  }
  if (
    suggestion.suggestedFrom === 'flight_recorder' ||
    suggestion.sources?.includes('flight_recorder')
  ) {
    return suggestion.repetition || 'Flight Recorder episode';
  }
  return suggestion.repetition || suggestion.suggestedFrom || '新的可复用流程';
}

function statusLabel(status: string) {
  if (status === 'active') return '在用';
  if (status === 'suggestion') return '萃取建议';
  if (status === 'dismissed') return '已丢弃';
  return status;
}

function workspaceStatusLabel(skill: PersonalSkillListItem) {
  if (skill.status === 'suggestion') {
    if (isSnoozedSuggestion(skill)) {
      return isExternalChangeSuggestion(skill)
        ? 'External Change · 稍后审'
        : 'Skill Suggestion · 稍后审';
    }
    if (isExternalChangeSuggestion(skill)) return 'External Change · 需审核';
    return requiresReview(skill)
      ? 'Skill Suggestion · 需审核'
      : 'Skill Suggestion';
  }
  if (skill.status === 'dismissed') return 'Dismissed Skill';
  return 'Active Skill';
}

function bindingStateLabel(state: string) {
  return (
    {
      installed: '已安装',
      outdated: '需更新',
      not_installed: '未安装',
      blocked: '受限',
      unknown: '未知',
    }[state] || state
  );
}

function isLocalDesktopPlatform(platform: string) {
  return localDesktopPlatforms.includes(platform);
}

function bindingMetadataString(binding: SkillPlatformBinding, key: string) {
  const value = binding.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function bindingMetadataStringArray(binding: SkillPlatformBinding, key: string) {
  const value = binding.metadata?.[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function bindingMetadataNumber(binding: SkillPlatformBinding, key: string) {
  const value = binding.metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function localSkillSourceBinding(
  skill?: Pick<PersonalSkillListItem, 'bindings'> | null,
) {
  return (skill?.bindings || []).find(
    (binding) =>
      isLocalDesktopPlatform(binding.platform) &&
      bindingMetadataString(binding, 'source') === 'desktop_app_fs',
  );
}

function compactLocalPath(value: string) {
  const homeCompact = value.replace(/^\/Users\/[^/]+/, '~');
  if (homeCompact.length <= 58) return homeCompact;
  return `${homeCompact.slice(0, 26)}...${homeCompact.slice(-26)}`;
}

function compactPackagePath(value: string) {
  if (value.length <= 44) return value;
  return `${value.slice(0, 20)}...${value.slice(-20)}`;
}

function formatPackagePathPreview(paths: string[]) {
  if (paths.length === 0) return '';
  const visible = paths.slice(0, 3).map(compactPackagePath);
  const overflow = paths.length - visible.length;
  return `${visible.join('、')}${overflow > 0 ? ` 等 ${paths.length} 个` : ''}`;
}

function formatByteSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function localSkillSourceSummary(binding: SkillPlatformBinding) {
  if (!isLocalDesktopPlatform(binding.platform)) return '';
  const sourcePath =
    bindingMetadataString(binding, 'sourceDirectory') ||
    bindingMetadataString(binding, 'skillMdPath') ||
    bindingMetadataString(binding, 'sourceRoot');
  return sourcePath ? compactLocalPath(sourcePath) : '';
}

function localSkillPackageSummary(binding: SkillPlatformBinding) {
  if (!isLocalDesktopPlatform(binding.platform)) return '';
  const fileCount = bindingMetadataNumber(binding, 'fileCount');
  const totalByteSize = bindingMetadataNumber(binding, 'totalByteSize');
  const rejectedFileCount = bindingMetadataNumber(
    binding,
    'rejectedFileCount',
  );
  const rejectedFilePreview = formatPackagePathPreview(
    bindingMetadataStringArray(binding, 'rejectedFilePaths'),
  );
  const parts = [
    fileCount > 0 ? `${fileCount} 个资源文件` : '',
    totalByteSize > 0 ? formatByteSize(totalByteSize) : '',
    rejectedFileCount > 0
      ? `已忽略 ${rejectedFileCount} 个越界文件${
          rejectedFilePreview ? `：${rejectedFilePreview}` : ''
        }`
      : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function localSkillValidationSummary(binding: SkillPlatformBinding) {
  if (!isLocalDesktopPlatform(binding.platform)) return '';
  const fileCount = bindingMetadataNumber(binding, 'fileCount');
  const validationFileCount = bindingMetadataNumber(
    binding,
    'validationFileCount',
  );
  const validationFilePreview = formatPackagePathPreview(
    bindingMetadataStringArray(binding, 'validationFilePaths'),
  );
  if (validationFileCount > 0) {
    return `验证线索 ${validationFileCount} 个${
      validationFilePreview ? `：${validationFilePreview}` : ''
    }`;
  }
  return fileCount > 0 ? '未发现测试/eval/fixture/verify 线索' : '';
}

function localSkillImportBoundaryText(binding: SkillPlatformBinding) {
  const source = localSkillSourceSummary(binding);
  const packageSummary = localSkillPackageSummary(binding);
  const validation = localSkillValidationSummary(binding);
  const validationBoundary = validation.includes('未发现')
    ? `${validation}，确认后仍不会被当成已验证。`
    : validation
      ? `${validation} 只是包内线索，确认时不会运行验证。`
      : '确认时不会运行测试或验证。';
  return [
    '确认只把本次扫描到的 skill package 快照写入 Personal AI active 真源。',
    packageSummary ? `扫描包：${packageSummary}。` : '',
    source
      ? `不会修改、删除、修复或反写原本机目录 ${source}。`
      : '不会修改、删除、修复或反写原本机 skill 目录。',
    '不会运行包内脚本、安装依赖、连接 MCP，或执行该 skill。',
    validationBoundary,
  ]
    .filter(Boolean)
    .join(' ');
}

function localSkillSourceFacts(
  skill?: Pick<PersonalSkillListItem, 'bindings'> | null,
) {
  const binding = localSkillSourceBinding(skill);
  if (!binding) return [];
  return [
    localSkillSourceSummary(binding)
      ? `目录 ${localSkillSourceSummary(binding)}`
      : '',
    localSkillPackageSummary(binding),
    localSkillValidationSummary(binding),
  ].filter(Boolean);
}

function isManualOnlyPlatform(platform: string) {
  return manualOnlyPlatforms.includes(platform);
}

function bindingStatusLabel(binding: SkillPlatformBinding) {
  if (isManualOnlyPlatform(binding.platform)) {
    return '手动安装';
  }
  if (isLocalDesktopPlatform(binding.platform) && !desktopAppInstalled.value) {
    return '状态未知';
  }
  return bindingStateLabel(binding.state);
}

function bindingStateClass(binding: SkillPlatformBinding) {
  if (isManualOnlyPlatform(binding.platform)) {
    return 'manual';
  }
  if (isLocalDesktopPlatform(binding.platform) && !desktopAppInstalled.value) {
    return 'unknown';
  }
  return binding.state;
}

function bindingHint(binding: SkillPlatformBinding): {
  tone: 'warn' | 'info';
  icon: string;
  title: string;
  text: string;
  cta: string;
  href?: string;
  action?: 'sync-settings';
} | null {
  const platform = platformLabel(binding.platform);
  if (isManualOnlyPlatform(binding.platform)) {
    return {
      tone: 'info',
      icon: 'i',
      title: '仅提供手动安装指引',
      text: `${platform} 暂不能由 Personal AI 自动写入或探测安装状态；复制带 token 的 Skill URL 到目标平台即可。`,
      cta: '',
    };
  }
  if (!isLocalDesktopPlatform(binding.platform)) return null;
  const setting = settingFor(binding.platform);
  if (!desktopAppInstalled.value) return null;
  if (setting && !setting.enabled) {
    return {
      tone: 'info',
      icon: 'i',
      title: '平台同步未开启',
      text: `Desktop App 已可用；在平台级自动同步里开启 ${platform} 后，会同步所有在用技能。`,
      cta: '打开同步设置',
      action: 'sync-settings',
    };
  }
  return null;
}

function evidenceStateLabel(state?: string) {
  return (
    {
      complete: '证据完整',
      partial: '部分证据',
      manual: '用户补充',
      unverified: '推断',
    }[state || ''] || '证据'
  );
}

function evidenceStateClass(state?: string) {
  if (state === 'complete') return 'pass';
  if (state === 'partial' || state === 'manual') return 'warn';
  return 'muted';
}

function formatDate(timestamp: number) {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function formatSnoozedUntil(timestamp?: number) {
  if (!timestamp) return '稍后';
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function isSnoozedSuggestion(
  skill?: Pick<PersonalSkillListItem, 'snoozedUntil'> | null,
) {
  return Boolean(
    typeof skill?.snoozedUntil === 'number' &&
      skill.snoozedUntil > Math.floor(Date.now() / 1000),
  );
}

function installCommand(platform: string) {
  const url = actualSkillUrl.value || displaySkillUrl.value;
  switch (platform) {
    case 'openclaw':
      return `skills.install --url ${url}`;
    case 'codex':
      return `请安装并使用我的个人技能：${url}`;
    case 'claude_code':
      return `Read and follow this skill spec, then install it locally: ${url}`;
    case 'cursor':
      return `Add this user-rule from URL: ${url}`;
    case 'chatgpt_gpts':
      return `请按这份 SKILL spec 工作（按需 fetch 资源）：${url}`;
    case 'claude_skills_web':
      return `Use this skill spec for the current task: ${url}`;
    default:
      return url;
  }
}

function tokenTailFromUrl(url: string) {
  try {
    const token = new URL(url, 'https://personal-ai.local').searchParams.get(
      'token',
    );
    return token ? token.slice(-10) : 'no-token';
  } catch {
    const token = url.match(/[?&]token=([^&#]+)/)?.[1];
    return token ? decodeURIComponent(token).slice(-10) : 'unknown';
  }
}

function buildShareCopySnapshot(
  kind: ShareCopyKind,
  platform?: string,
  skill = selectedSkill.value,
): ShareCopySnapshot | null {
  if (!skill?.share) return null;
  const shareUrl = client.buildPublicSkillUrl(skill.share.urlPath);
  return {
    kind,
    platform,
    skillId: skill.id,
    skillTitle: skill.title,
    displayUrl: client.buildPublicSkillUrl(skill.share.displayUrl),
    shareUrl,
    version: skill.activeVersion?.version || skill.currentVersion || 'unknown',
    sha: shortSha(skill.activeVersion?.sha256 || skill.currentSha256),
    tokenTail: tokenTailFromUrl(shareUrl),
    copiedAt: Math.floor(Date.now() / 1000),
  };
}

function shareCopyTargetLabel(snapshot: ShareCopySnapshot) {
  if (snapshot.kind === 'url') return '可访问 URL';
  return `${platformLabel(snapshot.platform || '')} 安装指令`;
}

function shareCopySnapshotText(snapshot: ShareCopySnapshot) {
  return `${snapshot.version} · sha256 ${snapshot.sha} · token ...${snapshot.tokenTail}`;
}

function staleShareCopyReceipt(
  receipt: ShareCopyReceipt,
  snapshot: ShareCopySnapshot,
  current: ShareCopySnapshot | string,
): ShareCopyReceipt {
  const currentText =
    typeof current === 'string' ? current : shareCopySnapshotText(current);
  return {
    ...receipt,
    tone: 'warn',
    title: '旧复制回执 · 当前详情已刷新',
    summary: `剪贴板仍是上次复制的${shareCopyTargetLabel(
      snapshot,
    )}；当前详情已经生成不同的 live token 或版本指纹。`,
    rows: [
      {
        label: '旧剪贴板',
        text: `复制时 ${snapshot.skillTitle} · ${shareCopySnapshotText(
          snapshot,
        )}；展示短链 ${snapshot.displayUrl} 没有复制。`,
      },
      {
        label: '当前详情',
        text: currentText,
      },
      {
        label: '恢复',
        text: `重新点击复制可访问 URL 或安装指令后再粘贴；旧 token 仍有效直到后台 revoke。`,
      },
      {
        label: '未执行',
        text: '旧复制回执只说明本机剪贴板曾被写入，不代表已打开链接、安装 skill、同步平台或执行脚本。',
      },
    ],
  };
}

function shareCopySuccessReceipt(kind: ShareCopyKind, platform?: string) {
  const platformText = platform ? platformLabel(platform) : '';
  const snapshot = buildShareCopySnapshot(kind, platform) || undefined;
  const rows: ShareReceiptRow[] = [
    ...(snapshot
      ? [
          {
            label: '复制对象',
            text: `${snapshot.skillTitle} · ${shareCopySnapshotText(
              snapshot,
            )}；短链 ${snapshot.displayUrl} 没有复制。`,
          },
        ]
      : []),
    {
      label: '剪贴板',
      text:
        kind === 'url'
          ? '已写入完整 token URL；展示短链没有复制，也不能单独用于安装。'
          : `已写入 ${platformText} 安装指令；指令内包含完整 token URL，不是展示短链。`,
    },
    {
      label: '访问范围',
      text: '持有 token 的 agent 只能只读拉取 HTML 预览、SKILL.md、package.json 和 files/* 资源。',
    },
    {
      label: '未执行',
      text: '这次复制只写本机剪贴板，不会打开链接、安装 skill、触发平台同步、写入外部平台或执行脚本。',
    },
    ...(snapshot
      ? [
          {
            label: '新鲜度',
            text: '如果详情刷新生成新 live token 或 active version 变化，本回执会标成旧复制回执；旧 token 仍有效直到后台 revoke。',
          },
        ]
      : []),
  ];
  shareCopyReceipt.value = {
    tone: 'success',
    title:
      kind === 'url'
        ? '已复制带 token 的可访问 URL'
        : `已复制 ${platformText} 安装指令`,
    summary:
      kind === 'url'
        ? '剪贴板现在是可访问凭证；继续粘贴前请确认目标 agent 可以读取该 skill。'
        : '剪贴板现在是面向目标平台的手动安装文案；复制本身没有完成安装。',
    rows,
    snapshot,
  };
}

function shareCopyFailureReceipt(kind: ShareCopyKind, platform?: string) {
  const platformText = platform ? platformLabel(platform) : '';
  shareCopyReceipt.value = {
    tone: 'warn',
    title:
      kind === 'url'
        ? '可访问 URL 未复制'
        : `${platformText} 安装指令未复制`,
    summary: '浏览器没有确认剪贴板写入；当前 skill 分享状态没有改变。',
    rows: [
      {
        label: '未写入',
        text: '没有写入剪贴板，也没有打开链接、安装 skill、触发平台同步或执行脚本。',
      },
      {
        label: '恢复',
        text: '可重新点击复制按钮，或在浏览器允许剪贴板权限后再试。',
      },
    ],
  };
}

async function copyInstallCommand(platform: string) {
  if (!selectedSkill.value?.share) return;
  try {
    await navigator.clipboard.writeText(installCommand(platform));
    shareCopySuccessReceipt('install', platform);
  } catch (error) {
    shareCopyFailureReceipt('install', platform);
  }
}

async function copySkillUrl() {
  if (!actualSkillUrl.value) return;
  try {
    await navigator.clipboard.writeText(actualSkillUrl.value);
    shareCopySuccessReceipt('url');
  } catch (error) {
    shareCopyFailureReceipt('url');
  }
}

function shortSha(value?: string) {
  return value ? value.slice(0, 12) : 'unknown';
}

function activeVersionShareSummary(skill: PersonalSkillDetail) {
  const version = skill.activeVersion;
  if (!version) return '暂无 active version';
  const fileCount = version.files?.length || 0;
  return `${version.version} · sha256 ${shortSha(version.sha256)} · ${fileCount} 个资源文件`;
}

function skillShareReceiptTitle(skill: PersonalSkillDetail) {
  if (skill.shareError) return '已阻止生成可访问 URL';
  if (skill.share) return '带 token 的只读安装入口';
  if (skill.status !== 'active') return '确认入库后才会生成分享 URL';
  return '未生成可访问 URL';
}

function skillShareReceiptRows(skill: PersonalSkillDetail): ShareReceiptRow[] {
  if (skill.shareError) {
    return [
      {
        label: '安全扫描',
        text: `${skill.shareError}；不会生成 tokenized URL。`,
      },
      {
        label: '短链边界',
        text: '展示短链不带 token，不能直接打开，也不能交给 agent 安装。',
      },
      {
        label: '处理建议',
        text: '移除疑似 secret 或敏感资源后，重新打开详情即可重新尝试生成分享 URL。',
      },
    ];
  }

  if (!skill.share) {
    return [
      {
        label: '当前状态',
        text:
          skill.status === 'active'
            ? '当前 active 技能还没有可复制 token URL。'
            : 'Suggestion 或 dismissed 记录不会暴露 public token；确认进入 active 后才会生成。',
      },
      {
        label: '访问边界',
        text: '没有 token 时，短链只用于识别 slug/version，不授予外部读取权限。',
      },
    ];
  }

  const fileCount = skill.activeVersion?.files?.length || 0;
  const fileText =
    fileCount > 0 ? ` 和 ${fileCount} 个 files/* 资源` : '';
  return [
    {
      label: '访问授权',
      text: `持有 token 的 agent 可只读拉取 HTML 预览、SKILL.md、package.json${fileText}。`,
    },
    {
      label: '复制提醒',
      text: '复制可访问 URL 或安装指令会包含 token；短链不带 token，仅用于识别 slug/version。',
    },
    {
      label: '版本指纹',
      text: activeVersionShareSummary(skill),
    },
    {
      label: '安全边界',
      text: 'Public Skill URL 不提供写入、覆盖、执行或平台同步权限；分享前已做疑似 secret 扫描。',
    },
    {
      label: '撤销边界',
      text: '详情页会生成新的 live token；旧 token 继续有效直到后台 revoke，当前页还没有单条撤销按钮。',
    },
  ];
}

function openSkillPreview() {
  if (!actualSkillUrl.value) return;
  window.open(actualSkillUrl.value, '_blank', 'noopener');
}

function settingFor(platform: string) {
  return syncSettings.value.find((setting) => setting.platform === platform);
}

function platformLabels(settings: SkillSyncSetting[]) {
  return settings.map((setting) => platformLabel(setting.platform)).join('、');
}

function failedSyncPreview(settings: SkillSyncSetting[]) {
  return settings
    .slice(0, 2)
    .map(
      (setting) =>
        `${platformLabel(setting.platform)}: ${truncateSyncError(
          setting.lastError,
        )}`,
    )
    .join('；');
}

function syncTag(platform: string) {
  const setting = settingFor(platform);
  if (!setting) return '未配置同步';
  if (setting.capability === 'internal') return '真源';
  if (setting.capability === 'manual_only') return '仅手动安装';
  if (
    setting.capability === 'fs_via_desktop_app' &&
    !desktopAppInstalled.value
  ) {
    return setting.enabled
      ? '平台同步: 开（等待 Desktop App）'
      : '平台同步: 关';
  }
  return setting.enabled ? '平台同步: 开（所有技能）' : '平台同步: 关';
}

function syncDisabled(setting: SkillSyncSetting) {
  return (
    setting.capability === 'internal' ||
    setting.capability === 'manual_only' ||
    (setting.capability === 'fs_via_desktop_app' && !desktopAppInstalled.value)
  );
}

function isAnySyncTogglePending() {
  return syncTogglePending.value !== null;
}

function isSyncTogglePending(platform: string) {
  return syncTogglePending.value?.platform === platform;
}

function syncToggleChecked(setting: SkillSyncSetting) {
  const pending = syncTogglePending.value;
  return pending?.platform === setting.platform
    ? pending.enabled
    : setting.enabled;
}

function syncWriteDisabled(setting: SkillSyncSetting) {
  return syncDisabled(setting) || syncRunning.value || isAnySyncTogglePending();
}

function syncDescription(setting: SkillSyncSetting) {
  if (setting.capability === 'internal')
    return 'Personal AI 是技能真源，始终 active。';
  if (setting.capability === 'api')
    return '通过 OpenClaw 远端 API 直连，同步状态并可回拉 SKILL 包。';
  if (setting.capability === 'fs_via_desktop_app') {
    return desktopAppInstalled.value
      ? 'Desktop App 监听本地 SKILL.md mtime + sha256。'
      : '需要 Desktop App 才能读写本地 agent skill 目录。';
  }
  return '纯 Web 平台无法写本地文件，只能复制安装指引。';
}

function syncScope(setting: SkillSyncSetting) {
  if (setting.capability === 'manual_only') return '不参与自动同步';
  if (setting.capability === 'internal') return '';
  return setting.enabled
    ? `作用域：所有 active 技能（${activeSkillCount.value} 条）`
    : `开启后将自动推送 ${activeSkillCount.value} 条 active 技能`;
}

function syncControlLabel(setting: SkillSyncSetting) {
  if (setting.capability === 'internal') return '始终开启';
  if (setting.capability === 'manual_only') return '仅手动';
  if (isSyncTogglePending(setting.platform)) {
    return syncTogglePending.value?.enabled ? '保存开启中' : '保存关闭中';
  }
  if (
    setting.capability === 'fs_via_desktop_app' &&
    !desktopAppInstalled.value
  ) {
    return '需 Desktop App';
  }
  return setting.enabled ? '已开启' : '未开启';
}

type SyncDiagnostic = {
  tone: 'ready' | 'info' | 'warn' | 'blocked';
  text: string;
};

function truncateSyncError(value?: string) {
  const trimmed = (value || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.length <= 96 ? trimmed : `${trimmed.slice(0, 93)}...`;
}

function formatSyncProbeTime(timestamp?: number) {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toISOString().replace('T', ' ').slice(0, 16);
}

function syncDiagnostics(setting: SkillSyncSetting): SyncDiagnostic[] {
  const diagnostics: SyncDiagnostic[] = [];
  if (setting.capability === 'internal') {
    diagnostics.push({ tone: 'ready', text: '真源已开启' });
  } else if (setting.capability === 'manual_only') {
    diagnostics.push({ tone: 'info', text: '仅手动安装，不参与自动写入' });
  } else if (
    setting.capability === 'fs_via_desktop_app' &&
    !desktopAppInstalled.value
  ) {
    diagnostics.push({
      tone: 'blocked',
      text: 'Desktop App 未运行，无法读写本机目录',
    });
  } else if (!setting.enabled) {
    diagnostics.push({
      tone: 'info',
      text: '同步未开启，启用后覆盖所有 active 技能',
    });
  } else if (setting.capability === 'fs_via_desktop_app') {
    diagnostics.push({ tone: 'ready', text: 'Desktop App 同步已开启' });
  } else {
    diagnostics.push({ tone: 'ready', text: '自动同步已开启' });
  }

  const lastError = truncateSyncError(setting.lastError);
  const probeTime = formatSyncProbeTime(setting.lastProbeAt);
  if (lastError) {
    diagnostics.push({
      tone: 'warn',
      text: `最近失败${probeTime ? ` ${probeTime}` : ''}: ${lastError}`,
    });
  } else if (probeTime) {
    diagnostics.push({ tone: 'info', text: `最近探测 ${probeTime}` });
  }
  return diagnostics;
}

function openSyncDialog() {
  syncDialogOpen.value = true;
}

function closeSyncDialog() {
  syncDialogOpen.value = false;
}

function numericSyncField(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function syncStatusLabel(status?: string) {
  return (
    {
      succeeded: '成功',
      skipped: '已跳过',
      failed: '失败',
      partial_failed: '部分失败',
    }[status || ''] || status ||
    '未知'
  );
}

function syncResultTone(
  result: SyncReceiptPlatformResult,
): SyncResultReceiptTone {
  const errorCount = result.errors?.length || 0;
  if (result.status === 'failed' || errorCount > 0) return 'failed';
  if (
    result.status === 'skipped' ||
    numericSyncField(result.externalChanges) > 0 ||
    numericSyncField(result.skipped) > 0 ||
    result.hasMore ||
    result.note
  ) {
    return 'warn';
  }
  return 'success';
}

function syncCountList(parts: Array<[string, unknown]>) {
  return parts
    .map(([label, value]) => [label, numericSyncField(value)] as const)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => `${label} ${value} 条`)
    .join('；');
}

function syncErrorSummary(result: SyncReceiptPlatformResult) {
  const errors = result.errors || [];
  if (errors.length === 0) return '';
  const preview = errors
    .slice(0, 2)
    .map((error) =>
      [error.slug, truncateSyncError(error.error)].filter(Boolean).join(': '),
    )
    .join('；');
  return errors.length > 2 ? `${preview}；另 ${errors.length - 2} 条` : preview;
}

function buildSyncResultReceipt(
  result: SyncReceiptPlatformResult,
  source: 'openclaw' | 'desktop',
): SyncResultReceipt {
  const platform = platformLabel(result.platform);
  const tone = syncResultTone(result);
  const processed = numericSyncField(result.processed);
  const scanned = numericSyncField(result.scanned);
  const totalRemote = numericSyncField(result.totalRemote);
  const candidates = numericSyncField(result.candidates);
  const scopeFacts = [
    scanned > 0 ? `扫描 ${scanned} 条` : '',
    totalRemote > 0 ? `远端 ${totalRemote} 条` : '',
    candidates > 0 ? `候选 ${candidates} 条` : '',
    processed > 0 ? `处理 ${processed} 条` : '',
    result.root ? `目录 ${compactLocalPath(result.root)}` : '',
  ].filter(Boolean);
  const personalAiChanges = syncCountList([
    ['新增 suggestion', result.imported],
    ['更新绑定', result.updated],
    ['待审核变更', result.externalChanges],
  ]);
  const platformWrites = syncCountList([
    ['回拉', result.pulled],
    ['推送', result.pushed],
  ]);
  const externalChanges = numericSyncField(result.externalChanges);
  const skipped = numericSyncField(result.skipped);
  const errorSummary = syncErrorSummary(result);
  const rows: SyncResultReceiptRow[] = [
    {
      label: '结果',
      text: [
        syncStatusLabel(result.status),
        scopeFacts.length ? scopeFacts.join('；') : '本次没有可处理项目',
      ].join('；'),
      tone,
    },
    {
      label: 'Personal AI',
      text:
        personalAiChanges ||
        '没有新增 suggestion、active 覆盖或绑定写入。',
    },
    {
      label: source === 'desktop' ? '本机目录' : '远端平台',
      text:
        platformWrites ||
        (result.status === 'skipped'
          ? '本次未写入目标平台。'
          : '本次没有需要写入目标平台的 skill package。'),
    },
    {
      label: '待处理',
      text: externalChanges
        ? `顶部 Inbox 有 ${externalChanges} 条外部变更待审核；未确认前不会覆盖 active 真源。`
        : result.hasMore
        ? '远端仍有更多技能，可继续同步下一批。'
        : '没有新的外部变更等待审核。',
      tone: externalChanges || result.hasMore ? 'warn' : 'success',
    },
  ];

  if (skipped > 0 || result.note || errorSummary) {
    rows.push({
      label: errorSummary ? '失败/跳过' : '跳过',
      text: [
        skipped > 0 ? `跳过 ${skipped} 条` : '',
        result.note || '',
        errorSummary,
      ]
        .filter(Boolean)
        .join('；'),
      tone: errorSummary ? 'failed' : 'warn',
    });
  }

  rows.push({
    label: '边界',
    text: `${platform} 本次同步只影响这个平台与 Personal AI 技能库；manual-only 平台不会被自动写入，skill 不会被执行，外部变更仍要用户在 Inbox 确认。`,
  });

  return {
    title: `${platform} ${syncStatusLabel(result.status)}`,
    summary: [
      platform,
      source === 'desktop' ? 'Desktop App 本机同步' : '远端 API 同步',
      externalChanges ? `${externalChanges} 条待审` : '无待审变更',
      errorSummary ? '有失败项' : '',
    ]
      .filter(Boolean)
      .join(' · '),
    tone,
    rows,
  };
}

function buildSyncErrorReceipt(
  platform: string,
  message: string,
  source: 'openclaw' | 'desktop',
): SyncResultReceipt {
  return buildSyncResultReceipt(
    {
      platform,
      status: 'failed',
      processed: 0,
      imported: 0,
      updated: 0,
      pulled: 0,
      pushed: 0,
      externalChanges: 0,
      skipped: 0,
      errors: [{ error: message }],
    },
    source,
  );
}

function buildSyncPendingReceipt(
  platformId: string,
  source: 'openclaw' | 'desktop',
): SyncResultReceipt {
  const platform = platformLabel(platformId);
  const rows: SyncResultReceiptRow[] = [
    {
      label: '请求对象',
      text:
        source === 'desktop'
          ? `${platform} 正在通过本机 Desktop App 发起同步；Chrome 页面不会直接读写 skill 目录。`
          : `${platform} 正在通过 Memory Service 请求远端 API 同步；返回前不能确认远端状态。`,
      tone: 'info',
    },
    {
      label: '本次范围',
      text:
        source === 'desktop'
          ? `Desktop App 会扫描/处理 ${platform} 的本机 skill 目录，并对照 ${activeSkillCount.value} 条 active 真源技能。`
          : `OpenClaw 同步会按当前配置处理最多 10 条候选/active package，并对照 ${activeSkillCount.value} 条 active 真源技能。`,
      tone: 'info',
    },
    {
      label: '等待确认',
      text: '请求返回前还没有确认新增 suggestion、更新 binding、推送、回拉、安装或外部写入。',
      tone: 'warn',
    },
    {
      label: '边界',
      text: '同步处理中不会执行 skill、不会写 manual-only 平台，也不会自动覆盖 active 真源；外部变更仍只进入 Inbox 审核。',
      tone: 'info',
    },
  ];
  return {
    heading: '同步处理中',
    title: `${platform} 同步请求已发出`,
    summary:
      source === 'desktop'
        ? `${platform} · Desktop App 本机同步 · 等待本机扫描/写回结果`
        : `${platform} · 远端 API 同步 · 等待 Memory Service 返回结果`,
    tone: 'info',
    rows,
  };
}

function syncToggleEffectText(
  setting: SkillSyncSetting,
  enabled: boolean,
): string {
  if (setting.capability === 'api') {
    return enabled
      ? `后续平台级同步会把 ${activeSkillCount.value} 条 active 技能纳入 ${platformLabel(
          setting.platform,
        )} 推送/回拉范围。`
      : `后续自动同步不会再推送 ${activeSkillCount.value} 条 active 技能到 ${platformLabel(
          setting.platform,
        )}。`;
  }
  if (setting.capability === 'fs_via_desktop_app') {
    return enabled
      ? `后续 Desktop App 同步会扫描/写回 ${platformLabel(
          setting.platform,
        )} 本机 skill 目录；当前页面仍不会直接读写文件。`
      : `后续 Desktop App 同步不会再写回 ${platformLabel(
          setting.platform,
        )} 本机 skill 目录。`;
  }
  return enabled
    ? '配置已保存；这个平台仍按自身能力边界运行。'
    : '配置已保存；这个平台不会参与自动同步。';
}

function syncToggleNoMutationText(
  setting: SkillSyncSetting,
  enabled: boolean,
): string {
  if (setting.capability === 'fs_via_desktop_app') {
    return enabled
      ? '保存开关不会立刻扫描、写入或安装本机 skill；需要点击立即同步或等待 Desktop App 下一轮同步。'
      : '关闭开关不会删除、修复或回滚本机 skill 目录里已有文件。';
  }
  if (setting.capability === 'api') {
    return enabled
      ? '保存开关不会立刻调用远端 API；需要点击立即同步或等待后台同步任务。'
      : '关闭开关不会删除远端已安装 skill，也不会撤销已经生成的 Public Skill URL。';
  }
  return '保存开关不会执行 skill、不会写 manual-only 平台，也不会改变 active 真源内容。';
}

function buildSyncTogglePendingReceipt(
  setting: SkillSyncSetting,
  enabled: boolean,
): SyncResultReceipt {
  const platform = platformLabel(setting.platform);
  return {
    heading: '开关保存中',
    title: `${platform} ${enabled ? '开启' : '关闭'}请求已发出`,
    summary: `等待 Memory Service 确认 ${platform} 平台级同步开关；当前还没有执行同步。`,
    tone: 'info',
    rows: [
      {
        label: '请求对象',
        text: `正在保存 ${platform} enabled=${String(
          enabled,
        )}；这是平台级设置，不是单条 skill 设置。`,
        tone: 'info',
      },
      {
        label: '等待确认',
        text: '返回前不能确认开关已保存；页面会暂时锁定其它同步开关和立即同步按钮。',
        tone: 'warn',
      },
      {
        label: '后续范围',
        text: syncToggleEffectText(setting, enabled),
        tone: enabled ? 'success' : 'warn',
      },
      {
        label: '本次未做',
        text: syncToggleNoMutationText(setting, enabled),
        tone: 'info',
      },
      {
        label: '边界',
        text: '保存处理中不会执行 skill、不会写 manual-only 平台、不会读写本机目录或远端平台，也不会覆盖 active 真源。',
        tone: 'info',
      },
    ],
  };
}

function buildSyncToggleReceipt(
  setting: SkillSyncSetting,
  enabled: boolean,
  persistedSetting?: SkillSyncSetting,
): SyncResultReceipt {
  const platform = platformLabel(setting.platform);
  const finalSetting = persistedSetting || { ...setting, enabled };
  return {
    heading: '开关回执',
    title: `${platform} ${enabled ? '已开启' : '已关闭'}`,
    summary: `${platform} 平台级同步开关已保存；本次没有立即执行同步。`,
    tone: enabled ? 'success' : 'warn',
    rows: [
      {
        label: '保存配置',
        text: `Memory Service 已确认 ${platform} 的 enabled=${String(
          finalSetting.enabled,
        )}；这是平台级设置，不是单条 skill 设置。`,
        tone: 'success',
      },
      {
        label: '后续范围',
        text: syncToggleEffectText(finalSetting, enabled),
        tone: enabled ? 'success' : 'warn',
      },
      {
        label: '本次未做',
        text: syncToggleNoMutationText(finalSetting, enabled),
        tone: 'info',
      },
      {
        label: '排除范围',
        text: 'manual-only 平台不会因为这个开关被自动写入；外部回拉变更仍只进入 Inbox 审核，不会覆盖 active 真源。',
        tone: 'info',
      },
    ],
  };
}

function buildSyncToggleErrorReceipt(
  setting: SkillSyncSetting,
  attemptedEnabled: boolean,
  message: string,
): SyncResultReceipt {
  const platform = platformLabel(setting.platform);
  return {
    heading: '开关回执',
    title: `${platform} 保存失败`,
    summary: `${platform} 平台级同步开关没有保存；页面已回到原开关状态。`,
    tone: 'failed',
    rows: [
      {
        label: '未保存',
        text: `Memory Service 未确认 enabled=${String(
          attemptedEnabled,
        )}；当前仍按原配置 enabled=${String(setting.enabled)} 显示。`,
        tone: 'failed',
      },
      {
        label: '失败原因',
        text: truncateSyncError(message) || '未知错误',
        tone: 'failed',
      },
      {
        label: '本次未做',
        text: '没有触发同步、没有写远端平台、没有读写本机目录、没有执行 skill，也没有写入 manual-only 平台。',
        tone: 'info',
      },
    ],
  };
}

async function toggleSync(setting: SkillSyncSetting, event: Event) {
  const input = event.target as HTMLInputElement;
  if (syncWriteDisabled(setting)) {
    input.checked = syncToggleChecked(setting);
    return;
  }
  const nextEnabled = input.checked;
  syncTogglePending.value = {
    platform: setting.platform,
    enabled: nextEnabled,
  };
  syncResultMessage.value = '';
  errorMessage.value = '';
  syncResultReceipt.value = buildSyncTogglePendingReceipt(setting, nextEnabled);
  try {
    const result = await client.updateSkillSyncSetting(
      setting.platform,
      nextEnabled,
    );
    const index = syncSettings.value.findIndex(
      (item) => item.platform === setting.platform,
    );
    if (index >= 0) syncSettings.value[index] = result.setting;
    syncResultReceipt.value = buildSyncToggleReceipt(
      setting,
      nextEnabled,
      result.setting,
    );
  } catch (error: any) {
    const message = error?.message || '更新同步设置失败';
    errorMessage.value = message;
    syncResultReceipt.value = buildSyncToggleErrorReceipt(
      setting,
      nextEnabled,
      message,
    );
    input.checked = setting.enabled;
  } finally {
    syncTogglePending.value = null;
  }
}

async function runOpenClawSync() {
  syncRunning.value = true;
  syncResultMessage.value = '';
  syncResultReceipt.value = buildSyncPendingReceipt('openclaw', 'openclaw');
  try {
    const result = await client.runSkillSync({
      platform: 'openclaw',
      limit: 10,
    });
    const openclaw = result.platforms.find(
      (item) => item.platform === 'openclaw',
    );
    if (!openclaw) {
      syncResultReceipt.value = buildSyncResultReceipt(
        {
          platform: 'openclaw',
          status: 'skipped',
          processed: 0,
          imported: 0,
          updated: 0,
          pulled: 0,
          pushed: 0,
          externalChanges: 0,
          skipped: 0,
          errors: [],
          note: 'OpenClaw 未参与本次同步。',
        },
        'openclaw',
      );
    } else if (openclaw.status === 'failed') {
      syncResultReceipt.value = buildSyncResultReceipt(openclaw, 'openclaw');
      await loadData(selectedId.value);
    } else {
      syncResultReceipt.value = buildSyncResultReceipt(openclaw, 'openclaw');
      await loadData(selectedId.value);
    }
  } catch (error: any) {
    syncResultReceipt.value = buildSyncErrorReceipt(
      'openclaw',
      error?.message || 'OpenClaw 同步失败',
      'openclaw',
    );
  } finally {
    syncRunning.value = false;
  }
}

async function runDesktopSkillSync(platform: string) {
  syncRunning.value = true;
  syncResultMessage.value = '';
  syncResultReceipt.value = buildSyncPendingReceipt(platform, 'desktop');
  try {
    await desktopClient.loadSettings();
    const result = await desktopClient.syncSkills(platform);
    const item = result.platforms.find(
      (platformResult) => platformResult.platform === platform,
    );
    if (!item) {
      syncResultReceipt.value = buildSyncResultReceipt(
        {
          platform,
          status: 'skipped',
          processed: 0,
          imported: 0,
          updated: 0,
          pulled: 0,
          pushed: 0,
          externalChanges: 0,
          skipped: 0,
          errors: [],
          note: `${platformLabel(platform)} 未参与本次同步。`,
        },
        'desktop',
      );
    } else {
      syncResultReceipt.value = buildSyncResultReceipt(item, 'desktop');
      await loadData(selectedId.value);
    }
  } catch (error: any) {
    syncResultReceipt.value = buildSyncErrorReceipt(
      platform,
      error?.message || `${platformLabel(platform)} 同步失败`,
      'desktop',
    );
  } finally {
    syncRunning.value = false;
  }
}

onMounted(() => {
  void loadData();
  void desktopClient
    .loadSettings()
    .then(() => desktopClient.getHealth())
    .then(() => {
      desktopAppInstalled.value = true;
    })
    .catch(() => {
      desktopAppInstalled.value = false;
    });
});
</script>

<style scoped>
.skills-page {
  color-scheme: dark;
  --ink: #f8fafc;
  --ink-2: #e2e8f0;
  --muted: #94a3b8;
  --muted-2: #64748b;
  --line: rgba(148, 163, 184, 0.12);
  --line-strong: rgba(148, 163, 184, 0.22);
  --panel: rgba(15, 23, 42, 0.6);
  --panel-2: rgba(15, 23, 42, 0.78);
  --panel-3: rgba(30, 41, 59, 0.55);
  --accent: #60a5fa;
  --accent-2: #a78bfa;
  --green: #22c55e;
  --amber: #f59e0b;
  --red: #ef4444;
  --code-bg: rgba(2, 6, 23, 0.65);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: var(--ink);
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, sans-serif;
}

button,
input {
  font: inherit;
  color: inherit;
}

.page-header,
.workspace-head,
.sync-dialog header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.45rem;
  font-weight: 700;
  margin: 0.2rem 0 0;
  line-height: 1.2;
}

.page-title-mark {
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 0.55rem;
  background: linear-gradient(
    135deg,
    rgba(96, 165, 250, 0.32),
    rgba(167, 139, 250, 0.32)
  );
  border: 1px solid rgba(167, 139, 250, 0.45);
  display: grid;
  place-items: center;
  font-size: 1.1rem;
}

.page-eyebrow,
.workspace-title .eyebrow {
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.workspace-title .workspace-eyebrow {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.health-gate-chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.3rem;
  padding: 0.14rem 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(96, 165, 250, 0.28);
  background: rgba(96, 165, 250, 0.1);
  color: #bfdbfe;
  font-size: 0.66rem;
  line-height: 1.2;
  text-transform: none;
  letter-spacing: 0;
}

.health-gate-chip.success {
  border-color: rgba(34, 197, 94, 0.26);
  background: rgba(34, 197, 94, 0.09);
  color: #bbf7d0;
}

.health-gate-chip.warn {
  border-color: rgba(245, 158, 11, 0.36);
  background: rgba(245, 158, 11, 0.12);
  color: #fde68a;
}

.page-subtitle {
  margin-top: 0.4rem;
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.55;
  max-width: 720px;
}

.header-actions,
.workspace-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.capture-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.32);
  color: var(--green);
  font-size: 0.75rem;
  font-weight: 600;
}

.pulse {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
  animation: pulse 1.6s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

button,
.btn,
.secondary-btn,
.primary-btn,
.icon-btn {
  border: 1px solid var(--line-strong);
  background: rgba(15, 23, 42, 0.55);
  color: var(--ink-2);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  border-color: rgba(96, 165, 250, 0.32);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.btn {
  height: 2rem;
  padding: 0 0.85rem;
  font-weight: 600;
  font-size: 0.78rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.btn.primary,
.primary-btn {
  background: linear-gradient(
    135deg,
    rgba(96, 165, 250, 0.85),
    rgba(167, 139, 250, 0.85)
  );
  border-color: rgba(167, 139, 250, 0.6);
  color: #fff;
}

.btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(96, 165, 250, 0.32);
}

.btn.secondary,
.secondary-btn {
  background: rgba(15, 23, 42, 0.55);
  border-color: var(--line-strong);
  color: var(--ink-2);
}

.btn.secondary:hover,
.secondary-btn:hover {
  background: rgba(96, 165, 250, 0.12);
  border-color: rgba(96, 165, 250, 0.32);
  color: #93c5fd;
}

.btn.danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.32);
  color: var(--red);
}

.btn.danger:hover {
  background: rgba(239, 68, 68, 0.18);
}

.icon-btn {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  padding: 0;
}

.sync-now-btn {
  color: #bfdbfe;
}

.inbox-bar {
  background: linear-gradient(
    135deg,
    rgba(96, 165, 250, 0.08),
    rgba(167, 139, 250, 0.08)
  );
  border: 1px solid rgba(167, 139, 250, 0.28);
  border-radius: 0.85rem;
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.inbox-bar.collapsed {
  cursor: pointer;
}

.inbox-bar.collapsed:hover {
  border-color: rgba(167, 139, 250, 0.5);
}

.inbox-bar-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  cursor: pointer;
}

.inbox-bar-head .icon {
  font-size: 1.1rem;
}

.inbox-bar-head .title {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--ink);
}

.inbox-bar-head .meta {
  font-size: 0.74rem;
  color: var(--muted);
  flex: 1;
}

.bell-dot {
  display: inline-flex;
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45);
  animation: pulse 1.6s infinite;
  margin-left: 0.25rem;
}

.toggle {
  flex: none;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--line-strong);
  color: var(--ink-2);
  font-size: 0.95rem;
}

.inbox-bar-body {
  border-top: 1px solid rgba(167, 139, 250, 0.18);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem 1rem 0.85rem;
}

.inbox-push-hint {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  font-size: 0.74rem;
  color: var(--muted);
  line-height: 1.55;
}

.inbox-push-hint .icon {
  flex: none;
  font-size: 0.95rem;
}

.inbox-push-hint strong {
  color: var(--ink-2);
  font-weight: 700;
}

.inbox-priority {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.7rem;
  align-items: center;
  padding: 0.7rem 0.8rem;
  border: 1px solid rgba(96, 165, 250, 0.26);
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.55);
}

.priority-main {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
}

.priority-kicker {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  font-size: 0.68rem;
  font-weight: 700;
  color: #bfdbfe;
}

.priority-kicker em {
  font-style: normal;
  color: var(--muted-2);
  font-weight: 650;
}

.priority-main strong {
  color: var(--ink);
  font-size: 0.88rem;
  line-height: 1.3;
}

.priority-main p {
  margin: 0;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.45;
}

.priority-facts {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.priority-facts span {
  padding: 0.12rem 0.45rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.08);
  color: #dbeafe;
  font-size: 0.66rem;
  font-weight: 650;
}

.inbox-priority .btn {
  min-width: 6rem;
  justify-content: center;
}

.suggestion-decision-overview {
  display: grid;
  gap: 0.65rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 0.85rem;
  background: rgba(15, 23, 42, 0.5);
}

.decision-overview-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.decision-overview-head span {
  font-size: 0.72rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0;
}

.decision-overview-head strong {
  font-size: 0.92rem;
  color: var(--ink);
}

.decision-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.decision-overview-row {
  min-height: 5.1rem;
  display: grid;
  align-content: start;
  gap: 0.32rem;
  padding: 0.62rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.42);
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.45;
}

.decision-overview-row.success {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.07);
}

.decision-overview-row.warn {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(245, 158, 11, 0.08);
}

.decision-overview-row .label {
  color: var(--ink-2);
  font-size: 0.68rem;
  font-weight: 750;
}

.suggestion-empty-receipt {
  display: grid;
  gap: 0.65rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(34, 197, 94, 0.24);
  border-radius: 0.85rem;
  background: rgba(15, 23, 42, 0.5);
}

.empty-receipt-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.empty-receipt-head span {
  font-size: 0.72rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0;
}

.empty-receipt-head strong {
  font-size: 0.92rem;
  color: #bbf7d0;
}

.empty-receipt-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.empty-receipt-row {
  min-height: 5.1rem;
  display: grid;
  align-content: start;
  gap: 0.32rem;
  padding: 0.62rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.42);
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.45;
}

.empty-receipt-row.success {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.07);
}

.empty-receipt-row .label {
  color: var(--ink-2);
  font-size: 0.68rem;
  font-weight: 750;
}

.suggestion-list {
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: thin;
}

.suggestion-groups {
  display: grid;
  gap: 0.75rem;
}

.suggestion-group {
  display: grid;
  gap: 0.45rem;
}

.suggestion-group-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.74rem;
  color: var(--muted);
}

.suggestion-group-head strong {
  color: var(--ink-2);
  font-weight: 700;
}

.suggestion-group-head em {
  font-style: normal;
  color: var(--muted-2);
}

.suggestion-card {
  flex: 0 0 280px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid var(--line-strong);
  border-radius: 0.65rem;
  padding: 0.7rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.2s, transform 0.2s;
  cursor: pointer;
}

.suggestion-card:hover,
.suggestion-card.active {
  border-color: rgba(96, 165, 250, 0.45);
  transform: translateY(-1px);
}

.suggestion-card.pending {
  border-color: rgba(56, 189, 248, 0.52);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.12);
}

.suggestion-card .top {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  justify-content: space-between;
}

.suggestion-card .title {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
}

.suggestion-card .when {
  flex: none;
  font-size: 0.66rem;
  color: var(--muted);
  padding: 0.1rem 0.4rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--line);
  border-radius: 999px;
}

.review-chip {
  flex: none;
  font-size: 0.66rem;
  color: #fbbf24;
  padding: 0.1rem 0.4rem;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 999px;
  font-weight: 700;
}

.change-chip {
  flex: none;
  font-size: 0.66rem;
  color: #93c5fd;
  padding: 0.1rem 0.4rem;
  background: rgba(96, 165, 250, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 999px;
  font-weight: 700;
}

.suggestion-card .desc {
  font-size: 0.74rem;
  color: var(--muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.suggestion-card .source {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  color: var(--muted-2);
}

.source-link {
  color: #93c5fd;
  text-decoration: none;
}

.review-preview {
  display: grid;
  gap: 0.35rem;
  padding: 0.55rem 0.6rem;
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 0.5rem;
  background: rgba(245, 158, 11, 0.07);
  color: var(--muted);
}

.review-preview.ready {
  border-color: rgba(34, 197, 94, 0.24);
  background: rgba(34, 197, 94, 0.07);
}

.review-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fcd34d;
}

.review-preview.ready .review-preview-head {
  color: #86efac;
}

.review-preview-head em {
  flex: none;
  font-style: normal;
  font-weight: 600;
  color: var(--muted-2);
}

.review-preview ul {
  margin: 0;
  padding-left: 0.9rem;
  font-size: 0.68rem;
  line-height: 1.45;
}

.review-preview-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.review-preview-pills span {
  min-width: 0;
  padding: 0.12rem 0.4rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.42);
  color: var(--ink-2);
  font-size: 0.64rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.suggestion-card .actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.3rem;
  margin-top: auto;
}

.suggestion-card .btn {
  height: 1.7rem;
  padding: 0 0.55rem;
  font-size: 0.72rem;
  justify-content: center;
}

.snoozed-inbox {
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 0.85rem;
  background: rgba(15, 23, 42, 0.45);
}

.snoozed-inbox-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.snoozed-inbox-head div {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.snoozed-inbox-head strong {
  font-size: 0.84rem;
  color: var(--ink-2);
}

.snoozed-inbox-head span {
  font-size: 0.72rem;
  color: var(--muted);
}

.snoozed-suggestion-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.55rem;
}

.snoozed-suggestion-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.45rem 0.65rem;
  align-items: center;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--line-strong);
  border-radius: 0.65rem;
  background: rgba(15, 23, 42, 0.62);
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
}

.snoozed-suggestion-card:hover,
.snoozed-suggestion-card.active {
  border-color: rgba(96, 165, 250, 0.42);
  transform: translateY(-1px);
}

.snoozed-suggestion-card.pending {
  border-color: rgba(56, 189, 248, 0.52);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.12);
}

.snoozed-card-main {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
}

.snoozed-card-main strong {
  color: var(--ink);
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snoozed-card-main span,
.snoozed-card-meta {
  color: var(--muted);
  font-size: 0.7rem;
}

.snoozed-card-meta {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  grid-column: 1 / 2;
}

.snoozed-card-meta span {
  padding: 0.1rem 0.38rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.38);
}

.snoozed-card-actions {
  display: flex;
  gap: 0.35rem;
  grid-row: 1 / span 2;
  grid-column: 2 / 3;
}

.snoozed-card-actions .btn {
  height: 1.7rem;
  padding: 0 0.55rem;
  font-size: 0.72rem;
}

.status-box,
.empty-card,
.empty-workspace {
  border: 1px solid var(--line-strong);
  background: rgba(15, 23, 42, 0.58);
  border-radius: 0.6rem;
  padding: 0.85rem;
  color: var(--muted);
}

.status-box.error {
  border-color: rgba(239, 68, 68, 0.45);
  color: #fecaca;
}

.status-box.info {
  border-color: rgba(96, 165, 250, 0.36);
  color: #bfdbfe;
}

.foundry-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 1rem;
  flex: none;
  align-items: start;
  min-height: 0;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 0.85rem;
  backdrop-filter: blur(16px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.rail-head {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.04), transparent);
}

.rail-search {
  width: 100%;
  padding: 0.55rem 0.8rem;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid var(--line-strong);
  border-radius: 0.55rem;
  color: var(--ink);
  font-size: 0.84rem;
}

.rail-search:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.12);
}

.rail-segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
  margin-top: 0.6rem;
  padding: 0.25rem;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--line);
  border-radius: 0.55rem;
}

.rail-segmented button {
  border: none;
  background: transparent;
  border-radius: 0.4rem;
  padding: 0.4rem 0.2rem;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.rail-segmented button.active {
  background: rgba(96, 165, 250, 0.18);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.32);
}

.candidate-list {
  flex: none;
  overflow: visible;
  padding: 0.6rem;
  display: grid;
  align-content: start;
  gap: 0.6rem;
}

.candidate {
  width: 100%;
  text-align: left;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid var(--line);
  border-radius: 0.65rem;
  padding: 0.85rem;
  display: grid;
  gap: 0.55rem;
  color: inherit;
}

.candidate:hover {
  border-color: rgba(96, 165, 250, 0.32);
  transform: translateY(-1px);
}

.candidate.active {
  border-color: rgba(167, 139, 250, 0.55);
  background: rgba(76, 29, 149, 0.18);
  box-shadow: inset 3px 0 0 var(--accent-2);
}

.candidate-top,
.evidence-head,
.version-head,
.binding-head {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: flex-start;
}

.candidate h3,
.evidence-card h3,
.version-card h3 {
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.25;
  margin: 0;
}

.candidate p,
.evidence-card p,
.version-card p {
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.45;
  margin: 0;
}

.risk {
  flex: none;
  border-radius: 999px;
  padding: 0.18rem 0.45rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border: 1px solid;
}

.risk.low {
  color: var(--green);
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.32);
}

.risk.medium {
  color: var(--amber);
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.32);
}

.risk.high {
  color: var(--red);
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.32);
}

.candidate-bindings,
.binding-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.candidate-bindings .label {
  font-size: 0.66rem;
  color: var(--muted-2);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-right: 0.15rem;
}

.binding-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.16rem 0.45rem;
  border: 1px solid var(--line-strong);
  border-radius: 0.35rem;
  background: rgba(15, 23, 42, 0.6);
  color: var(--ink-2);
  font-size: 0.68rem;
  font-weight: 600;
}

.binding-pill .dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--muted);
}

.binding-pill.installed .dot {
  background: var(--green);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.18);
}

.binding-pill.outdated .dot {
  background: var(--amber);
}

.binding-pill.blocked .dot {
  background: var(--red);
}

.candidate-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--muted);
  padding-top: 0.2rem;
  border-top: 1px dashed var(--line);
}

.candidate-status .badge {
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  font-weight: 600;
}

.candidate-status .badge.active {
  background: rgba(34, 197, 94, 0.14);
  color: var(--green);
}

.candidate-status .badge.dismissed {
  background: rgba(148, 163, 184, 0.14);
  color: var(--muted);
}

.workspace-head {
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(167, 139, 250, 0.06), transparent);
}

.workspace-title h2 {
  font-size: 1.18rem;
  line-height: 1.25;
  font-weight: 700;
  margin: 0.25rem 0 0;
}

.workspace-title p {
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.55;
  margin-top: 0.45rem;
  max-width: 620px;
}

.workspace-tabs {
  display: flex;
  gap: 0.4rem;
  padding: 0.55rem 1.2rem;
  border-bottom: 1px solid var(--line);
  background: rgba(2, 6, 23, 0.32);
  overflow-x: auto;
}

.tab-btn {
  padding: 0.45rem 0.9rem;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.tab-btn:hover {
  background: rgba(96, 165, 250, 0.1);
  color: #93c5fd;
}

.tab-btn.active {
  background: rgba(167, 139, 250, 0.18);
  color: var(--accent-2);
  box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.32);
}

.tab-badge {
  margin-left: 0.4rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 700;
}

.workspace-content {
  flex: none;
  overflow: visible;
  padding: 1.1rem 1.2rem;
}

.detail-section {
  display: grid;
  gap: 0.85rem;
}

.section {
  background: var(--panel-3);
  border: 1px solid var(--line);
  border-radius: 0.7rem;
  overflow: hidden;
}

.section-head {
  padding: 0.7rem 0.95rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.4);
}

.section-head h3 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink);
}

.section-head h3 .icon {
  margin-right: 0.4rem;
}

.section-body {
  padding: 0.95rem;
  display: grid;
  gap: 0.85rem;
}

.section-body.compact {
  gap: 0.5rem;
}

.kv {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.6rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px dashed var(--line);
}

.kv:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.kv .label {
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.kv .value {
  color: var(--ink-2);
  font-size: 0.85rem;
  line-height: 1.55;
}

.pill-row,
.step-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.pill {
  padding: 0.2rem 0.55rem;
  background: rgba(96, 165, 250, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.25);
  color: #93c5fd;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
}

.pill.muted {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.25);
  color: var(--muted);
}

.status {
  flex: none;
  padding: 0.2rem 0.5rem;
  border-radius: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.status.pass {
  color: var(--green);
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.1);
}

.status.warn {
  color: var(--amber);
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.1);
}

.status.draft {
  color: var(--accent);
  border-color: rgba(96, 165, 250, 0.4);
  background: rgba(96, 165, 250, 0.1);
}

.status.muted {
  color: var(--muted);
  border-color: rgba(148, 163, 184, 0.3);
  background: rgba(148, 163, 184, 0.08);
}

.review-gate {
  margin: 0.85rem 1.2rem 0;
  display: grid;
  grid-template-columns: 1.55rem minmax(0, 1fr) auto;
  gap: 0.7rem;
  align-items: start;
  padding: 0.8rem 0.95rem;
  border: 1px solid rgba(245, 158, 11, 0.32);
  border-radius: 0.65rem;
  background: rgba(245, 158, 11, 0.08);
  color: var(--ink-2);
}

.review-gate-icon {
  width: 1.55rem;
  height: 1.55rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #fbbf24;
  color: #0f172a;
  font-size: 0.82rem;
  font-weight: 900;
}

.review-gate-body {
  min-width: 0;
  font-size: 0.76rem;
  line-height: 1.55;
}

.review-gate-body strong {
  display: block;
  color: var(--ink);
  font-size: 0.84rem;
  margin-bottom: 0.12rem;
}

.review-gate-body p {
  margin: 0;
  color: var(--muted);
}

.review-audit-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.review-audit-summary span {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  min-height: 1.35rem;
  padding: 0.12rem 0.48rem;
  border: 1px solid rgba(245, 158, 11, 0.24);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.36);
  color: #fcd34d;
  font-size: 0.68rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.review-audit-summary.ready span {
  border-color: rgba(34, 197, 94, 0.26);
  color: #86efac;
}

.review-audit-summary .review-audit-state {
  color: var(--ink);
  background: rgba(245, 158, 11, 0.12);
}

.review-audit-summary.ready .review-audit-state {
  background: rgba(34, 197, 94, 0.12);
}

.review-gate-body ul {
  margin: 0.4rem 0 0;
  padding-left: 1rem;
  color: #fcd34d;
}

.review-gate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: flex-end;
}

.decision-receipt {
  margin: 0.85rem 1.2rem 0;
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(96, 165, 250, 0.22);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.46);
}

.skill-health-receipt {
  margin: 0.85rem 1.2rem 0;
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.5);
}

.skill-health-receipt.success {
  border-color: rgba(34, 197, 94, 0.26);
  background: rgba(22, 101, 52, 0.12);
}

.skill-health-receipt.warn {
  border-color: rgba(245, 158, 11, 0.34);
  background: rgba(120, 53, 15, 0.18);
}

.skill-health-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.skill-health-head span {
  font-size: 0.7rem;
  font-weight: 750;
  color: #fbbf24;
}

.skill-health-head strong {
  font-size: 0.82rem;
  color: var(--ink-2);
}

.skill-health-receipt p {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.5;
}

.skill-health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.45rem;
}

.skill-health-row {
  display: grid;
  gap: 0.2rem;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: rgba(2, 6, 23, 0.26);
}

.skill-health-row .label {
  color: var(--muted-2);
  font-size: 0.65rem;
  font-weight: 750;
}

.skill-health-row span:last-child {
  color: var(--ink-2);
  font-size: 0.74rem;
  line-height: 1.5;
}

.decision-receipt-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.decision-receipt-head span {
  font-size: 0.7rem;
  font-weight: 750;
  color: #93c5fd;
}

.decision-receipt-head strong {
  font-size: 0.82rem;
  color: var(--ink-2);
}

.decision-receipt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.45rem;
}

.decision-receipt-row {
  display: grid;
  gap: 0.2rem;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: rgba(2, 6, 23, 0.26);
}

.decision-receipt-row .label {
  font-size: 0.65rem;
  color: var(--muted-2);
  font-weight: 750;
}

.decision-receipt-row span:last-child {
  font-size: 0.74rem;
  line-height: 1.5;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.snoozed-review-gate {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(37, 99, 235, 0.08);
}

.snoozed-review-gate .review-gate-icon {
  background: #60a5fa;
}

.snoozed-review-gate .review-audit-summary span {
  border-color: rgba(96, 165, 250, 0.24);
  color: #bfdbfe;
}

.snoozed-review-gate .review-audit-summary .review-audit-state {
  background: rgba(96, 165, 250, 0.12);
  color: var(--ink);
}

.steps {
  display: grid;
  gap: 0.55rem;
}

.step {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr);
  gap: 0.6rem;
  align-items: start;
  padding: 0.7rem 0.85rem;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid var(--line);
  border-radius: 0.55rem;
}

.step-num {
  width: 1.6rem;
  height: 1.6rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #0f172a;
  font-weight: 800;
  font-size: 0.78rem;
}

.step-body strong {
  display: block;
  font-size: 0.86rem;
  color: var(--ink);
  margin-bottom: 0.25rem;
}

.step-body p {
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.55;
  margin: 0;
}

.step-tools {
  margin-top: 0.45rem;
}

.evidence-list,
.version-list,
.evidence-card,
.version-card,
.binding-card {
  display: grid;
  gap: 0.6rem;
}

.evidence-card,
.version-card,
.binding-card {
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid var(--line);
  border-radius: 0.55rem;
  padding: 0.85rem 0.95rem;
}

.evidence-foot {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}

.evidence-head span,
.version-head span,
.evidence-foot,
.binding-meta {
  font-size: 0.7rem;
  color: var(--muted);
}

.version-diff {
  display: grid;
  gap: 0.3rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  background: var(--code-bg);
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  padding: 0.6rem 0.8rem;
}

.diff-line {
  display: flex;
  gap: 0.4rem;
}

.diff-line .marker {
  width: 0.8rem;
  flex-shrink: 0;
  font-weight: 700;
}

.diff-line.add {
  color: var(--green);
}

.diff-line.context {
  color: var(--muted);
}

.install-banner {
  background: linear-gradient(
    135deg,
    rgba(96, 165, 250, 0.12),
    rgba(167, 139, 250, 0.12)
  );
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 0.6rem;
  padding: 0.75rem 0.95rem;
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  color: var(--ink-2);
  font-size: 0.78rem;
  line-height: 1.6;
}

.install-banner-icon {
  flex: none;
  font-size: 1.1rem;
}

.install-banner-body {
  flex: 1;
  min-width: 0;
}

.install-banner-body strong {
  color: var(--ink);
  font-weight: 700;
}

.install-url-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.7rem;
  align-items: center;
}

.install-url-copy {
  min-width: 0;
}

.install-url-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: flex-end;
}

.install-banner-body code,
.binding-instruction .text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: var(--code-bg);
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  padding: 0.45rem 0.65rem;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.install-banner-scope {
  display: inline-block;
  margin-top: 0.45rem;
  padding: 0.25rem 0.55rem;
  border-radius: 0.45rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.28);
  color: #fbbf24;
  font-size: 0.72rem;
}

.share-receipt {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.65rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.55rem;
  background: rgba(15, 23, 42, 0.45);
}

.share-receipt-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  justify-content: space-between;
}

.share-receipt-head span {
  color: var(--muted-2);
  font-size: 0.68rem;
  font-weight: 800;
}

.share-receipt-head strong {
  color: var(--ink);
  font-size: 0.82rem;
}

.share-receipt-grid {
  display: grid;
  gap: 0.4rem;
}

.share-receipt-row {
  display: grid;
  grid-template-columns: minmax(5rem, 0.34fr) minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
}

.share-receipt-row .label {
  color: var(--muted-2);
  font-size: 0.66rem;
  font-weight: 800;
}

.share-receipt-row span:last-child {
  color: var(--ink-2);
  font-size: 0.74rem;
  line-height: 1.5;
}

.share-copy-receipt {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.65rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid rgba(34, 197, 94, 0.28);
  border-radius: 0.55rem;
  background: rgba(6, 78, 59, 0.24);
}

.share-copy-receipt.warn {
  border-color: rgba(245, 158, 11, 0.36);
  background: rgba(120, 53, 15, 0.22);
}

.share-copy-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  justify-content: space-between;
}

.share-copy-head span {
  color: var(--muted-2);
  font-size: 0.68rem;
  font-weight: 800;
}

.share-copy-head strong {
  color: var(--ink);
  font-size: 0.82rem;
}

.share-copy-receipt p {
  margin: 0;
  color: var(--ink-2);
  font-size: 0.74rem;
  line-height: 1.5;
}

.share-copy-grid {
  display: grid;
  gap: 0.4rem;
}

.share-copy-row {
  display: grid;
  grid-template-columns: minmax(5rem, 0.34fr) minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
}

.share-copy-row .label {
  color: var(--muted-2);
  font-size: 0.66rem;
  font-weight: 800;
}

.share-copy-row span:last-child {
  color: var(--ink-2);
  font-size: 0.74rem;
  line-height: 1.5;
}

@media (max-width: 780px) {
  .inbox-priority {
    grid-template-columns: 1fr;
  }

  .inbox-priority .btn {
    justify-self: start;
  }

  .install-url-head {
    grid-template-columns: 1fr;
  }

  .install-url-actions {
    justify-content: flex-start;
  }

  .review-gate {
    grid-template-columns: 1.55rem minmax(0, 1fr);
  }

  .review-gate-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .share-receipt-row {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  .share-copy-row {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }
}

.share-error {
  color: #fecaca;
}

.bindings-grid,
.sync-rows {
  display: grid;
  gap: 0.75rem;
}

.install-command {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: center;
}

.binding-name-block {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  min-width: 0;
}

.binding-icon {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid var(--line-strong);
  display: grid;
  place-items: center;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.binding-name-block p {
  margin: 0.15rem 0 0;
  font-size: 0.7rem;
  color: var(--muted);
}

.binding-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  align-items: center;
}

.binding-tab-notice,
.binding-hint {
  display: grid;
  grid-template-columns: 1.35rem minmax(0, 1fr);
  gap: 0.55rem;
  padding: 0.65rem 0.75rem;
  border-radius: 0.55rem;
  font-size: 0.74rem;
  line-height: 1.5;
}

.binding-tab-notice.warn,
.binding-hint.warn {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.26);
}

.binding-hint.info {
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.24);
}

.binding-tab-notice .binding-hint-icon,
.binding-hint-icon {
  width: 1.35rem;
  height: 1.35rem;
  display: grid;
  place-items: center;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
  color: #0f172a;
}

.binding-tab-notice.warn .binding-hint-icon,
.binding-hint.warn .binding-hint-icon {
  background: #fbbf24;
}

.binding-hint.info .binding-hint-icon {
  background: #93c5fd;
}

.binding-hint-body {
  min-width: 0;
}

.binding-tab-notice strong,
.binding-hint strong {
  display: block;
  color: var(--ink-2);
  font-weight: 700;
}

.binding-tab-notice p,
.binding-hint p {
  margin: 0.15rem 0 0;
  color: var(--muted);
}

.binding-tab-notice a,
.binding-hint a,
.text-action {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  margin-top: 0.35rem;
  padding: 0;
  border: none;
  background: transparent;
  color: #93c5fd;
  font-size: 0.74rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.binding-tab-notice a:hover,
.binding-hint a:hover,
.text-action:hover {
  color: #bfdbfe;
}

.mini {
  height: 1.7rem;
  font-size: 0.72rem;
}

.binding-state {
  flex: none;
  padding: 0.2rem 0.5rem;
  border-radius: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.binding-state.installed {
  color: var(--green);
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.1);
}

.binding-state.outdated,
.binding-state.unknown {
  color: var(--amber);
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.1);
}

.binding-state.manual {
  color: #93c5fd;
  border-color: rgba(96, 165, 250, 0.36);
  background: rgba(96, 165, 250, 0.1);
}

.binding-state.blocked {
  color: var(--red);
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.1);
}

.binding-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 100;
  padding: 1rem;
}

.sync-dialog {
  width: min(640px, 100%);
  max-height: min(680px, 92vh);
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid var(--line-strong);
  border-radius: 0.85rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sync-dialog header {
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--line);
}

.sync-dialog h3 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.sync-dialog p {
  margin-top: 0.3rem;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.55;
  max-width: 460px;
}

.sync-dialog > .status-box,
.sync-scope-overview,
.conflict-note,
.sync-rows {
  margin: 0.9rem 1.2rem 0;
}

.sync-scope-overview {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 0.6rem;
  background: rgba(30, 64, 175, 0.1);
}

.sync-scope-overview-head strong {
  color: #bfdbfe;
}

.sync-result-receipt {
  display: grid;
  gap: 0.65rem;
}

.sync-result-receipt.success {
  border-color: rgba(34, 197, 94, 0.34);
  background: rgba(22, 163, 74, 0.1);
}

.sync-result-receipt.warn {
  border-color: rgba(245, 158, 11, 0.34);
  background: rgba(245, 158, 11, 0.1);
}

.sync-result-receipt.failed {
  border-color: rgba(248, 113, 113, 0.36);
  background: rgba(127, 29, 29, 0.18);
}

.sync-result-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.sync-result-head span {
  font-size: 0.68rem;
  color: var(--muted-2);
}

.sync-result-head strong {
  color: var(--ink);
  font-size: 0.82rem;
}

.sync-result-receipt p {
  margin: 0;
  max-width: none;
}

.sync-result-grid {
  display: grid;
  gap: 0.42rem;
}

.sync-result-row {
  display: grid;
  grid-template-columns: 5.2rem minmax(0, 1fr);
  gap: 0.55rem;
  color: var(--ink-2);
  font-size: 0.73rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.sync-result-row .label {
  color: var(--muted-2);
  font-weight: 700;
}

.sync-result-row.success {
  color: #bbf7d0;
}

.sync-result-row.warn {
  color: #fed7aa;
}

.sync-result-row.failed {
  color: #fecaca;
}

.sync-rows {
  margin-bottom: 1.2rem;
}

.conflict-note {
  color: var(--ink-2);
  line-height: 1.6;
  font-size: 0.74rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: 0.55rem;
  padding: 0.65rem 0.85rem;
}

.sync-row {
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr) auto;
  gap: 0.7rem;
  align-items: center;
  padding: 0.75rem 0.9rem;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid var(--line);
  border-radius: 0.6rem;
}

.sync-row-icon {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.45rem;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid var(--line-strong);
  display: grid;
  place-items: center;
  font-size: 1.05rem;
}

.sync-row-body strong {
  display: block;
  font-size: 0.86rem;
  color: var(--ink);
}

.sync-row-body p {
  margin-top: 0.18rem;
  font-size: 0.74rem;
  color: var(--muted);
  line-height: 1.55;
}

.sync-row-body .mode,
.sync-row-body .scope {
  margin-top: 0.35rem;
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  font-size: 0.7rem;
  color: var(--muted-2);
  margin-right: 0.5rem;
}

.sync-row-body .scope {
  color: var(--muted);
}

.sync-diagnostics {
  margin-top: 0.42rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.sync-diagnostic {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  max-width: 100%;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  color: var(--muted);
  background: rgba(15, 23, 42, 0.66);
  font-size: 0.68rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.sync-diagnostic.ready {
  color: #bbf7d0;
  border-color: rgba(34, 197, 94, 0.34);
  background: rgba(22, 163, 74, 0.12);
}

.sync-diagnostic.info {
  color: #bfdbfe;
  border-color: rgba(96, 165, 250, 0.34);
  background: rgba(59, 130, 246, 0.12);
}

.sync-diagnostic.warn,
.sync-diagnostic.blocked {
  color: #fed7aa;
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.12);
}

.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  user-select: none;
}

.switch input {
  appearance: none;
  width: 2.4rem;
  height: 1.4rem;
  background: rgba(148, 163, 184, 0.25);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  margin: 0;
  flex-shrink: 0;
}

.switch input::after {
  content: '';
  position: absolute;
  width: 1.05rem;
  height: 1.05rem;
  background: #fff;
  border-radius: 50%;
  top: 0.175rem;
  left: 0.175rem;
  transition: left 0.18s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.switch input:checked {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}

.switch input:checked::after {
  left: 1.175rem;
}

.switch input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.switch span {
  font-size: 0.74rem;
  color: var(--muted);
  font-weight: 600;
}

.sync-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.7rem;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.3);
}

::-webkit-scrollbar-thumb {
  background: rgba(96, 165, 250, 0.25);
  border-radius: 4px;
}

@media (max-width: 980px) {
  .foundry-grid {
    grid-template-columns: 1fr;
  }

  .skills-header,
  .workspace-head,
  .sync-row {
    grid-template-columns: 1fr;
    display: grid;
  }

  .decision-overview-grid,
  .empty-receipt-grid {
    grid-template-columns: 1fr;
  }
}
</style>
