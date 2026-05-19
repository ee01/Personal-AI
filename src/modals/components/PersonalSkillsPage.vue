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
          你的真源技能库：从 Codex / Claude / OpenClaw / Jira / 会议中沉淀「做事方法」，再以一句安装指引 + URL 的方式快速绑定到任意 agent 平台。
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
                :class="{ active: selectedId === suggestion.id }"
                role="button"
                tabindex="0"
                @click="selectSkill(suggestion.id)"
                @keydown.enter="selectSkill(suggestion.id)"
                @keydown.space.prevent="selectSkill(suggestion.id)"
              >
                <div class="top">
                  <div class="title">{{ suggestion.title }}</div>
                  <span class="when">{{ suggestionSourceLabel(suggestion) }}</span>
                  <span v-if="suggestion.reviewRequired" class="review-chip">
                    需审核
                  </span>
                  <span v-if="isExternalChangeSuggestion(suggestion)" class="change-chip">
                    变更
                  </span>
                </div>
                <div class="desc">{{ suggestion.summary || '暂无摘要' }}</div>
                <div class="source">
                  <span>{{ isExternalChangeSuggestion(suggestion) ? '变更' : '来源' }}</span>
                  <span class="source-link">
                    {{ suggestionOriginText(suggestion) }}
                  </span>
                </div>
                <div class="actions">
                  <button
                    class="btn primary"
                    type="button"
                    @click.stop="handleSuggestionPrimary(suggestion.id)"
                  >
                    {{ suggestionPrimaryLabel(suggestion) }}
                  </button>
                  <button
                    class="btn danger"
                    type="button"
                    @click.stop="dismissSuggestion(suggestion.id)"
                  >
                    ✕ 丢弃
                  </button>
                  <button
                    class="btn secondary"
                    type="button"
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

    <div v-if="errorMessage" class="status-box error">{{ errorMessage }}</div>
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
          <div class="rail-segmented segmented" role="group" aria-label="技能过滤">
            <button
              :class="{ active: filter === 'active' }"
              @click="setFilter('active')"
            >
              在用
            </button>
            <button :class="{ active: filter === 'all' }" @click="setFilter('all')">
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
          {{ filter === 'dismissed' ? '目前没有已丢弃的技能。' : '还没有在用技能。' }}
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
              <span v-if="visibleBindings(skill).length === 0" class="binding-pill muted">
                <span class="dot"></span>
                未绑定
              </span>
            </div>
            <div class="candidate-status card-foot">
              <span :class="['badge', skill.status]">{{ statusLabel(skill.status) }}</span>
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
              </div>
              <h2>{{ selectedSkill.title }}</h2>
              <p>{{ selectedSkill.summary }}</p>
            </div>
            <div class="workspace-actions">
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
                v-if="selectedSkill.status === 'suggestion'"
                class="btn primary primary-btn"
                @click="handleSuggestionPrimary(selectedSkill.id)"
              >
                {{ suggestionPrimaryLabel(selectedSkill) }}
              </button>
              <button
                v-if="selectedSkill.status === 'suggestion'"
                class="btn danger secondary-btn"
                @click="dismissSuggestion(selectedSkill.id)"
              >
                ✕ 丢弃
              </button>
            </div>
          </header>

          <nav class="workspace-tabs" aria-label="技能详情">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="tab-btn"
              :class="{ active: activeTab === tab.key }"
              @click="setActiveTab(tab.key)"
            >
              {{ tab.label }}
              <span v-if="tabCount(tab.key)" class="tab-badge tab-count">{{ tabCount(tab.key) }}</span>
            </button>
          </nav>

          <section
            v-if="selectedSkill.status === 'suggestion' && requiresReview(selectedSkill)"
            class="review-gate"
          >
            <div class="review-gate-icon">!</div>
            <div class="review-gate-body">
              <strong>{{ reviewGateTitle(selectedSkill) }}</strong>
              <p>{{ reviewGateDescription(selectedSkill) }}</p>
              <ul>
                <li v-for="reason in reviewReasons(selectedSkill)" :key="reason">
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
                v-else
                class="btn primary mini"
                type="button"
                @click="useSuggestion(selectedSkill.id, { reviewConfirmed: true })"
              >
                {{ suggestionPrimaryLabel(selectedSkill) }}
              </button>
            </div>
          </section>

          <div class="workspace-content">
            <section v-if="activeTab === 'workflow'" class="detail-section">
              <section class="section">
                <div class="section-head">
                  <h3><span class="icon">🔁</span>工作流（{{ selectedSkill.workflow.length }} 步）</h3>
                  <span class="status draft">{{ selectedSkill.currentVersion || 'no version' }}</span>
                </div>
                <div class="section-body">
                  <div class="kv">
                    <div class="label">触发</div>
                    <div class="value">{{ selectedSkill.trigger || '未配置触发条件' }}</div>
                  </div>
                  <div class="kv">
                    <div class="label">不要触发</div>
                    <div class="value">{{ selectedSkill.notUse || '未配置排除条件' }}</div>
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
                        <span v-if="selectedSkill.sources.length === 0" class="pill muted">
                          未标注
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="kv">
                    <div class="label">风险策略</div>
                    <div class="value">{{ selectedSkill.riskBrief || selectedSkill.risk }}</div>
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
                          <span v-for="tool in step.tools" :key="tool" class="pill muted">{{ tool }}</span>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              </section>

              <section class="section">
                <div class="section-head">
                  <h3><span class="icon">🛫</span>来源 episode（Flight Recorder）</h3>
                  <span class="status muted">{{ selectedSkill.sourceEpisodes.length }} 条</span>
                </div>
                <div class="section-body compact">
                  <div v-if="selectedSkill.sourceEpisodes.length === 0" class="empty-card">
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
                          <p>{{ episode.date || '无日期' }} · {{ episode.id }}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </section>

            <section v-else-if="activeTab === 'evidence'" class="detail-section">
              <section class="section">
                <div class="section-head">
                  <h3><span class="icon">🧾</span>证据链（{{ selectedSkill.evidence.length }} refs）</h3>
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
                        <span class="pill muted">{{ evidence.kind || 'memory' }}</span>
                      </div>
                      <p>{{ evidence.desc }}</p>
                      <div class="evidence-foot">
                        <span :class="['status', evidenceStateClass(evidence.evidenceState)]">
                          {{ evidenceStateLabel(evidence.evidenceState) }}
                        </span>
                        <span v-if="evidence.episodeId">episode {{ evidence.episodeId }}</span>
                        <span v-else>无来源 episode</span>
                      </div>
                    </article>
                  </div>
                  <div v-if="selectedSkill.evidence.length === 0" class="empty-card">
                    暂无证据。
                  </div>
                </div>
              </section>
            </section>

            <section v-else-if="activeTab === 'versions'" class="detail-section">
              <section class="section">
                <div class="section-head">
                  <h3><span class="icon">🪜</span>版本历史（{{ selectedSkill.versions.length }}）</h3>
                  <span class="status muted">当前 {{ selectedSkill.currentVersion || 'no version' }}</span>
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
                          {{ formatDate(version.createdAt) }} · {{ version.createdFrom || 'personal_ai' }}
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
                    短链只用于识别 slug/version；直接打开或给 agent 安装时会使用带 token
                    的可访问 URL，拉取 SKILL.md 和资源。已绑定状态由后台同步程序异步更新。
                  </p>
                  <span class="install-banner-scope">
                    自动同步开关在平台维度，不是单条技能；开启后同步所有 active 技能。
                  </span>
                </div>
              </div>

              <section class="section">
                <div class="section-head">
                  <h3><span class="icon">🔌</span>平台绑定（{{ bindingCards.length }}）</h3>
                  <button class="btn secondary mini" type="button" @click="openSyncDialog">
                    ⚙ 平台级自动同步
                  </button>
                </div>
                <div class="section-body">
                  <div v-if="showDesktopAppBindingNotice" class="binding-tab-notice warn">
                    <span class="binding-hint-icon" aria-hidden="true">!</span>
                    <div>
                      <strong>需要 Desktop App 才能读取本机平台状态</strong>
                      <p>
                        Codex CLI / Claude Code / Cursor 的 skill 目录在本机文件系统里。
                        安装并运行最新版 Desktop App 后，Personal AI 才能判断是否已安装并执行双向同步。
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
                          <span class="binding-icon">{{ platformIcon(binding.platform) }}</span>
                          <div>
                            <strong>{{ platformLabel(binding.platform) }}</strong>
                            <p>{{ platformNote(binding.platform) }}</p>
                          </div>
                        </div>
                        <span :class="['binding-state', bindingStateClass(binding)]">
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
                            v-else-if="bindingHint(binding)?.action === 'sync-settings'"
                            type="button"
                            class="text-action"
                            @click="openSyncDialog"
                          >
                            {{ bindingHint(binding)?.cta }}
                          </button>
                        </div>
                      </div>
                      <div v-if="binding.platform !== 'personal_ai'" class="install-command binding-instruction">
                        <span class="text">{{ installCommand(binding.platform) }}</span>
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
                        <span v-if="binding.installedVersion">已安装 {{ binding.installedVersion }}</span>
                        <span v-if="binding.lastError">{{ binding.lastError }}</span>
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

    <div v-if="syncDialogOpen" class="dialog-backdrop" @click.self="closeSyncDialog">
      <div class="sync-dialog" role="dialog" aria-label="平台级自动同步">
        <header>
          <div>
            <h3>平台级自动同步</h3>
            <p>
              开关按平台生效，不按单条技能生效。开启后该平台会跟随推送所有 active 技能。
            </p>
          </div>
          <div class="dialog-actions">
            <button class="secondary-btn" @click="closeSyncDialog">关闭</button>
          </div>
        </header>
        <div v-if="syncResultMessage" class="status-box">
          {{ syncResultMessage }}
        </div>
        <div class="conflict-note">
          sha256 相同视为已对齐；远端 mtime 晚于真源时进入萃取建议审稿，不自动覆盖。
        </div>
        <div class="sync-rows">
          <article v-for="setting in syncSettings" :key="setting.platform" class="sync-row">
            <div class="sync-row-icon">{{ platformIcon(setting.platform) }}</div>
            <div class="sync-row-body">
              <strong>{{ platformLabel(setting.platform) }}</strong>
              <p>{{ syncDescription(setting) }}</p>
              <span class="mode">{{ setting.mode }}</span>
              <span class="scope sync-scope">{{ syncScope(setting) }}</span>
            </div>
            <div class="sync-row-actions">
              <button
                v-if="setting.platform === 'openclaw'"
                class="icon-btn sync-now-btn"
                :disabled="syncRunning || !setting.enabled"
                :title="syncRunning ? 'OpenClaw 同步中' : '立即同步 OpenClaw'"
                aria-label="立即同步 OpenClaw"
                @click="runOpenClawSync"
              >
                <span aria-hidden="true">⟳</span>
              </button>
              <button
                v-else-if="localDesktopPlatforms.includes(setting.platform)"
                class="icon-btn sync-now-btn"
                :disabled="syncRunning || !setting.enabled || !desktopAppInstalled"
                :title="syncRunning ? '同步中' : `立即同步 ${platformLabel(setting.platform)}`"
                :aria-label="`立即同步 ${platformLabel(setting.platform)}`"
                @click="runDesktopSkillSync(setting.platform)"
              >
                <span aria-hidden="true">⟳</span>
              </button>
              <label class="switch">
                <input
                  type="checkbox"
                  :checked="setting.enabled"
                  :disabled="syncDisabled(setting)"
                  @change="toggleSync(setting, $event)"
                />
                <span>{{ setting.enabled ? '已开启' : syncDisabled(setting) ? '不可用' : '未开启' }}</span>
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
  type SkillPlatformBinding,
  type SkillSyncSetting,
} from '../../services/MemoryServiceClient';
import { DesktopAppClient } from '../../services/DesktopAppClient';

type SkillFilter = 'active' | 'all' | 'dismissed';
type SkillTab = 'workflow' | 'evidence' | 'versions' | 'bindings';
type UseSuggestionOptions = { reviewConfirmed?: boolean };
type ReviewableSkill = Pick<
  PersonalSkillListItem,
  'id' | 'slug' | 'reviewRequired' | 'reviewReasons' | 'bindings'
>;

const client = getMemoryServiceClient();
const desktopClient = new DesktopAppClient();
const loading = ref(false);
const errorMessage = ref('');
const skills = ref<PersonalSkillListItem[]>([]);
const suggestions = ref<PersonalSkillListItem[]>([]);
const selectedSkill = ref<PersonalSkillDetail | null>(null);
const selectedId = ref('');
const activeTab = ref<SkillTab>('workflow');
const reviewedSuggestionIds = ref<Set<string>>(new Set());
const filter = ref<SkillFilter>('active');
const searchQuery = ref('');
const inboxExpanded = ref(true);
const syncDialogOpen = ref(false);
const syncRunning = ref(false);
const syncResultMessage = ref('');
const syncSettings = ref<SkillSyncSetting[]>([]);
const desktopAppInstalled = ref(false);
const DESKTOP_APP_RELEASE_URL =
  'https://github.com/ee01/personal-ai/releases/latest';
const localDesktopPlatforms = ['codex', 'claude_code', 'cursor'];

const tabs: Array<{ key: SkillTab; label: string }> = [
  { key: 'workflow', label: '工作流' },
  { key: 'evidence', label: '证据' },
  { key: 'versions', label: '版本' },
  { key: 'bindings', label: '绑定' },
];

const platformMeta: Record<string, { label: string; note: string; icon: string }> = {
  personal_ai: { label: 'Personal AI', icon: '🧠', note: '技能真源，永远 active' },
  openclaw: { label: 'OpenClaw remote', icon: '🐾', note: '通过 /v1/responses + skills.* RPC 同步' },
  codex: { label: 'Codex CLI', icon: '🤖', note: '本机 ~/.codex/skills' },
  claude_code: { label: 'Claude Code', icon: '🪶', note: '本机 ~/.claude/skills 或用户绑定目录' },
  cursor: { label: 'Cursor', icon: '🅒', note: 'Cursor user rules + skills' },
  chatgpt_gpts: { label: 'ChatGPT / GPTs', icon: '💬', note: '纯 Web，不可写文件' },
  claude_skills_web: { label: 'Claude.ai Skills', icon: '🅰', note: 'Web 版本，不可写文件' },
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
    if (filter.value === 'dismissed' && skill.status !== 'dismissed') return false;
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

const activeSkillCount = computed(
  () => skills.value.filter((skill) => skill.status === 'active').length,
);

const inboxSourceMeta = computed(() => {
  const sourceSet = new Set(
    suggestions.value.flatMap((suggestion) => [
      suggestion.suggestedFrom,
      ...(suggestion.sources || []),
    ]).filter(Boolean),
  );
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
      description:
        '这些建议来自真实操作 episode；可以直接使用、丢弃或稍后审。',
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

const suggestionGroups = computed(() => {
  const groups = new Map<
    string,
    { key: string; icon: string; title: string; items: PersonalSkillListItem[] }
  >();
  const ensure = (key: string, icon: string, title: string) => {
    if (!groups.has(key)) groups.set(key, { key, icon, title, items: [] });
    return groups.get(key)!;
  };
  for (const suggestion of suggestions.value) {
    if (suggestion.suggestedFrom === 'openclaw' || suggestion.sources?.includes('openclaw')) {
      ensure('openclaw', '🐾', 'OpenClaw 导入').items.push(suggestion);
    } else if (
      suggestion.suggestedFrom === 'flight_recorder' ||
      suggestion.sources?.includes('flight_recorder')
    ) {
      ensure('flight_recorder', '🛫', 'Flight Recorder 萃取').items.push(suggestion);
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
    bindingCards.value.some((binding) => isLocalDesktopPlatform(binding.platform))
  );
});

async function loadData(preferredId?: string) {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [skillList, suggestionList, settings] = await Promise.all([
      client.getPersonalSkills({ filter: filter.value }),
      client.getSkillSuggestions(),
      client.getSkillSyncSettings(),
    ]);
    skills.value = skillList.items;
    suggestions.value = suggestionList.items;
    syncSettings.value = settings.items;
    const visibleIds = new Set([
      ...skills.value.map((skill) => skill.id),
      ...suggestions.value.map((skill) => skill.id),
    ]);
    const preferredVisibleId = preferredId && visibleIds.has(preferredId) ? preferredId : '';
    const currentVisibleId = selectedId.value && visibleIds.has(selectedId.value)
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
    }
  } catch (error: any) {
    errorMessage.value = error?.message || '加载个人技能失败';
  } finally {
    loading.value = false;
  }
}

async function selectSkill(id: string) {
  selectedId.value = id;
  activeTab.value = 'workflow';
  try {
    selectedSkill.value = (await client.getPersonalSkill(id)).skill;
  } catch (error: any) {
    errorMessage.value = error?.message || '加载技能详情失败';
  }
}

function visibleSkillById(id: string) {
  if (selectedSkill.value?.id === id) return selectedSkill.value;
  return (
    suggestions.value.find((skill) => skill.id === id) ||
    skills.value.find((skill) => skill.id === id)
  );
}

function externalChangeBinding(skill?: Pick<PersonalSkillListItem, 'bindings'> | null) {
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

function requiresReview(skill?: Pick<PersonalSkillListItem, 'reviewRequired' | 'reviewReasons'> | null) {
  return Boolean(skill?.reviewRequired || skill?.reviewReasons?.length);
}

function markSuggestionReviewed(id: string) {
  if (reviewedSuggestionIds.value.has(id)) return;
  reviewedSuggestionIds.value = new Set([...reviewedSuggestionIds.value, id]);
}

function canConfirmSuggestion(
  skill?: Pick<PersonalSkillListItem, 'id' | 'reviewRequired' | 'reviewReasons'> | null,
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
  return isExternalChangeSuggestion(skill) ? '外部变更需要审核' : '使用前需要审核';
}

function reviewGateDescription(skill?: ReviewableSkill | null) {
  if (isExternalChangeSuggestion(skill)) {
    return `${externalChangePlatformLabel(skill)} 检测到 ${externalChangeOriginalSlug(
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

async function handleSuggestionPrimary(id: string) {
  const candidate = visibleSkillById(id);
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
  if (!options.reviewConfirmed && requiresReview(candidate)) {
    await prepareSuggestionReview(id);
    return;
  }

  try {
    const response = await client.useSkillSuggestion(id, {
      reviewConfirmed: Boolean(options.reviewConfirmed),
    });
    await loadData(response.skill.id);
  } catch (error: any) {
    if (/Review required/i.test(error?.message || '')) {
      await prepareSuggestionReview(id);
      errorMessage.value = '使用前需要先确认审核项。';
      return;
    }
    errorMessage.value = error?.message || '使用技能建议失败';
  }
}

async function dismissSuggestion(id: string) {
  try {
    const response = await client.dismissSkillSuggestion(id);
    await loadData(response.skill.id);
  } catch (error: any) {
    errorMessage.value = error?.message || '丢弃技能建议失败';
  }
}

async function snoozeSuggestion(id: string) {
  try {
    await client.snoozeSkillSuggestion(id);
    await loadData();
  } catch (error: any) {
    errorMessage.value = error?.message || '稍后审技能建议失败';
  }
}

function setFilter(next: SkillFilter) {
  filter.value = next;
  void loadData();
}

function visibleBindings(skill: PersonalSkillListItem) {
  return (skill.bindings || [])
    .filter((binding) => binding.state === 'installed' || binding.state === 'outdated')
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
  if (suggestion.suggestedFrom === 'openclaw' || suggestion.sources?.includes('openclaw')) {
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
  if (suggestion.suggestedFrom === 'openclaw' || suggestion.sources?.includes('openclaw')) {
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
    if (isExternalChangeSuggestion(skill)) return 'External Change · 需审核';
    return requiresReview(skill) ? 'Skill Suggestion · 需审核' : 'Skill Suggestion';
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

function bindingStatusLabel(binding: SkillPlatformBinding) {
  if (isLocalDesktopPlatform(binding.platform) && !desktopAppInstalled.value) {
    return '状态未知';
  }
  return bindingStateLabel(binding.state);
}

function bindingStateClass(binding: SkillPlatformBinding) {
  if (isLocalDesktopPlatform(binding.platform) && !desktopAppInstalled.value) {
    return 'unknown';
  }
  return binding.state;
}

function bindingHint(binding: SkillPlatformBinding):
  | {
      tone: 'warn' | 'info';
      icon: string;
      title: string;
      text: string;
      cta: string;
      href?: string;
      action?: 'sync-settings';
    }
  | null {
  if (!isLocalDesktopPlatform(binding.platform)) return null;
  const platform = platformLabel(binding.platform);
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

async function copyInstallCommand(platform: string) {
  if (!selectedSkill.value?.share) return;
  await navigator.clipboard.writeText(installCommand(platform));
}

async function copySkillUrl() {
  if (!actualSkillUrl.value) return;
  await navigator.clipboard.writeText(actualSkillUrl.value);
}

function openSkillPreview() {
  if (!actualSkillUrl.value) return;
  window.open(actualSkillUrl.value, '_blank', 'noopener');
}

function settingFor(platform: string) {
  return syncSettings.value.find((setting) => setting.platform === platform);
}

function syncTag(platform: string) {
  const setting = settingFor(platform);
  if (!setting) return '未配置同步';
  if (setting.capability === 'internal') return '真源';
  if (setting.capability === 'manual_only') return '仅手动安装';
  if (setting.capability === 'fs_via_desktop_app' && !desktopAppInstalled.value) {
    return setting.enabled ? '平台同步: 开（等待 Desktop App）' : '平台同步: 关';
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

function syncDescription(setting: SkillSyncSetting) {
  if (setting.capability === 'internal') return 'Personal AI 是技能真源，始终 active。';
  if (setting.capability === 'api') return '通过 OpenClaw 远端 API 直连，同步状态并可回拉 SKILL 包。';
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

function openSyncDialog() {
  syncDialogOpen.value = true;
}

function closeSyncDialog() {
  syncDialogOpen.value = false;
}

async function toggleSync(setting: SkillSyncSetting, event: Event) {
  const input = event.target as HTMLInputElement;
  try {
    const result = await client.updateSkillSyncSetting(setting.platform, input.checked);
    const index = syncSettings.value.findIndex(
      (item) => item.platform === setting.platform,
    );
    if (index >= 0) syncSettings.value[index] = result.setting;
  } catch (error: any) {
    errorMessage.value = error?.message || '更新同步设置失败';
    input.checked = setting.enabled;
  }
}

async function runOpenClawSync() {
  syncRunning.value = true;
  syncResultMessage.value = '';
  try {
    const result = await client.runSkillSync({
      platform: 'openclaw',
      limit: 10,
    });
    const openclaw = result.platforms.find((item) => item.platform === 'openclaw');
    if (!openclaw) {
      syncResultMessage.value = 'OpenClaw 未参与本次同步。';
    } else if (openclaw.status === 'failed') {
      syncResultMessage.value =
        openclaw.errors[0]?.error || 'OpenClaw 同步失败。';
    } else {
      syncResultMessage.value = [
        `已处理 ${openclaw.processed} 条`,
        `新增建议 ${openclaw.imported} 条`,
        `待审核变更 ${openclaw.externalChanges} 条`,
        `更新绑定 ${openclaw.updated} 条`,
        `推送 ${openclaw.pushed} 条`,
        openclaw.errors.length ? `失败 ${openclaw.errors.length} 条` : '',
        openclaw.externalChanges
          ? '请到顶部 Inbox 审核外部变更。'
          : openclaw.hasMore
            ? '还有更多远端技能，可继续同步。'
            : '已无待导入远端技能。',
      ].filter(Boolean).join(' · ');
      await loadData(selectedId.value);
    }
  } catch (error: any) {
    syncResultMessage.value = error?.message || 'OpenClaw 同步失败';
  } finally {
    syncRunning.value = false;
  }
}

async function runDesktopSkillSync(platform: string) {
  syncRunning.value = true;
  syncResultMessage.value = '';
  try {
    await desktopClient.loadSettings();
    const result = await desktopClient.syncSkills(platform);
    const item = result.platforms.find((platformResult) => platformResult.platform === platform);
    if (!item) {
      syncResultMessage.value = `${platformLabel(platform)} 未参与本次同步。`;
    } else {
      syncResultMessage.value = [
        `${platformLabel(platform)} ${item.status}`,
        `扫描 ${item.scanned} 条`,
        `导入 ${item.imported} 条`,
        `回拉 ${item.pulled} 条`,
        `推送 ${item.pushed} 条`,
        item.errors.length ? `失败 ${item.errors.length} 条` : '',
      ].filter(Boolean).join(' · ');
      await loadData(selectedId.value);
    }
  } catch (error: any) {
    syncResultMessage.value = error?.message || `${platformLabel(platform)} 同步失败`;
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
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.32), rgba(167, 139, 250, 0.32));
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
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.85), rgba(167, 139, 250, 0.85));
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
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.08), rgba(167, 139, 250, 0.08));
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
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(167, 139, 250, 0.12));
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

@media (max-width: 780px) {
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
.conflict-note,
.sync-rows {
  margin: 0.9rem 1.2rem 0;
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
  content: "";
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
}
</style>
